const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');
const { inspectContent } = require('./content-safety');
const { requireVerifiedUser } = require('./security');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const DAILY_PUBLIC_BLOCK_PATTERN = /(대통령|국회의원|정당|선거운동|인종\s*차별|혐오\s*표현|음란|성적\s*행위)/i;
const JUDGES = [
  {
    type: '꼰대형',
    icon: '🧓',
    style: '세상 모든 생활분쟁을 기본, 예의, 순서, 사람 사는 도리의 문제로 귀결시킨다. 본인의 생활상식을 보편 원칙처럼 확신하며 훈계하는 태도 자체에서 웃음을 만든다.'
  },
  {
    type: '냉혈형',
    icon: '🧊',
    style: '서운함과 분위기보다 실제로 무엇이 없어졌고 늦었고 남았는지를 본다. 사실, 시간, 수량, 결과만 너무 차갑게 계산해서 웃기게 만든다.'
  },
  {
    type: '회피형',
    icon: '🏃',
    style: '처음부터 왜 재판부가 이 문제까지 결정해야 하는지 난감해하며 개입을 피하려 한다. 그러나 접수된 이상 결국 판결해야 해서 이상할 정도로 최소한의 생활형 처분을 내린다.'
  },
  {
    type: '추궁형',
    icon: '🔎',
    style: '피고의 단어 하나, 시간표현 하나, 말과 행동의 작은 모순 하나를 잡으면 끝까지 놓지 않는다. 변명이 길어질수록 스스로 불리해지게 만든다.'
  },
  {
    type: '오버형',
    icon: '🚨',
    style: '양말, 치킨 한 조각, 답장 하나 같은 생활분쟁을 국가비상사태와 대형 작전처럼 지나치게 장엄하게 다룬다. 사소함과 문서 스케일의 격차로 웃음을 만든다.'
  },
  {
    type: '드립형',
    icon: '🎭',
    style: '사건의 핵심 사물, 행동, 실제 표현에서만 사건 맞춤형 드립을 뽑는다. 범용 유행어나 억지 말장난보다 그 사건에서만 가능한 한 방과 마지막 콜백을 중시한다.'
  },
  {
    type: '빙의형',
    icon: '🌀',
    style: '게임이면 게임, 회사면 회사, 음식이면 음식, 스포츠면 스포츠처럼 접수 내용이 속한 세계의 실제 규칙과 용어를 먼저 파악하고 그 세계에 완전히 몰입해 판단한다.'
  }
];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    caseTitle: { type: 'string' },
    caseDescription: { type: 'string' },
    reception: { type: 'string' },
    investigation: { type: 'string' },
    plaintiffArg: { type: 'string' },
    defendantArg: { type: 'string' },
    verdict: { type: 'string' },
    sentence: { type: 'string' }
  },
  required: [
    'caseTitle',
    'caseDescription',
    'reception',
    'investigation',
    'plaintiffArg',
    'defendantArg',
    'verdict',
    'sentence'
  ]
};

function cleanText(value, maxLen = 600) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocument(value, maxLen = 2400) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, Math.floor(number)))
    : fallback;
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function docketNumber(dateKey) {
  return `소소${dateKey.replace(/-/g, '').slice(2)}-오늘의판결-0001`;
}

function judgeForDate(dateKey) {
  return JUDGES[hashString(`${dateKey}:judge`) % JUDGES.length];
}

function grievanceForDate(dateKey) {
  return (hashString(`${dateKey}:grievance`) % 10) + 1;
}

function normalizeTitle(value) {
  let title = cleanText(value, 30)
    .replace(/["“”'`]/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();
  if (!title) title = '오늘의 정체불명 생활분쟁';
  if (!title.endsWith('사건')) title += ' 사건';
  return cleanText(title, 30);
}

function oneSentence(value, fallback) {
  let sentence = cleanText(value, 90) || fallback;
  if (!sentence.startsWith('피고는')) sentence = `피고는 ${sentence.replace(/^피고(인)?은?\s*/, '')}`;
  if (!sentence.endsWith('.')) sentence += '.';
  return sentence.slice(0, 90);
}

function extractJson(text) {
  const raw = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI JSON 형식을 찾을 수 없습니다.');
  return JSON.parse(raw.slice(start, end + 1));
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

async function callGemini(apiKey, modelName, prompt) {
  if (!apiKey) throw new Error('GEMINI_API_KEY가 비어 있습니다.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(modelName)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.92,
          topP: 0.95,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(cleanText(payload?.error?.message, 400) || `Gemini 요청 실패 (${response.status})`);
    }

    const text = extractGeminiText(payload);
    if (!text) throw new Error('Gemini 응답 본문이 없습니다.');
    return extractJson(text);
  } finally {
    clearTimeout(timer);
  }
}

function fallbackContent(dateKey, judge) {
  const caseDescription = `${dateKey} 생활법정 기록에 따르면, 원고는 퇴근 후 마지막 푸딩을 기대했으나 냉장고에는 빈 자리와 정체를 알 수 없는 작은 숟가락만 남아 있었다.`;
  return {
    caseTitle: '냉장고 마지막 푸딩 실종 사건',
    caseDescription,
    reception: `접수취지\n원고는 퇴근 후 보장되어야 할 마지막 푸딩 기대권이 예고 없이 소멸했다며 본 사건을 접수하였다.\n\n사건개요\n${caseDescription}\n\n접수의견\n본 건은 금액으로는 소액이나 숟가락을 들고 냉장고 문을 연 원고의 기대 밀도는 결코 소액이 아니므로 정식 기록으로 남긴다.`,
    investigation: `확인 정황\n냉장고 내부에는 푸딩이 있던 것으로 추정되는 빈 자리와 사용 여부를 묵비하는 작은 숟가락이 확인되었다.\n\n주요 증거\n빈 자리 1개, 숟가락 1개, 원고의 허공을 바라보는 표정 1건을 증거로 채택한다.\n\n조사관 의견\n용기는 발견되지 않았으나 냉장고의 지나치게 정돈된 공백이 오히려 범행 후 현장 정리 가능성을 강하게 말하고 있다.`,
    plaintiffArg: `청구취지\n원고는 피고가 푸딩의 행방을 밝히고 동급 이상의 디저트를 신속히 보충할 것을 구한다.\n\n주장요지\n퇴근 후 푸딩은 단순 유제품이 아니라 하루를 버틴 사람에게 예정된 폐회식이었다. 피고의 행위는 그 폐회식을 개회도 전에 종료시켰다.`,
    defendantArg: `답변취지\n피고 측은 해당 푸딩이 가족 공용 행복으로 표시되어 있었다고 오인했을 가능성을 주장한다.\n\n항변요지\n냉장고는 공용 공간이며 이름표가 없었다는 사정은 참작할 수 있다. 다만 빈 용기조차 남기지 않은 점은 피고의 방어 논리를 냉장고보다 더 차갑게 만든다.`,
    verdict: `주문\n1. 피고는 원고에게 동급 이상의 푸딩 2개를 보충한다.\n2. 피고는 그중 마지막 1개에 관하여 원고의 우선 선택권을 보장한다.\n3. 남은 감정 소모는 냉장고 문을 닫는 것으로 종결한다.\n\n판단이유\n재판부는 마지막 푸딩이 일상에서 차지하는 지위가 작아 보이지만, 퇴근 직후에는 사실상 하루의 최종 보상으로 기능한다고 판단한다.\n\n재판부 의견\n${judge.style} 본 사건에서 피고가 한마디 설명만 남겼어도 숟가락이 증거번호를 받을 일은 없었을 것이다.`,
    sentence: '피고는 푸딩 2개를 보충하고 마지막 1개의 선택권을 원고에게 부여한다.'
  };
}

function safePromptSetting(value, maxLen) {
  const text = cleanText(value, maxLen);
  if (!text) return '';
  const safety = inspectContent(text);
  if (!safety.safe || DAILY_PUBLIC_BLOCK_PATTERN.test(text)) return '';
  return text;
}

function buildPrompt(dateKey, judge, settings = {}) {
  const topicHints = safePromptSetting(settings.dailyAiTopicHints, 300);
  const additionalPrompt = safePromptSetting(settings.dailyAiPrompt, 800);
  const extra = [
    topicHints && `주제 힌트: ${topicHints}`,
    additionalPrompt && `추가 지시: ${additionalPrompt}`
  ].filter(Boolean).join('\n');

  return `소소킹 판결소 공개 판결기록에 올릴 안전하고 사소한 생활사건 1개를 작성한다.
실명, 연락처, 정치, 혐오, 성적 내용, 자해, 실제 범죄의 상세 묘사는 사용하지 않는다.
문서의 형식은 실제 사건보고서·준비서면·판결문처럼 진지하게 유지하되, 사건의 구체적인 사물과 행동에서 나온 웃음코드를 충분히 넣는다.

담당 판사: ${judge.type}
판사 성향: ${judge.style}
날짜: ${dateKey}
${extra}

반드시 아래 구조를 지킨다.
- caseTitle: 내용을 바로 알 수 있고 반드시 '사건'으로 끝나는 30자 이내 사건명
- caseDescription: 200자 이내 사건 경위
- reception: '접수취지', '사건개요', '접수의견' 소제목과 빈 줄 포함
- investigation: '확인 정황', '주요 증거', '조사관 의견' 소제목과 빈 줄 포함
- plaintiffArg: '청구취지', '주장요지' 소제목과 빈 줄 포함
- defendantArg: '답변취지', '항변요지' 소제목과 빈 줄 포함
- verdict: 첫머리에 '주문', 이어서 '판단이유', '재판부 의견' 소제목과 빈 줄 포함. 주문은 번호형 생활 처분 2~3개
- sentence: 판결 핵심을 요약한 실행 가능한 생활형 처분 한 문장`;
}

function normalizeDailyContent(ai, dateKey, judge) {
  const fallback = fallbackContent(dateKey, judge);
  return {
    caseTitle: normalizeTitle(ai?.caseTitle || fallback.caseTitle),
    caseDescription: cleanText(ai?.caseDescription, 300) || fallback.caseDescription,
    grievanceIndex: grievanceForDate(dateKey),
    nickname: '오늘의억울인',
    judgeType: judge.type,
    judgeIcon: judge.icon,
    judgeStyle: judge.style,
    reception: cleanDocument(ai?.reception, 1800) || fallback.reception,
    investigation: cleanDocument(ai?.investigation, 2200) || fallback.investigation,
    plaintiffArg: cleanDocument(ai?.plaintiffArg, 1800) || fallback.plaintiffArg,
    defendantArg: cleanDocument(ai?.defendantArg, 1800) || fallback.defendantArg,
    verdict: cleanDocument(ai?.verdict, 3000) || fallback.verdict,
    sentence: oneSentence(ai?.sentence, fallback.sentence)
  };
}

function dailyContentText(data = {}) {
  return [
    data.caseTitle,
    data.caseDescription,
    data.reception,
    data.investigation,
    data.plaintiffArg,
    data.defendantArg,
    data.verdict,
    data.sentence
  ].filter(Boolean).join('\n');
}

function containsBannedWord(text, bannedWords = []) {
  const source = String(text || '').toLowerCase();
  return bannedWords.find(word => {
    const normalized = String(word || '').trim().toLowerCase();
    return normalized && source.includes(normalized);
  }) || '';
}

function moderateDailyContent(data, dateKey, judge, settings = {}) {
  const text = dailyContentText(data);
  const safety = inspectContent(text);
  const blockedPattern = DAILY_PUBLIC_BLOCK_PATTERN.test(text);
  const bannedWord = containsBannedWord(text, Array.isArray(settings.bannedWords) ? settings.bannedWords : []);

  if (safety.safe && !blockedPattern && !bannedWord) {
    return {
      data,
      publish: true,
      status: 'passed',
      code: '',
      usedSafetyFallback: false
    };
  }

  const fallbackData = normalizeDailyContent(fallbackContent(dateKey, judge), dateKey, judge);
  const fallbackText = dailyContentText(fallbackData);
  const fallbackSafety = inspectContent(fallbackText);
  const fallbackBlocked = DAILY_PUBLIC_BLOCK_PATTERN.test(fallbackText);
  const fallbackBannedWord = containsBannedWord(
    fallbackText,
    Array.isArray(settings.bannedWords) ? settings.bannedWords : []
  );
  const code = safety.code || (blockedPattern ? 'daily-public-topic' : `banned-word:${bannedWord}`);

  if (!fallbackSafety.safe || fallbackBlocked || fallbackBannedWord) {
    return {
      data: fallbackData,
      publish: false,
      status: 'blocked',
      code: fallbackSafety.code || (fallbackBlocked ? 'daily-public-topic' : `banned-word:${fallbackBannedWord}`),
      usedSafetyFallback: true
    };
  }

  return {
    data: fallbackData,
    publish: true,
    status: 'passed',
    code: `fallback:${code}`,
    usedSafetyFallback: true
  };
}

function isCompleteResult(data = {}) {
  return Boolean(
    cleanText(data.caseTitle, 30) &&
    cleanDocument(data.reception, 200).length >= 40 &&
    cleanDocument(data.investigation, 200).length >= 40 &&
    cleanDocument(data.plaintiffArg, 200).length >= 30 &&
    cleanDocument(data.defendantArg, 200).length >= 30 &&
    cleanDocument(data.verdict, 300).length >= 60
  );
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}

async function buildDailyContent(dateKey, judge, settings) {
  const apiKey = cleanText(geminiKey.value(), 500);
  const configuredModel = cleanText(settings.geminiModel, 60);
  const modelNames = [...new Set([configuredModel, ...DEFAULT_MODELS].filter(Boolean))];
  let lastError = null;

  for (const modelName of modelNames) {
    try {
      const content = await callGemini(apiKey, modelName, buildPrompt(dateKey, judge, settings));
      return { content, modelName, fallbackReason: '' };
    } catch (err) {
      lastError = err;
      console.error('daily AI generation attempt failed:', {
        modelName,
        message: cleanText(err?.message, 400)
      });
    }
  }

  return {
    content: fallbackContent(dateKey, judge),
    modelName: '',
    fallbackReason: cleanText(lastError?.message, 200) || 'UNKNOWN_DAILY_AI_ERROR'
  };
}

async function createDailyAiCase(force = false) {
  const settings = await loadSettings();
  if (!force && settings.dailyAiEnabled === false) {
    return { created: false, disabled: true };
  }

  const dateKey = kstDateKey();
  const caseId = `daily_${dateKey.replace(/-/g, '')}`;
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const existing = await resultRef.get();

  if (
    existing.exists &&
    !force &&
    isCompleteResult(existing.data()) &&
    existing.data().contentSafetyStatus === 'passed'
  ) {
    return { created: false, caseId, skipped: 'already-complete' };
  }

  const judge = judgeForDate(dateKey);
  const generated = await buildDailyContent(dateKey, judge, settings);
  const normalized = normalizeDailyContent(generated.content, dateKey, judge);
  const moderation = moderateDailyContent(normalized, dateKey, judge, settings);
  const data = moderation.data;
  const dailyDocket = docketNumber(dateKey);
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  batch.set(caseRef, {
    userId: 'system-daily-ai',
    source: 'daily_ai',
    dailyDate: dateKey,
    docketNumber: dailyDocket,
    courtName: '소소킹 판결소',
    courtroom: '제404호 생활법정',
    division: '제3생활부',
    courtStage: 'sentenced',
    caseTitle: data.caseTitle,
    caseDescription: data.caseDescription,
    grievanceIndex: data.grievanceIndex,
    nickname: data.nickname,
    judgeType: data.judgeType,
    judgeIcon: data.judgeIcon,
    judgeStyle: data.judgeStyle,
    status: 'completed',
    isPublic: moderation.publish,
    reportCount: 0,
    contentSafetyStatus: moderation.status,
    contentSafetyCode: moderation.code,
    contentSafetyCheckedAt: now,
    createdAt: now,
    completedAt: now,
    updatedAt: now
  }, { merge: true });

  batch.set(resultRef, {
    source: 'daily_ai',
    dailyDate: dateKey,
    docketNumber: dailyDocket,
    courtName: '소소킹 판결소',
    courtroom: '제404호 생활법정',
    division: '제3생활부',
    isPublic: moderation.publish,
    caseTitle: data.caseTitle,
    // 공개 문서는 공개 스키마(publicDataVersion 1 + 민감 필드 제외)를 지켜야
    // 판결기록·사이트맵·민심소·공개 상세에 실제로 나타난다.
    // 그렇지 않으면 isPublic이 true인데도 어디에도 보이지 않는 문서가 된다.
    ...(moderation.publish === true
      ? {
        publicDataVersion: 1,
        publicCaseDescription: data.caseDescription || '',
        publicNickname: data.nickname || '오늘의 원고'
      }
      : {
        caseDescription: data.caseDescription,
        nickname: data.nickname
      }),
    grievanceIndex: data.grievanceIndex,
    judgeType: data.judgeType,
    judgeIcon: data.judgeIcon,
    judgeStyle: data.judgeStyle,
    reception: data.reception,
    investigation: data.investigation,
    plaintiffArg: data.plaintiffArg,
    defendantArg: data.defendantArg,
    verdict: data.verdict,
    sentence: data.sentence,
    aiSource: moderation.usedSafetyFallback
      ? 'local-daily-safety-fallback'
      : (generated.modelName ? 'gemini-rest' : 'local-daily-fallback'),
    aiModel: moderation.usedSafetyFallback ? '' : generated.modelName,
    aiFallbackReason: [generated.fallbackReason, moderation.code].filter(Boolean).join(' | '),
    promptVersion: 'daily-document-v4-judge-personas',
    contentSafetyStatus: moderation.status,
    contentSafetyCode: moderation.code,
    contentSafetyCheckedAt: now,
    reactionTotal: existing.exists ? Number(existing.data().reactionTotal || 0) : 0,
    commentCount: existing.exists ? Number(existing.data().commentCount || 0) : 0,
    courtStage: 'sentenced',
    createdAt: existing.exists ? (existing.data().createdAt || now) : now,
    updatedAt: now
  }, { merge: true });

  await batch.commit();
  await db.doc('site_settings/config').set({
    dailyAiLastRunAt: FieldValue.serverTimestamp(),
    dailyAiLastCaseId: caseId,
    dailyAiLastSafetyStatus: moderation.status,
    dailyAiLastSafetyCode: moderation.code
  }, { merge: true });

  return {
    created: true,
    caseId,
    repaired: existing.exists && !isCompleteResult(existing.data()),
    model: moderation.usedSafetyFallback ? '' : generated.modelName,
    fallback: !generated.modelName || moderation.usedSafetyFallback,
    published: moderation.publish,
    contentSafetyStatus: moderation.status
  };
}

// 일일 AI 사건 생성은 관리자 화면의 버튼이 호출하는 이 함수로만 실행한다.
exports.generateDailyAiNow = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 300,
  memory: '512MiB'
}, async request => {
  requireVerifiedUser(request);
  if (!(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  }
  return await createDailyAiCase(true);
});