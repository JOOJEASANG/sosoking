const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireVerifiedUser, validatedProfilePhotoUrl, assertNoSensitiveContent } = require('./security-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const RESERVED_NICKNAME_RE = /(?:관리자|운영자|소소킹|공식계정|admin|administrator|moderator|staff)/i;
const OFFENSIVE_NICKNAME_RE = /(?:시발|씨발|ㅅㅂ|병신|개새끼|죽어|자살)/i;
const LIKELY_KOREAN_NAME_RE = /^(?:김|이|박|최|정|강|조|윤|장|임|한|오)[가-힣]{2}$/;

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

function normalizedIdentityName(value) {
  return String(value || '').replace(/\s+/g, '').trim().toLocaleLowerCase('ko-KR');
}

function nicknameError(value, token = {}) {
  const nickname = cleanNickname(value);
  if (nickname.length < 2) return '닉네임은 2자 이상 입력해주세요.';
  if (nickname.length > 20) return '닉네임은 20자 이하로 입력해주세요.';
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nickname)) return '닉네임은 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.';
  if (RESERVED_NICKNAME_RE.test(nickname)) return '관리자·운영자·공식 계정으로 오해할 수 있는 닉네임은 사용할 수 없습니다.';
  if (OFFENSIVE_NICKNAME_RE.test(nickname)) return '부적절한 표현이 포함된 닉네임은 사용할 수 없습니다.';
  const identityNames = [token.name, token.display_name]
    .map(normalizedIdentityName)
    .filter(Boolean);
  if (identityNames.includes(normalizedIdentityName(nickname)) || LIKELY_KOREAN_NAME_RE.test(nickname)) {
    return '실명으로 보일 수 있는 닉네임은 사용할 수 없습니다. 익명 별칭을 사용해주세요.';
  }
  return '';
}

exports.checkNickname = onCall({ region: REGION, timeoutSeconds: 20, memory: '256MiB' }, async request => {
  const uid = requireVerifiedUser(request, '닉네임 확인은 로그인 후 이용할 수 있습니다.');
  const nickname = cleanNickname(request.data?.nickname);
  const error = nicknameError(nickname, request.auth.token || {});
  if (error) throw new HttpsError('invalid-argument', error);
  assertNoSensitiveContent(nickname, '닉네임에 사용할 수 없는 정보');
  const key = nicknameKey(nickname);
  const snapshot = await db.doc(`user_names/${key}`).get();
  return { available: !snapshot.exists || snapshot.data().uid === uid, nickname };
});

exports.setNickname = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = requireVerifiedUser(request, '프로필 설정은 로그인 후 이용할 수 있습니다.');
  const email = request.auth.token.email || '';
  const nickname = cleanNickname(request.data?.nickname);
  const error = nicknameError(nickname, request.auth.token || {});
  if (error) throw new HttpsError('invalid-argument', error);
  assertNoSensitiveContent(nickname, '닉네임에 사용할 수 없는 정보');
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

  await db.runTransaction(async transaction => {
    const userSnapshot = await transaction.get(userRef);
    const nameSnapshot = await transaction.get(nameRef);
    const profile = userSnapshot.exists ? userSnapshot.data() : {};
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

    if (nameSnapshot.exists && nameSnapshot.data().uid !== uid) {
      throw new HttpsError('already-exists', '이미 사용 중인 닉네임입니다.');
    }

    transaction.set(nameRef, {
      uid,
      nickname,
      key,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: nameSnapshot.exists ? nameSnapshot.data().createdAt : FieldValue.serverTimestamp(),
    }, { merge: true });

    if (oldKey && oldKey !== key) transaction.delete(db.doc(`user_names/${oldKey}`));

    transaction.set(userRef, {
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