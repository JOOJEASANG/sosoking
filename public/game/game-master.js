const AUTO_KEY='sosoking-game-master:auto';
const PAUSE_KEY='sosoking-game-master:paused';
const RESULT_DELAY=4200;
const REVEAL_SELECTORS=['#reveal-round','#reveal','#show-results','#reveal-results'];
const NEXT_SELECTORS=['#next-round','#next','#next-step','#continue'];
let auto=true;
let paused=false;
let scheduledKey='';
let scheduledTimer=null;
let control=null;

function readBool(key,fallback){try{const v=localStorage.getItem(key);return v===null?fallback:v==='1';}catch{return fallback;}}
function saveBool(key,value){try{localStorage.setItem(key,value?'1':'0');}catch{}}
function hasRoom(){return Boolean(new URL(location.href).searchParams.get('room'));}
function findButton(selectors){for(const selector of selectors){const el=document.querySelector(selector);if(el instanceof HTMLButtonElement)return el;}return null;}
function isHostView(){return Boolean(document.querySelector('#start,#reveal-round,#reveal,#next-round,#next,#show-results,#reveal-results'));}
function currentPhase(){if(document.querySelector('#start'))return '대기실';if(findButton(REVEAL_SELECTORS))return '선택 진행';if(findButton(NEXT_SELECTORS))return '결과 공개';if(/최종|우승|게임 종료/.test(document.getElementById('game-app')?.textContent||''))return '게임 종료';return '자동 진행';}
function renderControl(){
  if(!hasRoom()||!isHostView()){control?.setAttribute('hidden','');return;}
  if(!control){
    control=document.createElement('aside');control.className='game-master-control';control.setAttribute('aria-label','게임마스터 자동진행');
    control.innerHTML='<div class="game-master-top"><div class="game-master-title">🎙️ 게임마스터 <span class="game-master-badge">AUTO</span></div><span class="game-master-state"></span></div><div class="game-master-actions"><button type="button" data-gm-auto></button><button type="button" data-gm-pause></button></div><div class="game-master-note">게임 시작 후 전원 제출 또는 시간 종료 시 결과를 열고, 잠시 뒤 다음 라운드로 자동 진행합니다.</div>';
    document.body.append(control);
    control.querySelector('[data-gm-auto]')?.addEventListener('click',()=>{auto=!auto;saveBool(AUTO_KEY,auto);if(!auto)clearScheduled();renderControl();});
    control.querySelector('[data-gm-pause]')?.addEventListener('click',()=>{paused=!paused;saveBool(PAUSE_KEY,paused);if(paused)clearScheduled();renderControl();});
  }
  control.hidden=false;
  const state=control.querySelector('.game-master-state');if(state)state.textContent=currentPhase();
  const autoButton=control.querySelector('[data-gm-auto]');if(autoButton){autoButton.textContent=auto?'⏭ 자동 ON':'⏭ 자동 OFF';autoButton.classList.toggle('is-on',auto);}
  const pauseButton=control.querySelector('[data-gm-pause]');if(pauseButton){pauseButton.textContent=paused?'▶ 계속':'⏸ 잠시멈춤';pauseButton.classList.toggle('is-on',paused);}
}
function clearScheduled(){if(scheduledTimer)clearTimeout(scheduledTimer);scheduledTimer=null;scheduledKey='';}
function scheduleClick(button,delay,key){
  if(!button||button.disabled||!auto||paused)return;
  if(scheduledKey===key)return;
  clearScheduled();scheduledKey=key;
  scheduledTimer=setTimeout(()=>{
    scheduledTimer=null;scheduledKey='';
    if(!auto||paused||!button.isConnected||button.disabled)return;
    button.click();
  },delay);
}
function fallbackChoice(){
  if(!auto||paused||!hasRoom())return;
  const timer=document.getElementById('round-timer');
  const seconds=Number(timer?.textContent||99);if(!Number.isFinite(seconds)||seconds>1)return;
  if(document.querySelector('.is-selected,[data-choice].is-selected,[data-number].is-selected'))return;
  const cash=document.querySelector('[data-choice="cash"]');if(cash instanceof HTMLButtonElement&&!cash.disabled){cash.click();return;}
  const vaults=[...document.querySelectorAll('[data-vault]')].filter(el=>el instanceof HTMLButtonElement&&!el.disabled);if(vaults.length){vaults[Math.floor(Math.random()*vaults.length)].click();return;}
  const numbers=[...document.querySelectorAll('[data-number]')].filter(el=>el instanceof HTMLButtonElement&&!el.disabled&&!el.classList.contains('is-banned'));if(numbers.length){numbers[Math.floor(Math.random()*numbers.length)].click();}
}
function drive(){
  renderControl();fallbackChoice();
  if(!auto||paused||!isHostView())return;
  const reveal=findButton(REVEAL_SELECTORS);if(reveal&&!reveal.disabled){scheduleClick(reveal,350,`reveal:${location.href}:${reveal.textContent}`);return;}
  const next=findButton(NEXT_SELECTORS);if(next&&!next.disabled){scheduleClick(next,RESULT_DELAY,`next:${location.href}:${next.textContent}`);return;}
  clearScheduled();
}
auto=readBool(AUTO_KEY,true);paused=readBool(PAUSE_KEY,false);
const observer=new MutationObserver(drive);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','class']});
window.addEventListener('popstate',drive);window.addEventListener('pageshow',drive);setInterval(drive,500);drive();