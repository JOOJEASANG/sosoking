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
const futureEntry = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
const futureVoting = Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000);
const futureFinal = Timestamp.fromMillis(Date.now() + 4 * 60 * 60 * 1000);
const pastEntry = Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000);
const pastVoting = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
const pastFinal = Timestamp.fromMillis(Date.now() - 30 * 60 * 1000);

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
      setDoc(doc(db, 'dripso_topics/game-open'), {
        type: 'situation',
        mode: 'blank',
        gameVersion: 2,
        title: '블라인드 출전 중',
        prompt: '[[dripso-mode:blank]] 빈칸을 채워주세요.',
        nickname: '판주',
        status: 'visible',
        commentCount: 1,
        entryDeadline: futureEntry,
        votingDeadline: futureVoting,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/game-closed'), {
        type: 'situation',
        mode: 'wrong',
        gameVersion: 2,
        title: '종료된 배틀',
        prompt: '[[dripso-mode:wrong]] 오답을 제출하세요.',
        nickname: '판주',
        status: 'visible',
        commentCount: 1,
        entryDeadline: pastEntry,
        votingDeadline: pastVoting,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/tournament-open'), {
        type: 'situation',
        mode: 'comeback',
        gameVersion: 3,
        title: '파이널4 진행 중',
        prompt: '[[dripso-mode:comeback]] 받아치기를 제출하세요.',
        nickname: '판주',
        status: 'visible',
        commentCount: 1,
        entryDeadline: pastEntry,
        prelimDeadline: futureVoting,
        finalDeadline: futureFinal,
        tournamentRound: 'prelim',
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/tournament-closed'), {
        type: 'naming',
        mode: 'naming',
        gameVersion: 3,
        title: '파이널4 종료',
        prompt: '[[dripso-mode:naming]] 이름을 지어주세요.',
        nickname: '판주',
        status: 'visible',
        commentCount: 1,
        entryDeadline: pastEntry,
        prelimDeadline: pastVoting,
        finalDeadline: pastFinal,
        tournamentRound: 'closed',
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
      setDoc(doc(db, 'dripso_topics/game-open/comments/blind-entry'), {
        nickname: '비공개 출전자',
        text: '마감 전에는 보이면 안 되는 작품',
        status: 'visible',
        gameVersion: 2,
        battleScore: 0,
        duelCount: 0,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/game-closed/comments/final-entry'), {
        nickname: '우승 후보',
        text: '종료 뒤 공개되는 작품',
        status: 'visible',
        gameVersion: 2,
        battleScore: 4,
        duelCount: 7,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/tournament-open/comments/tournament-blind-entry'), {
        nickname: '파이널 출전자',
        text: '결승 종료 전에는 보이면 안 되는 작품',
        status: 'visible',
        gameVersion: 3,
        prelimScore: 5,
        prelimDuels: 8,
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_topics/tournament-closed/comments/tournament-champion'), {
        nickname: '챔피언',
        text: '결승 종료 뒤 공개되는 작품',
        status: 'visible',
        gameVersion: 3,
        prelimScore: 7,
        prelimDuels: 10,
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
      }),
      setDoc(doc(db, 'dripso_battle_voters/game-open/users/dripso-user/votes/pair-key'), {
        topicId: 'game-open',
        voterUid: 'dripso-user',
        selectedEntryId: 'blind-entry',
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_tournament_matches/tournament-open/items/semi1'), {
        topicId: 'tournament-open',
        round: 'semifinal',
        status: 'active',
        leftEntryId: 'entry-a',
        rightEntryId: 'entry-d',
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_tournament_prelim_voters/tournament-open/users/dripso-user/votes/pair-key'), {
        topicId: 'tournament-open',
        voterUid: 'dripso-user',
        selectedEntryId: 'entry-a',
        createdAt: now
      }),
      setDoc(doc(db, 'dripso_tournament_voters/tournament-open/rounds/semifinal/matches/semi1/users/dripso-user'), {
        topicId: 'tournament-open',
        voterUid: 'dripso-user',
        selectedEntryId: 'entry-a',
        createdAt: now
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

  // 게임 버전 2의 출전작은 투표 종료 전까지 직접 읽을 수 없다.
  await assertSucceeds(getDoc(doc(unauthenticated, 'dripso_topics/game-open')));
  await assertFails(getDoc(doc(unauthenticated, 'dripso_topics/game-open/comments/blind-entry')));
  await assertFails(getDoc(doc(user, 'dripso_topics/game-open/comments/blind-entry')));
  await assertFails(getDoc(doc(other, 'dripso_topics/game-open/comments/blind-entry')));
  await assertFails(getDocs(query(
    collection(unauthenticated, 'dripso_topics/game-open/comments'),
    where('status', '==', 'visible')
  )));
  await assertSucceeds(getDoc(doc(admin, 'dripso_topics/game-open/comments/blind-entry')));

  // 투표 종료 뒤에는 게임 버전 2의 최종 순위와 출전작을 공개한다.
  await assertSucceeds(getDoc(doc(unauthenticated, 'dripso_topics/game-closed/comments/final-entry')));
  await assertSucceeds(getDocs(query(
    collection(unauthenticated, 'dripso_topics/game-closed/comments'),
    where('status', '==', 'visible')
  )));

  // 게임 버전 3은 익명 예선·준결승·결승 동안 계속 블라인드이며 최종 결승 뒤에만 공개된다.
  await assertSucceeds(getDoc(doc(unauthenticated, 'dripso_topics/tournament-open')));
  await assertFails(getDoc(doc(unauthenticated, 'dripso_topics/tournament-open/comments/tournament-blind-entry')));
  await assertFails(getDoc(doc(user, 'dripso_topics/tournament-open/comments/tournament-blind-entry')));
  await assertFails(getDocs(query(
    collection(unauthenticated, 'dripso_topics/tournament-open/comments'),
    where('status', '==', 'visible')
  )));
  await assertSucceeds(getDoc(doc(admin, 'dripso_topics/tournament-open/comments/tournament-blind-entry')));
  await assertSucceeds(getDoc(doc(unauthenticated, 'dripso_topics/tournament-closed/comments/tournament-champion')));
  await assertSucceeds(getDocs(query(
    collection(unauthenticated, 'dripso_topics/tournament-closed/comments'),
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
  await assertFails(getDoc(doc(user, 'dripso_battle_voters/game-open/users/dripso-user/votes/pair-key')));
  await assertFails(getDoc(doc(admin, 'dripso_battle_voters/game-open/users/dripso-user/votes/pair-key')));
  await assertFails(getDoc(doc(user, 'dripso_tournament_matches/tournament-open/items/semi1')));
  await assertFails(getDoc(doc(admin, 'dripso_tournament_matches/tournament-open/items/semi1')));
  await assertFails(getDoc(doc(user, 'dripso_tournament_prelim_voters/tournament-open/users/dripso-user/votes/pair-key')));
  await assertFails(getDoc(doc(admin, 'dripso_tournament_prelim_voters/tournament-open/users/dripso-user/votes/pair-key')));
  await assertFails(getDoc(doc(user, 'dripso_tournament_voters/tournament-open/rounds/semifinal/matches/semi1/users/dripso-user')));
  await assertFails(getDoc(doc(admin, 'dripso_tournament_voters/tournament-open/rounds/semifinal/matches/semi1/users/dripso-user')));

  console.log('Dripso Firestore rules integration passed: public topics, legacy comments, v2 timed blind entries, v3 Final Four blindness through the final, closed results, callable-only writes, and private authors, matches, likes, and votes.');
} finally {
  await testEnv.cleanup();
}
