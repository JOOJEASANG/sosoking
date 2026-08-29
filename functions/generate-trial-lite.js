const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { requireVerifiedUser, reserveAiRequest } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// 모델은 배포 환경변수 VERDICT_MODELS(쉼표 구분)로 바꿔 끼울 수 있다.
// 결과물 품질이 곧 제품이므로 상위 등급 모델을 먼저 시도하고, 실패 시 아래 순서로 물러난다.
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

// 민심소에서 'AI 판결 vs 사람들의 표'를 비교하려면 승패가 구조화되어 있어야 한다.
function normalizeWinner(value) {
  const raw = String(value || '').trim().toLowerCase();
  return ['plaintiff', 'defendant', 'both'].includes(raw) ? raw : 'both';
}

function normalizeResult(parsed, description) {
  return {
    caseTitle: normalizeCaseTitle(parsed?.caseTitle, description),
    winner: normalizeWinner(parsed?.winner),
    reception: cleanDocument(parsed?.reception, 800),
    investigation: cleanDocument(parsed?.investigation, 900),
    plaintiffArg: cleanDocument(parsed?.plaintiffArg, 700),
    defendantArg: cleanDocument(parsed?.defendantArg, 700),
    verdict: cleanDocument(parsed?.verdict, 1200)
  };
}

function hasRequiredSections(data) {
  return Boolean(
    data
    && data.caseTitle.length >= 4
    && data.reception.length >= 20
    && data.investigation.length >= 20
    && data.plaintiffArg.length >= 20
    && data.defendantArg.length >= 20
    && data.verdict.length >= 40
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
    reception: { type: 'string' },
    investigation: { type: 'string' },
    plaintiffArg: { type: 'string' },
    defendantArg: { type: 'string' },
    verdict: { type: 'string' }
  },
  required: ['caseTitle', 'reception', 'investigation', 'plaintiffArg', 'defendantArg', 'verdict']
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
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 4096,
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

function localPenalty(description, judge) {
  const d = description;
  let penalty = '피고는 원고에게 사건 경위에 관한 5문장 사실확인서를 제출하고, 재발 방지를 위한 생활수칙 1개를 실제로 이행한다.';
  if (/(치킨|밥|음식|간식|커피|먹|배달|냉장고)/.test(d)) penalty = '피고는 다음 간식 또는 식사 1회에 관하여 원고에게 우선 선택권을 부여하고, 남은 음식의 행방을 사진 1장으로 보고한다.';
  else if (/(문자|카톡|메시지|읽씹|답장|전화)/.test(d)) penalty = '피고는 24시간 동안 읽음 표시만 남기는 행위를 금하고, 확인 후 합리적인 시간 안에 완성된 문장으로 답변한다.';
  else if (/(지각|약속|시간|늦)/.test(d)) penalty = '피고는 향후 3회의 약속에서 예정 시각 10분 전에 도착하고, 도착 인증을 제출한다.';
  else if (/(설거지|청소|빨래|집안일|쓰레기)/.test(d)) penalty = '피고는 관련 집안일을 3회 연속 담당하고, 완료 선언 전에 현장 검수를 받아야 한다.';
  else if (/(리모컨|휴대폰|핸드폰|충전기|물건|찾)/.test(d)) penalty = '피고는 문제의 물건에 지정 보관장소를 부여하고, 3일 동안 위치 변경 시 원고에게 즉시 고지한다.';
  else if (/(돈|빌려|입금|결제|계산|갚)/.test(d)) penalty = '피고는 관련 금전 내역을 한 줄 장부로 정리하고, 미정산 금액이 있다면 당사자가 확인 가능한 방식으로 정산 계획을 제출한다.';

  if (judge.type === '꼰대형') return `${penalty} 이행 전 왜 이런 기본사항까지 판결문에 적혀야 했는지 한 문장으로 정리한다.`;
  if (judge.type === '냉혈형') return `${penalty} 감정적 해명보다 이행 여부와 결과만 확인한다.`;
  if (judge.type === '회피형') return `${penalty} 당사자끼리 즉시 해결하면 재판부는 더 이상 관여하지 않는다.`;
  if (judge.type === '추궁형') return `${penalty} 이행 시각과 결과를 모호한 표현 없이 기록한다.`;
  if (judge.type === '오버형') return `${penalty} 이를 생활질서 복구조치로 명명하고 즉시 시행한다.`;
  if (judge.type === '드립형') return `${penalty} 사건의 핵심 물건이 다시 법정에 출석하는 불상사를 막는다.`;
  if (judge.type === '빙의형') return `${penalty} 사건 주제의 실제 규칙이나 관습에 맞는 방식으로 이행한다.`;
  return penalty;
}

function judgeClosing(judge, subject) {
  const closings = {
    '꼰대형': `재판부는 '${subject}' 하나 제대로 정리하는 데 판결문까지 필요했다는 사실부터 오래 기억하기 바란다.`,
    '냉혈형': `재판부는 '${subject}'에 관한 설명은 길었으나 결론은 간단하다고 본다. 생긴 결과만큼 정확히 바로잡으면 된다.`,
    '회피형': `재판부는 '${subject}'까지 판결했으므로 다음 사건부터는 당사자들이 재판부보다 먼저 대화하기 바란다.`,
    '추궁형': `재판부는 '${subject}'보다 당사자의 설명 속 앞뒤가 더 오래 남았다는 점을 지적하며 심리를 마친다.`,
    '오버형': `이로써 '${subject}' 사태는 생활질서 복구 단계로 전환되었음을 제404호 생활법정이 엄숙히 선포한다.`,
    '드립형': `재판부는 '${subject}'가 또다시 사건번호를 발급받는 순간, 사소함은 이미 항소를 포기한 것으로 본다.`,
    '빙의형': `재판부는 '${subject}' 사건에서도 결국 그 세계의 기본 규칙을 지키는 사람이 마지막에 웃는다는 점을 확인한다.`
  };
  return closings[judge.type] || '재판부는 같은 사안이 다시 사건번호를 부여받지 않도록 당사자들이 신속히 이행하기 바란다.';
}

function buildLocalFallback(description, judge, grievanceIndex, errorCode = 'UNKNOWN_GEMINI_ERROR') {
  const detail = cleanText(description, 560) || '구체적인 경위가 기재되지 않은 생활분쟁';
  const keywords = extractKeywords(detail);
  const subject = keywords.slice(0, 2).join('·') || cleanText(detail, 18) || '생활분쟁';
  const title = normalizeCaseTitle(`${subject} 분쟁 사건`, detail);
  const evidence = keywords.length
    ? keywords.map((word, index) => `제${index + 1}호 정황자료: '${word}' 관련 진술`).join('\n')
    : '제1호 정황자료: 원고의 구체적 진술';
  const penalty = localPenalty(detail, judge);

  return {
    // AI 호출이 모두 실패한 대체 판결도 민심소에서 비교할 수 있어야 한다.
    winner: 'both',
    caseTitle: title,
    reception: `접수취지\n원고는 아래 생활상 분쟁으로 평온한 일상에 균열이 발생하였다며 정식 접수를 요청하였다.\n\n사건개요\n${detail}\n\n접수의견\n사건 규모는 소소하나 억울지수 ${grievanceIndex}/10이 부여될 정도로 당사자의 체감 무게가 확인된다. ${judge.type} 재판부는 이 사안을 그냥 넘길 경우 식탁·단체채팅방·거실 등에서 장기 미제사건으로 남을 가능성이 있다고 보아 접수한다.`,
    investigation: `확인 정황\n원고의 진술에서 사건의 대상과 문제 행동이 비교적 구체적으로 특정된다. 별도의 감식반을 부를 정도는 아니지만 당사자 사이에서는 이미 결정적 장면으로 반복 재생되고 있다.\n\n주요 증거\n${evidence}\n\n진술 검토\n원고의 설명은 '${detail}'로 요약된다. 피고의 직접 진술이 확보되지 않은 부분은 확정 사실이 아닌 항변 가능 정황으로 남겨두되, 설명을 미룬 행위 자체가 사건을 키웠을 가능성은 높다.\n\n조사관 의견\n${judge.style} 이에 따라 '${subject}'를 중심으로 말의 앞뒤와 생활상 후속조치를 함께 심리할 필요가 있다.`,
    plaintiffArg: `청구취지\n원고는 피고가 사건의 핵심 행동을 인정하고, 같은 상황이 반복되지 않도록 구체적인 생활상 조치를 이행할 것을 구한다.\n\n주장요지\n원고는 ${detail}\n라는 사정으로 인해 당연히 지켜질 것이라 믿었던 생활상 신뢰가 침해되었다고 주장한다.\n\n피해 및 요구사항\n원고가 구하는 핵심은 거창한 배상보다도 '왜 억울했는지를 정확히 이해받는 것'과 재발 방지다.`,
    defendantArg: `답변취지\n피고는 고의가 아니었고 상황이 우연히 그렇게 보였으며, 원고가 사건을 확대 해석했다는 취지로 항변할 가능성이 있다.\n\n항변요지\n다만 '${subject}'에 관한 구체적인 설명 없이 '그럴 수도 있지'라는 문장만 제출한다면 이는 답변서라기보다 책임 회피용 포스트잇에 가깝다.\n\n피고측 최종의견\n피고에게는 원고의 기억이 일부 과장되었음을 주장할 여지가 있으나, 사소한 일일수록 즉시 설명하고 정리했어야 한다는 점에서 완전한 면책은 어렵다.`,
    verdict: `주문\n1. 피고는 원고에게 본 사건의 핵심 경위를 인정하는 취지의 사건 맞춤형 사과를 한다.\n2. ${penalty}\n3. 나머지 과도한 감정 소모는 양 당사자가 각자 부담한다.\n\n판단이유\n이 사건은 ${detail}\n라는 생활상 분쟁에서 비롯되었다. 사건의 금액이나 규모가 작다는 이유만으로 억울함까지 자동으로 소액이 되는 것은 아니다.\n\n재판부는 '${subject}'에 관한 원고의 설명이 구체적이고, 피고가 납득할 만한 반대 설명을 제시하지 못한 상태에서는 문제 제기에 상당한 이유가 있다고 판단한다. 다만 피고의 직접 진술이 없는 만큼 형사드라마식 단정은 피하고 실행 가능한 생활형 처분으로 균형을 맞춘다.\n\n재판부 의견\n${judgeClosing(judge, subject)} 이상과 같이 판결한다.`,
    fallbackReason: errorCode
  };
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function safeErrorCode(err) {
  return cleanText(err?.code, 80) || 'UNKNOWN_GEMINI_ERROR';
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
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

  // 상태가 processing이라는 사실만으로는 이 호출이 잠금을 획득했다는 뜻이 아니다.
  // 동시 호출 중 트랜잭션에서 pending -> processing 변경을 수행한 단 하나만 AI를 호출한다.
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

  let data = null;
  let usedModel = '';
  let lastError = null;
  let quotaAvailable = true;
  let saved = false;

  // 사용자·전체 일일 한도는 모델 재시도 횟수가 아니라 재판 요청 1건당 한 번만 예약한다.
  try {
    await reserveAiRequest(uid, 'trial', settings);
  } catch (err) {
    quotaAvailable = false;
    lastError = err;
    console.warn('generateTrial AI quota reservation failed; using local fallback:', safeErrorCode(err));
  }

  for (let attempt = 0; quotaAvailable && attempt < modelNames.length; attempt += 1) {
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
      if (['API_KEY_MISSING', 'API_KEY_INVALID', 'API_KEY_FORBIDDEN', 'resource-exhausted'].includes(safeErrorCode(err))) break;
    }
  }

  let fallbackCode = data ? '' : safeErrorCode(lastError);
  if (!data) data = buildLocalFallback(description, judge, grievanceIndex, fallbackCode);

  // 모델 출력도 공개·저장 전에 다시 검사한다. 문제가 있으면 검증 가능한 로컬 판결로 대체한다.
  const generatedSafety = inspectContent([
    data.caseTitle,
    data.reception,
    data.investigation,
    data.plaintiffArg,
    data.defendantArg,
    data.verdict
  ].filter(Boolean).join('\n'));
  if (!generatedSafety.safe) {
    fallbackCode = `UNSAFE_AI_OUTPUT_${String(generatedSafety.code || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    data = buildLocalFallback(description, judge, grievanceIndex, fallbackCode);
    usedModel = '';
  }

  const finalTitle = normalizeCaseTitle(data.caseTitle, description);
  const aiSource = usedModel ? 'gemini-rest' : 'local-case-fallback';

  try {
    const batch = db.batch();
    batch.set(resultRef, {
      source: 'user',
      // 공개 결과 문서는 문서 단위로 읽히므로 인증 UID를 저장하지 않는다.
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
      reception: data.reception,
      investigation: data.investigation,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      verdict: data.verdict,
      sentence: '',
      aiSource,
      aiModel: usedModel || '',
      aiFallbackReason: fallbackCode || '',
      promptVersion: 'verdict-v2-permissive-comedy',
      contentSafetyStatus: 'passed',
      contentSafetyCheckedAt: FieldValue.serverTimestamp(),
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
    await caseRef.update({
      status: 'error',
      courtStage: 'error',
      errorMessage: '판결문 저장 중 오류가 발생했습니다. 같은 사건으로 다시 작성해 주세요.',
      aiErrorCode: 'FIRESTORE_SAVE_FAILED',
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete()
    }).catch(() => null);
    throw new HttpsError('unavailable', '판결문 저장 중 오류가 발생했습니다.');
  } finally {
    try {
      const today = kstDateKey();
      await db.doc(`usage_stats/daily_${today}`).set({
        date: today,
        // 실제 외부 API 호출 시도는 실패 응답도 포함한다.
        geminiRequests: FieldValue.increment(totals.attempts),
        geminiSuccessfulResponses: FieldValue.increment(totals.successfulResponses),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(saved ? 1 : 0),
        fallbackCount: FieldValue.increment(saved && !usedModel ? 1 : 0),
        firestoreReads: FieldValue.increment(4),
        firestoreWrites: FieldValue.increment(3),
        functionInvocations: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('usage log failed:', err);
    }
  }

  return {
    success: true,
    caseTitle: finalTitle,
    judgeType: judge.type,
    grievanceIndex,
    model: usedModel || 'local-case-fallback'
  };
});