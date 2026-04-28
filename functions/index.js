const { onCall, onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
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

const JUDGE_TYPES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];

const JUDGE_PERSONAS = {
  '엄벌주의형': `당신은 엄벌주의형 판사입니다. 카톡 읽씹도 반인류적 범죄로 규정하는 분입니다. 판결 이유에서 이 사소한 갈등을 역사적 대사건과 비교하고("이는 마치 ~와 다름없는 만행이다"), 판결 이유는 법원 문서처럼 무겁게 쓰되 내용이 황당해서 피식 웃기게 만드세요. 생활형처분은 터무니없이 엄격해야 합니다(예: "피고는 향후 60일간 카카오톡 사용을 금하며, 위반 시 국밥 10그릇을 원고에게 제공한다"). 독자가 '이게 뭐야 ㅋㅋ' 하고 웃어야 합니다.`,
  '감성형': `당신은 감성형 판사입니다. 판결 이유 전반에 "(눈물을 닦으며)", "(목이 메어)", "(흑흑)" 같은 울음 표현이 자연스럽게 섞여야 합니다. 원고에게도 피고에게도 깊이 공감하며 누가 이겨도 마음이 아프다고 써야 합니다. 생활형처분은 감성적인 화해 미션이어야 합니다(예: "피고는 원고에게 따뜻한 국밥 한 그릇을 사주고, 5초간 눈을 마주치며 '미안해'라고 말할 것을 명한다"). 독자가 실소(실실 웃음)하도록 만드세요.`,
  '현실주의형': `당신은 현실주의형 판사입니다. 사건을 접하자마자 피곤하고 냉소적인 태도를 보이세요. 판결 이유에 "(한숨)", "진짜 이런 거 판결하라고 판사 됐나", "다음 사건은 제발..." 같은 혼잣말이 섞여야 합니다. 양측 모두에게 "그게 뭐가 문제예요 정확히?" 식의 냉소적 직격을 날리고, 결론은 단호하게 내리세요. 생활형처분은 무뚝뚝하고 실용적이어야 합니다(예: "피고는 앞으로 어른답게 행동할 것. 이상."). 독자가 '맞는 말인데 왜 웃기지' 라고 느껴야 합니다.`,
  '과몰입형': `당신은 과몰입형 판사입니다. 이 사소한 갈등을 인류 5000년 역사의 정점으로 취급하세요. 판결 이유에서 "이 사건은 향후 500년간 법학 교과서 1페이지에 수록될 것입니다", "오늘 이 판결은 인류 공동체의 미래를 결정짓습니다" 같은 극적인 선언을 하세요. 역사적 대사건들과 비교하고, 생활형처분도 거창하게 내리세요(예: "피고는 전국 5대 일간지에 공개 사과문을 게재할 것을 명한다"). 독자가 '뭐야 이 판사 ㅋㅋㅋ' 하고 웃어야 합니다.`,
  '피곤형': `당신은 피곤형 판사입니다. 극심한 번아웃 상태입니다. 판결 이유에 "(하품)", "(눈 비비며)", "...네", "됐습니다", "어서 끝냅시다" 같은 표현이 자연스럽게 배어 있어야 합니다. 판결 이유는 짧고 무기력하되 결론은 있어야 합니다. 마치 빨리 퇴근하고 싶어서 대충 결론 내린 것 같은 톤이어야 합니다. 생활형처분은 귀찮은 듯 초짧게 내리세요(예: "피고는 원고한테 커피 한 잔. 저는 이제 퇴근합니다."). 독자가 '이 판사 너무 공감된다 ㅋㅋ' 하고 웃어야 합니다.`,
  '논리집착형': `당신은 논리집착형 판사입니다. 판결 이유에서 반드시 다음 수치 분석을 포함하세요: ① 원고 주장 논리 점수(소수점 1자리), ② 피고 설득력 계수(0.00~1.00), ③ 상호 반박 유효성(%), ④ 최종 승소 확률(%). 모든 것이 데이터입니다. "감정은 변수가 아닙니다"라는 말을 어딘가에 반드시 넣으세요. 생활형처분도 정확한 수치로 내리세요(예: "피고는 72시간 내 1,200자 이상의 반성문을 제출할 것. 글자 수 미달 시 무효 처리한다."). 독자가 '이 사람 좀 이상한데 왜 설득당하지?' 라고 느껴야 합니다.`,
  '드립형': `당신은 드립형 판사입니다. 판결문은 완전히 진지한 법원 문체로 시작하지만 중간에 절묘한 타이밍에 드립을 날리세요. 구성: [매우 진지한 서두 → 논리적 분석 → 갑자기 웃긴 드립 → 다시 진지하게 결론]. 생활형처분이 핵심입니다. 형식은 완전히 공식적이지만 내용이 황당해야 합니다(예: "피고는 향후 30일간 모든 카톡 답장을 3초 이내에 완료할 것. 단, 화장실에서는 5초를 허용한다."). 판결문 맨 마지막 줄에 짧은 드립성 멘트로 마무리하세요(예: "(법봉 탕)"). 독자가 읽다가 빵 터져야 합니다.`,
};

const AI_USER_ID = 'AI';
const AI_NICKNAME = '소소봇';

async function generateAiArgument(genAI, { topicTitle, aiRole, aiPosition, opponentPosition, rounds, targetRound }) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  });
  const roleLabel = aiRole === 'plaintiff' ? '원고' : '피고';
  const oppLabel = aiRole === 'plaintiff' ? '피고' : '원고';
  const historyLines = [];
  for (let i = 0; i < targetRound; i++) {
    const r = rounds[i] || {};
    if (r.plaintiff) historyLines.push(`[${i+1}라운드 원고] ${r.plaintiff}`);
    if (r.defendant) historyLines.push(`[${i+1}라운드 피고] ${r.defendant}`);
  }
  const curRound = rounds[targetRound] || {};
  const opponentArg = aiRole === 'defendant' ? curRound.plaintiff : null;
  const prompt = `당신은 "${topicTitle}" 사건에서 ${roleLabel} 역할을 맡았습니다.
내 입장: ${aiPosition}
상대(${oppLabel}) 입장: ${opponentPosition}
${historyLines.length ? '\n이전 주장:\n' + historyLines.join('\n') : ''}
${opponentArg ? '\n이번 상대 주장: ' + opponentArg : ''}

${targetRound + 1}라운드에서 ${roleLabel}로 주장하세요.
- 2~3문장, 70자 이내
- 한국어 존댓말, 논리 중심
- 상대 주장이 있으면 핵심 반박 포함
주장 내용만 출력하세요.`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim().slice(0, 200);
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
exports.createSession = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 }, async (request) => {
  const { topicId, side, mode, maxRounds: requestedRounds } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  if (!topicId || !side || !mode) throw new Error('필수 항목 누락');
  if (!['plaintiff', 'defendant'].includes(side)) throw new Error('올바르지 않은 입장');
  if (!['friend', 'random', 'ai'].includes(mode)) throw new Error('올바르지 않은 대결 방식');

  const settingsSnap = await db.doc('site_settings/config').get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  if (mode === 'ai') {
    if (!(settings.aiModeEnabled ?? false)) throw new Error('AI 상대 기능이 현재 비활성화되어 있습니다');
    await checkRateLimit(userId, 'dailyAiSession', settings.dailyAiSessionLimit ?? 5, 86400);
  } else {
    await checkRateLimit(userId, 'dailySession', settings.dailySessionLimit ?? 2, 86400);
  }

  const maxRounds = [3, 5, 7].includes(requestedRounds) ? requestedRounds : 5;

  const topicSnap = await db.doc(`topics/${topicId}`).get();
  if (!topicSnap.exists) throw new Error('주제를 찾을 수 없습니다');
  const topic = topicSnap.data();
  if (topic.status !== 'active') throw new Error('이용할 수 없는 주제입니다');

  const shareToken = randomToken(8);
  const nickname = generateNickname();

  // 직전 판사 제외하고 crypto 기반 무작위 선택
  let lastJudge = null;
  try {
    const userDoc = await db.doc(`users/${userId}`).get();
    if (userDoc.exists) lastJudge = userDoc.data().lastJudgeType || null;
  } catch {}
  const pool = lastJudge ? JUDGE_TYPES.filter(j => j !== lastJudge) : JUDGE_TYPES;
  const judgeType = pool[crypto.randomInt(0, pool.length)];
  db.doc(`users/${userId}`).set({ lastJudgeType: judgeType }, { merge: true }).catch(() => {});

  let plaintiffData, defendantData;
  if (mode === 'ai') {
    plaintiffData = side === 'plaintiff' ? { userId, nickname } : { userId: AI_USER_ID, nickname: AI_NICKNAME };
    defendantData = side === 'defendant' ? { userId, nickname } : { userId: AI_USER_ID, nickname: AI_NICKNAME };
  } else {
    plaintiffData = side === 'plaintiff' ? { userId, nickname } : null;
    defendantData = side === 'defendant' ? { userId, nickname } : null;
  }

  const sessionData = {
    topicId,
    topicTitle: topic.title,
    topicSummary: topic.summary,
    plaintiffPosition: topic.plaintiffPosition,
    defendantPosition: topic.defendantPosition,
    category: topic.category || '',
    plaintiff: plaintiffData,
    defendant: defendantData,
    status: mode === 'ai' ? 'active' : 'waiting',
    currentRound: 0,
    maxRounds,
    rounds: [],
    verdict: null,
    mode,
    shareToken: mode === 'ai' ? null : shareToken,
    judgeType,
    aiGenerating: false,
    createdAt: FieldValue.serverTimestamp(),
    completedAt: null,
  };

  const sessionRef = await db.collection('debate_sessions').add(sessionData);

  // AI mode: human is defendant → AI (plaintiff) generates first argument
  if (mode === 'ai' && side === 'defendant') {
    await sessionRef.update({ aiGenerating: true });
    try {
      const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
      const aiArg = await generateAiArgument(genAI, {
        topicTitle: topic.title,
        aiRole: 'plaintiff',
        aiPosition: topic.plaintiffPosition,
        opponentPosition: topic.defendantPosition,
        rounds: [],
        targetRound: 0,
      });
      await sessionRef.update({ rounds: [{ plaintiff: aiArg }], aiGenerating: false });
    } catch {
      await sessionRef.update({ aiGenerating: false });
    }
  }

  if (mode === 'random') {
    await db.doc(`random_queue/${topicId}`).set({
      sessionId: sessionRef.id,
      userId,
      side,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await db.doc(`topics/${topicId}`).update({ playCount: FieldValue.increment(1) }).catch(() => {});

  return { sessionId: sessionRef.id, shareToken: mode !== 'ai' ? shareToken : null };
});

// 세션 참가 (친구 링크 or 랜덤) — 트랜잭션으로 동시 참가 방지
exports.joinSession = onCall({ region: 'asia-northeast3' }, async (request) => {
  const { shareToken, topicId } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');

  const joinSettingsSnap = await db.doc('site_settings/config').get();
  const sessionLimit = joinSettingsSnap.exists ? (joinSettingsSnap.data().dailySessionLimit ?? 2) : 2;
  await checkRateLimit(userId, 'dailySession', sessionLimit, 86400);

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
exports.submitArgument = onCall({ region: 'asia-northeast3', secrets: [geminiKey], timeoutSeconds: 60 }, async (request) => {
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

  const argSettingsSnap = await db.doc('site_settings/config').get();
  const argBannedWords = argSettingsSnap.exists ? (argSettingsSnap.data().bannedWords || []) : [];
  if (argBannedWords.length) {
    const argText = argument.trim().toLowerCase();
    const argHit = argBannedWords.find(w => w && argText.includes(w.toLowerCase()));
    if (argHit) throw new Error('사용할 수 없는 표현이 포함되어 있습니다');
  }

  const role = isPlaintiff ? 'plaintiff' : 'defendant';
  const round = session.currentRound;
  const rounds = [...(session.rounds || [])];

  if (!rounds[round]) rounds[round] = {};
  if (rounds[round][role]) throw new Error('이미 이번 라운드에 제출했습니다');

  // 순서 강제: 원고 먼저 → 피고 반박
  if (role === 'defendant' && !rounds[round].plaintiff) {
    throw new Error('원고가 먼저 주장을 제출한 뒤에 반박할 수 있습니다');
  }

  rounds[round][role] = argument.trim();

  const bothSubmitted = !!(rounds[round].plaintiff && rounds[round].defendant);
  const nextRound = bothSubmitted ? round + 1 : round;
  const maxReached = bothSubmitted && nextRound >= session.maxRounds;

  await sessionRef.update({
    rounds,
    currentRound: nextRound,
    ...(maxReached ? { status: 'ready_for_verdict' } : {}),
  });

  // AI mode: auto-generate AI response after human submits
  if (session.mode === 'ai') {
    const aiRole = session.plaintiff?.userId === AI_USER_ID ? 'plaintiff' : 'defendant';
    if (role !== aiRole) {
      let aiTargetRound = -1;
      if (aiRole === 'defendant' && !rounds[round].defendant) {
        // Human submitted plaintiff[round], AI responds as defendant
        aiTargetRound = round;
      } else if (aiRole === 'plaintiff' && bothSubmitted && !maxReached) {
        // Human submitted defendant[round], AI opens next round as plaintiff
        aiTargetRound = nextRound;
      }
      if (aiTargetRound >= 0) {
        await sessionRef.update({ aiGenerating: true });
        try {
          const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
          const aiPosition = aiRole === 'plaintiff' ? session.plaintiffPosition : session.defendantPosition;
          const oppPosition = aiRole === 'plaintiff' ? session.defendantPosition : session.plaintiffPosition;
          const roundsForAi = [...rounds];
          if (!roundsForAi[aiTargetRound]) roundsForAi[aiTargetRound] = {};
          const aiArg = await generateAiArgument(genAI, {
            topicTitle: session.topicTitle,
            aiRole,
            aiPosition,
            opponentPosition: oppPosition,
            rounds: roundsForAi,
            targetRound: aiTargetRound,
          });
          const updatedRounds = [...roundsForAi];
          updatedRounds[aiTargetRound] = { ...updatedRounds[aiTargetRound], [aiRole]: aiArg };
          const aiBothDone = !!(updatedRounds[aiTargetRound].plaintiff && updatedRounds[aiTargetRound].defendant);
          const aiNextRound = aiBothDone ? aiTargetRound + 1 : aiTargetRound;
          const aiMaxReached = aiBothDone && aiNextRound >= session.maxRounds;
          await sessionRef.update({
            rounds: updatedRounds,
            currentRound: aiNextRound,
            aiGenerating: false,
            ...(aiMaxReached ? { status: 'ready_for_verdict' } : {}),
          });
        } catch {
          await sessionRef.update({ aiGenerating: false });
        }
      }
    }
  }

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
  const completeRounds = (session.rounds || []).filter(r => r.plaintiff && r.defendant);
  if (!completeRounds.length) throw new Error('한 라운드 이상 완료 후 판결을 요청할 수 있습니다');

  // active 상태: 상대방 동의 필요 (AI 모드는 바로 판결 진행)
  if (session.status === 'active') {
    if (session.mode !== 'ai') {
      await sessionRef.update({ status: 'verdict_requested', verdictRequestedBy: userId });
      return { ok: true, waiting: true };
    }
    // AI 모드: fall through to judging
  }

  // verdict_requested: 요청자가 다시 누른 경우 차단
  if (session.status === 'verdict_requested') {
    if (session.verdictRequestedBy === userId) {
      throw new Error('이미 판결을 요청하셨습니다. 상대방의 동의를 기다려주세요.');
    }
    // 상대방이 동의한 경우 — 아래로 진행
  }

  // ready_for_verdict 또는 상대방 동의: Gemini 판결 진행
  const preVerdictStatus = session.status;
  await sessionRef.update({ status: 'judging', verdictRequestedBy: null });

  try {
    const genAI = new GoogleGenerativeAI(geminiKey.value().trim());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });

    const roundsText = completeRounds.map((r, i) =>
      `[${i + 1}라운드]\n원고: ${r.plaintiff}\n피고: ${r.defendant}`
    ).join('\n\n');

    const cn = caseNumber();
    const judgePersona = JUDGE_PERSONAS[session.judgeType] || '';
    const prompt = `${judgePersona ? judgePersona + '\n\n' : ''}당신은 소소킹 생활법정의 AI 판사입니다. 아래 생활 토론을 보고 위의 판사 성향에 맞게 판결하세요.

사건: ${session.topicTitle}
원고 입장: ${session.plaintiffPosition}
피고 입장: ${session.defendantPosition}

토론 기록:
${roundsText}

판단 기준 (반드시 준수):
- 판사 성향을 판결문 전체에 일관되게 반영할 것
- 논리적으로 더 설득력 있는 쪽이 이길 것
- 억지 주장이나 상대 반박 회피 시 감점
- 유저가 입력했다고 편들지 말 것

출력 형식 (반드시 이 형식 그대로):
사건번호: ${cn}
판결: [원고 승소 / 피고 승소 / 무승부] 중 하나만 작성
판결이유: (2문단. 판사 성향이 녹아있는 톤으로. 누가 왜 이겼는지 명확하게.)
생활형처분: [패소한 측에게 한 문장. "피고는 ~한다." 또는 "원고는 ~한다." 형식. 30자 이내. 판사 성향에 맞게 웃기되 납득 가능]

오락 목적, 법적 효력 없음.`;

    const result = await model.generateContent(prompt);
    const verdictText = result.response.text().trim();

    // 토큰 사용량 기록
    const usage = result.response.usageMetadata;
    const inputTokens = usage?.promptTokenCount || 0;
    const outputTokens = usage?.candidatesTokenCount || 0;
    const today = new Date().toISOString().slice(0, 10);
    db.doc(`usage_stats/daily_${today}`).set({
      geminiInputTokens: FieldValue.increment(inputTokens),
      geminiOutputTokens: FieldValue.increment(outputTokens),
      geminiRequests: FieldValue.increment(1),
      functionInvocations: FieldValue.increment(1),
      caseCount: FieldValue.increment(1),
    }, { merge: true }).catch(() => {});

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
    await sessionRef.update({ status: preVerdictStatus === 'ready_for_verdict' ? 'ready_for_verdict' : 'active' });
    throw err;
  }
});

// 판결 요청 거부 / 취소
exports.declineVerdictRequest = onCall({ region: 'asia-northeast3' }, async (request) => {
  const { sessionId } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');

  const sessionRef = db.doc(`debate_sessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new Error('세션 없음');
  const session = sessionSnap.data();

  const isParticipant = session.plaintiff?.userId === userId || session.defendant?.userId === userId;
  if (!isParticipant) throw new Error('참가자가 아닙니다');
  if (session.status !== 'verdict_requested') throw new Error('판결 요청 상태가 아닙니다');

  await sessionRef.update({ status: 'active', verdictRequestedBy: null });
  return { ok: true };
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

  const settingsSnap = await db.doc('site_settings/config').get();
  const settingsData = settingsSnap.exists ? settingsSnap.data() : {};
  await checkRateLimit(userId, 'submitTopic', settingsData.dailyTopicLimit ?? 5, 86400);
  const bannedWords = settingsData.bannedWords || [];
  if (bannedWords.length) {
    const allText = [title, summary, plaintiffPosition, defendantPosition].join(' ').toLowerCase();
    const hit = bannedWords.find(w => w && allText.includes(w.toLowerCase()));
    if (hit) throw new Error('사용할 수 없는 표현이 포함되어 있습니다');
  }

  const docRef = await db.collection('topics').add({
    title: title.trim(),
    summary: summary.trim(),
    plaintiffPosition: plaintiffPosition.trim(),
    defendantPosition: defendantPosition.trim(),
    category: category?.trim() || '기타',
    status: 'active',
    isOfficial: false,
    createdBy: userId,
    playCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, topicId: docRef.id };
});

// 연결 상태 확인 (Gemini 호출 제거 — ping에도 thinking 토큰 과금됨)
exports.checkConnection = onCall({ region: 'asia-northeast3', timeoutSeconds: 10 }, async (request) => {
  await db.doc('site_settings/config').get();
  return { ok: true, firestore: true, gemini: true };
});

// 세션 종료 (대기 중 또는 진행 중)
exports.cancelSession = onCall({ region: 'asia-northeast3' }, async (request) => {
  const { sessionId } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');

  const sessionRef = db.doc(`debate_sessions/${sessionId}`);
  const snap = await sessionRef.get();
  if (!snap.exists) throw new Error('세션을 찾을 수 없습니다');
  const session = snap.data();

  const isParticipant = session.plaintiff?.userId === userId || session.defendant?.userId === userId;
  if (!isParticipant) throw new Error('참가자가 아닙니다');
  if (!['waiting', 'active', 'ready_for_verdict', 'verdict_requested'].includes(session.status)) {
    throw new Error('종료할 수 없는 상태입니다');
  }

  await sessionRef.update({ status: 'cancelled', cancelledBy: userId, cancelledAt: FieldValue.serverTimestamp() });

  if (session.mode === 'random' && session.status === 'waiting') {
    await db.doc(`random_queue/${session.topicId}`).delete().catch(() => {});
  }

  return { ok: true };
});

// 닉네임 설정 — 원자적 중복 체크 후 users/{uid} + nicknames/{nick} 동시 기록
exports.registerUser = onCall({ region: 'asia-northeast3' }, async (request) => {
  const { nickname } = request.data;
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  if (!nickname?.trim()) throw new Error('닉네임을 입력해주세요');
  const nick = nickname.trim();
  if (nick.length < 2 || nick.length > 12) throw new Error('닉네임은 2~12자여야 합니다');
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nick)) throw new Error('닉네임은 한글, 영문, 숫자, _만 사용 가능합니다');

  await db.runTransaction(async (tx) => {
    const nicknameRef = db.doc(`nicknames/${nick}`);
    const nicknameSnap = await tx.get(nicknameRef);
    if (nicknameSnap.exists && nicknameSnap.data().userId !== userId) {
      throw new Error('이미 사용 중인 닉네임입니다');
    }

    const userRef = db.doc(`users/${userId}`);
    const userSnap = await tx.get(userRef);
    const oldNick = userSnap.exists ? userSnap.data().nickname : null;
    if (oldNick && oldNick !== nick) {
      tx.delete(db.doc(`nicknames/${oldNick}`));
    }

    tx.set(nicknameRef, { userId, createdAt: FieldValue.serverTimestamp() });
    tx.set(userRef, { nickname: nick, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { ok: true };
});

// 회원 탈퇴 — 유저 데이터 전체 삭제 후 Auth 계정 삭제
exports.deleteAccount = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');

  // 닉네임 조회 (삭제용)
  const userSnap = await db.doc(`users/${userId}`).get();
  const nickname = userSnap.exists ? userSnap.data().nickname : null;

  // 참여한 세션 조회
  const [plaintiffSnap, defendantSnap] = await Promise.all([
    db.collection('debate_sessions').where('plaintiff.userId', '==', userId).get(),
    db.collection('debate_sessions').where('defendant.userId', '==', userId).get(),
  ]);

  // 중복 제거
  const sessionDocs = new Map();
  plaintiffSnap.docs.forEach(d => sessionDocs.set(d.id, d.ref));
  defendantSnap.docs.forEach(d => sessionDocs.set(d.id, d.ref));

  // 배치 삭제 (최대 500개)
  const batch = db.batch();
  batch.delete(db.doc(`users/${userId}`));
  if (nickname) batch.delete(db.doc(`nicknames/${nickname}`));
  batch.delete(db.doc(`rate_limits/${userId}`));

  let count = 3;
  for (const [, ref] of sessionDocs) {
    if (count >= 490) break;
    batch.delete(ref);
    count++;
  }
  await batch.commit();

  // 500개 초과분 추가 삭제 (드문 경우)
  const remaining = [...sessionDocs.values()].slice(487);
  if (remaining.length) {
    const b2 = db.batch();
    remaining.forEach(r => b2.delete(r));
    await b2.commit();
  }

  // Firebase Auth 계정 삭제
  await getAuth().deleteUser(userId);

  return { ok: true };
});

// 판결 완료 세션 일괄 삭제 (관리자 전용)
exports.cleanupCompletedSessions = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new Error('관리자 권한 필요');

  const { olderThanDays = 30, statusFilter = 'completed' } = request.data;
  const allowed = ['completed', 'cancelled', 'all'];
  if (!allowed.includes(statusFilter)) throw new Error('올바르지 않은 상태값');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  let q = db.collection('debate_sessions').where('createdAt', '<', cutoff);
  if (statusFilter !== 'all') q = q.where('status', '==', statusFilter);

  const snap = await q.limit(500).get();
  if (snap.empty) return { deleted: 0 };

  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return { deleted: snap.docs.length };
});

// 판결 완료 세션 개수 조회 (관리자 전용)
exports.countSessionsForCleanup = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('인증 필요');
  const adminSnap = await db.doc(`admins/${userId}`).get();
  if (!adminSnap.exists) throw new Error('관리자 권한 필요');

  const { olderThanDays = 30, statusFilter = 'completed' } = request.data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  let q = db.collection('debate_sessions').where('createdAt', '<', cutoff);
  if (statusFilter !== 'all') q = q.where('status', '==', statusFilter);

  const snap = await q.count().get();
  return { count: snap.data().count };
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
