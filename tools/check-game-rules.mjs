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
const past = Timestamp.fromMillis(Date.now() - 1_000);

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

function namingPlayer(uid, nickname, joinOrder) {
  return { ...player(uid, nickname, joinOrder), eliminated: false };
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

  const namingId = 'NAM234';
  const sessionId = 'SESSION234';
  const firstToken = 'TURNPLAYER234';
  const secondToken = 'TURNTIMEOUT234';
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${namingId}`), {
    type: 'naming-survival', status: 'lobby', hostUid: 'game-host', maxPlayers: 0,
    round: 0, maxRounds: 0, roundState: 'waiting', phase: 'waiting', topic: '새 카페 이름',
    sessionId: '', currentTurnUid: '', turnToken: '', turnNumber: 0, cycle: 0,
    lastProcessedToken: '', winnerUid: '', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${namingId}/players/game-host`), namingPlayer('game-host', '방장', 1)));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${namingId}/players/game-player`), namingPlayer('game-player', '친구', 2)));
  await assertSucceeds(setDoc(doc(thirdDb, `game_rooms/${namingId}/players/game-third`), namingPlayer('game-third', '세번째', 3)));
  await assertFails(setDoc(doc(thirdDb, `game_rooms/${namingId}/players/game-outsider`), namingPlayer('game-outsider', '위조', 4)));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${namingId}/naming_sessions/${sessionId}`), {
    sessionId, roomId: namingId, topic: '새 카페 이름', hostUid: 'game-host',
    participantCount: 3, status: 'playing', winnerUid: '', winnerNickname: '',
    totalTurns: 0, startedAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(playerDb, `game_rooms/${namingId}/naming_sessions/FAKESESSION`), {
    sessionId: 'FAKESESSION', roomId: namingId, topic: '가짜 주제', hostUid: 'game-player',
    participantCount: 3, status: 'playing', winnerUid: '', winnerNickname: '',
    totalTurns: 0, startedAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${namingId}`), {
    status: 'playing', round: 1, roundState: 'open', phase: 'turn', sessionId,
    currentTurnUid: 'game-player', turnToken: firstToken, turnNumber: 1, cycle: 1,
    roundEndsAt: future, updatedAt: now
  }));
  const firstEntry = {
    sessionId, topic: '새 카페 이름', turn: 1, cycle: 1,
    uid: 'game-player', nickname: '친구', kind: 'name',
    text: '달빛 정거장', normalized: '달빛정거장', createdAt: now
  };
  const entryPath = `game_rooms/${namingId}/naming_sessions/${sessionId}/entries`;
  await assertSucceeds(setDoc(doc(playerDb, `${entryPath}/${firstToken}`), firstEntry));
  await assertFails(setDoc(doc(playerDb, `${entryPath}/WRONGTOKEN`), firstEntry));
  await assertFails(setDoc(doc(thirdDb, `${entryPath}/${firstToken}`), { ...firstEntry, uid: 'game-third', nickname: '세번째' }));
  await assertFails(updateDoc(doc(playerDb, `${entryPath}/${firstToken}`), { text: '수정 시도' }));
  await assertFails(deleteDoc(doc(hostDb, `${entryPath}/${firstToken}`)));
  await assertSucceeds(getDocs(collection(playerDb, entryPath)));
  await assertFails(getDocs(collection(outsiderDb, entryPath)));

  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${namingId}`), {
    round: 2, currentTurnUid: 'game-third', turnToken: secondToken,
    turnNumber: 2, lastProcessedToken: firstToken, roundEndsAt: past, updatedAt: now
  }));
  const timeoutEntry = {
    sessionId, topic: '새 카페 이름', turn: 2, cycle: 1,
    uid: 'game-third', nickname: '세번째', kind: 'timeout',
    text: '', normalized: '', createdAt: now
  };
  await assertSucceeds(setDoc(doc(hostDb, `${entryPath}/${secondToken}`), timeoutEntry));
  await assertFails(setDoc(doc(playerDb, `${entryPath}/BADTIMEOUT`), { ...timeoutEntry, uid: 'game-player', nickname: '친구' }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${namingId}/naming_sessions/${sessionId}`), {
    status: 'finished', winnerUid: 'game-host', winnerNickname: '방장',
    totalTurns: 2, finishedAt: now, updatedAt: now
  }));
  await assertFails(updateDoc(doc(playerDb, `game_rooms/${namingId}/naming_sessions/${sessionId}`), {
    totalTurns: 999, updatedAt: now
  }));

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
    ['DNA234', 'dna-boss', 6],
    ['ALB234', 'alibi-market', 3]
  ]) {
    await assertFails(setDoc(doc(hostDb, `game_rooms/${id}`), {
      type, status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
      round: 0, maxRounds, roundState: 'waiting', createdAt: now, updatedAt: now
    }));
  }

  console.log('Game Firestore rules passed: five live game types, unlimited Naming rooms, immutable Naming archives, exact answer schemas, private open-round answers, outsider blocking, and immutable hosts.');
} finally {
  await testEnv.cleanup();
}
