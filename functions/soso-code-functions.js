'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';

const AI_HACKER_NAMES = [
  '해커Z', '버그맨', '크래커', '매트릭스', '루트킷',
  '익스플로잇', '페이로드', '시퀀스', '바이너리', '암호마',
];

function randomHackerName() {
  const base = AI_HACKER_NAMES[Math.floor(Math.random() * AI_HACKER_NAMES.length)];
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

// ── 1. AI 해커 추가 ──────────────────────────────────────────────────────────
const addCodeAiPlayer = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 15 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { roomId, difficulty } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomRef = db.doc(`game_rooms/${roomId}`);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw new HttpsError('not-found', '방을 찾을 수 없어요');
  const room = roomSnap.data();

  if (room.hostId !== uid) throw new HttpsError('permission-denied', '방장만 AI를 추가할 수 있어요');
  if (room.aiPlayerUid) return { ok: true, aiUid: room.aiPlayerUid, aiName: room.aiPlayerName };

  const aiUid = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const aiName = randomHackerName();

  await db.doc(`game_rooms/${roomId}/players/${aiUid}`).set({
    uid: aiUid,
    name: aiName,
    alive: true,
    isAI: true,
    score: 0,
    isHacker: true,
    joinedAt: FieldValue.serverTimestamp(),
  });

  await roomRef.update({
    aiPlayerUid: aiUid,
    aiPlayerName: aiName,
    aiDifficulty: difficulty || 'normal',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, aiUid, aiName };
});

// ── 2. AI 해커 인텔 생성 ─────────────────────────────────────────────────────
const generateCodeIntel = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 20 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { roomId } = request.data || {};
  if (!roomId) throw new HttpsError('invalid-argument', 'roomId가 필요해요');

  const roomSnap = await db.doc(`game_rooms/${roomId}`).get();
  if (!roomSnap.exists) return { ok: false, reason: 'room_not_found' };
  const room = roomSnap.data();

  if (room.status !== 'playing') return { ok: false, reason: 'wrong_phase' };
  if (!room.aiPlayerUid) return { ok: false, reason: 'no_ai' };

  // 살아있는 시민 플레이어 목록
  const playersSnap = await db.collection(`game_rooms/${roomId}/players`).get();
  const aliveCitizens = playersSnap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => !p.isAI && p.alive !== false);

  if (!aliveCitizens.length) return { ok: false, reason: 'no_targets' };

  // 랜덤 대상 선택
  const target = aliveCitizens[Math.floor(Math.random() * aliveCitizens.length)];
  const code = target.codeDigits || [];
  const difficulty = room.aiDifficulty || 'normal';

  // 난이도별 정확도
  const accuracyMap = { easy: 0.8, normal: 0.5, hard: 0.2 };
  const accuracy = accuracyMap[difficulty] || 0.5;
  const isTrue = Math.random() < accuracy;

  const apiKey = await getAiKey();
  let message = '';

  if (apiKey && code.length === 4) {
    try {
      const prompt = buildIntelPrompt(target.name, code, isTrue, difficulty);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 60 },
      });
      const result = await model.generateContent(prompt);
      message = result.response.text().trim()
        .replace(/^["'「]|["'」]$/g, '')
        .slice(0, 50);
    } catch (e) {
      console.error('[code intel AI]', e.message);
    }
  }

  if (!message) {
    message = fallbackIntel(target.name, code, isTrue);
  }

  await db.collection(`game_rooms/${roomId}/actions`).add({
    type: 'ai_intel',
    actorId: room.aiPlayerUid,
    actorName: room.aiPlayerName,
    targetId: target.uid,
    targetName: target.name,
    message,
    isTrue,
    round: room.round || 1,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, message };
});

function buildIntelPrompt(targetName, code, isTrue, difficulty) {
  const pos = Math.floor(Math.random() * 4) + 1;
  const digit = code[pos - 1];
  const fakeDigit = ((digit + Math.floor(Math.random() * 5) + 1 - 1) % 6) + 1;

  const truthHint = isTrue
    ? `${targetName}의 ${pos}번째 자리가 ${digit}라는 사실`
    : `${targetName}의 ${pos}번째 자리가 ${fakeDigit}라는 거짓 정보 (실제로는 ${digit})`;

  const diffNote = {
    easy: '힌트가 명확하고 직접적으로 들립니다.',
    normal: '힌트가 약간 모호하게 들립니다.',
    hard: '힌트가 매우 교묘하고 혼란스럽게 들립니다.',
  };

  return `당신은 소소코드 게임의 AI 해커입니다.
${isTrue ? '정확한 정보' : '가짜 정보'}: ${truthHint}

다음 지침을 따르세요:
- 인텔 보고 형식으로 짧게 작성하세요 (50자 이내)
- 한국어로 작성하세요
- ${diffNote[difficulty] || diffNote.normal}
- 따옴표 없이 메시지만 출력하세요
- 예시: "분석 완료 — 3번 자리는 5로 확인됨"

메시지:`;
}

function fallbackIntel(targetName, code, isTrue) {
  const pos = Math.floor(Math.random() * 4) + 1;
  const digit = code[pos - 1];
  const fakeDigit = ((digit + 2) % 6) + 1;
  const showDigit = isTrue ? digit : fakeDigit;

  const templates = [
    `📡 해킹 완료 — ${targetName}의 ${pos}번 자리: ${showDigit}`,
    `🔓 침투 성공 — ${pos}번째 숫자는 ${showDigit}로 확인`,
    `⚡ 인텔 입수: ${targetName} 코드 ${pos}번 = ${showDigit}`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = { addCodeAiPlayer, generateCodeIntel };
