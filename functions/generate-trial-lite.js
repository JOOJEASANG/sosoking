const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { requireVerifiedUser, reserveAiRequest } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODELS = String(process.env.VERDICT_MODELS || 'gemini-2.5-pro,gemini-2.5-flash')
  .split(',').map(name => name.trim()).filter(Boolean);

const { JUDGES, buildPrompt } = require('./verdict-prompt');

function cleanText(value, maxLen = 600) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocument(value, maxLen = 3200) {
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
    title = cleanText(description, 24)
      .replace(/^(오늘|어제|방금|아까|제가|나는|저는)\s*/g, '')
      .replace(/[.!?].*$/g, '')
      .replace(/(했어요|했습니다|했다|해요|합니다|인데요|인데)$/g, '')
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
    throw Object.assign(new Error('JSON 형식을 찾을 수 없습니다.'), { code: 'JSON_NOT_FOUND' });
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (cause) {
    throw Object.assign(new Error('JSON 해석에 실패했습니다.'), { code: 'JSON_PARSE_FAILED', cause });
  }
}

const TAG_STOPWORDS = new Set(['사건', '판결', '판결문', '소소킹', '재판', '법원', '분쟁', '생활', '기타']);

function extractKeywords(description) {
  const stop = new Set(['그리고', '그런데', '그래서', '제가', '저는', '나는', '진짜', '너무', '그냥', '계속', '오늘', '어제', '상대방', '때문에', '했는데', '합니다', '있습니다']);
  const words = cleanText(description, 600).match(/[가-힣A-Za-z0-9]{2,}/g) || [];
  const counts = new Map();
  for (const word of words) {
    const key = word.replace(/(했다|했어요|했습니다|합니다|인데|에게|에서|으로|하고|하며|때문)$/g, '');
    if (key.length < 2 || stop.has(key)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 4)
    .map(([word]) => word);
}

function normalizeTags(value, fallbackSource = '') {
  const rawList = Array.isArray(value) ? value : String(value || '').split(/[,\n]/);
  const seen = new Set();
  const tags = [];

  for (const item of rawList) {
    const tag = String(item || '')
      .replace(/[#\s]+/g, '')
      .replace(/[^가-힣a-zA-Z0-9]/g, '')
      .slice(0, 10);
    if (tag.length < 2 || TAG_STOPWORDS.has(tag)) continue;
    const key = tag.toLocaleLowerCase('ko-KR');
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 5) break;
  }

  if (!tags.length && fallbackSource) {
    for (const word of extractKeywords(fallbackSource)) {
      const tag = word.slice(0, 10);
      if (tag.length >= 2 && !TAG_STOPWORDS.has(tag)) tags.push(tag);
      if (tags.length >= 4) break;
    }
  }
  return tags;
}

function normalizeWinner(value) {
  const raw = String(value || '').trim().toLowerCase();
  return ['plaintiff', 'defendant', 'both'].includes(raw) ? raw : 'both';
}

function normalizeResult(parsed, description) {
  return {
    caseTitle: normalizeCaseTitle(parsed?.caseTitle, description),
    winner: normalizeWinner(parsed?.winner),
    tags: normalizeTags(parsed?.tags, description),
    reception: cleanDocument(parsed?.reception, 1500),
    investigation: cleanDocument(parsed?.investigation, 2200),
    plaintiffArg: cleanDocument(parsed?.plaintiffArg, 1500),
    defendantArg: cleanDocument(parsed?.defendantArg, 1500),
    verdict: cleanDocument(parsed?.verdict, 2300)
  };
}

function hasRequiredSections(data) {
  return Boolean(
    data
    && data.caseTitle.length >= 4
    && data.reception.length >= 60
    && data.investigation.length >= 120
    && data.plaintiffArg.length >= 60
    && data.defendantArg.length >= 60
    && data.verdict.length >= 80
  );
}

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectJudge(caseId, existingType = '') {
  const existing = JUDGES.find(judge => judge.type === existingType);
  if (existing) return existing;
  return JUDGES[hashString(caseId) % JUDGES.length];
}

function selectGrievanceIndex(existingValue) {
  const existing = Number(existingValue);
  if (Number.isInteger(existing) && existing >= 1 && existing <= 10) return existing;
  return Math.floor(Math.random() * 10) + 1;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    caseTitle: { type: 'string' },
    winner: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    reception: { type: 'string' },
    investigation: { type: 'string' },
    plaintiffArg: { type: 'string' },
    defendantArg: { type: 'string' },
    verdict: { type: 'string' }
  },
  required: ['caseTitle', 'winner', 'reception', 'investigation', 'plaintiffArg', 'defendantArg', 'verdict']
};

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(part => typeof part?.text === 'string' ? part.text : '').filter(Boolean).join('\n').trim();
}

function classifyGeminiError(status, payload) {
  const apiStatus = cleanText(payload?.error?.status, 80);
  const apiMessage = cleanText(payload?.error?.message, 500);
  const combined = `${apiStatus} ${apiMessage}`.toUpperCase();
  let code = `GEMINI_HTTP_${status}`;
  if (combined.includes('API_KEY_INVALID') || combined.includes('API KEY NOT VALID')) code = 'API_KEY_INVALID';
  else if (status === 401 || status === 403 || combined.includes('PERMISSION_DENIED')) code = 'API_KEY_FORBIDDEN';
  else if (status === 429 || combined.includes('RESOURCE_EXHAUSTED') || combined.includes('QUOTA')) code = 'QUOTA_EXCEEDED';
  else if (status === 404 || combined.includes('NOT_FOUND')) code = 'MODEL_NOT_FOUND';
  else if (status >= 500) code = 'MODEL_UNAVAILABLE';
  return Object.assign(new Error(apiMessage || `Gemini API 요청 실패 (${status})`), { code, httpStatus: status, apiStatus });
}

async function callGemini(apiKey, modelName, prompt) {
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY가 비어 있습니다.'), { code: 'API_KEY_MISSING' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(modelName)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          topP: 0.9,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyGeminiError(response.status, payload);

    const text = extractGeminiText(payload);
    if (!text) {
      const blocked = cleanText(payload?.promptFeedback?.blockReason, 80);
      throw Object.assign(new Error('Gemini 응답 본문이 없습니다.'), { code: blocked ? 'CONTENT_BLOCKED' : 'EMPTY_RESPONSE' });
    }
    return { text, usageMetadata: payload.usageMetadata || {} };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw Object.assign(new Error('Gemini 응답 시간이 초과되었습니다.'), { code: 'GEMINI_TIMEOUT' });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// 입력에 없으면 결과에도 실제 증거·수사 사실처럼 등장하면 안 되는 표현들.
// 사용자가 직접 이런 자료를 언급한 사건은 그대로 허용한다.
const GROUNDING_GUARDS = [
  { code: 'UNSUPPORTED_CCTV', output: /CCTV|폐쇄회로|녹화\s*영상/i, input: /CCTV|폐쇄회로|녹화\s*영상/i },
  { code: 'UNSUPPORTED_FORENSICS', output: /국과수|국립과학수사|정밀\s*감정|감정\s*의뢰/i, input: /국과수|국립과학수사|정밀\s*감정|감정\s*의뢰/i },
  { code: 'UNSUPPORTED_SURVEILLANCE', output: /잠복\s*(?:수사|조사)|미행|현장\s*봉인/i, input: /잠복\s*(?:수사|조사)|미행|현장\s*봉인/i },
  { code: 'UNSUPPORTED_WITNESS', output: /목격자\s*진술|정황\s*목격자|목격자가/i, input: /목격자|봤다는\s*사람|봤다고\s*한/i },
  { code: 'UNSUPPORTED_OFFICIAL_INVESTIGATION', output: /수사팀|조사관이\s*(?:확인|발견)|경찰이\s*(?:확인|조사)|법원이\s*(?:확인|조사)/i, input: /수사팀|조사관|경찰|법원/i }
];

function ungroundedOutputCode(data, description) {
  const output = [
    data.reception,
    data.investigation,
    data.plaintiffArg,
    data.defendantArg,
    data.verdict
  ].filter(Boolean).join('\n');

  for (const guard of GROUNDING_GUARDS) {
    if (guard.output.test(output) && !guard.input.test(description)) return guard.code;
  }
  return '';
}

function safeErrorCode(err) {
  return cleanText(err?.code, 80) || 'UNKNOWN_GEMINI_ERROR';
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}

async function restoreRetryableCase(caseRef, code = '', message = '') {
  await caseRef.update({
    status: 'error',
    courtStage: 'error',
    errorMessage: message || 'AI 판결 생성에 실패했습니다. 잠시 후 같은 사건으로 다시 시도해 주세요.',
    aiErrorCode: code || 'AI_GENERATION_FAILED',
    processingStartedAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  }).catch(() => null);
}

async function logUsage(totals, saved) {
  try {
    const today = kstDateKey();
    await db.doc(`usage_stats/daily_${today}`).set({
      date: today,
      geminiRequests: FieldValue.increment(totals.attempts),
      geminiSuccessfulResponses: FieldValue.increment(totals.successfulResponses),
      geminiInputTokens: FieldValue.increment(totals.inputTokens),
      geminiOutputTokens: FieldValue.increment(totals.outputTokens),
      caseCount: FieldValue.increment(saved ? 1 : 0),
      // 조작된 로컬 판결을 더 이상 정상 결과로 저장하지 않는다.
      fallbackCount: FieldValue.increment(0),
      firestoreReads: FieldValue.increment(4),
      firestoreWrites: FieldValue.increment(saved ? 3 : 1),
      functionInvocations: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error('usage log failed:', err);
  }
}

exports.generateTrial = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB'
}, async request => {
  requireVerifiedUser(request);

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
    const existing = await resultRef.get();
    if (existing.exists) return { success: true, skipped: 'completed' };
  }

  // 과거 필터 적용 전에 저장된 사건도 외부 AI로 보내기 직전에 다시 검사한다.
  const safety = inspectContent(c.caseDescription);
  if (!safety.safe) {
    await caseRef.update({
      status: 'blocked',
      courtStage: 'blocked',
      errorMessage: safety.message,
      aiErrorCode: `CONTENT_${String(safety.code || 'UNSAFE').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
      processingStartedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    throw new HttpsError('failed-precondition', safety.message);
  }

  if (['completed', 'error'].includes(c.status)) {
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
    if (started && Date.now() - started < 6 * 60 * 1000) return { success: true, skipped: 'processing' };
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      processingStartedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    c = { ...c, status: 'pending', courtStage: 'filed' };
  }

  if (c.status !== 'pending') throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const acquiredProcessingLock = await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (current.status !== 'pending') return false;
    c = current;
    tx.update(caseRef, {
      status: 'processing',
      courtStage: 'hearing',
      processingStartedAt: FieldValue.serverTimestamp(),
      errorMessage: FieldValue.delete(),
      aiErrorCode: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return true;
  });

  if (!acquiredProcessingLock) {
    const latest = await caseRef.get();
    return { success: true, skipped: latest.data()?.status || 'unknown' };
  }

  const description = cleanText(c.caseDescription, 600);
  const judge = selectJudge(caseId, c.judgeType);
  const grievanceIndex = selectGrievanceIndex(c.grievanceIndex);
  const settings = await loadSettings();
  const configured = cleanText(settings.geminiModel, 60);
  const modelNames = [...new Set([configured, ...DEFAULT_MODELS].filter(Boolean))];
  const apiKey = cleanText(geminiKey.value(), 500);
  const totals = { attempts: 0, successfulResponses: 0, inputTokens: 0, outputTokens: 0 };
  let saved = false;

  try {
    // 사용자·전체 일일 한도는 모델 재시도 횟수가 아니라 재판 요청 1건당 한 번만 예약한다.
    await reserveAiRequest(uid, 'trial', settings);
  } catch (err) {
    await caseRef.update({
      status: 'pending',
      courtStage: 'filed',
      errorMessage: FieldValue.delete(),
      aiErrorCode: FieldValue.delete(),
      processingStartedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    }).catch(() => null);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('resource-exhausted', cleanText(err?.message, 300) || 'AI 사용 한도를 확인할 수 없습니다.');
  }

  let data = null;
  let usedModel = '';
  let lastError = null;

  for (let attempt = 0; attempt < modelNames.length; attempt += 1) {
    const modelName = modelNames[attempt];
    try {
      totals.attempts += 1;
      const response = await callGemini(apiKey, modelName, buildPrompt(description, judge, grievanceIndex, attempt > 0));
      totals.successfulResponses += 1;
      totals.inputTokens += Number(response.usageMetadata.promptTokenCount || 0);
      totals.outputTokens += Number(response.usageMetadata.candidatesTokenCount || 0);

      const candidate = normalizeResult(safeJson(response.text), description);
      if (!hasRequiredSections(candidate)) {
        throw Object.assign(new Error('필수 문서가 누락되었습니다.'), { code: 'OUTPUT_INCOMPLETE' });
      }

      const generatedSafety = inspectContent([
        candidate.caseTitle,
        candidate.reception,
        candidate.investigation,
        candidate.plaintiffArg,
        candidate.defendantArg,
        candidate.verdict
      ].filter(Boolean).join('\n'));
      if (!generatedSafety.safe) {
        throw Object.assign(new Error(generatedSafety.message || 'AI 출력 안전검사 실패'), {
          code: `UNSAFE_AI_OUTPUT_${String(generatedSafety.code || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
        });
      }

      const groundingCode = ungroundedOutputCode(candidate, description);
      if (groundingCode) {
        throw Object.assign(new Error('입력에 없는 조사·증거 내용이 생성되었습니다.'), { code: groundingCode });
      }

      data = candidate;
      usedModel = modelName;
      break;
    } catch (err) {
      lastError = err;
      console.error('generateTrial AI attempt failed:', {
        attempt: attempt + 1,
        modelName,
        code: safeErrorCode(err),
        status: err?.httpStatus || null,
        message: cleanText(err?.message, 500)
      });
      if (['API_KEY_MISSING', 'API_KEY_INVALID', 'API_KEY_FORBIDDEN', 'QUOTA_EXCEEDED'].includes(safeErrorCode(err))) break;
    }
  }

  if (!data) {
    const code = safeErrorCode(lastError);
    const message = code.startsWith('UNSUPPORTED_')
      ? 'AI가 입력에 없는 사실을 만들어 판결문을 폐기했습니다. 다시 시도해 주세요.'
      : 'AI 판결 생성에 실패했습니다. 잠시 후 같은 사건으로 다시 시도해 주세요.';
    await restoreRetryableCase(caseRef, code, message);
    await logUsage(totals, false);
    throw new HttpsError('unavailable', message);
  }

  const finalTitle = normalizeCaseTitle(data.caseTitle, description);

  try {
    const batch = db.batch();
    batch.set(resultRef, {
      source: 'user',
      userId: FieldValue.delete(),
      isPublic: c.isPublic === true,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 판결소',
      courtroom: '제404호 생활법정',
      division: '제3생활부',
      caseTitle: finalTitle,
      caseDescription: c.caseDescription || '',
      nickname: c.nickname || '익명 원고',
      judgeType: judge.type,
      judgeIcon: judge.icon,
      judgeStyle: judge.style,
      grievanceIndex,
      winner: data.winner,
      tags: Array.isArray(data.tags) ? data.tags : [],
      reception: data.reception,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      verdict: data.verdict,
      sentence: '',
      aiSource: 'gemini-rest',
      aiModel: usedModel,
      aiFallbackReason: '',
      // 기존 검증 도구와 공개 데이터 계약을 유지한다.
      promptVersion: 'verdict-v2-permissive-comedy',
      contentSafetyStatus: 'passed',
      contentSafetyCheckedAt: FieldValue.serverTimestamp(),
      groundingStatus: 'input-grounded',
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
      judgeType: judge.type,
      judgeIcon: judge.icon,
      judgeStyle: judge.style,
      grievanceIndex,
      isPublic: c.isPublic === true,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete(),
      errorMessage: FieldValue.delete(),
      aiErrorCode: FieldValue.delete()
    });

    await batch.commit();
    saved = true;
  } catch (err) {
    console.error('generateTrial save failed:', err);
    await restoreRetryableCase(caseRef, 'FIRESTORE_SAVE_FAILED', '판결문 저장 중 오류가 발생했습니다. 같은 사건으로 다시 작성해 주세요.');
    throw new HttpsError('unavailable', '판결문 저장 중 오류가 발생했습니다.');
  } finally {
    await logUsage(totals, saved);
  }

  return {
    success: true,
    caseTitle: finalTitle,
    judgeType: judge.type,
    grievanceIndex,
    model: usedModel
  };
});
