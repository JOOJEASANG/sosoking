const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

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
  if (start < 0 || end < start) {
    const err = new Error('JSON 형식을 찾을 수 없습니다.');
    err.code = 'JSON_NOT_FOUND';
    throw err;
  }

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (cause) {
    const err = new Error('JSON 해석에 실패했습니다.');
    err.code = 'JSON_PARSE_FAILED';
    err.cause = cause;
    throw err;
  }
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

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map(part => typeof part?.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function classifyGeminiError(status, payload) {
  const apiStatus = cleanText(payload?.error?.status, 80);
  const apiMessage = cleanText(payload?.error?.message, 500);
  const combined = `${apiStatus} ${apiMessage}`.toUpperCase();

  let code = `GEMINI_HTTP_${status}`;
  if (combined.includes('API_KEY_INVALID') || combined.includes('API KEY NOT VALID')) {
    code = 'API_KEY_INVALID';
  } else if (status === 401 || status === 403 || combined.includes('PERMISSION_DENIED')) {
    code = 'API_KEY_FORBIDDEN';
  } else if (status === 429 || combined.includes('RESOURCE_EXHAUSTED') || combined.includes('QUOTA')) {
    code = 'QUOTA_EXCEEDED';
  } else if (status === 404 || combined.includes('NOT_FOUND')) {
    code = 'MODEL_NOT_FOUND';
  } else if (status >= 500) {
    code = 'MODEL_UNAVAILABLE';
  }

  const err = new Error(apiMessage || `Gemini API 요청 실패 (${status})`);
  err.code = code;
  err.httpStatus = status;
  err.apiStatus = apiStatus;
  return err;
}

async function callGeminiRest(apiKey, modelName, prompt) {
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY가 비어 있습니다.');
    err.code = 'API_KEY_MISSING';
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110000);

  try {
    const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(modelName)}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 4096
        }
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyGeminiError(response.status, payload);

    const text = extractGeminiText(payload);
    if (!text) {
      const finishReason = cleanText(payload?.candidates?.[0]?.finishReason, 80);
      const blockReason = cleanText(payload?.promptFeedback?.blockReason, 80);
      const err = new Error(`Gemini 응답 본문이 없습니다.${finishReason ? ` finish=${finishReason}` : ''}${blockReason ? ` block=${blockReason}` : ''}`);
      err.code = blockReason ? 'CONTENT_BLOCKED' : 'EMPTY_RESPONSE';
      throw err;
    }

    return {
      text,
      usageMetadata: payload.usageMetadata || {}
    };
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error('Gemini 응답 시간이 초과되었습니다.');
      timeoutErr.code = 'GEMINI_TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function safeErrorCode(err) {
  const raw = cleanText(err?.code, 80);
  return raw || 'UNKNOWN_GEMINI_ERROR';
}

function userErrorMessage(code) {
  if (code === 'API_KEY_MISSING' || code === 'API_KEY_INVALID' || code === 'API_KEY_FORBIDDEN') {
    return 'Gemini API 키 인증에 실패했습니다. 관리자 API 키 설정을 확인해 주세요.';
  }
  if (code === 'QUOTA_EXCEEDED') {
    return 'Gemini 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (code === 'MODEL_NOT_FOUND') {
    return '설정된 AI 모델을 사용할 수 없습니다. 관리자 모델 설정을 확인해 주세요.';
  }
  if (code === 'CONTENT_BLOCKED') {
    return '입력 내용이 AI 안전 기준에 의해 처리되지 않았습니다. 표현을 조금 순화해 다시 접수해 주세요.';
  }
  if (code === 'GEMINI_TIMEOUT' || code === 'MODEL_UNAVAILABLE') {
    return 'AI 서버 연결이 지연되고 있습니다. 잠시 후 같은 사건으로 다시 작성해 주세요.';
  }
  if (code === 'JSON_NOT_FOUND' || code === 'JSON_PARSE_FAILED') {
    return 'AI가 판결문 형식을 완성하지 못했습니다. 같은 사건으로 다시 작성해 주세요.';
  }
  return 'AI 응답을 받지 못했습니다. 같은 사건으로 다시 작성해 주세요.';
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
      aiErrorCode: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    c = { ...c, status: 'pending', courtStage: 'filed' };
  }

  if (c.status === 'error') {
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      errorMessage: FieldValue.delete(),
      aiErrorCode: FieldValue.delete(),
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
      aiErrorCode: FieldValue.delete(),
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
      aiErrorCode: FieldValue.delete(),
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
  const modelNames = [...new Set([configuredModel, DEFAULT_MODEL, FALLBACK_MODEL])];
  const apiKey = cleanText(geminiKey.value(), 500);

  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let data = null;
  let bestCandidate = null;
  let bestScore = 0;
  let lastError = null;
  let usedModel = '';

  try {
    for (let attempt = 0; attempt < modelNames.length; attempt += 1) {
      const modelName = modelNames[attempt];

      try {
        const result = await callGeminiRest(
          apiKey,
          modelName,
          buildPrompt(cleanText(c.caseDescription, 600), attempt > 0)
        );

        totals.requests += 1;
        totals.inputTokens += Number(result.usageMetadata.promptTokenCount || 0);
        totals.outputTokens += Number(result.usageMetadata.candidatesTokenCount || 0);

        const parsed = safeJson(result.text);
        const candidate = normalizeResult(parsed, c.caseDescription);
        const score = qualityScore(candidate);

        if (hasRequiredSections(candidate) && score > bestScore) {
          bestCandidate = candidate;
          bestScore = score;
          usedModel = modelName;
        }

        if (isGoodResult(candidate)) {
          data = candidate;
          usedModel = modelName;
          break;
        }

        const shortErr = new Error('AI 판결문이 권장 분량보다 짧습니다.');
        shortErr.code = 'OUTPUT_TOO_SHORT';
        lastError = shortErr;
      } catch (err) {
        lastError = err;
        console.error('generateTrial REST attempt failed:', {
          attempt: attempt + 1,
          modelName,
          code: safeErrorCode(err),
          status: err?.httpStatus || null,
          apiStatus: err?.apiStatus || null,
          message: cleanText(err?.message, 500)
        });

        if (safeErrorCode(err) === 'QUOTA_EXCEEDED' && attempt < modelNames.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if (['API_KEY_MISSING', 'API_KEY_INVALID', 'API_KEY_FORBIDDEN'].includes(safeErrorCode(err))) {
          break;
        }
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
      aiSource: 'gemini-rest',
      aiModel: usedModel || configuredModel,
      promptVersion: 'simple-document-v1.2',
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
      errorMessage: FieldValue.delete(),
      aiErrorCode: FieldValue.delete()
    });

    await batch.commit();

    return {
      success: true,
      isPublic,
      caseTitle: finalTitle,
      model: usedModel || configuredModel
    };
  } catch (err) {
    const errorCode = safeErrorCode(err);
    const message = userErrorMessage(errorCode);

    console.error('generateTrial REST failed:', {
      code: errorCode,
      status: err?.httpStatus || null,
      apiStatus: err?.apiStatus || null,
      message: cleanText(err?.message, 500)
    });

    await caseRef.update({
      status: 'error',
      courtStage: 'error',
      errorMessage: message,
      aiErrorCode: errorCode,
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete()
    }).catch(() => null);

    throw new HttpsError('unavailable', message);
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
