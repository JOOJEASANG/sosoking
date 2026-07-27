const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const DEFAULT_MODEL = 'gemini-2.5-flash';

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocument(value, maxLen) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

function normalizeCaseTitle(value, description = '') {
  let title = cleanText(value, 32)
    .replace(/["“”'`]/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  if (!title || title === 'AI 사건명 작성 중') {
    title = cleanText(description, 22)
      .replace(/^(오늘|어제|방금|아까)\s*/g, '')
      .replace(/[.!?].*$/g, '')
      .replace(/(했어요|했습니다|했다|해요|합니다)$/g, '')
      .trim();
  }

  if (!title) title = '정체불명 생활분쟁';
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return cleanText(title, 32);
}

function safeJson(text) {
  const raw = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON 형식을 찾을 수 없습니다.');
  return JSON.parse(raw.slice(start, end + 1));
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function normalizeResult(parsed, description) {
  return {
    caseTitle: normalizeCaseTitle(parsed?.caseTitle, description),
    reception: cleanDocument(parsed?.reception, 1600),
    investigation: cleanDocument(parsed?.investigation, 2000),
    plaintiffArg: cleanDocument(parsed?.plaintiffArg, 1800),
    defendantArg: cleanDocument(parsed?.defendantArg, 1800),
    verdict: cleanDocument(parsed?.verdict, 3000)
  };
}

function hasRequiredSections(data) {
  return Boolean(
    data
    && data.caseTitle.length >= 4
    && data.reception.length >= 25
    && data.investigation.length >= 30
    && data.plaintiffArg.length >= 25
    && data.defendantArg.length >= 25
    && data.verdict.length >= 50
  );
}

function qualityScore(data) {
  if (!data) return 0;
  return Math.min(data.reception.length, 300)
    + Math.min(data.investigation.length, 420)
    + Math.min(data.plaintiffArg.length, 320)
    + Math.min(data.defendantArg.length, 320)
    + Math.min(data.verdict.length, 650)
    + (/주문|판결/.test(data.verdict) ? 150 : 0);
}

function isGoodResult(data) {
  return Boolean(
    hasRequiredSections(data)
    && data.reception.length >= 55
    && data.investigation.length >= 75
    && data.plaintiffArg.length >= 50
    && data.defendantArg.length >= 50
    && data.verdict.length >= 110
    && /주문|판결/.test(data.verdict)
  );
}

function buildPrompt(caseDescription, retry = false) {
  return `당신은 '소소킹 판결소'의 생활사건 기록관이자 코미디 판결문 작가다.
사용자가 적은 생활분쟁을 읽고, 실제 사건보고서·내용증명·답변서·판결문처럼 정돈된 문서로 작성한다.
문서 형식은 실제처럼 진지하게 유지하되, 내용에는 사건의 구체적인 사물과 행동에서 나온 웃음이 충분히 들어가야 한다.

[사건 내용]
${caseDescription}

[작성 원칙]
- 사용자가 말하지 않은 사실을 새로 만들어 단정하지 않는다.
- 실제 법률 자문이나 실제 법원 문서라고 주장하지 않는다.
- 실제 법령 조문이나 실제 기관명은 넣지 않는다.
- 면책·시스템 안내 문구를 본문에 쓰지 않는다.
- 사소한 일을 지나치게 엄숙하게 다루고, 하찮은 정황을 결정적 증거처럼 분석한다.
- 원고와 피고의 주장은 서로 다른 웃음 포인트를 사용한다.
- 모든 항목에 사건 내용의 핵심 대상과 행동을 구체적으로 반영한다.

[출력]
반드시 JSON 객체 하나만 출력한다. 키는 아래 여섯 개만 사용한다.

caseTitle: 핵심 대상과 행동이 드러나는 8~24자의 사건명. 반드시 '사건'으로 끝낸다.
reception: '사건접수보고서' 형식. 접수취지, 사건개요, 접수의견을 2~3문단으로 작성한다.
investigation: '수사보고' 형식. 확인 정황, 주요 증거, 진술의 모순, 조사관 의견을 2~4문단으로 작성한다.
plaintiffArg: '원고측 내용증명 또는 준비서면' 형식. 청구취지와 주장요지를 2~3문단으로 작성한다.
defendantArg: '피고측 답변서' 형식. 답변취지와 항변요지를 2~3문단으로 작성한다.
verdict: '재판부 판결문' 형식. 첫머리에 반드시 '주문'을 쓰고, 실행 가능한 웃긴 생활형 처분과 판단 이유를 4~6문단으로 작성한다.

${retry ? '[재작성]\n앞선 응답이 짧거나 일부 항목이 빠졌다. JSON 형식을 정확히 지키고 각 항목을 더 구체적으로 다시 작성한다.' : ''}`;
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}

function modelFor(genAI, modelName) {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      maxOutputTokens: 4096
    }
  });
}

exports.generateTrial = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB'
}, async request => {
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

  if (c.status === 'completed') {
    const resultSnap = await resultRef.get();
    if (resultSnap.exists) return { success: true, skipped: 'completed' };
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      errorMessage: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    c = { ...c, status: 'pending', courtStage: 'filed' };
  }

  if (c.status === 'error') {
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      errorMessage: FieldValue.delete(),
      processingStartedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    c = { ...c, status: 'pending', courtStage: 'filed' };
  }

  if (c.status === 'processing') {
    const started = c.processingStartedAt?.toMillis ? c.processingStartedAt.toMillis() : 0;
    if (started && Date.now() - started < 10 * 60 * 1000) {
      return { success: true, skipped: 'processing' };
    }
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      errorMessage: FieldValue.delete(),
      processingStartedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    c = { ...c, status: 'pending', courtStage: 'filed' };
  }

  if (c.status !== 'pending') {
    throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');
  }

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
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  const latest = await caseRef.get();
  if (latest.data()?.status !== 'processing') {
    return { success: true, skipped: latest.data()?.status || 'unknown' };
  }

  const isPublic = c.isPublic !== false;
  const settings = await loadSettings();
  const configuredModel = cleanText(settings.geminiModel, 60) || DEFAULT_MODEL;
  const modelNames = [...new Set([configuredModel, DEFAULT_MODEL])];
  const genAI = new GoogleGenerativeAI(geminiKey.value().trim());

  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let data = null;
  let bestCandidate = null;
  let bestScore = 0;
  let lastError = null;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const modelName = modelNames[Math.min(attempt, modelNames.length - 1)];
      try {
        const model = modelFor(genAI, modelName);
        const result = await model.generateContent(
          buildPrompt(cleanText(c.caseDescription, 600), attempt > 0)
        );
        const meta = result.response.usageMetadata || {};
        totals.requests += 1;
        totals.inputTokens += Number(meta.promptTokenCount || 0);
        totals.outputTokens += Number(meta.candidatesTokenCount || 0);

        const parsed = safeJson(result.response.text());
        const candidate = normalizeResult(parsed, c.caseDescription);
        const score = qualityScore(candidate);

        if (hasRequiredSections(candidate) && score > bestScore) {
          bestCandidate = candidate;
          bestScore = score;
        }

        if (isGoodResult(candidate)) {
          data = candidate;
          break;
        }

        lastError = new Error('AI 판결문이 권장 분량보다 짧습니다.');
      } catch (err) {
        lastError = err;
        console.error(`generateTrial attempt ${attempt + 1} failed (${modelName}):`, err);
      }
    }

    if (!data && bestCandidate) data = bestCandidate;
    if (!data) throw lastError || new Error('AI 판결문 생성 실패');

    const finalTitle = normalizeCaseTitle(data.caseTitle, c.caseDescription);
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
      nickname: c.nickname || '익명 원고',
      judgeType: '소소킹 AI 재판부',
      reception: data.reception,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      verdict: data.verdict,
      sentence: '',
      aiSource: 'gemini',
      promptVersion: 'simple-document-v1.1',
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
      judgeType: '소소킹 AI 재판부',
      isPublic,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete(),
      errorMessage: FieldValue.delete()
    });

    await batch.commit();

    return {
      success: true,
      isPublic,
      caseTitle: finalTitle
    };
  } catch (err) {
    console.error('generateTrial failed:', err);

    await caseRef.update({
      status: 'error',
      courtStage: 'error',
      errorMessage: 'AI 응답을 받지 못했습니다. 같은 사건으로 다시 작성할 수 있습니다.',
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete()
    }).catch(() => null);

    throw new HttpsError(
      'unavailable',
      'AI 응답을 받지 못했습니다. 잠시 후 같은 사건으로 다시 작성해 주세요.'
    );
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        geminiRequests: FieldValue.increment(totals.requests),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(data ? 1 : 0),
        firestoreReads: FieldValue.increment(4),
        firestoreWrites: FieldValue.increment(data ? 3 : 1),
        functionInvocations: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('usage log failed:', e);
    }
  }
});