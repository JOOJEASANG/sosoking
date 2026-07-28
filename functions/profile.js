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
