const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { enforceActionRateLimit } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanNickname(value) {
  return String(value || '').replace(/\s+/g, '').trim().slice(0, 20);
}

function cleanUrl(value) {
  const url = String(value || '').trim();
  return /^https:\/\//.test(url) ? url.slice(0, 500) : '';
}

function cleanRoomId(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

exports.getGamePlayerProfiles = onCall({ region: REGION, timeoutSeconds: 20, memory: '256MiB' }, async request => {
  const uid = request.auth?.uid || '';
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const roomId = cleanRoomId(request.data?.roomId);
  if (roomId.length !== 6) throw new HttpsError('invalid-argument', '게임방 코드를 확인해주세요.');

  await enforceActionRateLimit(uid, 'game-profile-read', { cooldownSeconds: 1, dailyLimit: 500 });

  const memberSnap = await db.doc(`game_rooms/${roomId}/players/${uid}`).get();
  if (!memberSnap.exists) throw new HttpsError('permission-denied', '게임방 참가자만 프로필을 볼 수 있습니다.');

  const playersSnap = await db.collection(`game_rooms/${roomId}/players`).limit(8).get();
  const playerUids = playersSnap.docs
    .map(snap => String(snap.get('uid') || snap.id || '').trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!playerUids.length) return { profiles: {} };

  const userSnaps = await db.getAll(...playerUids.map(playerUid => db.doc(`users/${playerUid}`)));
  const profiles = {};

  userSnaps.forEach((snap, index) => {
    if (!snap.exists) return;
    const data = snap.data() || {};
    const nickname = cleanNickname(data.nickname || '');
    if (!nickname || data.isAnonymous === true) return;
    const playerUid = playerUids[index];
    profiles[playerUid] = {
      uid: playerUid,
      nickname,
      photoURL: cleanUrl(data.photoURL || ''),
      avatarSeed: String(data.avatarSeed || playerUid).slice(0, 100),
      isMember: true
    };
  });

  return { profiles };
});
