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
function oneSentence(text) {
  let s = cleanText(text, 100).replace(/["“”'`]/g, '').trim();
  s = s.split(/\n/)[0].trim();
  if (!s) s = '피고는 오늘 하루 억울함 접수창을 먼저 열어준다.';
  if (!s.startsWith('피고는')) s = `피고는 ${s.replace(/^피고(인)?은?\s*/, '')}`;
  if (!s.endsWith('.')) s += '.';
  return s.length > 58 ? '피고는 오늘 하루 억울함 접수창을 먼저 열어준다.' : s;
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
    reception: `${title} 접수 완료. 사건은 작지만 원고 표정은 전혀 작지 않았다.`,
    investigation: '확인 결과, 사건의 크기는 미니 사이즈였으나 억울함은 대용량이었다. 증거는 평범했고, 분위기는 은근히 진지했다.',
    plaintiffArg: '원고는 “이건 그냥 넘어가면 내 하루가 진다”고 주장했다. 말투는 차분했지만 마음속 북소리는 이미 시작된 상태였다.',
    defendantArg: '피고는 “그럴 의도는 아니었다”고 해명했다. 하지만 의도가 없었다는 말이 모든 걸 해결했다면 세상에 사과문은 없었을 것이다.',
    verdict: `${judgeType} 판사는 원고의 억울함을 일부 인정한다. 다만 사건이 너무 거창해지는 것을 막기 위해 웃음 1스푼을 섞어 마무리한다. 이 판결은 실제 법적 효력이 없는 오락 콘텐츠다.`,
    sentence: '피고는 오늘 하루 억울함 접수창을 먼저 열어준다.'
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
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (c.status !== 'pending') throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const judgeType = pickJudge(c.selectedJudge);
  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (current.status !== 'pending') return;
    c = current;
    tx.update(caseRef, {
      status: 'processing',
      courtStage: 'hearing',
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
    const prompt = `소소킹 판결소의 공개 판결기록을 JSON으로 작성한다. 핵심은 사소한 사건을 사용자가 웃으며 읽게 만드는 것이다. 너무 짧으면 허전하고, 너무 길면 지친다. 각 항목은 2~3문장 정도로 적당히 작성한다.\n\n금지: 생활법정이라는 표현, 실제 법률 자문처럼 보이는 표현, 무거운 범죄 묘사, 개인정보 반복, 장황한 법률 문체.\n톤: 적당히 진지한 척하지만 재치 있고 웃김. 사용자가 읽다가 피식하게 만든다.\n\n사건명: ${cleanText(c.caseTitle, 30)}\n사건 경위: ${cleanText(c.caseDescription, 200)}\n억울지수: ${Number(c.grievanceIndex || 5)}/10\n원하는 처분: ${cleanText(c.desiredVerdict, 100) || '없음'}\n담당 판사: ${judgeType}\n\n필드별 작성 규칙:\n- reception: 접수 멘트. 2문장. 가볍고 웃기게.\n- investigation: 조사 결과. 2~3문장. 사소함과 억울함의 대비가 느껴지게.\n- plaintiffArg: 원고 주장. 2~3문장. 과몰입하지만 공감되게.\n- defendantArg: 피고 항변. 2~3문장. 그럴듯하지만 살짝 허술하게.\n- verdict: 최종 판단. 3~5문장. 가장 재미있는 부분. 마지막 문장에는 실제 효력이 없는 오락 콘텐츠라는 취지를 짧게 포함.\n- sentence: 반드시 '피고는 ...한다.' 한 문장, 58자 이하, 행동형 벌칙.\n\n반드시 JSON만 출력한다. 필드: reception, investigation, plaintiffArg, defendantArg, verdict, sentence.`;
    const result = await model.generateContent(prompt);
    const meta = result.response.usageMetadata || {};
    totals = {
      requests: 1,
      inputTokens: meta.promptTokenCount || 0,
      outputTokens: meta.candidatesTokenCount || 0
    };
    const parsed = safeJson(result.response.text());
    data = {
      reception: cleanText(parsed.reception, 360) || data.reception,
      investigation: cleanText(parsed.investigation, 430) || data.investigation,
      plaintiffArg: cleanText(parsed.plaintiffArg, 430) || data.plaintiffArg,
      defendantArg: cleanText(parsed.defendantArg, 430) || data.defendantArg,
      verdict: cleanText(parsed.verdict, 650) || data.verdict,
      sentence: oneSentence(parsed.sentence || data.sentence)
    };
  } catch (err) {
    console.error('generateTrial AI failed, using fallback:', err);
  }

  try {
    await resultRef.set({
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 판결소',
      courtroom: '제404호 판사실',
      division: '소소킹 판결부',
      caseTitle: c.caseTitle || '판결 결과',
      caseDescription: c.caseDescription || '',
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      reception: data.reception,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      verdict: data.verdict,
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
