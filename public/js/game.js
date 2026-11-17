import {
  WIDTH,HEIGHT,CELL,COLS,ROWS,ROUTES,RUINS,PATH_TILES,RUIN_TILES,ROUTE_LENGTHS,
  DIFFICULTIES,TOWERS,ENEMIES,CARDS,gridToPixel,routePoints,routePosition,
  canBuild,synergyCount,upgradePrice,sellValue,wavePlan,cardChoices,defaultBoosts,applyCard,formatNumber
} from "./rules.js";
import {createBattle3D} from "./renderer3d.js";

const $=id=>document.getElementById(id);
const canvas=$("battlefield"),ctx=canvas.getContext("2d",{alpha:false});
let visual=null;
const modal=$("modal"),modalBody=$("modalBody");
const keys=Object.keys(TOWERS);
const particles=[],shots=[],beams=[],floats=[];
const stars=Array.from({length:90},(_,i)=>({x:(i*173+37)%WIDTH,y:(i*79+83)%HEIGHT,r:i%7===0?2:1}));
let state,frame=0,last=0,hover=null,selectedKind=null,selectedTower=null,movingTower=null,modalPauseRestore=false,enemySeq=1,audio=null,muted=false,uiTimer=0;
let logs=[];
const SAVE_KEY="riftguard-checkpoint-v1";

function fresh(diff="normal"){
 const d=DIFFICULTIES[diff];
 return {difficulty:diff,phase:"prepare",wave:0,lives:d.lives,shield:0,credits:d.credits,
 score:0,kills:0,towers:[],enemies:[],boosts:defaultBoosts(),charge:0,overdrive:0,
 spawnIndex:0,waveTimer:0,plan:null,speed:1,elapsed:0,shake:0,flash:0,paused:false,highestCombo:0,combo:0};
}
function sound(freq=440,duration=.085,type="sine",gain=.025){
 if(muted)return;
 try{
  audio=audio||new(window.AudioContext||window.webkitAudioContext)();
  if(audio.state==="suspended")audio.resume();
  const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;
  o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.68),t+duration);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration+.02);
 }catch(err){/* audio is optional */}
}
function log(message){
 logs.unshift(message);logs=logs.slice(0,4);
 $("battleLog").innerHTML=logs.map(v=>"<li>"+v+"</li>").join("");
}
function toast(message){
 const el=$("toast");el.textContent=message;el.classList.add("show");
 clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2000);
}
function burst(x,y,color,count=12,power=100){
 for(let i=0;i<count;i++){
  const a=Math.random()*Math.PI*2,s=(.3+Math.random())*power,l=.3+Math.random()*.45;
  particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:l,max:l,r:1+Math.random()*2.5,color});
 }
 if(particles.length>330)particles.splice(0,particles.length-330);
}
function floater(x,y,text,color="#ffffff"){
 floats.push({x,y,text,color,life:.85});if(floats.length>90)floats.shift();
}
function saveCheckpoint(){
 if(!state||state.phase!=="prepare")return;
 try{
  localStorage.setItem(SAVE_KEY,JSON.stringify({
   v:1,difficulty:state.difficulty,wave:state.wave,lives:state.lives,shield:state.shield,
   credits:state.credits,score:state.score,kills:state.kills,charge:state.charge,
   boosts:state.boosts,towers:state.towers.map(t=>({gx:t.gx,gy:t.gy,type:t.type,level:t.level}))
  }));
 }catch(err){/* storage may be unavailable */}
}
function readCheckpoint(){
 try{
  const s=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
  if(!s||s.v!==1||!DIFFICULTIES[s.difficulty]||!Number.isInteger(s.wave)||s.wave<1||
    !Array.isArray(s.towers)||s.towers.length>100||!s.boosts)return null;
  return s;
 }catch(err){return null;}
}
function resumeRun(){
 const s=readCheckpoint();
 if(!s){showIntro();return;}
 shots.length=0;beams.length=0;floats.length=0;particles.length=0;
 state=fresh(s.difficulty);
 state.wave=s.wave;state.lives=s.lives;state.shield=s.shield;state.credits=s.credits;
 state.score=s.score;state.kills=s.kills;state.charge=s.charge;
 state.boosts={...defaultBoosts(),...s.boosts};state.towers=[];
 for(const t of s.towers){
  if(!TOWERS[t.type]||!canBuild(t.gx,t.gy,state.towers))continue;
  const p=gridToPixel(t.gx,t.gy);
  state.towers.push({...p,gx:t.gx,gy:t.gy,type:t.type,level:Math.max(1,Math.min(4,t.level)),angle:-Math.PI/2,cooldown:.1,flash:0});
 }
 selectedTower=null;selectedKind=null;movingTower=null;logs=[];
 $("difficultyLabel").textContent=DIFFICULTIES[state.difficulty].label;
 modal.classList.add("hidden");log("저장된 작전 복원 · WAVE "+state.wave+" 완료");
 toast("작전 복구 성공 · 다음 웨이브를 시작하세요");
 sound(660,.18,"triangle");updateUI();
}
function play(diff){
 shots.length=0;beams.length=0;floats.length=0;particles.length=0;
 state=fresh(diff);selectedKind=null;selectedTower=null;movingTower=null;enemySeq=1;logs=[];
 try{localStorage.removeItem(SAVE_KEY);}catch(err){}
 log("지휘 시스템 온라인. 첫 침공을 준비하세요.");
 $("difficultyLabel").textContent=DIFFICULTIES[diff].label;
 modal.classList.add("hidden");
 updateUI();
 toast("시설을 설치한 뒤 웨이브를 시작하세요");
 sound(660,.20,"triangle");
}
function startWave(){
 if(state.phase!=="prepare")return;
 state.wave++;state.plan=wavePlan(state.wave);
 state.spawnIndex=0;state.waveTimer=0;state.phase="combat";state.paused=false;
 selectedTower=null;selectedKind=null;movingTower=null;
 const warning=state.plan.boss?" · 보스 감지!":"";
 log("WAVE "+String(state.wave).padStart(2,"0")+" 침공 시작"+warning);
 toast(state.plan.boss?"경고: 거대 개체 접근 중!":"침공 감지 · 방어선을 유지하세요");
 sound(state.plan.boss?145:360,.25,"sawtooth",.038);
 updateUI();
}
function spawnEnemy(data,dist=0,mini=false){
 const base=ENEMIES[data.type],diff=DIFFICULTIES[state.difficulty];
 const scale=1+Math.max(0,state.wave-1)*.17;
 const hp=Math.round(base.hp*scale*diff.hp*(mini?.55:1));
 const shield=Math.round((base.shield||0)*scale*diff.hp);
 const point=routePosition(data.lane,dist);
 const e={id:enemySeq++,kind:data.type,lane:data.lane,distance:dist,x:point.x,y:point.y,
  hp,maxHp:hp,shield,maxShield:shield,speed:base.speed*diff.speed*(1+Math.min(.3,state.wave*.012)),
  slow:0,slowAmount:1,dead:false,mini,angle:point.angle,phase:Math.random()*6.28};
 state.enemies.push(e);return e;
}
function effectiveRange(t){return TOWERS[t.type].range*(1+(t.level-1)*.085)*state.boosts.range;}
function effectiveDamage(t){return TOWERS[t.type].damage*(1+(t.level-1)*.48)*state.boosts.damage*(1+synergyCount(t,state.towers)*.13);}
function effectiveInterval(t){return TOWERS[t.type].interval/((1+(t.level-1)*.18)*state.boosts.speed*(state.overdrive>0?1.65:1));}
function inRange(t,e){return Math.hypot(t.x-e.x,t.y-e.y)<=effectiveRange(t)+ENEMIES[e.kind].size*.35;}
function targetFor(t){
 let best=null,progress=-Infinity;
 for(const e of state.enemies){
  if(e.dead||!inRange(t,e))continue;
  const p=e.distance/ROUTE_LENGTHS[e.lane];
  if(p>progress){progress=p;best=e;}
 }
 return best;
}
function damageEnemy(e,raw,t,kind="pulse"){
 if(!e||e.dead)return;
 let amount=raw,crit=Math.random()<state.boosts.crit;
 if(crit)amount*=2;
 if(e.shield>0){
  const used=Math.min(e.shield,amount);e.shield-=used;amount-=used;
  burst(e.x,e.y,"#7ab5ff",2,32);
 }
 if(amount>0)e.hp-=amount*(1-(ENEMIES[e.kind].armor||0));
 const displayed=Math.round(raw*(crit?2:1));
 if(Math.random()<.38||crit)floater(e.x+(Math.random()-.5)*24,e.y-15,crit?"CRIT "+displayed:String(displayed),crit?"#ffc977":"#d9faff");
 state.charge=Math.min(100,state.charge+Math.min(1.7,raw/80));
 if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
 if(e.dead)return;
 e.dead=true;const base=ENEMIES[e.kind];
 state.credits+=Math.round(base.bounty*state.boosts.bounty*(e.mini?.5:1));
 state.score+=Math.round(base.bounty*10*DIFFICULTIES[state.difficulty].score);
 state.kills++;state.combo++;state.highestCombo=Math.max(state.combo,state.highestCombo);
 state.charge=Math.min(100,state.charge+(e.kind==="boss"?25:5));
 burst(e.x,e.y,base.color,e.kind==="boss"?45:12,e.kind==="boss"?195:95);
 floater(e.x,e.y-25,"+"+Math.round(base.bounty*state.boosts.bounty),"#64f4d4");
 if(e.kind==="split"&&!e.mini){
  for(let i=0;i<2;i++){
   const m=spawnEnemy({type:"dash",lane:e.lane},Math.max(0,e.distance-12+i*15),true);
   m.hp=Math.round(m.hp*.72);m.maxHp=m.hp;
  }
 }
 if(e.kind==="boss"){
  log("공허 군주 격파! 대규모 보급 확보");
  state.shake=13;sound(180,.45,"sawtooth",.05);
 }
}
function shoot(t,target){
 const cfg=TOWERS[t.type],dmg=effectiveDamage(t);
 t.angle=Math.atan2(target.y-t.y,target.x-t.x);
 if(t.type==="rail"){
  const dx=Math.cos(t.angle),dy=Math.sin(t.angle),max=effectiveRange(t);
  const affected=state.enemies.filter(e=>{
   if(e.dead)return false;
   const px=e.x-t.x,py=e.y-t.y,proj=px*dx+py*dy;
   return proj>0&&proj<max&&Math.abs(px*dy-py*dx)<ENEMIES[e.kind].size+13;
  }).sort((a,b)=>b.distance/ROUTE_LENGTHS[b.lane]-a.distance/ROUTE_LENGTHS[a.lane]).slice(0,cfg.pierce);
  for(const e of affected)damageEnemy(e,dmg,t,"rail");
  beams.push({points:[{x:t.x,y:t.y},{x:t.x+dx*max,y:t.y+dy*max}],life:.22,max:.22,color:cfg.color,width:5});
  burst(t.x+dx*26,t.y+dy*26,cfg.color,5,60);
  sound(180,.10,"sawtooth",.013);
 }else if(t.type==="arc"){
  let prev={x:t.x,y:t.y},current=target,hit=new Set();
  const pts=[prev],count=cfg.chain+(t.level>=3?1:0);
  for(let i=0;i<count&&current;i++){
   hit.add(current.id);pts.push({x:current.x,y:current.y});
   damageEnemy(current,dmg*Math.pow(.79,i),t,"arc");
   const nearby=state.enemies.filter(e=>!e.dead&&!hit.has(e.id)&&Math.hypot(e.x-current.x,e.y-current.y)<126);
   nearby.sort((a,b)=>Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y));
   current=nearby[0]||null;
  }
  beams.push({points:pts,life:.26,max:.26,color:cfg.color,width:3});
  sound(520,.075,"triangle",.010);
 }else{
  shots.push({x:t.x,y:t.y,target:target.id,kind:t.type,damage:dmg,speed:cfg.speed,r:t.type==="frost"?7:4,color:cfg.color,life:2});
  if(t.type==="frost")sound(330,.06,"sine",.008);
 }
 t.flash=.14;
}
function updateShots(dt){
 for(const p of shots){
  p.life-=dt;
  const e=state.enemies.find(e=>e.id===p.target&&!e.dead);
  if(!e){p.life=0;continue;}
  const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy),step=p.speed*dt;
  if(d<=step+e.kind.length*.4+7){
   p.life=0;
   if(p.kind==="frost"){
    for(const a of [...state.enemies]){
     if(a.dead||Math.hypot(a.x-e.x,a.y-e.y)>TOWERS.frost.splash)continue;
     damageEnemy(a,p.damage*(a===e?1:.70),null,"frost");
     a.slow=2.0;a.slowAmount=Math.max(.25,.52-state.boosts.freeze);
    }
    burst(e.x,e.y,"#95d9ff",19,115);
    beams.push({points:[{x:e.x,y:e.y,r:55}],life:.25,max:.25,color:"#8cbcff",width:3,ring:true});
   }else{damageEnemy(e,p.damage,null,"pulse");burst(e.x,e.y,"#8affd8",4,55);}
  }else{p.x+=dx/d*step;p.y+=dy/d*step;}
 }
 for(let i=shots.length-1;i>=0;i--)if(shots[i].life<=0)shots.splice(i,1);
}
function updateCombat(dt){
 state.waveTimer+=dt;state.elapsed+=dt;
 if(state.overdrive>0)state.overdrive=Math.max(0,state.overdrive-dt);
 while(state.spawnIndex<state.plan.spawns.length&&state.plan.spawns[state.spawnIndex].at<=state.waveTimer){
  spawnEnemy(state.plan.spawns[state.spawnIndex]);state.spawnIndex++;
 }
 for(const e of state.enemies){
  if(e.dead)continue;
  if(e.slow>0)e.slow=Math.max(0,e.slow-dt);else e.slowAmount=1;
  e.distance+=e.speed*(e.slow>0?e.slowAmount:1)*(state.overdrive>0?.64:1)*dt;
  const p=routePosition(e.lane,e.distance);e.x=p.x;e.y=p.y;e.angle=p.angle;
  if(e.distance>=ROUTE_LENGTHS[e.lane]){
   e.dead=true;const incoming=ENEMIES[e.kind].damage;
   const absorbed=Math.min(state.shield,incoming);state.shield-=absorbed;
   state.lives-=incoming-absorbed;state.combo=0;state.shake=7;state.flash=.22;
   floater(WIDTH-90,265,absorbed===incoming?"BLOCK":"-"+String(incoming-absorbed),"#ff7498");
   if(state.lives<=0){state.lives=0;gameOver();return;}
  }
 }
 for(const t of state.towers){
  t.cooldown-=dt;t.flash=Math.max(0,t.flash-dt);
  if(t.cooldown>0)continue;
  const e=targetFor(t);
  if(e){shoot(t,e);t.cooldown=effectiveInterval(t);}
 }
 updateShots(dt);
 state.enemies=state.enemies.filter(e=>!e.dead);
 if(state.spawnIndex>=state.plan.spawns.length&&state.enemies.length===0){
  endWave();
 }
}
function endWave(){
 state.phase="draft";state.combo=0;state.charge=Math.min(100,state.charge+12);
 const reward=75+state.wave*18;state.credits+=reward;
 log("WAVE "+state.wave+" 방어 성공 · 보급 +"+reward);
 sound(800,.28,"triangle",.028);
 showDraft(reward);
 updateUI();
}
function useCard(id){
 applyCard(state,id);const card=CARDS.find(c=>c.id===id);
 log("프로토콜 적용: "+card.name);state.phase="prepare";
 saveCheckpoint();
 modal.classList.add("hidden");selectedTower=null;selectedKind=null;
 toast(card.name+" 활성화");
 sound(720,.18,"triangle",.028);updateUI();
}
function gameOver(){
 state.phase="over";selectedTower=null;selectedKind=null;
 const best=Number(localStorage.getItem("riftguard-best")||0);
 if(state.score>best)localStorage.setItem("riftguard-best",String(state.score));
 try{localStorage.removeItem(SAVE_KEY);}catch(err){}
 log("코어 기능 정지 · 작전 종료");
 sound(110,.5,"sawtooth",.05);
 showEnd();
 updateUI();
}
function triggerOverdrive(){
 if(state.phase!=="combat"||state.paused)return;
 if(state.charge<100){toast("오버드라이브 에너지가 부족합니다");return;}
 if(state.overdrive>0)return;
 state.overdrive=8;state.charge=0;state.flash=.3;
 log("오버드라이브 발동! 8초간 전장 제어");
 burst(925,275,"#64f4d4",40,270);
 toast("OVERDRIVE · 공격 속도 증가 / 적 이동 감소");
 sound(960,.24,"sawtooth",.055);
 updateUI();
}
function placeTower(gx,gy){
 if(!canBuild(gx,gy,state.towers)){toast("해당 위치에는 설치할 수 없습니다");sound(190,.08,"square");return;}
 const cfg=TOWERS[selectedKind];
 if(state.credits<cfg.cost){toast("크레딧이 부족합니다");sound(190,.08,"square");return;}
 const p=gridToPixel(gx,gy);
 state.towers.push({gx,gy,x:p.x,y:p.y,type:selectedKind,level:1,cooldown:.05,angle:-Math.PI/2,flash:0});
 state.credits-=cfg.cost;
 burst(p.x,p.y,cfg.color,23,85);sound(570,.12,"triangle");
 log(cfg.name+" 설치 · -"+cfg.cost+" CR");
 selectedKind=null;selectedTower=state.towers[state.towers.length-1];updateUI();
}
function upgrade(){
 if(!selectedTower)return;
 const cost=upgradePrice(selectedTower.type,selectedTower.level);
 if(cost===null){toast("최대 레벨입니다");return;}
 if(state.credits<cost){toast("크레딧이 부족합니다");return;}
 state.credits-=cost;selectedTower.level++;
 burst(selectedTower.x,selectedTower.y,TOWERS[selectedTower.type].color,28,90);
 log(TOWERS[selectedTower.type].name+" Lv."+selectedTower.level+" 강화");sound(760,.19,"triangle");
 updateUI();
}
function sell(){
 if(!selectedTower)return;
 const t=selectedTower,back=sellValue(t.type,t.level);
 state.credits+=back;state.towers=state.towers.filter(a=>a!==t);
 burst(t.x,t.y,"#ffcc77",14,74);selectedTower=null;
 log("포탑 철거 · +"+back+" CR");sound(350,.11,"sine");updateUI();
}
function pickKind(kind){
 movingTower=null;selectedTower=null;selectedKind=selectedKind===kind?null:kind;
 updateUI();
}
function canvasPoint(e){
 if(visual)return visual.pointer(e);
 const b=canvas.getBoundingClientRect();
 return{x:(e.clientX-b.left)*WIDTH/b.width,y:(e.clientY-b.top)*HEIGHT/b.height};
}
canvas.addEventListener("pointermove",e=>{
 const p=canvasPoint(e);hover={x:p.x,y:p.y,gx:Math.floor(p.x/CELL),gy:Math.floor(p.y/CELL)};
});
canvas.addEventListener("pointerleave",()=>hover=null);
canvas.addEventListener("pointerdown",e=>{
 if(!state||["menu","draft","over"].includes(state.phase))return;
 const p=canvasPoint(e),gx=Math.floor(p.x/CELL),gy=Math.floor(p.y/CELL);
 if(movingTower){
  if(!canBuild(gx,gy,state.towers)){toast("이동할 수 없는 위치입니다");return;}
  if(state.credits<35){toast("재배치에 필요한 크레딧이 부족합니다");return;}
  const p=gridToPixel(gx,gy);
  movingTower.gx=gx;movingTower.gy=gy;movingTower.x=p.x;movingTower.y=p.y;movingTower.cooldown=.25;
  state.credits-=35;selectedTower=movingTower;movingTower=null;
  burst(p.x,p.y,"#65f4d5",19,85);log("시설 재배치 완료 · -35 CR");sound(670,.12,"triangle");updateUI();return;
 }
 const t=state.towers.find(t=>t.gx===gx&&t.gy===gy);
 if(t){selectedTower=t;selectedKind=null;updateUI();return;}
 if(selectedKind){placeTower(gx,gy);return;}
 selectedTower=null;updateUI();
});
document.querySelectorAll("[data-tower]").forEach(btn=>btn.addEventListener("click",()=>pickKind(btn.dataset.tower)));
$("waveBtn").addEventListener("click",startWave);
$("pauseBtn").addEventListener("click",()=>{
 if(state.phase!=="combat")return;
 state.paused=!state.paused;toast(state.paused?"일시정지":"전투 재개");updateUI();
});
$("speedBtn").addEventListener("click",()=>{state.speed=state.speed===1?2:1;updateUI();});
$("overdriveBtn").addEventListener("click",triggerOverdrive);
$("upgradeBtn").addEventListener("click",upgrade);
$("sellBtn").addEventListener("click",sell);
$("relocateBtn").addEventListener("click",()=>{
 if(!selectedTower||state.credits<35)return;
 movingTower=movingTower===selectedTower?null:selectedTower;
 if(movingTower)toast("이동할 빈 칸을 선택하세요 · 35 CR");
 updateUI();
});
$("clearBtn").addEventListener("click",()=>{selectedTower=null;selectedKind=null;movingTower=null;updateUI();});
$("helpBtn").addEventListener("click",showHelp);
$("muteBtn").addEventListener("click",()=>{muted=!muted;$("muteBtn").textContent=muted?"소리 켜기":"음소거";});
$("newBtn").addEventListener("click",showReset);
window.addEventListener("keydown",e=>{
 if(!state||!modal.classList.contains("hidden"))return;
 if(["Space","Digit1","Digit2","Digit3","Digit4","Escape"].includes(e.code))e.preventDefault();
 if(e.code.startsWith("Digit")&&Number(e.code.slice(5))>=1&&Number(e.code.slice(5))<=4)pickKind(keys[Number(e.code.slice(5))-1]);
 if(e.code==="Space")triggerOverdrive();
 if(e.code==="Escape"){selectedTower=null;selectedKind=null;movingTower=null;updateUI();}
 if(e.code==="KeyP")$("pauseBtn").click();
 if(e.code==="KeyF")$("speedBtn").click();
 if(e.code==="Enter"&&state.phase==="prepare")startWave();
});

function updateUI(){
 if(!state)return;
 $("waveStat").textContent=String(state.wave).padStart(2,"0");
 $("creditsStat").textContent=formatNumber(state.credits);
 $("livesStat").textContent=state.lives;
 $("shieldStat").textContent=state.shield;
 $("scoreStat").textContent=formatNumber(state.score);
 $("killStat").textContent=formatNumber(state.kills);
 $("overdriveFill").style.width=state.charge+"%";
 $("overdriveText").textContent=Math.floor(state.charge)+"%";
 $("overdriveBtn").disabled=state.phase!=="combat"||state.paused||state.charge<100||state.overdrive>0;
 $("overdriveBtn").textContent=state.overdrive>0?"가동 중 "+Math.ceil(state.overdrive)+"초":"오버드라이브 [SPACE]";
 $("waveBtn").disabled=state.phase!=="prepare";
 $("waveBtn").textContent=state.phase==="prepare"?"WAVE "+(state.wave+1)+" 시작":"침공 진행 중";
 $("pauseBtn").disabled=state.phase!=="combat";
 $("pauseBtn").textContent=state.paused?"▶ 재개":"Ⅱ 일시정지";
 $("speedBtn").textContent="속도 ×"+state.speed;
 $("battleStatus").textContent=state.phase==="combat"?(state.paused?"일시정지":state.overdrive>0?"오버드라이브 가동":"적군 접근 중"):
  state.phase==="prepare"?"다음 웨이브 준비":state.phase==="draft"?"프로토콜 선택":"코어 손실";
 $("battleStatus").dataset.phase=state.phase;
 const total=state.plan?.spawns.length||1;
 $("waveProgress").style.width=(state.phase==="combat"?100*state.spawnIndex/total:state.phase==="prepare"?0:100)+"%";
 $("enemyCount").textContent=state.enemies.length+" ACTIVE";
 document.querySelectorAll("[data-tower]").forEach(btn=>{
  const kind=btn.dataset.tower,cfg=TOWERS[kind];
  btn.classList.toggle("active",selectedKind===kind);
  btn.classList.toggle("unaffordable",state.credits<cfg.cost);
  btn.setAttribute("aria-pressed",String(selectedKind===kind));
 });
 const inspector=$("inspector");
 if(selectedTower){
  const t=selectedTower,cfg=TOWERS[t.type],up=upgradePrice(t.type,t.level);
  inspector.innerHTML='<div class="selected-title"><span class="selected-dot" style="background:'+cfg.color+'"></span><div><strong>'+cfg.name+'</strong><small>LEVEL '+t.level+' / 4</small></div></div>'+
   '<div class="inspect-rows"><div><span>공격력</span><b>'+Math.round(effectiveDamage(t))+'</b></div>'+
   '<div><span>사거리</span><b>'+Math.round(effectiveRange(t))+'</b></div>'+
   '<div><span>공격 간격</span><b>'+effectiveInterval(t).toFixed(2)+'s</b></div>'+
   '<div><span>시설 연계</span><b>+'+(synergyCount(t,state.towers)*13)+'% DMG</b></div></div>';
  $("upgradeBtn").disabled=up===null||state.credits<up;
  $("upgradeBtn").textContent=up===null?"최대 강화 완료":"강화 · "+up+" CR";
  $("sellBtn").disabled=false;$("sellBtn").textContent="철거 · +"+sellValue(t.type,t.level);
 }else{
  inspector.innerHTML='<div class="empty-inspector"><span class="crosshair">⌖</span><strong>시설을 선택하세요</strong><p>전장에 배치한 포탑을 선택하면 성능을 강화하거나 철거할 수 있습니다.</p></div>';
  $("upgradeBtn").disabled=true;$("upgradeBtn").textContent="강화";
  $("sellBtn").disabled=true;$("sellBtn").textContent="철거";
 }
 $("relocateBtn").disabled=!selectedTower||state.credits<35;
 $("relocateBtn").textContent=movingTower?"이동할 위치 선택 중…":"재배치 · 35 CR";
 $("bestStat").textContent=formatNumber(Number(localStorage.getItem("riftguard-best")||0));
}
function modalSet(html){
 modalBody.innerHTML=html;modal.classList.remove("hidden");
}
function showIntro(){
 state=fresh("normal");state.phase="menu";updateUI();
 const checkpoint=readCheckpoint();
 const continueBlock=checkpoint?
 '<button type="button" id="continueSaved" class="resume-btn">↻ 저장된 작전 이어하기 · WAVE '+(checkpoint.wave+1)+' →</button>':"";
 modalSet('<div class="modal-eyebrow">SOSOKING ORIGINAL · DEFENSE</div>'+
 '<div class="modal-symbol">✦</div><h1>RIFT <em>GUARD</em></h1>'+
 '<p class="modal-lead">두 개의 차원문, 하나의 코어.<br>당신의 배치와 선택이 전장의 흐름을 바꿉니다.</p>'+
 '<div class="intro-features"><span>◆ 이중 침공 경로</span><span>◆ 4종 시설</span><span>◆ 로그라이크 강화</span><span>◆ 5웨이브마다 보스</span></div>'+
 '<p class="modal-label">작전 난이도 선택</p>'+
 '<div class="difficulty-grid">'+
 '<button class="difficulty-btn" data-difficulty="easy"><small>CASUAL</small><b>정찰</b><span>넉넉한 자원 · 여유로운 방어</span></button>'+
 '<button class="difficulty-btn recommended" data-difficulty="normal"><small>RECOMMENDED</small><b>작전</b><span>전략과 반응의 균형</span></button>'+
 '<button class="difficulty-btn" data-difficulty="hard"><small>HARDCORE</small><b>극한</b><span>강한 적 · 높은 기록 점수</span></button></div>'+
 '<p class="modal-footnote">무료 · 광고 없음 · 설치 없이 플레이</p>'+continueBlock);
 modalBody.querySelectorAll("[data-difficulty]").forEach(b=>b.addEventListener("click",()=>play(b.dataset.difficulty)));
 if(checkpoint)$("continueSaved").addEventListener("click",resumeRun);
}
function showDraft(reward){
 const cards=cardChoices(state.wave);
 modalSet('<div class="modal-eyebrow">WAVE '+String(state.wave).padStart(2,"0")+' CLEAR · +'+reward+' CR</div>'+
 '<h2>전투 프로토콜 선택</h2><p class="modal-lead">매 웨이브마다 하나를 선택해 전력을 진화시키세요.<br>선택한 강화는 이번 작전 내내 유지됩니다.</p>'+
 '<div class="draft-grid">'+cards.map(c=>'<button class="draft-card tone-'+c.tone+'" data-card="'+c.id+'"><span class="draft-icon">'+c.icon+'</span><small>'+c.detail+'</small><b>'+c.name+'</b><span>'+c.description+'</span><strong>선택하기 ↗</strong></button>').join("")+'</div>'+
 '<p class="modal-footnote">코어 '+state.lives+' · 크레딧 '+formatNumber(state.credits)+' · 현재 점수 '+formatNumber(state.score)+'</p>');
 modalBody.querySelectorAll("[data-card]").forEach(b=>b.addEventListener("click",()=>useCard(b.dataset.card)));
}
function showEnd(){
 const best=Number(localStorage.getItem("riftguard-best")||0),record=state.score>=best;
 modalSet('<div class="modal-eyebrow">MISSION TERMINATED</div><div class="modal-symbol danger">◇</div>'+
 '<h2>코어가 함락되었습니다</h2><p class="modal-lead">방어선은 무너졌지만, 다음 작전에는 더 좋은 선택을 할 수 있습니다.</p>'+
 '<div class="result-grid"><div><small>생존 웨이브</small><strong>'+state.wave+'</strong></div><div><small>최종 점수</small><strong>'+formatNumber(state.score)+'</strong></div><div><small>처치 수</small><strong>'+formatNumber(state.kills)+'</strong></div></div>'+
 (record?'<p class="record-text">★ 새로운 최고 기록!</p>':'<p class="record-text">최고 기록 · '+formatNumber(best)+'</p>')+
 '<button class="primary large" id="restartFromEnd">다시 출격 →</button>');
 $("restartFromEnd").addEventListener("click",showIntro);
}
function pauseForUtility(){
 modalPauseRestore=state.phase==="combat"&&!state.paused;
 if(modalPauseRestore)state.paused=true;
}
function closeUtility(){
 modal.classList.add("hidden");
 if(modalPauseRestore)state.paused=false;
 modalPauseRestore=false;updateUI();
}
function showHelp(){
 pauseForUtility();
 modalSet('<div class="modal-eyebrow">FIELD MANUAL</div><h2>작전 가이드</h2>'+
 '<div class="help-text"><p><b>01 · 건설</b><br>왼쪽에서 포탑을 고른 뒤 전장 빈 칸을 선택하세요. 적이 이동하는 도로와 잔해 위에는 건설할 수 없습니다.</p>'+
 '<p><b>02 · 경제</b><br>적을 처치하면 크레딧을 얻습니다. 고급 포탑만 늘리기보다 저렴한 포탑을 강화하는 편이 유리할 때도 있습니다.</p>'+
 '<p><b>03 · 이중 경로</b><br>북쪽·남쪽 차원문에서 동시에 적이 접근해 오른쪽 코어로 집결합니다. 교차점 인근이 유리하지만 초반 분산 방어도 중요합니다.</p>'+
 '<p><b>04 · 오버드라이브</b><br>적을 처치하고 피해를 주면 에너지가 충전됩니다. 100%가 되면 8초간 포탑 공격 속도가 65% 빨라지고 적의 이동 속도가 느려집니다.</p>'+
 '<p><b>05 · 선택의 시간</b><br>매 웨이브 종료 후 세 가지 프로토콜 중 하나를 선택할 수 있습니다. 5웨이브마다 강력한 보스가 등장합니다.</p>'+
 '<p><b>단축키</b><br>1~4 포탑 선택 · Space 오버드라이브 · Enter 웨이브 시작 · P 일시정지 · F 2배속 · ESC 선택 해제</p></div>'+
 '<button id="helpClose" class="primary large">전장으로 돌아가기</button>');
 $("helpClose").addEventListener("click",closeUtility);
}
function showReset(){
 pauseForUtility();
 const active=state.phase==="combat"||state.phase==="prepare";
 if(!active){showIntro();return;}
 modalSet('<div class="modal-eyebrow">NEW OPERATION</div><h2>작전을 초기화할까요?</h2>'+
 '<p class="modal-lead">현재 진행 중인 웨이브와 포탑은 초기화됩니다.<br>최고 기록은 유지됩니다.</p>'+
 '<div class="confirm-row"><button id="resetCancel" class="ghost large">계속 플레이</button><button id="resetConfirm" class="danger-btn large">새 작전 시작</button></div>');
 $("resetCancel").addEventListener("click",closeUtility);
 $("resetConfirm").addEventListener("click",showIntro);
}
function renderBackground(){
 ctx.fillStyle="#0a1424";ctx.fillRect(0,0,WIDTH,HEIGHT);
 const grad=ctx.createRadialGradient(500,280,60,500,280,640);
 grad.addColorStop(0,"rgba(37,65,85,.30)");grad.addColorStop(1,"rgba(8,12,30,0)");
 ctx.fillStyle=grad;ctx.fillRect(0,0,WIDTH,HEIGHT);
 for(const s of stars){ctx.fillStyle="rgba(105,160,175,"+(s.r===2?.15:.075)+")";ctx.fillRect(s.x,s.y,s.r,s.r);}
 ctx.strokeStyle="rgba(112,170,180,.085)";ctx.lineWidth=1;
 ctx.beginPath();
 for(let x=0;x<=WIDTH;x+=CELL){ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,HEIGHT);}
 for(let y=0;y<=HEIGHT;y+=CELL){ctx.moveTo(0,y+.5);ctx.lineTo(WIDTH,y+.5);}
 ctx.stroke();
 ctx.strokeStyle="rgba(110,218,203,.18)";ctx.lineWidth=2;
 for(let i=0;i<4;i++){
  let x=i%2?WIDTH-17:17,y=i<2?17:HEIGHT-17;
  ctx.beginPath();ctx.moveTo(x+(i%2?-15:15),y);ctx.lineTo(x,y);ctx.lineTo(x,y+(i<2?15:-15));ctx.stroke();
 }
}
function renderPaths(){
 ROUTES.forEach((route,lane)=>{
  const pts=route.map(p=>gridToPixel(p[0],p[1]));
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.strokeStyle="rgba(30,50,70,.95)";ctx.lineWidth=46;ctx.lineJoin="round";ctx.lineCap="round";ctx.stroke();
  ctx.strokeStyle=lane===0?"rgba(106,224,213,.30)":"rgba(187,137,255,.30)";
  ctx.lineWidth=40;ctx.stroke();
  ctx.strokeStyle="#1b3043";ctx.lineWidth=31;ctx.stroke();
  ctx.save();ctx.setLineDash([8,19]);ctx.lineDashOffset=-frame*.9;ctx.strokeStyle=lane===0?"rgba(105,250,220,.53)":"rgba(205,163,255,.52)";ctx.lineWidth=2;ctx.stroke();ctx.restore();
 });
 for(const [gx,gy] of RUINS){
  const p=gridToPixel(gx,gy);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate((gx+gy)*.53);
  ctx.fillStyle="#162637";ctx.strokeStyle="#294054";ctx.lineWidth=2;
  ctx.fillRect(-17,-12,34,24);ctx.strokeRect(-17,-12,34,24);
  ctx.strokeStyle="rgba(215,159,106,.3)";ctx.beginPath();ctx.moveTo(-9,-7);ctx.lineTo(8,7);ctx.moveTo(4,-8);ctx.lineTo(4,4);ctx.stroke();
  ctx.restore();
 }
 const portals=[gridToPixel(0,2),gridToPixel(0,9)];
 for(let i=0;i<2;i++){
  const p=portals[i],color=i?"#c293ff":"#69e9d1";
  ctx.save();ctx.translate(p.x-13,p.y);
  ctx.shadowColor=color;ctx.shadowBlur=18;ctx.strokeStyle=color;ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(0,0,13,21,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=.36+.20*Math.sin(frame*.035+i);ctx.fillStyle=color;
  ctx.beginPath();ctx.ellipse(0,0,5,15,0,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 const core=gridToPixel(18,5);
 ctx.save();ctx.translate(core.x,core.y);
 ctx.shadowColor="#72ffdc";ctx.shadowBlur=25;
 ctx.strokeStyle="rgba(104,246,204,.55)";ctx.lineWidth=3;
 for(let r=29;r<=46;r+=17){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();}
 ctx.rotate(frame*.007);
 ctx.fillStyle="#65f6d6";ctx.beginPath();ctx.moveTo(0,-25);ctx.lineTo(19,0);ctx.lineTo(0,25);ctx.lineTo(-19,0);ctx.closePath();ctx.fill();
 ctx.fillStyle="#0e2d3a";ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();
 ctx.restore();
 ctx.font="bold 12px system-ui";ctx.textAlign="left";ctx.fillStyle="#94c5cf";
 ctx.fillText("NORTH / A",21,56);ctx.fillText("SOUTH / B",21,545);
 ctx.textAlign="right";ctx.fillStyle="#8ee9d1";ctx.fillText("CORE // 01",968,214);
 if(state.overdrive>0){
  ctx.strokeStyle="rgba(100,255,211,"+(.13+.08*Math.sin(frame*.1))+")";ctx.lineWidth=4;
  ctx.strokeRect(5,5,WIDTH-10,HEIGHT-10);
 }
 if(state.flash>0){ctx.fillStyle="rgba(255,87,119,"+state.flash*.22+")";ctx.fillRect(0,0,WIDTH,HEIGHT);}
}
function drawTower(t,ghost=false){
 const cfg=TOWERS[t.type];
 ctx.save();ctx.translate(t.x,t.y);ctx.globalAlpha=ghost?.52:1;
 ctx.shadowBlur=ghost?0:16;ctx.shadowColor=cfg.color;
 ctx.fillStyle="#0c1d30";ctx.strokeStyle=cfg.color;ctx.lineWidth=2;
 ctx.beginPath();for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2+Math.PI/6;const x=Math.cos(a)*21,y=Math.sin(a)*21;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
 ctx.shadowBlur=0;ctx.fillStyle="#1a3244";ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.rotate(t.angle);
 ctx.fillStyle=cfg.color;
 if(t.type==="pulse"){ctx.fillRect(4,-5,25,10);ctx.fillStyle="#f1fffc";ctx.fillRect(23,-3,7,6);}
 else if(t.type==="frost"){ctx.fillRect(6,-8,18,16);ctx.strokeStyle="#dcf6ff";ctx.strokeRect(11,-9,15,18);}
 else if(t.type==="rail"){ctx.fillRect(4,-5,33,9);ctx.fillStyle="#ffedc6";ctx.fillRect(19,-3,22,4);}
 else{ctx.fillRect(4,-7,17,14);ctx.strokeStyle=cfg.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(25,0,10,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
 ctx.fillStyle=cfg.color;ctx.beginPath();ctx.arc(0,0,t.flash>0?8:5,0,Math.PI*2);ctx.fill();
 if(!ghost&&t.level>1){
  ctx.font="bold 10px system-ui";ctx.textAlign="center";ctx.shadowBlur=0;
  ctx.fillStyle="#0a1523";ctx.fillRect(-11,17,22,14);
  ctx.fillStyle="#fff";ctx.fillText("L"+t.level,0,28);
 }
 ctx.restore();
}
function renderTowers(){
 ctx.save();ctx.setLineDash([5,6]);ctx.lineWidth=1.5;
 for(let i=0;i<state.towers.length;i++)for(let j=i+1;j<state.towers.length;j++){
  const a=state.towers[i],b=state.towers[j];
  if(a.type===b.type||Math.hypot(a.x-b.x,a.y-b.y)>115)continue;
  ctx.strokeStyle="rgba(118,255,217,.38)";ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 ctx.restore();
 for(const t of state.towers)drawTower(t);
 if(selectedTower&&!movingTower){
  ctx.strokeStyle="rgba(122,255,220,.26)";ctx.fillStyle="rgba(100,240,210,.06)";ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(selectedTower.x,selectedTower.y,effectiveRange(selectedTower),0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle="#a6ffe6";ctx.lineWidth=2;ctx.strokeRect(selectedTower.x-25,selectedTower.y-25,50,50);
 }
 if(movingTower&&hover){
  const valid=canBuild(hover.gx,hover.gy,state.towers)&&state.credits>=35;
  const p=gridToPixel(hover.gx,hover.gy);
  ctx.strokeStyle=valid?"rgba(125,255,220,.52)":"rgba(255,100,130,.65)";
  ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,effectiveRange(movingTower),0,Math.PI*2);ctx.stroke();
  ctx.strokeRect(hover.gx*CELL+2,hover.gy*CELL+2,CELL-4,CELL-4);
  drawTower({...movingTower,x:p.x,y:p.y},true);
 }
 if(hover&&selectedKind){
  const gx=hover.gx,gy=hover.gy,valid=canBuild(gx,gy,state.towers),cfg=TOWERS[selectedKind];
  const p=gridToPixel(gx,gy),afford=state.credits>=cfg.cost;
  ctx.fillStyle=valid&&afford?"rgba(104,244,214,.16)":"rgba(255,100,127,.22)";
  ctx.fillRect(gx*CELL,gy*CELL,CELL,CELL);
  ctx.strokeStyle=valid&&afford?"#77ffdd":"#ff6984";ctx.strokeRect(gx*CELL+1,gy*CELL+1,CELL-2,CELL-2);
  ctx.strokeStyle=valid&&afford?"rgba(107,245,219,.43)":"rgba(255,104,127,.37)";
  ctx.beginPath();ctx.arc(p.x,p.y,cfg.range*state.boosts.range,0,Math.PI*2);ctx.stroke();
  drawTower({type:selectedKind,x:p.x,y:p.y,level:1,angle:-Math.PI/2,flash:0},true);
 }
}
function renderEnemies(){
 for(const e of state.enemies){
  if(e.dead)continue;
  const base=ENEMIES[e.kind],r=base.size*(e.mini?.7:1);
  ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);
  ctx.shadowColor=base.color;ctx.shadowBlur=e.kind==="boss"?23:10;
  ctx.fillStyle="#172334";ctx.strokeStyle=base.color;ctx.lineWidth=e.kind==="boss"?4:2;
  ctx.beginPath();
  if(e.kind==="dash"){ctx.moveTo(r+4,0);ctx.lineTo(-r,-r*.85);ctx.lineTo(-r*.65,0);ctx.lineTo(-r,r*.85);}
  else if(e.kind==="tank"){ctx.rect(-r,-r*.72,r*2,r*1.44);}
  else if(e.kind==="boss"){for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.lineTo(Math.cos(a)*(i%2?r:r*.76),Math.sin(a)*(i%2?r:r*.76));}}
  else{for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}}
  ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle=base.color;ctx.fillRect(-r*.34,-r*.27,r*.68,r*.54);
  if(e.slow>0){ctx.strokeStyle="#8fcaff";ctx.beginPath();ctx.arc(0,0,r+5,0,Math.PI*2);ctx.stroke();}
  if(e.shield>0){ctx.strokeStyle="rgba(112,184,255,.93)";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,r+6,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
  const w=Math.max(27,r*2.2),top=e.y-r-17;
  ctx.fillStyle="rgba(3,12,22,.89)";ctx.fillRect(e.x-w/2,top,w,4);
  ctx.fillStyle=e.hp/e.maxHp<.30?"#fb7493":"#7af2ca";ctx.fillRect(e.x-w/2,top,w*Math.max(0,e.hp/e.maxHp),4);
  if(e.kind==="boss"){
   ctx.textAlign="center";ctx.font="bold 11px system-ui";ctx.fillStyle="#ffc3fb";ctx.fillText("VOID LORD",e.x,e.y-r-24);
  }
 }
}
function renderAttacks(dt){
 for(const p of shots){
  ctx.shadowColor=p.color;ctx.shadowBlur=15;ctx.fillStyle=p.color;
  ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
 }
 ctx.shadowBlur=0;
 for(const b of beams){
  ctx.globalAlpha=Math.max(0,b.life/b.max);
  if(b.ring){
   ctx.beginPath();ctx.strokeStyle=b.color;ctx.lineWidth=b.width;ctx.arc(b.points[0].x,b.points[0].y,(1-b.life/b.max)*65,0,Math.PI*2);ctx.stroke();
  }else{
   ctx.strokeStyle=b.color;ctx.lineWidth=b.width;ctx.shadowColor=b.color;ctx.shadowBlur=14;
   ctx.beginPath();b.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.shadowBlur=0;
   ctx.strokeStyle="#ffffff";ctx.lineWidth=1;ctx.stroke();
  }
  ctx.globalAlpha=1;
 }
 for(const p of particles){
  ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;
  ctx.fillRect(p.x-p.r/2,p.y-p.r/2,p.r,p.r);
 }
 ctx.globalAlpha=1;
 for(const f of floats){
  ctx.globalAlpha=Math.max(0,f.life/.85);ctx.fillStyle=f.color;ctx.textAlign="center";
  ctx.font="bold 13px system-ui";ctx.fillText(f.text,f.x,f.y);
 }
 ctx.globalAlpha=1;
}
function updateEffects(dt){
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
 for(let i=beams.length-1;i>=0;i--){beams[i].life-=dt;if(beams[i].life<=0)beams.splice(i,1);}
 for(let i=floats.length-1;i>=0;i--){floats[i].life-=dt;floats[i].y-=21*dt;if(floats[i].life<=0)floats.splice(i,1);}
}
function render(){
 if(!state)return;
 if(visual){visual.update(state,{shots,beams,particles,floats},frame,hover,selectedKind,selectedTower,movingTower,effectiveRange);return;}
 const shake=state.shake>0?Math.min(8,state.shake):0;
 ctx.save();ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
 renderBackground();renderPaths();renderTowers();renderEnemies();renderAttacks();
 ctx.restore();
 if(state.paused){
  ctx.fillStyle="rgba(5,12,25,.57)";ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle="#ffffff";ctx.font="bold 36px system-ui";ctx.textAlign="center";ctx.fillText("PAUSED",WIDTH/2,HEIGHT/2);
  ctx.font="15px system-ui";ctx.fillStyle="#a9c5d1";ctx.fillText("일시정지 버튼 또는 P 키로 재개",WIDTH/2,HEIGHT/2+35);
 }
}
function loop(now){
 const dt=Math.min(.048,(now-last)/1000||0);last=now;frame++;
 if(state&&state.phase==="combat"&&!state.paused)updateCombat(dt*state.speed);
 if(state){state.shake=Math.max(0,state.shake-dt*29);state.flash=Math.max(0,state.flash-dt);updateEffects(dt);render();}
 uiTimer+=dt;
 if(uiTimer>.12){updateUI();uiTimer=0;}
 requestAnimationFrame(loop);
}
try{visual=createBattle3D(canvas);}catch(err){console.warn("3D renderer unavailable; using 2D fallback",err);visual=null;}
showIntro();
requestAnimationFrame(loop);
