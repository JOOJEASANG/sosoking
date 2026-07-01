const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const TOPIC_POOL = ['모기 수면방해', '엘리베이터 앞문닫힘', '라면 조리순서', '마지막 만두', '리모컨 점유권', '치약 소진', '우산 차 안 방치', '냉장고 마지막 푸딩', '충전기 자리비움', '커피 얼음 실종', '양말 뒤집힘', '택배 문앞 긴장감', '과자 봉지 바닥 부스러기', '에어컨 1도 전쟁'];

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function finalSentence(text) {
  let s = cleanText(text, 120).replace(/["“”'`]/g, '').trim();
  if (!s) s = '제보자는 오늘 낮잠 20분을 긴급 보장받는다.';
  if (!s.endsWith('.')) s += '.';
  return s.length > 70 ? '제보자는 오늘 낮잠 20분을 긴급 보장받는다.' : s;
}
function extractJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function docketNumber(dateKey) {
  return `소소${dateKey.replace(/-/g, '').slice(2)}-오늘의소소-0001`;
}
function isCompleteResult(data = {}) {
  return !!(
    cleanText(data.caseTitle, 30) &&
    cleanText(data.breakingNews || data.reception, 80) &&
    cleanText(data.briefing || data.investigation, 80) &&
    cleanText(data.issue || data.plaintiffArg, 60) &&
    cleanText(data.committeeJudgment || data.verdict, 120) &&
    cleanText(data.finalDecision || data.supremeFinal, 80) &&
    cleanText(data.sentence, 30)
  );
}
async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}
async function isAdminAuth(auth) {
  if (!auth?.uid) return false;
  const uidSnap = await db.doc(`admins/${auth.uid}`).get();
  if (uidSnap.exists) return true;
  const email = String(auth.token?.email || '').trim().toLowerCase();
  if (!email) return false;
  if (email === ['sosoday1976', 'gmail.com'].join('@')) return true;
  const emailSnap = await db.doc(`admins/${email}`).get();
  return emailSnap.exists;
}
async function recentTopicText() {
  const snap = await db.collection('results').orderBy('createdAt', 'desc').limit(30).get().catch(() => null);
  if (!snap) return '';
  return snap.docs.map(d => cleanText(d.data().caseTitle || d.data().caseDescription || '', 36)).filter(Boolean).join(', ');
}
function pickFallbackTopic(dateKey, recent = '') {
  const idx = Number(dateKey.replace(/-/g, '').slice(-2)) % TOPIC_POOL.length;
  const rotated = TOPIC_POOL.slice(idx).concat(TOPIC_POOL.slice(0, idx));
  return rotated.find(t => !recent.includes(t.slice(0, 4))) || rotated[0];
}
function fallbackContent(dateKey, recent = '') {
  const topic = pickFallbackTopic(dateKey, recent);
  const title = `${topic} 사건`.slice(0, 30);
  return {
    caseTitle: title,
    caseDescription: `${topic}로 인해 제보자의 평온한 하루가 매우 작지만 확실하게 흔들렸다.`,
    grievanceIndex: 7,
    nickname: '오늘의제보자',
    desiredVerdict: '소소한 보상과 웃음 1회 보장',
    judgeType: '드립형',
    breakingNews: `속보: ${topic} 관련 미세한 일상 비상사태가 소소킹 상황실에 접수됐다.`,
    briefing: '현장에서는 아무도 출동하지 않았지만 제보자의 표정은 이미 긴급 회의 수준이었다. 관계자에 따르면 문제의 사소함은 작았으나 짜증의 파장은 예상보다 길었다.',
    issue: '이 정도로 작은 일이 사람의 하루를 은근히 흔들 수 있는가.',
    committeeJudgment: '소소긴급위원회는 본 사안을 평범한 해프닝으로만 보기 어렵다고 판단한다. 사건 규모는 먼지급이나 제보자의 표정 변화가 뚜렷해 기록 가치가 있다. 다만 사회 전체가 멈출 정도는 아니므로 과자는 정상적으로 섭취해도 된다.',
    finalDecision: '위원회는 해당 사안을 오늘의 소소 경보로 지정하고, 제보자의 억울함을 조건부 인정한다.',
    sentence: '제보자는 오늘 낮잠 20분을 긴급 보장받는다.'
  };
}
async function buildDailyContent(dateKey, settings = {}, recent = '') {
  try {
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({ model: cleanText(settings.geminiModel, 50) || 'gemini-2.5-flash' });
    const extra = [settings.dailyAiTopicHints && `주제 힌트: ${settings.dailyAiTopicHints}`, settings.dailyAiPrompt && `추가 지시: ${settings.dailyAiPrompt}`].filter(Boolean).join('\n');
    const prompt = `소소킹 공개기록에 올릴 오늘의 한 줄 소소사건 1개를 JSON으로 만든다. 사이트 컨셉은 별것 아닌 사건을 긴급속보와 소소긴급위원회 결정문으로 과장 처리하는 오락 서비스다. 목표 웃김 강도는 8.5/10이다.

중복 방지: 최근 주제와 겹치지 않게 완전히 다른 소재를 고른다.
최근 주제: ${recent || '없음'}
후보 소재 예시: ${TOPIC_POOL.join(', ')}
${extra}

규칙:
- 모기, 라면, 엘리베이터, 치약, 리모컨처럼 작고 안전한 일상 소재만 사용한다.
- 정치, 혐오, 성적 내용, 실제 범죄 묘사, 개인정보는 쓰지 않는다.
- 사건은 먼지급인데 표현은 국가재난급으로 과장한다.
- 마지막 처분은 실행 가능하지만 하찮아서 웃겨야 한다.
- 기존 판결소, 생활법정, 대법원, 원고, 피고 표현은 쓰지 않는다.
- JSON 외의 글은 출력하지 않는다.

필드: caseTitle, caseDescription, grievanceIndex, nickname, desiredVerdict, judgeType, breakingNews, briefing, issue, committeeJudgment, finalDecision, sentence.
판사 성향명은 그대로 사용: ${JUDGES.join(', ')}. 날짜키: ${dateKey}`;
    const result = await model.generateContent(prompt);
    return extractJson(result.response.text());
  } catch (err) {
    console.error('daily AI generation failed, using fallback:', err);
    return fallbackContent(dateKey, recent);
  }
}
function normalizeDailyContent(ai, dateKey, recent = '') {
  const fb = fallbackContent(dateKey, recent);
  const judgeType = JUDGES.includes(ai?.judgeType) ? ai.judgeType : fb.judgeType;
  return {
    caseTitle: cleanText(ai?.caseTitle, 30) || fb.caseTitle,
    caseDescription: cleanText(ai?.caseDescription, 200) || fb.caseDescription,
    grievanceIndex: clampNumber(ai?.grievanceIndex, fb.grievanceIndex, 1, 10),
    nickname: cleanText(ai?.nickname, 20) || fb.nickname,
    desiredVerdict: cleanText(ai?.desiredVerdict, 100) || fb.desiredVerdict,
    judgeType,
    breakingNews: cleanText(ai?.breakingNews, 260) || fb.breakingNews,
    briefing: cleanText(ai?.briefing, 420) || fb.briefing,
    issue: cleanText(ai?.issue, 240) || fb.issue,
    committeeJudgment: cleanText(ai?.committeeJudgment, 620) || fb.committeeJudgment,
    finalDecision: cleanText(ai?.finalDecision, 330) || fb.finalDecision,
    sentence: finalSentence(ai?.sentence || fb.sentence),
  };
}

async function createDailyAiCase(force = false) {
  const settings = await loadSettings();
  if (!force && settings.dailyAiEnabled === false) return { created: false, disabled: true };

  const dateKey = kstDateKey();
  const caseId = `daily_${dateKey.replace(/-/g, '')}`;
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const existing = await resultRef.get();

  if (existing.exists && !force && isCompleteResult(existing.data())) {
    return { created: false, caseId, skipped: 'already-complete' };
  }

  const recent = await recentTopicText();
  const ai = await buildDailyContent(dateKey, settings, recent);
  const data = normalizeDailyContent(ai, dateKey, recent);
  const dailyDocket = docketNumber(dateKey);
  const legacyVerdict = `${data.committeeJudgment}\n\n최종 결정: ${data.finalDecision}`;

  const batch = db.batch();
  batch.set(caseRef, {
    userId: 'system-daily-ai', source: 'daily_ai', dailyDate: dateKey, docketNumber: dailyDocket,
    courtName: '소소긴급위원회', courtroom: '긴급소소상황실', division: '한줄소소처리부', courtStage: 'sentenced',
    caseTitle: data.caseTitle, caseDescription: data.caseDescription, grievanceIndex: data.grievanceIndex,
    nickname: data.nickname, desiredVerdict: data.desiredVerdict, selectedJudge: data.judgeType, judgeType: data.judgeType,
    status: 'completed', isPublic: true, reportCount: 0,
    createdAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(resultRef, {
    source: 'daily_ai', dailyDate: dateKey, docketNumber: dailyDocket, isPublic: true,
    courtName: '소소긴급위원회', courtroom: '긴급소소상황실', division: '한줄소소처리부',
    caseTitle: data.caseTitle, caseDescription: data.caseDescription, grievanceIndex: data.grievanceIndex,
    nickname: data.nickname, desiredVerdict: data.desiredVerdict, judgeType: data.judgeType,
    breakingNews: data.breakingNews, briefing: data.briefing, issue: data.issue,
    committeeJudgment: data.committeeJudgment, finalDecision: data.finalDecision,
    reception: data.breakingNews, investigation: data.briefing, plaintiffArg: data.issue, defendantArg: '',
    verdict: legacyVerdict, supremeFinal: data.finalDecision, sentence: data.sentence,
    reactionTotal: 0, kingCount: 0, funScoreSum: 0, funScoreCount: 0, funScoreAvg: 0,
    commentCount: 0, courtStage: 'sentenced', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();
  await db.doc('site_settings/config').set({ dailyAiLastRunAt: FieldValue.serverTimestamp(), dailyAiLastCaseId: caseId, dailyAiLastTopic: data.caseTitle }, { merge: true });
  return { created: true, caseId, topic: data.caseTitle, repaired: existing.exists && !isCompleteResult(existing.data()) };
}

exports.createDailyAiCase = onSchedule({ region: REGION, schedule: '0 9 * * *', timeZone: 'Asia/Seoul', secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async () => {
  console.log('daily ai record result:', await createDailyAiCase(false));
});
exports.generateDailyAiNow = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!request.auth || !(await isAdminAuth(request.auth))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  return await createDailyAiCase(true);
});
