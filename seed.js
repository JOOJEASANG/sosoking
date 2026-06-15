/**
 * 소소킹 생활법정 초기 데이터 시드 스크립트
 * 실행: node seed.js
 * (Firebase 로그인 상태에서 또는 GOOGLE_APPLICATION_CREDENTIALS 설정 후)
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Firebase Admin 초기화 (Application Default Credentials 사용)
if (!getApps().length) {
  initializeApp({ projectId: 'sosoking-481e6' });
}
const db = getFirestore();

// ─────────────────────────────────────────
// 카테고리 8개
// ─────────────────────────────────────────
const CATEGORIES = [
  { name: '카톡',  icon: '💬', order: 1 },
  { name: '연애',  icon: '💑', order: 2 },
  { name: '음식',  icon: '🍗', order: 3 },
  { name: '정산',  icon: '💸', order: 4 },
  { name: '직장',  icon: '🏢', order: 5 },
  { name: '생활',  icon: '🏠', order: 6 },
  { name: '친구',  icon: '👫', order: 7 },
  { name: '기타',  icon: '📌', order: 8 },
];

// ─────────────────────────────────────────
// 기본 사건 (tier: soso=일상 / gongron=라이프 / gukjeong=가상정책)
// "틀은 진지하게, 주제는 가볍게" — 거대한 법정 × 사소한 주제의 코미디
// ─────────────────────────────────────────
const TOPICS = [
  // ── 🟢 소소(일상) ──
  {
    title: '치킨 마지막 조각 선취 사건',
    summary: '먼저 집으면 임자 vs 마지막은 눈치 봐야 한다',
    plaintiffPosition: '마지막 조각은 같이 먹는 사람 모두의 것, 눈치 봐야 한다',
    defendantPosition: '테이블 위 음식은 먼저 집는 사람 것이다, 망설임이 패배다',
    category: '음식', tier: 'soso',
  },
  {
    title: '탕수육 부먹 찍먹 전쟁',
    summary: '소스를 부어야 하는가, 찍어야 하는가 — 인류의 영원한 숙제',
    plaintiffPosition: '부어야 소스가 골고루 밴다, 부먹이 정통이다',
    defendantPosition: '바삭함을 지켜야 한다, 찍먹이 과학이다',
    category: '음식', tier: 'soso',
  },
  {
    title: '민트초코 음식 인정 여부 사건',
    summary: '민트초코는 디저트인가 치약인가',
    plaintiffPosition: '상쾌하고 달콤한 완벽한 디저트다',
    defendantPosition: '입에서 양치하는 맛, 이건 음식이 아니다',
    category: '음식', tier: 'soso',
  },
  {
    title: '국밥에 밥 마는 방식 분쟁',
    summary: '뚝배기에 밥을 말 것인가, 따로 먹을 것인가',
    plaintiffPosition: '말아야 국물이 배서 제맛이다',
    defendantPosition: '따로 먹어야 밥알이 살아있다, 토렴은 선택이다',
    category: '음식', tier: 'soso',
  },
  {
    title: '치약 짜는 위치 분쟁',
    summary: '치약은 끝부터 짜야 하는가, 아무 데나 눌러도 되는가',
    plaintiffPosition: '끝부터 가지런히 짜는 게 기본 매너다',
    defendantPosition: '어차피 다 쓴다, 중간을 누른들 무슨 죄인가',
    category: '생활', tier: 'soso',
  },
  {
    title: '집안 양말 착용권 사건',
    summary: '집 안에서 양말을 신어야 하는가, 맨발이 자유인가',
    plaintiffPosition: '바닥 위생과 발 보온을 위해 신는 게 맞다',
    defendantPosition: '내 집에서 맨발은 기본권, 발도 숨 쉬어야 한다',
    category: '생활', tier: 'soso',
  },

  // ── 🟡 공론(라이프) ──
  {
    title: '카톡 읽씹 무죄 주장 사건',
    summary: '읽고 2시간 뒤 답장 — 무시인가, 나중에 답할 권리인가',
    plaintiffPosition: '읽었으면 바로 답장하는 게 기본 예의다',
    defendantPosition: '바로 답 못 할 상황도 있다, 나중에 답할 자유가 있다',
    category: '카톡', tier: 'gongron',
  },
  {
    title: '단톡방 알림 차단 무례 논쟁',
    summary: '단톡방 알림 꺼두고 나중에 보는 게 실례인가',
    plaintiffPosition: '공지나 연락에 늦게 반응하면 그룹을 무시하는 것이다',
    defendantPosition: '알림 설정은 개인 자유다, 읽기만 하면 문제없다',
    category: '카톡', tier: 'gongron',
  },
  {
    title: '더치페이 계산기 사건',
    summary: '밥 먹자마자 계산기 꺼내는 게 맞는 행동인가',
    plaintiffPosition: '공평함이 최고다, 더치페이가 관계를 깔끔하게 한다',
    defendantPosition: '분위기 보고 한 번쯤은 그냥 내는 게 사람 사는 방식이다',
    category: '정산', tier: 'gongron',
  },
  {
    title: '퇴근 5분 전 업무 지시 사건',
    summary: '퇴근 직전 업무 지시 — 오늘 해야 하는가, 내일 해도 되는가',
    plaintiffPosition: '퇴근 시간 이후는 내 시간이다, 내일 하면 된다',
    defendantPosition: '급한 일은 상황에 따라 유연하게 해야 하는 게 직장인이다',
    category: '직장', tier: 'gongron',
  },
  {
    title: '회식은 근무의 연장인가 사건',
    summary: '퇴근 후 회식, 업무인가 사생활 침해인가',
    plaintiffPosition: '팀워크를 위한 자리, 어느 정도 참여는 사회생활이다',
    defendantPosition: '근무시간 외 강제 참석은 사생활 침해다',
    category: '직장', tier: 'gongron',
  },
  {
    title: '에어컨 온도 설정권 분쟁',
    summary: '함께 쓰는 공간에서 에어컨 온도는 누가 결정하는가',
    plaintiffPosition: '여름에 더운 게 정상, 시원하게 트는 게 기본이다',
    defendantPosition: '추위를 타는 사람도 있다, 서로 배려해야 한다',
    category: '생활', tier: 'gongron',
  },
  {
    title: '5분 지각 무죄 주장 사건',
    summary: '약속에 5분 늦는 건 지각인가, 오차 범위인가',
    plaintiffPosition: '약속 시간은 정확히 지켜야 한다, 5분도 지각은 지각이다',
    defendantPosition: '5분은 현실적 오차 범위다, 예민한 게 오히려 이상하다',
    category: '생활', tier: 'gongron',
  },
  {
    title: '자정 생일 카톡 강요 사건',
    summary: '자정에 생일 카톡 못 보내면 친한 친구가 아닌가',
    plaintiffPosition: '자정에 챙겨주는 게 진짜 친한 친구의 기본이다',
    defendantPosition: '당일 낮에 진심으로 챙기면 그게 더 의미 있다',
    category: '친구', tier: 'gongron',
  },
  {
    title: '소개팅 후 연락 의무 부존재 사건',
    summary: '소개팅 후 먼저 연락해야 하는 쪽이 있는가',
    plaintiffPosition: '먼저 연락 안 하면 관심 없다는 신호, 용기 있는 쪽이 먼저 해야 한다',
    defendantPosition: '마음에 들면 서로 연락하게 돼 있다, 의무는 없다',
    category: '연애', tier: 'gongron',
  },
  {
    title: '빌린 우산 반환 의무 사건',
    summary: '우산 빌려줬으면 꼭 돌려받아야 하는가',
    plaintiffPosition: '빌린 건 돌려주는 게 기본 중의 기본이다',
    defendantPosition: '우산은 사실상 주는 거다, 다들 그렇게 생각하며 살아왔다',
    category: '친구', tier: 'gongron',
  },
  {
    title: '데이트 비용 분담 사건',
    summary: '데이트 비용은 5:5가 원칙인가',
    plaintiffPosition: '시대가 바뀌었다, 공평한 분담이 건강한 관계다',
    defendantPosition: '상황과 마음에 따라 유연하게, 칼같은 5:5는 정 없다',
    category: '연애', tier: 'gongron',
  },
  {
    title: '카페 노트북 장시간 점유 사건',
    summary: '커피 한 잔으로 몇 시간까지 자리를 지킬 수 있는가',
    plaintiffPosition: '회전이 필요한 가게도 있다, 적당히 비워줘야 한다',
    defendantPosition: '값을 치렀으면 머무를 권리가 있다',
    category: '생활', tier: 'gongron',
  },

  // ── 🔴 국정(가상정책 법안) ──
  {
    title: '월요일 폐지법 위헌 심판',
    summary: '주말을 3일로 늘리는 월요일 폐지법, 통과시켜야 하는가',
    plaintiffPosition: '국민 행복을 위해 월요일은 폐지되어야 한다',
    defendantPosition: '그럼 화요일이 월요일이 될 뿐, 현실성이 없다',
    category: '기타', tier: 'gukjeong',
  },
  {
    title: '라면값 상한제 도입안',
    summary: '국민 주식 라면, 가격 상한을 법으로 정해야 하는가',
    plaintiffPosition: '서민 물가 안정을 위해 라면값은 통제되어야 한다',
    defendantPosition: '시장 원리를 무시하면 품질만 떨어진다',
    category: '기타', tier: 'gukjeong',
  },
  {
    title: '점심시간 90분 의무화법',
    summary: '점심시간을 90분으로 늘려 낮잠을 보장해야 하는가',
    plaintiffPosition: '오후 생산성을 위해 충분한 점심·휴식이 필요하다',
    defendantPosition: '근무시간만 늘어난다, 60분이면 충분하다',
    category: '직장', tier: 'gukjeong',
  },
  {
    title: '폭염 재택근무 의무화법',
    summary: '폭염경보 발효 시 재택근무를 의무화해야 하는가',
    plaintiffPosition: '건강권과 에너지 절약을 위해 의무화가 맞다',
    defendantPosition: '업종별로 불가능한 곳이 많다, 일괄 의무는 무리다',
    category: '직장', tier: 'gukjeong',
  },
  {
    title: '대체공휴일 전면 확대법',
    summary: '공휴일이 주말과 겹치면 무조건 대체휴일을 줘야 하는가',
    plaintiffPosition: '쉴 권리는 빼앗기면 안 된다, 무조건 보장해야 한다',
    defendantPosition: '산업 현장에 부담이 크다, 선별 적용이 현실적이다',
    category: '기타', tier: 'gukjeong',
  },
  {
    title: '엘리베이터 닫힘 버튼 폐지법',
    summary: '조급함의 상징 닫힘 버튼, 없애야 하는가',
    plaintiffPosition: '어차피 곧 닫힌다, 여유와 안전을 위해 폐지하자',
    defendantPosition: '바쁜 현대인에게 1초도 소중하다, 존치해야 한다',
    category: '생활', tier: 'gukjeong',
  },
  {
    title: '금요일 조기퇴근 의무화법',
    summary: '금요일 오후 조기퇴근을 법으로 보장해야 하는가',
    plaintiffPosition: '주말 시작의 여유, 삶의 질을 위해 도입하자',
    defendantPosition: '결국 다른 날 일이 몰린다, 자율에 맡겨야 한다',
    category: '직장', tier: 'gukjeong',
  },
];

async function seed() {
  console.log('🔨 소소킹 생활법정 초기 데이터 세팅 시작...\n');

  // 1. 카테고리 세팅
  const catSnap = await db.collection('categories').limit(1).get();
  if (catSnap.empty) {
    console.log('📂 카테고리 8개 추가 중...');
    for (const cat of CATEGORIES) {
      await db.collection('categories').add(cat);
      process.stdout.write(`  ✓ ${cat.icon} ${cat.name}\n`);
    }
  } else {
    console.log('📂 카테고리 이미 존재 — 건너뜀');
  }

  // 2. 주제 세팅 — 제목 기준으로 누락된 사건만 추가 (재실행 안전)
  const topicsSnap = await db.collection('topics').where('isOfficial', '==', true).get();
  const existingTitles = new Set(topicsSnap.docs.map(d => d.data().title));
  const missing = TOPICS.filter(t => !existingTitles.has(t.title));

  if (missing.length === 0) {
    console.log(`\n⚖️  공식 사건 ${existingTitles.size}건 모두 존재 — 건너뜀`);
  } else {
    console.log(`\n⚖️  기본 사건 ${missing.length}건 추가 중... (기존 ${existingTitles.size}건)`);
    for (const [i, topic] of missing.entries()) {
      await db.collection('topics').add({
        ...topic,
        status: 'active',
        isOfficial: true,
        playCount: 0,
        createdBy: 'system',
        createdAt: FieldValue.serverTimestamp(),
      });
      process.stdout.write(`  ✓ [${i + 1}/${missing.length}] ${topic.title}\n`);
    }
  }

  console.log('\n✅ 완료! 소소킹 생활법정 오픈 준비가 됐습니다.\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ 시드 실패:', err.message);
  process.exit(1);
});
