"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 28000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;
const buckets = new Map();
const SEVERITIES = new Set(["official", "special", "national"]);
const CLIENTS = new Set(["court-v2", "court-v3", "court-v4"]);
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
const REAL_INSTITUTIONS = ["대법원", "헌법재판소", "검찰청", "경찰청", "국가정보원", "국무총리실", "대통령실", "국립과학수사연구원"];
const REAL_LEGAL_TERMS = ["형법", "민법", "사기죄", "절도죄", "재물손괴", "재산 손괴", "중대 범죄", "법 제"];
const PERSON_WITH_TITLE = /(?:[김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구신민진지엄채원천방공현함염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용][가-힣]{1,2}\s*(?:경정|경감|경위|경사|검사|판사|변호사)|(?:재판장|대변인)\s*[김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구신민진지엄채원천방공현함염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용][가-힣]{1,2})/;
const PRIVATE_PATTERNS = [
  /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/,
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
  /https?:\/\/|www\./i,
  /\b\d{6}[ -]?[1-4]\d{6}\b/,
  /\b(?:\d[ -]?){13,19}\b/,
  /\b\d{2,3}[가-힣]\d{4}\b/,
  /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{0,20}(로|길|동)\s*\d+/
];
const TOKEN_STOPWORDS = new Set([
  "내", "내가", "나는", "나를", "나의", "우리", "제가", "저는", "그냥", "진짜", "너무", "조금", "약간", "정말",
  "오늘", "어제", "아까", "또", "자꾸", "말없이", "몰래", "갑자기", "그리고", "그런데", "그래서", "때문에",
  "친구", "동생", "형", "누나", "언니", "오빠", "가족", "엄마", "아빠", "회사", "집", "사람", "누가",
  "했다", "했는데", "했지만", "하였다", "있었다", "없었다", "됐다", "되었다", "한다", "하는", "하고", "해서",
  "먹었다", "샀다", "늦었다", "남았다", "사라졌다", "가져갔다", "돌려줬다", "보냈다", "읽었다", "말했다", "안했다"
]);
const PARTICLE_SUFFIXES = [
  "으로부터", "에게서는", "에게서", "한테서", "에서는", "으로는", "까지는", "부터는", "에게는", "한테는",
  "이라도", "라도", "으로", "에서", "에게", "한테", "처럼", "보다", "까지", "부터", "께서", "하고", "이며",
  "으로도", "에서도", "에도", "만은", "만을", "만이", "만", "은", "는", "이", "가", "을", "를", "의", "에", "도", "와", "과", "로"
].sort((a, b) => b.length - a.length);

const SYSTEM_PROMPT = `당신은 한국어 참여형 코미디 서비스 '소문난 판결소'의 수석 사건작가다.
사용자의 아주 사소하고 유치한 일상을 대형 특수사건처럼 확대해, 읽는 과정 자체가 재미있는 수사기록과 재판기록을 만든다.

가장 중요한 원칙은 '접수 내용과의 연결'이다.
- 사용자가 적은 핵심 물건, 장소, 시간, 행동을 다른 일반 소재로 바꾸지 않는다.
- 사건명, 요약, 증거, 감식, 심문, 브리핑, 판결이 모두 같은 사건을 다뤄야 한다.
- 핵심 소재 단어는 표현을 바꾸거나 추상화하지 말고 여러 단계에서 그대로 반복한다.
- 엉뚱한 소품은 곁가지 농담으로만 추가하고, 사건의 핵심 물건과 행동을 밀어내지 않는다.
- '현장 미세흔적', '관련 물품', '사소한 행동' 같은 범용 문구만으로 내용을 채우지 않는다.

핵심 웃음 원리:
- 사건은 하찮고 수사 태도는 국가 비상사태처럼 엄숙하다.
- 작은 행동 하나 때문에 초동출동, 상황실, 잠복근무, 압수수색, 가상 감식기관, 공개브리핑, 법정공방까지 동원한다.
- 절차마다 구체적인 장비, 시간, 인력, 보고서 문구, 쓸데없는 발견, 현장요원의 한마디를 넣는다.
- 농담을 설명하지 말고 공문서·작전일지·감정서·증거봉투·브리핑 문답의 형식으로 보여준다.
- 같은 농담을 반복하지 말고 단계마다 새로운 코미디 장치를 사용한다.
- 심각한 정신적 충격이나 사회 붕괴보다 자·전자저울·통제선·압수봉투·마이크 개수 같은 눈에 보이는 디테일로 웃긴다.

안전 및 세계관 원칙:
- 사람 이름은 절대 만들지 않는다. 제보자, 피해자, 피고, 친구, 가족, 동료, 수사본부 대변인 같은 역할명만 쓴다.
- 실제 경찰 계급, 검사·판사 이름, 실제 법률명과 실제 정부·수사·사법기관 이름을 사용하지 않는다.
- '국가과잉수사연구소', '생활질서 특수본', '소문동 현장감식반' 같은 명백한 가상 패러디 기관만 사용한다.
- 실제 범죄명 대신 '한입범위 과잉침범', '간식주권 교란', '응답대기 방치' 같은 허구의 혐의를 만든다.
- 폭력, 성적 피해, 학대, 자해, 죽음, 중대한 범죄는 코미디로 만들지 않는다.
- 혐오, 비속어, 외모·성별·지역·장애 조롱을 사용하지 않는다.

출력 원칙:
- 사건명은 접수 내용의 핵심 소재를 포함하고 반드시 '사건'으로 끝낸다.
- summary는 원문의 사실관계를 분명히 다시 말한다.
- evidence 4개 중 최소 2개는 핵심 물건이나 행동을 제목과 설명에서 직접 다룬다.
- forensicReports 3개 중 최소 2개는 핵심 물건 또는 그 주변의 구체적인 시료를 분석한다.
- questions 3개 중 최소 2개는 원문의 행동·시간·물건을 직접 묻는다.
- briefing headline과 statement는 사건 핵심 소재를 반드시 포함한다.
- verdicts 3개 중 최소 2개는 핵심 물건의 배상·복구 또는 핵심 행동의 재발방지를 구체적으로 명령한다.
- 출동일지는 정확히 4개, 투입부서는 정확히 4개다.
- 감식보고서는 정확히 3개, 증거물은 정확히 4개다.
- 심문은 정확히 3개, 판결과 재판관 성향은 각각 정확히 3개다.
- questions의 speaker는 질문에 답하는 '피고' 또는 '피고인'이다. response는 피고의 답변이다.
- questions의 replySpeaker는 '신문관', '검사', '변호인', '판사', '재판장' 중 하나이며 reply는 그 답변에 대한 정색한 반응이다.
- 각 문자열은 한두 문장으로 짧고 선명하게 쓰며 JSON을 반드시 끝까지 완성한다.`;

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
  if (BLOCKED.some((term) => incident.includes(term))) return { error: "실제 심각한 피해나 범죄는 코미디 수사로 만들 수 없습니다." };
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
    official: "정식 수사: 동네 생활질서 사건인데도 전담반과 상황판을 운영한다. 과장은 현실보다 5배 정도다.",
    special: "특별 수사: 합동수사본부, 잠복팀, 감식팀, 브리핑룸을 모두 동원한다. 과장은 현실보다 20배다.",
    national: "국가급 대응: 전국 유사사례 집계와 가상 비상대책본부까지 가동한다. 아무도 요청하지 않았지만 과장은 100배다."
  }[severity];
}

function normalized(value) {
  return String(value || "").replace(/[\s.,!?"'“”‘’()[\]{}:;·-]/g, "").toLowerCase();
}

function stemIncidentToken(raw) {
  let token = String(raw || "").replace(/[^0-9A-Za-z가-힣]/g, "");
  if (token.length < 2) return "";
  for (const suffix of PARTICLE_SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 2) {
      token = token.slice(0, -suffix.length);
      break;
    }
  }
  if (/^(안|못|그|이|저)$/.test(token)) return "";
  if (/(했다|했는데|했지만|하였다|있었다|없었다|됐다|되었다|먹었다|샀다|늦었다|남았다|사라졌다|가져갔다|돌려줬다|보냈다|읽었다|말했다|넣어둔|꺼냈다|가졌다|버렸다|왔다|갔다|줬다|않았다)$/.test(token)) return "";
  return token;
}

function extractIncidentAnchors(incident) {
  const rawTokens = String(incident || "").split(/\s+/).map(stemIncidentToken).filter(Boolean);
  const preferred = rawTokens.filter((token) => !TOKEN_STOPWORDS.has(token));
  const pool = preferred.length >= 2 ? preferred : rawTokens;
  const uniqueTokens = [...new Set(pool)];
  return uniqueTokens
    .sort((a, b) => {
      const numberDiff = Number(/\d/.test(b)) - Number(/\d/.test(a));
      if (numberDiff) return numberDiff;
      return b.length - a.length;
    })
    .slice(0, 5);
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

function anchorsInText(value, anchors) {
  const text = normalized(collectStrings(value).join(" "));
  return anchors.filter((anchor) => text.includes(normalized(anchor)));
}

function connectedItemCount(items, anchors) {
  if (!Array.isArray(items)) return 0;
  return items.filter((item) => anchorsInText(item, anchors).length > 0).length;
}

function sanitizeText(value) {
  let text = String(value || "");
  const roleNamePattern = new RegExp(PERSON_WITH_TITLE.source, "g");
  text = text.replace(roleNamePattern, (match) => {
    if (match.includes("대변인")) return "생활질서 특수본 대변인";
    if (match.includes("재판장") || match.includes("판사")) return "재판장";
    if (match.includes("검사")) return "검사";
    if (match.includes("변호사")) return "변호인";
    return "현장지휘관";
  });
  text = text.replace(/[가-힣]{1,15}법\s*제?\s*\d+조(?:\s*제?\s*\d+항)?/g, "소문동 생활질서 절차규정 0-0호");
  const replacements = [
    [/국립과학수사연구원/g, "국가과잉수사연구소"],
    [/대법원|헌법재판소/g, "소문동 최고판결회의"],
    [/경찰청|검찰청/g, "생활질서 특별수사본부"],
    [/국가정보원|국무총리실|대통령실/g, "범일상대책상황실"],
    [/형법/g, "생활질서 자체규정"],
    [/민법/g, "관계평온 자체규정"],
    [/사기죄/g, "설명과장 혐의"],
    [/절도죄/g, "소유권 경계침범 혐의"],
    [/재물손괴|재산 손괴/g, "물품상태 무단변경 혐의"],
    [/중대 범죄/g, "중대해 보이는 생활사건"],
    [/법\s*제/g, "자체규정 "],
    [/경정|경감|경위|경사/g, "현장지휘관"]
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, " ").trim();
}

function sanitizeCourtCase(value) {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeCourtCase);
  if (!value || typeof value !== "object") return value;
  const data = {};
  for (const [key, item] of Object.entries(value)) data[key] = sanitizeCourtCase(item);
  if (Array.isArray(data.questions)) {
    const reactionSpeakers = ["신문관", "검사", "재판장"];
    data.questions = data.questions.map((item, index) => ({
      ...item,
      speaker: "피고",
      replySpeaker: ["신문관", "검사", "변호인", "판사", "재판장"].includes(String(item?.replySpeaker || ""))
        ? item.replySpeaker
        : reactionSpeakers[index % reactionSpeakers.length]
    }));
  }
  if (data.briefing && typeof data.briefing === "object") data.briefing.spokesperson = "생활질서 특수본 대변인";
  if (!String(data.judge || "").trim() || String(data.judge).length < 20 || PERSON_WITH_TITLE.test(String(data.judge))) {
    data.judge = "행위 자체보다 해명과 과잉수사에 더 많은 인력이 투입됐다는 점을 종합하면, 모두가 조금씩 책임을 나누는 것이 타당합니다.";
  }
  return data;
}

function auditCourtCase(data, anchors = []) {
  const issues = [];
  if (!data || typeof data !== "object") return { ok: false, issues: ["객체 아님"] };
  if (!String(data.title || "").endsWith("사건")) issues.push("사건명 끝맺음");
  const exactCounts = { taskForceUnits: 4, dispatchLog: 4, forensicReports: 3, evidence: 4, questions: 3, verdicts: 3, judgeTypes: 3 };
  for (const [key, count] of Object.entries(exactCounts)) {
    if (!Array.isArray(data[key]) || data[key].length !== count) issues.push(`${key} 개수`);
  }
  for (const key of ["surveillance", "search", "briefing"]) {
    if (!data[key] || typeof data[key] !== "object") issues.push(`${key} 누락`);
  }
  const allText = collectStrings(data).join(" ");
  if (containsPrivateData(allText)) issues.push("개인정보 형태");
  if (REAL_INSTITUTIONS.some((term) => allText.includes(term))) issues.push("실제 기관명");
  if (REAL_LEGAL_TERMS.some((term) => allText.includes(term))) issues.push("실제 법률·범죄 표현");
  if (PERSON_WITH_TITLE.test(allText)) issues.push("인명·실제 계급 형태");
  if (String(data.judge || "").length < 20) issues.push("재판장 의견 부족");
  if (!String(data.briefing?.spokesperson || "").includes("대변인")) issues.push("대변인 역할 누락");
  if (Array.isArray(data.questions)) {
    const answerSpeakers = new Set(["피고", "피고인"]);
    const reactionSpeakers = new Set(["신문관", "검사", "변호인", "판사", "재판장"]);
    if (data.questions.some((item) => !answerSpeakers.has(String(item?.speaker || "")))) issues.push("심문 답변자 역할");
    if (data.questions.some((item) => !reactionSpeakers.has(String(item?.replySpeaker || "")))) issues.push("심문 반응자 역할");
  }
  if (Array.isArray(data.evidence) && !unique(data.evidence.map((item) => item?.title))) issues.push("증거 중복");
  if (Array.isArray(data.forensicReports) && !unique(data.forensicReports.map((item) => item?.sample))) issues.push("감식 중복");
  if (Array.isArray(data.questions) && !unique(data.questions.map((item) => item?.question))) issues.push("심문 중복");
  if (Array.isArray(data.verdicts)) {
    if (!unique(data.verdicts.map((item) => item?.title))) issues.push("판결 중복");
    if (!unique(data.verdicts.map((item) => item?.afterStory))) issues.push("후일담 중복");
  }
  if (normalized(data.prosecution) === normalized(data.defense)) issues.push("공방 동일");

  if (anchors.length) {
    const neededSummaryAnchors = Math.min(2, anchors.length);
    if (anchorsInText(data.title, anchors).length < 1) issues.push("접수 소재 사건명 미반영");
    if (anchorsInText(data.summary, anchors).length < neededSummaryAnchors) issues.push("접수 소재 요약 미반영");
    if (connectedItemCount(data.evidence, anchors) < 2) issues.push("접수 소재 증거 연결 부족");
    if (connectedItemCount(data.forensicReports, anchors) < 2) issues.push("접수 소재 감식 연결 부족");
    if (connectedItemCount(data.questions, anchors) < 2) issues.push("접수 소재 심문 연결 부족");
    if (anchorsInText(data.briefing, anchors).length < 1) issues.push("접수 소재 브리핑 미반영");
    if (connectedItemCount(data.verdicts, anchors) < 2) issues.push("접수 소재 판결 연결 부족");
  }
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
    [
      "title", "subtitle", "charge", "summary", "damages", "commandCenter", "operationName", "emergencyGrade",
      "scale", "impact", "taskForceUnits", "dispatchLog", "surveillance", "forensicReports", "search", "evidence",
      "questions", "briefing", "prosecution", "defense", "judge", "verdicts", "judgeTypes"
    ],
    {
      title: text(), subtitle: text(), charge: text(), summary: text(), damages: text(), commandCenter: text(),
      operationName: text(), emergencyGrade: text(), scale: text(), impact: text(),
      taskForceUnits: { type: Type.ARRAY, items: text() },
      dispatchLog: {
        type: Type.ARRAY,
        items: object(["time", "unit", "action", "note"], { time: text(), unit: text(), action: text(), note: text() })
      },
      surveillance: object(
        ["location", "duration", "disguise", "observation", "unexpected"],
        { location: text(), duration: text(), disguise: text(), observation: text(), unexpected: text() }
      ),
      forensicReports: {
        type: Type.ARRAY,
        items: object(
          ["sample", "method", "finding", "unnecessaryConclusion"],
          { sample: text(), method: text(), finding: text(), unnecessaryConclusion: text() }
        )
      },
      search: object(
        ["warrant", "target", "seizedItems", "officerNote"],
        { warrant: text(), target: text(), seizedItems: { type: Type.ARRAY, items: text() }, officerNote: text() }
      ),
      evidence: {
        type: Type.ARRAY,
        items: object(
          ["label", "title", "detail", "significance"],
          { label: text(), title: text(), detail: text(), significance: text() }
        )
      },
      questions: {
        type: Type.ARRAY,
        items: object(
          ["question", "speaker", "response", "replySpeaker", "reply"],
          { question: text(), speaker: text(), response: text(), replySpeaker: text(), reply: text() }
        )
      },
      briefing: object(
        ["headline", "spokesperson", "statement", "reporterQuestion", "answer"],
        { headline: text(), spokesperson: text(), statement: text(), reporterQuestion: text(), answer: text() }
      ),
      prosecution: text(), defense: text(), judge: text(),
      verdicts: {
        type: Type.ARRAY,
        items: object(["title", "sentence", "afterStory"], { title: text(), sentence: text(), afterStory: text() })
      },
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

async function generate(apiKey, incident, severity, anchors, correction = "") {
  const { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } = await loadSdk();
  const ai = new GoogleGenAI({ apiKey });
  const prompt = [
    `제보 원문: ${incident}`,
    `핵심 소재 단어(철자 그대로 반복 사용): ${anchors.join(", ")}`,
    severityText(severity),
    "원문의 등장 물건, 장소, 시간, 행동을 유지하고 오직 수사 규모와 행정 절차만 과장하라.",
    "사건명·요약·증거·감식·심문·브리핑·판결이 서로 다른 사건처럼 흩어지지 않게 하나의 연속된 수사기록으로 작성하라.",
    "증거 제목과 감식 시료에는 핵심 소재 단어를 직접 넣고, 판결은 그 물건의 배상·복구 또는 그 행동의 재발방지를 구체적으로 명령하라.",
    correction ? `이전 결과의 다음 품질 문제를 모두 수정하라: ${correction}` : ""
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
      temperature: 0.78,
      topP: 0.9,
      maxOutputTokens: 7500
    }
  }));
  return parseResponse(response);
}

async function generateAndAudit(apiKey, incident, severity) {
  const anchors = extractIncidentAnchors(incident);
  let result = sanitizeCourtCase(await generate(apiKey, incident, severity, anchors));
  let audit = auditCourtCase(result, anchors);
  if (!audit.ok) {
    logger.warn("investigation case quality retry", { issues: audit.issues, anchors, incidentLength: incident.length, severity });
    result = sanitizeCourtCase(await generate(apiKey, incident, severity, anchors, audit.issues.join(", ")));
    audit = auditCourtCase(result, anchors);
  }
  if (!audit.ok) throw new Error(`사건 품질 검사 실패: ${audit.issues.join(", ")}`);
  return { result, anchors };
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
    if (!CLIENTS.has(String(req.headers["x-sosoking-client"] || ""))) return res.status(400).json({ error: "올바르지 않은 사건 접수 요청입니다." });
    if (Number(req.headers["content-length"] || 0) > 4096) return res.status(413).json({ error: "사건 접수 내용이 너무 큽니다." });
    if (isRateLimited(clientIp(req))) return res.status(429).json({ error: "수사본부가 과로 중입니다. 잠시 뒤 다시 접수해주세요." });

    const input = validateInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });

    try {
      const apiKey = String(GEMINI_API_KEY.value() || "").trim();
      if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
      const { result: courtCase, anchors } = await generateAndAudit(apiKey, input.incident, input.severity);
      return res.status(200).json({
        case: courtCase,
        meta: { source: "gemini", model: MODEL, version: "investigation-v5-relevance", anchors, thinking: false, stored: false }
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
        error: isSafety ? error.message : "AI 수사본부가 현재 사건기록을 작성하지 못했습니다."
      });
    }
  }
);