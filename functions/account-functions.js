const { onCall } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

function cleanNickname(value) {
  return String(value || '').trim().slice(0, 12);
}

function assertValidNickname(nickname) {
  if (!nickname || nickname.length < 2 || nickname.length > 12) throw new Error('닉네임은 2~12자여야 합니다.');
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nickname)) throw new Error('닉네임은 한글, 영문, 숫자, _만 사용 가능합니다.');
}

const updateNickname = onCall({ region: 'asia-northeast3', timeoutSeconds: 20 }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new Error('로그인 후 변경할 수 있습니다.');
  const nickname = cleanNickname(request.data?.nickname);
  assertValidNickname(nickname);

  await db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${userId}`);
    const userSnap = await tx.get(userRef);
    const oldNick = userSnap.exists ? userSnap.data().nickname : null;
    if (oldNick === nickname) throw new Error('현재 닉네임과 같습니다.');

    const newNickRef = db.doc(`nicknames/${nickname}`);
    const newNickSnap = await tx.get(newNickRef);
    if (newNickSnap.exists) {
      const data = newNickSnap.data() || {};
      const owner = data.uid || data.userId;
      if (owner && owner !== userId) throw new Error('이미 사용 중인 닉네임입니다.');
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

module.exports = { updateNickname };
