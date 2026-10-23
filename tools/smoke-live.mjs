import assert from 'node:assert/strict';
const base='https://sosoking-481e6.web.app/api/';
async function call(path,data=null,token='',personId=''){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),25000);
 try{
  const r=await fetch(base+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{}),...(personId?{'x-person-id':personId}:{})},body:data?JSON.stringify(data):undefined,signal:c.signal,cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error('HTTP '+r.status+' /api/'+path+': '+(j.error||r.statusText));
  return j;
 }finally{clearTimeout(timer);}
}
const health=await call('health');
assert.equal(health.ok,true,'Function Health OK');
const created=await call('create',{title:'소소킹 배포 점검 행사',modules:['raffle','poll','wheel','score','teams','timer','bracket']});
assert.match(created.id,/^[a-f0-9]{20}$/);
assert.ok(created.adminToken);
const id=created.id,host=created.adminToken;
const p1=await call('join',{id,name:'점검참가자1'});
const p2=await call('join',{id,name:'점검참가자2'});
assert.ok(p1.personId&&p1.personToken);
const manage=()=>call('event?id='+id+'&host=1',null,host);
const action=(op,value=null)=>call('action',{id,op,value},host);
let ev=(await manage()).event;
assert.equal(ev.peopleCount,2);
assert.equal(ev.people.length,2);
await action('event.active','poll');
await action('poll.set',{question:'어떤 색을 선택할까요?',options:['빨강','파랑']});
await action('poll.open');
const vote=(i)=>call('action',{id,op:'poll.vote',value:i},p1.personToken,p1.personId);
await vote(0);
let alreadyVoted=false;
try{await vote(1)}catch(e){alreadyVoted=/이미 투표/.test(e.message);}
assert.ok(alreadyVoted,'double voting must fail');
await action('poll.close');
ev=(await manage()).event;
assert.deepEqual(ev.state.poll.counts,[1,0]);
await action('event.active','raffle');
await action('raffle.draw');
await action('raffle.draw');
ev=(await manage()).event;
assert.equal(ev.state.raffle.winners.length,2);
assert.notEqual(ev.state.raffle.winners[0].id,ev.state.raffle.winners[1].id);
await action('wheel.set',['사과','포도','귤']);
await action('wheel.spin');
await action('score.set',['청팀','백팀']);
await action('score.add',{index:0,delta:5});
await action('teams.make',{groupCount:2,names:[]});
await action('timer.set',45);
await action('timer.start');
await action('timer.pause');
await action('bracket.set',['청팀','백팀','홍팀']);
ev=(await manage()).event;
const match=ev.state.bracket.rounds[0].findIndex(x=>x.a&&x.b&&!x.winner);
assert.ok(match>=0,'a bracket match should be pending');
await action('bracket.win',{round:0,match,winner:ev.state.bracket.rounds[0][match].a});
ev=(await manage()).event;
assert.ok(ev.state.bracket.rounds.length>=2,'winner advances');
await action('event.status','closed');
console.log('LIVE SMOKE PASS: health, create, join, read, poll anti-double-vote, raffle anti-repeat, wheel, score, teams, timer, tournament.');
