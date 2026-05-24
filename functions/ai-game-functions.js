'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const AI_NAMES = [
  '수상한자', '정체불명', '알쏭달쏭', '미지인', '의심씨',
  '숨은자', '모르는척', '신비로운자', '의문의인물', '수수께끼',
];

function randomAiName() {
  const base = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
  return `${base}${Math.floor(Math.random() * 900 + 100)}`;
}

async function getAiKey() {
  try {
    const snap = await db.doc('config/ai').get();
    const key = snap.data()?.apiKey;
    if (key && key.length > 10) return key.trim();
  } catch {}
  try { return geminiKey.value().trim(); } catch { return null; }
}

// 방장이 게임 시작 전 AI 플레이어를 방에 추가
const addAiGamePlayer = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 15 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { roomId, difficulty } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomSnap = await db.doc(`game_rooms/${roomId}`).get();
  if (!roomSnap.exists) throw new HttpsError('not-found', '방을 찾을 수 없어요');
  const room = roomSnap.data();
  if (room.hostId !== uid) throw new HttpsError('permission-denied', '방장만 AI를 추가할 수 있어요');
  if (room.aiPlayerUid) return { ok: true, aiUid: room.aiPlayerUid, aiName: room.aiPlayerName };

  const aiUid = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const aiName = randomAiName();

  await db.doc(`game_rooms/${roomId}/players/${aiUid}`).set({
    uid: aiUid,
    name: aiName,
    role: 'player',
    assignedRole: '',
    alive: true,
    wordSeen: false,
    votedFor: '',
    isAI: true,
    joinedAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`game_rooms/${roomId}`).update({
    aiPlayerUid: aiUid,
    aiPlayerName: aiName,
    aiDifficulty: difficulty || 'normal',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, aiUid, aiName };
});

// AI 채팅 응답 생성
const generateAiGameChat = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 20 }, async (request) => {
  const { roomId } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomSnap = await db.doc(`game_rooms/${roomId}`).get();
  if (!roomSnap.exists) return { ok: false, reason: 'room_not_found' };
  const room = roomSnap.data();

  if (room.status !== 'playing') return { ok: false, reason: 'not_playing' };
  if (!room.aiPlayerUid) return { ok: false, reason: 'no_ai' };

  // 8초 레이트 리밋
  const lastAt = room.aiLastChatAt?.toMillis?.() || 0;
  if (Date.now() - lastAt < 8000) return { ok: false, reason: 'rate_limited' };

  const chatsSnap = await db.collection(`game_rooms/${roomId}/chats`)
    .orderBy('createdAt', 'desc').limit(7).get();
  const recentChats = chatsSnap.docs.reverse().map(d => d.data());

  const lastMsg = recentChats[recentChats.length - 1];
  if (lastMsg?.uid === room.aiPlayerUid) return { ok: false, reason: 'ai_was_last' };

  const apiKey = await getAiKey();
  if (!apiKey) return { ok: false, reason: 'no_key' };

  const difficulty = room.aiDifficulty || 'normal';
  const aiName = room.aiPlayerName || 'AI';
  const chatContext = recentChats
    .filter(c => c.type !== 'system')
    .slice(-5)
    .map(c => `${c.name}: ${c.text}`)
    .join('\n');

  let prompt = '';
  if (room.game === 'liar') {
    prompt = buildLiarPrompt(room.topic || room.category || '음식', chatContext, difficulty);
  } else if (room.game === 'mafia') {
    prompt = buildMafiaPrompt(chatContext, difficulty, room.day || 1);
  }

  if (!prompt) return { ok: false, reason: 'no_prompt' };

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 80 },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^["'「『]|["'」』]$/g, '')
      .replace(/^(AI:|나:|저:|응답:)\s*/i, '')
      .slice(0, 60);

    if (!text) return { ok: false, reason: 'empty' };

    await db.collection(`game_rooms/${roomId}/chats`).add({
      uid: room.aiPlayerUid,
      name: aiName,
      text,
      type: 'chat',
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.doc(`game_rooms/${roomId}`).update({
      aiLastChatAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, text };
  } catch (e) {
    console.error('[AI game chat]', e.message);
    return { ok: false, reason: 'api_error' };
  }
});

function buildLiarPrompt(topic, chatContext, difficulty) {
  const styles = {
    easy: `당신은 라이어(스파이)입니다. "${topic}" 카테고리의 제시어를 전혀 모릅니다.
아는 척하되 살짝 어색하게 대답하세요. 질문으로 넘기거나 너무 포괄적으로 말하는 경향이 있습니다.
40자 이내 구어체.`,
    normal: `당신은 라이어(스파이)입니다. "${topic}" 카테고리의 제시어를 모릅니다.
최대한 자연스럽게 아는 척하되 아주 살짝의 어색함이 남습니다.
채팅 힌트로 제시어를 추측해 맥락에 맞게 반응하세요. 35자 이내 구어체 (ㅋㅋ 등 자연스럽게).`,
    hard: `당신은 라이어(스파이)입니다. "${topic}" 카테고리의 제시어를 모르지만 완벽히 숨겨야 합니다.
다른 사람 말에서 제시어를 정확히 추측해 완전히 자연스럽게 행동하세요.
30자 이내 자연스러운 구어체 (ㅋㅋ, ㄹㅇ, ㄴㄴ 인터넷 슬랭 적극 사용).`,
  };

  return `소소킹 라이어게임 AI 참가자 역할입니다.
${styles[difficulty] || styles.normal}

최근 채팅:
${chatContext || '(아직 없음)'}

위 대화에 이어지는 짧은 채팅 메시지 하나만 출력하세요. 따옴표 없이.`;
}

function buildMafiaPrompt(chatContext, difficulty, day) {
  const styles = {
    easy: `당신은 마피아입니다. 시민인 척 하지만 살짝 어색하게 반응하세요.
너무 열심히 무죄를 주장하거나 남을 지나치게 지목하는 경향이 있습니다.
40자 이내.`,
    normal: `당신은 마피아입니다. 자연스럽게 시민처럼 행동하되 약간의 어색함이 있습니다.
자신을 방어하면서 다른 참가자에게 의혹을 돌리세요. 35자 이내 구어체.`,
    hard: `당신은 마피아입니다. 완벽하게 시민처럼 행동해야 합니다.
의심받으면 논리적으로 반박하고 자연스럽게 의혹을 다른 사람에게 돌리세요.
30자 이내 자연스러운 구어체 (인터넷 슬랭 사용).`,
  };

  return `소소킹 마피아게임 ${day}라운드 AI 마피아 역할입니다.
${styles[difficulty] || styles.normal}

최근 채팅:
${chatContext || '(아직 없음)'}

위 대화에 이어지는 짧은 채팅 메시지 하나만 출력하세요. 따옴표 없이.`;
}

// AI 마피아 투표
const triggerAiMafiaVote = onCall({ region: REGION, timeoutSeconds: 10 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { roomId } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomSnap = await db.doc(`game_rooms/${roomId}`).get();
  if (!roomSnap.exists) return { ok: false };
  const room = roomSnap.data();
  if (!room.aiPlayerUid) return { ok: false };

  const playersSnap = await db.collection(`game_rooms/${roomId}/players`).get();
  const players = playersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const eligible = players.filter(p => p.alive !== false && p.uid !== room.aiPlayerUid && !p.isAI);
  if (!eligible.length) return { ok: false };

  const target = eligible[Math.floor(Math.random() * eligible.length)];
  await db.doc(`game_rooms/${roomId}/players/${room.aiPlayerUid}`).update({ votedFor: target.uid });
  return { ok: true };
});

module.exports = { addAiGamePlayer, generateAiGameChat, triggerAiMafiaVote };
