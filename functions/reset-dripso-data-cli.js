'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

if (!getApps().length) initializeApp();

const RESET_ID = 'dripso-full-reset-20260810-v1';
const RESET_REF = `maintenance/${RESET_ID}`;

async function resetDripsoDataOnce() {
  const db = getFirestore();
  const markerRef = db.doc(RESET_REF);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists && markerSnap.data()?.status === 'completed') {
    return { skipped: true, resetId: RESET_ID, deletedCollections: [], storageCleared: false };
  }

  const collections = await db.listCollections();
  const dripsoCollections = collections
    .filter(collectionRef => collectionRef.id.startsWith('dripso_'))
    .sort((left, right) => left.id.localeCompare(right.id));

  const deletedCollections = [];
  for (const collectionRef of dripsoCollections) {
    console.log(`Deleting Firestore collection recursively: ${collectionRef.id}`);
    await db.recursiveDelete(collectionRef);
    deletedCollections.push(collectionRef.id);
  }

  const bucket = getStorage().bucket();
  await bucket.deleteFiles({ prefix: 'dripso/', force: true });

  await markerRef.set({
    resetId: RESET_ID,
    status: 'completed',
    deletedCollections,
    storagePrefix: 'dripso/',
    completedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    skipped: false,
    resetId: RESET_ID,
    deletedCollections,
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
