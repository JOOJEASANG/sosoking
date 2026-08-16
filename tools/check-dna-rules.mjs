import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
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
const hostDb = testEnv.authenticatedContext('dna-host').firestore();
const playerDb = testEnv.authenticatedContext('dna-player').firestore();
const outsiderDb = testEnv.authenticatedContext('dna-outsider').firestore();
const roomId = 'DNA234';
const now = Timestamp.now();
const future = Timestamp.fromMillis(Date.now() + 60_000);

try {
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${roomId}`), {
    type: 'dna-boss', status: 'lobby', hostUid: 'dna-host', maxPlayers: 8,
    round: 0, maxRounds: 6, roundState: 'waiting', phase: 'waiting',
    bossHp: 0, bossMaxHp: 0, aiStatus: 'idle', aiMode: '', aiPack: {}, lastResults: [],
    createdAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(hostDb, `game_rooms/${roomId}/players/dna-host`), {
    uid: 'dna-host', nickname: '방장', score: 0,
    dna: { bold: 2, safe: 0, unique: 1, reader: 0, samples: 2 },
    joinOrder: 1, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${roomId}/players/dna-player`), {
    uid: 'dna-player', nickname: '친구', score: 0,
    dna: { bold: 0, safe: 3, unique: 0, reader: 1, samples: 2 },
    joinOrder: 2, joinedAt: now, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${roomId}`), {
    status: 'playing', round: 1, roundState: 'open', phase: 'scan', roundEndsAt: future, updatedAt: now
  }));
  await assertSucceeds(setDoc(doc(playerDb, `game_rooms/${roomId}/answers/scan-1-dna-player`), {
    uid: 'dna-player', nickname: '친구', round: 1, kind: 'dna-scan', text: 'safe', createdAt: now, updatedAt: now
  }));
  await assertFails(setDoc(doc(outsiderDb, `game_rooms/${roomId}/answers/scan-1-outsider`), {
    uid: 'dna-outsider', nickname: '몰래참가', round: 1, kind: 'dna-scan', text: 'bold', createdAt: now, updatedAt: now
  }));
  await assertSucceeds(getDocs(collection(playerDb, `game_rooms/${roomId}/answers`)));
  await assertFails(getDocs(collection(outsiderDb, `game_rooms/${roomId}/answers`)));
  await assertFails(updateDoc(doc(playerDb, `game_rooms/${roomId}`), { phase: 'director', updatedAt: now }));
  await assertFails(updateDoc(doc(playerDb, `game_rooms/${roomId}/players/dna-player`), {
    dna: { bold: 99, safe: 0, unique: 0, reader: 0, samples: 99 }, updatedAt: now
  }));
  await assertSucceeds(updateDoc(doc(hostDb, `game_rooms/${roomId}/players/dna-player`), {
    score: 2, dna: { bold: 0, safe: 5, unique: 0, reader: 1, samples: 3 }, updatedAt: now
  }));
  await assertFails(setDoc(doc(playerDb, `game_rooms/${roomId}/reactions/dna-player`), {
    uid: 'dna-player', emoji: '🔥', updatedAt: now
  }));

  console.log('DNA Firestore rules passed: valid DNA rooms and participant choices work, while outsiders, client-side DNA edits, room control, and retired reactions stay blocked.');
} finally {
  await testEnv.cleanup();
}
