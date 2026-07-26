"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-5-mini";
const MODERATION_MODEL = "omni-moderation-latest";
const ALLOWED_SEVERITIES = new Set(["official", "special", "national"]);
const ALLOWED_ORIGINS = new Set([
  "https://sosoking.co.kr",
  "https://www.sosoking.co.kr",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
]);
const BLOCKED_TERMS = [
  "폭행", "폭력", "성폭력", "성추행", "성희롱", "강간", "학대", "자살", "자해", "살인", "납치", "유괴",
  "스토킹", "협박", "학교폭력", "가정폭력", "아동학대", "사망", "흉기", "마약", "응급실", "교통사고",
  "뺑소니", "음주운전", "성범죄", "불륜", "외도", "바람폈", "임신", "낙태"
];
const REAL_INSTITUTIONS = ["대법원", "헌법재판소", "검찰청", "경찰청", "국가정보원", "국무총리실", "대통령실"];
const PRIVATE_PATTERNS = [
  /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/,
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
  /https?:\/\/|www\./i,
  /\b\d{6}[ -]?[1-4]\d{6}\b/,
  /\b(?:\d[ -]?){13,19}\b/,
  /\b\d{2,3}[가-힣]\d{4}\b/,
  /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{0,20}(로|길|동)\s*\d+/
];
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;
const rateBuckets = new Map();

const CASE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "charge", "scene", "damages", "authority", "scale", "impact",
    "evidence", "questions", "prosecution", "defense", "judge", "verdicts", "judgeTypes"
  ],
  properties: {
    title: { type: "string", minLength: 8, maxLength: 70 },
    charge: { type: "string", minLength: 5, maxLength: 50 },
    scene: { type: "string", minLength: 20, maxLength: 240 },
    damages: { type: "string", minLength: 8, maxLength: 110 },
    authority: { type: "string", minLength: 6, maxLength: 60 },
    scale: { type: "string", minLength: 20, maxLength: 210 },
    impact: { type: "string", minLength: 15, maxLength: 170 },
    evidence: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "title", "detail"],
        properties: {
          label: { type: "string", minLength: 4, maxLength: 20 },
          title: { type: "string", minLength: 3, maxLength: 35 },
          detail: { type: "string", minLength: 15, maxLength: 190 }
        }
      }
    },
    questions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "speaker", "response", "replySpeaker", "reply"],
        properties: {
          question: { type: "string", minLength: 6, maxLength: 70 },
          speaker: { type: "string", minLength: 2, maxLength: 12 },
          response: { type: "string", minLength: 8, maxLength: 150 },
          replySpeaker: { type: "string", minLength: 2, maxLength: 12 },
          reply: { type: "string", minLength: 8, maxLength: 150 }
        }
      }
    },
    prosecution: { type: "string", minLength: 30, maxLength: 260 },
    defense: { type: "string", minLength: 30, maxLength: 260 },
    judge: { type: "string", minLength: 15, maxLength: 180 },
    verdicts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "sentence", "afterStory"],
        properties: {
          title: { type: "string", minLength: 4, maxLength: 40 },
          sentence: { type: "string", minLength: 8, maxLength: 120 },
          afterStory: { type: "string", minLength: 15, maxLength: 220 }
        }
      }
    },
    judgeTypes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 10, maxLength: 90 }
    }
  }
};

const SYSTEM_PROMPT = `당신은 한국어 코미디 서비스 '소문난 판결소'의 수석 작가다.
사용자가 적은 아주 사소하고 유치한 일상을 지나치게 엄숙한 대형 사건으로 확대한다.

절대 원칙:
- 내용은 하찮고 태도는 극도로 진지해야 한다.
- 웃음을 설명하지 말고 사건기록, 감식보고, 법정 공방, 판결 집행 장면으로 보여준다.
- 원문에 실명이 있더라도 피해자, 제보자, 피고, 친구, 가족 등 역할명으로 바꾸고 이름을 출력하지 않는다.
- 실제 법률명, 실제 죄명, 실제 정부·수사·사법기관 명칭을 사용하지 않는다. 모든 죄명과 기관명은 명백한 허구여야 한다.
- 폭력, 성적 피해, 학대, 자해, 죽음, 중대한 범죄는 코미디로 만들지 않는다.
- 비속어, 혐오, 외모·성별·지역·장애 조롱을 사용하지 않는다.
- 양측 주장이 모두 조금씩 말이 되면서도 억지여야 한다.
- 사건명은 구체적인 행동과 피해를 담고 반드시 '사건'으로 끝낸다.
- 증거 3개는 원래 사건의 세부를 과잉 분석하며 서로 완전히 다른 소재를 사용한다.
- 심문 3개는 질문→피고의 뻔뻔한 해명→검사 또는 판사의 정색 반박 구조다.
- 검사와 변호인의 논리는 서로 반대여야 하며 같은 말을 바꿔 쓰지 않는다.
- 판결 3개는 엄벌형, 공동책임형, 황당한 화해형으로 명확히 달라야 한다.
- 각 판결의 후일담은 판결 집행 때문에 비슷하거나 더 유치한 새 문제가 생기는 마지막 반전이어야 한다.
- '국가적 쟁점', '필요 이상', '사소하지만' 같은 상투어를 반복하지 않는다.
- 문장은 짧고 선명하게 쓴다. 모든 항목은 한국어로 작성한다.`;

class SafetyInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "SafetyInputError";
  }
}

function isFirebasePreviewOrigin(origin) {
  return /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.(web\.app|firebaseapp\.com)$/i.test(origin || "") ||
    /^https:\/\/[a-z0-9-]+\.(web\.app|firebaseapp\.com)$/i.test(origin || "");
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (rateBuckets.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateBuckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateBuckets.set(ip, recent);
  if (rateBuckets.size > 500) {
    for (const [key, times] of rateBuckets.entries()) {
      if (!times.some((time) => now - time < RATE_WINDOW_MS)) rateBuckets.delete(key);
    }
  }
  return false;
}

function hasPrivateData(value) {
  return PRIVATE_PATTERNS.some((pattern) => pattern.test(value));
}

function validateInput(body) {
  const incident = typeof body?.incident === "string" ? body.incident.replace(/\s+/g, " ").trim() : "";
  const severity = typeof body?.severity === "string" ? body.severity : "official";

  if (incident.length < 7 || incident.length > 120) return { error: "사건 내용은 7자 이상 120자 이하로 입력해주세요." };
  if (!ALLOWED_SEVERITIES.has(severity)) return { error: "올바르지 않은 사건 확대 수준입니다." };
  if (BLOCKED_TERMS.some((term) => incident.includes(term))) return { error: "실제 심각한 피해나 범죄는 코미디 재판으로 만들 수 없습니다." };
  if (hasPrivateData(incident)) return { error: "전화번호·이메일·주소·차량번호 등 개인정보를 삭제해주세요." };
  return { incident, severity };
}

function severityInstruction(severity) {
  const map = {
    official: "확대 수준은 정식 수사다. 동네의 가상 기관과 소규모 수사팀 정도로 과장한다.",
    special: "확대 수준은 특별 수사다. 가상의 합동수사본부, 브리핑룸, 과도한 인력 투입으로 키운다.",
    national: "확대 수준은 국가급 대응이다. 가상의 비상대책본부처럼 과장하되 실제 정부기관을 사칭하지 않는다."
  };
  return map[severity];
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

async function moderateText(apiKey, input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODERATION_MODEL, input }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `Moderation API ${response.status}`);
    return Boolean(payload?.results?.[0]?.flagged);
  } finally {
    clearTimeout(timeout);
  }
}

function flattenStrings(value, result = []) {
  if (typeof value === "string") result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => flattenStrings(item, result));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => flattenStrings(item, result));
  return result;
}

function normalizedKey(value) {
  return String(value).replace(/[\s.,!?"'“”‘’()[\]{}:;·-]/g, "").toLowerCase();
}

function uniqueEnough(values) {
  const keys = values.map(normalizedKey);
  return new Set(keys).size === keys.length;
}

function auditCourtCase(courtCase) {
  const issues = [];
  if (!courtCase || typeof courtCase !== "object") return { ok: false, issues: ["사건 데이터가 객체가 아님"] };
  if (!String(courtCase.title || "").endsWith("사건")) issues.push("사건명이 '사건'으로 끝나지 않음");
  if (!Array.isArray(courtCase.evidence) || courtCase.evidence.length !== 3) issues.push("증거가 3개가 아님");
  if (!Array.isArray(courtCase.questions) || courtCase.questions.length !== 3) issues.push("심문이 3개가 아님");
  if (!Array.isArray(courtCase.verdicts) || courtCase.verdicts.length !== 3) issues.push("판결이 3개가 아님");
  if (!Array.isArray(courtCase.judgeTypes) || courtCase.judgeTypes.length !== 3) issues.push("재판관 성향이 3개가 아님");

  const allText = flattenStrings(courtCase).join(" ");
  if (hasPrivateData(allText)) issues.push("출력에 개인정보 형태가 포함됨");
  if (BLOCKED_TERMS.some((term) => allText.includes(term))) issues.push("출력에 차단 소재가 포함됨");
  if (REAL_INSTITUTIONS.some((term) => allText.includes(term))) issues.push("실제 기관명이 포함됨");

  if (Array.isArray(courtCase.evidence) && !uniqueEnough(courtCase.evidence.map((item) => item?.title || ""))) issues.push("증거 제목이 중복됨");
  if (Array.isArray(courtCase.questions) && !uniqueEnough(courtCase.questions.map((item) => item?.question || ""))) issues.push("심문 질문이 중복됨");
  if (Array.isArray(courtCase.verdicts)) {
    if (!uniqueEnough(courtCase.verdicts.map((item) => item?.title || ""))) issues.push("판결 제목이 중복됨");
    if (!uniqueEnough(courtCase.verdicts.map((item) => item?.afterStory || ""))) issues.push("후일담이 중복됨");
  }
  if (normalizedKey(courtCase.prosecution || "") === normalizedKey(courtCase.defense || "")) issues.push("검사와 변호인 주장이 동일함");
  return { ok: issues.length === 0, issues };
}

async function requestCourtCase(apiKey, incident, severity, correction = "") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const correctionText = correction ? `\n품질 검사에서 다음 문제가 발견됐다: ${correction}. 이번 응답에서는 반드시 고쳐라.` : "";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        instructions: SYSTEM_PROMPT,
        input: `제보 내용: ${incident}\n${severityInstruction(severity)}\n사소한 원문 사실을 유지하되 의미와 절차만 터무니없이 확대하라.${correctionText}`,
        text: {
          format: {
            type: "json_schema",
            name: "sosoking_court_case",
            description: "소문난 판결소의 완결형 코미디 사건 데이터",
            strict: true,
            schema: CASE_SCHEMA
          }
        },
        max_output_tokens: 2600
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API ${response.status}`);
    const outputText = extractOutputText(payload);
    if (!outputText) throw new Error("AI 응답에서 사건 데이터를 찾지 못했습니다.");
    return JSON.parse(outputText);
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAndAudit(apiKey, incident, severity) {
  let courtCase = await requestCourtCase(apiKey, incident, severity);
  let audit = auditCourtCase(courtCase);
  if (!audit.ok) {
    logger.warn("court case quality retry", { issues: audit.issues, incidentLength: incident.length, severity });
    courtCase = await requestCourtCase(apiKey, incident, severity, audit.issues.join(", "));
    audit = auditCourtCase(courtCase);
  }
  if (!audit.ok) throw new Error(`사건 품질 검사 실패: ${audit.issues.join(", ")}`);
  if (await moderateText(apiKey, JSON.stringify(courtCase))) throw new SafetyInputError("생성된 사건이 안전 기준을 통과하지 못했습니다.");
  return courtCase;
}

exports.generateCourtCase = onRequest(
  {
    region: "asia-northeast3",
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 10,
    secrets: [OPENAI_API_KEY]
  },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");

    const origin = String(req.headers.origin || "");
    if (origin && !ALLOWED_ORIGINS.has(origin) && !isFirebasePreviewOrigin(origin)) {
      res.status(403).json({ error: "허용되지 않은 요청 출처입니다." });
      return;
    }
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).json({ error: "POST 요청만 허용됩니다." });
      return;
    }
    if (String(req.headers["x-sosoking-client"] || "") !== "court-v2") {
      res.status(400).json({ error: "올바르지 않은 사건 접수 요청입니다." });
      return;
    }
    if (Number(req.headers["content-length"] || 0) > 4096) {
      res.status(413).json({ error: "사건 접수 내용이 너무 큽니다." });
      return;
    }

    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.status(429).json({ error: "재판부가 과로 중입니다. 잠시 뒤 다시 접수해주세요." });
      return;
    }

    const validated = validateInput(req.body);
    if (validated.error) {
      res.status(400).json({ error: validated.error });
      return;
    }

    try {
      const apiKey = OPENAI_API_KEY.value();
      if (await moderateText(apiKey, validated.incident)) throw new SafetyInputError("가벼운 일상 소재만 접수할 수 있습니다.");
      const courtCase = await generateAndAudit(apiKey, validated.incident, validated.severity);
      res.status(200).json({
        case: courtCase,
        meta: { source: "ai", model: OPENAI_MODEL, moderation: MODERATION_MODEL, stored: false }
      });
    } catch (error) {
      const isSafety = error instanceof SafetyInputError;
      logger.error("generateCourtCase failed", {
        type: isSafety ? "safety" : "generation",
        message: error instanceof Error ? error.message : String(error),
        incidentLength: validated.incident.length,
        severity: validated.severity
      });
      res.status(isSafety ? 400 : 503).json({
        error: isSafety ? error.message : "AI 재판부가 현재 사건기록을 작성하지 못했습니다."
      });
    }
  }
);
