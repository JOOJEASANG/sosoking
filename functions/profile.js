const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';

function cleanNickname(value) {
  return String(value || '').replace(/\s+/g, '').trim().slice(0, 20);
}

function nicknameKey(value) {
  return cleanNickname(value).toLocaleLowerCase('ko-KR');
}

function cleanUrl(value) {
  const url = String(value || '').trim();
  return /^https:\/\//.test(url) ? url.slice(0, 500) : '';
}

// 프로필 사진은 Storage 없이 Firestore 문서에 직접 담는다.
// 클라이언트가 256x256으로 줄여 보내므로 보통 20~40KB 수준이고,
// 문서 1MB 한도에 여유가 크다. 그래도 상한을 둬서 남용을 막는다.
const MAX_PHOTO_CHARS = 200 * 1024;
const PHOTO_DATA_URI = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function photoDataError(value) {
  if (!value) return '';
  if (!PHOTO_DATA_URI.test(value)) return '지원하지 않는 이미지 형식입니다.';
  if (value.length > MAX_PHOTO_CHARS) return '이미지 용량이 너무 큽니다.';
  return '';
}

function cleanRoomId(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function nicknameError(value) {
  const n = cleanNickname(value);
  if (n.length < 2) return '닉네임은 2자 이상 입력해주세요.';
  if (n.length > 20) return '닉네임은 20자 이하로 입력해주세요.';
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(n)) return '닉네임은 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.';
  return '';
}

exports.checkNickname = onCall({ region: REGION, timeoutSeconds: 20, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  await enforceActionRateLimit(request.auth.uid, 'nickname-check', {
    cooldownSeconds: 1,
    dailyLimit: 100
  });

  const nickname = cleanNickname(request.data?.nickname);
  const err = nicknameError(nickname);
  if (err) throw new HttpsError('invalid-argument', err);
  const key = nicknameKey(nickname);
  const snap = await db.doc(`user_names/${key}`).get();
  return { available: !snap.exists || snap.data().uid === request.auth.uid, nickname };
});

exports.setNickname = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  await enforceActionRateLimit(uid, 'nickname-set', {
    cooldownSeconds: 15,
    dailyLimit: 10
  });

  const email = request.auth.token.email || '';
  const nickname = cleanNickname(request.data?.nickname);
  const err = nicknameError(nickname);
  if (err) throw new HttpsError('invalid-argument', err);
  const key = nicknameKey(nickname);
  const photoURL = cleanUrl(request.auth.token.picture || request.data?.photoURL || '');
  const provider = request.auth.token.firebase?.sign_in_provider || 'password';
  const userRef = db.doc(`users/${uid}`);
  const nameRef = db.doc(`user_names/${key}`);

  await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const profile = userSnap.exists ? userSnap.data() : {};
    const oldKey = profile.nickname ? nicknameKey(profile.nickname) : '';
    const oldNameRef = oldKey && oldKey !== key
      ? db.doc(`user_names/${oldKey}`)
      : null;
    const nameSnap = await tx.get(nameRef);
    const oldNameSnap = oldNameRef ? await tx.get(oldNameRef) : null;

    if (nameSnap.exists && nameSnap.data().uid !== uid) {
      throw new HttpsError('already-exists', '이미 사용 중인 닉네임입니다.');
    }

    tx.set(nameRef, {
      uid,
      nickname,
      key,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: nameSnap.exists ? nameSnap.data().createdAt : FieldValue.serverTimestamp(),
    }, { merge: true });

    // 기존 프로필이 과거 클라이언트 쓰기로 변조됐더라도 다른 사용자의
    // 닉네임 예약 문서는 절대 삭제하지 않는다.
    if (oldNameRef && oldNameSnap?.exists && oldNameSnap.data().uid === uid) {
      tx.delete(oldNameRef);
    }

    tx.set(userRef, {
      uid,
      email: email || profile.email || '',
      nickname,
      provider: provider || profile.provider || 'password',
      photoURL: photoURL || profile.photoURL || '',
      avatarSeed: profile.avatarSeed || `${uid.slice(0, 8)}-${Date.now().toString(36)}`,
      avatarType: photoURL || profile.photoURL ? 'google' : 'generated',
      isAnonymous: false,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: profile.createdAt || FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { success: true, nickname, photoURL };
});

exports.setProfilePhoto = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  await enforceActionRateLimit(uid, 'profile-photo', {
    cooldownSeconds: 3,
    dailyLimit: 40
  });

  // 빈 문자열은 '직접 올린 사진을 지우고 원래 아이콘으로 되돌린다'는 뜻이다.
  const photo = String(request.data?.photo || '').trim();
  const err = photoDataError(photo);
  if (err) throw new HttpsError('invalid-argument', err);

  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', '닉네임을 먼저 설정해주세요.');
    }

    const profile = snap.data() || {};
    // 사진을 지우면 구글 사진이 있는 계정은 구글 사진으로, 없으면 자동 생성 아이콘으로 돌아간다.
    const nextType = photo ? 'custom' : (profile.photoURL ? 'google' : 'generated');

    tx.set(userRef, {
      photoData: photo || FieldValue.delete(),
      avatarType: nextType,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return { success: true, hasPhoto: Boolean(photo) };
});
