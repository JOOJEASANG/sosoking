'use strict';

const assert = require('node:assert/strict');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST is required');
}
if (!getApps().length) initializeApp({ projectId: 'sosoking-rules-test' });

const db = getFirestore();
const { deleteUserProfileData } = require('./admin-actions');

(async () => {
  const ownedUserId = 'admin-delete-owned-profile';
  const foreignUserId = 'admin-delete-foreign-profile';
  const foreignOwnerId = 'different-user';

  await Promise.all([
    db.doc(`users/${ownedUserId}`).set({ uid: ownedUserId, nickname: '삭제테스트' }),
    db.doc('user_names/삭제테스트').set({ uid: ownedUserId, nickname: '삭제테스트' }),
    db.doc(`users/${foreignUserId}`).set({ uid: foreignUserId, nickname: '공유예약' }),
    db.doc('user_names/공유예약').set({ uid: foreignOwnerId, nickname: '공유예약' })
  ]);

  const ownedResult = await deleteUserProfileData(ownedUserId);
  assert.deepEqual(ownedResult, { existed: true, nicknameReleased: true });
  assert.equal((await db.doc(`users/${ownedUserId}`).get()).exists, false);
  assert.equal((await db.doc('user_names/삭제테스트').get()).exists, false);

  const foreignResult = await deleteUserProfileData(foreignUserId);
  assert.deepEqual(foreignResult, { existed: true, nicknameReleased: false });
  assert.equal((await db.doc(`users/${foreignUserId}`).get()).exists, false);
  const foreignReservation = await db.doc('user_names/공유예약').get();
  assert.equal(foreignReservation.exists, true);
  assert.equal(foreignReservation.data().uid, foreignOwnerId);

  const missingResult = await deleteUserProfileData('admin-delete-missing-profile');
  assert.deepEqual(missingResult, { existed: false, nicknameReleased: false });

  console.log('Administrator profile deletion integration passed: owned nickname released and foreign reservation preserved.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
