"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 48000;
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
const REAL_INSTITUTIONS = ["대법원", "헌법재판소", "검찰청", "경찰청", "국가정보원", "대통령실"];
const STALE_PHRASES = new Map([
  ["마이크 7개", "발표자보다 많은 녹음기"],
  ["3.7cm", "손가락 한 마디보다 조금 짧은 거리"],
  ["관심 없던 참고인", "사건이 끝난 줄 알고 있던 참고인"],
  ["도구는 끝까지 진술을 거부", "도구에서는 의미 있는 진술을 확보하지 못함"],
  ["사건은 작지만", "분쟁의 크기와 별개로"],
  ["기록이 너무 두꺼워", "사건명보다 첨부목록이 길어"]
]);
const BEAT_KEYS = ["intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"];

const SYSTEM_PROMPT = `당신은 한국어 코미디 서비스 '소문난 판결소'의 수석 작가다.
사용자의 짧은 일상 문장 한 줄을 선택 없이 읽는 완결된 사건 에피소드로 확장한다.

절차는 사건접수 → 초동수사 → 잠복·감식·압수수색 → 진술조사 → 송치·가상기소 → 합의·조정 → 재판공방 → 판결·후일담 순서다.
모든 절차는 최초 입력의 같은 물건, 행동, 시간과 약속을 다뤄야 한다.

먼저 comicProfile을 설계한다.
- centralMisread: 수사본부가 신고를 문자 그대로 받아들여 생긴 중심 오해
- runningGag: 전체 기록에서 정확히 같은 문구로 세 번 이상 돌아오는 반복 쟁점
- escalationRule: 진행할수록 상황이 커지는 규칙
- finalCallback: 첫 장면의 쟁점이 판결 후 반대로 돌아오는 결말

comicBeats에는 8개 절차의 마지막 한 줄을 쓴다. 같은 농담을 바꿔 말하지 말고 각각 다른 방식으로 웃긴다.
피해자는 구체적으로 서운해하고, 피의자는 축소 표현을 쓰고, 수사관은 말을 문자 그대로 해석하고, 조정위원은 말꼬리 다툼에 지쳐 있으며, 재판장은 무표정하게 정확한 기준을 요구한다.
웃음은 사건에만 가능한 측정값, 예상 밖 잠복 실패, 말의 정의를 둘러싼 협상, 동일 증거의 정반대 해석, 앞 장면의 콜백에서 만든다.
실제 이름·기관·법률을 쓰지 말고 명백한 가상 패러디 용어만 쓴다.
폭력·성적 피해·학대·자해·죽음·혐오를 코미디로 만들지 않는다.
JSON을 끝까지 완성한다.`;

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

function validateInput(body) {
  const incident = typeof body?.incident === "string" ? body.incident.replace(/\s+/g, " ").trim() : "";
  const severity = typeof body?.severity === "string" ? body.severity : "official";
  if (incident.length < 7 || incident.length > 120) return { error: "사건 내용은 7자 이상 120자 이하로 입력해주세요." };
  if (!SEVERITIES.has(severity)) return { error: "올바르지 않은 사건 확대 수준입니다." };
  if (BLOCKED.some((term) => incident.includes(term))) return { error: "실제 심각한 피해나 범죄는 코미디 사건으로 만들 수 없습니다." };
  if (PRIVATE_PATTERNS.some((pattern) => pattern.test(incident))) return { error: "전화번호·이메일·주소·차량번호 등 개인정보를 삭제해주세요." };
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

function hasBatchim(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  const code = value.charCodeAt(value.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
}

function particle(text, consonant, vowel) {
  return hasBatchim(text) ? consonant : vowel;
}

function replaceStale(text) {
  let value = String(text || "");
  for (const [from, to] of STALE_PHRASES) value = value.replaceAll(from, to);
  for (const institution of REAL_INSTITUTIONS) value = value.replaceAll(institution, "생활질서 가상심사부");
  return value.trim();
}

function deepClean(value) {
  if (typeof value === "string") return replaceStale(value);
  if (Array.isArray(value)) return value.map(deepClean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepClean(item)]));
  return value;
}

function detectCase(incident) {
  const duration = incident.match(/\d+\s*분/)?.[0]?.replace(/\s+/g, "") || "";
  const food = incident.match(/아이스크림|치킨(?:\s*다리)?|푸딩|커피|라면|빵|과자|간식|케이크|피자|햄버거|떡볶이/)?.[0] || "";
  const missingObject = incident.match(/리모컨|충전기|우산|이어폰|열쇠|카드|지갑|안경|휴대폰|마우스|펜/)?.[0] || "";
  const timeCase = Boolean(duration || /(지각|늦|약속|기다)/.test(incident));
  const missingCase = Boolean(missingObject && /(사라|없|분실|잃|어디)/.test(incident));
  const foodCase = Boolean(food && /(먹|마시|한입|남|안 샀|안샀|가져)/.test(incident));
  if (timeCase) {
    return { category: "time", primary: duration || "지각시간", secondary: incident.includes("커피") ? "커피" : "약속", anchors: [duration || "지각", incident.includes("커피") ? "커피" : "약속"] };
  }
  if (missingCase) return { category: "missing", primary: missingObject, secondary: "마지막 사용자", anchors: [missingObject, "분실"] };
  if (foodCase) return { category: "food", primary: food || "간식", secondary: incident.includes("한입") ? "한입" : "잔여량", anchors: [food || "간식", incident.includes("한입") ? "한입" : "잔여량"] };
  if (/(답장|읽씹|단톡|메시지|사진|카톡|연락)/.test(incident)) return { category: "message", primary: incident.match(/답장|단톡|메시지|사진|카톡|연락/)?.[0] || "메시지", secondary: "응답시간", anchors: ["메시지", "응답"] };
  const words = incident.replace(/[.,!?]/g, "").split(/\s+/).filter((word) => word.length > 1 && !/내가|나는|저는|우리|친구|가족|동생|회사|너무|그냥|정말/.test(word));
  const primary = words.find((word) => !/(했다|먹었다|사라졌다|늦었다|안샀다|샀다)/.test(word)) || "생활질서";
  return { category: "general", primary, secondary: words[1] || "기대범위", anchors: [primary, words[1] || "기대범위"] };
}

function defaultProfile(info) {
  const p = info.primary;
  if (info.category === "food") return {
    centralMisread: `수사본부는 ‘${info.secondary}’을 일상어가 아니라 부피 단위로 해석했다.`,
    runningGag: `${info.secondary}의 법정 정의`,
    escalationRule: `피의자가 ‘정말 ${info.secondary}’이라고 말할 때마다 측정 장비가 하나씩 추가된다.`,
    finalCallback: `배상된 ${p}의 첫 ${info.secondary} 권리를 정하는 순간 같은 분쟁이 반대로 재발한다.`
  };
  if (info.category === "time") return {
    centralMisread: `수사본부는 ${p} 지각을 시간이 아니라 기다린 사람이 메뉴판을 읽은 횟수로 환산했다.`,
    runningGag: `‘거의 다 왔다’의 실제 거리`,
    escalationRule: "피의자가 거의 다 왔다고 말할 때마다 지도상 거리가 늘어난다.",
    finalCallback: `판결 이행일에도 피의자가 늦어 ${p} 자체가 증인으로 채택된다.`
  };
  if (info.category === "missing") return {
    centralMisread: `수사본부는 ${p} 분실을 물건의 자발적 잠적으로 판단했다.`,
    runningGag: `${p}의 묵비권`,
    escalationRule: `수색 범위가 넓어질수록 ${p}은 마지막 목격 장소에 가까워진다.`,
    finalCallback: `찾아낸 ${p}의 전용 보관표지판이 다시 사라져 2차 수사가 시작된다.`
  };
  return {
    centralMisread: `수사본부는 ${p} 관련 불만을 생활질서 기반시설 붕괴의 전조로 해석했다.`,
    runningGag: `${p}의 객관적 기준`,
    escalationRule: "누군가 별일 아니라고 말할 때마다 사건기록이 두 장씩 늘어난다.",
    finalCallback: `${p}의 기준을 정하는 과정에서 기준 자체가 새로운 분쟁이 된다.`
  };
}

function defaultBeats(info, profile) {
  return {
    intake: `신고는 한 줄이었지만 접수번호는 신고보다 길었다. ${profile.runningGag}${particle(profile.runningGag, "이", "가")} 첫 쟁점이 됐다.`,
    initialInvestigation: "현장 통제선 안으로 들어간 사람은 없었고 나오는 사람만 계속 늘었다.",
    overInvestigation: `${profile.escalationRule} 수사본부는 이를 해결책이 아니라 인력 증원 사유로 사용했다.`,
    interrogation: "피의자가 ‘그 정도’라고 말하자 조사관은 그 정도가 몇 정도인지 수치로 답하라고 요구했다.",
    referral: "사건보다 송치 상자가 먼저 대형 분류를 받았다.",
    settlement: "양측은 거의 합의했지만 ‘거의’의 뜻을 두고 다시 갈라졌다.",
    trial: "검사와 변호인은 같은 사진을 제출하고 서로 반대 방향을 가리켰다.",
    judgment: profile.finalCallback
  };
}

function ensureText(value, fallback) {
  const text = replaceStale(value);
  return text || fallback;
}

function ensureList(value, count, fallback) {
  const items = Array.isArray(value) ? value.map(replaceStale).filter(Boolean) : [];
  while (items.length < count) items.push(fallback(items.length));
  return items.slice(0, count);
}

function ensureObjectList(value, count, fallback) {
  const items = Array.isArray(value) ? value.filter((item) => item && typeof item === "object").map(deepClean) : [];
  while (items.length < count) items.push(fallback(items.length));
  return items.slice(0, count);
}

function fallbackCase(incident, severity, info = detectCase(incident)) {
  const p = info.primary;
  const s = info.secondary;
  const profile = defaultProfile(info);
  const beats = defaultBeats(info, profile);
  const teamSize = { official: 9, special: 24, national: 61 }[severity];
  const food = info.category === "food";
  const time = info.category === "time";
  const missing = info.category === "missing";
  const title = food ? `${p} ${s} 허용범위 초과 사건` : time ? `${p} 행방불명 및 ${s} 미지참 사건` : missing ? `${p} 장기잠적 및 위치진술 거부 사건` : `${p} 객관적 기준 긴급확정 사건`;
  const surveillance = food
    ? `냉장고 앞 잠복팀은 물을 마시는 척 문을 반복해서 열다가 피의자보다 냉장고 경보음에 먼저 적발됐다.`
    : time
      ? `약속 장소 잠복팀은 피의자를 기다리는 동안 지각 사유를 세 가지 만들었고 그중 두 개가 실제 해명과 겹쳤다.`
      : missing
        ? `수색팀은 ${p}이 움직이는지 지켜봤지만 주변 물건만 네 차례 옮겨졌고 ${p}은 끝까지 발견될 의지를 보이지 않았다.`
        : `${p} 재발을 관찰하던 잠복팀은 사건보다 교대시간을 더 정확히 기록했다.`;
  const settlementDemand = food ? `${p} 3개 배상과 피해자 우선 ${s}권` : time ? `${s} 2회 제공과 다음 약속 10분 선도착` : missing ? `${p} 전용 보관구역과 사용 후 사진 인증` : `${p} 원상복구와 공개 사과`;
  const counterOffer = food ? `동일 ${p} 1개와 ‘생각보다 부드러웠다’는 해명` : time ? `${s} 1회 제공, 선도착은 3분까지만 인정` : missing ? "보관구역은 인정하되 사진 인증은 주 1회로 제한" : `${p} 복구는 수용하되 공개 사과는 작은 목소리로 제한`;
  const recommendation = food ? `${p} 2개 배상, 첫 ${s}권 보장, ‘${s}만’ 표현 14일 금지` : time ? `다음 약속 10분 선도착, 도착예정 메시지에 현재 위치 첨부, ${s} 준비` : missing ? `${p} 형광표지 부착과 마지막 사용자 이니셜 기록` : `${p} 복구와 다음 사용 전 사전 질문`;
  const settlementReason = food ? `피의자가 ${s}권은 인정했지만 ${s}의 깊이 상한선을 받아들이지 않았다.` : time ? "피의자가 ‘출발했다’의 기준을 현관문 통과가 아니라 마음먹은 시점이라고 주장했다." : missing ? "표지 색상을 형광색으로 할지 품위를 지킨 회색으로 할지 결론을 내지 못했다." : "공개의 범위를 거실까지로 볼지 단체대화방까지로 볼지 합의하지 못했다.";
  const order = food ? `${p} 2개를 배상하고 개봉 후 첫 ${s}권을 피해자에게 보장한다.` : time ? `다음 두 번의 약속에 10분 먼저 도착하고 ${s}를 준비한다.` : missing ? `${p} 전용 위치를 지정하고 사용 종료 후 30초 안에 반환한다.` : `${p}을 복구하고 다음 사용 전 완전한 문장으로 허락을 구한다.`;
  const sentence = food ? `냉장고 접근 전 ‘먹어도 돼?’를 완전한 문장으로 말할 의무 14일` : time ? "도착 전 ‘거의 다 왔다’ 문구 사용 금지 30일" : missing ? `${p} 분실 신고 전 소파 틈 확인 의무 21일` : "변명에 접속사 ‘근데’를 7일간 사용하지 못한다.";
  const afterStory = profile.finalCallback;
  return {
    originalIncident: incident,
    anchors: info.anchors,
    comicProfile: profile,
    comicBeats: beats,
    title,
    subtitle: "한 줄의 불만이 반복 개그를 거쳐 판결까지 간 경위",
    fictionalCharge: `${p} 기대범위 무단변경 및 사후설명 지연 혐의`,
    caseSummary: `“${incident}”라는 신고를 접수한 수사본부가 ${profile.runningGag}${particle(profile.runningGag, "을", "를")} 공식 쟁점으로 삼으며 사건이 확대됐다.`,
    intake: {
      complaint: incident,
      complainantStatement: `피해자는 ${p} 자체보다 상대가 대수롭지 않게 넘긴 태도가 더 문제라고 진술했다.`,
      accusedInitialPosition: "피의자는 일부 사실을 인정하면서도 ‘말이 그렇게 커질 일은 아니다’라고 진술해 사건을 키웠다.",
      assignedUnit: `${p} 특별사건 전담반 ${teamSize}명과 기록정리요원 1명`
    },
    initialInvestigation: {
      sceneControl: `${p} 주변을 보존하고 양측이 기억하는 원래 상태를 서로 다른 색 테이프로 표시했다.`,
      measurements: [
        food ? `${p} 변화량을 폭·깊이·피해자의 한숨 길이로 나눠 측정` : time ? `${p}을 양측 휴대전화 시계로 다시 측정` : missing ? `${p} 마지막 목격 좌표를 가구 모서리 기준으로 복원` : `${p}의 원래 상태를 세 가지 가정으로 복원`,
        time ? "‘거의 다 왔다’ 메시지 발송 지점과 실제 위치 비교" : "당사자의 표정이 굳은 시간을 초 단위로 기록",
        `${s} 관련 사건 전후 대화의 형용사와 접속사 수 비교`
      ],
      witnessChecks: ["사건 직전 마지막 정상 상태를 본 사람 조사", "피의자의 최초 해명을 들은 사람 조사", "사건 후 가장 먼저 웃음표시를 보낸 사람 조사"],
      evidence: [
        { title: `${p} 현장 상태`, detail: `${incident} 직후 모습을 여러 각도에서 기록했다.`, meaning: "신고 내용의 실제 변화 확인" },
        { title: `${s} 관련 정황`, detail: `${s}의 위치와 시간대를 사건 흐름에 맞춰 재구성했다.`, meaning: "행위 범위와 사후 태도 판단" },
        { title: "최초 해명 문장", detail: "첫 해명과 10분 뒤 해명에서 형용사가 달라졌다.", meaning: "책임 축소 표현 확인" },
        { title: "사건 후 반응", detail: "사과보다 웃음표시가 먼저 전송됐다.", meaning: "사후 태도 판단" }
      ]
    },
    overInvestigation: {
      taskForce: `${p} 합동과잉수사본부가 꾸려졌고 사건 설명보다 조직도 작성이 더 오래 걸렸다.`,
      surveillance,
      forensicReports: [
        { target: `${p} 핵심 흔적`, method: food ? "곡률·깊이·잔여량 3축 분석" : time ? "메시지와 실제 거리 상관분석" : missing ? "먼지층과 손자국 방향 분석" : "각도별 촬영과 크기 비교", finding: food ? `통상적인 ${s}보다 야심이 컸던 흔적` : time ? "‘5분’이 평균 17분대 희망사항으로 사용됨" : missing ? "최근 이동 뒤 뒤집힌 채 방치된 흔적" : "물리적 차이는 작지만 감정 차이는 큼", unnecessaryConclusion: food ? `입은 하나였지만 계획은 두 ${s}에 가까웠음` : time ? "피의자에게 시간은 단위보다 희망사항에 가까움" : missing ? `${p}은 발견될 의지가 매우 낮았음` : "크기와 서운함은 비례하지 않음" },
        { target: `${s} 주변 정황`, method: "시간대별 위치 재구성과 사용흔적 비교", finding: "당사자 진술 사이에 설명되지 않는 공백 확인", unnecessaryConclusion: "공백은 짧았지만 해명은 길었음" },
        { target: "최초 해명 음성", method: "말끝 흐림과 접속사 사용량 분석", finding: "책임이 커질수록 ‘근데’ 사용 증가", unnecessaryConclusion: "방어 전략이 내용보다 접속사에 의존함" }
      ],
      searchAndSeizure: `${p} 주변 보관공간에 가상 확인영장을 집행하고 무관한 쿠폰도 동기 가능성으로 봉인했다.`,
      publicBriefing: `대변인은 ${profile.runningGag}${particle(profile.runningGag, "을", "를")} 핵심 쟁점으로 발표했으나 기자들은 왜 대변인이 필요한지부터 물었다.`
    },
    interrogation: {
      accusedStatement: `피의자는 ${p} 관련 행동은 인정하지만 피해자가 기억하는 규모는 과장됐다고 주장했다.`,
      complainantRebuttal: "피해자는 규모보다 사전 허락과 사후 태도가 핵심이라며 축소 표현을 하나씩 바로잡았다.",
      witnessStatements: ["참고인은 피의자가 사건 직후 주변 반응을 먼저 살폈다고 진술했다.", `다른 참고인은 ${profile.runningGag}${particle(profile.runningGag, "이", "가")} 평소에도 농담처럼 반복됐다고 진술했다.`],
      contradictions: ["최초에는 인정했지만 조사실에서는 정확히 기억나지 않는다고 변경", "허용 범위를 설명하는 표현이 조사마다 달라짐", "사과했다고 주장했지만 기록에는 해명이 먼저 남음"]
    },
    referral: {
      investigationConclusion: `${p} 관련 기본 행위와 해명 변화가 확인됐으며 핵심은 허용 범위와 복구 의사다.`,
      fictionalCharge: `${p} 기대범위 무단변경 혐의`,
      referralOpinion: `${profile.runningGag} 판단을 위해 소문동 생활질서 심사부에 가상 기소 의견으로 송치`,
      prosecutionDecision: "심사부는 물리적 피해보다 반복 쟁점과 사후 태도의 증거가 충분하다고 보고 공판을 열기로 했다.",
      coreIssues: [profile.runningGag, "피의자가 허용 범위를 알고 있었는지", "사후 복구 제안이 진심이었는지"]
    },
    settlement: {
      openingDemand: settlementDemand,
      counterOffer,
      mediatorRecommendation: recommendation,
      result: "양측은 수량에는 접근했지만 문구 하나를 두고 최종 서명을 보류했다.",
      reason: settlementReason
    },
    trial: {
      prosecutionOpening: `검사는 ${p}의 물리적 피해보다 ${profile.runningGag}${particle(profile.runningGag, "을", "를")} 알고도 축소해서 말한 태도를 문제 삼았다.`,
      defenseOpening: "변호인은 피해가 복구 가능하고 당사자 사이의 평소 관행을 고려해야 한다고 반박했다.",
      evidenceArguments: [
        { evidence: `${p} 현장 상태`, prosecution: "허용 범위를 넘긴 결과가 눈에 보인다.", defense: "원래 상태를 촬영한 자료가 없어 정확한 비교는 어렵다." },
        { evidence: "최초 해명 문장", prosecution: "형용사가 바뀐 것은 책임 축소 시도다.", defense: "당황해서 표현을 고른 것뿐이다." },
        { evidence: profile.runningGag, prosecution: "피의자도 반복 쟁점의 의미를 알고 있었다.", defense: "농담을 법정 기준으로 바꾸는 것은 과도하다." }
      ],
      witnessExamination: [
        { question: "사건 직후 피의자가 가장 먼저 한 말은 무엇입니까?", answer: "정확히는 기억나지 않지만 사과는 아니었습니다.", courtReaction: "재판부는 기억나지 않는 부분보다 사과가 아니었다는 부분을 또렷하게 기록했다." },
        { question: `${profile.runningGag}${particle(profile.runningGag, "을", "를")} 이전에도 들었습니까?`, answer: "농담처럼 여러 번 들었습니다.", courtReaction: "재판부는 반복된 농담이 생활규칙이 될 수 있는지 검토하기 시작했다." },
        { question: "지금 합의가 가능한가요?", answer: "가능하지만 상대가 먼저 정확한 기준을 인정해야 합니다.", courtReaction: "재판부는 양측이 해결보다 정의에 더 관심이 있다고 판단했다." }
      ],
      judgeQuestions: [`${profile.runningGag}${particle(profile.runningGag, "을", "를")} 숫자나 행동으로 설명할 수 있습니까?`, "지금 이 자리에서 복구하면 사건이 끝납니까, 아니면 표현 문제로 계속됩니까?"],
      closingStatements: "검사는 기준 회복을, 변호인은 즉시 복구를 요청했다. 피의자는 마지막까지 ‘그렇게까지는’이라고 말해 재판장이 ‘어디까지인지’를 다시 물었다."
    },
    judgment: {
      recognizedFacts: [`${p} 관련 행위가 실제로 발생함`, "피의자의 해명이 조사 과정에서 축소 방향으로 바뀜", "피해자가 기대한 허용 범위도 사전에 완전히 수치화되지는 않음"],
      liabilityRatio: "피의자 75% · 피해자 25% 기준설명 미흡",
      order,
      sentence,
      reasoning: `재판부는 ${profile.runningGag}${particle(profile.runningGag, "이", "가")} 완벽히 정해지지 않았더라도 상대의 기대를 알았으면 확인할 의무가 있다고 판단했다.`,
      afterStory
    }
  };
}

function normalizeCase(raw, incident, severity, info) {
  const fallback = fallbackCase(incident, severity, info);
  const data = deepClean(raw && typeof raw === "object" ? raw : {});
  const result = { ...fallback, ...data };
  result.originalIncident = incident;
  result.anchors = info.anchors;
  result.comicProfile = {
    centralMisread: ensureText(data.comicProfile?.centralMisread, fallback.comicProfile.centralMisread),
    runningGag: ensureText(data.comicProfile?.runningGag, fallback.comicProfile.runningGag),
    escalationRule: ensureText(data.comicProfile?.escalationRule, fallback.comicProfile.escalationRule),
    finalCallback: ensureText(data.comicProfile?.finalCallback, fallback.comicProfile.finalCallback)
  };
  result.comicBeats = Object.fromEntries(BEAT_KEYS.map((key) => [key, ensureText(data.comicBeats?.[key], fallback.comicBeats[key])]));
  result.title = ensureText(data.title, fallback.title);
  if (!result.title.includes(info.primary)) result.title = `${info.primary} ${result.title}`;
  if (!result.title.endsWith("사건")) result.title += " 사건";
  result.subtitle = ensureText(data.subtitle, fallback.subtitle);
  result.fictionalCharge = ensureText(data.fictionalCharge, fallback.fictionalCharge);
  result.caseSummary = ensureText(data.caseSummary, fallback.caseSummary);
  result.intake = {
    complaint: incident,
    complainantStatement: ensureText(data.intake?.complainantStatement, fallback.intake.complainantStatement),
    accusedInitialPosition: ensureText(data.intake?.accusedInitialPosition, fallback.intake.accusedInitialPosition),
    assignedUnit: ensureText(data.intake?.assignedUnit, fallback.intake.assignedUnit)
  };
  result.initialInvestigation = {
    sceneControl: ensureText(data.initialInvestigation?.sceneControl, fallback.initialInvestigation.sceneControl),
    measurements: ensureList(data.initialInvestigation?.measurements, 3, (index) => fallback.initialInvestigation.measurements[index]),
    witnessChecks: ensureList(data.initialInvestigation?.witnessChecks, 3, (index) => fallback.initialInvestigation.witnessChecks[index]),
    evidence: ensureObjectList(data.initialInvestigation?.evidence, 4, (index) => fallback.initialInvestigation.evidence[index])
  };
  result.overInvestigation = {
    taskForce: ensureText(data.overInvestigation?.taskForce, fallback.overInvestigation.taskForce),
    surveillance: ensureText(data.overInvestigation?.surveillance, fallback.overInvestigation.surveillance),
    forensicReports: ensureObjectList(data.overInvestigation?.forensicReports, 3, (index) => fallback.overInvestigation.forensicReports[index]),
    searchAndSeizure: ensureText(data.overInvestigation?.searchAndSeizure, fallback.overInvestigation.searchAndSeizure),
    publicBriefing: ensureText(data.overInvestigation?.publicBriefing, fallback.overInvestigation.publicBriefing)
  };
  result.interrogation = {
    accusedStatement: ensureText(data.interrogation?.accusedStatement, fallback.interrogation.accusedStatement),
    complainantRebuttal: ensureText(data.interrogation?.complainantRebuttal, fallback.interrogation.complainantRebuttal),
    witnessStatements: ensureList(data.interrogation?.witnessStatements, 2, (index) => fallback.interrogation.witnessStatements[index]),
    contradictions: ensureList(data.interrogation?.contradictions, 3, (index) => fallback.interrogation.contradictions[index])
  };
  result.referral = {
    investigationConclusion: ensureText(data.referral?.investigationConclusion, fallback.referral.investigationConclusion),
    fictionalCharge: ensureText(data.referral?.fictionalCharge, fallback.referral.fictionalCharge),
    referralOpinion: ensureText(data.referral?.referralOpinion, fallback.referral.referralOpinion),
    prosecutionDecision: ensureText(data.referral?.prosecutionDecision, fallback.referral.prosecutionDecision),
    coreIssues: ensureList(data.referral?.coreIssues, 3, (index) => fallback.referral.coreIssues[index])
  };
  result.settlement = {
    openingDemand: ensureText(data.settlement?.openingDemand, fallback.settlement.openingDemand),
    counterOffer: ensureText(data.settlement?.counterOffer, fallback.settlement.counterOffer),
    mediatorRecommendation: ensureText(data.settlement?.mediatorRecommendation, fallback.settlement.mediatorRecommendation),
    result: ensureText(data.settlement?.result, fallback.settlement.result),
    reason: ensureText(data.settlement?.reason, fallback.settlement.reason)
  };
  result.trial = {
    prosecutionOpening: ensureText(data.trial?.prosecutionOpening, fallback.trial.prosecutionOpening),
    defenseOpening: ensureText(data.trial?.defenseOpening, fallback.trial.defenseOpening),
    evidenceArguments: ensureObjectList(data.trial?.evidenceArguments, 3, (index) => fallback.trial.evidenceArguments[index]),
    witnessExamination: ensureObjectList(data.trial?.witnessExamination, 3, (index) => fallback.trial.witnessExamination[index]),
    judgeQuestions: ensureList(data.trial?.judgeQuestions, 2, (index) => fallback.trial.judgeQuestions[index]),
    closingStatements: ensureText(data.trial?.closingStatements, fallback.trial.closingStatements)
  };
  result.judgment = {
    recognizedFacts: ensureList(data.judgment?.recognizedFacts, 3, (index) => fallback.judgment.recognizedFacts[index]),
    liabilityRatio: ensureText(data.judgment?.liabilityRatio, fallback.judgment.liabilityRatio),
    order: ensureText(data.judgment?.order, fallback.judgment.order),
    sentence: ensureText(data.judgment?.sentence, fallback.judgment.sentence),
    reasoning: ensureText(data.judgment?.reasoning, fallback.judgment.reasoning),
    afterStory: ensureText(data.judgment?.afterStory, fallback.judgment.afterStory)
  };
  const beatValues = Object.values(result.comicBeats);
  if (new Set(beatValues).size !== beatValues.length) result.comicBeats = fallback.comicBeats;
  return result;
}

function auditStructure(data) {
  const issues = [];
  for (const key of ["comicProfile", "comicBeats", "intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"]) {
    if (!data?.[key] || typeof data[key] !== "object") issues.push(`${key} 누락`);
  }
  if (!data?.title?.endsWith("사건")) issues.push("사건명");
  if (new Set(Object.values(data?.comicBeats || {})).size !== 8) issues.push("펀치라인 중복");
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
    ["comicProfile", "comicBeats", "title", "subtitle", "fictionalCharge", "caseSummary", "intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"],
    {
      comicProfile: object(["centralMisread", "runningGag", "escalationRule", "finalCallback"], { centralMisread: text(), runningGag: text(), escalationRule: text(), finalCallback: text() }),
      comicBeats: object(BEAT_KEYS, Object.fromEntries(BEAT_KEYS.map((key) => [key, text()]))),
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
  const info = detectCase(incident);
  const prompt = [
    `최초 접수 문장: ${incident}`,
    `사건 유형: ${info.category}`,
    `반드시 중심으로 삼을 물건·시간: ${info.primary}`,
    `보조 소재: ${info.secondary}`,
    `확대 수준: ${severity}`,
    "comicProfile을 먼저 설계하고 runningGag 문구를 사건기록 안에서 정확히 세 번 이상 사용한다.",
    "comicBeats 8개는 서로 다른 농담 구조로 작성한다.",
    "합의는 요구안·반대안·조정권고·성립 또는 결렬 이유가 구체적이어야 한다.",
    "재판은 동일 증거를 검사와 변호인이 정반대로 해석해야 한다.",
    "판결 후일담은 centralMisread 또는 runningGag을 반대로 되돌려 끝낸다."
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
      temperature: 0.96,
      topP: 0.94,
      maxOutputTokens: 9000
    }
  }));
  const result = normalizeCase(parseResponse(response), incident, severity, info);
  const audit = auditStructure(result);
  if (!audit.ok) throw new Error(`구조 검사 실패: ${audit.issues.join(", ")}`);
  return result;
}

function safeLogMessage(error) {
  return String(error?.message || error || "unknown").replace(/AIza[0-9A-Za-z_-]{15,}/g, "[redacted]").replace(/\s+/g, " ").slice(0, 220);
}

exports.generateCourtCaseV7 = onRequest(
  {
    region: "asia-northeast3",
    timeoutSeconds: 75,
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
    const info = detectCase(input.incident);
    try {
      const apiKey = String(GEMINI_API_KEY.value() || "").trim();
      if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
      const courtCase = await generateCase(apiKey, input.incident, input.severity);
      return res.status(200).json({ case: courtCase, meta: { source: "gemini", model: MODEL, version: "comedy-engine-v7.1", category: info.category, primary: info.primary, stored: false } });
    } catch (error) {
      const isSafety = error instanceof SafetyInputError;
      const reason = safeLogMessage(error);
      logger.error("generateCourtCaseV7.1 failed", { type: isSafety ? "safety" : "generation", message: reason, incidentLength: input.incident.length, severity: input.severity });
      if (isSafety) return res.status(400).json({ error: error.message });
      return res.status(200).json({ case: fallbackCase(input.incident, input.severity, info), meta: { source: "grounded-comedy-fallback", model: MODEL, version: "comedy-engine-v7.1", category: info.category, primary: info.primary, fallbackReason: reason, stored: false } });
    }
  }
);
