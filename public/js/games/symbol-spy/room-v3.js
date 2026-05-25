import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../../router.js';
import { toast } from '../../components/toast.js';
import { ensureGameGuestAuth } from '../../game-guest-access.js';
import { buildGameInviteUrl, gamePlayerName, isRoomHost, makeRoomCode } from '../common.js';

const SYMBOLS = ['🐰','🦊','🐻','🐼','🐸','🐵','🦁','🐯','🐨','🐧','🐳','🦄','🍒','🍋','🍉','🍇','🥝','🌽','🍕','🍩','🍭','⚽','🎲','🎧','🚀','💎','🔥','⭐','🌙','☂️','🧩','🎯','🪐','🔔','🛸','🧃'];
const AIS = ['AI 번개','AI 눈썰미','AI 스파크','AI 흔들기'];
let unsubRoom = null;
let unsubPlayers = null;
let tick = null;
let room = null;
let players = [];

function esc(v){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function page(){return document.getElementById('page-content');}
function me(){return players.find(p=>p.uid===auth.currentUser?.uid)||null;}
function sh(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
function take(a,n){return sh(a).slice(0,n);}
function left(){const end=Number(room?.roundData?.endsAtMs||0);return end?Math.max(0,Math.ceil((end-Date.now())/1000)):0;}
function style(){
  ['/css/symbol-spy-room-sync.css','/css/symbol-spy-theme-polish.css'].forEach(href=>{
    if(document.querySelector(`link[href="${href}"]`))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
  });
}
function isSpy(uid){return room?.roundData?.spyId===uid;}
function spyName(){const s=suspects().find(x=>x.id===(room?.roundData?.spyId||'ai-spy'));return s?.name||'AI 스파이';}

function player(role='player'){
  return {uid:auth.currentUser.uid,name:gamePlayerName(),role,ready:role==='host',score:0,joinedAt:serverTimestamp(),updatedAt:serverTimestamp()};
}

function roundData(roundNo){
  const common=take(SYMBOLS,1)[0];
  const rest=SYMBOLS.filter(s=>s!==common);
  const centerExtra=take(rest,7);
  const center=sh([common,...centerExtra]);
  const decoy=take(centerExtra,1)[0] || centerExtra[0];
  const spyPool=players.length >= 2 ? ['ai-spy',...players.map(p=>p.uid)] : ['ai-spy'];
  const spyId=take(spyPool,1)[0] || 'ai-spy';
  const boards={};

  players.forEach(p=>{
    const normalPool=rest.filter(s=>!centerExtra.includes(s));
    if(p.uid===spyId){
      const spyPool=rest.filter(s=>s!==decoy && s!==common);
      boards[p.uid]=sh([decoy,...take(spyPool,7)]);
    }else{
      boards[p.uid]=sh([common,...take(normalPool.length>=7?normalPool:rest,7)]);
    }
  });

  const start=Date.now();
  return {
    round:roundNo,
    common,
    center,
    boards,
    spyId,
    spyDecoy:decoy,
    spyRule:'spy-gets-decoy-board',
    aiName:take(AIS,1)[0],
    aiPick:decoy,
    startedAtMs:start,
    endsAtMs:start+Number(room?.roundSeconds||14)*1000
  };
}

function suspicionFor(id,pick,correct){
  const spyId=room?.roundData?.spyId;
  const decoy=room?.roundData?.spyDecoy;
  if(id===spyId && id==='ai-spy') return {risk:'진짜 단서', clue:`AI 스파이는 정답 대신 가짜 공통심볼 ${decoy}를 고른 기록이 있습니다.`, note:'이번 라운드의 AI가 실제 스파이일 수 있습니다.'};
  if(id===spyId) return {risk:'진짜 단서', clue:`이 참가자는 정답이 없는 교란판을 받았습니다. 대신 가짜 공통심볼 ${decoy}가 보였을 가능성이 큽니다.`, note:'선택이 어색한 이유가 실제로 있습니다.'};
  if(pick===decoy && !correct) return {risk:'의심도 높음', clue:`가짜 공통심볼 ${decoy}를 골랐습니다. 스파이가 받는 교란판의 흔적일 수 있습니다.`, note:'다만 일반 참가자의 실수일 수도 있습니다.'};
  if(!pick || pick==='미선택') return {risk:'의심도 중간', clue:'정답을 못 찾았거나 일부러 고르지 않았을 수 있습니다.', note:'시간 종료 전 행동을 의심해볼 수 있습니다.'};
  if(correct) return {risk:'의심도 낮음', clue:'정답 심볼을 골랐습니다. 보통은 일반 참가자일 가능성이 높습니다.', note:'스파이는 보통 정답이 자기 판에 없습니다.'};
  return {risk:'의심도 높음', clue:'정답이 아닌 심볼을 골랐습니다. 교란판을 받았거나 헷갈렸을 수 있습니다.', note:'오답은 스파이 후보를 좁히는 핵심 단서입니다.'};
}

export async function createSymbolSpyRoom(){
  await ensureGameGuestAuth();
  if(!auth.currentUser)throw new Error('게임 접속 정보를 확인하지 못했어요.');
  const data={game:'symbol-spy',title:'심볼스파이',status:'waiting',phase:'lobby',code:makeRoomCode(),hostId:auth.currentUser.uid,hostName:gamePlayerName('방장'),maxPlayers:6,round:0,roundLimit:5,roundSeconds:14,log:'초대 링크를 공유하고 참가자를 모아주세요.',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  const ref=await addDoc(collection(db,'game_rooms'),data);
  await setDoc(doc(db,'game_rooms',ref.id,'players',auth.currentUser.uid),player('host'));
  return ref.id;
}

export async function joinSymbolSpyRoom(r){
  await ensureGameGuestAuth();
  if(!auth.currentUser)throw new Error('게임 접속 정보를 확인하지 못했어요.');
  if(!r||r.game!=='symbol-spy')throw new Error('심볼스파이 방이 아닙니다.');
  if(!me()&&players.length>=Number(r.maxPlayers||6))throw new Error('방이 가득 찼어요.');
  await setDoc(doc(db,'game_rooms',r.id,'players',auth.currentUser.uid),player(auth.currentUser.uid===r.hostId?'host':'player'),{merge:true});
}

export function destroySymbolSpyRoom(){
  if(unsubRoom)unsubRoom(); if(unsubPlayers)unsubPlayers(); if(tick)clearInterval(tick);
  unsubRoom=null;unsubPlayers=null;tick=null;room=null;players=[];
}

export async function renderSymbolSpyRoom(id){
  destroySymbolSpyRoom();style();await ensureGameGuestAuth();
  const el=page(); if(!el)return;
  el.innerHTML='<section class="symbol-spy"><div class="loading-center"><div class="spinner spinner--lg"></div></div></section>';
  const ref=doc(db,'game_rooms',id);
  const snap=await getDoc(ref).catch(()=>null);
  if(!snap?.exists()){el.innerHTML='<section class="symbol-spy"><div class="symbol-room-empty"><div>😢</div><h1>방을 찾을 수 없어요</h1><button class="symbol-spy__start" onclick="location.hash=\'/game/symbol-spy\'">심볼스파이로</button></div></section>';return;}
  const first={id:snap.id,...snap.data()};
  if(first.game!=='symbol-spy'){el.innerHTML=`<section class="symbol-spy"><div class="symbol-room-empty"><div>⚠️</div><h1>심볼스파이 방이 아닙니다</h1><p>${esc(first.game)}</p></div></section>`;return;}
  unsubRoom=onSnapshot(ref,s=>{if(!s.exists())return;room={id:s.id,...s.data()};draw();});
  unsubPlayers=onSnapshot(query(collection(db,'game_rooms',id,'players'),orderBy('joinedAt','asc')),s=>{players=s.docs.map(d=>({id:d.id,...d.data()}));draw();});
  tick=setInterval(()=>{if(room?.phase==='playing'){const t=document.querySelector('[data-room-timer]');if(t)t.textContent=String(left());}},500);
}

function top(){return `<header class="symbol-spy__topbar"><button class="symbol-spy__ghost" type="button" data-back>← 심볼스파이</button><div class="symbol-spy__brand"><span>⚡</span><b>${esc(room?.title||'심볼스파이')}</b><small>방 코드 ${esc(room?.code||'')}</small></div><div class="symbol-spy__score"><span>${players.length}/${Number(room?.maxPlayers||6)}명</span><span>${esc(room?.phase||'lobby')}</span></div></header>`;}
function playerState(p){if(room?.phase==='vote')return p.spyVote?'투표 완료':'투표 대기';if(room?.phase==='result')return p.spyVoteCorrect?'스파이 적중':(p.spyVote?'투표 실패':'미투표');if(p.selectedSymbol)return `${p.selectedSymbol} ${p.selectedCorrect?'정답':'오답'} · ${Number(p.score||0)}점`;return p.ready?'준비 완료':'대기 중';}
function panel(h='참가자 상태가 실시간으로 표시됩니다.'){return `<article class="symbol-room__players"><h2>참가자</h2><div class="symbol-room__player-list">${players.map(p=>`<div class="symbol-room__player"><span>${p.uid===room.hostId?'👑':'⚡'}</span><b>${esc(p.name||'게스트')}</b><small>${esc(playerState(p))}</small></div>`).join('')||'<div class="symbol-room__none">아직 참가자가 없습니다.</div>'}</div><div class="symbol-room__hint">${esc(h)}</div></article>`;}
function draw(){const el=page();if(!el||!room)return;el.innerHTML=room.phase==='playing'?playHTML():room.phase==='vote'?voteHTML():room.phase==='result'?resultHTML():lobbyHTML();bind();}

function lobbyHTML(){
  const joined=!!me(),host=isRoomHost(room),url=buildGameInviteUrl('symbol-spy',room.id);
  return `<section class="symbol-spy symbol-spy--room">${top()}<div class="symbol-room"><article class="symbol-room__hero"><div class="symbol-vote__badge">친구 초대 대기방</div><h1>같이 할 참가자를 모으세요</h1><p>${esc(room.log||'초대 링크를 공유하고 참가자를 모아주세요.')}</p><div class="symbol-spy-explain"><span>1. 일반 참가자는 진짜 정답 심볼이 들어간 판을 받습니다.</span><span>2. 스파이는 정답 대신 가짜 공통심볼이 들어간 교란판을 받습니다.</span><span>3. 라운드 후 누가 교란판을 받은 사람인지 맞히면 보너스 점수.</span></div><div class="symbol-room__invite"><input class="form-input" readonly value="${esc(url)}"><button class="symbol-spy__start" type="button" data-copy>초대 링크 복사</button></div><div class="symbol-room__actions">${joined?'<button class="symbol-spy__ghost" type="button" data-ready>준비 상태 변경</button>':'<button class="symbol-spy__start" type="button" data-join>방 참가하기</button>'}${host?'<button class="symbol-spy__start" type="button" data-start>실시간 라운드 시작</button>':''}</div></article>${panel('스파이는 그냥 랜덤 정답이 아니라, 실제로 다른 심볼판을 받는 사람입니다.')}</div></section>`;
}

function tile(s,dis=false){return `<button class="symbol-tile" type="button" data-symbol="${esc(s)}" ${dis?'disabled':''}><span>${s}</span></button>`;}
function playHTML(){
  const r=room.roundData||{},p=me(),b=p?(r.boards?.[p.uid]||[]):[],sel=!!p?.selectedSymbol,host=isRoomHost(room),mineIsSpy=p&&isSpy(p.uid);
  const playHint=mineIsSpy?'내 판에는 진짜 정답이 없을 수도 있습니다. 가장 그럴듯한 공통심볼을 고르세요.':sel?`내 선택: ${p.selectedSymbol} · ${p.selectedCorrect?'정답':'오답'}`:'중앙판과 내 판에 동시에 있는 심볼을 누르세요.';
  return `<section class="symbol-spy symbol-spy--room symbol-spy--room-play">${top()}<div class="symbol-room-round"><div class="symbol-spy__playhead"><div><b>ROUND ${Number(room.round||1)}/${Number(room.roundLimit||5)}</b><span>${playHint}</span></div><div class="symbol-spy__timer" data-room-timer>${left()}</div></div><div class="symbol-spy__arena"><article class="symbol-board symbol-board--center"><div class="symbol-board__title">공유 중앙판</div><div class="symbol-board__grid">${(r.center||[]).map(s=>tile(s,true)).join('')}</div></article><div class="symbol-spy__versus"><span>일반판 vs 교란판</span><b>SPY</b><small>스파이는 다른 판을 받음</small></div><article class="symbol-board symbol-board--player"><div class="symbol-board__title">내 탐색판${mineIsSpy?' · 교란판':''}</div><div class="symbol-board__grid">${b.length?b.map(s=>tile(s,sel||left()<=0)).join(''):'<div class="symbol-room__none">방 참가 후 플레이할 수 있어요.</div>'}</div></article></div><div class="symbol-room-round__actions">${!p?'<button class="symbol-spy__start" type="button" data-join>방 참가하기</button>':''}${host?'<button class="symbol-spy__start" type="button" data-vote>스파이 투표로</button><button class="symbol-spy__ghost" type="button" data-start>라운드 재시작</button>':''}</div>${panel('스파이는 진짜 정답이 없는 교란판을 받습니다. 그래서 선택 기록이 실제 단서가 됩니다.')}</div></section>`;
}

function suspects(){
  const r=room.roundData||{};
  const ai=suspicionFor('ai-spy',r.aiPick,false);
  return [{id:'ai-spy',avatar:'🤖',name:r.aiName||'AI 스파크',pick:r.aiPick||'❓',...ai},...players.map(p=>{const pick=p.selectedSymbol||'미선택';return {id:p.uid,avatar:p.uid===room.hostId?'👑':'⚡',name:p.name||'게스트',pick,...suspicionFor(p.uid,pick,!!p.selectedCorrect)};})];
}

function voteHTML(){
  const p=me(),v=!!p?.spyVote,host=isRoomHost(room),r=room.roundData||{};
  return `<section class="symbol-spy symbol-spy--room symbol-spy--room-vote">${top()}<div class="symbol-room-vote"><article class="symbol-room__hero"><div class="symbol-vote__badge">ROUND ${Number(room.round||1)} · 교란판 찾기</div><h1>누가 다른 판을 받았을까?</h1><p>진짜 정답은 <b>${r.common}</b> 입니다. 스파이는 정답 대신 <b>가짜 공통심볼 ${r.spyDecoy}</b>가 들어간 교란판을 받았습니다.</p><div class="symbol-spy-explain"><span>정답 선택: 일반판일 가능성 높음</span><span>가짜 공통심볼/오답 선택: 교란판 가능성 높음</span><span>스파이를 맞히면 +80점, 못 맞히면 보너스 없음</span></div><div class="symbol-vote__grid symbol-room-vote__grid">${suspects().map(s=>`<button class="symbol-suspect" type="button" data-suspect="${esc(s.id)}" ${v?'disabled':''}><span class="symbol-suspect__avatar">${s.avatar}</span><strong>${esc(s.name)}</strong><em>선택 ${esc(s.pick)}</em><span class="symbol-suspect__risk">${esc(s.risk)}</span><small class="symbol-suspect__clue">${esc(s.clue)}</small><small>${esc(s.note)}</small></button>`).join('')}</div><div class="symbol-room__actions">${v?'<button class="symbol-spy__ghost" type="button" disabled>투표 완료</button>':''}${host?'<button class="symbol-spy__start" type="button" data-result>결과 공개</button>':''}</div></article>${panel('이제 스파이 찾기는 랜덤 추측이 아니라, 누가 교란판을 받았는지 맞히는 단계입니다.')}</div></section>`;
}

function resultHTML(){
  const r=room.roundData||{},spy=suspects().find(s=>s.id===(r.spyId||'ai-spy'))||suspects()[0],host=isRoomHost(room),final=Number(room.round||1)>=Number(room.roundLimit||5),rank=[...players].sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  return `<section class="symbol-spy symbol-spy--room symbol-spy--room-result">${top()}<div class="symbol-room-result"><article class="symbol-room__hero"><div class="symbol-result__badge">ROUND ${Number(room.round||1)} 결과</div><h1>교란판 공개</h1><p>진짜 정답은 <b>${r.common}</b>, 가짜 공통심볼은 <b>${r.spyDecoy}</b>, 교란판을 받은 스파이는 <b>${esc(spy.name)}</b> 입니다.</p><div class="symbol-result__spy"><span>이번 라운드 스파이</span><b>${spy.avatar} ${esc(spy.name)}</b><small>선택 ${esc(spy.pick)} · ${esc(spy.clue||spy.note)}</small></div><div class="symbol-room-rank">${rank.map((p,i)=>`<div><b>${i+1}. ${esc(p.name||'게스트')}</b><span>${Number(p.score||0)}점 · ${p.spyVoteCorrect?'스파이 적중':'투표 실패/미투표'}</span></div>`).join('')}</div><div class="symbol-room__actions">${host?`<button class="symbol-spy__start" type="button" data-start>${final?'새 게임 시작':'다음 라운드'}</button><button class="symbol-spy__ghost" type="button" data-lobby>대기방으로</button>`:''}</div></article>${panel('스파이 찾기는 “누가 진짜 정답이 없는 판을 받았는지”를 맞히는 게임입니다.')}</div></section>`;
}

function bind(){
  document.querySelector('[data-back]')?.addEventListener('click',()=>navigate('/game/symbol-spy'));
  document.querySelector('[data-copy]')?.addEventListener('click',copy);
  document.querySelector('[data-join]')?.addEventListener('click',async()=>{try{await joinSymbolSpyRoom(room);toast.success('방에 참가했어요');}catch(e){toast.warn(e.message||'참가에 실패했어요');}});
  document.querySelector('[data-ready]')?.addEventListener('click',ready);
  document.querySelector('[data-start]')?.addEventListener('click',start);
  document.querySelector('[data-vote]')?.addEventListener('click',()=>phase('vote','선택 기록을 보고 누가 교란판을 받았는지 지목하세요.'));
  document.querySelector('[data-result]')?.addEventListener('click',result);
  document.querySelector('[data-lobby]')?.addEventListener('click',()=>phase('lobby','초대 링크를 공유하고 참가자를 모아주세요.','waiting'));
  document.querySelectorAll('[data-symbol]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.symbol)));
  document.querySelectorAll('[data-suspect]').forEach(b=>b.addEventListener('click',()=>vote(b.dataset.suspect)));
}

async function copy(){const url=buildGameInviteUrl('symbol-spy',room.id);try{await navigator.clipboard.writeText(url);toast.success('초대 링크를 복사했어요');}catch{toast.error('복사에 실패했어요.');}}
async function ready(){const p=me();if(!p)return;await updateDoc(doc(db,'game_rooms',room.id,'players',auth.currentUser.uid),{ready:!p.ready,updatedAt:serverTimestamp()}).catch(e=>toast.warn(e.message||'준비 상태 변경 실패'));}
async function phase(ph,log,status='playing'){if(!isRoomHost(room))return;await updateDoc(doc(db,'game_rooms',room.id),{phase:ph,status,log,updatedAt:serverTimestamp()}).catch(e=>toast.error(e.message||'방 상태 변경 실패'));}
async function start(){
  if(!isRoomHost(room))return;if(players.length<1){toast.warn('참가자가 필요합니다.');return;}
  const cur=Number(room.round||0),lim=Number(room.roundLimit||5),next=room.phase==='result'&&cur>=lim?1:cur+1,data=roundData(next);
  try{await Promise.all(players.map(p=>setDoc(doc(db,'game_rooms',room.id,'players',p.uid),{selectedSymbol:'',selectedCorrect:false,selectedAtMs:0,spyVote:'',spyVoteCorrect:false,ready:true,score:next===1&&room.phase==='result'?0:Number(p.score||0),updatedAt:serverTimestamp()},{merge:true})));
  await updateDoc(doc(db,'game_rooms',room.id),{status:'playing',phase:'playing',round:next,roundData:data,log:`ROUND ${next} 진행 중. 같은 심볼을 찾으세요!`,updatedAt:serverTimestamp()});}catch(e){toast.error(e.message||'라운드 시작 실패');}
}
async function select(sym){
  const p=me();if(!p||!room?.roundData||p.selectedSymbol)return;if(left()<=0){toast.warn('시간이 종료됐어요.');return;}
  const ok=sym===room.roundData.common,spyMe=isSpy(auth.currentUser.uid),add=ok?100+left()*5:(spyMe?0:-15);
  try{await updateDoc(doc(db,'game_rooms',room.id,'players',auth.currentUser.uid),{selectedSymbol:sym,selectedCorrect:ok,selectedAtMs:Date.now(),score:Math.max(0,Number(p.score||0)+add),updatedAt:serverTimestamp()});toast[ok?'success':'warn'](ok?'정답입니다!':(spyMe?'교란판이었습니다. 들키지 않게 투표를 피하세요.':'오답입니다.'));}catch(e){toast.error(e.message||'선택 저장 실패');}
}
async function vote(id){const p=me();if(!p||p.spyVote)return;await updateDoc(doc(db,'game_rooms',room.id,'players',auth.currentUser.uid),{spyVote:id,spyVotedAtMs:Date.now(),updatedAt:serverTimestamp()}).then(()=>toast.success('스파이 투표를 저장했어요')).catch(e=>toast.error(e.message||'투표 저장 실패'));}
async function result(){
  if(!isRoomHost(room))return;const spy=room.roundData?.spyId||'ai-spy';
  try{await Promise.all(players.map(p=>{const ok=p.spyVote===spy,spyEscaped=p.uid===spy&&!players.some(v=>v.spyVote===spy);return setDoc(doc(db,'game_rooms',room.id,'players',p.uid),{spyVoteCorrect:ok,score:Number(p.score||0)+(ok?80:0)+(spyEscaped?80:0),updatedAt:serverTimestamp()},{merge:true});}));await phase('result','라운드 결과가 공개되었습니다.');}catch(e){toast.error(e.message||'결과 공개 실패');}
}
