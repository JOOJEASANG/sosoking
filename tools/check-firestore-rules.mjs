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
  email: 'admin@example.com',
  email_verified: true
}).firestore();
const firebaseAnonymous = testEnv.authenticatedContext('anonymous-uid', {
  firebase: { sign_in_provider: 'anonymous' }
}).firestore();
const formerBootstrap = testEnv.authenticatedContext('former-bootstrap-uid', {
  email: 'sosoday1976@gmail.com',
  email_verified: true
}).firestore();
const unauthenticated = testEnv.unauthenticatedContext().firestore();
const now = Timestamp.now();

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'admins/admin-uid'), { role: 'admin' }),
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
        publicDataVersion: 1,
        publicCaseDescription: '',
        publicNickname: '익명 원고',
        caseTitle: '공개 사건',
        updatedAt: now
      }),
      setDoc(doc(db, 'public_results/public-case'), {
        isPublic: true,
        publicDataVersion: 1,
        publicCaseDescription: '',
        publicNickname: '익명 원고',
        caseTitle: '공개 사건',
        updatedAt: now
      }),
      setDoc(doc(db, 'cases/unsafe-public-case'), {
        userId: 'owner-uid',
        isPublic: true,
        status: 'completed',
        updatedAt: now
      }),
      setDoc(doc(db, 'results/unsafe-public-case'), {
        isPublic: true,
        userId: 'owner-uid',
        nickname: '원고 실명 가능 값',
        caseDescription: '공개되면 안 되는 원문',
        caseTitle: '정리 전 공개 사건',
        updatedAt: now
      }),
      setDoc(doc(db, 'court_comments/public-case/items/comment-1'), {
        nickname: '방청객',
        text: '재미있는 판결입니다.',
        createdAt: now
      }),
      setDoc(doc(db, 'court_comment_authors/public-case/items/comment-1'), {
        uid: 'owner-uid',
        caseId: 'public-case',
        commentId: 'comment-1'
      }),
      setDoc(doc(db, 'case_id_aliases/legacy-hash'), {
        targetCaseId: 'public-case',
        status: 'completed'
      }),
      setDoc(doc(db, 'action_limits/owner-uid_court-comment'), {
        uid: 'owner-uid',
        count: 1
      }),
      setDoc(doc(db, 'report_keys/key-1'), {
        uid: 'owner-uid',
        caseId: 'public-case'
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
  await assertFails(getDoc(doc(firebaseAnonymous, 'cases/public-case')));
  await assertFails(getDoc(doc(unauthenticated, 'cases/public-case')));
  await assertFails(setDoc(doc(owner, 'cases/direct-create'), {
    userId: 'owner-uid',
    isPublic: false,
    createdAt: now
  }));
  await assertFails(updateDoc(doc(owner, 'cases/private-case'), { isPublic: true }));
  await assertSucceeds(updateDoc(doc(admin, 'cases/private-case'), { isPublic: true }));

  // 내부 results 문서는 공개 여부와 관계없이 소유자와 관리자만 읽는다.
  await assertSucceeds(getDoc(doc(owner, 'results/private-case')));
  await assertFails(getDoc(doc(other, 'results/private-case')));
  await assertSucceeds(getDoc(doc(owner, 'results/public-case')));
  await assertSucceeds(getDoc(doc(admin, 'results/public-case')));
  await assertFails(getDoc(doc(other, 'results/public-case')));
  await assertFails(getDoc(doc(firebaseAnonymous, 'results/public-case')));
  await assertFails(getDoc(doc(unauthenticated, 'results/public-case')));
  await assertSucceeds(getDoc(doc(owner, 'results/unsafe-public-case')));
  await assertSucceeds(getDoc(doc(admin, 'results/unsafe-public-case')));
  await assertFails(getDoc(doc(other, 'results/unsafe-public-case')));
  await assertFails(getDoc(doc(firebaseAnonymous, 'results/unsafe-public-case')));
  await assertFails(getDoc(doc(unauthenticated, 'results/unsafe-public-case')));
  await assertFails(updateDoc(doc(owner, 'results/private-case'), { isPublic: true }));
  await assertSucceeds(updateDoc(doc(admin, 'results/private-case'), { isPublic: true }));

  // public_results는 서버/관리자 전용 미러다. 공개 화면은 Callable projection을 사용한다.
  await assertFails(getDoc(doc(other, 'public_results/public-case')));
  await assertFails(getDoc(doc(firebaseAnonymous, 'public_results/public-case')));
  await assertFails(getDoc(doc(unauthenticated, 'public_results/public-case')));
  await assertSucceeds(getDoc(doc(admin, 'public_results/public-case')));
  await assertFails(setDoc(doc(owner, 'public_results/direct-write'), {
    isPublic: true,
    publicDataVersion: 1,
    caseTitle: '직접 공개 쓰기'
  }));

  // 과거 부트스트랩 이메일은 admins 문서가 없으면 관리자 권한을 얻지 못한다.
  await assertFails(getDoc(doc(formerBootstrap, 'site_settings/config')));
  await assertFails(updateDoc(doc(formerBootstrap, 'cases/private-case'), { isPublic: false }));

  // 공개 방청 데이터는 현재 authoritative results가 안전한 공개 상태일 때 앱 세션이 읽을 수 있다.
  await assertSucceeds(getDoc(doc(other, 'court_comments/public-case/items/comment-1')));
  await assertSucceeds(getDoc(doc(firebaseAnonymous, 'court_comments/public-case/items/comment-1')));
  await assertFails(getDoc(doc(unauthenticated, 'court_comments/public-case/items/comment-1')));
  await assertFails(setDoc(doc(other, 'court_comments/public-case/items/comment-2'), {
    nickname: '침입자',
    text: '직접 쓰기',
    createdAt: now
  }));

  // 댓글 작성자, 주소 별칭, 동작 제한, 신고 중복 키는 Admin SDK 전용이다.
  await assertFails(getDoc(doc(owner, 'court_comment_authors/public-case/items/comment-1')));
  await assertFails(getDoc(doc(admin, 'court_comment_authors/public-case/items/comment-1')));
  await assertFails(getDoc(doc(owner, 'case_id_aliases/legacy-hash')));
  await assertFails(getDoc(doc(admin, 'case_id_aliases/legacy-hash')));
  await assertFails(setDoc(doc(admin, 'case_id_aliases/forged-hash'), {
    targetCaseId: 'private-case',
    status: 'completed'
  }));
  await assertFails(getDoc(doc(owner, 'action_limits/owner-uid_court-comment')));
  await assertFails(updateDoc(doc(owner, 'action_limits/owner-uid_court-comment'), { count: 0 }));
  await assertFails(getDoc(doc(owner, 'report_keys/key-1')));

  // 내부 운영 설정은 관리자만, 공개 설정은 누구나 읽을 수 있다.
  await assertFails(getDoc(doc(owner, 'site_settings/config')));
  await assertSucceeds(getDoc(doc(admin, 'site_settings/config')));
  await assertSucceeds(getDoc(doc(unauthenticated, 'site_public/config')));
  await assertFails(updateDoc(doc(owner, 'site_public/config'), { dailyLimit: 20 }));
  await assertSucceeds(updateDoc(doc(admin, 'site_public/config'), { dailyLimit: 4 }));

  // AI 한도는 본인 세부 기록 또는 관리자만 읽고 모든 클라이언트 쓰기를 막는다.
  await assertSucceeds(getDoc(doc(owner, 'ai_limits/daily_2026-07-28/users/owner-uid')));
  await assertFails(getDoc(doc(other, 'ai_limits/daily_2026-07-28/users/owner-uid')));
  await assertFails(getDoc(doc(owner, 'ai_limits/daily_2026-07-28')));
  await assertSucceeds(getDoc(doc(admin, 'ai_limits/daily_2026-07-28')));
  await assertFails(updateDoc(doc(owner, 'ai_limits/daily_2026-07-28/users/owner-uid'), { count: 0 }));

  // 신고는 submitReport 함수만 생성하며 클라이언트 직접 생성은 모두 거부한다.
  await assertFails(setDoc(doc(owner, 'reports/direct-report'), {
    caseId: 'public-case',
    reason: '개인정보 노출',
    status: 'pending',
    createdAt: now,
    userId: 'owner-uid'
  }));
  await assertFails(setDoc(doc(firebaseAnonymous, 'reports/anonymous-report'), {
    caseId: 'public-case',
    reason: '익명 직접 신고',
    status: 'pending',
    createdAt: now,
    userId: 'anonymous-uid'
  }));

  // 관리자 삭제 권한도 실제 규칙으로 확인한다.
  await assertFails(deleteDoc(doc(owner, 'users/owner-uid')));
  await assertSucceeds(deleteDoc(doc(admin, 'users/owner-uid')));

  console.log('Firestore rules integration passed: internal results and mirrors are private, public court reads re-check authoritative publication state, and server-only mutations remain enforced.');
} finally {
  await testEnv.cleanup();
}
