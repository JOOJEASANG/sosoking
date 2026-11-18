import {initializeApp} from 'firebase/app';
import {getAuth,signInAnonymously} from 'firebase/auth';
import {getFirestore,collection,doc,getDocs,query,orderBy,limit,setDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
import {CATEGORIES,DEFAULT_ITEMS,localDateKey,shiftDay,dayLabel,validateItem,normalizeAnswer,emptyJournal,cleanJournal,dayProgress,calculateStreak,monthSummary,orderedEntries} from './daily-core.js';

const $=id=>document.getElementById(id);
const STORAGE='sosoking-daily-journal-v1';
let journal=emptyJournal();
try{const raw=localStorage.getItem(STORAGE);if(raw)journal=cleanJournal(JSON.parse(raw));}
catch(err){console.warn('Unable to load local journal',err);}
let activeDate=localDateKey(),calendarMonth=activeDate.slice(0,7),activeTab='today',todayCategory='전체',exploreCategory='전체';
let firebaseDb=null,firebaseAuth=null,publicItems=[],firebaseStatus='connecting',savingPublic=false,toastTimer;
const curated=[
 {id:'s_curated_fridge',title:'냉장고를 열었다 그냥 닫은 적 있어?',kind:'check',category:'재미',options:[],icon:'🧊'},
 {id:'s_curated_nap',title:'오늘 낮잠 몇 번 잤어?',kind:'count',category:'일상',options:[],icon:'🛌'},
 {id:'s_curated_cloud',title:'하늘을 올려다본 적 있어?',kind:'check',category:'일상',options:[],icon:'☁️'},
 {id:'s_curated_talk',title:'오늘 혼잣말 몇 번 했어?',kind:'count',category:'재미',options:[],icon:'🗣️'},
 {id:'s_curated_water',title:'물은 몇 잔 마셨어?',kind:'count',category:'먹거리',options:[],icon:'💧'},
 {id:'s_curated_call',title:'누군가에게 안부를 물었어?',kind:'check',category:'사람',options:[],icon:'💌'},
 {id:'s_curated_day',title:'오늘 기분은 어땠어?',kind:'choice',category:'일상',options:['좋았어','그냥 그래','피곤했어','속상했어'],icon:'🌤️'},
 {id:'s_curated_snack',title:'간식은 몇 번 먹었어?',kind:'count',category:'먹거리',options:[],icon:'🍪'}
];
const CAT_ICONS={'일상':'☀️','먹거리':'🍴','사람':'♡','재미':'✦','기타':'●'};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const btn=(cls,text,fn)=>{const n=el('button',cls,text);n.type='button';n.addEventListener('click',fn);return n;};
const persist=()=>{
 try{localStorage.setItem(STORAGE,JSON.stringify(journal));return true;}
 catch{toast('브라우저 저장 공간이 부족합니다. 기록을 백업해 주세요.','error');return false;}
};
function toast(text,kind='info'){
 const box=$('toast');box.textContent=text;box.classList.toggle('error',kind==='error');box.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,4200);
}
function switchTab(tab){
 if(!['today','explore','history','settings'].includes(tab))return;
 activeTab=tab;
 for(const panel of document.querySelectorAll('[data-screen]'))panel.hidden=panel.dataset.screen!==tab;
 for(const button of document.querySelectorAll('[data-tab]')){
  const yes=button.dataset.tab===tab;
  button.classList.toggle('active',yes);
  button.setAttribute('aria-current',yes?'page':'false');
 }
 if(tab==='today')renderToday();
 if(tab==='explore')renderExplore();
 if(tab==='history')renderHistory();
 if(tab==='settings')renderSettings();
 window.scrollTo({top:0,behavior:'instant'});
}
for(const control of document.querySelectorAll('[data-tab]'))control.addEventListener('click',()=>switchTab(control.dataset.tab));
function itemsForToday(){
 const defaults=DEFAULT_ITEMS.filter(x=>!journal.hiddenDefaultIds.includes(x.id));
 const customs=journal.customItems.filter(x=>!journal.hiddenItemIds.includes(x.id));
 const shared=journal.sharedItems.filter(x=>journal.selectedSharedIds.includes(x.id)&&!journal.hiddenItemIds.includes(x.id));
 return [...defaults,...customs,...shared];
}
function answers(){return journal.days[activeDate]||{};}
function saveAnswer(item,value){
 const normalized=normalizeAnswer(item,value);
 const data={...answers()};
 if(normalized===null)delete data[item.id];else data[item.id]=normalized;
 if(Object.keys(data).length)journal.days[activeDate]=data;else delete journal.days[activeDate];
 persist();renderToday();
}
function chips(target,current,onSelect){
 target.replaceChildren();
 for(const cat of ['전체',...CATEGORIES]){
  const n=btn(cat===current?'active':'',cat,()=>onSelect(cat));n.setAttribute('aria-pressed',String(cat===current));
  target.append(n);
 }
}
function checkCard(item,data){
 const recorded=Object.prototype.hasOwnProperty.call(data,item.id);
 const card=el('article','check-card'+(recorded?' done':''));
 const top=el('div','check-card-top');
 top.append(el('span','card-emoji',item.icon||CAT_ICONS[item.category]||'✦'),el('span','card-category',item.category));
 card.append(top,el('h3','',item.title));
 const actions=el('div','card-actions');
 if(item.kind==='count'){
  const count=el('div','count-control');
  const value=recorded?Number(data[item.id]):0;
  const minus=btn('', '−',()=>saveAnswer(item,Math.max(0,value-1)));
  minus.setAttribute('aria-label',item.title+' 횟수 줄이기');
  const val=el('strong','',value+'회');val.setAttribute('aria-label','현재 '+value+'회');
  const plus=btn('', '+',()=>saveAnswer(item,Math.min(999,value+1)));
  plus.setAttribute('aria-label',item.title+' 횟수 늘리기');
  count.append(minus,val,plus);actions.append(count);
 }else if(item.kind==='check'){
  const wrap=el('div','card-choice-buttons');
  for(const [value,label] of [[true,'했어 ✓'],[false,'안 했어']]){
   const n=btn('choice-button'+(recorded&&data[item.id]===value?' active':''),label,()=>saveAnswer(item,value));
   n.setAttribute('aria-pressed',String(recorded&&data[item.id]===value));wrap.append(n);
  }
  actions.append(wrap);
 }else if(item.kind==='choice'){
  const wrap=el('div','card-choice-buttons');
  for(const option of item.options||[]){
   const n=btn('choice-button'+(data[item.id]===option?' active':''),option,()=>saveAnswer(item,option));
   n.setAttribute('aria-pressed',String(data[item.id]===option));wrap.append(n);
  }
  actions.append(wrap);
 }
 const footer=el('div','card-footer');
 footer.append(el('span','saved-label'+(recorded?'':' muted'),recorded?'✓ 기록했어':'아직 기록 전'));
 if(recorded)footer.append(btn('clear-answer','지우기',()=>saveAnswer(item,null)));
 else if(item.id.startsWith('l_')||item.id.startsWith('s_')){
  footer.append(btn('clear-answer','목록 숨기기',()=>{
   if(!journal.hiddenItemIds.includes(item.id))journal.hiddenItemIds.push(item.id);
   persist();renderToday();toast('체크 목록에서 숨겼습니다. 설정에서 다시 표시할 수 있어요.');
  }));
 }
 card.append(actions,footer);return card;
}
function renderToday(){
 const today=localDateKey();
 $('dayPicker').max=today;
 if(activeDate>today)activeDate=today;
 $('dayPicker').value=activeDate;
 $('nextDay').disabled=activeDate>=today;
 $('dateTitle').textContent=activeDate===today?'오늘의 체크':dayLabel(activeDate)+'의 체크';
 $('dateSub').textContent=activeDate===today?'완벽하게 적지 않아도 괜찮아. 생각나는 것만 체크해!':'그날의 나를 다시 만나 보세요.';
 const items=itemsForToday(),data=answers(),progress=dayProgress(items,data);
 $('progressLabel').textContent=progress.recorded+' / '+progress.total;
 $('progressFill').style.width=progress.percent+'%';
 $('progressHint').textContent=progress.recorded===0?'하나만 체크해도 충분해요.':progress.recorded===progress.total?'오늘의 작은 일들을 모두 기록했어요!':'작은 기록 '+progress.recorded+'개가 쌓였어요.';
 $('visibleCount').textContent=items.length+'개';
 chips($('todayCategories'),todayCategory,cat=>{todayCategory=cat;renderToday();});
 const grid=$('dailyGrid');grid.replaceChildren();
 const shown=items.filter(item=>todayCategory==='전체'||item.category===todayCategory);
 if(!shown.length)grid.append(el('div','no-items','아직 항목이 없어요. 다른 카테고리를 보거나 새로 만들어 보세요.'));
 else shown.forEach(item=>grid.append(checkCard(item,data)));
}
$('prevDay').onclick=()=>{activeDate=shiftDay(activeDate,-1);renderToday();};
$('nextDay').onclick=()=>{const next=shiftDay(activeDate,1);if(next<=localDateKey()){activeDate=next;renderToday();}};
$('dayPicker').onchange=event=>{const day=event.target.value;if(day&&shiftDay(day,0)===day&&day<=localDateKey()){activeDate=day;renderToday();}};
function makeCatalogCard(item,isCurated=false){
 const added=journal.selectedSharedIds.includes(item.id)&&!journal.hiddenItemIds.includes(item.id);
 const card=el('article','catalog-card');
 const top=el('div','catalog-top');
 top.append(el('span','catalog-tag',item.category),el('span','card-category',isCurated?'소소킹 추천':'모두의 체크'));
 card.append(top,el('h3','',item.title));
 const types={check:'했어 / 안 했어',count:'횟수 기록',choice:'보기 선택'};
 card.append(el('p','',types[item.kind]||'체크'));
 const actions=el('div','catalog-actions');
 const add=btn('btn '+(added?'btn-outline':'btn-dark'),added?'✓ 내 목록에 담김':'+ 내 하루에 담기',()=>{
  if(added)return;
  if(!journal.sharedItems.some(x=>x.id===item.id))journal.sharedItems.push({...item,icon:item.icon||CAT_ICONS[item.category]});
  if(!journal.selectedSharedIds.includes(item.id))journal.selectedSharedIds.push(item.id);
  journal.hiddenItemIds=journal.hiddenItemIds.filter(id=>id!==item.id);
  persist();renderExplore();toast('내 하루체크에 추가했어요.');
 });add.disabled=added;actions.append(add);
 if(!isCurated)actions.append(btn('report-btn','신고',()=>reportItem(item)));
 card.append(actions);return card;
}
function renderExplore(){
 chips($('exploreCategories'),exploreCategory,cat=>{exploreCategory=cat;renderExplore();});
 const input=$('searchCatalog'),search=(input.value||'').trim().toLocaleLowerCase('ko');
 const list=[...publicItems,...curated].filter(item=>(exploreCategory==='전체'||item.category===exploreCategory)&&(!search||item.title.toLocaleLowerCase('ko').includes(search)));
 const grid=$('catalogGrid');grid.replaceChildren();
 if(!list.length)grid.append(el('div','no-items','일치하는 항목이 없어요. 새로운 항목을 직접 만들어 보세요.'));
 else list.forEach(item=>grid.append(makeCatalogCard(item,item.id.startsWith('s_curated_'))));
 $('catalogStatus').textContent=firebaseStatus==='ready'?'다른 사람이 만든 항목 '+publicItems.length+'개 · 소소킹 추천 '+curated.length+'개':firebaseStatus==='error'?'공용 항목 연결에 실패했습니다. 추천 항목은 사용할 수 있어요.':'공용 체크 항목을 불러오는 중입니다. 추천 항목은 바로 사용할 수 있어요.';
}
$('searchCatalog').addEventListener('input',renderExplore);
async function connectPublic(){
 try{
  const response=await fetch('/__/firebase/init.json',{cache:'no-store'});
  if(!response.ok)throw Error('Firebase 설정을 불러올 수 없습니다.');
  const config=await response.json();
  firebaseDb=getFirestore(initializeApp(config));
  firebaseAuth=getAuth();
  await reloadPublic();
 }catch(err){console.warn('Community offline',err);firebaseStatus='error';renderExplore();}
}
async function reloadPublic(){
 if(!firebaseDb){firebaseStatus='error';renderExplore();return;}
 try{
  const result=await getDocs(query(collection(firebaseDb,'publicItems'),orderBy('createdAt','desc'),limit(100)));
  publicItems=result.docs.flatMap(found=>{
   try{
    const data=validateItem(found.data());
    const id=found.id;
    if(!/^s_[a-zA-Z0-9-]{8,110}$/.test(id))return [];
    return [{id,...data,icon:CAT_ICONS[data.category]}];
   }catch{return [];}
  });
  firebaseStatus='ready';renderExplore();
 }catch(err){console.warn('Library load failed',err);firebaseStatus='error';renderExplore();}
}
async function signedUser(){
 if(!firebaseAuth)throw Error('현재 공유 서비스를 연결할 수 없습니다.');
 const signed=firebaseAuth.currentUser||((await signInAnonymously(firebaseAuth)).user);
 if(!signed)throw Error('익명 접속을 확인하지 못했습니다.');
 return signed;
}
async function reportItem(item){
 if(!confirm('이 체크 항목을 부적절한 콘텐츠로 신고할까요?'))return;
 try{
  const u=await signedUser();
  const reportId=item.id+'_'+u.uid;
  await setDoc(doc(firebaseDb,'itemReports',reportId),{itemId:item.id,reporterUid:u.uid,reason:'inappropriate',createdAt:serverTimestamp()});
  toast('신고가 접수되었습니다. 운영자가 검토할 수 있습니다.');
 }catch(err){toast('신고를 등록하지 못했습니다. 이미 신고했거나 연결이 불안정할 수 있어요.','error');}
}
function renderHistory(){
 const year=Number(calendarMonth.slice(0,4)),month=Number(calendarMonth.slice(5,7));
 $('calendarMonthLabel').textContent=year+'년 '+month+'월';
 const summary=monthSummary(journal.days,calendarMonth);
 $('monthDays').textContent=summary.activeDays+'일';
 $('monthChecks').textContent=summary.checks+'개';
 $('streakCount').textContent=calculateStreak(journal.days)+'일';
 const calendar=$('calendarGrid');calendar.replaceChildren();
 const offset=new Date(year,month-1,1).getDay(),count=new Date(year,month,0).getDate(),today=localDateKey();
 for(let i=0;i<offset;i++){const placeholder=el('span');placeholder.setAttribute('aria-hidden','true');calendar.append(placeholder);}
 for(let i=1;i<=count;i++){
  const day=calendarMonth+'-'+String(i).padStart(2,'0'),has=Object.keys(journal.days[day]||{}).length>0;
  const dayBtn=btn('calendar-day'+(has?' recorded':'')+(day===today?' today':''),String(i),()=>{
   activeDate=day;switchTab('today');
  });
  dayBtn.disabled=day>today;
  dayBtn.setAttribute('aria-label',day+' '+(has?'기록 있음':'기록 없음'));
  calendar.append(dayBtn);
 }
 const recent=$('recentHistory');recent.replaceChildren();
 const entries=orderedEntries(journal.days).slice(0,12);
 if(!entries.length)recent.append(el('p','recent-empty','기록이 쌓이면 이곳에 날짜별로 나타나요.'));
 else for(const [day,values] of entries){
  const r=btn('recent-row','',()=>{activeDate=day;switchTab('today');});
  r.append(el('strong','',dayLabel(day)),el('span','',Object.keys(values).length+'개 기록 →'));
  recent.append(r);
 }
}
$('prevMonth').onclick=()=>{const [y,m]=calendarMonth.split('-').map(Number);calendarMonth=localDateKey(new Date(y,m-2,1)).slice(0,7);renderHistory();};
$('nextMonth').onclick=()=>{const [y,m]=calendarMonth.split('-').map(Number);const next=localDateKey(new Date(y,m,1)).slice(0,7);if(next<=localDateKey().slice(0,7))calendarMonth=next;renderHistory();};
function renderSettings(){
 const panel=$('defaultToggles');panel.replaceChildren();
 for(const item of [...DEFAULT_ITEMS,...journal.customItems,...journal.sharedItems]){
  const hidden=item.id.startsWith('d_')?journal.hiddenDefaultIds.includes(item.id):journal.hiddenItemIds.includes(item.id);
  const label=el('label');
  const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=!hidden;
  checkbox.addEventListener('change',()=>{
   const key=item.id.startsWith('d_')?'hiddenDefaultIds':'hiddenItemIds';
   journal[key]=checkbox.checked?journal[key].filter(x=>x!==item.id):[...new Set([...journal[key],item.id])];
   persist();renderToday();
  });
  label.append(checkbox,el('span','',item.title));panel.append(label);
 }
}
function saveFile(filename,text){
 const blob=new Blob([text],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('exportBackup').onclick=()=>{saveFile('sosoking-daily-'+localDateKey()+'.json',JSON.stringify(journal,null,2));toast('기록을 백업 파일로 저장했어요.');};
$('importBackup').onchange=async ev=>{
 const file=ev.target.files?.[0];if(!file)return;
 ev.target.value='';
 if(file.size>3*1024*1024){toast('3MB 이하의 백업 파일만 읽을 수 있어요.','error');return;}
 try{
  const raw=JSON.parse(await file.text());
  if(raw?.version!==1||!raw?.days||typeof raw.days!=='object')throw Error('백업 형식이 올바르지 않습니다.');
  const restored=cleanJournal(raw);
  if(!confirm('이 기기의 현재 기록을 백업 파일로 교체합니다. 계속할까요?'))return;
  const previous=journal;journal=restored;
  if(!persist()){journal=previous;return;}
  renderToday();renderExplore();renderHistory();renderSettings();toast('기록을 복원했어요.');
 }catch(err){toast('파일을 읽을 수 없어요. 소소킹에서 만든 JSON 백업인지 확인해 주세요.','error');}
};
$('deleteAll').onclick=()=>{
 if(!confirm('이 기기의 하루 기록과 개인 체크 항목을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;
 if(!confirm('한 번 더 확인합니다. 백업하지 않은 기록은 복구할 수 없습니다. 정말 초기화할까요?'))return;
 journal=emptyJournal();localStorage.removeItem(STORAGE);activeDate=localDateKey();renderToday();renderExplore();renderHistory();renderSettings();toast('이 기기의 기록을 초기화했습니다.');
};
const dialog=$('createDialog'),form=$('createForm'),error=$('createError');
function openDialog(){form.reset();$('choicesField').hidden=true;error.hidden=true;dialog.showModal();$('itemTitle').focus();}
for(const id of ['openCreateHero','openCreateInline','openCreateExplore','addBannerBtn'])$(id).onclick=openDialog;
$('closeDialog').onclick=$('cancelCreate').onclick=()=>dialog.close();
for(const control of form.querySelectorAll('input[name="kind"]'))control.onchange=()=>$('choicesField').hidden=form.elements.kind.value!=='choice';
form.onsubmit=async ev=>{
 ev.preventDefault();error.hidden=true;
 const kind=form.elements.kind.value,visibility=form.elements.visibility.value;
 const draft={title:$('itemTitle').value,kind,category:$('itemCategory').value,options:kind==='choice'?$('itemChoices').value.split(',').map(x=>x.trim()):[]};
 let item;try{item=validateItem(draft);}catch(err){error.textContent=err.message;error.hidden=false;return;}
 const all=[...DEFAULT_ITEMS,...journal.customItems,...journal.sharedItems,...publicItems,...curated];
 if(all.some(x=>x.title.toLocaleLowerCase('ko')===item.title.toLocaleLowerCase('ko'))){
  error.textContent='같은 이름의 체크 항목이 이미 있어요. 항목 찾기에서 확인하거나 이름을 바꿔 주세요.';error.hidden=false;return;
 }
 const submit=$('createSubmit');submit.disabled=true;
 if(visibility==='public'){
  try{
   if(!firebaseDb)throw Error('공유 라이브러리가 연결되지 않았습니다. 나만 사용으로 저장할 수 있어요.');
   const user=await signedUser();
   const id='s_'+crypto.randomUUID().replaceAll('-','');
   const batch=writeBatch(firebaseDb);
   batch.set(doc(firebaseDb,'publicItems',id),{...item,creatorUid:user.uid,createdAt:serverTimestamp()});
   batch.set(doc(firebaseDb,'contributorLimits',user.uid),{lastItemId:id,lastSubmittedAt:serverTimestamp()});
   await batch.commit();
   publicItems.unshift({...item,id,icon:CAT_ICONS[item.category]});
   journal.sharedItems.push({...item,id,icon:CAT_ICONS[item.category]});
   journal.selectedSharedIds.push(id);
   persist();dialog.close();renderExplore();renderToday();
   toast('모두의 체크 항목에 공유했어요! 개인 답변은 공개되지 않아요.');
  }catch(err){
   console.warn('Share failed',err);
   error.textContent='공유에 실패했습니다. 24시간에 1개만 공유할 수 있으며, 네트워크 연결도 필요합니다. 나만 사용으로 바꾸면 바로 저장할 수 있어요.';
   error.hidden=false;
  }finally{submit.disabled=false;}
 }else{
  if(journal.customItems.length>=80){error.textContent='나만의 항목은 최대 80개까지 저장할 수 있어요.';error.hidden=false;submit.disabled=false;return;}
  const local={...item,id:'l_'+crypto.randomUUID(),icon:CAT_ICONS[item.category]};
  journal.customItems.push(local);persist();dialog.close();renderToday();renderSettings();toast('나만의 체크 항목을 만들었어요.');submit.disabled=false;
 }
};
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
renderToday();renderExplore();renderHistory();renderSettings();connectPublic();
