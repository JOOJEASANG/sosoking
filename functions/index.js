"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-5-mini";
const ALLOWED_SEVERITIES = new Set(["official", "special", "national"]);
const ALLOWED_ORIGINS = new Set([
  "https://sosoking.co.kr",
  "https://www.sosoking.co.kr",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
]);
const BLOCKED_TERMS = [
  "폭행", "성폭력", "성추행", "강간", "학대", "자살", "자해", "살인", "납치",
  "스토킹", "협박", "학교폭력", "가정폭력", "아동학대", "사망", "흉기", "마약"
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
- 실존 인물의 범죄를 단정하거나 모욕하지 않는다. 이름은 피해자, 제보자, 피고, 친구, 가족 등 역할명으로 바꾼다.
- 실제 법률명이나 법률 조언처럼 보이지 않도록 명백히 허구인 죄명과 기관명을 만든다.
- 폭력, 성적 피해, 학대, 자해, 죽음, 중대한 범죄는 코미디로 만들지 않는다.
- 비속어, 혐오, 외모·성별·지역·장애 조롱을 사용하지 않는다.
- 양측 주장이 모두 조금씩 말이 되면서도 억지여야 한다.
- 증거 3개는 원래 사건의 세부를 과잉 분석한 것이어야 한다.
- 심문 3개는 질문→피고의 뻔뻔한 해명→검사 또는 판사의 정색 반박 구조다.
- 판결 3개는 서로 다른 성격이어야 한다: 엄벌형, 공동책임형, 황당한 화해형.
- 각 판결의 후일담은 판결을 집행했더니 비슷하거나 더 유치한 새 문제가 생기는 마지막 반전이어야 한다.
- 문장은 짧고 선명하게 쓴다. 모든 항목은 한국어로 작성한다.`;

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

function validateInput(body) {
  const incident = typeof body?.incident === "string" ? body.incident.trim() : "";
  const severity = typeof body?.severity === "string" ? body.severity : "official";

  if (incident.length < 7 || incident.length > 120) {
    return { error: "사건 내용은 7자 이상 120자 이하로 입력해주세요." };
  }
  if (!ALLOWED_SEVERITIES.has(severity)) {
    return { error: "올바르지 않은 사건 확대 수준입니다." };
  }
  if (BLOCKED_TERMS.some((term) => incident.includes(term))) {
    return { error: "실제 심각한 피해나 범죄는 코미디 재판으로 만들 수 없습니다." };
  }
  if (/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/.test(incident) || /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(incident)) {
    return { error: "전화번호나 이메일처럼 보이는 개인정보를 삭제해주세요." };
  }

  return { incident, severity };
}

function severityInstruction(severity) {
  const map = {
    official: "확대 수준은 정식 수사다. 동네 기관과 소규모 수사팀 정도로 과장한다.",
    special: "확대 수준은 특별 수사다. 합동수사본부, 브리핑룸, 과도한 인력 투입으로 키운다.",
    national: "확대 수준은 국가급 대응이다. 국가 비상대책본부처럼 과장하되 실제 정부기관을 사칭하지 않는다."
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

async function requestCourtCase(apiKey, incident, severity) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        instructions: SYSTEM_PROMPT,
        input: `제보 내용: ${incident}\n${severityInstruction(severity)}\n사소한 원문 사실을 유지하되 그 의미와 절차만 터무니없이 확대하라.`,
        text: {
          format: {
            type: "json_schema",
            name: "sosoking_court_case",
            description: "소문난 판결소의 완결형 코미디 사건 데이터",
            strict: true,
            schema: CASE_SCHEMA
          }
        },
        max_output_tokens: 2400
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || `OpenAI API ${response.status}`;
      throw new Error(detail);
    }

    const outputText = extractOutputText(payload);
    if (!outputText) throw new Error("AI 응답에서 사건 데이터를 찾지 못했습니다.");
    return JSON.parse(outputText);
  } finally {
    clearTimeout(timeout);
  }
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
      const courtCase = await requestCourtCase(OPENAI_API_KEY.value(), validated.incident, validated.severity);
      res.status(200).json({
        case: courtCase,
        meta: { source: "ai", model: OPENAI_MODEL, stored: false }
      });
    } catch (error) {
      logger.error("generateCourtCase failed", {
        message: error instanceof Error ? error.message : String(error),
        incidentLength: validated.incident.length,
        severity: validated.severity
      });
      res.status(503).json({ error: "AI 재판부가 현재 사건기록을 작성하지 못했습니다." });
    }
  }
);
