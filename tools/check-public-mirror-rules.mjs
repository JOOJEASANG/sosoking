import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp
} from 'firebase/firestore';

const projectId = 'sosoking-rules-test';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const separator = emulatorHost.lastIndexOf(':');
const host = emulatorHost.slice(0, separator);
const port = Number(emulatorHost.slice(separator + 1));
const rules = fs.readFileSync('firestore.rules', 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host, port, rules }
});

const signedIn = testEnv.authenticatedContext('public-reader', {
  email: 'reader@example.com',
  email_verified: true
}).firestore();
const admin = testEnv.authenticatedContext('admin-uid', {
  email: 'admin@example.com',
  email_verified: true
}).firestore();
const unauthenticated = testEnv.unauthenticatedContext().firestore();
const now = Timestamp.now();

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'admins/admin-uid'), { role: 'admin' });
    await setDoc(doc(db, 'public_results/safe-public'), {
      isPublic: true,
      publicDataVersion: 1,
      caseTitle: '안전한 공개 사건',
      publicNickname: '익명 원고',
      publicCaseDescription: '익명화된 공개 요약',
      createdAt: now,
      updatedAt: now
    });
    await setDoc(doc(db, 'public_results/unsafe-public'), {
      isPublic: true,
      publicDataVersion: 1,
      caseTitle: '잘못 생성된 공개 사건',
      userId: 'private-uid',
      caseDescription: '노출되면 안 되는 실제 원문',
      createdAt: now,
      updatedAt: now
    });
  });

  // Dedicated public mirror allows only safe single-document reads.
  await assertSucceeds(getDoc(doc(signedIn, 'public_results/safe-public')));
  await assertSucceeds(getDoc(doc(unauthenticated, 'public_results/safe-public')));
  await assertFails(getDoc(doc(signedIn, 'public_results/unsafe-public')));
  await assertFails(getDoc(doc(unauthenticated, 'public_results/unsafe-public')));

  // Public collection listing remains callable/Admin-SDK only. Administrators can inspect it.
  await assertFails(getDocs(collection(signedIn, 'public_results')));
  await assertFails(getDocs(collection(unauthenticated, 'public_results')));
  await assertSucceeds(getDocs(collection(admin, 'public_results')));

  // No browser client, including administrators, may mutate the mirror directly.
  await assertFails(setDoc(doc(signedIn, 'public_results/forged'), {
    isPublic: true,
    publicDataVersion: 1,
    caseTitle: '위조 공개 사건'
  }));
  await assertFails(setDoc(doc(admin, 'public_results/forged-admin'), {
    isPublic: true,
    publicDataVersion: 1,
    caseTitle: '관리자 직접 쓰기'
  }));

  console.log('Public mirror rules passed: safe single reads only, server-only listing for public users, and no client writes.');
} finally {
  await testEnv.cleanup();
}
