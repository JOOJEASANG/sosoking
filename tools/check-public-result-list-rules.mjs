import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  getDocs,
  orderBy,
  query,
  setDoc,
  doc,
  Timestamp,
  where
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

const reader = testEnv.authenticatedContext('public-list-reader', {
  email: 'reader@example.com',
  email_verified: true
}).firestore();
const now = Timestamp.now();

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'results/list-safe-public'), {
        isPublic: true,
        publicDataVersion: 1,
        publicCaseDescription: '',
        publicNickname: '익명 원고',
        caseTitle: '목록 공개 사건',
        createdAt: now
      }),
      setDoc(doc(db, 'results/list-unsafe-public'), {
        isPublic: true,
        userId: 'owner-uid',
        caseDescription: '공개 전 정리가 필요한 원문',
        nickname: '원문 닉네임',
        caseTitle: '목록 제외 사건',
        createdAt: now
      }),
      setDoc(doc(db, 'results/list-private'), {
        isPublic: false,
        publicDataVersion: 1,
        caseTitle: '비공개 사건',
        createdAt: now
      })
    ]);
  });

  const safeQuery = query(
    collection(reader, 'results'),
    where('isPublic', '==', true),
    where('publicDataVersion', '==', 1),
    orderBy('createdAt', 'desc')
  );
  const safeSnapshot = await assertSucceeds(getDocs(safeQuery));
  const ids = safeSnapshot.docs.map(document => document.id);
  if (!ids.includes('list-safe-public') || ids.includes('list-unsafe-public') || ids.includes('list-private')) {
    throw new Error(`sanitized public list returned unexpected documents: ${ids.join(', ')}`);
  }

  await assertFails(getDocs(query(
    collection(reader, 'results'),
    where('isPublic', '==', true),
    orderBy('createdAt', 'desc')
  )));

  console.log('Public result list rules passed: sanitized query succeeds and broad public query is denied.');
} finally {
  await testEnv.cleanup();
}
