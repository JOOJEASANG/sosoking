const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireVerifiedUser, validatedProfilePhotoUrl } = require('./security-utils');

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
  return /^https:\/\//.test(url) ? url.slice(0, 1000) : '';
}

function cleanAvatarSeed(value) {
  const seed = String(value || '').trim().slice(0, 32);
  return /^[a-zA-Z0-9_-]{1,32}$/.test(seed) ? seed : '';
}

function cleanAvatarIcon(value) {
  return String(value || '').trim().slice(0, 12);
}

function cleanAvatarType(value) {
  return ['generated', 'google', 'upload'].includes(value) ? value : '';
}

function nicknameError(value) {
  const n = cleanNickname(value);
  if (n.length < 2) return '닉네임은 2자 이상 입력해주세요.';
  if (n.length > 20) return '닉네임은 20자 이하로 입력해주세요.';
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(n)) return '닉네임은 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.';
  return '';
}

exports.checkNickname = onCall({ region: REGION, timeoutSeconds: 20, memory: '256MiB' }, async request => {
  const uid = requireVerifiedUser(request, '닉네임 확인은 로그인 후 이용할 수 있습니다.');
  const nickname = cleanNickname(request.data?.nickname);
  const err = nicknameError(nickname);
  if (err) throw new HttpsError('invalid-argument', err);
  const key = nicknameKey(nickname);
  const snap = await db.doc(`user_names/${key}`).get();
  return { available: !snap.exists || snap.data().uid === uid, nickname };
});

exports.setNickname = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = requireVerifiedUser(request, '프로필 설정은 로그인 후 이용할 수 있습니다.');
  const email = request.auth.token.email || '';
  const nickname = cleanNickname(request.data?.nickname);
  const err = nicknameError(nickname);
  if (err) throw new HttpsError('invalid-argument', err);
  const key = nicknameKey(nickname);
  const requestedAvatarType = cleanAvatarType(request.data?.avatarType);
  const requestedAvatarSeed = cleanAvatarSeed(request.data?.avatarSeed);
  const requestedAvatarIcon = cleanAvatarIcon(request.data?.avatarIcon);
  const requestedPhotoURL = String(request.data?.photoURL || '').trim();
  const provider = request.auth.token.firebase?.sign_in_provider || 'password';
  const userRef = db.doc(`users/${uid}`);
  const nameRef = db.doc(`user_names/${key}`);
  let savedPhotoURL = '';
  let savedAvatarType = 'generated';
  let savedAvatarSeed = '';
  let savedAvatarIcon = '';

  await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const nameSnap = await tx.get(nameRef);
    const profile = userSnap.exists ? userSnap.data() : {};
    const oldKey = profile.nickname ? nicknameKey(profile.nickname) : '';
    const googlePhotoURL = cleanUrl(request.auth.token.picture || '');
    const customPhotoURL = requestedPhotoURL
      ? validatedProfilePhotoUrl(requestedPhotoURL, uid)
      : cleanUrl(profile.avatarType === 'upload' ? profile.photoURL : '');
    let avatarType = requestedAvatarType || profile.avatarType || (googlePhotoURL ? 'google' : 'generated');
    if (avatarType === 'google' && !googlePhotoURL) avatarType = 'generated';
    if (avatarType === 'upload' && !customPhotoURL) avatarType = googlePhotoURL ? 'google' : 'generated';
    const avatarSeed = requestedAvatarSeed || cleanAvatarSeed(profile.avatarSeed) || 'dog';
    const avatarIcon = requestedAvatarIcon || cleanAvatarIcon(profile.avatarIcon) || '🐶';
    const photoURL = avatarType === 'google' ? googlePhotoURL : (avatarType === 'upload' ? customPhotoURL : '');

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

    if (oldKey && oldKey !== key) tx.delete(db.doc(`user_names/${oldKey}`));

    tx.set(userRef, {
      uid,
      email: email || profile.email || '',
      nickname,
      provider: provider || profile.provider || 'password',
      photoURL,
      avatarSeed,
      avatarIcon,
      avatarType,
      isAnonymous: false,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: profile.createdAt || FieldValue.serverTimestamp(),
    }, { merge: true });

    savedPhotoURL = photoURL;
    savedAvatarType = avatarType;
    savedAvatarSeed = avatarSeed;
    savedAvatarIcon = avatarIcon;
  });

  return { success: true, nickname, photoURL: savedPhotoURL, avatarType: savedAvatarType, avatarSeed: savedAvatarSeed, avatarIcon: savedAvatarIcon };
});
