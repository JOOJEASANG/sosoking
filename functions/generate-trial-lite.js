const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function cleanText(value, maxLen = 600) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocument(value, maxLen = 3000) {
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
  if (start < 0 || end < start) throw Object.assign(new Error('JSON 형식을 찾을 수 없습니다.'), { code: 'JSON_NOT_FOUND' });
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (cause) {
    throw Object.assign(new Error('JSON 해석에 실패했습니다.'), { code: 'JSON_PARSE_FAILED', cause });
  }
}

function normalizeResult(parsed, description) {
  return {
    caseTitle: normalizeCaseTitle(parsed?.caseTitle, description),
    reception: cleanDocument(parsed?.reception, 1800),
    investigation: cleanDocument(parsed?.investigation, 2200),
    plaintiffArg: cleanDocument(parsed?.plaintiffArg, 2000),
    defendantArg: cleanDocument(parsed?.defendantArg, 2000),
    verdict: cleanDocument(parsed?.verdict, 3200)
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

function buildPrompt(description, retry = false) {
  return `당신은 '소소킹 판결소'의 생활사건 기록관이자 코미디 판결문 작가다.
사용자의 생활분쟁을 읽고 실제 사건보고서·내용증명·답변서·판결문처럼 작성하라.
문서 형식은 진지하고 실제 문서처럼 정돈하되, 내용은 사건의 구체적인 사물과 행동을 과하게 엄숙하게 다뤄 재미있게 만든다.
사용자가 말하지 않은 사실은 단정하지 말고, 실제 법률 자문이나 실제 법원 문서라고 주장하지 않는다.

[사건 내용]
${description}

[필수 결과]
- caseTitle: 내용을 바로 알아볼 수 있는 8~24자의 사건명, 반드시 '사건'으로 끝냄
- reception: 사건접수보고서 형식, 접수취지·사건개요·접수의견, 2~3문단
- investigation: 수사보고 형식, 정황·증거·진술 검토·조사관 의견, 2~4문단
- plaintiffArg: 원고측 내용증명 또는 준비서면 형식, 청구취지와 주장요지, 2~3문단
- defendantArg: 피고측 답변서 형식, 답변취지와 항변요지, 2~3문단
- verdict: 첫머리에 '주문', 생활형 처분과 판단이유, 4~6문단
각 문서마다 사건에 맞는 웃음 포인트를 넣고 공통 시스템 문구는 쓰지 않는다.
${retry ? '앞선 결과가 불완전했다. 더 짧고 명확하게 다시 작성하라.' : ''}`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    caseTitle: { type: 'string' },
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
    if (err?.name === 'AbortError') throw Object.assign(new Error('Gemini 응답 시간이 초과되었습니다.'), { code: 'GEMINI_TIMEOUT' });
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
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 4).map(([word]) => word);
}

function localPenalty(description) {
  const d = description;
  if (/(치킨|밥|음식|간식|커피|먹|배달|냉장고)/.test(d)) return '피고는 다음 간식 또는 식사 1회에 관하여 원고에게 우선 선택권을 부여하고, 남은 음식의 행방을 사진 1장으로 보고한다.';
  if (/(문자|카톡|메시지|읽씹|답장|전화)/.test(d)) return '피고는 24시간 동안 원고의 연락에 대하여 읽음 표시만 남기는 행위를 금하고, 확인 후 합리적인 시간 안에 문장으로 답변한다.';
  if (/(지각|약속|시간|늦)/.test(d)) return '피고는 향후 3회의 약속에서 예정 시각 10분 전에 도착하고, 도착 인증을 제출한다.';
  if (/(설거지|청소|빨래|집안일|쓰레기)/.test(d)) return '피고는 관련 집안일을 3회 연속 담당하고, 완료 선언 전에 현장 검수를 받아야 한다.';
  if (/(리모컨|휴대폰|핸드폰|충전기|물건|찾)/.test(d)) return '피고는 문제의 물건에 지정 보관장소를 부여하고, 3일 동안 위치 변경 시 원고에게 즉시 고지한다.';
  if (/(돈|빌려|입금|결제|계산|갚)/.test(d)) return '피고는 관련 금전 내역을 한 줄 장부로 정리하고, 미정산 금액이 있다면 당사자가 확인 가능한 방식으로 정산 계획을 제출한다.';
  return '피고는 원고에게 사건 경위에 관한 5문장 사실확인서를 제출하고, 재발 방지를 위한 생활수칙 1개를 실제로 이행한다.';
}

function buildLocalFallback(description, errorCode = 'UNKNOWN_GEMINI_ERROR') {
  const detail = cleanText(description, 560) || '구체적인 경위가 기재되지 않은 생활분쟁';
  const keywords = extractKeywords(detail);
  const subject = keywords.slice(0, 2).join('·') || cleanText(detail, 18) || '생활분쟁';
  const title = normalizeCaseTitle(`${subject} 분쟁 사건`, detail);
  const evidence = keywords.length ? keywords.map((word, index) => `증거 ${index + 1}호 '${word}' 관련 진술`).join(', ') : '원고의 구체적 진술 1건';
  const penalty = localPenalty(detail);

  return {
    caseTitle: title,
    reception: `접수취지\n원고는 아래와 같은 생활상 분쟁을 정식 사건으로 접수하였다.\n\n사건개요\n${detail}\n\n접수의견\n본 건은 규모만 보면 동네 한 바퀴 안에서 해결될 사안이나, 당사자의 표정과 억울함의 밀도를 고려하면 제404호 생활법정의 책상을 한 번 두드릴 필요가 있다고 판단된다.`,
    investigation: `수사보고\n조사 결과, 현재 확보된 자료는 ${evidence}이다. 해당 자료는 국과수까지 보낼 정도는 아니지만 당사자 사이에서는 이미 대법원 전원합의체급 무게로 취급되고 있다.\n\n원고의 진술은 '${detail}'로 요약된다. 별도의 물적 증거가 없더라도 구체적인 대상과 행동이 특정되어 있어 단순한 기분 탓으로 종결하기 어렵다. 다만 피고의 설명을 직접 듣지 못한 부분은 확정 사실이 아니라 항변 가능성이 남아 있는 정황으로 분류한다.\n\n조사관 의견은 사소한 일을 사소하게 처리하지 못해 사건이 커졌다는 것이다. 특히 '${subject}' 부분은 당사자 사이에서 이미 역사 교과서 첫 문장처럼 반복되고 있어 신속한 정리가 필요하다.`,
    plaintiffArg: `원고측 변론\n원고는 ${detail}\n라는 사정으로 인해 일상의 평온과 당연히 지켜질 것이라 믿었던 생활상 신뢰가 침해되었다고 주장한다.\n\n청구취지는 피고가 사건의 핵심 행동을 인정하고, 같은 상황을 다시 만들지 않도록 구체적인 조치를 이행하라는 것이다. 원고는 거창한 손해배상보다도 '내가 왜 억울했는지 정확히 알아듣는 것'을 우선적으로 구한다.`,
    defendantArg: `피고측 변론\n피고가 제출할 수 있는 가능한 항변은 고의가 아니었고, 상황이 우연히 그렇게 보였으며, 원고가 사건을 지나치게 확대 해석했다는 취지일 것이다. 다만 이러한 항변은 '${subject}'에 관한 구체적인 설명이 뒤따르지 않으면 '그럴 수도 있지'라는 문장 하나로 모든 책임을 밀어내는 결과가 된다.\n\n피고 측에는 원고의 기억이 일부 과장되었을 가능성을 주장할 여지가 있으나, 사소한 일일수록 즉시 설명하고 정리했어야 한다는 점에서 완전한 면책은 어렵다.`,
    verdict: `주문\n1. 피고는 원고에게 본 사건의 핵심 경위를 인정하는 취지의 사과를 한다.\n2. ${penalty}\n3. 나머지 과도한 감정 소모는 양 당사자가 각자 부담한다.\n\n판단이유\n이 사건은 ${detail}\n라는 생활상 분쟁에서 비롯되었다. 사건의 금액이나 규모가 작다는 이유만으로 억울함까지 자동으로 소액이 되는 것은 아니다.\n\n재판부는 '${subject}'에 관한 원고의 설명이 구체적이고, 피고가 납득할 만한 반대 설명을 제시하지 못한 상태에서는 원고의 문제 제기가 상당한 이유가 있다고 판단한다. 다만 피고의 직접 진술이 없는 만큼 형사 드라마식 단정은 피하고 생활형 처분으로 균형을 맞춘다.\n\n재판부는 양 당사자에게 다음과 같이 고한다. 사소한 일은 빨리 사과하면 사소한 일로 끝나지만, 설명을 미루면 사건번호까지 부여받는다. 이상과 같이 판결한다.`,
    fallbackReason: errorCode
  };
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
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
    const existing = await resultRef.get();
    if (existing.exists) return { success: true, skipped: 'completed' };
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
    await caseRef.update({ status: 'pending', courtStage: 'filed', processingStartedAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    c = { ...c, status: 'pending', courtStage: 'filed' };
  }

  if (c.status !== 'pending') throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

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
  if (latest.data()?.status !== 'processing') return { success: true, skipped: latest.data()?.status || 'unknown' };

  const description = cleanText(c.caseDescription, 600);
  const settings = await loadSettings();
  const configured = cleanText(settings.geminiModel, 60);
  const modelNames = [...new Set([configured, ...DEFAULT_MODELS].filter(Boolean))];
  const apiKey = cleanText(geminiKey.value(), 500);
  const totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  let data = null;
  let usedModel = '';
  let lastError = null;

  for (let attempt = 0; attempt < modelNames.length; attempt += 1) {
    const modelName = modelNames[attempt];
    try {
      const response = await callGemini(apiKey, modelName, buildPrompt(description, attempt > 0));
      totals.requests += 1;
      totals.inputTokens += Number(response.usageMetadata.promptTokenCount || 0);
      totals.outputTokens += Number(response.usageMetadata.candidatesTokenCount || 0);
      const candidate = normalizeResult(safeJson(response.text), description);
      if (!hasRequiredSections(candidate)) throw Object.assign(new Error('필수 문서가 누락되었습니다.'), { code: 'OUTPUT_INCOMPLETE' });
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
      if (['API_KEY_MISSING', 'API_KEY_INVALID', 'API_KEY_FORBIDDEN'].includes(safeErrorCode(err))) break;
    }
  }

  const fallbackCode = data ? '' : safeErrorCode(lastError);
  if (!data) data = buildLocalFallback(description, fallbackCode);
  const finalTitle = normalizeCaseTitle(data.caseTitle, description);
  const aiSource = usedModel ? 'gemini-rest' : 'local-case-fallback';

  try {
    const batch = db.batch();
    batch.set(resultRef, {
      source: 'user',
      userId: uid,
      isPublic: c.isPublic !== false,
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
      aiSource,
      aiModel: usedModel || '',
      aiFallbackReason: fallbackCode || '',
      promptVersion: 'simple-document-v1.3-resilient',
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
      isPublic: c.isPublic !== false,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.delete(),
      errorMessage: FieldValue.delete(),
      aiErrorCode: FieldValue.delete()
    });
    await batch.commit();
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
        geminiRequests: FieldValue.increment(totals.requests),
        geminiInputTokens: FieldValue.increment(totals.inputTokens),
        geminiOutputTokens: FieldValue.increment(totals.outputTokens),
        caseCount: FieldValue.increment(1),
        fallbackCount: FieldValue.increment(usedModel ? 0 : 1),
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
    isPublic: c.isPublic !== false,
    caseTitle: finalTitle,
    source: aiSource,
    model: usedModel || null
  };
});