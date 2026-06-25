'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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

function collectCommentParents(documents) {
  const parents = new Map();
  for (const document of documents) {
    if (document.ref.parent.id !== 'comments') continue;
    const parentRef = document.ref.parent.parent;
    if (!parentRef) continue;
    const current = parents.get(parentRef.path) || { ref: parentRef, count: 0 };
    current.count += 1;
    parents.set(parentRef.path, current);
  }
  return [...parents.values()];
}

async function decrementCommentCounts(parents) {
  for (let start = 0; start < parents.length; start += RECURSIVE_CONCURRENCY) {
    await Promise.all(parents.slice(start, start + RECURSIVE_CONCURRENCY).map(({ ref, count }) => (
      db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return;
        const current = Math.max(0, Number(snapshot.data()?.commentCount || 0));
        transaction.set(ref, {
          commentCount: Math.max(0, current - count),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      })
    )));
  }
}

async function removeOwnedFeeds(userId) {
  const snapshot = await queryDocs(db.collection('feeds'), 'authorId', userId);
  await recursiveDeleteDocs(snapshot.docs);
  return snapshot.size;
}

async function removeAuthoredContent(userId) {
  const [commentsByAuthor, commentsByUid, ...otherSnapshots] = await Promise.all([
    queryDocs(db.collectionGroup('comments'), 'authorId', userId),
    queryDocs(db.collectionGroup('comments'), 'uid', userId),
    queryDocs(db.collectionGroup('replies'), 'authorId', userId),
    queryDocs(db.collectionGroup('replies'), 'uid', userId),
    queryDocs(db.collectionGroup('acrostics'), 'authorId', userId),
    queryDocs(db.collectionGroup('multi_naming'), 'authorId', userId),
    queryDocs(db.collectionGroup('multi_drip'), 'authorId', userId),
    queryDocs(db.collectionGroup('multi_fill'), 'authorId', userId),
    queryDocs(db.collection('reports'), 'reporterId', userId),
    queryDocs(db.collection('feedback'), 'reporterId', userId),
  ]);
  const comments = uniqueDocs(commentsByAuthor, commentsByUid);
  const otherDocuments = uniqueDocs(...otherSnapshots);
  const commentParents = collectCommentParents(comments);
  await recursiveDeleteDocs([...comments, ...otherDocuments]);
  await decrementCommentCounts(commentParents);
  return comments.length + otherDocuments.length;
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
  const prefixes = [
    `feeds/${userId}/`,
    `soso-feed/${userId}/`,
    `community/materials/${userId}/`,
    `community/debates/${userId}/`,
  ];
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
    collectCommentParents,
    decrementCommentCounts,
    removeOwnedFeeds,
    removeAuthoredContent,
    removePrivateRecords,
    removeNicknameReservations,
    removeUserFiles,
  },
};
