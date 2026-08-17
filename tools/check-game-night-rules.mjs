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
  updateDoc,
  writeBatch
} from 'firebase/firestore';

const projectId = 'sosoking-rules-test';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const separator = emulatorHost.lastIndexOf(':');
const host = emulatorHost.slice(0, separator);
const port = Number(emulatorHost.slice(separator + 1));
const rules = fs.readFileSync('firestore.rules', 'utf8');

const testEnv = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
const hostDb = testEnv.authenticatedContext('night-host').firestore();
const playerDb = testEnv.authenticatedContext('night-player').firestore();
const roomId = 'NGT234';
const now = Timestamp.now();
const future = Timestamp.fromMillis(Date.now() + 60_000);

try {
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${roomId}`), {
    type: 'vault-run', status: 'lobby', hostUid: 'night-host', maxPlayers: 8,
    round: 0, maxRounds: 9, roundState: 'waiting', roundSeconds: 12, vaults: [], lastResults: [],
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${roomId}/players/night-host`), {
    uid: 'night-host', nickname: '방장', score: 0, combo: 0,
    joinOrder: 1, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${roomId}/players/night-player`), {
    uid: 'night-player', nickname: '친구', score: 0, combo: 0,
    joinOrder: 2, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${roomId}/players/night-host`), { score: 900, combo: 3, updatedAt: now }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${roomId}/players/night-player`), { score: 500, combo: 1, updatedAt: now }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${roomId}`), {
    status: 'playing', round: 1, roundState: 'open', roundEndsAt: future,
    vaults: [{ id: 'v1', kind: 'cash', value: 200 }], updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${roomId}/answers/choice-night-player`), {
    uid: 'night-player', nickname: '친구', round: 1, kind: 'vault', text: 'v1', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${roomId}`), {
    status: 'finished', roundState: 'finished', updatedAt: now
  }));
  await assertFails(updateDoc(doc(playerDb, `game_rooms/${roomId}`), {
    type: 'grid-rush', status: 'lobby', round: 0, maxRounds: 24, roundState: 'waiting', updatedAt: now
  }));

  const [playersSnap, answersSnap, roomSnap] = await Promise.all([
    getDocs(collection(hostDb, `game_rooms/${roomId}/players`)),
    getDocs(collection(hostDb, `game_rooms/${roomId}/answers`)),
    getDoc(doc(hostDb, `game_rooms/${roomId}`))
  ]);
  const batch = writeBatch(hostDb);
  answersSnap.docs.forEach(item => batch.delete(item.ref));
  playersSnap.docs.forEach(item => {
    const player = item.data();
    batch.set(item.ref, {
      uid: player.uid, nickname: player.nickname, score: 0, combo: 0, position: 0,
      shield: 0, scrap: 0, banked: 0, jammed: false,
      barrierDent: false, finishPower: 0, lastDelta: 0, eliminated: false,
      joinOrder: player.joinOrder, joinedAt: player.joinedAt, updatedAt: now
    });
  });
  batch.set(doc(hostDb, `game_rooms/${roomId}`), {
    type: 'grid-rush', status: 'lobby', hostUid: 'night-host', maxPlayers: 8,
    round: 0, maxRounds: 24, roundState: 'waiting', roundSeconds: 10,
    board: [], lastResults: [], winnerUid: '', previousGameType: 'vault-run', nextGameId: 'grid', gameNightRound: 1,
    createdAt: roomSnap.data().createdAt, updatedAt: now
  });
  await assertSucceeds(batch.commit());

  const [switchedRoom, switchedPlayers, emptyAnswers] = await Promise.all([
    getDoc(doc(hostDb, `game_rooms/${roomId}`)),
    getDocs(collection(hostDb, `game_rooms/${roomId}/players`)),
    getDocs(collection(hostDb, `game_rooms/${roomId}/answers`))
  ]);
  if (switchedRoom.data().type !== 'grid-rush' || switchedRoom.data().status !== 'lobby') throw new Error('room did not switch');
  if (switchedPlayers.docs.some(item => Number(item.data().score || 0) !== 0 || Number(item.data().position || 0) !== 0 || item.data().eliminated !== false)) throw new Error('game state did not reset');
  if (switchedPlayers.docs.some(item => ['dna', 'laps', 'damage', 'runState'].some(field => Object.hasOwn(item.data(), field)))) throw new Error('retired player state survived reset');
  if (!emptyAnswers.empty) throw new Error('round answers did not clear');

  console.log('Game night Firestore rules passed: only the host can switch games, private answers clear, scores reset, and Grid state starts clean without DNA fields.');
} finally {
  await testEnv.cleanup();
}
