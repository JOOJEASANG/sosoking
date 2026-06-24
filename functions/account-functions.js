'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';
const BATCH_LIMIT = 350;

function cleanNickname(value) {
  return String(value || '').trim().slice(0, 12);
}

function assertValidNickname(nickname) {
  if (!nickname || nickname.length < 2 || nickname.length > 12) throw new HttpsError('invalid-argument', '닉네임은 2~12자여야 합니다.');
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nickname)) throw new HttpsError('invalid-argument', '닉네임은 한글, 영문, 숫자, _만 사용 가능합니다.');
}

async function writeInBatches(items, writer) {
  for (let start = 0; start < items.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    items.slice(start, start + BATCH_LIMIT).forEach(item => writer(batch, item));
    await batch.commit();
  }
}

function uniqueDocs(...snapshots) {
  const documents = new Map();
  for (const snapshot of snapshots) {
    for (const document of snapshot?.docs || []) documents.set(document.ref.path, document);
  }
  return [...documents.values()];
}

async function anonymizePublicContributions(userId) {
  const [feedPosts, authoredComments, debateComments, reports, feedback] = await Promise.all([
    db.collection('feeds').where('authorId', '==', userId).get(),
    db.collectionGroup('comments').where('authorId', '==', userId).get(),
    db.collectionGroup('comments').where('uid', '==', userId).get(),
    db.collection('reports').where('reporterId', '==', userId).get(),
    db.collection('feedback').where('reporterId', '==', userId).get(),
  ]);

  await writeInBatches(feedPosts.docs, (batch, document) => batch.update(document.ref, {
    authorId: 'deleted-user',
    authorName: '탈퇴한 사용자',
    authorPhoto: null,
    authorEmail: FieldValue.delete(),
    authorAnonymized: true,
    authorAnonymizedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }));

  await writeInBatches(authoredComments.docs, (batch, document) => batch.update(document.ref, {
    authorId: 'deleted-user',
    authorName: '탈퇴한 사용자',
    authorPhoto: null,
    authorEmail: FieldValue.delete(),
    authorAnonymized: true,
    authorAnonymizedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }));

  await writeInBatches(debateComments.docs, (batch, document) => batch.update(document.ref, {
    uid: 'deleted-user',
    nickname: '탈퇴한 사용자',
    authorAnonymized: true,
    authorAnonymizedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }));

  await writeInBatches(uniqueDocs(reports, feedback), (batch, document) => batch.update(document.ref, {
    reporterId: 'deleted-user',
    reporterName: FieldValue.delete(),
    reporterEmail: FieldValue.delete(),
    reporterAnonymized: true,
    reporterAnonymizedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }));
}

async function deletePrivateParticipation(userId) {
  const [votes, viewEvents, following, followed, rateLimits, aiUsage, aiKingUsage, pointAwards] = await Promise.all([
    db.collectionGroup('votes').where('uid', '==', userId).get(),
    db.collectionGroup('view_events').where('uid', '==', userId).get(),
    db.collection('follows').where('followerId', '==', userId).get(),
    db.collection('follows').where('followedId', '==', userId).get(),
    db.collection('rate_limits').where('uid', '==', userId).get(),
    db.collection('ai_usage').where('userId', '==', userId).get(),
    db.collection('ai_king_usage').where('userId', '==', userId).get(),
    db.collection('point_awards').where('userId', '==', userId).get(),
  ]);

  const documents = uniqueDocs(votes, viewEvents, following, followed, rateLimits, aiUsage, aiKingUsage, pointAwards);
  await writeInBatches(documents, (batch, document) => batch.delete(document.ref));

  await db.recursiveDelete(db.collection(`notifications/${userId}/items`));
  await db.doc(`notifications/${userId}`).delete().catch(error => {
    if (error.code !== 5 && error.code !== 'not-found') throw error;
  });
}

const updateNickname = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인 후 변경할 수 있습니다.');
  const nickname = cleanNickname(request.data?.nickname);
  assertValidNickname(nickname);

  await db.runTransaction(async transaction => {
    const userRef = db.doc(`users/${userId}`);
    const userSnap = await transaction.get(userRef);
    const oldNickname = userSnap.exists ? userSnap.data().nickname : null;
    if (oldNickname === nickname) throw new HttpsError('already-exists', '현재 닉네임과 같습니다.');

    const newNicknameRef = db.doc(`nicknames/${nickname}`);
    const newNicknameSnap = await transaction.get(newNicknameRef);
    if (newNicknameSnap.exists) {
      const data = newNicknameSnap.data() || {};
      const owner = data.uid || data.userId;
      if (owner && owner !== userId) throw new HttpsError('already-exists', '이미 사용 중인 닉네임입니다.');
    }

    if (oldNickname && oldNickname !== nickname) {
      const oldNicknameRef = db.doc(`nicknames/${oldNickname}`);
      const oldNicknameSnap = await transaction.get(oldNicknameRef);
      if (oldNicknameSnap.exists) {
        const data = oldNicknameSnap.data() || {};
        const owner = data.uid || data.userId;
        if (!owner || owner === userId) transaction.delete(oldNicknameRef);
      }
    }

    transaction.set(newNicknameRef, {
      uid: userId,
      userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(userRef, {
      nickname,
      nicknameUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { ok: true, nickname };
});

const deleteMyAccount = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인 후 탈퇴할 수 있습니다.');

  const userRef = db.doc(`users/${userId}`);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const nickname = String(userData.nickname || '').slice(0, 150);

  try {
    await anonymizePublicContributions(userId);
    await deletePrivateParticipation(userId);

    if (nickname) {
      const nicknameRef = db.doc(`nicknames/${nickname}`);
      const nicknameSnap = await nicknameRef.get();
      if (nicknameSnap.exists) {
        const data = nicknameSnap.data() || {};
        const owner = data.uid || data.userId;
        if (!owner || owner === userId) await nicknameRef.delete();
      }
    }

    // 사용자 문서와 point_logs, scraps, ai_results 등 모든 하위 컬렉션을 함께 삭제합니다.
    await db.recursiveDelete(userRef);

    try {
      await admin.auth().deleteUser(userId);
    } catch (authError) {
      if (authError.code !== 'auth/user-not-found') throw authError;
    }
  } catch (error) {
    console.error('[deleteMyAccount]', userId, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', '계정 데이터를 안전하게 정리하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }

  return { ok: true };
});

module.exports = {
  updateNickname,
  deleteMyAccount,
  _test: { uniqueDocs },
};
