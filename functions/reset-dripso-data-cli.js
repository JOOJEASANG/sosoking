'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const STORAGE_BUCKET = 'sosoking-481e6.firebasestorage.app';
if (!getApps().length) initializeApp({ storageBucket: STORAGE_BUCKET });

const RESET_ID = 'dripso-full-reset-20260810-v1';
const RESET_REF = `maintenance/${RESET_ID}`;

async function remainingDripsoCollections(db) {
  return (await db.listCollections())
    .filter(collectionRef => collectionRef.id.startsWith('dripso_'))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function resetDripsoDataOnce() {
  const db = getFirestore();
  const markerRef = db.doc(RESET_REF);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && markerSnap.data()?.status === 'completed') {
    return { skipped: true, resetId: RESET_ID, deletedCollections: [], storageCleared: false };
  }

  const deletedCollections = [];
  for (const collectionRef of await remainingDripsoCollections(db)) {
    console.log(`Deleting Firestore collection recursively: ${collectionRef.id}`);
    await db.recursiveDelete(collectionRef);
    deletedCollections.push(collectionRef.id);
  }

  const bucket = getStorage().bucket(STORAGE_BUCKET);
  await bucket.deleteFiles({ prefix: 'dripso/', force: true });

  const leftovers = await remainingDripsoCollections(db);
  if (leftovers.length) {
    throw new Error(`Dripso Firestore reset incomplete: ${leftovers.map(item => item.id).join(', ')}`);
  }
  const [remainingFiles] = await bucket.getFiles({ prefix: 'dripso/', maxResults: 1 });
  if (remainingFiles.length) {
    throw new Error(`Dripso Storage reset incomplete: ${remainingFiles[0].name}`);
  }

  await markerRef.set({
    resetId: RESET_ID,
    status: 'completed',
    deletedCollections,
    storageBucket: STORAGE_BUCKET,
    storagePrefix: 'dripso/',
    completedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    skipped: false,
    resetId: RESET_ID,
    deletedCollections,
    storageBucket: STORAGE_BUCKET,
    storageCleared: true
  };
}

resetDripsoDataOnce()
  .then(result => {
    console.log(JSON.stringify({ success: true, ...result }));
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to reset Dripso data:', error);
    process.exit(1);
  });
