const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

function cleanNickname(value) {
  return String(value || '').trim().slice(0, 12);
}

function assertValidNickname(nickname) {
  if (!nickname || nickname.length < 2 || nickname.length > 12) throw new HttpsError('invalid-argument', '닉네임은 2~12자여야 합니다.');
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nickname)) throw new HttpsError('invalid-argument', '닉네임은 한글, 영문, 숫자, _만 사용 가능합니다.');
}

const updateNickname = onCall({ region: 'asia-northeast3', timeoutSeconds: 20 }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인 후 변경할 수 있습니다.');
  const nickname = cleanNickname(request.data?.nickname);
  assertValidNickname(nickname);

  await db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${userId}`);
    const userSnap = await tx.get(userRef);
    const oldNick = userSnap.exists ? userSnap.data().nickname : null;
    if (oldNick === nickname) throw new HttpsError('already-exists', '현재 닉네임과 같습니다.');

    const newNickRef = db.doc(`nicknames/${nickname}`);
    const newNickSnap = await tx.get(newNickRef);
    if (newNickSnap.exists) {
      const data = newNickSnap.data() || {};
      const owner = data.uid || data.userId;
      if (owner && owner !== userId) throw new HttpsError('already-exists', '이미 사용 중인 닉네임입니다.');
    }

    if (oldNick && oldNick !== nickname) {
      const oldNickRef = db.doc(`nicknames/${oldNick}`);
      const oldNickSnap = await tx.get(oldNickRef);
      if (oldNickSnap.exists) {
        const data = oldNickSnap.data() || {};
        const owner = data.uid || data.userId;
        if (!owner || owner === userId) tx.delete(oldNickRef);
      }
    }

    tx.set(newNickRef, { uid: userId, userId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(userRef, { nickname, nicknameUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { ok: true, nickname };
});

const deleteMyAccount = onCall({ region: 'asia-northeast3', timeoutSeconds: 60 }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인 후 탈퇴할 수 있습니다.');

  const userRef = db.doc(`users/${userId}`);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const nickname = userData.nickname || request.auth?.token?.name || '';

  // 개인 AI 결과는 계정 문서의 하위 컬렉션이라 사용자 문서만 삭제해도 남을 수 있다.
  // 계정 삭제 전에 서버에서 재귀 삭제하여 입력 내용과 결과를 함께 제거한다.
  await db.recursiveDelete(db.collection(`users/${userId}/ai_results`));

  const batch = db.batch();
  batch.set(db.doc(`deleted_users/${userId}`), {
    userId,
    nickname: String(nickname || '').slice(0, 40),
    email: request.auth?.token?.email || '',
    deletedAt: FieldValue.serverTimestamp(),
    deletedAtMs: Date.now(),
  }, { merge: true });
  batch.delete(userRef);

  const safeNickname = String(nickname || '').slice(0, 150);
  if (safeNickname) {
    const nickRef = db.doc(`nicknames/${safeNickname}`);
    const nickSnap = await nickRef.get().catch(() => null);
    if (nickSnap && nickSnap.exists) {
      const data = nickSnap.data() || {};
      const owner = data.uid || data.userId;
      if (!owner || owner === userId) batch.delete(nickRef);
    }
  }
  await batch.commit();

  try {
    await admin.auth().deleteUser(userId);
  } catch (authErr) {
    if (authErr.code !== 'auth/user-not-found') throw authErr;
  }
  return { ok: true };
});

module.exports = { updateNickname, deleteMyAccount };
