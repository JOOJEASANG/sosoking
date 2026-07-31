import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
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

const user = testEnv.authenticatedContext('dripso-user', {
  email: 'dripso@example.com',
  email_verified: true
}).firestore();
const other = testEnv.authenticatedContext('dripso-other', {
  email: 'other@example.com',
  email_verified: true
}).firestore();
const admin = testEnv.authenticatedContext('dripso-admin', {
  email: 'admin@example.com',
  email_verified: true
}).firestore();
const unauthenticated = testEnv.unauthenticatedContext().firestore();
const now = Timestamp.now();

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'admins/dripso-admin'), { role: 'admin' }),
      setDoc(doc(db, 'dripso_topics/visible-topic'), {
        type: 'daily',
        title: '공개 주제',
        prompt: '한 줄 드립을 남겨주세요.',
        nickname: '등록자',
        status: 'visible',
        commentCount: 1,
        topLikeCount: 3,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/hidden-topic'), {
        type: 'naming',
        title: '숨김 주제',
        prompt: '관리자 숨김',
        nickname: '등록자',
        status: 'hidden',
        commentCount: 0,
        topLikeCount: 0,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/visible-topic/comments/visible-comment'), {
        nickname: '댓글러',
        text: '공개 댓글 드립',
        status: 'visible',
        likeCount: 3,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/visible-topic/comments/hidden-comment'), {
        nickname: '댓글러',
        text: '숨김 댓글',
        status: 'hidden',
        likeCount: 0,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/visible-topic/comments/visible-comment/likes/dripso-user'), {
        uid: 'dripso-user',
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topic_authors/visible-topic'), {
        uid: 'dripso-user',
        topicId: 'visible-topic'
      }),
      setDoc(doc(db, 'dripso_comment_authors/visible-topic/items/visible-comment'), {
        uid: 'dripso-user',
        topicId: 'visible-topic',
        commentId: 'visible-comment'
      })
    ]);
  });

  await assertSucceeds(getDoc(doc(unauthenticated, 'dripso_topics/visible-topic')));
  await assertFails(getDoc(doc(unauthenticated, 'dripso_topics/hidden-topic')));
  await assertSucceeds(getDoc(doc(admin, 'dripso_topics/hidden-topic')));
  await assertSucceeds(getDocs(query(
    collection(unauthenticated, 'dripso_topics'),
    where('status', '==', 'visible')
  )));

  await assertSucceeds(getDoc(doc(unauthenticated, 'dripso_topics/visible-topic/comments/visible-comment')));
  await assertFails(getDoc(doc(unauthenticated, 'dripso_topics/visible-topic/comments/hidden-comment')));
  await assertSucceeds(getDocs(query(
    collection(unauthenticated, 'dripso_topics/visible-topic/comments'),
    where('status', '==', 'visible')
  )));

  await assertFails(setDoc(doc(user, 'dripso_topics/direct-topic'), {
    type: 'daily', status: 'visible', title: '직접 쓰기', createdAt: now
  }));
  await assertFails(updateDoc(doc(user, 'dripso_topics/visible-topic'), { title: '직접 수정' }));
  await assertFails(deleteDoc(doc(user, 'dripso_topics/visible-topic')));
  await assertFails(setDoc(doc(user, 'dripso_topics/visible-topic/comments/direct-comment'), {
    nickname: '침입자', text: '직접 댓글', status: 'visible', createdAt: now
  }));

  await assertSucceeds(getDoc(doc(user, 'dripso_topics/visible-topic/comments/visible-comment/likes/dripso-user')));
  await assertFails(getDoc(doc(other, 'dripso_topics/visible-topic/comments/visible-comment/likes/dripso-user')));
  await assertFails(setDoc(doc(user, 'dripso_topics/visible-topic/comments/visible-comment/likes/dripso-other'), {
    uid: 'dripso-other', createdAt: now
  }));
  await assertFails(deleteDoc(doc(user, 'dripso_topics/visible-topic/comments/visible-comment/likes/dripso-user')));

  await assertFails(getDoc(doc(user, 'dripso_topic_authors/visible-topic')));
  await assertFails(getDoc(doc(admin, 'dripso_topic_authors/visible-topic')));
  await assertFails(getDoc(doc(user, 'dripso_comment_authors/visible-topic/items/visible-comment')));
  await assertFails(getDoc(doc(admin, 'dripso_comment_authors/visible-topic/items/visible-comment')));

  console.log('Dripso Firestore rules integration passed: visible public reads, callable-only writes, private authors, and private per-user likes.');
} finally {
  await testEnv.cleanup();
}
