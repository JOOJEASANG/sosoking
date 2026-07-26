"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 45000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;
const buckets = new Map();
const SEVERITIES = new Set(["official", "special", "national"]);
const CLIENTS = new Set(["court-v6"]);
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
const PRIVATE_PATTERNS = [
  /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/,
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
  /https?:\/\/|www\./i,
  /\b\d{6}[ -]?[1-4]\d{6}\b/,
  /\b(?:\d[ -]?){13,19}\b/,
  /\b\d{2,3}[가-힣]\d{4}\b/
];
const STOPWORDS = new Set([
  "내가", "나는", "저는", "우리", "친구", "가족", "동생", "형", "누나", "언니", "오빠", "회사", "집에서",
  "그리고", "그런데", "그래서", "정말", "너무", "조금", "그냥", "다시", "또", "안", "못", "같이", "했다", "있다"
]);

const SYSTEM_PROMPT = `당신은 한국어 코미디 서비스 '소문난 판결소'의 수석 시나리오 작가다.
사용자가 입력한 짧은 일상 문장을 하나의 완결된 가상 사건으로 확장한다.
사용자는 아무것도 선택하지 않고 사건 접수부터 판결 이후까지 읽기만 한다.

반드시 하나의 동일 사건이 아래 실제 절차를 따라 자연스럽게 이어져야 한다.
1. 사건 접수와 최초 진술
2. 초동수사와 현장 확인
3. 잠복·감식·압수수색을 포함한 과잉수사
4. 피의자·피해자·참고인 조사와 진술 모순
5. 수사결과 송치와 가상 기소
6. 합의·조정 시도와 성립 또는 결렬
7. 검사·변호인·증인·재판장의 법정 공방
8. 인정 사실, 책임 비율, 명령과 판결 이유
9. 판결 집행 뒤 더 유치한 후속 사건

핵심 규칙:
- 최초 입력의 물건, 행동, 시간, 약속, 장소를 처음부터 끝까지 계속 사용한다.
- 새로운 무관한 사건으로 바꾸지 않는다.
- 웃음은 사소한 일을 실제 사건 절차처럼 지나치게 진지하고 정밀하게 처리하는 데서 만든다.
- 사용자의 문장을 단순 반복하지 말고 구체적인 가상 정황, 측정값, 증거, 진술, 반박을 만들어 확장한다.
- 실제 사람 이름, 실제 기관명, 실제 법률명은 사용하지 않는다.
- 가상 기관과 가상 혐의는 명백히 패러디임을 알 수 있게 쓴다.
- 폭력, 성적 피해, 학대, 자해, 죽음, 혐오를 코미디로 만들지 않는다.
- 모든 문자열은 짧고 선명하게 작성하고 JSON을 끝까지 완성한다.`;

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
  if (BLOCKED.some((term) => incident.includes(term))) return { error: "실제 심각한 피해나 범죄는 코미디 사건으로 만들 수 없습니다." };
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
  return false;
}

function severityText(severity) {
  return {
    official: "정식 사건: 실제 절차를 충실히 따르되 과장은 현실의 5배다.",
    special: "특별 사건: 잠복·감식·합동수사·공개브리핑을 모두 포함하고 과장은 현실의 20배다.",
    national: "국가급 사건: 가상 대책본부와 전국 유사사례 집계까지 포함하고 과장은 현실의 100배다."
  }[severity];
}

function stripParticle(token) {
  return token
    .replace(/[^0-9A-Za-z가-힣]/g, "")
    .replace(/(으로부터|에게서|까지는|에서는|으로는|라는|이라고|하고도|보다도|처럼|에게|한테|부터|까지|으로|에서|께서|이랑|하고|라도|조차|마저|밖에|마다|처럼|보다|이든|든지|이라|라고|이며|이고|이며|은|는|이|가|을|를|에|의|와|과|도|만|로)$/g, "")
    .trim();
}

function extractAnchors(incident) {
  const tokens = incident.split(/\s+/).map(stripParticle).filter(Boolean);
  const anchors = [];
  for (const token of tokens) {
    if (token.length < 2 || STOPWORDS.has(token)) continue;
    if (/^(먹었다|남았다|사라졌다|늦었다|샀다|안샀다|넣어뒀다|두었다)$/.test(token)) continue;
    if (!anchors.includes(token)) anchors.push(token);
  }
  return anchors.slice(0, 5).length ? anchors.slice(0, 5) : [incident.slice(0, 12)];
}

function includesAny(text, anchors) {
  const value = String(text || "");
  return anchors.some((anchor) => value.includes(anchor));
}

function ensureAnchor(text, anchor, prefix) {
  const value = String(text || "").trim();
  return value.includes(anchor) ? value : `${prefix} ${anchor} 관련 기록이다. ${value}`.trim();
}

function anchorCase(data, incident, anchors) {
  const primary = anchors[0];
  const pair = anchors.slice(0, 2).join("·");
  const result = JSON.parse(JSON.stringify(data || {}));
  result.originalIncident = incident;
  result.anchors = anchors;
  result.title = ensureAnchor(result.title, primary, `[${pair}]`);
  if (!String(result.title).endsWith("사건")) result.title = `${result.title} 사건`;
  result.caseSummary = `접수된 내용은 “${incident}”이다. ${String(result.caseSummary || "").trim()}`;
  result.intake ||= {};
  result.intake.complaint = incident;
  result.intake.complainantStatement = ensureAnchor(result.intake.complainantStatement, primary, "피해자는");
  result.initialInvestigation ||= {};
  result.initialInvestigation.sceneControl = ensureAnchor(result.initialInvestigation.sceneControl, primary, "초동팀은");
  if (Array.isArray(result.initialInvestigation.evidence)) {
    result.initialInvestigation.evidence = result.initialInvestigation.evidence.map((item, index) => ({
      ...item,
      title: index < 2 ? ensureAnchor(item?.title, anchors[index] || primary, "핵심 증거") : item?.title,
      detail: index < 2 ? ensureAnchor(item?.detail, anchors[index] || primary, "현장에서") : item?.detail
    }));
  }
  result.overInvestigation ||= {};
  if (Array.isArray(result.overInvestigation.forensicReports)) {
    result.overInvestigation.forensicReports = result.overInvestigation.forensicReports.map((item, index) => ({
      ...item,
      target: index < 2 ? ensureAnchor(item?.target, anchors[index] || primary, "감식 대상") : item?.target
    }));
  }
  result.interrogation ||= {};
  result.interrogation.accusedStatement = ensureAnchor(result.interrogation.accusedStatement, primary, "피의자는");
  result.referral ||= {};
  result.referral.investigationConclusion = ensureAnchor(result.referral.investigationConclusion, primary, "수사본부는");
  result.settlement ||= {};
  result.settlement.openingDemand = ensureAnchor(result.settlement.openingDemand, primary, "피해자 측은");
  result.trial ||= {};
  result.trial.prosecutionOpening = ensureAnchor(result.trial.prosecutionOpening, primary, "검사는");
  result.judgment ||= {};
  result.judgment.order = ensureAnchor(result.judgment.order, primary, "재판부는");
  result.judgment.afterStory = ensureAnchor(result.judgment.afterStory, primary, "판결 집행 뒤");
  return result;
}

function fallbackCase(incident, severity) {
  const anchors = extractAnchors(incident);
  const subject = anchors.slice(0, 2).join("·");
  const primary = anchors[0];
  const exaggeration = { official: "14명", special: "37명", national: "108명" }[severity];
  return anchorCase({
    title: `${subject} 생활질서 경계 침범 사건`,
    subtitle: "별일 아닌 일에 모든 절차를 적용한 기록",
    fictionalCharge: `${primary} 관련 기대권 과잉침범 및 설명의무 방치 혐의`,
    caseSummary: `${primary}을 둘러싼 짧은 다툼이 신고, 감식, 조정, 재판까지 확대됐다.`,
    intake: {
      complaint: incident,
      complainantStatement: `피해자는 ${primary}에 관한 약속 또는 기대가 명확히 침해됐다고 진술했다.`,
      accusedInitialPosition: `피의자는 고의가 아니라 순간적인 판단 또는 관행이었다고 주장했다.`,
      assignedUnit: `${subject} 생활질서 전담반 ${exaggeration}`
    },
    initialInvestigation: {
      sceneControl: `${primary} 주변 반경 90cm를 통제하고 원래 상태를 재구성했다.`,
      measurements: [`${primary}의 위치·크기·잔여량을 세 차례 측정`, "사건 전후 시간 차이를 초 단위로 복원", "관련 물건의 방향과 이동거리 기록"],
      witnessChecks: ["가장 가까운 사람의 최초 반응 확인", "현장에 있었지만 관심 없던 참고인 조사", "사건 이후 단체대화방 반응 분석"],
      evidence: [
        { title: `${primary} 현장 상태`, detail: `${incident} 직후의 상태를 사진과 자로 기록했다.`, meaning: "최초 신고 내용과 일치하는 핵심 자료" },
        { title: `${anchors[1] || primary} 관련 흔적`, detail: `${anchors[1] || primary}의 위치와 사용 흔적을 비교했다.`, meaning: "행위 범위를 추정하는 보조 자료" },
        { title: "사건 전 대화 기록", detail: "허용 범위와 기대 수준을 확인할 수 있는 짧은 대화가 남아 있다.", meaning: "당사자의 사전 인식을 판단" },
        { title: "사건 후 해명 태도", detail: "해명 과정에서 표현이 세 차례 바뀌었다.", meaning: "고의보다 당황한 정도를 보여주는 자료" }
      ]
    },
    overInvestigation: {
      taskForce: `${subject} 합동과잉수사본부를 편성하고 장비 11종을 투입했다.`,
      surveillance: `${primary}이 다시 문제될 가능성을 확인하려고 현장 옆에서 2시간 잠복했으나 간식 시간만 정확히 파악했다.`,
      forensicReports: [
        { target: `${primary} 표면`, method: "48배 확대와 반사광 분석", finding: "사건 전후 형태 차이가 확인됨", unnecessaryConclusion: "관련 물건은 당시 약간 당황했을 가능성이 높음" },
        { target: `${anchors[1] || primary} 주변`, method: "미세 위치 복원", finding: "최초 위치에서 3.7cm 이동", unnecessaryConclusion: "이동 방향은 냉장고 또는 소파 쪽을 선호함" },
        { target: "주변 공용도구", method: "사용 흔적 교차대조", finding: "사건 시간대 사용 가능성 존재", unnecessaryConclusion: "도구는 끝까지 진술을 거부함" }
      ],
      searchAndSeizure: `${primary} 주변 서랍과 포장물에 가상 확인영장을 집행하고 관련성 낮은 영수증까지 봉인했다.`,
      publicBriefing: `${subject} 사건은 통제되고 있으나 유사 사례 확산 가능성을 이유로 마이크 7개를 설치했다.`
    },
    interrogation: {
      accusedStatement: `${primary} 관련 행동은 인정하지만 결과가 그렇게 커질 줄 몰랐다고 진술했다.`,
      complainantRebuttal: `피해자는 결과보다 사전 허락과 사후 태도가 핵심이라고 반박했다.`,
      witnessStatements: ["참고인 1은 분위기가 갑자기 조용해졌다고 진술했다.", "참고인 2는 사건보다 수사 인원이 더 놀라웠다고 진술했다."],
      contradictions: ["행위 시각이 최초 진술보다 4분 늦어짐", "허용 범위에 대한 표현이 한입·조금·잠깐으로 변경됨", "사건 직후 웃지 않았다는 주장과 단체대화방 이모티콘이 충돌함"]
    },
    referral: {
      investigationConclusion: `${primary} 관련 기본 사실은 인정되나 피해 규모는 당사자 기대치에 따라 달라진다.`,
      fictionalCharge: `${primary} 기대권 경계초과 혐의`,
      referralOpinion: "기소 의견으로 소문동 생활질서 심사부에 송치", prosecutionDecision: "사안은 하찮지만 기록이 너무 두꺼워 가상 기소 결정",
      coreIssues: ["사전에 허용된 범위", "실제 행동이 허용 범위를 넘었는지", "사후 사과와 복구 제안이 충분했는지"]
    },
    settlement: {
      openingDemand: `피해자 측은 ${primary} 3배 복구와 공식 사과를 요구했다.`,
      counterOffer: `피의자 측은 동일한 ${primary} 1개와 간단한 사과를 제안했다.`,
      mediatorRecommendation: `조정위원은 ${primary} 2개 복구, 첫 사용권 보장, 관련 농담 7일 금지를 권고했다.`,
      result: "수량에는 접근했으나 첫 사용권 문구를 두고 부분 합의에 그쳤다.",
      reason: "‘먼저’의 기준을 포장 개봉 시점으로 볼지 실제 사용 시점으로 볼지 의견이 갈렸다."
    },
    trial: {
      prosecutionOpening: `검사는 ${primary} 자체보다 허용 범위를 넘긴 뒤 대수롭지 않게 대응한 점을 문제 삼았다.`,
      defenseOpening: "변호인은 피해가 즉시 복구 가능하고 사전 허용이 일부 있었다고 반박했다.",
      evidenceArguments: [
        { evidence: `${primary} 현장 상태`, prosecution: "허용 범위를 넘긴 결과가 명확하다.", defense: "정확한 원래 상태가 기록되지 않았다." },
        { evidence: "사건 전 대화", prosecution: "제한된 허용만 있었다.", defense: "금지 의사가 명확하지 않았다." },
        { evidence: "사건 후 해명", prosecution: "책임을 줄이려 진술이 바뀌었다.", defense: "당황해서 표현만 달라졌다." }
      ],
      witnessExamination: [
        { question: "사건 직후 분위기는 어땠습니까?", answer: "모두가 해당 물건만 바라봤습니다.", courtReaction: "재판부는 침묵의 길이를 중요한 정황으로 기록했다." },
        { question: "평소에도 비슷한 일이 있었습니까?", answer: "작은 전례는 있었지만 수사본부는 처음입니다.", courtReaction: "재판부는 반복성보다 과잉수사성을 주목했다." },
        { question: "복구 제안을 받았습니까?", answer: "받았지만 조건이 지나치게 작았습니다.", courtReaction: "재판부는 ‘작다’의 객관적 기준을 다시 물었다." }
      ],
      judgeQuestions: ["허용 범위를 숫자나 크기로 정한 적이 있습니까?", "지금이라도 동일한 물건으로 복구할 의사가 있습니까?"],
      closingStatements: "검사는 생활질서 회복을, 변호인은 즉시 화해를 요청했고 피의자는 다음부터 먼저 묻겠다고 최후진술했다."
    },
    judgment: {
      recognizedFacts: [`${primary} 관련 행동이 실제로 발생함`, "피해자가 일정 범위만 허용했거나 기대했음", "사후 해명과 복구 제안이 충분하지 않았음"],
      liabilityRatio: "피의자 80% · 피해자 20% 관리책임", order: `피의자는 ${primary} 2개를 복구하고 첫 사용권을 피해자에게 보장한다.`,
      sentence: "관련 물건 접근 전 사전 질문 의무 14일", reasoning: "사건은 작지만 약속의 경계와 사후 태도는 작지 않다. 다만 허용 범위를 구체적으로 정하지 않은 책임도 일부 인정한다.",
      afterStory: `복구된 ${primary}의 첫 사용권을 행사하는 순서를 두고 새로운 사건이 접수됐다.`
    }
  }, incident, anchors);
}

function auditCase(data) {
  const issues = [];
  const requiredObjects = ["intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"];
  for (const key of requiredObjects) if (!data?.[key] || typeof data[key] !== "object") issues.push(`${key} 누락`);
  const counts = [
    [data?.initialInvestigation?.measurements, 3, "measurements"],
    [data?.initialInvestigation?.witnessChecks, 3, "witnessChecks"],
    [data?.initialInvestigation?.evidence, 4, "evidence"],
    [data?.overInvestigation?.forensicReports, 3, "forensicReports"],
    [data?.interrogation?.witnessStatements, 2, "witnessStatements"],
    [data?.interrogation?.contradictions, 3, "contradictions"],
    [data?.referral?.coreIssues, 3, "coreIssues"],
    [data?.trial?.evidenceArguments, 3, "evidenceArguments"],
    [data?.trial?.witnessExamination, 3, "witnessExamination"],
    [data?.trial?.judgeQuestions, 2, "judgeQuestions"],
    [data?.judgment?.recognizedFacts, 3, "recognizedFacts"]
  ];
  for (const [value, count, name] of counts) if (!Array.isArray(value) || value.length !== count) issues.push(`${name} 개수`);
  if (!String(data?.title || "").endsWith("사건")) issues.push("사건명");
  return { ok: issues.length === 0, issues };
}

let sdkPromise;
async function loadSdk() {
  sdkPromise ||= import("@google/genai");
  return sdkPromise;
}

function buildSchema(Type) {
  const text = () => ({ type: Type.STRING });
  const array = (items) => ({ type: Type.ARRAY, items });
  const object = (required, properties) => ({ type: Type.OBJECT, required, properties });
  return object(
    ["title", "subtitle", "fictionalCharge", "caseSummary", "intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"],
    {
      title: text(), subtitle: text(), fictionalCharge: text(), caseSummary: text(),
      intake: object(["complaint", "complainantStatement", "accusedInitialPosition", "assignedUnit"], {
        complaint: text(), complainantStatement: text(), accusedInitialPosition: text(), assignedUnit: text()
      }),
      initialInvestigation: object(["sceneControl", "measurements", "witnessChecks", "evidence"], {
        sceneControl: text(), measurements: array(text()), witnessChecks: array(text()),
        evidence: array(object(["title", "detail", "meaning"], { title: text(), detail: text(), meaning: text() }))
      }),
      overInvestigation: object(["taskForce", "surveillance", "forensicReports", "searchAndSeizure", "publicBriefing"], {
        taskForce: text(), surveillance: text(),
        forensicReports: array(object(["target", "method", "finding", "unnecessaryConclusion"], { target: text(), method: text(), finding: text(), unnecessaryConclusion: text() })),
        searchAndSeizure: text(), publicBriefing: text()
      }),
      interrogation: object(["accusedStatement", "complainantRebuttal", "witnessStatements", "contradictions"], {
        accusedStatement: text(), complainantRebuttal: text(), witnessStatements: array(text()), contradictions: array(text())
      }),
      referral: object(["investigationConclusion", "fictionalCharge", "referralOpinion", "prosecutionDecision", "coreIssues"], {
        investigationConclusion: text(), fictionalCharge: text(), referralOpinion: text(), prosecutionDecision: text(), coreIssues: array(text())
      }),
      settlement: object(["openingDemand", "counterOffer", "mediatorRecommendation", "result", "reason"], {
        openingDemand: text(), counterOffer: text(), mediatorRecommendation: text(), result: text(), reason: text()
      }),
      trial: object(["prosecutionOpening", "defenseOpening", "evidenceArguments", "witnessExamination", "judgeQuestions", "closingStatements"], {
        prosecutionOpening: text(), defenseOpening: text(),
        evidenceArguments: array(object(["evidence", "prosecution", "defense"], { evidence: text(), prosecution: text(), defense: text() })),
        witnessExamination: array(object(["question", "answer", "courtReaction"], { question: text(), answer: text(), courtReaction: text() })),
        judgeQuestions: array(text()), closingStatements: text()
      }),
      judgment: object(["recognizedFacts", "liabilityRatio", "order", "sentence", "reasoning", "afterStory"], {
        recognizedFacts: array(text()), liabilityRatio: text(), order: text(), sentence: text(), reasoning: text(), afterStory: text()
      })
    }
  );
}

async function withTimeout(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Gemini 응답 시간 초과")), REQUEST_TIMEOUT_MS); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function parseResponse(response) {
  const reason = String(response?.candidates?.[0]?.finishReason || "UNKNOWN");
  if (response?.promptFeedback?.blockReason || reason === "SAFETY") throw new SafetyInputError("가벼운 일상 소재만 접수할 수 있습니다.");
  const raw = String(response?.text || "").trim();
  if (!raw) throw new Error(`Gemini 응답 비어 있음(${reason})`);
  return JSON.parse(raw);
}

async function generateCase(apiKey, incident, severity) {
  const { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } = await loadSdk();
  const anchors = extractAnchors(incident);
  const prompt = [
    `최초 접수 문장: ${incident}`,
    `반드시 끝까지 유지할 핵심 소재: ${anchors.join(", ")}`,
    severityText(severity),
    "위 문장을 하나의 가상 사건으로 확장하라. 사용자가 선택하는 분기 없이 모든 절차를 자동으로 진행하라.",
    "합의·조정은 실제 협상처럼 요구안, 반대안, 조정권고, 결과와 결렬 또는 성립 이유를 구체적으로 작성하라.",
    "재판 공방은 동일 증거를 두고 검사와 변호인이 다르게 해석하도록 작성하라."
  ].join("\n");
  const safetySettings = [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT
  ].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));
  const ai = new GoogleGenAI({ apiKey });
  const response = await withTimeout(ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: buildSchema(Type),
      safetySettings,
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0.86,
      topP: 0.94,
      maxOutputTokens: 8000
    }
  }));
  const anchored = anchorCase(parseResponse(response), incident, anchors);
  const audit = auditCase(anchored);
  if (!audit.ok) throw new Error(`V6 구조 검사 실패: ${audit.issues.join(", ")}`);
  return anchored;
}

function safeLogMessage(error) {
  return String(error?.message || error || "unknown").replace(/AIza[0-9A-Za-z_-]{15,}/g, "[redacted]").replace(/\s+/g, " ").slice(0, 180);
}

exports.generateCourtCaseV6 = onRequest(
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
    if (req.method !== "POST") return res.status(405).json({ error: "POST 요청만 허용됩니다." });
    if (!CLIENTS.has(String(req.headers["x-sosoking-client"] || ""))) return res.status(400).json({ error: "올바르지 않은 사건 접수 요청입니다." });
    if (isRateLimited(clientIp(req))) return res.status(429).json({ error: "사건기록실이 과로 중입니다. 잠시 뒤 다시 접수해주세요." });
    const input = validateInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    try {
      const apiKey = String(GEMINI_API_KEY.value() || "").trim();
      if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
      const courtCase = await generateCase(apiKey, input.incident, input.severity);
      return res.status(200).json({ case: courtCase, meta: { source: "gemini", model: MODEL, version: "automatic-story-v6", stored: false } });
    } catch (error) {
      const isSafety = error instanceof SafetyInputError;
      logger.error("generateCourtCaseV6 failed", { type: isSafety ? "safety" : "generation", message: safeLogMessage(error), incidentLength: input.incident.length, severity: input.severity });
      if (isSafety) return res.status(400).json({ error: error.message });
      return res.status(200).json({ case: fallbackCase(input.incident, input.severity), meta: { source: "grounded-fallback", model: MODEL, version: "automatic-story-v6", stored: false } });
    }
  }
);
