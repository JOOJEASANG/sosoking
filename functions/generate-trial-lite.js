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
  if (!s) s = '당사자는 다음 간식 선택권을 공평하게 나눈다.';
  if (!s.endsWith('.')) s += '.';
  return s.length > 70 ? '당사자는 다음 간식 선택권을 공평하게 나눈다.' : s;
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function fallback(c, judgeType) {
  const title = cleanText(c.caseTitle, 30) || '사소한 분쟁';
  const breakingNews = `긴급속보: ${title}을 둘러싼 미세한 긴장감이 소소킹 전역에 포착됐다.`;
  const briefing = '현장 브리핑 결과, 사건의 크기는 먼지급이었으나 당사자의 표정은 국가 비상회의 수준이었다.';
  const issue = '핵심 쟁점은 이 정도 사소함을 그냥 넘겨도 되는지, 아니면 한 번쯤 엄중한 표정을 지어야 하는지다.';
  const committeeJudgment = `${judgeType} 위원은 본 사안이 하찮아 보이지만 방치할 경우 식탁 평화와 단체 채팅방 질서에 은근한 파장을 줄 수 있다고 판단한다.`;
  const finalDecision = '소소분쟁위원회는 당사자 모두에게 피식 웃음 1회를 권고하고, 해당 분쟁을 소소 주의 사건으로 종결한다.';
  const sentence = '당사자는 다음 간식 선택권을 공평하게 나눈다.';
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
    const prompt = `소소킹의 결과 콘텐츠를 JSON으로 작성한다. 컨셉은 "먼지처럼 사소한 한 줄 다툼을 긴급 속보처럼 터뜨리고, 소소분쟁위원회가 국가기관급 엄중한 말투로 즉시 결정하는 것"이다. 입력이 짧고 별것 아닐수록 더 웃기게 만든다.

금지: 실제 법률 자문처럼 보이는 표현, 실제 법원/대법원/판결소로 오해될 표현, 무거운 범죄 묘사, 개인정보 반복, 모욕적 표현, 위험한 처분, 금전 배상처럼 보이는 처분, 장황한 법률문.
톤: 뉴스특보 + 공공기관 결정문을 섞는다. 단호하고 엄중하지만 내용은 터무니없이 사소해야 한다.

한 줄 분쟁: ${cleanText(c.caseDescription || c.caseTitle, 200)}
분쟁 제목: ${cleanText(c.caseTitle, 30)}
억울 레벨: ${Number(c.grievanceIndex || 5)}/10
원하는 처분: ${cleanText(c.desiredVerdict, 100) || '없음'}
담당 성향: ${judgeType}

필드별 작성 규칙:
- breakingNews: 긴급 속보 제목+첫 문장. 1~2문장. "긴급:" 또는 "속보:"로 시작. 사소한 일을 재난급으로 과장.
- briefing: 현장 브리핑. 2문장. 제보자/현장/당사자 반응을 뉴스처럼 과장.
- issue: 핵심 쟁점. 1문장. "~인가" 형식이면 좋다. 별것 아닌 기준을 괜히 엄숙하게 표현.
- committeeJudgment: 소소분쟁위원회 판단. 2~3문장. 공공기관 결정문처럼 엄중하지만 웃기게.
- finalDecision: 최종 결정. 1~2문장. 누가 무엇을 해야 하는지 분명하게.
- sentence: 소소 처분. 반드시 한 문장, 70자 이하. "피신청인은..." 또는 "당사자는..."로 시작. 양보, 원상복구, 의견조사, 리모컨 위치 보고, 마지막 한 입 양보 같은 실행 가능한 하찮은 처분.

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
      briefing: cleanText(parsed.briefing, 360) || data.briefing,
      issue: cleanText(parsed.issue, 220) || data.issue,
      committeeJudgment: cleanText(parsed.committeeJudgment, 520) || data.committeeJudgment,
      finalDecision: cleanText(parsed.finalDecision, 300) || data.finalDecision,
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
      courtName: '소소분쟁위원회',
      courtroom: '긴급소소속보실',
      division: '한줄분쟁심의부',
      caseTitle: c.caseTitle || '소소분쟁 결과',
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
