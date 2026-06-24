'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

if (!getApps().length) initializeApp();

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();
const REGION = 'asia-northeast3';
const BATCH_LIMIT = 350;
const RECURSIVE_CONCURRENCY = 8;

function uniqueDocs(...snapshots) {
  const documents = new Map();
  for (const snapshot of snapshots) {
    for (const document of snapshot?.docs || []) documents.set(document.ref.path, document);
  }
  return [...documents.values()];
}

async function queryDocs(reference, field, userId) {
  return reference.where(field, '==', userId).get();
}

async function deleteInBatches(documents) {
  for (let start = 0; start < documents.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    documents.slice(start, start + BATCH_LIMIT).forEach(document => batch.delete(document.ref));
    await batch.commit();
  }
}

async function recursiveDeleteDocs(documents) {
  for (let start = 0; start < documents.length; start += RECURSIVE_CONCURRENCY) {
    await Promise.all(documents.slice(start, start + RECURSIVE_CONCURRENCY)
      .map(document => db.recursiveDelete(document.ref)));
  }
}

async function removeOwnedFeeds(userId) {
  const snapshot = await queryDocs(db.collection('feeds'), 'authorId', userId);
  await recursiveDeleteDocs(snapshot.docs);
  return snapshot.size;
}

async function removeAuthoredContent(userId) {
  const querySpecs = [
    [db.collectionGroup('comments'), 'authorId'],
    [db.collectionGroup('comments'), 'uid'],
    [db.collectionGroup('replies'), 'authorId'],
    [db.collectionGroup('replies'), 'uid'],
    [db.collectionGroup('acrostics'), 'authorId'],
    [db.collectionGroup('multi_naming'), 'authorId'],
    [db.collectionGroup('multi_drip'), 'authorId'],
    [db.collectionGroup('multi_fill'), 'authorId'],
    [db.collection('reports'), 'reporterId'],
    [db.collection('feedback'), 'reporterId'],
  ];
  const snapshots = await Promise.all(querySpecs.map(([reference, field]) => queryDocs(reference, field, userId)));
  const documents = uniqueDocs(...snapshots);
  await recursiveDeleteDocs(documents);
  return documents.length;
}

async function removePrivateRecords(userId) {
  const querySpecs = [
    [db.collectionGroup('votes'), 'uid'],
    [db.collectionGroup('view_events'), 'uid'],
    [db.collection('follows'), 'followerId'],
    [db.collection('follows'), 'followedId'],
    [db.collection('rate_limits'), 'uid'],
    [db.collection('ai_usage'), 'userId'],
    [db.collection('ai_usage'), 'uid'],
    [db.collection('ai_king_usage'), 'userId'],
    [db.collection('point_awards'), 'userId'],
    [db.collection('point_awards'), 'uid'],
    [db.collection('upload_usage'), 'uid'],
    [db.collection('notifications'), 'uid'],
    [db.collection('notifications'), 'userId'],
  ];
  const snapshots = await Promise.all(querySpecs.map(([reference, field]) => queryDocs(reference, field, userId)));
  const documents = uniqueDocs(...snapshots);
  await deleteInBatches(documents);
  await db.recursiveDelete(db.doc(`notifications/${userId}`));
  return documents.length;
}

async function removeNicknameReservations(userId, nickname) {
  const snapshots = await Promise.all([
    queryDocs(db.collection('nicknames'), 'uid', userId),
    queryDocs(db.collection('nicknames'), 'userId', userId),
  ]);
  const documents = uniqueDocs(...snapshots);
  if (nickname) {
    const direct = await db.doc(`nicknames/${nickname}`).get();
    if (direct.exists) {
      const data = direct.data() || {};
      const owner = data.uid || data.userId;
      if (!owner || owner === userId) documents.push(direct);
    }
  }
  const unique = new Map(documents.map(document => [document.ref.path, document]));
  await deleteInBatches([...unique.values()]);
  return unique.size;
}

async function removeUserFiles(userId) {
  const bucket = storage.bucket();
  const prefixes = [`feeds/${userId}/`, `soso-feed/${userId}/`];
  let removed = 0;
  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix });
    await Promise.all(files.map(async file => {
      try {
        await file.delete();
        removed += 1;
      } catch (error) {
        if (error.code !== 404) throw error;
      }
    }));
  }
  return removed;
}

const deleteMyAccount = onCall({
  region: REGION,
  timeoutSeconds: 540,
  memory: '1GiB',
}, async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인 후 삭제할 수 있습니다.');

  const userRef = db.doc(`users/${userId}`);
  const userSnap = await userRef.get();
  const nickname = String(userSnap.exists ? userSnap.data()?.nickname || '' : '').slice(0, 150);

  try {
    const feedCount = await removeOwnedFeeds(userId);
    const contributionCount = await removeAuthoredContent(userId);
    const privateCount = await removePrivateRecords(userId);
    const fileCount = await removeUserFiles(userId);
    const nicknameCount = await removeNicknameReservations(userId, nickname);

    await Promise.all([
      db.recursiveDelete(userRef),
      db.doc(`admins/${userId}`).delete(),
    ]);

    try {
      await auth.deleteUser(userId);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    return {
      ok: true,
      removed: {
        feeds: feedCount,
        contributions: contributionCount,
        privateRecords: privateCount,
        files: fileCount,
        nicknames: nicknameCount,
      },
    };
  } catch (error) {
    console.error('[deleteMyAccount:firebase-cleanup]', userId, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Firebase 데이터를 모두 정리하지 못했습니다. 계정은 유지되므로 잠시 후 다시 시도해주세요.');
  }
});

module.exports = {
  deleteMyAccount,
  _test: {
    uniqueDocs,
    removeOwnedFeeds,
    removeAuthoredContent,
    removePrivateRecords,
    removeNicknameReservations,
    removeUserFiles,
  },
};
