'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const AI_SPY_NAMES = [
  '수상한자', '정체불명', '알쏭달쏭', '미지인', '의심씨',
  '모르는척', '신비씨', '의문인', '수수께끼', '숨은자',
];

function randomSpyAiName() {
  const base = AI_SPY_NAMES[Math.floor(Math.random() * AI_SPY_NAMES.length)];
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

// ── 1. AI 스파이 플레이어 추가 ──
const addSpyAiPlayer = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 15 }, async (request) => {
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
  const aiName = randomSpyAiName();

  await db.doc(`game_rooms/${roomId}/players/${aiUid}`).set({
    uid: aiUid,
    name: aiName,
    alive: true,
    isAI: true,
    score: 0,
  });

  await db.doc(`game_rooms/${roomId}`).update({
    aiPlayerUid: aiUid,
    aiPlayerName: aiName,
    aiDifficulty: difficulty || 'normal',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, aiUid, aiName };
});

// ── 2. AI 스파이 힌트 생성 ──
const generateSpyHint = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 20 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { roomId } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomSnap = await db.doc(`game_rooms/${roomId}`).get();
  if (!roomSnap.exists) return { ok: false, reason: 'room_not_found' };
  const room = roomSnap.data();

  if (room.status !== 'hint') return { ok: false, reason: 'wrong_phase' };
  if (!room.aiPlayerUid) return { ok: false, reason: 'no_ai' };

  // 이미 힌트를 제출했으면 기존 값 반환
  const existingHintSnap = await db.doc(`game_rooms/${roomId}/hints/${room.aiPlayerUid}`).get();
  if (existingHintSnap.exists) {
    return { ok: true, hint: existingHintSnap.data().text, cached: true };
  }

  // 다른 플레이어 힌트 조회 (최대 3개, AI 힌트 생성 참고용)
  const hintsSnap = await db.collection(`game_rooms/${roomId}/hints`).limit(5).get();
  const otherHints = hintsSnap.docs
    .filter(d => d.id !== room.aiPlayerUid)
    .slice(0, 3)
    .map(d => d.data().text)
    .filter(Boolean);

  const aiWord = room.aiKeyword || '';
  const category = room.category || '';
  const difficulty = room.aiDifficulty || 'normal';

  const apiKey = await getAiKey();
  let hint = '';

  if (apiKey) {
    try {
      const prompt = buildSpyHintPrompt(aiWord, category, difficulty, otherHints);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 60 },
      });
      const result = await model.generateContent(prompt);
      hint = result.response.text().trim()
        .replace(/^["'「『]|["'」』]$/g, '')
        .replace(/^(힌트:|AI:|답:|출력:)\s*/i, '')
        .slice(0, 20);
    } catch (e) {
      console.error('[spy hint AI]', e.message);
    }
  }

  if (!hint) {
    hint = fallbackHint(category);
  }

  await db.doc(`game_rooms/${roomId}/hints/${room.aiPlayerUid}`).set({
    text: hint,
    submittedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, hint };
});

// ── 3. AI 스파이 투표 트리거 ──
const triggerSpyVote = onCall({ region: REGION, timeoutSeconds: 10 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { roomId } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomSnap = await db.doc(`game_rooms/${roomId}`).get();
  if (!roomSnap.exists) return { ok: false };
  const room = roomSnap.data();

  if (room.status !== 'vote') return { ok: false };
  if (!room.aiPlayerUid) return { ok: false };

  // 이미 투표했으면 그냥 반환
  const existingVoteSnap = await db.doc(`game_rooms/${roomId}/votes/${room.aiPlayerUid}`).get();
  if (existingVoteSnap.exists) return { ok: true };

  // 살아있는 사람 플레이어 목록 조회
  const playersSnap = await db.collection(`game_rooms/${roomId}/players`).get();
  const alivePlayers = playersSnap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => p.alive !== false && p.uid !== room.aiPlayerUid && !p.isAI);

  if (!alivePlayers.length) return { ok: false };

  // 힌트에서 가장 긴 힌트를 제출한 사람 지목
  // (AI가 상세한 힌트 제출자 = 진짜 아는 사람이라 판단)
  let targetUid = null;
  try {
    const hintsSnap = await db.collection(`game_rooms/${roomId}/hints`).get();
    const hintsByPlayer = hintsSnap.docs
      .map(d => ({ uid: d.id, text: d.data().text || '' }))
      .filter(h => h.uid !== room.aiPlayerUid && alivePlayers.some(p => p.uid === h.uid));

    if (hintsByPlayer.length > 0) {
      hintsByPlayer.sort((a, b) => b.text.length - a.text.length);
      targetUid = hintsByPlayer[0].uid;
    }
  } catch (e) {
    console.error('[spy vote hints]', e.message);
  }

  // 힌트 데이터가 없으면 랜덤 선택
  if (!targetUid) {
    targetUid = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].uid;
  }

  await db.doc(`game_rooms/${roomId}/votes/${room.aiPlayerUid}`).set({
    targetUid,
    votedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, targetUid };
});

// ── 프롬프트 빌더 ──
function buildSpyHintPrompt(aiWord, category, difficulty, otherHints) {
  const otherHintsText = otherHints.length > 0
    ? `\n이미 제출된 다른 참가자 힌트:\n${otherHints.map((h, i) => `- ${h}`).join('\n')}`
    : '';

  const difficultyGuide = {
    easy: `난이도: 쉬움 - AI 힌트가 약간 어색해도 됩니다. 조금 막연하거나 엉뚱하게 표현하세요.`,
    normal: `난이도: 보통 - 자연스럽지만 미세하게 어색한 힌트를 작성하세요. 살짝 어색한 표현을 섞으세요.`,
    hard: `난이도: 어려움 - 완벽히 자연스러운 힌트를 작성하세요. 다른 힌트를 참고해 어울리는 스타일로 쓰세요.`,
  };

  return `소소스파이 게임에서 AI 스파이 역할입니다.
카테고리: ${category || '일반'}
AI에게 주어진 단어: "${aiWord}"
${difficultyGuide[difficulty] || difficultyGuide.normal}
${otherHintsText}

규칙:
- 제시어 단어 자체를 직접 언급하지 마세요
- 20자 이내로 짧게 작성하세요
- 반드시 한국어로 작성하세요
- 따옴표 없이 힌트만 출력하세요
- 힌트 하나만 출력하세요`;
}

// ── fallback 힌트 (API 실패 시) ──
function fallbackHint(category) {
  const pools = {
    음식: ['맛있어요', '즐겨 먹어요', '한국에서 인기 있어요', '자주 먹죠', '냄새가 좋아요', '꼭 먹어봐야 해요'],
    장소: ['자주 가요', '사람이 많아요', '좋은 기억이 있어요', '한 번쯤 가볼 만해요', '익숙한 곳이에요'],
    동물: ['귀여워요', '특이하게 생겼어요', '동물원에서 봤어요', '좋아하는 동물이에요', '영리해요'],
    인물: ['유명한 분이에요', '한국에서 잘 알려져 있어요', '영향력이 있는 분이에요', '존경받아요'],
    사물: ['자주 쓰는 물건이에요', '생활에 필수예요', '있으면 편리해요', '흔하게 볼 수 있어요'],
    스포츠: ['운동이에요', '재미있어요', '운동량이 많아요', '팀으로 하는 경우도 있어요'],
    문화: ['즐기는 사람이 많아요', '한국에서 유행이에요', '재미있는 활동이에요'],
  };

  const pool = pools[category] || ['생각나는 게 있어요', '뭔가 비슷한 것 같아요', '흠, 잘 모르겠어요', '왠지 친숙해요', '그런 것 같기도 해요'];
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { addSpyAiPlayer, generateSpyHint, triggerSpyVote };
