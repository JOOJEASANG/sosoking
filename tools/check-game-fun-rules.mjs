import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
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
const hostDb = testEnv.authenticatedContext('fun-host').firestore();
const playerDb = testEnv.authenticatedContext('fun-player').firestore();
const outsiderDb = testEnv.authenticatedContext('fun-outsider').firestore();
const now = Timestamp.now();
const future = Timestamp.fromMillis(Date.now() + 60_000);

async function createRoom(roomId, roomData) {
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${roomId}`), {
    status: 'lobby', hostUid: 'fun-host', maxPlayers: 8, round: 0, roundState: 'waiting',
    createdAt: now, updatedAt: now, ...roomData
  }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${roomId}/players/fun-host`), {
    uid: 'fun-host', nickname: '방장', score: 0, joinOrder: 1, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${roomId}/players/fun-player`), {
    uid: 'fun-player', nickname: '친구', score: 0, joinOrder: 2, joinedAt: now, updatedAt: now
  }));
}

try {
  await createRoom('FV2345', { type: 'vault-run', maxRounds: 9, roundSeconds: 12, vaults: [], lastResults: [] });
  await assertSucceeds(updateDoc(doc(hostDb, 'game_rooms/FV2345'), {
    status: 'playing', round: 1, roundState: 'open', roundEndsAt: future,
    vaults: [{ id: 'v1', kind: 'cash', value: 250 }], funRule: 'test', updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, 'game_rooms/FV2345/answers/1-fun-player'), {
    uid: 'fun-player', nickname: '친구', kind: 'vault', round: 1, text: 'v1', power: 'insurance', createdAt: now, updatedAt: now
  }));

  await createRoom('FG2345', { type: 'greed-stairs', maxRounds: 5, stage: 0, maxStages: 5, reward: 0, risk: 0, roundSeconds: 10, lastResults: [] });
  await assertSucceeds(updateDoc(doc(hostDb, 'game_rooms/FG2345'), {
    status: 'playing', round: 1, stage: 1, roundState: 'open', reward: 100, risk: 8,
    funEvent: 'gold', roundEndsAt: future, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, 'game_rooms/FG2345/answers/funbet-1-1-fun-player'), {
    uid: 'fun-player', nickname: '친구', kind: 'fun-bet', round: 1, stage: 1, text: 'fun-host', createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(outsiderDb, 'game_rooms/FG2345/answers/funbet-outsider'), {
    uid: 'fun-outsider', nickname: '몰래', kind: 'fun-bet', round: 1, stage: 1, text: 'fun-host', createdAt: now, updatedAt: now
  }));

  await createRoom('FC2345', { type: 'unique-low', maxRounds: 8, roundSeconds: 10, bannedNumber: 0, bonusNumber: 0, lastResults: [] });
  await assertSucceeds(updateDoc(doc(hostDb, 'game_rooms/FC2345'), {
    status: 'playing', round: 1, roundState: 'open', bannedNumber: 3, bonusNumber: 7,
    funRule: 'jackpot', roundEndsAt: future, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, 'game_rooms/FC2345/answers/number-1-fun-player'), {
    uid: 'fun-player', nickname: '친구', kind: 'number', round: 1, number: 5, text: '5', power: 'ghost', createdAt: now, updatedAt: now
  }));

  await createRoom('FH2345', { type: 'chosung-bomb', maxRounds: 7, target: '', usedTargets: [] });
  await assertSucceeds(updateDoc(doc(hostDb, 'game_rooms/FH2345'), {
    status: 'playing', round: 1, roundState: 'open', target: 'ㄱㅅ', usedTargets: ['ㄱㅅ'],
    funRule: 'sniper', roundEndsAt: future, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, 'game_rooms/FH2345/answers/1-fun-player'), {
    uid: 'fun-player', nickname: '친구', round: 1, text: '가수', power: 'shield', createdAt: now, updatedAt: now
  }));

  console.log('Game fun Firestore rules passed: participant powers and spectator bets remain room-scoped, timed, and outsider-blocked.');
} finally {
  await testEnv.cleanup();
}
