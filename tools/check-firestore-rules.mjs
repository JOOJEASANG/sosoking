import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  updateDoc
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

const owner = testEnv.authenticatedContext('owner-uid', {
  email: 'owner@example.com',
  email_verified: true
}).firestore();
const other = testEnv.authenticatedContext('other-uid', {
  email: 'other@example.com',
  email_verified: true
}).firestore();
const admin = testEnv.authenticatedContext('admin-uid', {
  email: 'sosoday1976@gmail.com',
  email_verified: true
}).firestore();
const anonymous = testEnv.unauthenticatedContext().firestore();
const now = Timestamp.now();

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/owner-uid'), { uid: 'owner-uid', nickname: '원고' }),
      setDoc(doc(db, 'user_names/원고'), { uid: 'owner-uid', nickname: '원고' }),
      setDoc(doc(db, 'cases/private-case'), {
        userId: 'owner-uid',
        isPublic: false,
        status: 'completed',
        updatedAt: now
      }),
      setDoc(doc(db, 'results/private-case'), {
        isPublic: false,
        caseTitle: '비공개 사건',
        updatedAt: now
      }),
      setDoc(doc(db, 'cases/public-case'), {
        userId: 'owner-uid',
        isPublic: true,
        status: 'completed',
        updatedAt: now
      }),
      setDoc(doc(db, 'results/public-case'), {
        isPublic: true,
        caseTitle: '공개 사건',
        updatedAt: now
      }),
      setDoc(doc(db, 'court_comments/public-case/items/comment-1'), {
        nickname: '방청객',
        text: '재미있는 판결입니다.',
        createdAt: now
      }),
      setDoc(doc(db, 'site_settings/config'), {
        geminiModel: 'private-model',
        bannedWords: ['private-word']
      }),
      setDoc(doc(db, 'site_public/config'), {
        dailyLimit: 3,
        cooldownSec: 45
      }),
      setDoc(doc(db, 'ai_limits/daily_2026-07-28'), { count: 1 }),
      setDoc(doc(db, 'ai_limits/daily_2026-07-28/users/owner-uid'), {
        uid: 'owner-uid',
        count: 1
      })
    ]);
  });

  // 프로필 및 닉네임 예약은 서버 전용이다.
  await assertSucceeds(getDoc(doc(owner, 'users/owner-uid')));
  await assertFails(getDoc(doc(other, 'users/owner-uid')));
  await assertFails(setDoc(doc(owner, 'users/owner-uid'), { uid: 'owner-uid', nickname: '변경' }));
  await assertFails(getDoc(doc(owner, 'user_names/원고')));
  await assertFails(setDoc(doc(owner, 'user_names/새닉네임'), { uid: 'owner-uid' }));

  // 공개 표시가 붙은 사건도 원문 cases 문서는 소유자와 관리자만 읽는다.
  await assertSucceeds(getDoc(doc(owner, 'cases/private-case')));
  await assertSucceeds(getDoc(doc(owner, 'cases/public-case')));
  await assertFails(getDoc(doc(other, 'cases/public-case')));
  await assertFails(getDoc(doc(anonymous, 'cases/public-case')));
  await assertFails(setDoc(doc(owner, 'cases/direct-create'), {
    userId: 'owner-uid',
    isPublic: false,
    createdAt: now
  }));
  await assertFails(updateDoc(doc(owner, 'cases/private-case'), { isPublic: true }));
  await assertSucceeds(updateDoc(doc(admin, 'cases/private-case'), { isPublic: true }));

  // 결과는 소유자가 모두 읽고, 다른 로그인 사용자는 명시적으로 공개된 결과만 읽는다.
  await assertSucceeds(getDoc(doc(owner, 'results/private-case')));
  await assertFails(getDoc(doc(other, 'results/private-case')));
  await assertSucceeds(getDoc(doc(other, 'results/public-case')));
  await assertFails(getDoc(doc(anonymous, 'results/public-case')));
  await assertFails(updateDoc(doc(owner, 'results/private-case'), { isPublic: true }));
  await assertSucceeds(updateDoc(doc(admin, 'results/private-case'), { isPublic: true }));

  // 공개 방청 데이터는 로그인 사용자만 읽고 클라이언트가 직접 쓰지 못한다.
  await assertSucceeds(getDoc(doc(other, 'court_comments/public-case/items/comment-1')));
  await assertFails(getDoc(doc(anonymous, 'court_comments/public-case/items/comment-1')));
  await assertFails(setDoc(doc(other, 'court_comments/public-case/items/comment-2'), {
    nickname: '침입자',
    text: '직접 쓰기',
    createdAt: now
  }));

  // 내부 운영 설정은 관리자만, 공개 설정은 누구나 읽을 수 있다.
  await assertFails(getDoc(doc(owner, 'site_settings/config')));
  await assertSucceeds(getDoc(doc(admin, 'site_settings/config')));
  await assertSucceeds(getDoc(doc(anonymous, 'site_public/config')));
  await assertFails(updateDoc(doc(owner, 'site_public/config'), { dailyLimit: 20 }));
  await assertSucceeds(updateDoc(doc(admin, 'site_public/config'), { dailyLimit: 4 }));

  // AI 한도는 본인 세부 기록 또는 관리자만 읽고 모든 클라이언트 쓰기를 막는다.
  await assertSucceeds(getDoc(doc(owner, 'ai_limits/daily_2026-07-28/users/owner-uid')));
  await assertFails(getDoc(doc(other, 'ai_limits/daily_2026-07-28/users/owner-uid')));
  await assertFails(getDoc(doc(owner, 'ai_limits/daily_2026-07-28')));
  await assertSucceeds(getDoc(doc(admin, 'ai_limits/daily_2026-07-28')));
  await assertFails(updateDoc(doc(owner, 'ai_limits/daily_2026-07-28/users/owner-uid'), { count: 0 }));

  // 신고는 필드·소유자·상태 제한을 모두 만족할 때만 생성된다.
  await assertSucceeds(setDoc(doc(owner, 'reports/valid-report'), {
    caseId: 'public-case',
    reason: '개인정보 노출',
    status: 'pending',
    createdAt: now,
    userId: 'owner-uid'
  }));
  await assertFails(setDoc(doc(owner, 'reports/forged-report'), {
    caseId: 'public-case',
    reason: '위조 신고',
    status: 'pending',
    createdAt: now,
    userId: 'other-uid'
  }));

  // 관리자 삭제 권한도 실제 규칙으로 확인한다.
  await assertFails(deleteDoc(doc(owner, 'users/owner-uid')));
  await assertSucceeds(deleteDoc(doc(admin, 'users/owner-uid')));

  console.log('Firestore rules integration passed: 34 allow/deny assertions.');
} finally {
  await testEnv.cleanup();
}
