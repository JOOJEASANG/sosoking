const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { requireVerifiedUser, reserveAiRequest } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const JUDGES = [
  {
    type: '엄벌주의형',
    icon: '👨‍⚖️',
    style: '사소한 생활규칙 위반도 공동체 질서를 뒤흔든 중대 사안처럼 엄숙하게 다룬다. 주문은 단호하고 재발 방지 의무를 분명히 한다.',
    voice: '짧고 단호한 문장, 엄중한 경고, 과도하게 장엄한 표현'
  },
  {
    type: '감성형',
    icon: '🥹',
    style: '당사자가 느낀 서운함과 억울함을 세심하게 살피며, 마음의 상처를 실제 손해처럼 진지하게 평가한다.',
    voice: '공감 어린 문장, 생활 속 감정 묘사, 따뜻하지만 웃긴 화해 권고'
  },
  {
    type: '현실주의형',
    icon: '🤦',
    style: '거창한 말보다 당장 실행할 수 있는 생활형 해결책을 중시한다. 누가 무엇을 언제 할지 명확히 정한다.',
    voice: '현실적인 잔소리, 구체적인 이행 방법, 생활밀착형 처분'
  },
  {
    type: '과몰입형',
    icon: '🔥',
    style: '평범한 생활분쟁을 대서사시와 국가적 위기 수준으로 확대 해석하며 극적인 판결문을 작성한다.',
    voice: '웅장한 비유, 비장한 서술, 사소한 증거를 운명의 단서처럼 표현'
  },
  {
    type: '피곤형',
    icon: '😴',
    style: '당사자들이 왜 이 일을 여기까지 끌고 왔는지 한숨 쉬면서도 핵심은 정확히 짚는다.',
    voice: '건조한 한마디, 지친 재판부의 촌철살인, 불필요한 말 줄이기 명령'
  },
  {
    type: '논리집착형',
    icon: '🧮',
    style: '시간, 순서, 말의 모순과 사소한 단서를 표처럼 정리하듯 분석한다. 증거 사이의 빈틈을 집요하게 지적한다.',
    voice: '논리적 번호 매김, 정황 비교, 사소한 모순을 결정적 쟁점처럼 분석'
  },
  {
    type: '드립형',
    icon: '🎭',
    style: '실제 문서의 격식은 유지하되 사건의 핵심 사물과 행동을 활용한 비유와 말장난을 적극적으로 사용한다.',
    voice: '사건 맞춤형 드립, 재치 있는 문장, 반복되지 않는 웃음 포인트'
  }
];

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

function normalizeResult(parsed, description) {
  return {
    caseTitle: normalizeCaseTitle(parsed?.caseTitle, description),
    reception: cleanDocument(parsed?.reception, 1900),
    investigation: cleanDocument(parsed?.investigation, 2400),
    plaintiffArg: cleanDocument(parsed?.plaintiffArg, 2100),
    defendantArg: cleanDocument(parsed?.defendantArg, 2100),
    verdict: cleanDocument(parsed?.verdict, 3400)
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

function buildPrompt(description, judge, grievanceIndex, retry = false) {
  return `당신은 '소소킹 판결소'의 생활사건 기록관이자 코미디 판결문 작가다.
사용자의 생활분쟁을 읽고 실제 사건접수보고서·수사보고·내용증명·답변서·판결문처럼 작성하라.
문서 형식은 실제처럼 정돈하고 진지하게 유지하되, 내용에는 사건의 구체적인 사물과 행동에서 나온 웃음코드를 충분히 넣는다.
사용자가 말하지 않은 사실은 확정하지 말고, 실제 법률 자문이나 실제 법원 문서라고 주장하지 않는다.

[담당 판사 캐릭터]
- 유형: ${judge.type} ${judge.icon}
- 성향: ${judge.style}
- 문체: ${judge.voice}
- 참고 억울지수: ${grievanceIndex}/10
판사 성향은 특히 수사보고의 관찰 방식과 재판부 판결의 판단이유·생활형 처분에 자연스럽게 반영한다.

[사건 내용]
${description}

[출력 규칙]
반드시 JSON 객체 하나만 출력한다. 다음 여섯 키 외에는 사용하지 않는다.
각 문서 안에서는 아래 소제목을 정확히 쓰고, 소제목 다음 줄부터 내용을 작성하며 소제목 사이에는 빈 줄을 둔다.

caseTitle: 내용을 바로 알아볼 수 있는 8~24자의 사건명. 반드시 '사건'으로 끝낸다.

reception:
접수취지
[내용]

사건개요
[내용]

접수의견
[내용]

investigation:
확인 정황
[내용]

주요 증거
[내용]

진술 검토
[내용]

조사관 의견
[내용]

plaintiffArg:
청구취지
[내용]

주장요지
[내용]

피해 및 요구사항
[내용]

defendantArg:
답변취지
[내용]

항변요지
[내용]

피고측 최종의견
[내용]

verdict:
주문
1. [생활형 처분]
2. [재발 방지 조치]

판단이유
[내용]

재판부 의견
[${judge.type} 성향이 드러나는 마무리]

공통적인 시스템 문구나 똑같은 사과 문장을 반복하지 말고, 사건의 핵심 사물·행동을 각 문서에 구체적으로 반영한다.
${retry ? '앞선 결과가 불완전했다. 소제목과 빈 줄을 정확히 지키고 더 간결하게 다시 작성하라.' : ''}`;
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

  if (judge.type === '엄벌주의형') return `${penalty} 이를 어길 경우 다음 생활분쟁에서 변명권을 1회 제한한다.`;
  if (judge.type === '감성형') return `${penalty} 이행 전 원고가 서운했던 지점을 한 문장으로 정확히 되짚는다.`;
  if (judge.type === '피곤형') return `${penalty} 재판부가 같은 설명을 다시 듣지 않도록 한 번에 끝낸다.`;
  if (judge.type === '논리집착형') return `${penalty} 이행 시각과 결과를 확인 가능한 방식으로 기록한다.`;
  if (judge.type === '드립형') return `${penalty} 사건의 핵심 물건이 다시 법정에 출석하는 불상사를 막는다.`;
  return penalty;
}

function judgeClosing(judge, subject) {
  const closings = {
    '엄벌주의형': `재판부는 '${subject}'가 다시 생활질서를 교란할 경우 한층 엄중한 처분이 뒤따를 수 있음을 경고한다.`,
    '감성형': `재판부는 '${subject}'보다 더 오래 남는 것은 상대가 내 마음을 몰라줬다는 서운함임을 양 당사자가 기억하기 바란다.`,
    '현실주의형': `재판부는 말로 백 번 정리하는 것보다 오늘 한 번 제대로 이행하는 편이 빠르다고 판단한다.`,
    '과몰입형': `이로써 '${subject}'를 둘러싼 장대한 생활서사는 제404호 법정의 망치 소리와 함께 일단 막을 내린다.`,
    '피곤형': `재판부는 이 사건이 다시 접수되지 않기를 진심으로 바라며, 다음부터는 법정 오기 전에 대화부터 하라고 덧붙인다.`,
    '논리집착형': `재판부는 감정은 자유이나 시간순서와 말의 앞뒤는 자유롭지 않다는 점을 분명히 한다.`,
    '드립형': `재판부는 '${subject}'가 또다시 사건번호를 발급받는 순간, 사소함은 이미 항소를 포기한 것으로 본다.`
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
  const totals = { requests: 0, inputTokens: 0, outputTokens: 0 };

  let data = null;
  let usedModel = '';
  let lastError = null;

  for (let attempt = 0; attempt < modelNames.length; attempt += 1) {
    const modelName = modelNames[attempt];
    try {
      await reserveAiRequest(uid, 'trial', settings);
      const response = await callGemini(apiKey, modelName, buildPrompt(description, judge, grievanceIndex, attempt > 0));
      totals.requests += 1;
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

  const fallbackCode = data ? '' : safeErrorCode(lastError);
  if (!data) data = buildLocalFallback(description, judge, grievanceIndex, fallbackCode);
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
      promptVersion: 'simple-document-v1.4-judge-layout',
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
    caseTitle: finalTitle,
    judgeType: judge.type,
    grievanceIndex,
    model: usedModel || 'local-case-fallback'
  };
});
