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
  let s = cleanText(text, 120).replace(/["“”'`]/g, '').trim().split(/\n/)[0].trim();
  if (!s) s = '피고 모기는 오늘 밤 피고석에 앉아 반성 비행을 금한다.';
  if (!s.endsWith('.')) s += '.';
  return s.length > 76 ? '피고는 오늘 하루 간식 선택권을 원고에게 양도한다.' : s;
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
  return {
    breakingNews: `개정: ${title}이 소소킹 재판소에 긴급 배당되었다. 방청석은 아직 조용하지만 재판부 표정은 이미 대형 사건이다.`,
    briefing: '재판부는 사건 기록을 살펴본 뒤 “이 정도면 그냥 넘길 수도 있지만 그러면 우리가 할 일이 없다”고 밝혔다. 증거로는 제보자의 정색, 주변의 무관심, 그리고 괜히 억울한 표정 1점이 제출되었다.',
    issue: '이 사소한 일이 과연 그냥 넘길 일인지, 아니면 판결문까지 받아야 직성이 풀리는 일인지가 쟁점이다.',
    committeeJudgment: `${judgeType} 재판부는 본 사건이 작다는 점을 인정한다. 그러나 작다고 무시하기엔 제보자의 표정이 지나치게 진지했고, 방청석도 결국 고개를 끄덕였으므로 유죄에 가까운 소소책임이 인정된다. 다만 사회질서가 실제로 무너진 것은 아니므로 형량은 하찮게 정한다.`,
    finalDecision: '소소킹 재판소는 제보자의 억울함을 일부 인용하고, 본 사건을 웃김점수 평가 대상 판결로 확정한다.',
    sentence: '피고는 오늘 하루 간식 선택권을 원고에게 양도한다.'
  };
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
    tx.update(caseRef, { status: 'processing', courtStage: 'briefing', judgeType, processingStartedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
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
    const prompt = `소소킹 재판소의 AI 판결문을 JSON으로 작성한다. 핵심 컨셉은 "한 줄짜리 하찮은 사건을 진짜 재판처럼 과하게 심리해서, 엄숙한 판결문으로 웃기게 끝내는 것"이다. 뉴스는 오프닝 양념일 뿐이고, 본편은 반드시 재판/판결 톤이어야 한다. 목표 웃김 강도는 9/10이다.

매우 중요:
- 사용자가 넣은 내용이 분쟁이 아니어도 재판으로 만든다. 예: 모기 때문에 잠 못 잠, 엘리베이터가 앞에서 닫힘, 치약이 다 떨어짐.
- 웃김의 핵심은 "하찮은 사건 + 과하게 엄숙한 재판 + 말도 안 되게 가벼운 형량"이다.
- 결과는 읽는 사람이 피식하거나 웃을 수 있게 구체적인 장면과 재판 표현을 섞는다.
- 기존보다 판결/재판 맛을 더 강하게 살린다. 단, 실제 법률 조언처럼 보이면 안 된다.

금지:
실제 대법원/실제 법원 명칭, 현실 법률 조언, 장황한 법조문, 무거운 범죄, 개인정보, 욕설, 위험한 처분, 금전 배상처럼 보이는 처분.

톤:
가짜 재판부가 너무 진지한 척하는 정색 개그. 문장은 단호하고 고급스럽지만, 결론은 너무 사소해야 한다.

입력 사건: ${cleanText(c.caseDescription || c.caseTitle, 200)}
제목: ${cleanText(c.caseTitle, 30)}
사소함 레벨: ${Number(c.grievanceIndex || 5)}/10
원하는 처분: ${cleanText(c.desiredVerdict, 100) || '없음'}
담당 성향: ${judgeType}

예시 방향:
입력 "오늘 모기 때문에 잠을 못 잠"이라면,
- 모기를 "피고 모기" 또는 "야간 비행 피고"로 세운다.
- 제보자를 "이불 방어선 안에서 밤새 진술한 원고"처럼 묘사한다.
- 증거로 "새벽 3시의 정적, 귓가의 윙 소리, 베개를 뒤집은 횟수" 같은 하찮은 증거를 든다.
- 주문은 "피고 모기는 오늘 밤 원고 귓가 30cm 접근을 금한다"처럼 웃기게 끝낸다.

필드별 규칙:
- breakingNews: 1~2문장. "개정:" 또는 "긴급 개정:"으로 시작. 사건이 소소킹 재판소에 올라왔다는 도입.
- briefing: 2문장. 증거조사/방청석/서기/재판장 같은 재판 장면을 반드시 넣는다.
- issue: 1문장. "~인지 여부" 또는 "~인가" 형식의 재판 쟁점.
- committeeJudgment: 2~3문장. 판결이유. 매우 엄숙하게 판단하되 중간에 하찮은 증거를 1개 넣는다.
- finalDecision: 1~2문장. 주문. 원고 일부승/피고 책임/사건 확정 같은 판결 느낌을 살린다.
- sentence: 1문장, 76자 이하. "피고는...", "원고는...", "당사자는..." 중 하나로 시작. 형량은 하찮고 실행 가능해야 한다.

반드시 JSON만 출력한다. 필드: breakingNews, briefing, issue, committeeJudgment, finalDecision, sentence.`;
    const result = await model.generateContent(prompt);
    const meta = result.response.usageMetadata || {};
    totals = { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 };
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

  const legacyVerdict = `${data.committeeJudgment}\n\n주문: ${data.finalDecision}`;
  try {
    await resultRef.set({
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 재판소',
      courtroom: '소소대법정',
      division: '한줄소송부',
      caseTitle: c.caseTitle || '소소사건 결과',
      caseDescription: c.caseDescription || '',
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
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
    await caseRef.update({ status: 'completed', courtStage: 'sentenced', judgeType, isPublic, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  } catch (err) {
    await caseRef.update({ status: 'error', courtStage: 'error', errorMessage: err.message || '알 수 없는 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw err;
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({ date: today, geminiRequests: FieldValue.increment(totals.requests), geminiInputTokens: FieldValue.increment(totals.inputTokens), geminiOutputTokens: FieldValue.increment(totals.outputTokens), caseCount: FieldValue.increment(1), firestoreReads: FieldValue.increment(3), firestoreWrites: FieldValue.increment(4), functionInvocations: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) { console.error('usage log failed:', e); }
  }
  return { success: true, judgeType, isPublic };
});