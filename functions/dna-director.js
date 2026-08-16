'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleAuth } = require('google-auth-library');
const { enforceActionRateLimit } = require('./security');
const {
  buildPrompt,
  fallbackPack,
  parseVertexResponse,
  playerProfiles,
  responseSchema
} = require('./dna-director-core');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MODEL = process.env.DNA_AI_MODEL || 'gemini-2.5-flash-lite';

function cleanRoomId(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function projectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId || ''; }
  catch { return ''; }
}

async function generateWithVertex(profiles, fallback) {
  const project = projectId();
  if (!project) throw new Error('project-id-missing');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  const token = typeof access === 'string' ? access : access?.token;
  if (!token) throw new Error('vertex-token-missing');

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/global/publishers/google/models/${encodeURIComponent(MODEL)}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(profiles) }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 520,
        responseMimeType: 'application/json',
        responseSchema: responseSchema()
      }
    }),
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error(`vertex-${response.status}`);
  return parseVertexResponse(await response.json(), fallback);
}

exports.generateDnaBoss = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB',
  minInstances: 0,
  maxInstances: 2,
  concurrency: 10
}, async request => {
  const uid = request.auth?.uid || '';
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const roomId = cleanRoomId(request.data?.roomId);
  if (roomId.length !== 6) throw new HttpsError('invalid-argument', '게임방 코드를 확인해주세요.');

  const roomRef = db.doc(`game_rooms/${roomId}`);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw new HttpsError('not-found', '게임방을 찾지 못했습니다.');
  const room = roomSnap.data() || {};
  if (room.type !== 'dna-boss' || room.hostUid !== uid) throw new HttpsError('permission-denied', 'DNA방 방장만 AI 보스를 만들 수 있습니다.');
  if (room.status !== 'playing' || room.phase !== 'director') throw new HttpsError('failed-precondition', 'DNA 스캔이 끝난 뒤에만 보스를 만들 수 있습니다.');
  if (room.aiPack && Object.keys(room.aiPack).length) return { status: 'ready', mode: room.aiMode || 'cached' };

  await enforceActionRateLimit(uid, 'dna-ai', { cooldownSeconds: 5, dailyLimit: 12 });

  const claim = await db.runTransaction(async tx => {
    const latest = await tx.get(roomRef);
    const data = latest.data() || {};
    if (data.aiPack && Object.keys(data.aiPack).length) return 'ready';
    const generatingMs = data.aiRequestedAt?.toMillis?.() || 0;
    if (data.aiStatus === 'generating' && Date.now() - generatingMs < 30000) return 'generating';
    tx.update(roomRef, {
      aiStatus: 'generating', aiRequestedBy: uid, aiRequestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    return 'claimed';
  });
  if (claim !== 'claimed') return { status: claim };

  const playersSnap = await db.collection(`game_rooms/${roomId}/players`).orderBy('joinOrder').limit(8).get();
  if (playersSnap.size < 2) throw new HttpsError('failed-precondition', '두 명 이상 필요합니다.');
  const profiles = playerProfiles(playersSnap.docs);
  const fallback = fallbackPack(roomId);
  let pack = fallback;
  let mode = 'fallback';
  try {
    pack = await generateWithVertex(profiles, fallback);
    mode = 'gemini';
  } catch (error) {
    console.warn('DNA Vertex generation skipped:', error?.message || error);
  }

  await roomRef.update({
    aiPack: pack,
    aiStatus: 'ready',
    aiMode: mode,
    aiModel: mode === 'gemini' ? MODEL : '',
    aiGeneratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { status: 'ready', mode };
});
