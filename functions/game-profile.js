const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enforceActionRateLimit } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ENFORCE_APP_CHECK = String(process.env.ENFORCE_APP_CHECK || '').toLowerCase() === 'true';

function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 12);
}

function normalizeNickname(value) {
  return cleanNickname(value).normalize('NFKC').toLocaleLowerCase('ko-KR');
}

function cleanUrl(value) {
  const url = String(value || '').trim();
  return /^https:\/\//.test(url) ? url.slice(0, 500) : '';
}

function cleanRoomId(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function googleProvider(userRecord) {
  return userRecord?.providerData?.find(item => item?.providerId === 'google.com') || null;
}

function authProfileFields(userRecord) {
  const google = googleProvider(userRecord);
  return {
    email: String(userRecord?.email || google?.email || ''),
    displayName: String(userRecord?.displayName || google?.displayName || ''),
    photoURL: cleanUrl(userRecord?.photoURL || google?.photoURL || '')
  };
}

function requireAuth(request) {
  const uid = request.auth?.uid || '';
  if (!uid || request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', '회원 로그인이 필요합니다.');
  }
  return uid;
}

exports.checkNickname = onCall({
  region: REGION,
  timeoutSeconds: 10,
  memory: '256MiB',
  enforceAppCheck: ENFORCE_APP_CHECK
}, async request => {
  const nickname = cleanNickname(request.data?.nickname);
  const normalized = normalizeNickname(nickname);
  if (nickname.length < 2 || normalized.length < 2) {
    throw new HttpsError('invalid-argument', '닉네임은 2자 이상 입력해주세요.');
  }
  if (nickname.length > 12) throw new HttpsError('invalid-argument', '닉네임은 12자까지 가능합니다.');
  await enforceActionRateLimit(request.auth?.uid || 'anonymous', 'nickname-check', { cooldownSeconds: 1, dailyLimit: 100 });
  const snap = await db.doc(`nicknames/${normalized}`).get();
  return { available: !snap.exists, nickname, normalized };
});

exports.saveMemberProfile = onCall({
  region: REGION,
  timeoutSeconds: 15,
  memory: '256MiB',
  enforceAppCheck: ENFORCE_APP_CHECK
}, async request => {
  const uid = requireAuth(request);
  const nickname = cleanNickname(request.data?.nickname);
  const normalized = normalizeNickname(nickname);
  if (nickname.length < 2 || normalized.length < 2 || nickname.length > 12) {
    throw new HttpsError('invalid-argument', '닉네임은 2~12자로 입력해주세요.');
  }

  await enforceActionRateLimit(uid, 'profile-save', { cooldownSeconds: 1, dailyLimit: 30 });
  const userRecord = await require('firebase-admin/auth').getAuth().getUser(uid);
  const authProfile = authProfileFields(userRecord);
  const userRef = db.doc(`users/${uid}`);
  const nicknameRef = db.doc(`nicknames/${normalized}`);
  const existing = await userRef.get();
  const previousNormalized = String(existing.get('nicknameNormalized') || '');

  await db.runTransaction(async tx => {
    const nicknameSnap = await tx.get(nicknameRef);
    if (nicknameSnap.exists && nicknameSnap.get('uid') !== uid) {
      throw new HttpsError('already-exists', '이미 사용 중인 닉네임입니다.');
    }

    const now = FieldValue.serverTimestamp();
    tx.set(nicknameRef, {
      uid,
      nickname,
      updatedAt: now
    }, { merge: true });
    tx.set(userRef, {
      uid,
      nickname,
      nicknameNormalized: normalized,
      email: authProfile.email,
      displayName: authProfile.displayName,
      photoURL: authProfile.photoURL,
      avatarSeed: uid,
      isAnonymous: false,
      updatedAt: now,
      createdAt: existing.exists ? (existing.get('createdAt') || now) : now
    }, { merge: true });
    if (previousNormalized && previousNormalized !== normalized) {
      tx.delete(db.doc(`nicknames/${previousNormalized}`));
    }
  });

  return { ok: true, nickname, photoURL: authProfile.photoURL };
});

exports.getGamePlayerProfiles = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB',
  enforceAppCheck: ENFORCE_APP_CHECK
}, async request => {
  const uid = request.auth?.uid || '';
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const roomId = cleanRoomId(request.data?.roomId);
  if (roomId.length !== 6) throw new HttpsError('invalid-argument', '게임방 코드를 확인해주세요.');

  await enforceActionRateLimit(uid, 'game-profile-read', { cooldownSeconds: 1, dailyLimit: 500 });

  const [roomSnap, memberSnap] = await Promise.all([
    db.doc(`game_rooms/${roomId}`).get(),
    db.doc(`game_rooms/${roomId}/players/${uid}`).get()
  ]);
  if (!roomSnap.exists || !memberSnap.exists) {
    throw new HttpsError('permission-denied', '게임방 참가자만 프로필을 볼 수 있습니다.');
  }

  const profileLimit = roomSnap.get('type') === 'naming-survival' ? 100 : 8;
  const playersSnap = await db.collection(`game_rooms/${roomId}/players`).limit(profileLimit + 1).get();
  const truncated = playersSnap.size > profileLimit;
  const playerUids = playersSnap.docs
    .slice(0, profileLimit)
    .map(snap => String(snap.get('uid') || snap.id || '').trim())
    .filter(Boolean);
  if (!playerUids.length) return { profiles: {}, truncated, profileLimit };

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

  return { profiles, truncated, profileLimit };
});
