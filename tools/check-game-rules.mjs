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

const testEnv = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
const hostDb = testEnv.authenticatedContext('game-host').firestore();
const playerDb = testEnv.authenticatedContext('game-player').firestore();
const thirdDb = testEnv.authenticatedContext('game-third').firestore();
const outsiderDb = testEnv.authenticatedContext('game-outsider').firestore();
const publicDb = testEnv.unauthenticatedContext().firestore();
const now = Timestamp.now();
const future = Timestamp.fromMillis(Date.now() + 60_000);

function player(uid, nickname, joinOrder) {
  return { uid, nickname, score: 0, joinOrder, joinedAt: now, updatedAt: now };
}

function gridPlayer(uid, nickname, joinOrder) {
  return {
    ...player(uid, nickname, joinOrder),
    position: 0,
    shield: 0,
    scrap: 0,
    banked: 0,
    jammed: false,
    barrierDent: false,
    finishPower: 0,
    lastDelta: 0
  };
}

try {
  await assertFails(setDoc(doc(publicDb, 'game_rooms/PUB234'), {
    type: 'grid-rush', status: 'lobby', hostUid: 'nobody', maxPlayers: 8,
    round: 0, maxRounds: 24, roundState: 'waiting', createdAt: now, updatedAt: now
  }));
  await assertFails(getDocs(collection(outsiderDb, 'game_rooms')));

  const gridId = 'GRD234';
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${gridId}`), {
    type: 'grid-rush', status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
    round: 0, maxRounds: 24, roundState: 'waiting', roundSeconds: 10,
    board: [], lastResults: [], winnerUid: '', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(getDoc(doc(playerDb, `game_rooms/${gridId}`)));
  await assertFails(getDoc(doc(publicDb, `game_rooms/${gridId}`)));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${gridId}/players/game-host`), gridPlayer('game-host', '방장', 1)));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${gridId}/players/game-player`), gridPlayer('game-player', '친구', 2)));
  await assertFails(setDoc(doc(outsiderDb, `game_rooms/${gridId}/players/fake-user`), gridPlayer('fake-user', '위조', 3)));
  await assertFails(setDoc(doc(thirdDb, `game_rooms/${gridId}/players/game-third`), {
    ...gridPlayer('game-third', '세번째', 3), position: 30
  }));
  await assertFails(setDoc(doc(thirdDb, `game_rooms/${gridId}/players/game-third`), {
    ...gridPlayer('game-third', '세번째', 3), injectedState: true
  }));
  await assertSucceeds(updateDoc(doc(playerDb, `game_rooms/${gridId}/players/game-player`), { nickname: '친구2', updatedAt: now }));
  await assertFails(updateDoc(doc(playerDb, `game_rooms/${gridId}/players/game-player`), { score: 30 }));
  await assertFails(updateDoc(doc(hostDb, `game_rooms/${gridId}`), { hostUid: 'game-player', updatedAt: now }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${gridId}`), {
    status: 'playing', round: 1, roundState: 'open', roundEndsAt: future, updatedAt: now
  }));
  await assertFails(getDoc(doc(outsiderDb, `game_rooms/${gridId}`)));
  await assertFails(getDocs(collection(outsiderDb, `game_rooms/${gridId}/players`)));
  await assertFails(updateDoc(doc(playerDb, `game_rooms/${gridId}/players/game-player`), { nickname: '경기중변경', updatedAt: now }));
  await assertFails(deleteDoc(doc(playerDb, `game_rooms/${gridId}/players/game-player`)));

  const gridAnswer = {
    uid: 'game-player', nickname: '친구2', round: 1, kind: 'grid-action', text: 'recycle', createdAt: now, updatedAt: now
  };
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${gridId}/answers/choice-game-player`), gridAnswer));
  await assertFails(setDoc(doc(playerDb, `game_rooms/${gridId}/answers/spam-game-player`), gridAnswer));
  await assertFails(setDoc(doc(playerDb, `game_rooms/${gridId}/answers/choice-game-player`), { ...gridAnswer, text: 'teleport' }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${gridId}/answers/choice-game-host`), {
    uid: 'game-host', nickname: '방장', round: 1, kind: 'grid-action', text: 'rush', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(getDoc(doc(playerDb, `game_rooms/${gridId}/answers/choice-game-player`)));
  await assertFails(getDoc(doc(playerDb, `game_rooms/${gridId}/answers/choice-game-host`)));
  await assertFails(getDocs(collection(playerDb, `game_rooms/${gridId}/answers`)));
  await assertSucceeds(getDocs(query(collection(playerDb, `game_rooms/${gridId}/answers`), where('uid', '==', 'game-player'))));
  await assertSucceeds(getDocs(collection(hostDb, `game_rooms/${gridId}/answers`)));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${gridId}`), { roundState: 'reveal', updatedAt: now }));
  await assertSucceeds(getDocs(collection(playerDb, `game_rooms/${gridId}/answers`)));

  const mindId = 'MND234';
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${mindId}`), {
    type: 'mind-reader', status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
    round: 0, maxRounds: 8, roundState: 'waiting', promptId: '', targetUid: '', usedPrompts: [],
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${mindId}/players/game-host`), player('game-host', '방장', 1)));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${mindId}/players/game-player`), player('game-player', '친구', 2)));
  await assertSucceeds(setDoc(doc(thirdDb, `game_rooms/${mindId}/players/game-third`), player('game-third', '세번째', 3)));
  // 실제 참가자 수에 맞춘 3~8라운드 업데이트가 모두 허용되어야 한다.
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${mindId}`), {
    status: 'playing', round: 1, maxRounds: 3, roundState: 'open', promptId: 'p1', targetUid: 'game-host', roundEndsAt: future, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${mindId}/answers/choice-game-player`), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'choice', text: 'A', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(thirdDb, `game_rooms/${mindId}/answers/choice-game-third`), {
    uid: 'game-third', nickname: '세번째', round: 1, kind: 'choice', text: 'B', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${mindId}/answers/guess-game-player`), {
    uid: 'game-host', nickname: '방장', round: 1, kind: 'guess', subjectUid: 'game-player', text: 'A', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${mindId}/answers/guess-game-third`), {
    uid: 'game-host', nickname: '방장', round: 1, kind: 'guess', subjectUid: 'game-third', text: 'C', createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(thirdDb, `game_rooms/${mindId}/answers/guess-game-player`), {
    uid: 'game-third', nickname: '세번째', round: 1, kind: 'guess', subjectUid: 'game-player', text: 'A', createdAt: now, updatedAt: now
  }));
  await assertFails(getDoc(doc(playerDb, `game_rooms/${mindId}/answers/choice-game-third`)));

  const alibiId = 'ALB234';
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${alibiId}`), {
    type: 'alibi-market', status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
    round: 0, maxRounds: 3, roundState: 'waiting', phase: 'waiting', promptId: '', usedPrompts: [], publishedAlibis: [], publishedAlibiUids: [],
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${alibiId}/players/game-host`), player('game-host', '방장', 1)));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${alibiId}/players/game-player`), player('game-player', '친구', 2)));
  await assertSucceeds(setDoc(doc(thirdDb, `game_rooms/${alibiId}/players/game-third`), player('game-third', '세번째', 3)));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${alibiId}`), {
    status: 'playing', round: 1, roundState: 'open', phase: 'write', promptId: 'a1', roundEndsAt: future, updatedAt: now
  }));
  const alibiText = '비밀 키워드를 넣은 충분히 긴 변명입니다';
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${alibiId}/answers/alibi-game-player`), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'alibi', text: alibiText, createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(playerDb, `game_rooms/${alibiId}/answers/alibi-spam`), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'alibi', text: alibiText, createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(playerDb, `game_rooms/${alibiId}/answers/alibi-game-player`), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'alibi', text: '짧은 변명', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${alibiId}`), {
    phase: 'bid', publishedAlibis: [{ uid: 'game-player', text: alibiText }, { uid: 'game-third', text: '세번째 참가자의 충분히 긴 변명입니다' }], publishedAlibiUids: ['game-player', 'game-third'], roundEndsAt: future, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${alibiId}/answers/vote-game-player`), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'vote', targetUid: 'game-third', stake: 3, text: 'trust-bid', createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(playerDb, `game_rooms/${alibiId}/answers/vote-game-player`), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'vote', targetUid: 'game-third', stake: 99, text: 'trust-bid', createdAt: now, updatedAt: now
  }));
  await assertFails(getDocs(collection(playerDb, `game_rooms/${alibiId}/answers`)));

  for (const [id, type, maxRounds] of [
    ['VLT234', 'vault-run', 9],
    ['CHO234', 'chosung-bomb', 7]
  ]) {
    await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${id}`), {
      type, status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
      round: 0, maxRounds, roundState: 'waiting', createdAt: now, updatedAt: now
    }));
  }
  for (const [id, type, maxRounds] of [
    ['BAD234', 'copycat-party-game', 3],
    ['OLD234', 'sosoking-world', 24],
    ['GRE234', 'greed-stairs', 5],
    ['DNA234', 'dna-boss', 6]
  ]) {
    await assertFails(setDoc(doc(hostDb, `game_rooms/${id}`), {
      type, status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
      round: 0, maxRounds, roundState: 'waiting', createdAt: now, updatedAt: now
    }));
  }

  console.log('Game Firestore rules passed: five live game types, Mind 3–8 player rounds, exact answer IDs and schemas, private open-round answers, outsider blocking, and immutable hosts.');
} finally {
  await testEnv.cleanup();
}
