import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {options} from '../public/js/rules.js';
import {ROOM_ORIGIN, newCode} from '../public/js/online.js';

const origin=process.env.TIDE_GAME_ORIGIN||'https://sosoking-481e6.web.app';
const server=process.env.TIDE_ROOM_ORIGIN||ROOM_ORIGIN;
async function checkHosting() {
  const end=Date.now()+65000;
  do{
    const res=await fetch(origin+'/?check='+Date.now(),{signal:AbortSignal.timeout(12000)});
    if(res.ok && (await res.text()).includes('<title>물결우체국 · Tidepost</title>'))return;
    await new Promise(resolve=>setTimeout(resolve,3000));
  }while(Date.now()<end);
  throw Error('The live front page did not serve this release.');
}
async function checkRooms() {
  const code=newCode(), keys=[randomBytes(24).toString('hex'),randomBytes(24).toString('hex')], joined=new Set();
  async function command(op,n,params={}) {
    const res=await fetch(server+'/api/room',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify({op,code,token:keys[n],name:'점검선 '+(n+1),nonce:randomBytes(12).toString('hex'),...params}),
      signal:AbortSignal.timeout(15000)});
    assert.ok(res.ok,'Room operation '+op+' returned '+res.status);
    assert.ok([origin,'*'].includes(res.headers.get('access-control-allow-origin')),'Missing permission for the game origin');
    return res.json();
  }
  try {
    let a=await command('create',0);joined.add(0);
    let b=await command('join',1);joined.add(1);assert.notEqual(a.me,b.me);
    a=await command('state',0);assert.equal(a.members.length,2);
    a=await command('start',0,{rev:a.rev});assert.equal(a.game.active,0);
    a=await command('roll',0,{rev:a.rev});b=await command('state',1);assert.deepEqual(a.game.dice,b.game.dice);
    const sail=options(a.game).find(o=>o.delivery)||options(a.game)[0];
    a=await command('sail',0,{rev:a.rev,choice:sail.id});
    if(a.game.phase==='office')a=await command('build',0,{rev:a.rev});
    b=await command('state',1);assert.deepEqual(b.game,a.game);assert.equal(b.game.active,1);
    b=await command('roll',1,{rev:b.rev});assert.equal(b.game.phase,'choose');
    console.log('Two independent seats created, joined, rolled, sailed and exchanged turns on the room service.');
  } finally {
    for(const n of joined){try{await command('leave',n);}catch{console.warn('Test room cleanup will finish on expiry.');}}
  }
}
if(process.argv[2]==='hosting'){await checkHosting();console.log('The public game page is live.');}
else await checkRooms();
