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
  Timestamp,
  updateDoc
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
const outsiderDb = testEnv.authenticatedContext('game-outsider').firestore();
const publicDb = testEnv.unauthenticatedContext().firestore();
const roomId = 'ABC234';
const now = Timestamp.now();
const future = Timestamp.fromMillis(Date.now() + 60_000);

try {
  await assertFails(setDoc(doc(publicDb, 'game_rooms/public-room'), {
    type: 'chosung-bomb', status: 'lobby', hostUid: 'nobody', maxPlayers: 8,
    round: 0, maxRounds: 7, roundState: 'waiting', target: '', usedTargets: [],
    createdAt: now, updatedAt: now
  }));

  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${roomId}`), {
    type: 'chosung-bomb', status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
    round: 0, maxRounds: 7, roundState: 'waiting', target: '', usedTargets: [],
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(getDoc(doc(playerDb, `game_rooms/${roomId}`)));
  await assertFails(getDoc(doc(publicDb, `game_rooms/${roomId}`)));
  await assertFails(getDocs(collection(outsiderDb, 'game_rooms')));

  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${roomId}/players/game-host`), {
    uid: 'game-host', nickname: '방장', score: 0, joinOrder: 1, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${roomId}/players/game-player`), {
    uid: 'game-player', nickname: '가족', score: 0, joinOrder: 2, joinedAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(outsiderDb, `game_rooms/${roomId}/players/fake-user`), {
    uid: 'fake-user', nickname: '위조', score: 0, joinOrder: 3, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(playerDb, `game_rooms/${roomId}/players/game-player`), {
    nickname: '가족2', updatedAt: now
  }));
  await assertFails(updateDoc(doc(playerDb, `game_rooms/${roomId}/players/game-player`), { score: 99 }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${roomId}/players/game-player`), { score: 2, updatedAt: now }));

  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${roomId}`), {
    status: 'playing', round: 1, roundState: 'open', target: 'ㄱㅅ', usedTargets: ['ㄱㅅ'], roundEndsAt: future, updatedAt: now
  }));
  await assertFails(setDoc(doc(outsiderDb, `game_rooms/${roomId}/players/game-outsider`), {
    uid: 'game-outsider', nickname: '늦은참가', score: 0, joinOrder: 3, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${roomId}/answers/1-game-player`), {
    uid: 'game-player', nickname: '가족2', round: 1, text: '가수', createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(outsiderDb, `game_rooms/${roomId}/answers/1-outsider`), {
    uid: 'game-outsider', nickname: '늦은참가', round: 1, text: '가수', createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(outsiderDb, `game_rooms/${roomId}/answers/1-spoof`), {
    uid: 'game-player', nickname: '가족2', round: 1, text: '가수', createdAt: now, updatedAt: now
  }));
  await assertFails(getDocs(collection(outsiderDb, `game_rooms/${roomId}/answers`)));
  await assertSucceeds(getDocs(collection(playerDb, `game_rooms/${roomId}/answers`)));
  await assertFails(updateDoc(doc(playerDb, `game_rooms/${roomId}`), { target: 'ㄴㅅ' }));

  await assertSucceeds(setDoc(doc(hostDb, 'game_rooms/MND234'), {
    type: 'mind-reader', status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
    round: 0, maxRounds: 8, roundState: 'waiting', promptId: '', targetUid: '', usedPrompts: [],
    createdAt: now, updatedAt: now
  }));

  await assertSucceeds(setDoc(doc(hostDb, 'game_rooms/ALB234'), {
    type: 'alibi-market', status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
    round: 0, maxRounds: 3, roundState: 'waiting', phase: 'waiting', promptId: '', usedPrompts: [],
    createdAt: now, updatedAt: now
  }));

  await assertSucceeds(setDoc(doc(hostDb, 'game_rooms/VLT234'), {
    type: 'vault-run', status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
    round: 0, maxRounds: 9, roundState: 'waiting', roundSeconds: 12, vaults: [], lastResults: [],
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(hostDb, 'game_rooms/VLT234/players/game-host'), {
    uid: 'game-host', nickname: '방장', score: 0, combo: 0, joinOrder: 1, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, 'game_rooms/VLT234/players/game-player'), {
    uid: 'game-player', nickname: '친구', score: 0, combo: 0, joinOrder: 2, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(hostDb, 'game_rooms/VLT234'), {
    status: 'playing', round: 1, roundState: 'open', roundEndsAt: future,
    vaults: [{ id: 'v1', kind: 'cash', value: 200 }], updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, 'game_rooms/VLT234/answers/1-game-player'), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'vault', text: 'v1', createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(outsiderDb, 'game_rooms/VLT234/answers/1-outsider'), {
    uid: 'game-outsider', nickname: '몰래참가', round: 1, kind: 'vault', text: 'v1', createdAt: now, updatedAt: now
  }));

  await assertFails(setDoc(doc(hostDb, 'game_rooms/BAD234'), {
    type: 'copycat-party-game', status: 'lobby', hostUid: 'game-host', maxPlayers: 8,
    round: 0, maxRounds: 3, roundState: 'waiting', createdAt: now, updatedAt: now
  }));

  await assertSucceeds(setDoc(doc(hostDb, 'game_rooms/ALB234/players/game-host'), {
    uid: 'game-host', nickname: '방장', score: 0, joinOrder: 1, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, 'game_rooms/ALB234/players/game-player'), {
    uid: 'game-player', nickname: '친구', score: 0, joinOrder: 2, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(hostDb, 'game_rooms/ALB234'), {
    status: 'playing', round: 1, roundState: 'open', phase: 'write', roundEndsAt: future, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, 'game_rooms/ALB234/answers/alibi-1-game-player'), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'alibi', text: '가'.repeat(100), createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(playerDb, 'game_rooms/ALB234/answers/alibi-too-long'), {
    uid: 'game-player', nickname: '친구', round: 1, kind: 'alibi', text: '가'.repeat(121), createdAt: now, updatedAt: now
  }));

  console.log('Game Firestore rules integration passed: private invite-room listing, supported game types including vault-run, lobby-only self-join, participant submissions, host scoring, timed writes, and host-only room control.');
} finally {
  await testEnv.cleanup();
}
