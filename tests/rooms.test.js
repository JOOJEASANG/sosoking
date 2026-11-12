import test from 'node:test';
import assert from 'node:assert/strict';
import {roomRequest,TURN_MS,ROOM_TTL} from '../server/rooms.js';
import {RoomsStore} from '../server/store.js';
import {localDb} from '../server/local-store.js';
import {api} from '../server/http.js';

function fixture(t) {
  const db=localDb();t.after(()=>db.close());
  const store=new RoomsStore(db), code='ZAD2346J', keys=['a','b','c','d','e'].map(c=>c.repeat(48));
  let time=1000,serial=0;
  const req=(op,n=0,params={})=>roomRequest(store,{op,code,token:keys[n],name:'선장 '+n,nonce:(++serial).toString(16).padStart(24,'0'),...params},time,()=>.55);
  return {db,req,store,keys,code,later:n=>{time+=n;}};
}
const denied=(promise,status)=>assert.rejects(promise,e=>e.status===status);
test('동시 참가, 중복 재접속, 비공개 좌석과 방장',async t=>{
  const f=fixture(t),a=await f.req('create');assert.equal(a.members.length,1);
  assert.deepEqual(await f.req('create'),a);await denied(f.req('start',0,{rev:a.rev}),409);
  await denied(f.req('state',4),403);
  await Promise.all([f.req('join',1),f.req('join',2),f.req('join',3)]);
  let state=await f.req('state');assert.equal(state.members.length,4);assert.equal(new Set(state.members.map(m=>m.seat)).size,4);
  assert.ok(!JSON.stringify(state).includes('recent'));assert.ok(!JSON.stringify(state).includes(f.keys[0]));
  assert.equal((await f.req('join',2)).rev,state.rev);await denied(f.req('join',4),409);
  await denied(f.req('start',1,{rev:state.rev}),403);
  state=await f.req('start',0,{rev:state.rev});assert.equal(state.game.players.length,4);
  assert.deepEqual((await f.req('state',3)).game,state.game);await denied(f.req('join',4),409);
});
test('서버가 굴린 주사위, 재요청 중복 처리, 턴 교대, 하선과 새 판',async t=>{
  const f=fixture(t);await f.req('create');const b=await f.req('join',1);
  let s=await f.req('start',0,{rev:b.rev});await denied(f.req('roll',1,{rev:s.rev}),409);
  const input={rev:s.rev,nonce:'abcdef'.repeat(4),dice:[6,6]};
  const [r1,r2]=await Promise.all([f.req('roll',0,input),f.req('roll',0,input)]);
  assert.deepEqual(r1,r2);assert.deepEqual(r1.game.dice,[4,4]);
  await denied(f.req('sail',0,{rev:s.rev,choice:'a'}),409);
  s=await f.req('sail',0,{rev:r1.rev,choice:'a'});assert.equal(s.game.active,1);
  assert.equal(s.game.players[0].delivered,1);
  let other=await f.req('state',1);assert.deepEqual(other.game,s.game);
  await f.req('leave',0);other=await f.req('state',1);assert.equal(other.host,other.me);assert.equal(other.game.phase,'finished');
  other=await f.req('rematch',1,{rev:other.rev});assert.equal(other.game,null);assert.equal(other.members.length,1);
  const c=await f.req('join',2);assert.equal(c.members.length,2);
  assert.deepEqual(await f.req('leave',0),{left:true});
});
test('자리를 비운 방장 인계, 시간 초과 자동 항해 및 만료',async t=>{
  const f=fixture(t);await f.req('create');let b=await f.req('join',1);f.later(91000);
  b=await f.req('start',1,{rev:b.rev});assert.equal(b.host,b.me);f.later(TURN_MS+1);
  let s=await f.req('state',1);assert.equal(s.game.active,1);assert.equal(s.game.turn,2);
  assert.equal((await f.req('state',0)).rev,s.rev);
  f.later(ROOM_TTL+1);await denied(f.req('state'),404);
});
test('웹 출처 확인, 비공개 응답, 요청 크기와 형식',async t=>{
  const f=fixture(t),url='https://example.test/api/room', origin='https://sosoking-481e6.web.app';
  const call=(body,o=origin)=>api(new Request(url,{method:'POST',body,headers:{Origin:o,'Content-Type':'text/plain'}}),f.db);
  const valid=JSON.stringify({op:'create',code:f.code,token:f.keys[0],name:'선장'});
  assert.equal((await call(valid,'https://other.example')).status,403);
  const good=await call(valid);assert.equal(good.status,200);assert.equal(good.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal(good.headers.get('Cache-Control'),'no-store');assert.equal((await good.json()).members.length,1);
  assert.equal((await call('bad')).status,400);assert.equal((await call('x'.repeat(2100))).status,413);
});
