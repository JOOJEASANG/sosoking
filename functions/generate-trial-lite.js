const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const SENTENCE_FALLBACKS = [
  '피고는 3일간 간식 선택권을 원고에게 우선 배정한다.',
  '피고는 다음 실수 때 변명보다 사과를 먼저 제출한다.',
  '피고는 하루 동안 생활법정의 눈치를 성실히 살핀다.',
  '피고는 다음 간식 구매 시 원고 몫을 1.5배로 확보한다.'
];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function normalizeCaseTitle(value, description = '') {
  let title = cleanText(value, 30).replace(/["“”'`]/g, '').replace(/[.!?]+$/g, '').trim();
  if (!title || title === 'AI 사건명 작성 중') {
    const base = cleanText(description, 80)
      .replace(/^(오늘|어제|방금|아까)\s*/g, '')
      .replace(/[.!?].*$/g, '')
      .replace(/(했어요|했습니다|했다|해요|합니다)$/g, '')
      .trim()
      .slice(0, 18);
    title = base || '정체불명 생활 억울';
  }
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return cleanText(title, 30);
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
  let s = cleanText(text, 110).replace(/["“”'`]/g, '').trim().split(/\n/)[0].trim();
  if (!s) s = SENTENCE_FALLBACKS[Math.floor(Math.random() * SENTENCE_FALLBACKS.length)];
  if (!s.startsWith('피고는')) s = `피고는 ${s.replace(/^피고(인)?은?\s*/, '')}`;
  if (!s.endsWith('.')) s += '.';
  return s.length > 68 ? SENTENCE_FALLBACKS[Math.floor(Math.random() * SENTENCE_FALLBACKS.length)] : s;
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function fallback(c, judgeType) {
  const caseTitle = normalizeCaseTitle('', c.caseDescription);
  return {
    caseTitle,
    reception: `${caseTitle}은 별일 아닌 듯 보였으나 원고의 표정이 이미 대법정급이어서 제404호 생활법정에 긴급 접수되었다. 서기는 사건기록 첫 장에 ‘일단 웃음 참기’라고 적었다.`,
    investigation: '조사관은 현장에 남은 빈자리, 미묘한 눈빛, 뒤늦게 나온 변명 한 스푼을 증거로 채택했다. 특히 아무도 요구하지 않은 해명은 유죄 방향으로 매우 성실하게 작용했다.',
    plaintiffArg: '원고는 문제의 크기보다 서운함의 밀도가 높다고 주장했다. 원고 측은 “사소한 일이면 사과도 사소하게 빨리 하면 됐습니다”라는 결정적 문장을 제출했다.',
    defendantArg: '피고는 그런 뜻이 아니었다며 생활형 선처를 구했다. 그러나 재판부는 뜻이 아니었다는 말이 사건 발생 후에만 등장한 점을 엄숙하게 의심했다.',
    verdict: `${judgeType} 판사는 본 사건이 국가적 위기는 아니지만 원고의 저녁 기분에는 분명한 재난이었다고 판단한다. 재판부는 피고의 반성문보다 다음 행동을 더 믿기로 하며, 본 판결은 실제 법적 효력이 없는 오락 콘텐츠임을 다시 한 번 쓸데없이 엄숙하게 고지한다.`,
    sentence: SENTENCE_FALLBACKS[Math.floor(Math.random() * SENTENCE_FALLBACKS.length)]
  };
}
async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}
async function resetStaleCase(caseRef, c, resultRef) {
  if (c.status === 'completed') {
    const existing = await resultRef.get();
    if (existing.exists) return { skip: true, reason: 'completed' };
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return { skip: false, data: { ...c, status: 'pending', courtStage: 'filed' } };
  }
  if (c.status === 'processing') {
    const started = c.processingStartedAt?.toMillis ? c.processingStartedAt.toMillis() : 0;
    if (started && Date.now() - started < 10 * 60 * 1000) return { skip: true, reason: 'processing' };
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return { skip: false, data: { ...c, status: 'pending', courtStage: 'filed' } };
  }
  return { skip: false, data: c };
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
  const reset = await resetStaleCase(caseRef, c, resultRef);
  if (reset.skip) return { success: true, skipped: reset.reason };
  c = reset.data;
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
      errorMessage: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
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
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 1.08, topP: 0.95, maxOutputTokens: 2200 }
    });
    const prompt = `당신은 소소킹 판결소의 코미디 작가 겸 생활법정 재판부다. 사용자 사건을 실제 법률 판단이 아닌 안전한 오락 콘텐츠로 작성한다.

사건 경위: ${cleanText(c.caseDescription, 200)}
억울지수: ${Number(c.grievanceIndex || 5)}/10
원하는 처분: ${cleanText(c.desiredVerdict, 100) || '없음'}
담당 판사: ${judgeType}

유머 규칙:
1. 별것 아닌 일을 국가적 위기처럼 엄숙하게 다루되 욕설·비하·혐오 표현은 쓰지 않는다.
2. 사건 경위에서 핵심을 뽑아 10~24자의 간결한 caseTitle을 만든다. 반드시 ‘사건’으로 끝낸다.
3. reception에는 쓸데없이 장엄한 접수 사유와 서기의 짧은 속마음 농담을 넣는다.
4. investigation에는 하찮은 증거 2~3개를 과학수사처럼 과대평가한다.
5. plaintiffArg와 defendantArg에는 양측이 말이 되는 듯 안 되는 듯 진지하게 다투는 문장을 넣는다.
6. verdict에는 판사의 근엄한 헛소리 또는 생활형 명언을 최소 1개 넣는다.
7. sentence는 반드시 ‘피고는 ...한다.’ 한 문장이고, 실제로 실행 가능하지만 웃긴 처분으로 만든다.
8. 각 필드는 서로 다른 농담을 사용하며 같은 표현을 반복하지 않는다.
9. 실명·연락처·주민번호처럼 보이는 정보는 반복하지 않는다.
10. 실제 법률 자문이나 법적 효력이 없다는 점을 verdict에 자연스럽게 포함한다.

반드시 JSON만 출력한다. 필드: caseTitle, reception, investigation, plaintiffArg, defendantArg, verdict, sentence.`;
    const result = await model.generateContent(prompt);
    const meta = result.response.usageMetadata || {};
    totals = {
      requests: 1,
      inputTokens: meta.promptTokenCount || 0,
      outputTokens: meta.candidatesTokenCount || 0
    };
    const parsed = safeJson(result.response.text());
    data = {
      caseTitle: normalizeCaseTitle(parsed.caseTitle, c.caseDescription),
      reception: cleanText(parsed.reception, 760) || data.reception,
      investigation: cleanText(parsed.investigation, 760) || data.investigation,
      plaintiffArg: cleanText(parsed.plaintiffArg, 760) || data.plaintiffArg,
      defendantArg: cleanText(parsed.defendantArg, 760) || data.defendantArg,
      verdict: cleanText(parsed.verdict, 1400) || data.verdict,
      sentence: oneSentence(parsed.sentence || data.sentence)
    };
  } catch (err) {
    console.error('generateTrial AI failed, using fallback:', err);
  }

  const finalTitle = normalizeCaseTitle(data.caseTitle, c.caseDescription);
  try {
    const batch = db.batch();
    batch.set(resultRef, {
      source: 'user',
      userId: uid,
      isPublic,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 판결소',
      courtroom: '제404호 생활법정',
      division: '제3생활부',
      caseTitle: finalTitle,
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
    batch.update(caseRef, {
      caseTitle: finalTitle,
      status: 'completed',
      courtStage: 'sentenced',
      judgeType,
      isPublic,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete(),
      errorMessage: FieldValue.delete()
    });
    await batch.commit();
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
        firestoreReads: FieldValue.increment(4),
        firestoreWrites: FieldValue.increment(3),
        functionInvocations: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }

  return { success: true, judgeType, isPublic, caseTitle: finalTitle };
});
