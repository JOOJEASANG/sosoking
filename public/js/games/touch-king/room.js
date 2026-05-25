import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../../router.js';
import { toast } from '../../components/toast.js';
import { ensureGameGuestAuth } from '../../game-guest-access.js';
import { buildGameInviteUrl, gamePlayerName, isRoomHost, makeRoomCode } from '../common.js';

const SYMBOLS = ['🐰','🦊','🐻','🐼','🐸','🐵','🦁','🐯','🐨','🐧','🐳','🦄','🍒','🍋','🍉','🍇','🥝','🌽','🍕','🍩','🍭','⚽','🎲','🎧','🚀','💎','🔥','⭐','🌙','☂️','🧩','🎯','🪐','🔔','🛸','🧃','🍔','🍟','🌈','🎮','🎁','🦖','🐙','🍀','🍎','🥨','🏀','🎸'];
const BOARD_SIZE = 12;
const EXTRA_COUNT = BOARD_SIZE - 1;
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
function elapsedMs(){const start=Number(room?.roundData?.startedAtMs||0);return start?Math.max(0,Date.now()-start):0;}
function loadStyleOnce(href){if(document.querySelector(`link[href="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);}
function style(){['/css/touch-king-game.css','/css/touch-king-theme.css','/css/touch-king-room.css','/css/touch-king-polish.css'].forEach(loadStyleOnce);}
function clampNumber(value, min, max, fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function player(role='player'){return {uid:auth.currentUser.uid,name:gamePlayerName(),role,ready:role==='host',score:0,correctCount:0,totalMs:0,joinedAt:serverTimestamp(),updatedAt:serverTimestamp()};}
function buildRound(roundNo){
  const common=take(SYMBOLS,1)[0];
  const rest=SYMBOLS.filter(s=>s!==common);
  const centerExtra=take(rest,EXTRA_COUNT);
  const center=sh([common,...centerExtra]);
  const boards={};
  players.forEach(p=>{
    const pool=rest.filter(s=>!centerExtra.includes(s));
    boards[p.uid]=sh([common,...take(pool.length>=EXTRA_COUNT?pool:rest,EXTRA_COUNT)]);
  });
  const start=Date.now();
  return {round:roundNo,common,center,boards,boardSize:BOARD_SIZE,startedAtMs:start,endsAtMs:start+Number(room?.roundSeconds||12)*1000};
}

export async function createTouchKingRoom(options={}){
  await ensureGameGuestAuth();
  if(!auth.currentUser)throw new Error('게임 접속 정보를 확인하지 못했어요.');
  const maxPlayers=clampNumber(options.maxPlayers,2,10,6);
  const roundLimit=clampNumber(options.roundLimit,3,20,5);
  const roundSeconds=clampNumber(options.roundSeconds,8,30,12);
  const data={game:'touch-king',title:'터치왕게임',status:'waiting',phase:'lobby',code:makeRoomCode(),hostId:auth.currentUser.uid,hostName:gamePlayerName('방장'),maxPlayers,round:0,roundLimit,roundSeconds,boardSize:BOARD_SIZE,log:'인원수와 판수를 정했습니다. 12개 그림 중 같은 그림을 가장 빨리 찾는 사람이 터치왕입니다.',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  const ref=await addDoc(collection(db,'game_rooms'),data);
  await setDoc(doc(db,'game_rooms',ref.id,'players',auth.currentUser.uid),player('host'));
  return ref.id;
}

export async function joinTouchKingRoom(r){
  await ensureGameGuestAuth();
  if(!auth.currentUser)throw new Error('게임 접속 정보를 확인하지 못했어요.');
  if(!r||r.game!=='touch-king')throw new Error('터치왕게임 방이 아닙니다.');
  if(!me()&&players.length>=Number(r.maxPlayers||6))throw new Error('방이 가득 찼어요.');
  await setDoc(doc(db,'game_rooms',r.id,'players',auth.currentUser.uid),player(auth.currentUser.uid===r.hostId?'host':'player'),{merge:true});
}

export function destroyTouchKingRoom(){
  if(unsubRoom)unsubRoom(); if(unsubPlayers)unsubPlayers(); if(tick)clearInterval(tick);
  unsubRoom=null;unsubPlayers=null;tick=null;room=null;players=[];
}

export async function renderTouchKingRoom(id){
  destroyTouchKingRoom();style();await ensureGameGuestAuth();
  const el=page();if(!el)return;
  el.innerHTML='<section class="symbol-spy"><div class="loading-center"><div class="spinner spinner--lg"></div></div></section>';
  const ref=doc(db,'game_rooms',id);
  const snap=await getDoc(ref).catch(()=>null);
  if(!snap?.exists()){el.innerHTML='<section class="symbol-spy"><div class="symbol-room-empty"><div>😢</div><h1>방을 찾을 수 없어요</h1><button class="symbol-spy__start" onclick="location.hash=\'/game/touch-king\'">터치왕게임으로</button></div></section>';return;}
  const first={id:snap.id,...snap.data()};
  if(first.game!=='touch-king'){
    el.innerHTML=`<section class="symbol-spy"><div class="symbol-room-empty"><div>⚠️</div><h1>터치왕게임 방이 아닙니다</h1><p>${esc(first.game||'알 수 없음')}</p><button class="symbol-spy__start" onclick="location.hash='/game/touch-king'">터치왕게임으로</button></div></section>`;
    return;
  }
  unsubRoom=onSnapshot(ref,s=>{if(!s.exists())return;room={id:s.id,...s.data()};draw();});
  unsubPlayers=onSnapshot(query(collection(db,'game_rooms',id,'players'),orderBy('joinedAt','asc')),s=>{players=s.docs.map(d=>({id:d.id,...d.data()}));draw();});
  tick=setInterval(()=>{if(room?.phase==='playing'){const t=document.querySelector('[data-room-timer]');if(t)t.textContent=String(left());}},400);
}

function top(){return `<header class="symbol-spy__topbar"><button class="symbol-spy__ghost" type="button" data-back>← 터치왕게임</button><div class="symbol-spy__brand"><span>👑</span><b>${esc(room?.title||'터치왕게임')}</b><small>방 코드 ${esc(room?.code||'')}</small></div><div class="symbol-spy__score"><span>${players.length}/${Number(room?.maxPlayers||6)}명</span><span>${Number(room?.round||0)}/${Number(room?.roundLimit||5)}판</span></div></header>`;}
function playerState(p){if(room?.phase==='result')return `${Number(p.score||0)}점 · ${Number(p.correctCount||0)}개`;if(p.selectedSymbol)return p.selectedCorrect?`정답 · ${(Number(p.responseMs||0)/1000).toFixed(1)}초`:'오답';return p.ready?'준비 완료':'대기 중';}
function rank(){return [...players].sort((a,b)=>Number(b.score||0)-Number(a.score||0)||Number(b.correctCount||0)-Number(a.correctCount||0)||Number(a.totalMs||999999)-Number(b.totalMs||999999));}
function panel(h='점수와 정답 수가 실시간으로 표시됩니다.'){return `<article class="symbol-room__players"><h2>순위표</h2><div class="symbol-room__player-list">${rank().map((p,i)=>`<div class="symbol-room__player"><span>${i===0?'👑':'⚡'}</span><b>${i+1}. ${esc(p.name||'게스트')}</b><small>${esc(playerState(p))}</small></div>`).join('')||'<div class="symbol-room__none">아직 참가자가 없습니다.</div>'}</div><div class="symbol-room__hint">${esc(h)}</div></article>`;}
function draw(){const el=page();if(!el||!room)return;el.innerHTML=room.phase==='playing'?playHTML():room.phase==='result'?resultHTML():lobbyHTML();bind();}
function lobbyHTML(){const joined=!!me(),host=isRoomHost(room),url=buildGameInviteUrl('touch-king',room.id);return `<section class="symbol-spy symbol-spy--room touch-king-game"><div class="touch-king-title">👑 터치왕게임</div>${top()}<div class="symbol-room"><article class="symbol-room__hero"><div class="symbol-vote__badge">12개 그림 빠른 터치 대결</div><h1>같은 그림을 가장 빨리 찾아라</h1><p>${esc(room.log||'초대 링크를 공유하고 참가자를 모아주세요.')}</p><div class="symbol-spy-explain"><span>1. 중앙판 12개와 내 판 12개를 봅니다.</span><span>2. 두 판에 동시에 있는 그림은 딱 1개입니다.</span><span>3. ${Number(room.roundLimit||5)}판 후 점수가 가장 높은 사람이 터치왕입니다.</span></div><div class="symbol-room__invite"><input class="form-input" readonly value="${esc(url)}"><button class="symbol-spy__start" type="button" data-copy>초대 링크 복사</button></div><div class="symbol-room__actions">${joined?'<button class="symbol-spy__ghost" type="button" data-ready>준비 상태 변경</button>':'<button class="symbol-spy__start" type="button" data-join>방 참가하기</button>'}${host?'<button class="symbol-spy__start" type="button" data-start>게임 시작</button>':''}</div></article>${panel(`설정: ${Number(room.maxPlayers||6)}명 · ${Number(room.roundLimit||5)}판 · 그림 ${BOARD_SIZE}개 · 라운드 ${Number(room.roundSeconds||12)}초`)}</div></section>`;}
function tile(s,dis=false){return `<button class="symbol-tile" type="button" data-symbol="${esc(s)}" ${dis?'disabled':''}><span>${s}</span></button>`;}
function playHTML(){const r=room.roundData||{},p=me(),b=p?(r.boards?.[p.uid]||[]):[],sel=!!p?.selectedSymbol,host=isRoomHost(room);const hint=sel?`내 선택: ${p.selectedSymbol} · ${p.selectedCorrect?'정답':'오답'}${p.responseMs?` · ${(Number(p.responseMs)/1000).toFixed(1)}초`:''}`:'12개 중 중앙판과 내 판에 동시에 있는 그림을 최대한 빨리 누르세요.';return `<section class="symbol-spy symbol-spy--room symbol-spy--room-play touch-king-game"><div class="touch-king-title">👑 터치왕게임</div>${top()}<div class="symbol-room-round"><div class="symbol-spy__playhead"><div><b>ROUND ${Number(room.round||1)}/${Number(room.roundLimit||5)}</b><span>${hint}</span></div><div class="symbol-spy__timer" data-room-timer>${left()}</div></div><div class="symbol-spy__arena"><article class="symbol-board symbol-board--center"><div class="symbol-board__title">중앙판 · 12개</div><div class="symbol-board__grid touch-king-grid">${(r.center||[]).map(s=>tile(s,true)).join('')}</div></article><div class="symbol-spy__versus"><span>같은 그림 1개</span><b>12</b><small>빠를수록 고득점</small></div><article class="symbol-board symbol-board--player"><div class="symbol-board__title">내 판 · 12개</div><div class="symbol-board__grid touch-king-grid">${b.length?b.map(s=>tile(s,sel||left()<=0)).join(''):'<div class="symbol-room__none">방 참가 후 플레이할 수 있어요.</div>'}</div></article></div><div class="symbol-room-round__actions">${!p?'<button class="symbol-spy__start" type="button" data-join>방 참가하기</button>':''}${host?'<button class="symbol-spy__start" type="button" data-result>라운드 결과</button><button class="symbol-spy__ghost" type="button" data-start>라운드 재시작</button>':''}</div>${panel('정답은 +100점, 빠른 보너스는 남은 시간 × 5점입니다. 오답은 -10점입니다.')}</div></section>`;}
function resultHTML(){const host=isRoomHost(room),final=Number(room.round||1)>=Number(room.roundLimit||5),r=room.roundData||{},sorted=rank();return `<section class="symbol-spy symbol-spy--room symbol-spy--room-result touch-king-game"><div class="touch-king-title">👑 터치왕게임</div>${top()}<div class="symbol-room-result"><article class="symbol-room__hero"><div class="symbol-result__badge">ROUND ${Number(room.round||1)} 결과</div><h1>${final?'최종 터치왕':'라운드 결과'}</h1><p>이번 정답은 <b>${r.common}</b> 입니다. ${final&&sorted[0]?`최종 우승자는 <b>${esc(sorted[0].name)}</b> 입니다.`:'다음 판에서 역전할 수 있습니다.'}</p><div class="symbol-room-rank">${sorted.map((p,i)=>`<div><b>${i+1}. ${esc(p.name||'게스트')}</b><span>${Number(p.score||0)}점 · 정답 ${Number(p.correctCount||0)}개 · 평균 ${Number(p.correctCount||0)?((Number(p.totalMs||0)/Number(p.correctCount||1))/1000).toFixed(1):'-'}초</span></div>`).join('')}</div><div class="symbol-room__actions">${host?`<button class="symbol-spy__start" type="button" data-start>${final?'새 게임 시작':'다음 라운드'}</button><button class="symbol-spy__ghost" type="button" data-lobby>대기방으로</button>`:''}</div></article>${panel(final?'최종 점수가 가장 높은 사람이 터치왕입니다.':'다음 라운드를 시작하세요.')}</div></section>`;}
function bind(){
  document.querySelector('[data-back]')?.addEventListener('click',()=>navigate('/game/touch-king'));
  document.querySelector('[data-copy]')?.addEventListener('click',copy);
  document.querySelector('[data-join]')?.addEventListener('click',async()=>{try{await joinTouchKingRoom(room);toast.success('방에 참가했어요');}catch(e){toast.warn(e.message||'참가에 실패했어요');}});
  document.querySelector('[data-ready]')?.addEventListener('click',ready);
  document.querySelector('[data-start]')?.addEventListener('click',start);
  document.querySelector('[data-result]')?.addEventListener('click',()=>phase('result','라운드 결과가 공개되었습니다.'));
  document.querySelector('[data-lobby]')?.addEventListener('click',()=>phase('lobby','초대 링크를 공유하고 참가자를 모아주세요.','waiting'));
  document.querySelectorAll('[data-symbol]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.symbol)));
}
async function copy(){const url=buildGameInviteUrl('touch-king',room.id);try{await navigator.clipboard.writeText(url);toast.success('초대 링크를 복사했어요');}catch{toast.error('복사에 실패했어요.');}}
async function ready(){const p=me();if(!p)return;await updateDoc(doc(db,'game_rooms',room.id,'players',auth.currentUser.uid),{ready:!p.ready,updatedAt:serverTimestamp()}).catch(e=>toast.warn(e.message||'준비 상태 변경 실패'));}
async function phase(ph,log,status='playing'){if(!isRoomHost(room))return;await updateDoc(doc(db,'game_rooms',room.id),{phase:ph,status,log,updatedAt:serverTimestamp()}).catch(e=>toast.error(e.message||'방 상태 변경 실패'));}
async function start(){
  if(!isRoomHost(room))return;if(players.length<1){toast.warn('참가자가 필요합니다.');return;}
  const cur=Number(room.round||0),lim=Number(room.roundLimit||5),next=room.phase==='result'&&cur>=lim?1:cur+1,data=buildRound(next);
  try{await Promise.all(players.map(p=>setDoc(doc(db,'game_rooms',room.id,'players',p.uid),{selectedSymbol:'',selectedCorrect:false,responseMs:0,ready:true,score:next===1&&room.phase==='result'?0:Number(p.score||0),correctCount:next===1&&room.phase==='result'?0:Number(p.correctCount||0),totalMs:next===1&&room.phase==='result'?0:Number(p.totalMs||0),updatedAt:serverTimestamp()},{merge:true})));
  await updateDoc(doc(db,'game_rooms',room.id),{status:'playing',phase:'playing',round:next,roundData:data,log:`ROUND ${next} 진행 중. 12개 중 같은 그림을 가장 빨리 찾으세요!`,updatedAt:serverTimestamp()});}catch(e){toast.error(e.message||'라운드 시작 실패');}
}
async function select(sym){
  const p=me();if(!p||!room?.roundData||p.selectedSymbol)return;if(left()<=0){toast.warn('시간이 종료됐어요.');return;}
  const ok=sym===room.roundData.common,ms=elapsedMs(),bonus=left()*5,add=ok?100+bonus:-10;
  try{await updateDoc(doc(db,'game_rooms',room.id,'players',auth.currentUser.uid),{selectedSymbol:sym,selectedCorrect:ok,responseMs:ms,score:Math.max(0,Number(p.score||0)+add),correctCount:Number(p.correctCount||0)+(ok?1:0),totalMs:Number(p.totalMs||0)+(ok?ms:0),updatedAt:serverTimestamp()});toast[ok?'success':'warn'](ok?`정답! ${Math.round(ms/100)/10}초`:'오답입니다.');}catch(e){toast.error(e.message||'선택 저장 실패');}
}

export { createTouchKingRoom as createSymbolSpyRoom, joinTouchKingRoom as joinSymbolSpyRoom, renderTouchKingRoom as renderSymbolSpyRoom, destroyTouchKingRoom as destroySymbolSpyRoom };
