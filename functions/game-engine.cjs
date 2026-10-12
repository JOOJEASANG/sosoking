/* Pure, deterministic game rules shared by browser, validation and score verification. */
(function(root) {
'use strict';
const TYPES = ['route','pace','robot'];
const fail = message => { throw new Error(message); };
const integer = (v,min,max) => Number.isInteger(v) && v>=min && v<=max;
function matrix(g) {
 const n=g.nodes.length, d=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:Infinity));
 for(const [a,b,w] of g.edges) {d[a][b]=Math.min(d[a][b],w);d[b][a]=Math.min(d[b][a],w);}
 for(let k=0;k<n;k++)for(let i=0;i<n;i++)for(let j=0;j<n;j++)d[i][j]=Math.min(d[i][j],d[i][k]+d[k][j]);
 return d;
}
function route(g,input) {
 const order=input.order;
 if(!Array.isArray(order)||order.length!==g.nodes.length-1||new Set(order).size!==order.length||order.some(x=>!integer(x,1,g.nodes.length-1))) fail('모든 배송지를 한 번씩 선택해 주세요.');
 const d=matrix(g),trace=[];let time=0,from=0,onTime=0;
 for(const to of order){const arrival=time+d[from][to];time=arrival+g.service;const ok=time<=g.nodes[to].deadline;onTime+=Number(ok);trace.push({from,to,arrival,time,ok});from=to;}
 time+=d[from][0];trace.push({from,to:0,time,ok:time<=g.limit});
 const complete=onTime===order.length&&time<=g.limit;
 const stars=complete?3:time<=g.limit&&onTime>=order.length-1?2:onTime>0?1:0;
 return {type:'route',stars,complete,metric:time,onTime,total:order.length,trace,score:complete?Math.min(100,80+Math.round(20*(g.bestTime||time)/time)):Math.round(60*onTime/order.length),summary:complete?`전부 제시간에 도착! ${time}분에 복귀했어요.`:`${order.length}곳 중 ${onTime}곳 정시 배송 · 복귀 ${time}분`};
}
const ACTIONS={recover:{label:'회복',cost:-3,time:14},cruise:{label:'유지',cost:2,time:10},sprint:{label:'질주',cost:5,time:7}};
function pace(g,input) {
 const plan=input.plan;
 if(!Array.isArray(plan)||plan.length!==g.segments.length||plan.some(a=>!Object.hasOwn(ACTIONS,a)))fail('모든 구간의 페이스를 정해 주세요.');
 let energy=g.energy,time=0;const trace=[];
 for(let i=0;i<plan.length;i++) {
  const a=ACTIONS[plan[i]],s=g.segments[i];const cost=a.cost+(plan[i]==='sprint'?(s.sprintCost||0):0);const duration=a.time+(s.time?.[plan[i]]||0);
  if(energy<cost)return {type:'pace',stars:0,complete:false,metric:time,score:0,trace,failedAt:i,summary:`${i+1}구간에서 체력이 부족해 멈췄어요. 회복 구간을 앞당겨 보세요.`};
  energy=Math.min(g.capacity,energy-cost);time+=duration;trace.push({segment:i,action:plan[i],energy,time,duration});
 }
 const stars=time<=g.gold?3:time<=g.silver?2:1;
 return {type:'pace',stars,complete:true,metric:time,energy,trace,score:time<=g.gold?100:time<=g.silver?75:50,summary:`${time}초 완주 · 남은 체력 ${energy} · ${stars===3?'금메달 페이스!':stars===2?'은메달! 금메달에 다시 도전해 보세요.':'완주 성공! 구간 특성을 활용해 보세요.'}`};
}
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
function robot(g,input) {
 const program=input.program;
 if(!Array.isArray(program)||!program.length||program.length>g.slots||program.some(c=>!c||!['F','L','R'].includes(c.op)||!integer(c.count,1,3)))fail('명령 슬롯과 반복 횟수를 확인해 주세요.');
 let [x,y,dir]=g.start,energy=g.energy,mask=0;g.samples.forEach((p,i)=>{if(p[0]===x&&p[1]===y)mask|=1<<i;});const trace=[{x,y,dir,energy,mask}],blocked=new Set(g.walls.map(p=>p.join(',')));
 let stopped='';
 outer:for(const cmd of program)for(let i=0;i<cmd.count;i++) {
  if(energy<=0){stopped='배터리가 바닥났어요.';break outer;} energy--;
  if(cmd.op==='L')dir=(dir+3)%4;
  else if(cmd.op==='R')dir=(dir+1)%4;
  else {const nx=x+DIRS[dir][0],ny=y+DIRS[dir][1];if(nx<0||ny<0||nx>=g.width||ny>=g.height||blocked.has(`${nx},${ny}`)){stopped='장애물에 부딪혔어요. 충돌 직전 명령을 확인해 보세요.';trace.push({x,y,dir,energy,mask,collision:true});break outer;}x=nx;y=ny;}
  g.samples.forEach((p,i)=>{if(p[0]===x&&p[1]===y)mask|=1<<i;});trace.push({x,y,dir,energy,mask});
 }
 const collected=g.samples.filter((_,i)=>mask&(1<<i)).length;
 const complete=!stopped&&collected===g.samples.length&&x===g.goal[0]&&y===g.goal[1];
 const stars=complete?(program.length<=g.goldSlots?3:2):collected?1:0;
 return {type:'robot',stars,complete,metric:g.energy-energy,score:complete?(stars===3?100:75):Math.round(30*collected/g.samples.length),energy,collected,trace,summary:complete?`표본 ${collected}개 회수, 기지 도착! 명령 ${program.length}칸 · 배터리 ${energy} 남음`:stopped||`표본 ${collected}/${g.samples.length}개 · 모든 표본을 모아 기지로 이동하세요.`};
}
function evaluate(g,input){if(!TYPES.includes(g.type))fail('지원하지 않는 게임입니다.');return ({route,pace,robot})[g.type](g,input||{});}
function permutations(a){if(!a.length)return [[]];return a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(p=>[v,...p]));}
function solve(g){
 if(g.type==='route'){const all=permutations(g.nodes.slice(1).map((_,i)=>i+1)).map(order=>({input:{order},result:route(g,{order})}));return all.filter(x=>x.result.complete).sort((a,b)=>a.result.metric-b.result.metric)[0]||null;}
 if(g.type==='pace'){let best=null;function walk(plan){if(plan.length===g.segments.length){const r=pace(g,{plan});if(r.complete&&(!best||r.metric<best.result.metric))best={input:{plan:[...plan]},result:r};return;}for(const k of Object.keys(ACTIONS))walk([...plan,k]);}walk([]);return best;}
 if(g.type==='robot') {
  // A vetted witness is mandatory; bounded verification avoids expensive untrusted searches.
  if(!Array.isArray(g.solution))return null;
  const result=robot(g,{program:g.solution});return result.complete?{input:{program:g.solution},result}:null;
 }
 return null;
}
function validate(g){
 if(!g||typeof g!=='object'||!TYPES.includes(g.type))fail('잘못된 게임 유형');
 if(!integer(g.version,1,100)||!integer(g.difficulty,1,3)||!integer(g.minutes,1,20))fail('미션 표시 정보 오류');
 if(typeof g.id!=='string'||!/^[a-z0-9-]{3,80}$/.test(g.id))fail('잘못된 게임 ID');
 if(!['life','sports','science'].includes(g.category)||({route:'life',pace:'sports',robot:'science'})[g.type]!==g.category)fail('게임 분야 불일치');
 for(const k of ['title','subtitle','brief','hint','explanation'])if(typeof g[k]!=='string'||!g[k].trim()||g[k].length>1200)fail(`내용 오류: ${k}`);
 if(g.type==='route'){
  if(!Array.isArray(g.nodes)||g.nodes.length<4||g.nodes.length>7||!Array.isArray(g.edges)||g.edges.length>30||!integer(g.service,0,5)||!integer(g.limit,1,200))fail('배송 설정 오류');
  for(const n of g.nodes)if(typeof n.label!=='string'||n.label.length>30||!integer(n.x,0,100)||!integer(n.y,0,100))fail('배송지 오류');
  for(const n of g.nodes.slice(1))if(!integer(n.deadline,1,200))fail('마감 시간 오류');
  for(const e of g.edges)if(!Array.isArray(e)||e.length!==3||!integer(e[0],0,g.nodes.length-1)||!integer(e[1],0,g.nodes.length-1)||!integer(e[2],1,50))fail('도로 오류');
  if(matrix(g).some(r=>r.some(x=>!Number.isFinite(x))))fail('연결되지 않은 지도');
 }
 if(g.type==='pace'){
  if(!integer(g.energy,1,20)||!integer(g.capacity,g.energy,20)||!integer(g.gold,1,300)||!integer(g.silver,g.gold,350)||!Array.isArray(g.segments)||g.segments.length<4||g.segments.length>7)fail('레이스 설정 오류');
  for(const s of g.segments){if(typeof s.label!=='string'||s.label.length>30||!integer(s.sprintCost||0,0,4))fail('구간 오류');for(const a of Object.keys(ACTIONS))if(!integer(s.time?.[a]||0,-3,6))fail('시간 보정 오류');}
 }
 if(g.type==='robot'){
  if(!integer(g.width,4,7)||!integer(g.height,4,7)||!integer(g.slots,3,16)||!integer(g.goldSlots,1,g.slots)||!integer(g.energy,1,50))fail('로봇 설정 오류');
  const pos=p=>Array.isArray(p)&&integer(p[0],0,g.width-1)&&integer(p[1],0,g.height-1);
  if(!pos(g.start)||!integer(g.start[2],0,3)||!pos(g.goal)||!Array.isArray(g.samples)||g.samples.length<1||g.samples.length>5||!Array.isArray(g.walls)||g.walls.length>35||![...g.samples,...g.walls].every(pos))fail('로봇 지도 오류');
  const walls=new Set(g.walls.map(p=>p.join(',')));if(walls.has(g.start.slice(0,2).join(','))||walls.has(g.goal.join(','))||g.samples.some(p=>walls.has(p.join(',')))||new Set(g.samples.map(p=>p.join(','))).size!==g.samples.length)fail('겹치는 좌표');
 }
 const solved=solve(g);if(!solved)fail('목표를 달성할 수 없는 미션');
 if(g.type==='pace'&&solved.result.metric>g.gold)fail('금메달이 불가능한 미션');
 if(g.type==='robot'&&solved.result.stars<3)fail('3별을 달성하는 검증 경로 필요');
 return solved;
}
const api={TYPES,ACTIONS,DIRS,matrix,evaluate,solve,validate};
if(typeof module==='object'&&module.exports)module.exports=api;else root.SosoEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
