import fs from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

const projectId='sosoking-rules-test';
const emulatorHost=process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8080';
const separator=emulatorHost.lastIndexOf(':');
const host=emulatorHost.slice(0,separator);
const port=Number(emulatorHost.slice(separator+1));
const rules=fs.readFileSync('firestore.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{host,port,rules}});
const hostDb=env.authenticatedContext('world-host').firestore();
const playerDb=env.authenticatedContext('world-player').firestore();
const outsiderDb=env.authenticatedContext('world-outsider').firestore();
const roomId='WRD234';
const now=Timestamp.now();
const future=Timestamp.fromMillis(Date.now()+60_000);

try{
  await assertSucceeds(setDoc(doc(hostDb,`game_rooms/${roomId}`),{
    type:'sosoking-world',status:'lobby',hostUid:'world-host',maxPlayers:8,
    round:0,maxRounds:24,roundState:'waiting',worldPhase:'waiting',activeUid:'',crownUid:'',ownedTiles:{},
    autoMode:true,paused:false,lastResults:[],lastEvent:'',eventKind:'',eventTarget:'',createdAt:now,updatedAt:now
  }));
  await assertSucceeds(setDoc(doc(hostDb,`game_rooms/${roomId}/players/world-host`),{
    uid:'world-host',nickname:'방장',score:0,position:0,joinOrder:1,joinedAt:now,updatedAt:now
  }));
  await assertSucceeds(setDoc(doc(playerDb,`game_rooms/${roomId}/players/world-player`),{
    uid:'world-player',nickname:'친구',score:0,position:0,joinOrder:2,joinedAt:now,updatedAt:now
  }));
  await assertFails(setDoc(doc(outsiderDb,`game_rooms/${roomId}/players/fake`),{
    uid:'fake',nickname:'침입',score:0,position:0,joinOrder:3,joinedAt:now,updatedAt:now
  }));
  await assertSucceeds(updateDoc(doc(hostDb,`game_rooms/${roomId}`),{
    status:'playing',round:1,roundState:'open',worldPhase:'roll',activeUid:'world-player',roundEndsAt:future,updatedAt:now
  }));
  await assertSucceeds(setDoc(doc(playerDb,`game_rooms/${roomId}/answers/world-player-1-world-roll`),{
    uid:'world-player',round:1,kind:'world-roll',text:'roll',updatedAt:now
  }));
  await assertFails(setDoc(doc(outsiderDb,`game_rooms/${roomId}/answers/world-outsider-1-world-roll`),{
    uid:'world-outsider',round:1,kind:'world-roll',text:'roll',updatedAt:now
  }));
  await assertFails(updateDoc(doc(playerDb,`game_rooms/${roomId}`),{crownUid:'world-player'}));
  await assertSucceeds(updateDoc(doc(hostDb,`game_rooms/${roomId}/players/world-player`),{score:420,position:7,updatedAt:now}));
  await assertSucceeds(updateDoc(doc(hostDb,`game_rooms/${roomId}`),{
    worldPhase:'event',eventKind:'vault',eventTile:2,roundState:'open',roundEndsAt:future,updatedAt:now
  }));
  await assertSucceeds(setDoc(doc(playerDb,`game_rooms/${roomId}/answers/world-player-1-world-event`),{
    uid:'world-player',round:1,kind:'world-event',text:'v2',updatedAt:now
  }));
  await assertFails(getDocs(collection(outsiderDb,`game_rooms/${roomId}/answers`)));
  await assertSucceeds(getDocs(collection(playerDb,`game_rooms/${roomId}/answers`)));
  console.log('Sosoking World Firestore rules passed: valid world room, participant roll/event answers, outsider blocking, host-only board and scoring control.');
}finally{await env.cleanup();}
