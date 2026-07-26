"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 30000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;
const buckets = new Map();
const SEVERITIES = new Set(["official", "special", "national"]);
const ORIGINS = new Set([
  "https://sosoking.co.kr",
  "https://www.sosoking.co.kr",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
]);
const BLOCKED = [
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

const SYSTEM_PROMPT = `당신은 한국어 코미디 서비스 '소문난 판결소'의 수석 작가다.
사용자의 아주 사소하고 유치한 일상을 지나치게 엄숙한 대형 사건으로 확대한다.

반드시 지킬 원칙:
- 내용은 하찮고 태도는 극도로 진지하다.
- 웃음을 설명하지 말고 사건기록, 감식보고, 법정 공방, 판결 집행으로 보여준다.
- 실명은 출력하지 않고 피해자, 제보자, 피고, 친구, 가족 같은 역할명으로 바꾼다.
- 실제 법률명과 실제 정부·수사·사법기관 이름을 사용하지 않는다.
- 폭력, 성적 피해, 학대, 자해, 죽음, 중대한 범죄를 코미디로 만들지 않는다.
- 혐오, 비속어, 외모·성별·지역·장애 조롱을 사용하지 않는다.
- 사건명은 구체적 행동을 담고 반드시 '사건'으로 끝낸다.
- 증거, 심문, 판결, 재판관 성향은 각각 정확히 3개다.
- 양측 주장은 서로 반대지만 각각 조금씩 말이 되어야 한다.
- 판결은 엄벌형, 공동책임형, 황당한 화해형으로 확실히 다르게 쓴다.
- 후일담은 판결 집행 때문에 더 유치한 새 문제가 생기는 반전이다.
- 각 문자열은 짧고 선명하게 쓰고 JSON을 끝까지 완성한다.`;

class SafetyInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "SafetyInputError";
  }
}

function isPreviewOrigin(origin) {
  return /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.(web\.app|firebaseapp\.com)$/i.test(origin || "") ||
    /^https:\/\/[a-z0-9-]+\.(web\.app|firebaseapp\.com)$/i.test(origin || "");
}

function containsPrivateData(text) {
  return PRIVATE_PATTERNS.some((pattern) => pattern.test(text));
}

function validateInput(body) {
  const incident = typeof body?.incident === "string" ? body.incident.replace(/\s+/g, " ").trim() : "";
  const severity = typeof body?.severity === "string" ? body.severity : "official";
  if (incident.length < 7 || incident.length > 120) return { error: "사건 내용은 7자 이상 120자 이하로 입력해주세요." };
  if (!SEVERITIES.has(severity)) return { error: "올바르지 않은 사건 확대 수준입니다." };
  if (BLOCKED.some((term) => incident.includes(term))) return { error: "실제 심각한 피해나 범죄는 코미디 재판으로 만들 수 없습니다." };
  if (containsPrivateData(incident)) return { error: "전화번호·이메일·주소·차량번호 등 개인정보를 삭제해주세요." };
  return { incident, severity };
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (buckets.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    buckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  buckets.set(ip, recent);
  if (buckets.size > 500) {
    for (const [key, times] of buckets.entries()) {
      if (!times.some((time) => now - time < RATE_WINDOW_MS)) buckets.delete(key);
    }
  }
  return false;
}

function severityText(severity) {
  return {
    official: "정식 수사: 동네의 가상 생활질서 수사대가 사건을 과잉 분석한다.",
    special: "특별 수사: 가상 합동수사본부와 브리핑룸까지 설치한다.",
    national: "국가급 대응: 가상 비상대책본부와 전국 유사사례 집계를 동원한다."
  }[severity];
}

function normalized(value) {
  return String(value || "").replace(/[\s.,!?"'“”‘’()[\]{}:;·-]/g, "").toLowerCase();
}

function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

function unique(items) {
  const values = items.map(normalized);
  return values.every(Boolean) && new Set(values).size === values.length;
}

function auditCourtCase(data) {
  const issues = [];
  if (!data || typeof data !== "object") return { ok: false, issues: ["객체 아님"] };
  if (!String(data.title || "").endsWith("사건")) issues.push("사건명 끝맺음");
  for (const key of ["evidence", "questions", "verdicts", "judgeTypes"]) {
    if (!Array.isArray(data[key]) || data[key].length !== 3) issues.push(`${key} 개수`);
  }
  const allText = collectStrings(data).join(" ");
  if (containsPrivateData(allText)) issues.push("개인정보 형태");
  if (REAL_INSTITUTIONS.some((term) => allText.includes(term))) issues.push("실제 기관명");
  if (Array.isArray(data.evidence) && !unique(data.evidence.map((item) => item?.title))) issues.push("증거 중복");
  if (Array.isArray(data.questions) && !unique(data.questions.map((item) => item?.question))) issues.push("심문 중복");
  if (Array.isArray(data.verdicts)) {
    if (!unique(data.verdicts.map((item) => item?.title))) issues.push("판결 중복");
    if (!unique(data.verdicts.map((item) => item?.afterStory))) issues.push("후일담 중복");
  }
  if (normalized(data.prosecution) === normalized(data.defense)) issues.push("공방 동일");
  return { ok: issues.length === 0, issues };
}

let sdkPromise;
async function loadSdk() {
  sdkPromise ||= import("@google/genai");
  return sdkPromise;
}

function buildResponseSchema(Type) {
  const text = () => ({ type: Type.STRING });
  const object = (required, properties) => ({ type: Type.OBJECT, required, properties });
  return object(
    ["title", "charge", "scene", "damages", "authority", "scale", "impact", "evidence", "questions", "prosecution", "defense", "judge", "verdicts", "judgeTypes"],
    {
      title: text(), charge: text(), scene: text(), damages: text(), authority: text(), scale: text(), impact: text(),
      evidence: { type: Type.ARRAY, items: object(["label", "title", "detail"], { label: text(), title: text(), detail: text() }) },
      questions: {
        type: Type.ARRAY,
        items: object(["question", "speaker", "response", "replySpeaker", "reply"], {
          question: text(), speaker: text(), response: text(), replySpeaker: text(), reply: text()
        })
      },
      prosecution: text(), defense: text(), judge: text(),
      verdicts: { type: Type.ARRAY, items: object(["title", "sentence", "afterStory"], { title: text(), sentence: text(), afterStory: text() }) },
      judgeTypes: { type: Type.ARRAY, items: text() }
    }
  );
}

async function withTimeout(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Gemini 응답 시간 초과")), REQUEST_TIMEOUT_MS);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function parseResponse(response) {
  const reason = String(response?.candidates?.[0]?.finishReason || "UNKNOWN");
  if (response?.promptFeedback?.blockReason || reason === "SAFETY") throw new SafetyInputError("가벼운 일상 소재만 접수할 수 있습니다.");
  if (reason === "MAX_TOKENS") throw new Error("Gemini 출력 토큰 한도 초과");
  const raw = String(response?.text || "").trim();
  if (!raw) throw new Error(`Gemini 응답 비어 있음(${reason})`);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Gemini JSON 파싱 실패(${reason})`);
  }
}

async function generate(apiKey, incident, severity, correction = "") {
  const { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } = await loadSdk();
  const ai = new GoogleGenAI({ apiKey });
  const prompt = [
    `제보 내용: ${incident}`,
    severityText(severity),
    "원문의 사실은 유지하고 사건의 의미와 절차만 터무니없이 확대하라.",
    correction ? `이전 품질 문제를 모두 수정하라: ${correction}` : ""
  ].filter(Boolean).join("\n");
  const safetySettings = [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT
  ].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));
  const response = await withTimeout(ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(Type),
      safetySettings,
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0.88,
      topP: 0.94,
      maxOutputTokens: 5000
    }
  }));
  return parseResponse(response);
}

async function generateAndAudit(apiKey, incident, severity) {
  let result = await generate(apiKey, incident, severity);
  let audit = auditCourtCase(result);
  if (!audit.ok) {
    logger.warn("court case quality retry", { issues: audit.issues, incidentLength: incident.length, severity });
    result = await generate(apiKey, incident, severity, audit.issues.join(", "));
    audit = auditCourtCase(result);
  }
  if (!audit.ok) throw new Error(`사건 품질 검사 실패: ${audit.issues.join(", ")}`);
  return result;
}

function safeLogMessage(error) {
  return String(error?.message || error || "unknown")
    .replace(/AIza[0-9A-Za-z_-]{15,}/g, "[redacted]")
    .replace(/[A-Za-z0-9_-]{35,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

exports.generateCourtCase = onRequest(
  {
    region: "asia-northeast3",
    timeoutSeconds: 60,
    memory: "512MiB",
    minInstances: 0,
    maxInstances: 5,
    secrets: [GEMINI_API_KEY]
  },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");

    const origin = String(req.headers.origin || "");
    if (origin && !ORIGINS.has(origin) && !isPreviewOrigin(origin)) return res.status(403).json({ error: "허용되지 않은 요청 출처입니다." });
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      return res.status(405).json({ error: "POST 요청만 허용됩니다." });
    }
    if (String(req.headers["x-sosoking-client"] || "") !== "court-v2") return res.status(400).json({ error: "올바르지 않은 사건 접수 요청입니다." });
    if (Number(req.headers["content-length"] || 0) > 4096) return res.status(413).json({ error: "사건 접수 내용이 너무 큽니다." });
    if (isRateLimited(clientIp(req))) return res.status(429).json({ error: "재판부가 과로 중입니다. 잠시 뒤 다시 접수해주세요." });

    const input = validateInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });

    try {
      const apiKey = String(GEMINI_API_KEY.value() || "").trim();
      if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
      const courtCase = await generateAndAudit(apiKey, input.incident, input.severity);
      return res.status(200).json({
        case: courtCase,
        meta: { source: "gemini", model: MODEL, thinking: false, stored: false }
      });
    } catch (error) {
      const isSafety = error instanceof SafetyInputError;
      logger.error("generateCourtCase failed", {
        type: isSafety ? "safety" : "generation",
        message: safeLogMessage(error),
        incidentLength: input.incident.length,
        severity: input.severity
      });
      return res.status(isSafety ? 400 : 503).json({
        error: isSafety ? error.message : "AI 재판부가 현재 사건기록을 작성하지 못했습니다."
      });
    }
  }
);
