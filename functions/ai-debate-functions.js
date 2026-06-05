'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// 4소와 동일한 6인 캐릭터·AI 호출 헬퍼를 그대로 재사용 (중복 정의 방지)
const { CHARACTERS, CHAR_LIST, callAI, callAndParse } = require('./ai-king-functions').sharedAi;

if (!getApps().length) initializeApp();
const db = getFirestore();

// ── 캐릭터별 토론용 압축 페르소나 (말투·시그니처 핵심만) ──
const DEBATE_PERSONA = {
  jungding:  '사춘기 중딩. "ㄹㅇ/팩폭/현타/노잼/개-" 슬랭, 반말. 어른들 비웃으며 핵심만 팩폭.',
  saibi:     '사이비 교주. "형제여…" 성스러운 톤. 모든 걸 신의 뜻·시련으로 몰고 은근슬쩍 포교.',
  prophet:   '예언가. "~하리라/~이니라/~을 조심하라" 운명 말투. 모호한데 묘하게 소름.',
  joojeob:   '주접러. "미쳤다/실화임?/소름/ㄷㄷ/ㅠㅠ" 과잉 리액션 폭발. 내용보다 호들갑이 큼.',
  chamgyeon: '참견러. "아 그거 내가 다 알아" 지인 사례(옆집·사촌언니 등) 들이밀며 오지랖.',
  kkondae:   '꼰대. "내가 말이야~/우리 때는~/요즘 것들은" 옛날 고생 자랑하며 깎아내림.',
};

// ── 가볍고 안전한 일상 떡밥 주제 풀 (한 달치 31개) ──
const DEBATE_TOPICS = [
  '탕수육은 부먹이 맞다 vs 찍먹이 맞다',
  '민트초코는 음식이다 vs 치약이다',
  '연인 데이트 비용은 반반이 맞다 vs 더 버는 쪽이 더 낸다',
  '치킨은 무조건 후라이드 vs 양념이 진리',
  '여름 휴가는 바다 vs 산',
  '물건 살 때 최저가 1시간 검색 vs 그냥 눈앞에서 산다',
  '라면 끓일 때 면 먼저 vs 스프 먼저',
  '카톡은 1분 안에 답장 vs 봐도 천천히',
  '회식은 사회생활이니 참석 vs 칼퇴가 정답',
  '아침형 인간 vs 저녁형 인간',
  '여행은 계획 빡세게 vs 발길 닿는 대로',
  '겨울에도 아이스 아메리카노 vs 따뜻한 거',
  '피자는 고구마 무스 vs 오리지널',
  '집들이 선물은 휴지·세제 실용템 vs 분위기 소품',
  '결혼식 축의금 기본 5만원 vs 10만원',
  '운동은 아침 공복 vs 저녁 퇴근 후',
  '햄버거는 손으로 vs 포크와 나이프',
  '노래방 1순위는 발라드 vs 신나는 곡',
  '비 오는 날엔 파전 vs 그냥 평소대로',
  '치약은 끝에서부터 짜기 vs 아무데나 짜기',
  '여름 이불은 시원한 인견 vs 그래도 솜이불',
  '주말은 무조건 밖에 나가기 vs 집에서 쉬기',
  '돈가스엔 소스 부어먹기 vs 찍어먹기',
  '커플 통장 합치기 vs 각자 관리',
  '여행 짐은 미리미리 vs 출발 직전에',
  '라면에 계란은 풀어서 vs 통째로',
  '영화관엔 팝콘 필수 vs 없어도 된다',
  '새우는 머리까지 먹기 vs 빼고 먹기',
  '선풍기 틀고 자기 vs 끄고 자기',
  '약속은 무조건 일찍 도착 vs 딱 맞춰 도착',
  '김밥 꼬다리는 먹는다 vs 버린다',
];

// KST 날짜(1~31)를 인덱스로 삼아 31개 주제를 순환
// 매달 1일=주제[0], 2일=주제[1], ..., 31일=주제[30]
function pickDailyTopic() {
  const kstDate = new Date(Date.now() + 9 * 3600 * 1000);
  const dayOfMonth = kstDate.getUTCDate(); // 1~31
  return DEBATE_TOPICS[dayOfMonth - 1];
}

function buildDebateSystem(chars, topic) {
  const roster = chars.map(c => `- ${c.name} (id:"${c.id}"): ${DEBATE_PERSONA[c.id]}`).join('\n');
  const order = chars.map(c => `"${c.id}"`).join(' → ');
  return `너는 개성 강한 캐릭터들이 한 주제로 서로 티격태격 말싸움하는 장면을 쓰는 작가다.

【등장 캐릭터】
${roster}

【주제】
${topic}

【작성 규칙】
1. 각 캐릭터가 자기 말투·세계관 그대로 주제에 입장을 밝힌다. 시그니처 말투는 반드시 유지.
2. 각자 따로 떠들지 말 것 — 서로의 말을 받아치고, 끼어들고, 디스해야 한다. 진짜 말싸움처럼.
3. 총 2바퀴: 1바퀴는 ${chars.length}명이 각자 첫 입장(${order} 순서), 2바퀴는 앞사람 말에 발끈하며 재반박. 총 ${chars.length * 2}개 발언.
4. 각 발언은 1~2문장. 짧고 빵 터지게. 길게 설명하지 마라.
5. 누가 옳다는 결론은 내지 마라. 끝까지 안 끝나는 난장판으로.
6. 특정인 비방·정치·혐오·성적 내용 금지. 가볍고 웃기게만.

반드시 아래 JSON만 출력. 다른 텍스트 금지:
{"turns":[{"id":"캐릭터id","text":"발언"}]}`;
}

// 주제 + 캐릭터로 티격태격 피드 글을 생성하고 feeds 컬렉션에 저장
async function generateDebatePost(topic, charIds) {
  const chars = charIds.map(id => ({ id, name: CHARACTERS[id].name }));
  const system = buildDebateSystem(chars, topic);
  const { parsed } = await callAndParse(
    (mt) => callAI(system, `주제 "${topic}"로 ${chars.length}명이 티격태격 시작해라.`, null, mt, 1.0, true),
    2400,
  );
  const turns = (parsed.turns || [])
    .filter(t => t && CHARACTERS[t.id] && String(t.text || '').trim())
    .map(t => ({ charId: t.id, charName: CHARACTERS[t.id].name, text: String(t.text).trim().slice(0, 300) }))
    .slice(0, 16);
  if (turns.length < 2) throw new Error('debate produced too few turns');

  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_debate',
    feedType: 'ai_debate',
    title: `🗣️ 오늘의 티격태격: ${topic}`,
    topic,
    turns,
    characterIds: charIds,
    authorId: 'sosoking-ai',
    authorName: '🤖 소소킹',
    authorEmail: '',
    authorPhoto: '',
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'golra',
  });
  return { postId: postRef.id, topic, turns };
}

// ── 매일 오전 10시(KST) 자동 생성: 6인 전원 출연 ──
exports.scheduledDailyDebate = onSchedule({
  schedule: '0 10 * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  timeoutSeconds: 120,
  memory: '512MiB',
}, async () => {
  try {
    const topic = pickDailyTopic();
    const charIds = CHAR_LIST.map(c => c.id);
    const { postId } = await generateDebatePost(topic, charIds);
    console.log('[scheduledDailyDebate] created', postId, '-', topic);
  } catch (e) {
    console.error('[scheduledDailyDebate] failed:', e.message);
  }
});

// ── 관리자 수동 생성 ──
exports.generateDebateNow = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 120,
  memory: '512MiB',
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');
  const adminSnap = await db.doc(`admins/${uid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자만 접근 가능해요');

  const customTopic = String(request.data?.topic || '').trim().slice(0, 100);
  const topic = customTopic || pickDailyTopic();

  const reqIds = Array.isArray(request.data?.characterIds)
    ? request.data.characterIds.filter(id => CHARACTERS[id])
    : [];
  const charIds = reqIds.length >= 2 ? [...new Set(reqIds)].slice(0, 6) : CHAR_LIST.map(c => c.id);

  try {
    const result = await generateDebatePost(topic, charIds);
    return { success: true, ...result };
  } catch (e) {
    console.error('[generateDebateNow] failed:', e.message);
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('internal', 'AI 티격태격 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
  }
});
