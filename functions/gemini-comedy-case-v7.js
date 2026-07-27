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
const CLIENTS = new Set(["court-v7"]);
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
const BANNED_CLICHES = [
  "마이크 7개", "3.7cm", "관심 없던 참고인", "도구는 끝까지 진술을 거부",
  "모두가 해당 물건만 바라봤", "사건보다 수사 인원이 더 놀라웠",
  "사건은 작지만", "기록이 너무 두꺼워", "관련 물건은 당시 약간 당황"
];
const BEAT_KEYS = ["intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"];

const SYSTEM_PROMPT = `당신은 한국어 코미디 서비스 '소문난 판결소'의 수석 코미디 작가이자 사건 시나리오 작가다.
사용자는 짧은 일상 문장 한 줄만 입력하고, 이후에는 아무 선택 없이 사건 접수부터 판결 이후까지 읽는다.

목표는 '절차를 나열하는 글'이 아니라 하나의 코미디 에피소드를 만드는 것이다.
사건은 반드시 동일한 소재와 사실관계를 유지하며 사건 접수, 초동수사, 과잉수사, 진술조사, 송치·기소, 합의·조정, 재판 공방, 판결과 후일담 순서로 자동 진행한다.

코미디 설계 규칙:
- 먼저 comicProfile에 중심 오해, 반복 개그, 단계별 확대 규칙, 마지막 콜백을 설계한다.
- 모든 절차는 이 설계를 실제 내용 속에 자연스럽게 반영한다.
- 웃음은 사소한 사실의 문자 그대로 해석, 쓸데없이 정확한 수치와 절차, 인물별 다른 말투, 앞 장면의 콜백에서 만든다.
- 피해자는 감정적이지만 구체적이고, 피의자는 계속 축소 표현을 쓰며, 수사관은 말을 문자 그대로 해석하고, 조정위원은 지쳐 있고, 재판장은 무표정하게 핵심을 찌른다.
- 각 comicBeats는 해당 단계 마지막의 짧고 강한 펀치라인이며 서로 다른 방식으로 웃겨야 한다.
- 최초 입력의 물건, 행동, 시간, 약속, 장소를 처음부터 끝까지 계속 사용한다.
- 입력 문장을 단순 반복하지 말고 가상 정황, 측정값, 증거, 진술, 반박과 협상 결렬 사유를 구체적으로 만든다.
- 실제 사람 이름, 실제 기관명, 실제 법률명은 사용하지 않는다.
- 가상 기관과 가상 혐의는 명백한 패러디여야 한다.
- 폭력, 성적 피해, 학대, 자해, 죽음, 혐오를 코미디로 만들지 않는다.
- 모든 문자열은 짧고 선명하게 쓰되 내용은 사건별로 구체적이어야 한다.

금지되는 상투 문구:
${BANNED_CLICHES.map((item) => `- ${item}`).join("\n")}
위 문구와 비슷한 고정 템플릿을 재사용하지 말고 입력 사건에 맞는 새로운 장면을 만든다.`;

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
    official: "정식 사건: 현실적인 절차를 유지하되 한 장면마다 최소 한 번은 웃음 포인트를 만든다.",
    special: "특별 사건: 잠복·감식·합동수사·브리핑을 모두 동원하고 반복 개그를 세 번 이상 회수한다.",
    national: "국가급 사건: 가상 대책본부와 전국 유사사례까지 확대하되 사건 자체의 사소함이 계속 대비되게 한다."
  }[severity];
}

function stripParticle(token) {
  return token
    .replace(/[^0-9A-Za-z가-힣]/g, "")
    .replace(/(으로부터|에게서|까지는|에서는|으로는|라는|이라고|하고도|보다도|처럼|에게|한테|부터|까지|으로|에서|께서|이랑|하고|라도|조차|마저|밖에|마다|보다|이든|든지|이라|라고|이며|이고|은|는|이|가|을|를|에|의|와|과|도|만|로)$/g, "")
    .trim();
}

function extractAnchors(incident) {
  const tokens = incident.split(/\s+/).map(stripParticle).filter(Boolean);
  const anchors = [];
  for (const token of tokens) {
    if (token.length < 2 || STOPWORDS.has(token)) continue;
    if (/^(먹었다|남았다|사라졌다|늦었다|샀다|안샀다|넣어뒀다|두었다|했다)$/.test(token)) continue;
    if (!anchors.includes(token)) anchors.push(token);
  }
  return anchors.slice(0, 5).length ? anchors.slice(0, 5) : [incident.slice(0, 12)];
}

function flattenStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenStrings);
  return [];
}

function ensureAnchor(text, anchor, prefix) {
  const value = String(text || "").trim();
  return value.includes(anchor) ? value : `${prefix} ${anchor}을 중심으로 ${value}`.trim();
}

function anchorCase(data, incident, anchors) {
  const primary = anchors[0];
  const result = JSON.parse(JSON.stringify(data || {}));
  result.originalIncident = incident;
  result.anchors = anchors;
  result.title = ensureAnchor(result.title, primary, "");
  if (!String(result.title).endsWith("사건")) result.title = `${result.title} 사건`;
  result.caseSummary = `최초 접수는 “${incident}”였다. ${String(result.caseSummary || "").trim()}`;
  result.intake ||= {};
  result.intake.complaint = incident;
  result.intake.complainantStatement = ensureAnchor(result.intake.complainantStatement, primary, "피해자는");
  result.initialInvestigation ||= {};
  result.initialInvestigation.sceneControl = ensureAnchor(result.initialInvestigation.sceneControl, primary, "초동팀은");
  result.interrogation ||= {};
  result.interrogation.accusedStatement = ensureAnchor(result.interrogation.accusedStatement, primary, "피의자는");
  result.settlement ||= {};
  result.settlement.openingDemand = ensureAnchor(result.settlement.openingDemand, primary, "피해자 측은");
  result.trial ||= {};
  result.trial.prosecutionOpening = ensureAnchor(result.trial.prosecutionOpening, primary, "검사는");
  result.judgment ||= {};
  result.judgment.order = ensureAnchor(result.judgment.order, primary, "재판부는");
  result.judgment.afterStory = ensureAnchor(result.judgment.afterStory, primary, "판결 집행 뒤");
  return result;
}

function classifyIncident(incident) {
  if (/(아이스크림|치킨|푸딩|커피|라면|빵|간식|과자|음식|먹|마시|한입|냉장고)/.test(incident)) return "food";
  if (/(늦|지각|시간|분|약속|기다)/.test(incident)) return "time";
  if (/(사라|없어|잃어|리모컨|충전기|우산|이어폰|열쇠|물건)/.test(incident)) return "missing";
  if (/(답장|읽씹|단톡|메시지|사진|카톡|연락)/.test(incident)) return "message";
  if (/(설거지|청소|업무|회의|퇴근|요청|정리)/.test(incident)) return "work";
  return "general";
}

function fallbackBlueprint(category, primary, secondary) {
  const shared = {
    centralMisread: `수사본부는 ${primary}에 관한 짧은 불만을 생활질서 기반시설 붕괴의 전조로 해석했다.`,
    runningGag: `${primary}의 객관적 기준`,
    escalationRule: "누군가 별일 아니라고 말할 때마다 서류가 두 장씩 늘어난다.",
    finalCallback: `${primary}의 기준을 정하는 과정에서 기준 자체가 다시 분쟁이 된다.`,
    title: `${primary} 객관적 기준 긴급확정`,
    charge: `${primary} 기대치 무단변경 및 사후설명 지연 혐의`,
    measurements: [`${primary}의 원래 상태를 세 가지 가정으로 복원`, "당사자 표정이 굳은 시간을 초 단위로 기록", "사건 전후 대화의 단어 길이를 비교"],
    evidence2: `${secondary || primary} 정황 기록`,
    surveillance: `${primary} 재발을 확인하려고 현장을 지켰으나 수사팀이 먼저 지쳐 교대 규정만 새로 만들었다.`,
    forensic1: { target: `${primary} 핵심 흔적`, method: "각도별 촬영과 크기 비교", finding: "양측 기억보다 실제 차이는 작지만 감정 차이는 큼", unnecessaryConclusion: "물리적 크기와 서운함의 크기는 비례하지 않음" },
    settlementDemand: `${primary} 원상복구와 공개 사과 1회`,
    counterOffer: `${primary} 복구는 수용하되 공개 사과는 목소리 크기 30%로 제한`,
    mediator: `${primary} 복구, 24시간 재언급 금지, 다음 유사 상황 사전 질문`,
    settlementReason: "공개의 범위를 거실까지로 볼지 단체대화방까지로 볼지 합의하지 못했다.",
    order: `${primary}을 원상에 가깝게 복구하고 다음 사용 전 한 문장으로 허락을 구한다.`,
    sentence: `${primary} 관련 변명에 접속사 ‘근데’를 7일간 사용하지 못한다.`,
    afterStory: `${primary} 복구 완료 사진의 촬영 각도를 두고 재심 신청이 접수됐다.`
  };
  if (category === "food") return {
    ...shared,
    centralMisread: "수사본부는 ‘한입’을 일상어가 아닌 부피 단위로 보고 긴급 표준화에 착수했다.",
    runningGag: "한입의 법정 정의",
    escalationRule: "피의자가 ‘진짜 한입’이라고 말할 때마다 측정 장비가 하나씩 추가된다.",
    finalCallback: "배상 음식의 첫 한입 권리를 정하는 순간 동일한 분쟁이 재발한다.",
    title: `${primary} 한입 허용범위 초과`,
    charge: `${primary} 한입범위 무단확장 및 잔여량 급감 혐의`,
    measurements: [`${primary} 훼손 면적을 입구 폭·깊이·후회 정도로 분리 측정`, "사건 당시 녹거나 식은 시간을 10초 단위로 역산", "피해자가 예상한 한입과 실제 한입을 종이 모형으로 비교"],
    evidence2: `${secondary || "포장지"}와 사용 도구의 위치`,
    surveillance: "냉장고 앞 잠복팀은 물을 마시는 척 23회 문을 열었고 정작 피의자보다 냉장고 경보음에 먼저 적발됐다.",
    forensic1: { target: `${primary} 절단면`, method: "곡률·깊이·잔여량 3축 분석", finding: "통상적 한입보다 야심이 컸던 흔적 확인", unnecessaryConclusion: "입은 하나였으나 계획은 두입에 가까웠음" },
    settlementDemand: `${primary} 3개 배상과 피해자 우선 한입권`,
    counterOffer: "동일 제품 1개와 ‘생각보다 부드러웠다’는 해명",
    mediator: `${primary} 2개 배상, 첫 한입권 보장, ‘한입만’ 표현 14일 금지`,
    settlementReason: "피의자가 한입권은 인정했지만 한입의 깊이 상한선을 끝내 받아들이지 않았다.",
    order: `${primary} 2개를 배상하고 개봉 후 첫 접촉권을 피해자에게 보장한다.`,
    sentence: "냉장고 접근 전 ‘먹어도 돼?’를 완전한 문장으로 말할 의무 14일",
    afterStory: `배상된 ${primary}의 첫 한입이 너무 작다는 이유로 피의자가 역으로 피해를 주장했다.`
  };
  if (category === "time") return {
    ...shared,
    centralMisread: "수사본부는 지각 시간을 분 단위가 아니라 상대방이 혼자 메뉴판을 읽은 횟수로 계산했다.",
    runningGag: `사라진 ${primary}의 행방`,
    escalationRule: "피의자가 ‘거의 다 왔다’고 말할 때마다 실제 거리가 늘어난다.",
    finalCallback: "판결 집행 시간에도 다시 늦어 시간 자체가 증인으로 채택된다.",
    title: `${primary} 행방불명 및 빈손 도착`,
    charge: `약속시간 증발·도착예고 과장 및 ${secondary || "보상"} 미지참 혐의`,
    measurements: ["양측 휴대전화 시계를 동시에 맞춘 뒤 지각 구간 재측정", "‘거의 다 왔다’ 메시지 발송 지점과 실제 위치 비교", `${secondary || "보상 물품"} 구매 가능 매장 6곳을 동선과 대조`],
    evidence2: `${secondary || "보상"}가 끝내 나타나지 않은 빈손 사진`,
    surveillance: "약속 장소 잠복팀은 피의자를 기다리다 먼저 지각 사유를 세 가지 만들어냈고 그중 두 개가 피의자 해명과 겹쳤다.",
    forensic1: { target: "도착예정 메시지", method: "문장과 실제 거리의 상관관계 분석", finding: "‘5분’은 평균 17분 40초로 사용됨", unnecessaryConclusion: "피의자에게 5분은 시간 단위가 아니라 희망사항임" },
    settlementDemand: `${secondary || "커피"} 2회 제공과 다음 약속 15분 선도착`,
    counterOffer: `${secondary || "커피"} 1회 제공, 선도착은 3분까지만 인정`,
    mediator: "다음 약속 10분 선도착, 도착예정 메시지에 현재 위치 첨부",
    settlementReason: "피의자가 ‘출발했다’의 기준을 현관문 통과가 아니라 마음먹은 시점이라고 주장했다.",
    order: `다음 두 번의 약속에 10분 먼저 도착하고 ${secondary || "보상 음료"}를 준비한다.`,
    sentence: "도착 전 ‘거의 다 왔다’ 문구 사용 금지 30일",
    afterStory: "판결 이행 첫날 피의자는 10분 일찍 도착했지만 약속 장소를 잘못 찾아 별도 사건이 접수됐다."
  };
  if (category === "missing") return {
    ...shared,
    centralMisread: `수사본부는 ${primary} 분실을 물건의 자발적 잠적으로 보고 마지막 목격 동선을 추적했다.`,
    runningGag: `${primary}의 묵비권`,
    escalationRule: `수색 범위가 넓어질수록 ${primary}은 처음 장소와 가까워진다.`,
    finalCallback: `찾은 ${primary}을 누가 원래 자리에 두지 않았는지를 두고 2차 수사가 시작된다.`,
    title: `${primary} 장기잠적 및 위치진술 거부`,
    charge: `${primary} 보관위치 은폐와 공동사용질서 교란 혐의`,
    measurements: [`${primary} 마지막 목격 좌표를 가구 모서리 기준으로 복원`, "배터리·먼지·손자국으로 이동 시점 추정", "소파 틈과 책상 아래의 수색 우선순위 작성"],
    evidence2: `${secondary || "마지막 사용자"}의 기억이 서로 다른 위치를 지목한 진술`,
    surveillance: `수색팀은 소파 주변을 잠복 감시했지만 쿠션만 네 차례 이동했고 ${primary}은 끝까지 태연했다.`,
    forensic1: { target: `${primary} 표면`, method: "먼지층과 손자국 방향 분석", finding: "최근 이동 뒤 뒤집힌 채 방치된 흔적", unnecessaryConclusion: `${primary}은 발견될 의지가 매우 낮았음` },
    settlementDemand: `${primary} 전용 보관구역 지정과 사용 후 사진 인증`,
    counterOffer: "보관구역은 인정하되 사진 인증은 주 1회로 제한",
    mediator: `${primary} 형광 스티커 부착, 마지막 사용자 이니셜 기록`,
    settlementReason: "스티커 색상을 형광 노랑으로 할지 품위를 지킨 회색으로 할지 결론을 내지 못했다.",
    order: `${primary} 전용 위치를 지정하고 사용 종료 후 30초 안에 반환한다.`,
    sentence: `${primary} 분실 신고 전 소파 틈 확인 의무 21일`,
    afterStory: `${primary}은 찾았지만 전용 위치 표지판이 사라져 수사본부가 즉시 재소집됐다.`
  };
  return shared;
}

function fallbackCase(incident, severity) {
  const anchors = extractAnchors(incident);
  const primary = anchors[0];
  const secondary = anchors[1] || "";
  const b = fallbackBlueprint(classifyIncident(incident), primary, secondary);
  const staffing = { official: "9명", special: "24명", national: "61명" }[severity];
  const beats = {
    intake: `신고는 한 줄이었지만 접수번호는 신고보다 세 글자 길었다. ${b.runningGag}이 첫 쟁점으로 등록됐다.`,
    initialInvestigation: "현장 통제선 안에 들어간 사람은 없었고 나오는 사람만 계속 늘었다.",
    overInvestigation: `${b.escalationRule} 수사본부는 이 규칙을 문제 해결책이 아니라 인력 증원 사유로 사용했다.`,
    interrogation: "피의자의 ‘그 정도는 아니다’라는 말에서 재판부는 ‘그 정도’의 정확한 수치를 요구했다.",
    referral: "사건보다 송치 상자가 먼저 대형 분류를 받았다.",
    settlement: "양측은 거의 합의했으나 ‘거의’의 의미를 두고 다시 갈라졌다.",
    trial: "검사와 변호인은 같은 사진을 들고 서로 반대 방향을 가리켰다.",
    judgment: b.finalCallback
  };
  return anchorCase({
    comicProfile: { centralMisread: b.centralMisread, runningGag: b.runningGag, escalationRule: b.escalationRule, finalCallback: b.finalCallback },
    comicBeats: beats,
    title: `${b.title} 사건`,
    subtitle: "한 줄의 불만이 8단계 사건기록이 된 경위",
    fictionalCharge: b.charge,
    caseSummary: `${incident}라는 신고를 접수한 생활질서 수사본부가 ${b.runningGag}을 공식 쟁점으로 삼으면서 사건이 걷잡을 수 없이 커졌다.`,
    intake: {
      complaint: incident,
      complainantStatement: `피해자는 ${primary} 자체보다 ‘이 정도면 괜찮겠지’라는 태도가 더 문제라고 진술했다.`,
      accusedInitialPosition: "피의자는 사실관계 일부를 인정하면서도 ‘말이 그렇게 커질 일은 아니다’라고 진술해 스스로 사건을 키웠다.",
      assignedUnit: `${primary} 특별사건 전담반 ${staffing} 및 기록정리요원 1명`
    },
    initialInvestigation: {
      sceneControl: `${primary} 주변을 보존하고 당사자가 기억하는 원래 상태를 서로 다른 색 테이프로 표시했다.`,
      measurements: b.measurements,
      witnessChecks: ["사건 직전 마지막 정상 상태를 본 사람 조사", "피의자의 최초 해명을 들은 사람 조사", "사건 후 단체대화방에서 가장 먼저 웃은 사람 조사"],
      evidence: [
        { title: `${primary} 현장 상태`, detail: `${incident} 직후 모습을 여러 각도에서 기록했다.`, meaning: "피해자가 말한 변화가 실제로 있었는지 확인" },
        { title: b.evidence2, detail: `${secondary || primary}의 위치와 시간대를 사건 흐름에 맞춰 재구성했다.`, meaning: "행위 범위와 사후 태도를 함께 판단" },
        { title: "최초 해명 문장", detail: "피의자의 첫 해명과 10분 뒤 해명에서 형용사가 달라졌다.", meaning: "책임을 줄이려는 표현 변화 확인" },
        { title: "사건 후 반응 기록", detail: "사과보다 웃음표시가 먼저 전송된 시점이 확인됐다.", meaning: "사후 태도에 관한 보조 정황" }
      ]
    },
    overInvestigation: {
      taskForce: `${primary} 합동과잉수사본부가 꾸려졌고 사건 설명보다 조직도가 더 오래 걸렸다.`,
      surveillance: b.surveillance,
      forensicReports: [
        b.forensic1,
        { target: `${secondary || primary} 관련 흔적`, method: "시간대별 위치 재구성과 사용흔적 비교", finding: "당사자 진술 사이에 설명되지 않는 공백 확인", unnecessaryConclusion: "공백은 짧았지만 해명은 길었음" },
        { target: "최초 해명 음성", method: "말끝 흐림 정도와 접속사 사용량 분석", finding: "책임이 커질수록 ‘근데’ 사용 빈도가 증가", unnecessaryConclusion: "피의자의 방어 전략은 내용보다 접속사에 의존함" }
      ],
      searchAndSeizure: `${primary} 주변 보관공간에 가상 확인영장을 집행하고 사건과 무관한 쿠폰 한 장도 ‘동기 가능성’으로 봉인했다.`,
      publicBriefing: `대변인은 ${b.runningGag}을 핵심 쟁점으로 발표했으나 기자들은 왜 대변인이 필요한지부터 질문했다.`
    },
    interrogation: {
      accusedStatement: `피의자는 ${primary} 관련 행동은 인정하지만 피해자가 기억하는 규모는 과장됐다고 주장했다.`,
      complainantRebuttal: "피해자는 규모보다 사전 허락과 사후 태도가 핵심이라며 피의자의 축소 표현을 하나씩 바로잡았다.",
      witnessStatements: ["참고인은 사건 직후 피의자가 먼저 주변 반응을 살폈다고 진술했다.", `다른 참고인은 ${b.runningGag}이 평소에도 농담처럼 반복됐다고 진술했다.`],
      contradictions: ["최초에는 즉시 인정했으나 조사실에서는 정확히 기억나지 않는다고 변경", "허용 범위를 설명하는 표현이 조사마다 달라짐", "사과했다고 주장했으나 기록에는 해명이 먼저 남아 있음"]
    },
    referral: {
      investigationConclusion: `${primary} 관련 기본 행위와 사후 해명 변화는 확인됐으며 핵심은 허용 범위와 복구 의사다.`,
      fictionalCharge: b.charge,
      referralOpinion: `${b.runningGag} 판단을 위해 소문동 생활질서 심사부에 가상 기소 의견으로 송치`,
      prosecutionDecision: "심사부는 사건의 크기보다 반복 개그의 증거가 충분하다고 보고 공판을 열기로 했다.",
      coreIssues: [`${b.runningGag}의 객관적 의미`, "피의자가 허용 범위를 알았는지", "사후 복구 제안이 진심이었는지"]
    },
    settlement: {
      openingDemand: b.settlementDemand,
      counterOffer: b.counterOffer,
      mediatorRecommendation: b.mediator,
      result: "수량에는 접근했으나 문구 하나를 두고 최종 서명이 보류됐다.",
      reason: b.settlementReason
    },
    trial: {
      prosecutionOpening: `검사는 ${primary}의 물리적 피해보다 ${b.runningGag}을 알고도 축소해서 말한 태도를 문제 삼았다.`,
      defenseOpening: "변호인은 피해가 복구 가능하고 당사자 사이의 평소 관행을 고려해야 한다고 반박했다.",
      evidenceArguments: [
        { evidence: `${primary} 현장 상태`, prosecution: "허용 범위를 넘긴 결과가 눈에 보인다.", defense: "원래 상태를 촬영한 자료가 없어 정확한 비교는 어렵다." },
        { evidence: "최초 해명 문장", prosecution: "형용사가 바뀐 것은 책임 축소 시도다.", defense: "당황해서 표현을 고른 것뿐이다." },
        { evidence: b.runningGag, prosecution: "피의자도 반복 쟁점의 의미를 알고 있었다.", defense: "농담을 법정 기준으로 바꾸는 것은 과도하다." }
      ],
      witnessExamination: [
        { question: "사건 직후 피의자가 가장 먼저 한 말은 무엇입니까?", answer: "정확히는 기억나지 않지만 사과는 아니었습니다.", courtReaction: "재판부는 기억나지 않는 부분보다 사과가 아니었다는 부분을 또렷하게 기록했다." },
        { question: `${b.runningGag}이라는 표현을 이전에도 들었습니까?`, answer: "농담처럼 여러 번 들었습니다.", courtReaction: "재판부는 농담이 반복되면 생활규칙이 될 수 있는지 검토하기 시작했다." },
        { question: "지금 합의가 가능한가요?", answer: "가능하지만 상대가 먼저 정확한 기준을 인정해야 합니다.", courtReaction: "재판부는 양측이 해결보다 정의에 더 관심이 있다고 판단했다." }
      ],
      judgeQuestions: [`${b.runningGag}을 숫자나 행동으로 설명할 수 있습니까?`, "지금 이 자리에서 복구하면 사건이 끝납니까, 아니면 표현 문제로 계속됩니까?"],
      closingStatements: "검사는 기준 회복을, 변호인은 즉시 복구를 요청했다. 피의자는 마지막까지 ‘그렇게까지는’이라고 말해 재판장이 ‘어디까지인지’를 다시 물었다."
    },
    judgment: {
      recognizedFacts: [`${primary} 관련 행위가 실제로 발생함`, "피의자의 해명이 조사 과정에서 축소 방향으로 바뀜", "피해자가 기대한 허용 범위도 사전에 완전히 수치화되지는 않음"],
      liabilityRatio: "피의자 75% · 피해자 25% 기준설명 미흡",
      order: b.order,
      sentence: b.sentence,
      reasoning: `재판부는 ${b.runningGag}이 사전에 완벽히 정해지지 않았더라도 상대방의 기대를 알았으면 확인할 의무가 있다고 판단했다.`,
      afterStory: b.afterStory
    }
  }, incident, anchors);
}

function auditCase(data, incident, anchors) {
  const issues = [];
  const requiredObjects = ["comicProfile", "comicBeats", "intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"];
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
  for (const key of ["centralMisread", "runningGag", "escalationRule", "finalCallback"]) {
    if (String(data?.comicProfile?.[key] || "").length < 12) issues.push(`comicProfile.${key}`);
  }
  const beats = BEAT_KEYS.map((key) => String(data?.comicBeats?.[key] || "").trim());
  if (beats.some((beat) => beat.length < 12)) issues.push("comicBeats 길이");
  if (new Set(beats).size !== beats.length) issues.push("comicBeats 중복");
  const allText = flattenStrings(data).join(" ");
  if (BANNED_CLICHES.some((phrase) => allText.includes(phrase))) issues.push("상투 문구");
  const stageTexts = [data?.intake, data?.initialInvestigation, data?.overInvestigation, data?.interrogation, data?.referral, data?.settlement, data?.trial, data?.judgment].map((stage) => flattenStrings(stage).join(" "));
  if (stageTexts.filter((text) => anchors.some((anchor) => text.includes(anchor))).length < 6) issues.push("접수 소재 연결");
  if (!allText.includes(String(data?.comicProfile?.runningGag || ""))) issues.push("반복 개그 미사용");
  if (!String(data?.judgment?.afterStory || "").includes(anchors[0])) issues.push("후일담 소재");
  if (!String(data?.intake?.complaint || "").includes(incident)) issues.push("원문 보존");
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
  const comicBeatProperties = Object.fromEntries(BEAT_KEYS.map((key) => [key, text()]));
  return object(
    ["comicProfile", "comicBeats", "title", "subtitle", "fictionalCharge", "caseSummary", "intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"],
    {
      comicProfile: object(["centralMisread", "runningGag", "escalationRule", "finalCallback"], { centralMisread: text(), runningGag: text(), escalationRule: text(), finalCallback: text() }),
      comicBeats: object(BEAT_KEYS, comicBeatProperties),
      title: text(), subtitle: text(), fictionalCharge: text(), caseSummary: text(),
      intake: object(["complaint", "complainantStatement", "accusedInitialPosition", "assignedUnit"], { complaint: text(), complainantStatement: text(), accusedInitialPosition: text(), assignedUnit: text() }),
      initialInvestigation: object(["sceneControl", "measurements", "witnessChecks", "evidence"], { sceneControl: text(), measurements: array(text()), witnessChecks: array(text()), evidence: array(object(["title", "detail", "meaning"], { title: text(), detail: text(), meaning: text() })) }),
      overInvestigation: object(["taskForce", "surveillance", "forensicReports", "searchAndSeizure", "publicBriefing"], { taskForce: text(), surveillance: text(), forensicReports: array(object(["target", "method", "finding", "unnecessaryConclusion"], { target: text(), method: text(), finding: text(), unnecessaryConclusion: text() })), searchAndSeizure: text(), publicBriefing: text() }),
      interrogation: object(["accusedStatement", "complainantRebuttal", "witnessStatements", "contradictions"], { accusedStatement: text(), complainantRebuttal: text(), witnessStatements: array(text()), contradictions: array(text()) }),
      referral: object(["investigationConclusion", "fictionalCharge", "referralOpinion", "prosecutionDecision", "coreIssues"], { investigationConclusion: text(), fictionalCharge: text(), referralOpinion: text(), prosecutionDecision: text(), coreIssues: array(text()) }),
      settlement: object(["openingDemand", "counterOffer", "mediatorRecommendation", "result", "reason"], { openingDemand: text(), counterOffer: text(), mediatorRecommendation: text(), result: text(), reason: text() }),
      trial: object(["prosecutionOpening", "defenseOpening", "evidenceArguments", "witnessExamination", "judgeQuestions", "closingStatements"], { prosecutionOpening: text(), defenseOpening: text(), evidenceArguments: array(object(["evidence", "prosecution", "defense"], { evidence: text(), prosecution: text(), defense: text() })), witnessExamination: array(object(["question", "answer", "courtReaction"], { question: text(), answer: text(), courtReaction: text() })), judgeQuestions: array(text()), closingStatements: text() }),
      judgment: object(["recognizedFacts", "liabilityRatio", "order", "sentence", "reasoning", "afterStory"], { recognizedFacts: array(text()), liabilityRatio: text(), order: text(), sentence: text(), reasoning: text(), afterStory: text() })
    }
  );
}

async function withTimeout(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Gemini 응답 시간 초과")), REQUEST_TIMEOUT_MS); })]);
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
    `끝까지 유지할 핵심 소재: ${anchors.join(", ")}`,
    severityText(severity),
    "comicProfile을 먼저 설계한 뒤 전체 사건기록에 반복 개그와 콜백을 심어라.",
    "각 comicBeats는 오해, 구체적 수치, 인물 말투, 절차의 역전, 협상 말꼬리, 증거의 이중해석, 무표정한 재판장, 마지막 콜백처럼 서로 다른 웃음 방식이어야 한다.",
    "합의·조정은 실제 협상처럼 요구안, 반대안, 조정권고, 결과와 결렬 또는 성립 이유를 구체적으로 작성하라.",
    "재판 공방은 동일 증거를 두고 검사와 변호인이 정반대로 해석하게 하라.",
    "최후진술과 판결 이후에는 앞에서 만든 runningGag을 정확히 회수하라."
  ].join("\n");
  const safetySettings = [HarmCategory.HARM_CATEGORY_HARASSMENT, HarmCategory.HARM_CATEGORY_HATE_SPEECH, HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));
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
      temperature: 1.02,
      topP: 0.96,
      maxOutputTokens: 9000
    }
  }));
  const anchored = anchorCase(parseResponse(response), incident, anchors);
  const audit = auditCase(anchored, incident, anchors);
  if (!audit.ok) throw new Error(`V7 코미디 검사 실패: ${audit.issues.join(", ")}`);
  return anchored;
}

function safeLogMessage(error) {
  return String(error?.message || error || "unknown").replace(/AIza[0-9A-Za-z_-]{15,}/g, "[redacted]").replace(/\s+/g, " ").slice(0, 220);
}

exports.generateCourtCaseV7 = onRequest(
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
      return res.status(200).json({ case: courtCase, meta: { source: "gemini", model: MODEL, version: "comedy-engine-v7", stored: false } });
    } catch (error) {
      const isSafety = error instanceof SafetyInputError;
      logger.error("generateCourtCaseV7 failed", { type: isSafety ? "safety" : "generation", message: safeLogMessage(error), incidentLength: input.incident.length, severity: input.severity });
      if (isSafety) return res.status(400).json({ error: error.message });
      return res.status(200).json({ case: fallbackCase(input.incident, input.severity), meta: { source: "grounded-comedy-fallback", model: MODEL, version: "comedy-engine-v7", stored: false } });
    }
  }
);