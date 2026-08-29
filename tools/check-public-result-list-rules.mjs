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

function broadQuery(db) {
  return query(
    collection(db, 'results'),
    where('isPublic', '==', true),
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
      setDoc(doc(db, 'results/list-legacy-unsafe-public'), {
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

  for (const [label, db] of [
    ['authenticated', authenticatedReader],
    ['unauthenticated', publicReader]
  ]) {
    const snapshot = await assertSucceeds(getDocs(safeQuery(db)));
    const ids = snapshot.docs.map(document => document.id);
    if (!ids.includes('list-safe-public') || ids.includes('list-legacy-unsafe-public') || ids.includes('list-private')) {
      throw new Error(`${label} sanitized public list returned unexpected documents: ${ids.join(', ')}`);
    }
    await assertFails(getDocs(broadQuery(db)));
  }

  // 가장 위험한 회귀: publicDataVersion까지 맞지만 민감 필드가 남은 문서가 생기면
  // 목록 쿼리 전체를 fail-closed로 막아 한 건도 외부로 새지 않게 한다.
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'results/list-malformed-public'), {
      isPublic: true,
      publicDataVersion: 1,
      userId: 'should-never-leak',
      caseDescription: '민감 원문',
      nickname: '민감 닉네임',
      caseTitle: '잘못 생성된 공개 문서',
      createdAt: now
    });
  });

  await assertFails(getDocs(safeQuery(authenticatedReader)));
  await assertFails(getDocs(safeQuery(publicReader)));

  const adminSnapshot = await assertSucceeds(getDocs(adminAllResultsQuery(adminReader)));
  const adminIds = adminSnapshot.docs.map(document => document.id);
  for (const requiredId of [
    'list-safe-public',
    'list-legacy-unsafe-public',
    'list-private',
    'list-malformed-public'
  ]) {
    if (!adminIds.includes(requiredId)) {
      throw new Error(`administrator result list is missing ${requiredId}: ${adminIds.join(', ')}`);
    }
  }

  console.log('Public result list rules passed: sanitized queries work normally and malformed public documents fail closed while administrators retain full access.');
} finally {
  await testEnv.cleanup();
}
