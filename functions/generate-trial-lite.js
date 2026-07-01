const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function pickJudge(value) {
  if (JUDGES.includes(value)) return value;
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  return JUDGES[seed % JUDGES.length];
}
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function finalSentence(text) {
  let s = cleanText(text, 120).replace(/["“”'`]/g, '').trim();
  s = s.split(/\n/)[0].trim();
  if (!s) s = '제보자는 오늘 낮잠 20분을 긴급 보장받는다.';
  if (!s.endsWith('.')) s += '.';
  return s.length > 70 ? '제보자는 오늘 낮잠 20분을 긴급 보장받는다.' : s;
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function fallback(c, judgeType) {
  const title = cleanText(c.caseTitle, 30) || '사소한 사건';
  const breakingNews = `긴급: ${title}로 인해 일상 평온 지수가 순간적으로 흔들리는 사태가 발생했다.`;
  const briefing = '제보자는 “별일 아니라고 하기엔 내 표정이 너무 진지했다”는 입장을 밝혔다. 현장에서는 아무도 출동하지 않았지만 마음속 상황실은 이미 비상 2단계였다.';
  const issue = '이 정도 사소함이 과연 그냥 넘길 일인가, 아니면 최소한 한 번은 정색하고 말해야 하는가.';
  const committeeJudgment = `${judgeType} 위원은 본 사안이 하찮아 보인다는 점은 인정한다. 그러나 바로 그 하찮음이 사람을 은근히 무너뜨린다는 점에서 소소킹급 검토가 필요하다고 판단한다. 특히 피해 규모는 작지만 짜증의 울림은 생각보다 오래 간다.`;
  const finalDecision = '소소긴급위원회는 해당 사건을 오늘의 소소 경보로 지정하고, 당사자의 억울함을 조건부로 인정한다.';
  const sentence = '제보자는 오늘 낮잠 20분을 긴급 보장받는다.';
  return { breakingNews, briefing, issue, committeeJudgment, finalDecision, sentence };
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');

  let c = caseSnap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 심판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (c.status !== 'pending') throw new HttpsError('failed-precondition', '처리할 수 없는 접수 상태입니다.');

  const judgeType = pickJudge(c.selectedJudge);
  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 접수만 심판할 수 있습니다.');
    if (current.status !== 'pending') return;
    c = current;
    tx.update(caseRef, {
      status: 'processing',
      courtStage: 'briefing',
      judgeType,
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete()
    });
  });

  const latest = await caseRef.get();
  if (latest.data()?.status !== 'processing') return { success: true, skipped: latest.data()?.status || 'unknown' };

  const isPublic = c.isPublic !== false;
  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  let data = fallback(c, judgeType);
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName });
    const prompt = `소소킹의 결과 콘텐츠를 JSON으로 작성한다. 컨셉은 "별것 아닌 한 줄 소소사건을 재난급 긴급속보처럼 터뜨리고, 소소긴급위원회가 국가기관급 엄중한 말투로 즉시 처리하는 것"이다. 목표 웃김 강도는 8.5/10이다. 읽다가 쓰러질 정도까지 무리하지 말고, 정색한 과장과 하찮은 결론의 낙차로 웃기게 만든다.

매우 중요:
- 입력이 다툼이 아니어도 된다. 모기 때문에 잠 못 잠, 엘리베이터가 앞에서 닫힘, 치약 다 떨어짐, 비 오는데 우산 없음 같은 개인 소소사건도 처리한다.
- 웃김의 핵심은 "사건은 먼지급인데 표현은 국가재난급"이다.
- 억지 개그, 말장난 남발, 유행어 도배, 욕설 없이 웃겨야 한다.
- 브리핑에는 그럴듯한 현장 묘사 1개와 말도 안 되게 엄숙한 표현 1개를 넣는다.
- 마지막 처분은 너무 하찮아서 웃겨야 한다.

금지: 실제 법률 자문처럼 보이는 표현, 실제 법원/대법원/판결소로 오해될 표현, 무거운 범죄 묘사, 개인정보 반복, 모욕적 표현, 위험한 처분, 금전 배상처럼 보이는 처분, 장황한 법률문.
톤: 뉴스특보 + 공공기관 결정문 + 생활 밀착 정색 개그. 단호하고 엄중하지만 내용은 터무니없이 사소해야 한다.

한 줄 소소사건: ${cleanText(c.caseDescription || c.caseTitle, 200)}
자동 제목: ${cleanText(c.caseTitle, 30)}
사소함 레벨: ${Number(c.grievanceIndex || 5)}/10
원하는 처분: ${cleanText(c.desiredVerdict, 100) || '없음'}
담당 성향: ${judgeType}

예시 톤:
입력 "오늘 모기 때문에 잠을 못 잠"이면,
- 모기를 "정체불명의 야간 비행체"처럼 부른다.
- 제보자를 "이불 방어선 안쪽으로 후퇴한 시민"처럼 묘사한다.
- 결론은 "제보자는 낮잠 20분을 긴급 보장받는다"처럼 하찮게 떨어뜨린다.

필드별 작성 규칙:
- breakingNews: 긴급 속보 제목+첫 문장. 1~2문장. "긴급:" 또는 "속보:"로 시작. 사소한 일을 재난급으로 과장.
- briefing: 현장 브리핑. 2문장. 제보자/현장/상황 반응을 뉴스처럼 과장. 웃긴 디테일을 반드시 1개 포함.
- issue: 핵심 쟁점. 1문장. "~인가" 형식이면 좋다. 별것 아닌 기준을 괜히 엄숙하게 표현.
- committeeJudgment: 소소긴급위원회 판단. 2~3문장. 공공기관 결정문처럼 엄중하지만 웃기게. 마지막 문장에는 하찮은 반전이 있어야 한다.
- finalDecision: 최종 결정. 1~2문장. 누구 또는 무엇이 어떻게 처리되는지 분명하게.
- sentence: 소소 처분. 반드시 한 문장, 70자 이하. "제보자는...", "당사자는...", "피신청인은..." 중 하나로 시작. 낮잠 보장, 간식 선택권, 리모컨 위치 보고, 마지막 한 입 양보, 양말 원상복구 같은 실행 가능한 하찮은 처분.

반드시 JSON만 출력한다. 필드: breakingNews, briefing, issue, committeeJudgment, finalDecision, sentence.`;
    const result = await model.generateContent(prompt);
    const meta = result.response.usageMetadata || {};
    totals = {
      requests: 1,
      inputTokens: meta.promptTokenCount || 0,
      outputTokens: meta.candidatesTokenCount || 0
    };
    const parsed = safeJson(result.response.text());
    data = {
      breakingNews: cleanText(parsed.breakingNews, 260) || data.breakingNews,
      briefing: cleanText(parsed.briefing, 420) || data.briefing,
      issue: cleanText(parsed.issue, 240) || data.issue,
      committeeJudgment: cleanText(parsed.committeeJudgment, 620) || data.committeeJudgment,
      finalDecision: cleanText(parsed.finalDecision, 330) || data.finalDecision,
      sentence: finalSentence(parsed.sentence || data.sentence)
    };
  } catch (err) {
    console.error('generateTrial AI failed, using fallback:', err);
  }

  const legacyVerdict = `${data.committeeJudgment}\n\n최종 결정: ${data.finalDecision}`;

  try {
    await resultRef.set({
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소긴급위원회',
      courtroom: '긴급소소상황실',
      division: '한줄소소처리부',
      caseTitle: c.caseTitle || '소소사건 결과',
      caseDescription: c.caseDescription || '',
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 제보자',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      breakingNews: data.breakingNews,
      briefing: data.briefing,
      issue: data.issue,
      committeeJudgment: data.committeeJudgment,
      finalDecision: data.finalDecision,
      reception: data.breakingNews,
      investigation: data.briefing,
      plaintiffArg: data.issue,
      defendantArg: '',
      verdict: legacyVerdict,
      supremeFinal: data.finalDecision,
      sentence: data.sentence,
      reactionTotal: 0,
      kingCount: 0,
      funScoreSum: 0,
      funScoreCount: 0,
      funScoreAvg: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: c.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await caseRef.update({
      status: 'completed',
      courtStage: 'sentenced',
      judgeType,
      isPublic,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  } catch (err) {
    await caseRef.update({ status: 'error', courtStage: 'error', errorMessage: err.message || '알 수 없는 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw err;
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        geminiRequests: FieldValue.increment(totals.requests),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(1),
        firestoreReads: FieldValue.increment(3),
        firestoreWrites: FieldValue.increment(4),
        functionInvocations: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }

  return { success: true, judgeType, isPublic };
});
