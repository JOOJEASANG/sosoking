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
// 기본 사건 10개
// ─────────────────────────────────────────
const TOPICS = [
  {
    title: '카톡 읽씹 무죄 주장 사건',
    summary: '읽고 2시간 뒤 답장 — 무시인가, 나중에 답할 권리인가',
    plaintiffPosition: '읽었으면 바로 답장하는 게 기본 예의다',
    defendantPosition: '바로 답 못 할 상황도 있다, 나중에 답할 자유가 있다',
    category: '카톡',
  },
  {
    title: '치킨 마지막 조각 선취 사건',
    summary: '먼저 집으면 임자 vs 마지막은 눈치 봐야 한다',
    plaintiffPosition: '마지막 조각은 같이 먹는 사람 모두의 것, 눈치 봐야 한다',
    defendantPosition: '테이블 위 음식은 먼저 집는 사람 것이다, 망설임이 패배다',
    category: '음식',
  },
  {
    title: '더치페이 계산기 사건',
    summary: '밥 먹자마자 계산기 꺼내는 게 맞는 행동인가',
    plaintiffPosition: '공평함이 최고다, 더치페이가 관계를 깔끔하게 한다',
    defendantPosition: '분위기 보고 한 번쯤은 그냥 내는 게 사람 사는 방식이다',
    category: '정산',
  },
  {
    title: '퇴근 5분 전 업무 지시 사건',
    summary: '퇴근 직전 업무 지시 — 오늘 해야 하는가, 내일 해도 되는가',
    plaintiffPosition: '퇴근 시간 이후는 내 시간이다, 내일 하면 된다',
    defendantPosition: '급한 일은 상황에 따라 유연하게 해야 하는 게 직장인이다',
    category: '직장',
  },
  {
    title: '에어컨 온도 설정권 분쟁',
    summary: '함께 쓰는 공간에서 에어컨 온도는 누가 결정하는가',
    plaintiffPosition: '여름에 더운 게 정상, 시원하게 트는 게 기본이다',
    defendantPosition: '추위를 타는 사람도 있다, 서로 배려해야 한다',
    category: '생활',
  },
  {
    title: '5분 지각 무죄 주장 사건',
    summary: '약속에 5분 늦는 건 지각인가, 오차 범위인가',
    plaintiffPosition: '약속 시간은 정확히 지켜야 한다, 5분도 지각은 지각이다',
    defendantPosition: '5분은 현실적 오차 범위다, 예민한 게 오히려 이상하다',
    category: '생활',
  },
  {
    title: '자정 생일 카톡 강요 사건',
    summary: '자정에 생일 카톡 못 보내면 친한 친구가 아닌가',
    plaintiffPosition: '자정에 챙겨주는 게 진짜 친한 친구의 기본이다',
    defendantPosition: '당일 낮에 진심으로 챙기면 그게 더 의미 있다',
    category: '친구',
  },
  {
    title: '단톡방 알림 차단 무례 논쟁',
    summary: '단톡방 알림 꺼두고 나중에 보는 게 실례인가',
    plaintiffPosition: '공지나 연락에 늦게 반응하면 그룹을 무시하는 것이다',
    defendantPosition: '알림 설정은 개인 자유다, 읽기만 하면 문제없다',
    category: '카톡',
  },
  {
    title: '소개팅 후 연락 의무 부존재 사건',
    summary: '소개팅 후 먼저 연락해야 하는 쪽이 있는가',
    plaintiffPosition: '먼저 연락 안 하면 관심 없다는 신호, 용기 있는 쪽이 먼저 해야 한다',
    defendantPosition: '마음에 들면 서로 연락하게 돼 있다, 의무는 없다',
    category: '연애',
  },
  {
    title: '빌린 우산 반환 의무 사건',
    summary: '우산 빌려줬으면 꼭 돌려받아야 하는가',
    plaintiffPosition: '빌린 건 돌려주는 게 기본 중의 기본이다',
    defendantPosition: '우산은 사실상 주는 거다, 다들 그렇게 생각하며 살아왔다',
    category: '친구',
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

  // 2. 주제 세팅
  const topicsSnap = await db.collection('topics').where('isOfficial', '==', true).limit(1).get();
  if (topicsSnap.empty) {
    console.log('\n⚖️  기본 사건 10개 추가 중...');
    for (const [i, topic] of TOPICS.entries()) {
      await db.collection('topics').add({
        ...topic,
        status: 'active',
        isOfficial: true,
        playCount: 0,
        createdBy: 'system',
        createdAt: FieldValue.serverTimestamp(),
      });
      process.stdout.write(`  ✓ [${i + 1}/10] ${topic.title}\n`);
    }
  } else {
    console.log('\n⚖️  공식 사건 이미 존재 — 건너뜀');
  }

  console.log('\n✅ 완료! 소소킹 생활법정 오픈 준비가 됐습니다.\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ 시드 실패:', err.message);
  process.exit(1);
});
