'use strict';

const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = 'asia-northeast3';
const CONCURRENCY = 8;

async function removeOwnedCollection(collectionName, userId) {
  const snapshot = await db.collection(collectionName).where('createdBy', '==', userId).get();
  for (let start = 0; start < snapshot.docs.length; start += CONCURRENCY) {
    await Promise.all(snapshot.docs.slice(start, start + CONCURRENCY)
      .map(document => db.recursiveDelete(document.ref)));
  }
  return snapshot.size;
}

const cleanupCommunityContentOnUserDelete = onDocumentDeleted({
  document: 'users/{userId}',
  region: REGION,
  timeoutSeconds: 540,
  memory: '512MiB',
}, async event => {
  const userId = String(event.params?.userId || '').trim();
  if (!userId) return null;
  const [materials, debates] = await Promise.all([
    removeOwnedCollection('materials', userId),
    removeOwnedCollection('debates', userId),
  ]);
  console.log('[community cleanup]', { userId, materials, debates });
  return null;
});

module.exports = {
  cleanupCommunityContentOnUserDelete,
  _test: { removeOwnedCollection },
};
