'use strict';

// topic-pools.js
// 소소킹 주제 톤 가이드 + 3단계 주제 풀(소소/공론/국정).
//
// 설계 철학: "틀(정치 시스템)은 진지하게, 주제는 가볍게."
//  - 거대한 정치 시스템(정당·선거·등급·대통령) × 사소한 주제의 간극이 곧 재미.
//  - 실제 정당/정치인은 직접 언급하지 않고, 모든 무거운 주제는 '가상 정책'으로 포장.
//
// 이 풀은 AI가 매일 콘텐츠를 생성할 때 "영감"으로 주입된다(그대로 복붙 금지).

// ── 톤 가이드 (프롬프트에 공통 주입) ──
const TONE_GUIDE = `【소소킹 톤 가이드】
- 정치 시스템(정당·선거·대통령·법안)은 진지한 '틀'로 유지하되, 다루는 주제는 일상의 사소한 것으로.
- 거대한 제도 × 사소한 주제의 간극에서 오는 코미디가 핵심. (예: "월요일 폐지법"을 국가대사처럼 다루기)
- 실제 한국 정당·정치인·실명 인물은 절대 직접 언급하지 말 것. 무거운 사회 이슈는 '소소공화국의 가상 정책/법안'으로만 패러디.
- 분쟁·혐오·정치 성향 자극은 피하고, 누구나 웃으며 한쪽 편들 수 있는 가벼운 대결로.`;

// ── 1단계 🟢 소소(일상): 진입장벽 0, 누구나 즉답 ──
const TIER_SOSO = [
  '탕수육 부먹 vs 찍먹',
  '민트초코 호 vs 불호',
  '치킨엔 콜라 vs 맥주',
  '라면 면 먼저 vs 국물 먼저',
  '여름 휴가 vs 겨울 휴가',
  '아침형 인간 vs 저녁형 인간',
  '치약 끝부터 짜기 vs 중간부터 짜기',
  '계란후라이 반숙 vs 완숙',
  '피자 테두리 먹기 vs 남기기',
  '물냉 vs 비냉',
  '붕어빵 머리부터 vs 꼬리부터',
  '회식 1차만 vs 끝까지',
  '카톡 프사 있음 vs 없음',
  '집 안에서 양말 신기 vs 맨발',
  '국밥에 밥 말기 vs 따로',
  '딸기우유 vs 초코우유',
  '여행 계획파 vs 즉흥파',
  '겨울에 아아 vs 뜨아',
];

// ── 2단계 🟡 공론(라이프): 살짝 가치관, 토론 여지 ──
const TIER_GONGRON = [
  '데이트 비용 분담은 5:5가 맞는가',
  '주 4일제, 도입해야 하는가',
  '단톡방 읽씹은 무례한가',
  '직장 회식도 근무의 연장인가',
  '반려동물 양육비, 사회가 지원해야 하는가',
  '결혼식 축의금 적정선은 얼마인가',
  '엘리베이터 인사, 해야 하는가',
  '명절 잔소리 금지법이 필요한가',
  '카페에서 노트북 장시간 점유, 허용해야 하는가',
  '직장 단톡방 퇴근 후 알림, 금지해야 하는가',
  '버스·지하철 임산부석 비워두기, 의무인가',
  '친구 사이 돈거래, 해도 되는가',
  '소개팅 후 먼저 연락, 누가 해야 하는가',
  '층간소음 기준, 더 강화해야 하는가',
  '회사 점심시간, 혼밥할 권리가 있는가',
];

// ── 3단계 🔴 국정(가상정책): 진짜 정치 무게감, 단 '가상 법안'으로 ──
const TIER_GUKJEONG = [
  '월요일 폐지법 — 주말을 3일로',
  '라면값 상한제 도입안',
  '지각 3분 허용법',
  '점심시간 90분 의무화법',
  '여름 폭염 시 재택근무 의무화법',
  '단체 카톡방 정년 퇴장 보장법',
  '공공장소 노키즈존 금지법',
  '배달비 국가 보조금 지급법',
  '낮잠 보장 특별법 — 오후 1시 전국 30분',
  '금요일 오후 조기퇴근 의무화법',
  '미세먼지 심한 날 공휴일 지정법',
  '연차 강제 소진 금지법',
  '엘리베이터 닫힘 버튼 폐지법',
  '신호 대기 시간 단축 특별법',
  '공휴일이 주말과 겹치면 무조건 대체공휴일법',
  '커피 카페인 함량 표시 의무화법',
];

const TIERS = {
  soso: { key: 'soso', emoji: '🟢', label: '소소(일상)', pool: TIER_SOSO },
  gongron: { key: 'gongron', emoji: '🟡', label: '공론(라이프)', pool: TIER_GONGRON },
  gukjeong: { key: 'gukjeong', emoji: '🔴', label: '국정(가상정책)', pool: TIER_GUKJEONG },
};

// 날짜 문자열(YYYY-MM-DD) → 안정적 정수 시드
function dateSeed(dateStr) {
  const digits = String(dateStr || '').replace(/\D/g, '');
  let n = 0;
  for (let i = 0; i < digits.length; i++) n = (n * 31 + (digits.charCodeAt(i) - 48)) >>> 0;
  return n || 1;
}

// 날짜별 주 톤(tier) 회전 — 소소 위주의 가벼운 날이 더 자주 오도록 가중
function pickDailyTier(dateStr) {
  const weighted = ['soso', 'soso', 'gongron', 'gukjeong', 'soso', 'gongron', 'gukjeong'];
  return TIERS[weighted[dateSeed(dateStr) % weighted.length]];
}

// 풀에서 n개 샘플(날짜 기반 결정적)
function sampleTopics(pool, n, dateStr) {
  const arr = pool.slice();
  let s = dateSeed(dateStr);
  const out = [];
  for (let i = 0; i < n && arr.length; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    out.push(arr.splice(s % arr.length, 1)[0]);
  }
  return out;
}

// 프롬프트에 끼워 넣을 "오늘의 영감" 블록 생성
function buildInspirationBlock(dateStr) {
  const tier = pickDailyTier(dateStr);
  const samples = [
    ...sampleTopics(TIER_SOSO, 2, dateStr + 'a'),
    ...sampleTopics(TIER_GONGRON, 2, dateStr + 'b'),
    ...sampleTopics(TIER_GUKJEONG, 2, dateStr + 'c'),
  ];
  return `${TONE_GUIDE}

【오늘의 주제 결】오늘은 ${tier.emoji} ${tier.label} 톤을 중심으로 가볍게 풀어주세요.
【주제 영감 (그대로 쓰지 말고 변주/재창작용 참고)】
- ${samples.join('\n- ')}`;
}

module.exports = {
  TONE_GUIDE,
  TIER_SOSO,
  TIER_GONGRON,
  TIER_GUKJEONG,
  TIERS,
  pickDailyTier,
  sampleTopics,
  buildInspirationBlock,
};
