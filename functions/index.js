const { onCall, onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');

function randomToken(len = 8) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len).toUpperCase();
}

function caseNumber() {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `소소 ${year}-제${num}호`;
}

const NICK_ADJ = ['억울한','분노한','황당한','지친','당당한','기막힌','논리적인','감성적인','당황한','뻔뻔한'];
const NICK_NOUN = ['직장인','집사','아무개','라면러버','과자지킴이','냉장고파수꾼','에어컨전사','이불킥전문기','치킨수호자','더치페이거부자'];
function generateNickname() {
  return NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)] + NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
}

async function checkRateLimit(userId, action, maxCount, windowSeconds) {
  const ref = db.doc(`rate_limits/${userId}`);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const timestamps = (data[action] || []).filter(ts => ts > now - windowMs);
    if (timestamps.length >= maxCount) {
      throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    tx.set(ref, { [action]: [...timestamps, now] }, { merge: true });
  });
}

// 새 토론 세션 생성
exports.createSession = onCall({ region: 'asia-northeast3' }, async (request) => {
  const { topicId, side, mode } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  if (!topicId || !side || !mode) throw new Error('필수 항목 누락');
  if (!['plaintiff', 'defendant'].includes(side)) throw new Error('올바르지 않은 입장');
  if (!['friend', 'random'].includes(mode)) throw new Error('올바르지 않은 대결 방식');

  const topicSnap = await db.doc(`topics/${topicId}`).get();
  if (!topicSnap.exists) throw new Error('주제를 찾을 수 없습니다');
  const topic = topicSnap.data();
  if (topic.status !== 'active') throw new Error('이용할 수 없는 주제입니다');

  const shareToken = randomToken(8);
  const nickname = generateNickname();

  const sessionData = {
    topicId,
    topicTitle: topic.title,
    topicSummary: topic.summary,
    plaintiffPosition: topic.plaintiffPosition,
    defendantPosition: topic.defendantPosition,
    category: topic.category || '',
    plaintiff: side === 'plaintiff' ? { userId, nickname } : null,
    defendant: side === 'defendant' ? { userId, nickname } : null,
    status: 'waiting',
    currentRound: 0,
    maxRounds: 2,
    rounds: [],
    verdict: null,
    mode,
    shareToken,
    createdAt: FieldValue.serverTimestamp(),
    completedAt: null,
  };

  const sessionRef = await db.collection('debate_sessions').add(sessionData);

  if (mode === 'random') {
    await db.doc(`random_queue/${topicId}`).set({
      sessionId: sessionRef.id,
      userId,
      side,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await db.doc(`topics/${topicId}`).update({ playCount: FieldValue.increment(1) }).catch(() => {});

  return { sessionId: sessionRef.id, shareToken };
});

// 세션 참가 (친구 링크 or 랜덤) — 트랜잭션으로 동시 참가 방지
exports.joinSession = onCall({ region: 'asia-northeast3' }, async (request) => {
  const { shareToken, topicId } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');

  if (shareToken) {
    const q = await db.collection('debate_sessions')
      .where('shareToken', '==', shareToken)
      .where('status', '==', 'waiting')
      .limit(1)
      .get();
    if (q.empty) throw new Error('세션을 찾을 수 없거나 이미 시작되었습니다');
    const sessionId = q.docs[0].id;
    const sessionRef = db.doc(`debate_sessions/${sessionId}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) throw new Error('세션을 찾을 수 없습니다');
      const session = snap.data();
      if (session.status !== 'waiting') throw new Error('세션이 이미 시작되었습니다');
      if (session.plaintiff?.userId === userId || session.defendant?.userId === userId) return;
      const nickname = generateNickname();
      if (!session.plaintiff) {
        tx.update(sessionRef, { plaintiff: { userId, nickname }, status: 'active' });
      } else if (!session.defendant) {
        tx.update(sessionRef, { defendant: { userId, nickname }, status: 'active' });
      } else {
        throw new Error('세션이 꽉 찼습니다');
      }
    });
    return { sessionId };

  } else if (topicId) {
    const queueRef = db.doc(`random_queue/${topicId}`);
    let sessionId;

    await db.runTransaction(async (tx) => {
      const queueSnap = await tx.get(queueRef);
      if (!queueSnap.exists) throw new Error('대기 중인 상대가 없습니다');
      const queueData = queueSnap.data();
      if (queueData.userId === userId) throw new Error('자신의 세션에 참가할 수 없습니다');
      const sessionRef = db.doc(`debate_sessions/${queueData.sessionId}`);
      const sessionSnap = await tx.get(sessionRef);
      if (!sessionSnap.exists || sessionSnap.data().status !== 'waiting') {
        throw new Error('세션이 더 이상 유효하지 않습니다');
      }
      sessionId = queueData.sessionId;
      const session = sessionSnap.data();
      const nickname = generateNickname();
      let updateData;
      if (!session.plaintiff) {
        updateData = { plaintiff: { userId, nickname }, status: 'active' };
      } else if (!session.defendant) {
        updateData = { defendant: { userId, nickname }, status: 'active' };
      } else {
        throw new Error('세션이 꽉 찼습니다');
      }
      tx.update(sessionRef, updateData);
      tx.delete(queueRef);
    });
    return { sessionId };

  } else {
    throw new Error('shareToken 또는 topicId 필요');
  }
});

// 라운드 주장 제출
exports.submitArgument = onCall({ region: 'asia-northeast3' }, async (request) => {
  const { sessionId, argument } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  if (!sessionId || !argument?.trim()) throw new Error('필수 항목 누락');
  if (argument.trim().length < 5) throw new Error('주장이 너무 짧습니다');
  if (argument.length > 200) throw new Error('주장이 너무 깁니다 (최대 200자)');

  const sessionRef = db.doc(`debate_sessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error('세션 없음');
  const session = sessionSnap.data();

  if (!['active', 'ready_for_verdict'].includes(session.status)) throw new Error('진행 중인 세션이 아닙니다');

  const isPlaintiff = session.plaintiff?.userId === userId;
  const isDefendant = session.defendant?.userId === userId;
  if (!isPlaintiff && !isDefendant) throw new Error('참가자가 아닙니다');

  const role = isPlaintiff ? 'plaintiff' : 'defendant';
  const round = session.currentRound;
  const rounds = [...(session.rounds || [])];

  if (!rounds[round]) rounds[round] = {};
  if (rounds[round][role]) throw new Error('이미 이번 라운드에 제출했습니다');

  rounds[round][role] = argument.trim();

  const bothSubmitted = !!(rounds[round].plaintiff && rounds[round].defendant);
  const nextRound = bothSubmitted ? round + 1 : round;
  const maxReached = bothSubmitted && nextRound >= session.maxRounds;

  await sessionRef.update({
    rounds,
    currentRound: nextRound,
    ...(maxReached ? { status: 'ready_for_verdict' } : {}),
  });

  return { ok: true, bothSubmitted, maxReached };
});

// AI 판결 요청
exports.requestVerdict = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  const { sessionId } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');

  await checkRateLimit(userId, 'requestVerdict', 10, 86400);

  const sessionRef = db.doc(`debate_sessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error('세션 없음');
  const session = sessionSnap.data();

  const isParticipant = session.plaintiff?.userId === userId || session.defendant?.userId === userId;
  if (!isParticipant) throw new Error('참가자가 아닙니다');
  if (['judging', 'completed'].includes(session.status)) return { ok: true };
  if (!session.rounds?.length) throw new Error('아직 제출된 주장이 없습니다');

  await sessionRef.update({ status: 'judging' });

  try {
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const roundsText = session.rounds.map((r, i) =>
      `[${i + 1}라운드]\n원고: ${r.plaintiff || '(발언 없음)'}\n피고: ${r.defendant || '(발언 없음)'}`
    ).join('\n\n');

    const cn = caseNumber();
    const prompt = `당신은 소소킹 생활법정의 AI 판사입니다. 아래 생활 토론을 보고 공정하게 판결하세요.

사건: ${session.topicTitle}
원고 입장: ${session.plaintiffPosition}
피고 입장: ${session.defendantPosition}

토론 기록:
${roundsText}

판단 기준 (반드시 준수):
- 감정이 아닌 논리와 일관성으로 판단
- 억울하다고 무조건 이기는 구조 금지
- 억지 주장이나 상대 반박 회피 시 감점
- 상식적 맥락 고려
- 유저가 입력했다고 편들지 말 것

출력 형식 (반드시 이 형식 그대로):
사건번호: ${cn}
판결: [원고 승소 / 피고 승소 / 무승부] 중 하나만 작성
판결이유: (2문단. 진지한 법원 문서 톤이지만 읽으면 피식. 누가 왜 이겼는지 명확하게.)
생활형처분: [패소한 측에게 한 문장. "피고는 ~한다." 또는 "원고는 ~한다." 형식. 30자 이내. 웃기되 납득 가능]

오락 목적, 법적 효력 없음.`;

    const result = await model.generateContent(prompt);
    const verdictText = result.response.text().trim();

    let winner = 'draw';
    if (verdictText.includes('원고 승소')) winner = 'plaintiff';
    else if (verdictText.includes('피고 승소')) winner = 'defendant';

    await sessionRef.update({
      status: 'completed',
      verdict: { text: verdictText, winner, caseNumber: cn },
      completedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  } catch (err) {
    await sessionRef.update({ status: 'active' });
    throw err;
  }
});

// 유저 주제 등록 신청
exports.submitTopic = onCall({ region: 'asia-northeast3' }, async (request) => {
  const { title, summary, plaintiffPosition, defendantPosition, category } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  if (!title?.trim() || !summary?.trim() || !plaintiffPosition?.trim() || !defendantPosition?.trim()) {
    throw new Error('필수 항목을 모두 입력해주세요');
  }
  if (title.length > 30) throw new Error('사건명은 30자 이내');
  if (summary.length > 60) throw new Error('한 줄 요약은 60자 이내');
  if (plaintiffPosition.length > 100) throw new Error('원고 입장은 100자 이내');
  if (defendantPosition.length > 100) throw new Error('피고 입장은 100자 이내');

  await checkRateLimit(userId, 'submitTopic', 5, 86400);

  await db.collection('topics').add({
    title: title.trim(),
    summary: summary.trim(),
    plaintiffPosition: plaintiffPosition.trim(),
    defendantPosition: defendantPosition.trim(),
    category: category?.trim() || '기타',
    status: 'pending',
    isOfficial: false,
    createdBy: userId,
    playCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

// 연결 상태 확인
exports.checkConnection = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  const status = { firestore: false, gemini: false };
  await db.doc('site_settings/config').get();
  status.firestore = true;
  const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  await model.generateContent('ping');
  status.gemini = true;
  return { ok: true, ...status };
});

// 주제 초기 데이터 삽입 — 한 번만 실행 (site_settings/seed_v2 로 중복 방지)
const SEED_TOPICS_V2 = [
  { title: '사과 껍질 무죄 주장 사건', summary: '사과는 껍질째 먹는 게 맞는가, 깎아 먹는 게 맞는가', plaintiffPosition: '껍질에 농약이 다 있다, 꼭 깎아 먹어야 위생적이다', defendantPosition: '껍질에 영양소가 다 몰려 있다, 그냥 먹는 게 정답이다', category: '음식' },
  { title: '수박 씨 삼키기 무죄 주장 사건', summary: '수박 씨는 뱉어야 하는가, 그냥 삼켜도 되는가', plaintiffPosition: '씨는 뱉는 게 기본 식사 예절이다', defendantPosition: '그냥 삼키면 되는데 뱉는 게 오히려 비위생적이다', category: '음식' },
  { title: '피자 도우 끝부분 유기 사건', summary: '피자 끝 도우 부분을 남기는 게 낭비인가, 취향인가', plaintiffPosition: '도우까지 먹어야 한 판을 다 먹은 것이다, 남기면 낭비다', defendantPosition: '피자는 안쪽이 맛있는 거다, 도우 남기는 건 취향이다', category: '음식' },
  { title: '라면 스프 투입 순서 분쟁', summary: '라면 끓일 때 스프를 먼저 넣는가, 면을 먼저 넣는가', plaintiffPosition: '스프를 먼저 넣어야 물에 잘 녹아 맛이 배인다', defendantPosition: '면을 먼저 넣고 나중에 스프를 넣어야 면이 덜 붇는다', category: '음식' },
  { title: '과자 봉지 털어먹기 무죄 사건', summary: '과자 부스러기를 봉지째 털어 먹는 게 맞는가', plaintiffPosition: '봉지째 털어 먹으면 손도 안 더럽고 남기지도 않아 완벽하다', defendantPosition: '식사 예절상 봉지째 털어 먹는 건 보기 안 좋다, 손가락으로 집어먹어야 한다', category: '음식' },
  { title: '초코파이 해체 취식 사건', summary: '초코파이는 한 입에 먹는가, 뜯어서 먹는가', plaintiffPosition: '한 입에 통째로 먹어야 초코파이 본연의 맛이 난다', defendantPosition: '뜯어서 초콜릿, 빵, 마시멜로를 따로 즐기는 게 진짜 즐기는 것이다', category: '음식' },
  { title: '전화 거부 후 문자 "왜요?" 무례 사건', summary: '전화 안 받고 문자로 "왜요?"만 보내는 게 실례인가', plaintiffPosition: '전화를 받지 않으면서 문자로 "왜요?"는 너무 무례하다', defendantPosition: '전화가 부담스러울 수 있다, 문자로 대신하는 건 이해할 수 있다', category: '카톡' },
  { title: '소수점 더치페이 반올림 거부 사건', summary: '더치페이 1원까지 딱 맞게 해야 하는가, 반올림해도 되는가', plaintiffPosition: '공평함이 최고다, 1원까지 정확하게 나눠야 한다', defendantPosition: '1원 단위로 따지는 건 관계를 불편하게 만든다, 반올림이 낫다', category: '정산' },
  { title: '이불 독차지 무의식 무죄 사건', summary: '자다가 이불을 독차지하는 것도 잘못인가', plaintiffPosition: '자다가 이불 뺏기는 사람 고통을 생각해야 한다, 자기 전에 조심해야 한다', defendantPosition: '자면서 하는 행동을 어떻게 의식하나, 무의식이라 무죄다', category: '생활' },
  { title: '라면 국물 동반자 취식 사건', summary: '같이 먹는 사람 라면 국물을 허락 없이 먹어도 되는가', plaintiffPosition: '같이 먹는 자리에서 국물 한 숟갈은 애교다, 문제없다', defendantPosition: '내 라면은 내 것이다, 달라고 하면 몰라도 허락 없이는 안 된다', category: '음식' },
];

exports.seedTopicsV2 = onRequest({ region: 'asia-northeast3' }, async (req, res) => {
  const marker = await db.doc('site_settings/seed_v2').get();
  if (marker.exists) {
    res.json({ ok: false, message: '이미 실행됨' });
    return;
  }
  const batch = db.batch();
  for (const topic of SEED_TOPICS_V2) {
    batch.set(db.collection('topics').doc(), {
      ...topic,
      status: 'active',
      isOfficial: true,
      playCount: 0,
      createdBy: 'system',
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  batch.set(db.doc('site_settings/seed_v2'), { seededAt: FieldValue.serverTimestamp() });
  await batch.commit();
  res.json({ ok: true, added: SEED_TOPICS_V2.length });
});
