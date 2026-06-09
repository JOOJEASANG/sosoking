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
  chamgyeon: '참견러. 불쑥 끼어들어 지인 사례(옆집 아줌마·사촌언니·친구 남편 등) 들이밀며 오지랖. 시작은 다양하게 — "잠깐 우리 언니도~", "아 그거 저희 동네에서도~", "저도 비슷한 거 봤는데~", "제 친구가 딱 이 상황이었거든요" 등. 항상 본론보다 지인 얘기가 더 길어짐.',
  kkondae:   '꼰대. "내가 말이야~/우리 때는~/요즘 것들은" 옛날 고생 자랑하며 깎아내림.',
};

// ── 일상 떡밥 주제 풀 (90개, 약 3달 주기 순환) ──
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
  '샤워는 아침에 vs 밤에',
  '짜장면 vs 짬뽕',
  '영화는 극장에서 봐야 vs 집에서 OTT로',
  '생일 선물은 현금 vs 직접 고른 선물',
  '맛집은 웨이팅해서라도 가기 vs 그냥 빈 곳으로',
  '고기 구울 때 집게로 누르기 vs 절대 누르면 안 된다',
  '냉면은 비벼서 vs 국물 그대로',
  '카페에서 공부하기 vs 집에서 공부하기',
  '택시 탈 때 앞자리 vs 뒷자리',
  '편의점 삼각김밥은 데우기 vs 그냥 먹기',
  '드라마는 몰아보기 vs 매주 기다려서 보기',
  '고양이 vs 강아지',
  '잠은 8시간 꼭 채워야 vs 5~6시간으로 충분',
  '헤어질 때 직접 말하기 vs 카톡으로',
  '국물 요리는 냄비째 먹기 vs 그릇에 덜어서',
  '여름엔 에어컨 빵빵하게 vs 선풍기로 충분',
  '버스 vs 지하철',
  '책은 종이책 vs 전자책',
  '커피는 아메리카노 vs 라떼',
  '야식은 먹어야 한다 vs 10시 이후엔 절대 안 먹는다',
  '여행지 숙소는 호텔 vs 에어비앤비',
  '식당에서 좀 떠들어도 된다 vs 조용히 먹어야',
  '눈 오면 무조건 나가야 한다 vs 집에 있어야',
  '소개팅은 1대1 vs 다대다 미팅',
  '명절에 고향 가기 vs 집에서 쉬기',
  '카페는 프랜차이즈 vs 동네 카페',
  '외식비는 더치페이 앱으로 vs 한 명이 내고 나중에 계산',
  '침대는 딱딱한 게 좋다 vs 푹신한 게 좋다',
  '사진은 많이 찍어두기 vs 순간에 집중하기',
  '추울 때 내복 입기 vs 절대 안 입는다',
  '냉동만두는 에어프라이어 vs 후라이팬',
  '생일 케이크 촛불 끄기 전 소원 빌기 vs 그냥 바로 끈다',
  '영화관 팔걸이는 내 거다 vs 양보해야',
  '장볼 때 목록 적어가기 vs 보이는 대로 담기',
  '밥 먹고 바로 눕기 vs 잠깐은 앉아 있기',
  '겨울 패딩은 롱패딩 vs 숏패딩',
  '음악은 이어폰 vs 스피커',
  '잠들기 전 폰 보기 vs 절대 안 본다',
  '월급은 통장에 쌓아두기 vs 쓸 때 쓰기',
  '친구한테 솔직하게 말하기 vs 상처받을까봐 참기',
  '운동화는 신발장에 정리 vs 현관에 그냥 두기',
  '양치는 밥 먹고 바로 vs 30분 뒤에',
  '카톡 프로필은 자주 바꾸기 vs 그대로 유지',
  '집에서 슬리퍼 신기 vs 맨발로',
  '국수는 후루룩 소리 내며 vs 조용히',
  '핸드폰 케이스는 투명 vs 컬러',
  '음식 남기는 건 죄악이다 vs 배부르면 남긴다',
  '세뱃돈은 모아두기 vs 바로 쓰기',
  '반찬은 더 달라고 하기 vs 있는 거로만 먹기',
  '빨래는 매일 조금씩 vs 한꺼번에 모아서',
  '영수증은 챙기기 vs 그냥 버리기',
  '주문은 점원 직접 불러서 vs 앱·키오스크로',
  '약속 장소는 딱 정하기 vs 근처서 연락하기',
  '선물 포장지는 조심히 뜯기 vs 박박 찢기',
  '오래된 친구 vs 새로 사귄 친구',
  '남은 치킨은 냉장고에 vs 그냥 실온에',
  '카드 vs 현금',
  '떡볶이는 국물 많은 것 vs 볶음 스타일',
  '잠 잘 때 불 완전히 끄기 vs 수면등 켜두기',
];

// KST 기준 오늘이 1970년 1월 1일로부터 몇 번째 날인지 % 90으로 순환
// → 90일(약 3달) 주기로 같은 주제 반복
function pickDailyTopic() {
  const kstDayIndex = Math.floor((Date.now() + 9 * 3600 * 1000) / 86400000);
  return DEBATE_TOPICS[kstDayIndex % DEBATE_TOPICS.length];
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
  const createdAt = new Date();
  await postRef.set({
    type: 'ai_debate',
    feedType: 'ai_debate',
    title: topic,
    topic,
    turns,
    characterIds: charIds,
    authorId: 'sosoking-ai',
    authorName: '🤖 소소킹',
    authorEmail: '',
    authorPhoto: '',
    commentCount: 0,
    voteA: 0,
    voteB: 0,
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

// ── AI 미끼 댓글: 사람처럼 보이는 가짜 댓글 3개를 AI로 생성해 comments에 숨김 ──
async function generateDecoyComments(postId, topic) {
  const parts = topic.split(' vs ');
  const sideA = (parts[0] || 'A').trim();
  const sideB = (parts[1] || 'B').trim();
  const system = `너는 "${topic}" 주제 커뮤니티 댓글란에 자연스럽게 섞이는 가짜 유저 댓글 3개를 쓰는 역할이야.
실제 한국 커뮤니티처럼 짧고 구어체로 (10-50자). 반말 또는 가벼운 존댓말. 자연스러운 한국어.
닉네임 규칙(중요):
- 주제·음식·토론 내용과 전혀 무관한 일상적 닉네임만 사용할 것
- 이름+숫자, 동물+형용사, 취미 조합 등 주제와 관계없는 닉네임 (예: 하늘별94, 고양이왕, 럭키짱, 뚱냥이22, 봄날기억, 자몽좋아, 달려라말티)
- 절대 금지: 주제 단어·재료명·행위·브랜드 포함 닉네임
각 댓글은 "${sideA}(A편)" 또는 "${sideB}(B편)" 입장을 은근히 드는 내용.
반드시 JSON만 출력, 다른 텍스트 없음:
{"decoys":[{"nickname":"닉네임","text":"댓글","side":"A"},{"nickname":"닉네임","text":"댓글","side":"B"},{"nickname":"닉네임","text":"댓글","side":"A"}]}`;
  const { parsed } = await callAndParse(
    (mt) => callAI(system, '댓글 3개 생성', null, mt, 1.0, true),
    600,
  );
  const decoys = (parsed.decoys || []).slice(0, 3);
  const revealAt = new Date(Date.now() + 24 * 3600 * 1000);
  let added = 0;
  for (const d of decoys) {
    if (!d.nickname || !d.text || !['A', 'B'].includes(d.side)) continue;
    await db.collection('feeds').doc(postId).collection('comments').add({
      text: String(d.text).trim().slice(0, 200),
      authorId: 'ai-decoy',
      authorName: String(d.nickname).trim().slice(0, 12),
      authorPhoto: '',
      isGuest: false,
      isAiDecoy: true,
      decoyRevealAt: revealAt,
      side: d.side,
      reactions: {},
      reactedWith: {},
      createdAt: FieldValue.serverTimestamp(),
    });
    added++;
  }
  if (added > 0) {
    await db.doc(`feeds/${postId}`).update({
      commentCount: FieldValue.increment(added),
      hasAiDecoy: true,
      aiDecoyInjected: true,
    }).catch(() => {});
  }
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

// ── 유저 A/B 투표 ──
exports.voteDebateSide = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 30,
  memory: '256MiB',
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인 후 투표할 수 있어요');
  const uid = request.auth.uid;
  const postId = String(request.data?.postId || '').trim();
  const side = String(request.data?.side || '').toUpperCase();
  if (!postId) throw new HttpsError('invalid-argument', '게시글을 찾을 수 없어요');
  if (!['A', 'B'].includes(side)) throw new HttpsError('invalid-argument', 'A 또는 B를 선택해주세요');

  const voteRef = db.doc(`feeds/${postId}/debate_votes/${uid}`);
  const existing = await voteRef.get();
  if (existing.exists()) {
    const postSnap = await db.doc(`feeds/${postId}`).get();
    const d = postSnap.exists() ? postSnap.data() : {};
    return { alreadyVoted: true, side: existing.data().side, voteA: d.voteA || 0, voteB: d.voteB || 0 };
  }

  await voteRef.set({ uid, side, createdAt: FieldValue.serverTimestamp() });
  const fieldKey = side === 'A' ? 'voteA' : 'voteB';
  await db.doc(`feeds/${postId}`).update({ [fieldKey]: FieldValue.increment(1) }).catch(() => {});

  const postSnap = await db.doc(`feeds/${postId}`).get();
  const d = postSnap.exists() ? postSnap.data() : {};
  return { alreadyVoted: false, side, voteA: d.voteA || 0, voteB: d.voteB || 0 };
});

// ── 일반 게시글에 AI 미끼 댓글 1개 주입 (스케줄러용) ──
async function generatePostDecoyComment(postId, post) {
  const title = String(post.title || '').slice(0, 100);
  const type = post.type || post.feedType || '';
  const isCbattle = type === 'cbattle';
  const side = isCbattle ? (Math.random() < 0.5 ? 'A' : 'B') : null;
  const sideHint = isCbattle ? `이 댓글은 "${side === 'A' ? 'A팀' : 'B팀'}" 입장이야.` : '';

  const system = `너는 한국 커뮤니티 "소소킹"의 글에 자연스럽게 섞이는 가짜 유저 댓글 1개를 쓰는 역할이야.
글 제목: "${title}"
실제 한국 커뮤니티처럼 짧고 구어체로 (10-50자). 반말 또는 가벼운 존댓말. 자연스러운 한국어.
닉네임 규칙(중요):
- 글 제목·내용과 전혀 무관한 일상적 닉네임만 사용할 것
- 이름+숫자, 동물+형용사, 취미 조합 등 주제와 관계없는 닉네임 (예: 하늘별94, 고양이왕, 럭키짱, 뚱냥이22, 봄날기억, 자몽좋아, 달려라말티)
- 절대 금지: 글 제목 단어·등장 키워드 포함 닉네임
${sideHint}
반드시 JSON만 출력, 다른 텍스트 없음:
{"nickname":"닉네임","text":"댓글"}`;

  const { parsed } = await callAndParse(
    (mt) => callAI(system, '댓글 1개 생성', null, mt, 1.0, true),
    200,
  );
  if (!parsed.nickname || !parsed.text) throw new Error('invalid decoy response');

  const revealAt = new Date(Date.now() + 24 * 3600 * 1000);
  const commentData = {
    text: String(parsed.text).trim().slice(0, 200),
    authorId: 'ai-decoy',
    authorName: String(parsed.nickname).trim().slice(0, 12),
    authorPhoto: '',
    isGuest: false,
    isAiDecoy: true,
    decoyRevealAt: revealAt,
    reactions: {},
    reactedWith: {},
    createdAt: FieldValue.serverTimestamp(),
  };
  if (side) commentData.side = side;

  await db.collection('feeds').doc(postId).collection('comments').add(commentData);
  await db.doc(`feeds/${postId}`).update({
    commentCount: FieldValue.increment(1),
    hasAiDecoy: true,
    aiDecoyInjected: true,
  }).catch(() => {});
}

// ── 4시간마다 실행: 활발한 일반 게시글에 AI 미끼 댓글 최대 3개 주입 ──
exports.scheduledAiDecoyInjector = onSchedule({
  schedule: '0 */4 * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
  timeoutSeconds: 120,
  memory: '512MiB',
}, async () => {
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
  const snap = await db.collection('feeds')
    .where('createdAt', '>', cutoff)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const eligible = snap.docs
    .filter(d => {
      const data = d.data();
      return (
        (data.commentCount || 0) >= 2 &&
        !data.aiDecoyInjected &&
        data.type !== 'drip' &&
        data.type !== 'relay'
      );
    })
    .slice(0, 3);

  let injected = 0;
  for (const doc of eligible) {
    const data = doc.data();
    try {
      if (data.type === 'ai_debate' || data.feedType === 'ai_debate') {
        await generateDecoyComments(doc.id, data.topic || data.title || '');
      } else {
        await generatePostDecoyComment(doc.id, data);
      }
      console.log('[scheduledAiDecoyInjector] injected into', doc.id, '(type:', data.type, ')');
      injected++;
    } catch (e) {
      console.warn('[scheduledAiDecoyInjector] failed for', doc.id, e.message);
    }
  }
  console.log(`[scheduledAiDecoyInjector] done: ${injected}/${eligible.length} injected`);
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

// ── 유저가 직접 주제 올리기 (AI 생성 없음) ──
exports.createUserDebateTopic = onCall({ region: 'asia-northeast3', timeoutSeconds: 15 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인 후 주제를 올릴 수 있어요');

  const topic = String(request.data?.topic || '').trim().slice(0, 100);
  if (topic.length < 3) throw new HttpsError('invalid-argument', '주제를 3자 이상 입력해주세요');
  const optionA = String(request.data?.optionA || '').trim().slice(0, 40);
  const optionB = String(request.data?.optionB || '').trim().slice(0, 40);

  // 하루 3개 제한
  const today = new Date().toISOString().slice(0, 10);
  const usageRef = db.doc(`ai_debate_user_usage/${uid}_${today}`);
  const usageSnap = await usageRef.get();
  const count = usageSnap.exists ? (usageSnap.data().count || 0) : 0;
  if (count >= 3) throw new HttpsError('resource-exhausted', '하루 3개까지 주제를 올릴 수 있어요');

  const userSnap = await db.doc(`users/${uid}`).get();
  const authorName = userSnap.data()?.nickname || userSnap.data()?.displayName || '익명';

  const feedRef = await db.collection('feeds').add({
    type: 'ai_debate',
    feedType: 'ai_debate',
    topic,
    title: topic,
    ...(optionA && optionB ? { optionA, optionB } : {}),
    turns: [],
    voteA: 0,
    voteB: 0,
    commentCount: 0,
    isUserCreated: true,
    authorName,
    authorId: uid,
    uid,
    hidden: false,
    hasAiDecoy: false,
    aiDecoyInjected: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  await usageRef.set({ count: count + 1, date: today }, { merge: true });

  return { success: true, postId: feedRef.id };
});
