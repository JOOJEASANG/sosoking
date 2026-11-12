import {TILES, TEAMS, ROUND_LIMIT, OFFER, TILE_RULE, newGame, tide, captain, options, play, pilotAction, points, ranking, winners} from './rules.js';
import {Board} from './board.js';
import {token, nonce, newCode, cleanCode, isCode, displayCode, inviteLink, request, getSaved, save} from './online.js';

const $=s=>document.querySelector(s), main=$('#main'), dialog=$('#dialog'), dialogBody=$('#dialog-body');
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=id=>`<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const badge=(txt,warm=false)=>`<span class="badge${warm?' warm':''}">${h(txt)}</span>`;
const btn=(action,txt,type='primary',symbol='',disabled=false)=>`<button type="button" class="btn ${type}" data-action="${action}" ${disabled?'disabled':''}>${symbol?icon(symbol):''}${h(txt)}</button>`;
const small=(action,txt,symbol)=>`<button type="button" class="small-btn" data-action="${action}">${icon(symbol)}${h(txt)}</button>`;
const dot=(p,active=false)=>`<span class="dot${active?' active-player':''}" style="--color:${TEAMS[p.seat].color}"></span>`;
const initialHash=new URLSearchParams(location.hash.slice(1)).get('join');
let view='',mode='',room=null,grant=null,practice=null,board=null,busy=false,polling=false;
let notice='',botTimer=0,toastTimer=0,rollAnim='',offset=0,lastContact=0,netMessage='',sound=getSaved(localStorage,'sound')===true,audio;
const practiceId='home-captain';
let pendingEntry=null;
const nick=()=>String(getSaved(localStorage,'name')||'');
const activeGame=()=>mode==='practice'?practice:room?.game;
const myId=()=>mode==='practice'?practiceId:room?.me;
function beep(kind='tap') {
  if(!sound) return;
  try {
    audio ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended') audio.resume().catch(()=>{});
    const now=audio.currentTime,notes=kind==='mail'?[523.25,659.25,783.99]:kind==='roll'?[311.13,392,466.16]:[440];
    notes.forEach((freq,i)=>{const o=audio.createOscillator(),v=audio.createGain(),t=now+i*.065;
      o.type='sine';o.frequency.value=freq;v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(.09,t+.012);
      v.gain.exponentialRampToValueAtTime(.0001,t+.16);o.connect(v).connect(audio.destination);o.start(t);o.stop(t+.17);});
  } catch {}
}
function soundBtn() {
  const b=$('#sound-btn');b.innerHTML=icon(sound?'volume':'mute');b.setAttribute('aria-pressed',String(sound));
  b.setAttribute('aria-label',sound?'효과음 끄기':'효과음 켜기');b.title=b.getAttribute('aria-label');
}
function toast(msg) {
  const el=$('#toast');el.textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.textContent='',3200);
}
function closeModal() { if(dialog.open) dialog.close(); }
function showModal(content) {dialogBody.innerHTML=content;if(!dialog.open) dialog.showModal();}
function modalHead(label,title) {return `<div class="micro">${h(label)}</div><h2 id="dialog-title">${h(title)}</h2>`;}
function rules() {
  showModal(modalHead('Field guide','항해 수첩')+`
    <h3>${icon('dice')} 두 주사위로 항로 고르기</h3><p>주사위 두 개를 굴린 뒤 하나만큼 이동해요. 특급권 1장을 쓰면 두 눈의 합만큼 갑니다. 특급권은 2장으로 시작해요.</p>
    <h3>${icon('mail')} 편지는 지나기만 해도 배달</h3><p>봉투 깃발이 꽂힌 섬이 내 목적지예요. 그 섬을 지나거나 도착하면 별도장 4개와 우표 3장을 받고 새 편지가 생겨요.</p>
    <h3>${icon('flag')} 내 우체국 세우기</h3><p>빈 섬에 도착하면 우표 4장으로 우체국을 세워요. 내 우체국에 다시 도착하면 우표 3장으로 증축할 수 있어요. 둘 다 별도장 2개를 얻고, 다른 배가 도착하면 우표 1장 또는 2장을 받아요.</p>
    <h3>${icon('waves')} 물때와 결산</h3><p>모든 선장이 한 번씩 움직이면 한 라운드예요. 두 라운드마다 방향이 반대가 됩니다. 8라운드 뒤 별도장과 남은 우표 3장당 1점을 합산해요. 동점은 공동 우승이에요.</p>
    <h3>${icon('users')} 친구와 함께</h3><p>2~4명이 모여 방장이 출항을 눌러요. 접속이 끊겨도 새로고침이나 이전 방 이어하기로 돌아올 수 있어요. 온라인에서 85초 동안 턴이 끝나지 않으면 자동 선장이 마무리해요.</p>`);
}
function home() {
  clearTimeout(botTimer);if(board){board.stop();board=null;}
  mode='';view='home';room=null;grant=null;practice=null;notice='';netMessage='';rollAnim='';
  const saved=getSaved(localStorage,'resume');
  main.innerHTML=`<div class="home-grid">
    <section class="postcard" aria-labelledby="home-title"><div class="pc-inner"><div class="postmark">Island mail service</div>
    <h1 id="home-title">물결우체국</h1><div class="eng-title" lang="en">Tidepost</div>
    <p class="hero-desc">주사위를 굴려 항로를 고르고,<br>열여섯 섬에 편지를 전하세요.</p></div>
    <div class="meta"><span>${icon('users')} 2–4인</span><span>${icon('waves')} 8라운드</span><span>유료 아이템 없음</span></div></section>
    <section class="boarding"><div class="eyebrow">Boarding pass</div><h2>승선 준비</h2>
    <form id="create-form"><label class="lbl" for="nickname">선장 이름</label><input id="nickname" maxlength="16" placeholder="사용할 이름" autocomplete="nickname" value="${h(nick())}">
    <div class="stack"><button type="submit" class="btn primary" data-net>${icon('users')}친구 초대방 만들기</button>
    ${btn('practice','혼자 연습하기','secondary','compass')}</div></form>
    <div class="ticket-tail"><button class="quiet" data-action="join-dialog">${icon('key')} 초대 코드로 참가 ${icon('arrow')}</button>
    ${saved&&isCode(saved.code)?`<br><button class="quiet" data-action="resume">${icon('rotate')} 이전 방 이어하기</button>`:''}</div>
    <p class="notice" data-notice role="status"></p></section></div>
    <section class="how"><div class="section-line"><h2>어떻게 놀까요?</h2><button class="quiet" data-action="rules">항해 수첩 ${icon('arrow')}</button></div>
    <div class="how-grid">
    ${[['dice','항로를 고르고','두 주사위 중 하나를 골라 배를 움직여요.'],['mail','편지를 전하고','목적지를 지나면 별도장과 우표를 받아요.'],['flag','우체국을 세워요','다른 선장이 내 섬에 들르면 우표를 받아요.']].map(([i,t,d])=>`<div class="how-cell"><div class="emblem">${icon(i)}</div><div><h3>${t}</h3><p>${d}</p></div></div>`).join('')}</div></section>`;
}
function joinDialog(code='') {
  const name=$('#nickname')?.value??nick();
  showModal(modalHead('Boarding ticket',code?'친구의 초대장':'초대 코드로 참가')+`<p>초대받은 방에 내 배를 띄워요.</p>
    <form id="join-form" class="stack loose"><div><label class="lbl" for="join-code">초대 코드</label><input id="join-code" required maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX" value="${h(isCode(cleanCode(code))?displayCode(cleanCode(code)):code)}"></div>
    <div><label class="lbl" for="join-name">선장 이름</label><input id="join-name" maxlength="16" autocomplete="nickname" value="${h(name)}" placeholder="사용할 이름"></div>
    <button type="submit" class="btn primary" data-net>${icon('ship')}이 방에 승선하기</button><p class="notice" data-join-notice role="status"></p></form>`);
  (code?$('#join-name'):$('#join-code')).focus();
}
function displayError(msg) {
  notice=msg;
  const el=(dialog.open&&dialogBody.querySelector('[data-join-notice]'))||main.querySelector('[data-notice]');
  if(el) el.textContent=msg;else if(msg) toast(msg);
}
function syncBusy(value) {
  busy=value;main.toggleAttribute('aria-busy',value);
  document.querySelectorAll('[data-net],[data-turn]').forEach(b=>{
    if(value){if(!b.disabled){b.disabled=true;b.dataset.lock='1';}}
    else if(b.dataset.lock){b.disabled=false;delete b.dataset.lock;}
  });
}
async function twice(input) {
  try{return await request(input);}catch(e){if(e.status)throw e;return await request(input);}
}
function accept(s) {
  if(!grant||grant.code!==s.code||room&&s.rev<room.rev) return;
  const changed=!room||room.rev!==s.rev;
  const recovered=!!netMessage; room=s;offset=s.now-Date.now();lastContact=Date.now();netMessage='';
  if(changed||view==='home'||recovered) render();
  else {
    if(view==='lobby' && !!document.querySelector('[data-start]')!==canHost()) render();
    clock();
  }
}
function remember(g) {save(sessionStorage,'grant',g);save(localStorage,'resume',g);save(sessionStorage,'practice',null);}
function dropGrant(g) {
  if(getSaved(localStorage,'resume')?.token===g?.token)save(localStorage,'resume',null);
  save(sessionStorage,'grant',null);
}
async function enter(op,code,name) {
  if(busy)return;
  name=(name||'').trim()||'우편 선장';
  if(op==='join'&&!isCode(code)){displayError('영문과 숫자로 된 8자리 초대 코드를 확인해 주세요.');return;}
  syncBusy(true);displayError('');
  try {
    if(!pendingEntry||pendingEntry.op!==op||op==='join'&&pendingEntry.code!==code)
      pendingEntry={op,code:op==='create'?newCode():code,token:token()};
    let s;
    for(let n=0;n<3;n++){
      try{s=await twice({...pendingEntry,name});break;}
      catch(e){if(e.status===409&&op==='create'&&n<2){pendingEntry.code=newCode();continue;}throw e;}
    }
    grant={code:s.code,token:pendingEntry.token};pendingEntry=null;room=null;mode='online';remember(grant);save(localStorage,'name',name);
    closeModal();history.replaceState(null,'',location.pathname+location.search);accept(s);window.scrollTo(0,0);
  } catch(e){displayError(e.message);}
  finally{syncBusy(false);}
}
async function restore(g) {
  if(!g||busy)return;
  syncBusy(true);displayError('');
  try{const s=await twice({op:'state',...g});grant=g;remember(g);mode='online';room=null;closeModal();accept(s);}
  catch(e){if([403,404,410].includes(e.status)){dropGrant(g);home();}displayError(e.message);}
  finally{syncBusy(false);}
}
function startPractice() {
  if(busy)return;
  const name=($('#nickname')?.value??nick()).trim()||'우편 선장';
  save(localStorage,'name',name);save(sessionStorage,'grant',null);closeModal();mode='practice';
  if(board){board.stop();board=null;view='';}
  practice=newGame([{id:practiceId,name,seat:0},{id:'pilot-maru',name:'마루',seat:1}]);
  persistPractice();beep();render();window.scrollTo(0,0);
}
function persistPractice(){save(sessionStorage,'practice',{version:1,game:practice});}
const canHost=()=>room&&(room.me===room.host||Date.now()+offset>=room.takeOverAt);
function lobby() {
  if(board){board.stop();board=null;}
  view='lobby';const code=room.code,ready=room.members.length>=2,amHost=canHost();
  main.innerHTML=`<section class="lobby-grid"><div class="lobby-illustration"><div class="lobby-copy"><div class="postmark">Port of departure</div>
    <h1>출항 대기실</h1><p class="desc">친구에게 승선 초대장을 보내세요.</p>
    <div class="invite-card"><div class="eyebrow">Room code · 초대 코드</div><div class="room-code">${h(displayCode(code))}</div>
    ${btn('invite','초대 링크 복사','primary','copy')}</div></div></div>
    <div class="panel"><div class="panel-head"><h2>승선 명단</h2>${badge(room.members.length+' / 4명')}</div>
    <div class="seats">${[0,1,2,3].map(seat=>{
      const p=room.members.find(m=>m.seat===seat);
      return p?`<div class="seat"><div class="row">${dot(p)}<b>${h(p.name)}</b>${p.id===room.me?badge('나'):''}</div><span class="micro">${p.id===room.host?'방장':TEAMS[seat].name+' 선장'}</span></div>`:
      `<div class="seat empty">${icon('anchor')} 빈 좌석</div>`;
    }).join('')}</div>
    ${amHost?`<button class="btn primary" data-action="start" data-start data-net ${ready?'':'disabled'}>${icon('ship')}함께 출항하기</button>`:`<p class="sub">방장이 출항하면 게임이 시작돼요.</p>`}
    ${amHost&&!ready?'<p class="fine" style="margin-top:8px">친구 한 명이 더 승선하면 출항할 수 있어요.</p>':''}
    <div class="ticket-tail"><button class="quiet" data-action="leave">${icon('exit')} 대기실 나가기</button></div>
    <p class="notice" data-notice role="status">${h(notice||netMessage)}</p></div></section>`;
}
const pipSets=[[5],[1,9],[1,5,9],[1,3,7,9],[1,3,5,7,9],[1,3,4,6,7,9]];
const angles=[[-15,17],[-15,-73],[-73,0],[103,0],[-15,107],[-15,197]];
function dicePair(values,animated) {
  const faces=pipSets.map((set,i)=>`<span class="face f${i+1}">${set.map(n=>`<i style="grid-column:${(n-1)%3+1};grid-row:${Math.floor((n-1)/3)+1}"></i>`).join('')}</span>`).join('');
  return `<div class="dice-well" aria-label="${values?'주사위 '+values.join(', '):'주사위 두 개'}">${(values||[1,3]).map((v,i)=>{
    const [x,y]=angles[v-1];return `<div aria-hidden="true" class="die-shell ${i?'alt':''} ${animated?'rolled':''}"><div class="die" style="--rx:${x}deg;--ry:${y}deg">${faces}</div></div>`;
  }).join('')}</div>`;
}
function turnButton(action,label,type,symbol) {return btn(action,label,type,symbol).replace('type="button"','type="button" data-turn');}
function gameFrame() {
  view='game';main.innerHTML=`<div class="play-head"><div><div class="micro">The island route</div><h1>열여섯 섬 항로</h1></div><div class="tools">${small('leave',mode==='practice'?'연습 종료':'방 나가기','exit')}</div></div>
    <div class="game-grid"><div class="game-map">
    <section class="play-board" aria-label="입체 항로 지도"><div class="board-head"><strong>${icon('compass')} 항로 지도</strong><div class="game-meta" id="map-meta"></div></div>
    <div class="canvas-wrap"><canvas id="map" role="img" aria-label="열여섯 섬 입체 보드. 섬을 누르면 정보가 열립니다. 같은 정보는 섬 목록에서도 확인할 수 있습니다."></canvas></div>
    <div class="board-foot"><span class="fine">${icon('mail')} 봉투 깃발은 내 배달지</span><div class="tools">${small('rotate','회전','rotate')}${small('tiles','섬 목록','list')}</div></div></section>
    <details class="log-box"><summary>항해 기록</summary><ul id="log-list" class="log-list"></ul></details></div>
    <aside class="game-sidebar" aria-label="턴과 점수"><div id="turn-panel" class="panel turn-panel"></div><div id="letter-panel" class="letter"></div>
    <section class="panel score-panel"><div class="panel-head"><h2>선장 명단</h2><span class="micro">Crew</span></div><div id="stats" class="stats"></div></section></aside></div>`;
  board=new Board($('#map'),tileInfo);
}
function actionPane(g,own,p) {
  if(g.phase==='finished'){
    const ids=winners(g), names=g.players.filter(q=>ids.includes(q.id)).map(q=>q.name);
    return `<div class="emblem">${icon('star')}</div><div class="turn-label">항해 결산</div><h2>${h(names.join(' · '))} ${names.length>1?'공동 우승':'우승'}</h2>
    <p class="sub">${g.finishReason==='last'?'마지막으로 남은 선장이 항해를 마쳤어요.':'8라운드 배달을 모두 마쳤어요.'}</p>
    <div class="stats" style="margin:12px 0">${ranking(g).map(q=>`<div class="stat-row ${q.out?'retired':''}">${dot(q)}<b>${h(q.name)}</b><small>배달 ${q.delivered}통</small><span class="score">${q.out?'하선':points(q)+'점'}</span></div>`).join('')}</div>
    ${mode==='practice'?turnButton('again','다시 연습하기','primary','rotate'):canHost()?turnButton('rematch','대기실에서 다시 모이기','primary','rotate'):'<p class="fine">방장이 다음 항해를 준비할 수 있어요.</p>'}`;
  }
  const label=own?'내 차례':p.name+' 차례',title=own?({roll:'주사위를 굴려요',choose:'어디로 갈까요?',office:g.offer==='upgrade'?'우체국을 키울까요?':'우체국을 세울까요?'})[g.phase]:'다음 항로를 기다려요';
  let body='';
  if(g.phase==='roll'){body=dicePair(null,false)+(own?turnButton('roll','주사위 굴리기','primary','dice'):'');}
  if(g.phase==='choose') {
    const key=g.turn+':'+g.dice.join(',');body=dicePair(g.dice,key!==rollAnim);rollAnim=key;
    if(own)body+=`<div class="choices">${options(g).map(o=>`<button type="button" class="choice ${o.id==='express'?'express':''}" data-action="sail" data-turn data-choice="${o.id}">
      <span>${o.id==='express'?'특급 · ':''}${o.steps}칸</span><strong>${h(TILES[o.to].name)}</strong><small>${o.delivery?'편지 배달':o.id==='express'?'특급권 1장':'도착'}</small></button>`).join('')}</div>`;
  }
  if(g.phase==='office' && own) {
    const offer=OFFER[g.offer];
    body=`<p class="sub" style="margin:9px 0 12px">${h(TILES[p.pos].name)}에서 우표 ${offer.cost}장을 쓰고 별도장 ${offer.stars}개를 받아요.</p><div class="stack">${turnButton('build',offer.label,'primary','flag')}${turnButton('pass','그냥 지나가기','plain','arrow')}</div>`;
  }
  if(!own)body+=`<p class="sub">${mode==='practice'?'연습 선장 '+h(p.name)+'가 움직이고 있어요.':h(p.name)+'의 항해가 끝나면 차례가 넘어와요.'}</p>`;
  return `<div class="section-line" style="margin:0"><span class="turn-label">${dot(p)} ${h(label)}</span><span data-clock class="countdown"></span></div><h2>${h(title)}</h2>${body}`;
}
function renderGame() {
  const g=activeGame(),id=myId(),p=captain(g),me=g.players.find(q=>q.id===id);
  if(view!=='game') gameFrame();
  $('#map-meta').innerHTML=badge('라운드 '+g.round+' / '+ROUND_LIMIT)+badge(tide(g.round)===1?'정방향 →':'← 역방향',tide(g.round)<0);
  const panel=$('#turn-panel');panel.className=g.phase==='finished'?'panel result':'panel turn-panel';panel.style.setProperty('--turn',TEAMS[p.seat].color);
  const focusChoice=panel.contains(document.activeElement)?document.activeElement.dataset.action:null;
  panel.innerHTML=actionPane(g,p.id===id,p)+`<p class="notice" data-notice role="status">${h(notice||netMessage)}</p>`;
  if(focusChoice)panel.querySelector('[data-action="'+focusChoice+'"]')?.focus({preventScroll:true});
  const l=$('#letter-panel');l.innerHTML=`<div class="emblem">${icon('mail')}</div><div><div class="micro">${g.phase==='finished'?'Delivery record':'Next delivery'}</div>
    <strong>${g.phase==='finished'?'배달 '+me.delivered+'통':'내 편지 · '+h(TILES[me.destination].name)}</strong><div class="fine">우표 ${me.stamps}장 · 별도장 ${me.stars}개 · 특급권 ${me.express}장</div></div>`;
  $('#stats').innerHTML=g.players.map(q=>`<div class="stat-row ${q.out?'retired':''}">${dot(q,q.id===p.id&&g.phase!=='finished')}<b>${h(q.name)}</b>
    <small>${q.id===id?'나':mode==='practice'?'연습 선장':TEAMS[q.seat].name}</small><span class="score">${q.out?'하선':points(q)+'점'}</span></div>`).join('');
  $('#log-list').innerHTML=g.log.map(n=>`<li>${h(n.text)}</li>`).join('');
  board.highlight(null);board.update(g,id);clock();
  if(mode==='practice')schedulePilot();
}
function render() {if(mode==='online'&&!room?.game)lobby();else if(activeGame())renderGame();}
function clock() {
  const el=document.querySelector('[data-clock]');if(!el)return;
  if(mode==='online'&&room.deadline){const remaining=Math.max(0,Math.ceil((room.deadline-Date.now()-offset)/1000));el.textContent=remaining+'초';}
  else el.textContent=mode==='practice'?'혼자 연습':'';
}
function schedulePilot() {
  clearTimeout(botTimer);const g=practice;
  if(!g||g.phase==='finished'||captain(g).id===practiceId)return;
  botTimer=setTimeout(()=>{if(mode!=='practice'||practice!==g)return;
    play(g,captain(g).id,pilotAction(g));persistPractice();render();
  },g.phase==='choose'?950:680);
}
function tileInfo(idx) {
  const g=activeGame(),t=TILES[idx];if(!g||!t)return;
  const off=g.offices[idx],owner=off&&g.players.find(q=>q.id===off.owner),visitors=g.players.filter(q=>!q.out&&q.pos===idx);
  showModal(modalHead('Island '+String(idx).padStart(2,'0'),t.name)+`<p>${owner?h(owner.name)+' 선장의 '+(off.level===2?'등대 우체국':'우체국')+'이에요. 다른 배가 도착하면 이용료는 우표 '+off.level+'장이에요.':TILE_RULE[t.kind]}</p>
    ${visitors.length?`<h3>정박 중인 선장</h3><p>${visitors.map(p=>h(p.name)).join(' · ')}</p>`:''}
    <div class="stack">${btn('tiles','전체 섬 목록','plain','list')}</div>`);
}
function tiles() {
  showModal(modalHead('Route index','열여섯 섬 목록')+`<div class="route-list">${TILES.map((t,i)=>`<button class="choice" data-action="tile" data-tile="${i}"><span>${String(i).padStart(2,'0')}</span><strong>${h(t.name)}</strong></button>`).join('')}</div>`);
}
async function refresh() {
  if(!grant||mode!=='online'||polling||busy)return;
  const g=grant;polling=true;
  try{const s=await request({op:'state',...g});if(grant===g)accept(s);}
  catch(e){
    if(grant!==g)return;
    if([403,404,410].includes(e.status)){closeModal();dropGrant(g);home();displayError(e.message);}
    else{netMessage='연결을 다시 시도하고 있어요.';const el=main.querySelector('[data-notice]');if(el)el.textContent=netMessage;}
  }finally{polling=false;}
}
async function act(op,choice) {
  if(busy)return;
  if(mode==='practice') {
    const g=practice;
    try{play(g,practiceId,{type:op,choice});if(op==='roll')beep('roll');else if(op==='sail')beep(g.move.delivery?'mail':'tap');
      persistPractice();render();}catch(e){displayError(e.message);}return;
  }
  if(!grant||!room)return;const key=grant;
  syncBusy(true);notice='';
  try {
    const s=await twice({op,...grant,rev:room.rev,nonce:nonce(),choice});
    if(key!==grant)return;
    if(op==='leave'){dropGrant(grant);closeModal();home();return;}
    if(op==='roll')beep('roll');else if(op==='sail')beep(s.game?.move?.delivery?'mail':'tap');
    accept(s);
  }catch(e){displayError(e.message);if(e.status===409&&key===grant){try{accept(await request({op:'state',...key}));}catch{}}}
  finally{syncBusy(false);}
}
function confirmLeave() {
  if(busy)return;
  const isPractice=mode==='practice';
  showModal(modalHead('Return to port',isPractice?'연습을 끝낼까요?':'이 방에서 내릴까요?')+
    '<p>'+(isPractice?'지금 진행 중인 연습 항해를 마칩니다.':activeGame()?.phase!=='finished'&&activeGame()?'지금 내리면 이 판의 우체국과 점수를 포기합니다. 다시 참여하려면 다음 출항까지 기다려야 해요.':'다시 모일 때 초대 코드로 승선할 수 있어요.')+'</p>'+
    '<div class="stack">'+btn('leave-now',isPractice?'연습 종료하기':'방에서 내리기','coral','exit')+btn('close','계속 머무르기','plain')+'</div><p class="notice" data-join-notice role="status"></p>');
}
async function invite() {
  const link=inviteLink(room.code);
  try{await navigator.clipboard.writeText(link);toast('초대 링크를 복사했어요. 친구에게 보내세요.');}
  catch{showModal(modalHead('Invitation','승선 초대 링크')+`<label class="lbl" for="inv-link">친구에게 이 주소를 보내 주세요.</label><input id="inv-link" readonly value="${h(link)}">`);const input=$('#inv-link');input.focus();input.select();}
}
function onAction(e) {
  const target=e.target.closest('[data-action]');if(!target||target.disabled)return;
  const a=target.dataset.action;
  if(a==='rules')rules();else if(a==='join-dialog')joinDialog();
  else if(a==='practice'||a==='again')startPractice();
  else if(a==='resume')restore(getSaved(localStorage,'resume'));else if(a==='invite')invite();
  else if(a==='rotate')board?.rotate();else if(a==='tiles')tiles();else if(a==='tile')tileInfo(Number(target.dataset.tile));
  else if(a==='leave')confirmLeave();else if(a==='close')closeModal();
  else if(a==='leave-now'){if(mode==='practice'){save(sessionStorage,'practice',null);closeModal();home();}else{target.disabled=true;act('leave').finally(()=>{target.disabled=false;});}}
  else if(['roll','sail','build','pass','start','rematch'].includes(a))act(a,target.dataset.choice);
}
document.addEventListener('click',onAction);
document.addEventListener('submit',e=>{
  if(e.target.id==='create-form'){e.preventDefault();enter('create','',$('#nickname').value);}
  if(e.target.id==='join-form'){e.preventDefault();enter('join',cleanCode($('#join-code').value),$('#join-name').value);}
});
for(const event of ['pointerover','focusin']) document.addEventListener(event,e=>{
  const b=e.target.closest('[data-choice]'),g=activeGame();if(b&&board&&g)board.highlight(options(g).find(x=>x.id===b.dataset.choice)?.path);
});
for(const event of ['pointerout','focusout']) document.addEventListener(event,e=>{if(e.target.closest('[data-choice]')&&board)board.highlight(null);});
$('#rules-btn').onclick=rules;$('#close-dialog').onclick=closeModal;
dialog.addEventListener('click',e=>{if(e.target===dialog)closeModal();});
$('#sound-btn').onclick=()=>{sound=!sound;save(localStorage,'sound',sound);soundBtn();beep('mail');};soundBtn();
setInterval(()=>{clock();if(mode==='online'&&(!document.hidden||Date.now()-lastContact>12000))refresh();},1700);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('hashchange',()=>{const q=new URLSearchParams(location.hash.slice(1)).get('join');if(q&&view==='home')joinDialog(q);});
home();
const previous=getSaved(sessionStorage,'grant'), savedPractice=getSaved(sessionStorage,'practice');
if(initialHash&&(!previous||previous.code!==cleanCode(initialHash)))joinDialog(cleanCode(initialHash));
else if(previous)restore(previous);
else if(savedPractice?.version===1&&savedPractice.game?.players?.some(p=>p.id===practiceId)){mode='practice';practice=savedPractice.game;render();}
