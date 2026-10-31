'use strict';
const {onRequest}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
const crypto=require('node:crypto');
const {makeBoard,answerMatches,blankState}=require('./treasure');
if(!admin.apps.length)admin.initializeApp();
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;
const MODULES=['raffle','poll','wheel','score','teams','timer','bracket','treasure'];
const MAX_PEOPLE=200;
function token(bytes=20){return crypto.randomBytes(bytes).toString('hex');}
function digest(s){return crypto.createHash('sha256').update(String(s||'')).digest('hex');}
function eq(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function clean(v,max=80){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);}
function list(v,max=100){return [...new Set((Array.isArray(v)?v:[]).map(x=>clean(x,40)).filter(Boolean))].slice(0,max);}
function must(test,msg){if(!test)throw Object.assign(new Error(msg),{status:400});}
function clamp(x,min,max){return Math.min(max,Math.max(min,Number(x)||0));}
function fail(msg,status=400){throw Object.assign(new Error(msg),{status});}
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=crypto.randomInt(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;}
function safeEvent(doc){const {adminHash, ...publicDoc}=doc;return publicDoc;}
function initState(){return {
 raffle:{winners:[],last:null,lastBatch:[]},
 poll:{id:'',question:'',options:[],counts:[],open:false,answered:0},
 wheel:{items:['1번','2번','3번','4번'],last:null,history:[]},
 score:{rows:[]},
 teams:{groups:[],at:0},
 timer:{duration:60,remaining:60,running:false,startedAt:0},
 bracket:{names:[],rounds:[],finished:false},
 treasure:blankState()
};}
function remaining(t){return t.running?Math.max(0,Math.ceil((t.remaining*1000-(Date.now()-t.startedAt))/1000)):t.remaining;}
function bracketFrom(names){
 let count=1;while(count<names.length)count*=2;
 const full=count/2-(count-names.length);const matches=[];let n=0;
 for(let i=0;i<count/2;i++){
  const a=names[n++],b=i<full?names[n++]:null;
  matches.push({a,b,winner:b?null:a});
 }
 return {names,rounds:[matches],finished:false};
}
function advanceBracket(bracket){
 const rounds=bracket.rounds;
 for(let i=0;i<8;i++){
  const last=rounds[rounds.length-1];
  if(!last.every(m=>m.winner))break;
  if(last.length===1){bracket.finished=true;break;}
  const next=[];
  for(let j=0;j<last.length;j+=2)next.push({a:last[j].winner,b:last[j+1].winner,winner:null});
  rounds.push(next);
 }
 return bracket;
}
function asRows(values){return list(values,24).map(name=>({name,points:0}));}
async function getPeople(id){const q=await db.collection('sosokingEvents').doc(id).collection('people').limit(MAX_PEOPLE+1).get();return q.docs.map(d=>({id:d.id,name:d.data().name||'참가자',joinedAt:d.data().joinedAt||0}));}
async function eventDoc(id){must(/^[a-f0-9]{20}$/.test(id),'잘못된 행사 코드입니다.');const ref=db.collection('sosokingEvents').doc(id),snap=await ref.get();if(!snap.exists)fail('행사를 찾을 수 없습니다.',404);const doc=snap.data();if(doc.expiresAt<Date.now())fail('운영 기간이 종료된 행사입니다.',410);return {ref,doc};}
function authorization(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');}
function organizer(req,doc){if(!eq(digest(authorization(req)),doc.adminHash))fail('진행자 인증이 필요합니다.',403);}
async function participant(ref,req){
 const partId=clean(req.headers['x-person-id'],100);
 must(/^[a-f0-9]{28}$/.test(partId),'참가자 인증이 필요합니다.');
 const s=await ref.collection('people').doc(partId).get();
 if(!s.exists||!eq(s.data().tokenHash,digest(authorization(req))))fail('참가자 인증이 유효하지 않습니다.',403);
 return {id:partId,ref:s.ref,data:s.data()};
}
function seedRateKey(req){const source=clean(String(req.headers['x-forwarded-for']||req.ip||'').split(',')[0],150),day=new Date().toISOString().slice(0,10);return 'create-'+digest(source+'|'+day).slice(0,40);}
const cors=['https://sosoking.co.kr','https://www.sosoking.co.kr','https://sosoking-481e6.web.app','https://sosoking-481e6.firebaseapp.com'];
exports.sosokingEventApi=onRequest({region:'asia-northeast3',memory:'256MiB',timeoutSeconds:60,maxInstances:3,cors,invoker:'public'},async (req,res)=>{
 res.set('Cache-Control','no-store');
 const method=req.method;let path=req.path.replace(/^\/api/,'').replace(/\/+$/,'')||'/';
 try{
  if(method==='GET'&&path==='/health')return res.json({ok:true,service:'sosoking-events-v1'});
  if(method==='POST'&&path==='/create'){
   const name=clean(req.body?.title,65);
   const modules=list(req.body?.modules,MODULES.length).filter(x=>MODULES.includes(x));
   const mode=['onsite','online','hybrid'].includes(req.body?.mode)?req.body.mode:'hybrid';
   must(name.length>=2,'행사명을 두 글자 이상 입력하세요.');
   must(modules.length>0,'프로그램을 하나 이상 선택하세요.');
   const hostSecret=token(24),id=token(10),now=Date.now();
   const key=seedRateKey(req),limitRef=db.collection('sosokingEventLimits').doc(key);
   await db.runTransaction(async tx=>{
    const snap=await tx.get(limitRef),count=snap.exists?snap.data().count||0:0;
    if(count>=5)fail('하루에 생성할 수 있는 행사 수를 초과했습니다.',429);
    tx.set(limitRef,{count:count+1,expiresAt:now+2*864e5});
   });
   await db.collection('sosokingEvents').doc(id).create({
     id,title:name,mode,modules,status:'open',active:'',adminHash:digest(hostSecret),
     createdAt:now,expiresAt:now+7*864e5,peopleCount:0,state:initState(),revision:1
   });
   return res.status(201).json({id,adminToken:hostSecret});
  }
  if(method==='POST'&&path==='/join'){
   const id=clean(req.body?.id,100),name=clean(req.body?.name,24);
   must(name.length>=2,'닉네임을 2글자 이상 입력하세요.');
   const {ref,doc}=await eventDoc(id);
   if(doc.status!=='open')fail('입장이 마감된 행사입니다.',403);
   const pId=token(14),pSecret=token(20),pRef=ref.collection('people').doc(pId);
   await db.runTransaction(async tx=>{
     const snap=await tx.get(ref),cur=snap.data();
     if(cur.status!=='open')fail('입장이 마감되었습니다.',403);
     if((cur.peopleCount||0)>=MAX_PEOPLE)fail('참가 인원이 가득 찼습니다.',403);
     tx.create(pRef,{name,tokenHash:digest(pSecret),joinedAt:Date.now(),votes:{}});
     tx.update(ref,{peopleCount:FieldValue.increment(1),revision:FieldValue.increment(1)});
   });
   return res.status(201).json({personId:pId,personToken:pSecret,name});
  }
  if(method==='GET'&&path==='/event'){
   const {ref,doc}=await eventDoc(clean(req.query.id,40));
   const full=req.query.host==='1';
   if(full)organizer(req,doc);
   const data=safeEvent(doc);
   if(!full&&data.state.poll.open)data.state={...data.state,poll:{...data.state.poll,counts:[],answered:0}};
   if(full){data.people=await getPeople(doc.id);}
   let memberTreasure=null;
   if(req.query.member==='1'){
     const person=await participant(ref,req);
     const progress=person.data.treasure||{};
     memberTreasure=progress.round===data.state.treasure?.round?{
       round:progress.round,found:progress.found||[],attempts:progress.attempts||{}
     }:{round:data.state.treasure?.round||0,found:[],attempts:{}};
   }
   return res.json({event:data,memberTreasure});
  }
  if(method==='POST'&&path==='/action'){
   const id=clean(req.body?.id,40),op=clean(req.body?.op,40),val=req.body?.value;
   const {ref,doc}=await eventDoc(id);
   const mod=op.split('.')[0];
   must(MODULES.includes(mod)||mod==='event','지원하지 않는 프로그램입니다.');
   if(mod!=='event')must(doc.modules.includes(mod),'이 행사에 없는 프로그램입니다.');
   if(op==='poll.vote'){
     const person=await participant(ref,req);
     const option=Number(val);
     await db.runTransaction(async tx=>{
       const [eventSnap,personSnap]=await Promise.all([tx.get(ref),tx.get(person.ref)]);
       if(!personSnap.exists)fail('참가자가 아닙니다.',403);
       const cur=eventSnap.data(),poll=cur.state.poll;
       if(!poll.open||cur.active!=='poll')fail('투표가 종료되었습니다.',409);
       if(!Number.isInteger(option)||option<0||option>=poll.options.length)fail('선택지가 올바르지 않습니다.');
       if(personSnap.data().votes?.[poll.id]!==undefined)fail('이미 투표했습니다.',409);
       const counts=[...poll.counts];counts[option]+=1;
       tx.update(person.ref,{['votes.'+poll.id]:option});
       tx.update(ref,{'state.poll.counts':counts,'state.poll.answered':FieldValue.increment(1),revision:FieldValue.increment(1)});
     });
     return res.json({ok:true});
   }
   if(op==='treasure.solve'){
     const person=await participant(ref,req);
     const spotId=clean(val?.id,40),answer=clean(val?.answer,60);
     must(spotId&&answer,'보물 위치와 암호를 입력하세요.');
     const outcome=await db.runTransaction(async tx=>{
       const [eventSnap,personSnap]=await Promise.all([tx.get(ref),tx.get(person.ref)]);
       must(eventSnap.exists&&personSnap.exists,'행사 참가 정보를 확인할 수 없습니다.');
       const cur=eventSnap.data(),s=cur.state.treasure||blankState(),now=Date.now();
       if(!cur.modules.includes('treasure')||cur.active!=='treasure'||s.status!=='playing'||now>=s.endsAt)fail('현재 보물찾기 대회가 진행 중이 아닙니다.',409);
       const spot=s.board.find(x=>x.id===spotId&&x.kind==='treasure');
       must(spot,'암호를 입력할 보물을 선택하세요.');
       const old=personSnap.data().treasure||{};
       const progress=old.round===s.round?{...old}:{round:s.round,found:[],attempts:{},score:0,lastAt:0};
       if(progress.found.includes(spotId))fail('이미 발견한 보물입니다.',409);
       const attempts={...progress.attempts};
       if((attempts[spotId]||0)>=5)fail('이 보물의 암호 입력 기회를 모두 사용했습니다.',429);
       if(now-(progress.lastAt||0)<800)fail('잠시 후 다시 입력해 주세요.',429);
       attempts[spotId]=(attempts[spotId]||0)+1;
       const correct=answerMatches(spotId,answer);
       if(!correct){
         tx.update(person.ref,{treasure:{...progress,attempts,lastAt:now}});
         return {correct:false,left:5-attempts[spotId]};
       }
       const first=!s.firsts.some(x=>x.id===spotId);
       const points=spot.points+(first?15:0);
       const found=[...progress.found,spotId];
       const oldRank=s.rankings.find(x=>x.id===person.id);
       const rank={id:person.id,name:personSnap.data().name||'참가자',points:(oldRank?.points||0)+points,found:found.length,at:now};
       const rankings=[...s.rankings.filter(x=>x.id!==person.id),rank].sort((a,b)=>b.points-a.points||a.at-b.at);
       const firsts=first?[...s.firsts,{id:spotId,personId:person.id,name:rank.name,at:now}]:s.firsts;
       tx.update(person.ref,{treasure:{...progress,found,attempts,score:rank.points,lastAt:now}});
       tx.update(ref,{'state.treasure.rankings':rankings,'state.treasure.firsts':firsts,revision:FieldValue.increment(1)});
       return {correct:true,points,first};
     });
     if(!outcome.correct)return res.status(422).json({error:'암호가 달라요. 남은 기회 '+outcome.left+'회',attemptsLeft:outcome.left});
     return res.json({ok:true,...outcome});
   }
   organizer(req,doc);
   let people=null;
   if(['raffle.draw','teams.make'].includes(op))people=await getPeople(id);
   await db.runTransaction(async tx=>{
     const snap=await tx.get(ref);if(!snap.exists)fail('행사를 찾을 수 없습니다.',404);
     const cur=snap.data(),state=cur.state,now=Date.now();
     must(cur.modules.includes(mod)||mod==='event','활성화되지 않은 프로그램입니다.');
     switch(op){
      case 'event.active':{
       const active=clean(val,25);
       must(active===''||cur.modules.includes(active),'선택하지 않은 프로그램입니다.');
       tx.update(ref,{active,revision:FieldValue.increment(1)});break;
      }
      case 'event.modules':{
       const modules=list(val,MODULES.length).filter(x=>MODULES.includes(x));
       must(modules.length>=1,'프로그램은 최소 하나 이상 선택해야 합니다.');
       const active=modules.includes(cur.active)?cur.active:'';
       tx.update(ref,{modules,active,revision:FieldValue.increment(1)});break;
      }
      case 'event.status':{
       must(['open','closed'].includes(val),'잘못된 상태입니다.');
       tx.update(ref,{status:val,revision:FieldValue.increment(1)});break;
      }
      case 'raffle.draw':{
       must(people?.length,'추첨할 참가자가 없습니다.');
       const count=val===null||val===undefined?1:Number(val);
       must(Number.isInteger(count)&&count>=1&&count<=10,'한 번에 1~10명까지 추첨할 수 있습니다.');
       const seen=new Set(state.raffle.winners.map(w=>w.id));
       const eligible=people.filter(p=>!seen.has(p.id));
       must(eligible.length>=count,'남은 추첨 대상자가 '+eligible.length+'명입니다.');
       const picked=[];
       for(let i=0;i<count;i++){
         const index=crypto.randomInt(eligible.length);
         const p=eligible.splice(index,1)[0];
         picked.push({id:p.id,name:p.name,at:now});
       }
       tx.update(ref,{'state.raffle.winners':[...state.raffle.winners,...picked],
         'state.raffle.last':picked[picked.length-1],'state.raffle.lastBatch':picked,
         revision:FieldValue.increment(1)});break;
      }
      case 'raffle.reset':{
       tx.update(ref,{'state.raffle':{winners:[],last:null,lastBatch:[]},revision:FieldValue.increment(1)});break;
      }
      case 'poll.set':{
       const question=clean(val?.question,110),options=list(val?.options,6);
       must(question.length>=2&&options.length>=2,'질문과 선택지 2개 이상이 필요합니다.');
       tx.update(ref,{'state.poll':{id:token(9),question,options,counts:options.map(()=>0),open:false,answered:0},revision:FieldValue.increment(1)});break;
      }
      case 'poll.open':case 'poll.close':{
       must(state.poll.id,'먼저 투표 질문을 설정하세요.');
       tx.update(ref,{'state.poll.open':op==='poll.open',revision:FieldValue.increment(1)});break;
      }
      case 'wheel.set':{
       const items=list(val,60);must(items.length>=2,'룰렛 항목을 2개 이상 입력하세요.');
       tx.update(ref,{'state.wheel':{items,last:null,history:[]},revision:FieldValue.increment(1)});break;
      }
      case 'wheel.spin':{
       const items=state.wheel.items;must(items.length>=2,'룰렛 항목이 부족합니다.');
       const picked=items[crypto.randomInt(items.length)];
       tx.update(ref,{'state.wheel.last':{name:picked,at:now},'state.wheel.history':[...state.wheel.history.slice(-39),{name:picked,at:now}],revision:FieldValue.increment(1)});break;
      }
      case 'score.set':{
       const rows=asRows(val);must(rows.length>=2,'팀이나 선수 이름을 2개 이상 입력하세요.');
       tx.update(ref,{'state.score.rows':rows,revision:FieldValue.increment(1)});break;
      }
      case 'score.add':{
       const row=clamp(val?.index,0,23),delta=Number(val?.delta);
       must(Number.isInteger(delta)&&[-1,1,5,-5].includes(delta),'올바르지 않은 점수 변경입니다.');
       must(state.score.rows[row],'점수 대상이 없습니다.');
       const rows=state.score.rows.map(x=>({...x}));
       rows[row].points=Math.max(0,Math.min(9999,rows[row].points+delta));
       tx.update(ref,{'state.score.rows':rows,revision:FieldValue.increment(1)});break;
      }
      case 'teams.make':{
       const groupCount=clamp(val?.groupCount,2,20);
       const manual=list(val?.names,MAX_PEOPLE);
       const names=manual.length>=2?manual:people.map(p=>p.name);
       must(names.length>=2,'팀을 나눌 참가자 2명 이상이 필요합니다.');
       must(groupCount<=names.length,'팀 수가 참가자보다 많습니다.');
       const groups=Array.from({length:groupCount},(_,i)=>({name:(i+1)+'팀',members:[]}));
       shuffle(names).forEach((name,i)=>groups[i%groupCount].members.push(name));
       tx.update(ref,{'state.teams':{groups,at:now},revision:FieldValue.increment(1)});break;
      }
      case 'timer.set':{
       const duration=clamp(val,5,7200);
       tx.update(ref,{'state.timer':{duration,remaining:duration,running:false,startedAt:0},revision:FieldValue.increment(1)});break;
      }
      case 'timer.start':{
       const t=state.timer,rem=remaining(t);
       must(rem>0,'시간을 다시 설정하세요.');
       tx.update(ref,{'state.timer':{...t,remaining:rem,running:true,startedAt:now},revision:FieldValue.increment(1)});break;
      }
      case 'timer.pause':{
       const t=state.timer;
       tx.update(ref,{'state.timer':{...t,remaining:remaining(t),running:false,startedAt:0},revision:FieldValue.increment(1)});break;
      }
      case 'timer.reset':{
       const t=state.timer;
       tx.update(ref,{'state.timer':{duration:t.duration,remaining:t.duration,running:false,startedAt:0},revision:FieldValue.increment(1)});break;
      }
      case 'bracket.set':{
       const names=list(val,32);must(names.length>=2,'대진표에는 2팀 이상 필요합니다.');
       tx.update(ref,{'state.bracket':advanceBracket(bracketFrom(shuffle(names))),revision:FieldValue.increment(1)});break;
      }
      case 'bracket.win':{
       const round=Number(val?.round),match=Number(val?.match);
       must(Number.isInteger(round)&&Number.isInteger(match),'경기 정보가 올바르지 않습니다.');
       const b=structuredClone(state.bracket),m=b.rounds[round]?.[match];
       must(m&&m.a&&m.b,'완성된 경기가 아닙니다.');
       must(!b.rounds[round+1],'다음 라운드가 이미 시작되었습니다.');
       must(val.winner===m.a||val.winner===m.b,'참가하지 않은 팀입니다.');
       m.winner=val.winner;advanceBracket(b);
       tx.update(ref,{'state.bracket':b,revision:FieldValue.increment(1)});break;
      }
      case 'treasure.start':{
       const duration=Number(val?.duration??300);
       must(Number.isInteger(duration)&&duration>=60&&duration<=1800,'게임 시간은 1~30분으로 설정하세요.');
       const round=(state.treasure?.round||0)+1;
       tx.update(ref,{'state.treasure':{...blankState(),status:'playing',round,board:makeBoard(),duration,startedAt:now,endsAt:now+duration*1000},active:'treasure',revision:FieldValue.increment(1)});break;
      }
      case 'treasure.stop':{
       const t=state.treasure||blankState();
       must(t.status==='playing','진행 중인 보물찾기가 없습니다.');
       tx.update(ref,{'state.treasure.status':'finished','state.treasure.endsAt':now,revision:FieldValue.increment(1)});break;
      }
      case 'treasure.reset':{
       const t=state.treasure||blankState();
       tx.update(ref,{'state.treasure':{...blankState(),round:t.round+1},revision:FieldValue.increment(1)});break;
      }
      default:fail('존재하지 않는 동작입니다.',404);
     }
   });
   return res.json({ok:true});
  }
  return res.status(404).json({error:'존재하지 않는 API입니다.'});
 }catch(err){
   const status=err.status||500;
   if(status>=500)console.error('sosokingEventApi',path,err);
   return res.status(status).json({error:status>=500?'서버 처리 중 문제가 발생했습니다.':err.message});
 }
});
