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

const authenticatedReader = testEnv.authenticatedContext('public-list-reader', {
  email: 'reader@example.com',
  email_verified: true
}).firestore();
const adminReader = testEnv.authenticatedContext('admin-reader', {
  email: 'admin@example.com',
  email_verified: true
}).firestore();
const publicReader = testEnv.unauthenticatedContext().firestore();
const now = Timestamp.now();

function safeQuery(db) {
  return query(
    collection(db, 'results'),
    where('isPublic', '==', true),
    where('publicDataVersion', '==', 1),
    orderBy('createdAt', 'desc')
  );
}

function adminAllResultsQuery(db) {
  return query(collection(db, 'results'), orderBy('createdAt', 'desc'));
}

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'admins', 'admin-reader'), { enabled: true }),
      setDoc(doc(db, 'results/list-safe-public'), {
        isPublic: true,
        publicDataVersion: 1,
        publicCaseDescription: '',
        publicNickname: '익명 원고',
        caseTitle: '목록 공개 사건',
        createdAt: now
      }),
      setDoc(doc(db, 'results/list-malformed-public'), {
        isPublic: true,
        publicDataVersion: 1,
        userId: 'should-never-leak',
        caseDescription: '민감 원문',
        nickname: '민감 닉네임',
        caseTitle: '잘못 생성된 공개 문서',
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

  // 공개 브라우저는 results 컬렉션을 직접 list할 수 없다.
  // 공개 목록은 listPublicResults Callable의 명시적 필드 projection을 통해서만 제공한다.
  await assertFails(getDocs(safeQuery(authenticatedReader)));
  await assertFails(getDocs(safeQuery(publicReader)));

  const adminSnapshot = await assertSucceeds(getDocs(adminAllResultsQuery(adminReader)));
  const adminIds = adminSnapshot.docs.map(document => document.id);
  for (const requiredId of ['list-safe-public', 'list-malformed-public', 'list-private']) {
    if (!adminIds.includes(requiredId)) {
      throw new Error(`administrator result list is missing ${requiredId}: ${adminIds.join(', ')}`);
    }
  }

  console.log('Public result list rules passed: client-side list access is denied while administrators retain full dashboard access.');
} finally {
  await testEnv.cleanup();
}
