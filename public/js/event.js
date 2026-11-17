import {initializeApp,getApps} from 'firebase/app';
import {getAuth,signInAnonymously,onAuthStateChanged} from 'firebase/auth';
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,updateDoc,onSnapshot,query,serverTimestamp,writeBatch,deleteDoc} from 'firebase/firestore';
import {allowedFields,htmlEscape as e,validateEvent,parseNameList,sumEvent,createCsv,feeItemsFor,groupExpected} from './event-core.js';

// Event invite URLs contain private attendee workflows. They must not appear in web search.
if(new URLSearchParams(location.search).has('id')){
 document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex,nofollow');
}
const root=document.getElementById('app');
const projectId='sosoking-481e6';
const state={app:null,db:null,auth:null,user:null,event:null,id:null,owner:false,member:null,groups:[],members:[],group:null,editingGroupId:null,editDirty:false,recoveryCode:null,unsub:[],pending:false};
const money=n=>Math.round(Number(n)||0).toLocaleString('ko-KR')+'원';
const $=id=>document.getElementById(id);
const errorText=err=>{
 let m=String(err?.message||err);
 if(m.includes('auth/operation-not-allowed'))return 'Firebase 익명 인증이 아직 활성화되지 않았습니다. 서비스 관리자에게 문의해 주세요.';
 if(m.includes('permission-denied')||m.includes('Missing or insufficient permissions'))return '접근 권한이 없습니다. 승인 여부 또는 서버 보안 설정을 확인해 주세요.';
 if(m.includes('unavailable')||m.includes('Failed to fetch'))return '서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
 return m.slice(0,240);
};
const message=(s,type='info')=>{const box=$('statusMessage');if(box){box.textContent=s;box.className='notice '+type;}else root.insertAdjacentHTML('afterbegin',`<div class="notice ${type}">${e(s)}</div>`);};
const stage=s=>root.innerHTML=s;
const safeInt=(x,max=100000000)=>Math.max(0,Math.min(max,Math.trunc(Number(x)||0)));
const randomSecret=()=>{const b=new Uint8Array(24);crypto.getRandomValues(b);return Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');};
const sha256=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
const eventRef=()=>doc(state.db,'events',state.id);
const groupRef=id=>doc(state.db,'events',state.id,'groups',id);
const memberRef=(uid=state.user.uid)=>doc(state.db,'events',state.id,'members',uid);
const ownRecoveryRef=()=>doc(state.db,'events',state.id,'recovery',state.user.uid);
const publicLink=id=>location.origin+'/event.html?id='+encodeURIComponent(id);
const groupTitle=id=>(state.event?.groups||[]).find(g=>g.id===id)?.name||'알 수 없는 단체';
function resetSubscriptions(){state.unsub.forEach(fn=>fn());state.unsub=[];}
function template(title,desc,content){return `<div class="wide-card"><h2>${e(title)}</h2>${desc?`<p class="muted lead">${e(desc)}</p>`:''}${content}</div>`;}
function renderFailure(err){stage(template('서비스 연결을 확인해 주세요',errorText(err),`<div class="notice warning">행사 참가자 정보는 서버에 안전하게 저장되어야 합니다. 연결되지 않은 상태에서는 명단을 수집하지 않습니다.</div><button class="btn secondary" id="reload">다시 시도</button>`));$('reload').onclick=()=>location.reload();}
async function setup(){
 try{
  // Firebase Hosting reserved endpoint exposes only public web app config; no secrets in source.
  const res=await fetch('/__/firebase/init.json',{cache:'no-store'});
  if(!res.ok)throw Error('Firebase 웹앱 설정을 불러오지 못했습니다. Firebase 프로젝트의 웹앱 등록을 확인해 주세요.');
  const config=await res.json();
  if(!config?.apiKey||!config?.projectId||config.projectId!==projectId)throw Error('Firebase 웹앱 설정이 올바르지 않습니다.');
  state.app=initializeApp(config);state.auth=getAuth(state.app);state.db=getFirestore(state.app);
  const info=await signInAnonymously(state.auth);state.user=info.user;
  const p=new URLSearchParams(location.search);state.id=p.get('id');
  if(state.id){if(!/^[A-Za-z0-9_-]{8,45}$/.test(state.id))throw Error('잘못된 행사 링크입니다.');await openEvent();}
  else renderLanding();
 }catch(err){console.error('SOSEVENT init',err);renderFailure(err);}
}
function renderLanding(){
 const saved=JSON.parse(localStorage.getItem('sosoking-event-ids')||'[]').slice(0,25);
 stage(`<div class="feature-cards">
 <div class="feature-card"><b>① 행사 만들기</b><span>행사명과 단체 이름만 입력하면 시작</span></div>
 <div class="feature-card"><b>② 카톡 링크 공유</b><span>가입 없이 승인 요청</span></div>
 <div class="feature-card"><b>③ 자동 집계</b><span>인원·명단·참가비 실시간 합계</span></div>
 </div>
 <div class="wide-card">
 <div class="card-top"><div><span class="eyebrow">STEP 01</span><h2>새 행사 만들기</h2></div><span class="soft-badge">총괄자 전용</span></div>
 <div id="statusMessage" class="notice" hidden></div>
 <form id="createForm" class="stack">
 <div class="form-grid"><div class="stack-sm"><label for="eventTitle" class="label">행사명 <b>*</b></label><input class="input" id="eventTitle" required maxlength="100" placeholder="예: 2027년 연합수련회"></div><div class="stack-sm"><label for="eventDate" class="label">행사 날짜 (선택)</label><input class="input" id="eventDate" type="date"></div></div>
 <div class="stack-sm"><label for="groupNames" class="label">소속 단체 · 팀 이름 <b>*</b></label><textarea id="groupNames" rows="4" class="input textarea" placeholder="한 줄에 하나씩 입력하세요.&#10;예: 천안서지방&#10;천안동지방&#10;천안남지방" required></textarea><span class="hint">소규모 모임이면 '전체' 하나만 입력하세요. 최대 80개 단체.</span></div>
 <fieldset class="choice-field"><legend class="label">어떤 정보를 받을까요?</legend>
 <label class="choice"><input type="radio" name="mode" value="count" checked><span><b>인원수만</b><small>단체별 참석 인원만 입력 · 개인정보 최소화</small></span></label>
 <label class="choice"><input type="radio" name="mode" value="names"><span><b>이름만</b><small>이름을 줄마다 입력하고 자동 집계</small></span></label>
 <label class="choice"><input type="radio" name="mode" value="custom"><span><b>상세 명단</b><small>기본 항목을 체크하거나 필요한 항목을 직접 추가</small></span></label></fieldset>
 <section id="fieldPicker" class="fields-panel" hidden>
 <div class="section-in-panel"><h3>상세명단 기본 항목</h3><p class="hint">이름은 항상 필수입니다. 받으려는 정보만 체크하세요.</p></div>
 <div class="option-grid">${allowedFields.filter(f=>f.key!=='name').map(f=>`<div class="base-field-row"><label class="checkrow"><input type="checkbox" name="field" value="${f.key}"> ${e(f.label)}</label><label class="checkrow required-field"><input type="checkbox" name="requiredField" value="${f.key}" disabled> 필수</label></div>`).join('')}</div>
 <div class="custom-config-head"><div><h3>직접 추가한 항목</h3><p class="hint">선택형을 고르면 보기(옵션값)를 자유롭게 입력할 수 있습니다.</p></div><button class="btn outline" id="addCustomField" type="button">＋ 항목 추가</button></div>
 <div id="customFieldsBox" class="custom-fields-list"></div>
 <div class="hint">최대 12개 추가 · 선택형 옵션 2~15개 · 개인정보는 꼭 필요한 경우에만 수집</div>
 </section>
 <div class="fee-line"><label class="checkrow"><input id="feeEnabled" type="checkbox"> <b>참가비 / 기타 비용 항목 사용</b></label>
 <div id="feeWrap" hidden>
 <div class="custom-config-head"><div><h3>참가비 항목</h3><p class="hint">종류마다 항목 이름과 금액을 정하세요. 예: 성인 20,000원 / 학생 10,000원 / 식비 5,000원.</p></div><button type="button" class="btn outline" id="addFee">＋ 참가비 추가</button></div>
 <div id="feeItemsBox" class="fee-items-list"></div>
 <p class="hint">상세명단은 참가자마다 해당 항목을 체크합니다. 인원수만·이름만 받는 경우에는 단체별로 항목당 적용 인원을 입력합니다. 여러 항목을 적용할 수도 있습니다.</p>
 </div></div>
 <div class="notice info"><b>개인정보 보호</b><br>승인받지 않은 담당자는 명단을 작성하거나 볼 수 없습니다. 승인된 담당자는 자기 단체 자료만 관리합니다. 개인정보 수집 안내는 총괄자가 참가자에게 제공해야 합니다.</div>
 <button id="createBtn" class="btn primary jumbo" type="submit">행사 생성하고 링크 만들기</button></form></div>
 ${saved.length?`<div class="wide-card"><h2>이 기기에서 만들었던 행사</h2><div class="saved-list">${saved.map(id=>`<a class="saved" href="/event.html?id=${encodeURIComponent(id)}">행사 열기 <small>${e(id.slice(0,9))}…</small> →</a>`).join('')}</div></div>`:''}`);
 const form=$('createForm');
 const picker=$('fieldPicker'),feeBox=$('feeItemsBox'),extraBox=$('customFieldsBox');
 form.querySelectorAll('input[name="mode"]').forEach(input=>input.onchange=()=>picker.hidden=form.elements.mode.value!=='custom');
 form.querySelectorAll('input[name="field"]').forEach(input=>input.onchange=()=>{
  const required=form.querySelector(`input[name="requiredField"][value="${input.value}"]`);
  required.disabled=!input.checked;
  if(!input.checked)required.checked=false;
 });
 function addExtra(item={}){
  if(extraBox.children.length>=12){alert('추가 항목은 12개까지 만들 수 있습니다.');return;}
  const el=document.createElement('div');el.className='config-item custom-field-row';
  el.innerHTML=`<div class="config-item-top"><strong>추가 항목 <span class="config-index"></span></strong><button type="button" class="btn small outline remove-config">삭제</button></div>
   <div class="form-grid"><label class="stack-sm"><span class="label">항목 이름</span><input data-extra-label class="input" maxlength="30" placeholder="예: 교회명, 참석 구분" value="${e(item.label||'')}"></label>
   <label class="stack-sm"><span class="label">입력 방식</span><select data-extra-type class="input"><option value="text">직접 입력</option><option value="select">옵션 선택</option></select></label></div>
   <label class="stack-sm extra-options"><span class="label">선택 옵션값 (쉼표 또는 줄바꿈으로 구분)</span><textarea data-extra-options class="input textarea" rows="2" placeholder="예: 일반, 학생, 교사">${e((item.options||[]).join(', '))}</textarea></label>
   <label class="checkrow"><input type="checkbox" data-extra-required ${item.required?'checked':''}> 필수 입력으로 지정</label>`;
  extraBox.append(el);
  const type=el.querySelector('[data-extra-type]');
  type.value=item.type==='select'?'select':'text';
  const update=()=>el.querySelector('.extra-options').hidden=type.value!=='select';
  type.onchange=update;update();
  el.querySelector('.remove-config').onclick=()=>{el.remove();recount(extraBox);};
  recount(extraBox);
 }
 function recount(box){[...box.children].forEach((el,i)=>{const n=el.querySelector('.config-index');if(n)n.textContent=i+1;});}
 $('addCustomField').onclick=()=>addExtra();
 function addFee(item={label:'',amount:''}){
  if(feeBox.children.length>=12){alert('참가비 항목은 12개까지 만들 수 있습니다.');return;}
  const el=document.createElement('div');el.className='config-item fee-item-row';
  el.innerHTML=`<div class="config-item-top"><strong>비용 항목 <span class="config-index"></span></strong><button type="button" class="btn small outline remove-config">삭제</button></div>
   <div class="form-grid"><label class="stack-sm"><span class="label">항목 이름</span><input data-fee-label class="input" maxlength="40" placeholder="예: 일반 참가비" value="${e(item.label)}"></label>
   <label class="stack-sm"><span class="label">금액 (원)</span><input data-fee-amount class="input" type="number" inputmode="numeric" min="0" max="100000000" step="1" placeholder="예: 20000" value="${e(item.amount)}"></label></div>`;
  feeBox.append(el);
  el.querySelector('.remove-config').onclick=()=>{el.remove();recount(feeBox);};
  recount(feeBox);
 }
 $('addFee').onclick=()=>addFee();
 $('feeEnabled').onchange=event=>{
  $('feeWrap').hidden=!event.target.checked;
  if(event.target.checked&&!feeBox.children.length)addFee({label:'참가비',amount:20000});
 };
 form.onsubmit=async ev=>{ev.preventDefault();if(state.pending)return;
  try{
   const customFields=[...extraBox.children].map(el=>({
    label:el.querySelector('[data-extra-label]').value,
    type:el.querySelector('[data-extra-type]').value,
    options:el.querySelector('[data-extra-options]').value,
    required:el.querySelector('[data-extra-required]').checked
   }));
   const feeItems=$('feeEnabled').checked?[...feeBox.children].map(el=>({
    label:el.querySelector('[data-fee-label]').value,
    amount:el.querySelector('[data-fee-amount]').value
   })):[];
   if($('feeEnabled').checked&&!feeItems.length)throw Error('참가비를 사용하려면 항목을 하나 이상 추가해 주세요.');
   const input=validateEvent({
    title:$('eventTitle').value,date:$('eventDate').value,groups:$('groupNames').value.split(/\r?\n/),
    mode:form.elements.mode.value,
    fields:[...form.querySelectorAll('input[name="field"]:checked')].map(x=>x.value),
    required:[...form.querySelectorAll('input[name="requiredField"]:checked')].map(x=>x.value),
    customFields,feeItems
   });
   state.pending=true;$('createBtn').disabled=true;$('createBtn').textContent='행사를 생성하고 있습니다…';
   const ref=doc(collection(state.db,'events'));
   const groups=input.groups.map(name=>({name,id:doc(collection(state.db,'events',ref.id,'groups')).id}));
   const code=randomSecret(),hash=await sha256(code);
   await setDoc(ref,{
    title:input.title,date:input.date,fee:input.fee,feeItems:input.feeItems,
    mode:input.mode,fields:input.fields,groups,ownerUid:state.user.uid,status:'open',createdAt:serverTimestamp()
   });
   const batch=writeBatch(state.db);
   for(const g of groups)batch.set(doc(state.db,'events',ref.id,'groups',g.id),{
    name:g.name,count:0,attendees:[],feeQuantities:{},paid:0,submitted:false,updatedAt:serverTimestamp()
   });
   batch.set(doc(state.db,'events',ref.id,'private','ownerRecovery'),{hash,createdAt:serverTimestamp()});
   await batch.commit();
   const ids=JSON.parse(localStorage.getItem('sosoking-event-ids')||'[]');
   localStorage.setItem('sosoking-event-ids',JSON.stringify([ref.id,...ids.filter(x=>x!==ref.id)].slice(0,30)));
   localStorage.setItem('sosoking-owner-code-'+ref.id,code);
   localStorage.setItem('sosoking-owner-code-new-'+ref.id,'true');
   location.href='/event.html?id='+encodeURIComponent(ref.id);
  }catch(err){
   state.pending=false;$('createBtn').disabled=false;$('createBtn').textContent='행사 생성하고 링크 만들기';
   message(errorText(err),'error');if($('statusMessage'))$('statusMessage').hidden=false;
  }
 };
}
async function openEvent(){
 const ref=eventRef();const snap=await getDoc(ref);
 if(!snap.exists())throw Error('행사를 찾을 수 없습니다. 행사 링크를 확인해 주세요.');
 state.event=snap.data();
 const oldRecovery=await getDoc(ownRecoveryRef()).catch(()=>null);
 state.owner=state.event.ownerUid===state.user.uid||!!oldRecovery?.exists();
 if(state.owner){showOwner();return;}
 state.unsub.push(onSnapshot(memberRef(),snap=>{state.member=snap.exists()?snap.data():null;if(state.member?.status==='approved')listenGroup(state.member.groupId);else {state.group=null;renderParticipant();}},err=>renderFailure(err)));
}
function listenGroup(groupId){
 if(state.groupListening===groupId)return;
 if(state.groupUnsub)state.groupUnsub();state.groupListening=groupId;
 state.groupUnsub=onSnapshot(groupRef(groupId),snap=>{state.group=snap.exists()?{id:snap.id,...snap.data()}:null;renderParticipant();},err=>renderFailure(err));
 state.unsub.push(()=>state.groupUnsub?.());
}
function sectionEventTitle(){
 const fees=feeItemsFor(state.event);
 return `<div class="event-banner"><div><span class="eyebrow">행사 참가 현황</span><h2>${e(state.event.title)}</h2>
 <p>${state.event.date?e(state.event.date)+' · ':''}${state.event.mode==='count'?'인원수만 제출':state.event.mode==='names'?'참가자 이름 제출':'상세 참가자 명단 제출'}${fees.length?' · 참가비 '+fees.length+'종':''}</p></div>
 <span class="soft-badge">${state.event.status==='open'?'접수 중':'접수 종료'}</span></div>`;
}
function renderParticipant(){
 const m=state.member;
 if(!m){stage(`${sectionEventTitle()}<div class="wide-card"><h2>참가 명단 등록 권한 요청</h2><p class="muted lead">총괄자 승인을 받은 담당자만 참가 정보를 작성·확인할 수 있습니다. 회원가입은 필요 없습니다.</p><form id="requestForm" class="stack"><div class="stack-sm"><label for="requestName" class="label">담당자 성함</label><input id="requestName" class="input" maxlength="60" required placeholder="성함 입력"></div><div class="stack-sm"><label for="requestGroup" class="label">담당 단체</label><select id="requestGroup" class="input" required>${state.event.groups.map(g=>`<option value="${e(g.id)}">${e(g.name)}</option>`).join('')}</select></div><div class="notice info">접근 요청을 보내면 총괄자가 성함과 소속을 확인한 뒤 승인합니다. <b>성함만 입력했다고 신원이 인증되는 것은 아니므로</b> 총괄자는 카카오톡 등 별도 방법으로 실제 담당자인지 확인해 주세요.</div><button class="btn primary jumbo" type="submit">승인 요청 보내기</button></form></div><div class="wide-card"><h2>행사 총괄자이신가요?</h2><p class="muted">다른 휴대전화에서 행사 관리 기능을 사용하려면 개설 시 보관한 관리자 복구 코드를 입력해 주세요.</p><form id="recoveryForm" class="stack"><label class="label" for="recoveryInput">관리자 복구 코드</label><input id="recoveryInput" class="input" type="password" required minlength="48" maxlength="48" autocomplete="off" placeholder="48자리 복구 코드"><button class="btn secondary" type="submit">총괄자 권한 복구</button></form></div>`);
  $('requestForm').onsubmit=async ev=>{ev.preventDefault();try{const name=$('requestName').value.trim(),groupId=$('requestGroup').value;if(!name||!state.event.groups.some(g=>g.id===groupId))throw Error('담당자 정보를 확인해 주세요.');await setDoc(memberRef(),{name:name.slice(0,60),groupId,status:'pending',requestedAt:serverTimestamp()});}catch(err){message(errorText(err),'error');}};
  $('recoveryForm').onsubmit=async ev=>{ev.preventDefault();const code=$('recoveryInput').value.trim().toLowerCase();if(!/^[a-f0-9]{48}$/.test(code)){alert('48자리 복구 코드를 확인해 주세요.');return;}try{await setDoc(ownRecoveryRef(),{hash:await sha256(code),createdAt:serverTimestamp()});localStorage.setItem('sosoking-owner-code-'+state.id,code);location.reload();}catch(err){message('복구 코드를 확인할 수 없습니다. 정확한 코드를 입력했는지 확인해 주세요.','error');}};return;
 }
 if(m.status==='pending'){stage(`${sectionEventTitle()}${template('접근 승인 대기 중','총괄자가 담당자 요청을 확인하고 있습니다. 승인이 완료되면 이 화면에서 명단을 작성할 수 있습니다.',`<div class="notice info">요청자: ${e(m.name)} · ${e(groupTitle(m.groupId))}<br>가입·로그인 없이 사용 중인 기기에서 승인을 기다리고 있습니다.</div><button id="refresh" class="btn secondary">새로고침</button>`)}`);$('refresh').onclick=()=>location.reload();return;}
 if(m.status==='rejected'){stage(`${sectionEventTitle()}${template('요청이 승인되지 않았습니다','행사 총괄자에게 직접 문의해 주세요.','')}`);return;}
 if(!state.group){stage(`${sectionEventTitle()}${template('명단을 불러오는 중입니다','승인된 단체 자료를 안전하게 확인하고 있습니다.','')}`);return;}
 const group=state.group;
 stage(`${sectionEventTitle()}<div class="wide-card"><div class="card-top"><div><span class="eyebrow">내 단체 · 승인 완료</span><h2>${e(groupTitle(m.groupId))}</h2></div><span class="soft-badge">담당자 ${e(m.name)}</span></div><div class="stat-strip"><span>현재 등록된 인원</span><strong>${group.count}명</strong></div><div id="statusMessage" class="notice" hidden></div><div id="editor"></div></div>`);
 renderEditor(group,false);
}
function showOwner(){
 state.unsub.push(onSnapshot(collection(state.db,'events',state.id,'groups'),snap=>{state.groups=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>state.event.groups.findIndex(g=>g.id===a.id)-state.event.groups.findIndex(g=>g.id===b.id));renderOwner();},err=>renderFailure(err)));
 state.unsub.push(onSnapshot(collection(state.db,'events',state.id,'members'),snap=>{state.members=snap.docs.map(d=>({uid:d.id,...d.data()}));renderOwner();},err=>renderFailure(err)));
}
function renderOwner(){
 const s=sumEvent(state.event,state.groups),link=publicLink(state.id),pending=state.members.filter(m=>m.status==='pending');
 const firstCode=localStorage.getItem('sosoking-owner-code-new-'+state.id)==='true';
 stage(`${sectionEventTitle()}${firstCode?`<div class="notice warning"><strong>중요: 관리자 복구 코드를 별도로 보관하세요.</strong> 기기를 변경하면 코드 없이는 이 행사의 총괄자 권한을 복구할 수 없습니다. 아래 '복구 코드 보기'를 눌러 복사하세요.</div>`:''}
 <div class="wide-card"><div class="card-top"><div><span class="eyebrow">행사 총괄자 전용</span><h2>실시간 집계 현황</h2></div><span class="soft-badge">서버 권한 보호</span></div><div class="stat-grid"><div class="stat-card"><span>전체 참가 인원</span><strong>${s.people}<small>명</small></strong></div><div class="stat-card"><span>단체 제출 현황</span><strong>${s.submitted}<small> / ${s.groups}</small></strong></div>${feeItemsFor(state.event).length?`<div class="stat-card"><span>참가비 예정</span><strong class="money">${money(s.expected)}</strong></div><div class="stat-card"><span>입금 확인액</span><strong class="money">${money(s.paid)}</strong></div>`:''}</div>
 <div class="share-box"><label class="label">카카오톡에 공유할 행사 링크</label><div class="share-line"><input class="input" aria-label="행사 주소" readonly value="${e(link)}" id="eventLink"><button class="btn secondary" id="copyEventLink" type="button">링크 복사</button></div><p class="hint">링크를 받은 사람이더라도 총괄자의 승인 전에는 참가 명단을 작성하거나 볼 수 없습니다.</p></div>
 <div class="actions"><button class="btn outline" id="downloadCsv">전체 명단 CSV 저장</button><button class="btn outline" id="showRecovery">관리자 복구 코드 보기</button><button class="btn outline" id="toggleEvent">${state.event.status==="open"?"접수 마감하기":"접수 다시 열기"}</button><button class="btn outline" id="removeEvent">행사 자료 삭제</button><a class="btn outline" href="/event.html">다른 행사 만들기</a></div><div id="statusMessage" class="notice" hidden></div></div>
 <div class="wide-card"><div class="card-top"><h2>담당자 승인 요청 <small>${pending.length}건</small></h2></div>${pending.length?pending.map(m=>`<div class="member-row"><div><strong>${e(m.name)}</strong><p>${e(groupTitle(m.groupId))} · 접속 권한 요청</p></div><div class="inline-buttons"><button class="btn small secondary approve" data-uid="${e(m.uid)}">승인</button><button class="btn small outline reject" data-uid="${e(m.uid)}">거절</button></div></div>`).join(''):'<p class="muted">현재 승인 대기 중인 담당자가 없습니다.</p>'}<div class="notice info">실제로 알고 있는 담당자인지 카카오톡이나 전화로 확인한 후 승인해 주세요. 승인하면 해당 기기에서 그 단체의 명단에 접근할 수 있습니다.</div></div>
 <div class="wide-card"><div class="card-top"><h2>단체별 참가 현황</h2><span class="soft-badge">${state.groups.length}개 단체</span></div><div class="group-list">${state.groups.map(g=>`<div class="group-row"><div><strong>${e(g.name)}</strong><p>${g.submitted?'제출 완료':'아직 미제출'}${feeItemsFor(state.event).length?' · 예정 '+money(groupExpected(state.event,g))+' · 입금 '+money(g.paid||0):''}</p></div><div class="group-end"><b>${g.count}명</b><button class="btn small outline group-edit" data-group="${e(g.id)}">${state.event.mode==='count'?'인원 수정':'명단 관리'}</button></div></div>`).join('')}</div>
 ${feeItemsFor(state.event).length?`<div class="admin-money"><h3>단체별 입금 확인</h3><p class="hint">신청 금액과 실제 입금액은 다릅니다. 입금 확인 후 금액을 직접 입력하세요.</p><div class="money-grid">${state.groups.map(g=>`<label class="money-row"><span>${e(g.name)}</span><input type="number" min="0" step="1" class="input paid-amount" value="${Number(g.paid)||0}" data-group="${e(g.id)}" aria-label="${e(g.name)} 입금액"></label>`).join('')}</div><button id="savePayments" class="btn secondary">입금액 저장</button></div>`:''}<div id="adminEditor"></div></div>
 <div class="wide-card"><h2>담당자 접근 권한</h2>${state.members.filter(m=>m.status==='approved').map(m=>`<div class="member-row"><div><strong>${e(m.name)}</strong><p>${e(groupTitle(m.groupId))} · 승인됨</p></div><button class="btn small outline revoke" data-uid="${e(m.uid)}">권한 취소</button></div>`).join('')||'<p class="muted">승인된 담당자가 없습니다.</p>'}</div>`);
 $('copyEventLink').onclick=async()=>{try{await navigator.clipboard.writeText(link);message('행사 링크를 복사했습니다. 카카오톡에 붙여 넣으세요.','success');}catch{message('링크를 복사할 수 없습니다. 주소를 길게 눌러 복사해 주세요.','error');}};
 $('showRecovery').onclick=async()=>{
  const code=localStorage.getItem('sosoking-owner-code-'+state.id);
  if(!code){message('이 기기에는 복구 코드가 없습니다. 최초 개설 기기에서 보관한 코드를 사용해 주세요.','error');return;}
  const ok=confirm('복구 코드는 관리자 권한을 복구할 수 있는 비밀값입니다. 남에게 전달하거나 행사 링크와 함께 공유하지 마세요. 복사하시겠습니까?');if(!ok)return;
  try{await navigator.clipboard.writeText(code);localStorage.removeItem('sosoking-owner-code-new-'+state.id);message('관리자 복구 코드를 복사했습니다. 안전한 곳에 보관하세요.','success');}catch{prompt('아래 복구 코드를 별도로 보관하세요.',code);}
 };
 $('downloadCsv').onclick=()=>{const csv=createCsv(state.event,state.groups),blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(state.event.title||'행사')+'-참가명단.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

 $('toggleEvent').onclick=async()=>{
  const status=state.event.status==='open'?'closed':'open';
  if(status==='closed'&&!confirm('행사를 마감하면 지방 담당자가 더 이상 명단을 수정할 수 없습니다. 마감하시겠습니까?'))return;
  try{await updateDoc(eventRef(),{status});state.event.status=status;renderOwner();}
  catch(err){message(errorText(err),'error');}
 };
 $('removeEvent').onclick=async()=>{
  const typed=prompt('이 행사의 참가자 정보와 관련 자료를 모두 삭제합니다. 복원할 수 없습니다.\n계속하려면 행사명을 정확하게 입력하세요.\n\n'+state.event.title);
  if(typed!==state.event.title)return;
  if(!confirm('정말 삭제하시겠습니까? 삭제 후에는 모든 행사 링크가 더 이상 작동하지 않습니다.'))return;
  try{
   const recoveries=await getDocs(collection(state.db,'events',state.id,'recovery'));
   const others=[
    ...state.groups.map(g=>groupRef(g.id)),
    ...state.members.map(m=>memberRef(m.uid)),
    doc(state.db,'events',state.id,'private','ownerRecovery')
   ];
   for(let i=0;i<others.length;i+=300){
    const batch=writeBatch(state.db);
    for(const ref of others.slice(i,i+300))batch.delete(ref);
    await batch.commit();
   }
   const batch=writeBatch(state.db);
   for(const found of recoveries.docs)batch.delete(found.ref);
   batch.delete(eventRef());
   await batch.commit();
   const ids=JSON.parse(localStorage.getItem('sosoking-event-ids')||'[]');
   localStorage.setItem('sosoking-event-ids',JSON.stringify(ids.filter(x=>x!==state.id)));
   localStorage.removeItem('sosoking-owner-code-'+state.id);
   localStorage.removeItem('sosoking-owner-code-new-'+state.id);
   location.href='/event.html';
  }catch(err){message('삭제를 완료하지 못했습니다. 다시 시도해 주세요. '+errorText(err),'error');}
 };

 root.querySelectorAll('.approve,.reject,.revoke').forEach(b=>b.onclick=async()=>{
  const uid=b.dataset.uid,person=state.members.find(m=>m.uid===uid);if(!person)return;
  if(b.classList.contains('revoke')&&!confirm(`${person.name}님의 접근 권한을 취소하시겠습니까?`))return;
  const next=b.classList.contains('approve')?'approved':'rejected';
  try{await updateDoc(memberRef(uid),{status:next,reviewedAt:serverTimestamp()});}catch(err){message(errorText(err),'error');}
 });
 root.querySelectorAll('.group-edit').forEach(b=>b.onclick=()=>{state.editingGroupId=b.dataset.group;const g=state.groups.find(x=>x.id===state.editingGroupId);if(g){renderEditor(g,true);$('adminEditor')?.scrollIntoView({behavior:'smooth',block:'start'});}});
 if(feeItemsFor(state.event).length)$('savePayments').onclick=async()=>{try{
  const values=[...root.querySelectorAll('.paid-amount')].map(el=>({id:el.dataset.group,paid:safeInt(el.value)}));
  const batch=writeBatch(state.db);values.forEach(v=>batch.update(groupRef(v.id),{paid:v.paid,updatedAt:serverTimestamp()}));await batch.commit();message('입금 확인 금액을 저장했습니다.','success');
 }catch(err){message(errorText(err),'error');}};
 if(state.editingGroupId){const g=state.groups.find(x=>x.id===state.editingGroupId);if(g)renderEditor(g,true);}
}
function renderEditor(group,isAdmin){
 const el=$(isAdmin?'adminEditor':'editor');if(!el)return;
 const fields=state.event.fields||[],mode=state.event.mode,fees=feeItemsFor(state.event);
 if(state.event.status!=='open'){el.innerHTML='<div class="notice warning">행사가 종료되어 명단을 수정할 수 없습니다.</div>';return;}
 if(isAdmin)el.innerHTML='<div class="editor-card"><h3>'+e(group.name)+' · 명단 직접 등록</h3><p class="hint">총괄자가 대신 작성할 수 있습니다.</p><div id="editorInner"></div></div>';
 const inner=isAdmin?el.querySelector('#editorInner'):el;
 const rows=(group.attendees||[]).map(row=>({...row}));
 const quantityMarkup=()=>{
  if(!fees.length||mode==='custom')return '';
  const old=group.feeQuantities||{};
  return `<div class="fee-quantity-panel">
   <div class="custom-config-head"><h3>참가비 항목별 인원</h3><span class="hint">비용이 적용되는 인원을 입력</span></div>
   <p class="hint">항목별로 몇 명에게 적용할지 입력하세요. 한 사람이 참가비와 식비를 모두 낼 수도 있습니다.</p>
   ${fees.map((fee,i)=>`<label class="fee-quantity-row"><span><strong>${e(fee.label)}</strong><small>1인 ${money(fee.amount)}</small></span>
   <input class="input fee-quantity" type="number" inputmode="numeric" min="0" max="20000" data-fee="${e(fee.id)}" value="${safeInt(old[fee.id]??(i===0?group.count:0),20000)}" aria-label="${e(fee.label)} 적용 인원"></label>`).join('')}
   <div class="fee-summary"><span>참가비 예상 합계</span><strong id="feeExpected">${money(groupExpected(state.event,group))}</strong></div>
  </div>`;
 };
 if(mode==='count'){
  inner.innerHTML=`<form id="groupSubmit" class="stack">
   <label class="label" for="groupCount">참가 인원수</label>
   <input class="input large" id="groupCount" type="number" inputmode="numeric" min="0" max="20000" value="${safeInt(group.count,20000)}" required>
   <p class="hint">이름이나 전화번호 없이 숫자만 제출합니다.</p>
   ${quantityMarkup()}
   <button type="submit" class="btn primary jumbo">인원수와 참가비 저장하기</button>
  </form>`;
 }else if(mode==='names'){
  inner.innerHTML=`<form id="groupSubmit" class="stack">
   <label class="label" for="namesArea">참가자 성함 (한 줄에 한 명)</label>
   <textarea class="input textarea large" id="namesArea" rows="9" placeholder="김철수&#10;이영희&#10;박민수">${e(rows.map(p=>p.name).join('\n'))}</textarea>
   <span class="hint">한 줄에 한 명씩 입력해 주세요. 최대 300명.</span>
   <div class="stat-strip"><span>입력 인원</span><strong id="nameCount">${rows.length}명</strong></div>
   ${quantityMarkup()}
   <button type="submit" class="btn primary jumbo">참가 명단 저장하기</button>
  </form>`;
 }else{
  inner.innerHTML=`<div class="stack">
   <h3>참가자 상세 명단</h3><p class="hint">선택한 항목만 표시됩니다. 이름은 필수, 한 단체당 최대 300명입니다.</p>
   ${fees.length?`<div class="notice info">참가자마다 해당 비용 항목에 체크해 주세요. 여러 항목을 선택할 수 있고, 하나도 선택하지 않으면 0원입니다.</div>`:''}
   <div class="entries" id="entryRows"></div>
   <button type="button" class="btn outline" id="addEntry">＋ 참가자 추가하기</button>
   <div class="stat-strip"><span>입력 인원</span><strong id="entryCount">${rows.length}명</strong></div>
   ${fees.length?`<div class="fee-summary"><span>참가비 예상 합계</span><strong id="allFeeExpected">${money(groupExpected(state.event,group))}</strong></div>`:''}
   <button type="button" class="btn primary jumbo" id="saveEntries">상세 명단 저장하기</button></div>`;
 }
 function readQuantities(count){
  const quantities={};
  for(const input of inner.querySelectorAll('.fee-quantity')){
   const value=Number(input.value);
   if(!Number.isInteger(value)||value<0||value>count)throw Error('참가비 항목별 적용 인원은 전체 참가 인원 이하로 입력해 주세요.');
   quantities[input.dataset.fee]=value;
  }
  return quantities;
 }
 function syncQuantityAndTotal(currentCount){
  const first=inner.querySelector('.fee-quantity');
  if(first&&!first.dataset.manual){first.value=String(currentCount);}
  const label=inner.querySelector('#feeExpected');
  if(label){
   let expected=0;
   for(const input of inner.querySelectorAll('.fee-quantity')){
    const item=fees.find(f=>f.id===input.dataset.fee);
    expected+=Math.max(0,Number(input.value)||0)*(item?.amount||0);
   }
   label.textContent=money(expected);
  }
 }
 for(const input of inner.querySelectorAll('.fee-quantity')){
  input.addEventListener('input',()=>{
   input.dataset.manual='1';
   const count=mode==='count'?safeInt(inner.querySelector('#groupCount').value,20000):
    parseNameList(inner.querySelector('#namesArea').value).length;
   syncQuantityAndTotal(count);
  });
 }
 const save=async (entries,feeQuantities={})=>{
  if(entries.length>300)throw Error('한 단체에서 명단은 최대 300명까지 등록할 수 있습니다.');
  if(entries.some(p=>!String(p.name||'').trim()))throw Error('모든 참가자의 성함을 입력해 주세요.');
  for(const field of fields)if(field.required&&entries.some(p=>!String(p[field.key]||'').trim()))throw Error(field.label+' 항목을 입력해 주세요.');
  if(Array.isArray(state.event.feeItems)&&mode==='custom'){
   for(const entry of entries){
    if(!Array.isArray(entry.feeIds)||entry.feeIds.some(id=>!fees.some(f=>f.id===id)))throw Error('참가비 선택값을 확인해 주세요.');
   }
  }
  await updateDoc(groupRef(group.id),{
   attendees:entries,count:entries.length,feeQuantities,submitted:true,updatedAt:serverTimestamp()
  });
 };
 if(mode==='count'){
  inner.querySelector('#groupCount').addEventListener('input',ev=>syncQuantityAndTotal(safeInt(ev.target.value,20000)));
  inner.querySelector('#groupSubmit').onsubmit=async ev=>{
   ev.preventDefault();
   const raw=Number(inner.querySelector('#groupCount').value);
   try{
    if(!Number.isInteger(raw)||raw<0||raw>20000)throw Error('전체 참가 인원을 0~20,000명으로 입력해 주세요.');
    const quantity=readQuantities(raw);
    await updateDoc(groupRef(group.id),{
     count:raw,attendees:[],feeQuantities:quantity,submitted:true,updatedAt:serverTimestamp()
    });
    message(raw+'명과 참가비 항목별 인원을 저장했습니다.','success');
    if($('statusMessage'))$('statusMessage').hidden=false;
   }catch(err){message(errorText(err),'error');if($('statusMessage'))$('statusMessage').hidden=false;}
  };
 }
 if(mode==='names'){
  inner.querySelector('#namesArea').addEventListener('input',ev=>{
   const count=parseNameList(ev.target.value).length;
   inner.querySelector('#nameCount').textContent=count+'명';
   syncQuantityAndTotal(count);
  });
  inner.querySelector('#groupSubmit').onsubmit=async ev=>{
   ev.preventDefault();
   try{
    const entries=parseNameList(inner.querySelector('#namesArea').value);
    const quantity=readQuantities(entries.length);
    await save(entries,quantity);
    message(entries.length+'명의 참가자 명단과 참가비를 저장했습니다.','success');
    if($('statusMessage'))$('statusMessage').hidden=false;
   }catch(err){message(errorText(err),'error');if($('statusMessage'))$('statusMessage').hidden=false;}
  };
 }
 if(mode==='custom'){
  const rowsBox=inner.querySelector('#entryRows');
  const optionsFor=field=>{
   if(field.type==='select'&&Array.isArray(field.options))return field.options;
   return field.key==='gender'?['남성','여성','미응답']:field.key==='meal'?['식사','미식사']:null;
  };
  function recount(){
   [...rowsBox.children].forEach((el,i)=>el.querySelector('.entry-index').textContent=i+1);
   inner.querySelector('#entryCount').textContent=rowsBox.children.length+'명';
   updateAllFees();
  }
  function feeSelectedInRow(row,fee,index){
   if(Array.isArray(row.feeIds))return row.feeIds.includes(fee.id);
   if(!Array.isArray(state.event.feeItems))return fee.id==='legacy';
   // New entries default to the first cost type; users can untick it for free attendance.
   return index===0;
  }
  function calcFeeForRow(el){
   return fees.reduce((sum,fee)=>sum+(el.querySelector(`input[data-fee="${fee.id}"]:checked`)?fee.amount:0),0);
  }
  function updateAllFees(){
   let total=0;
   for(const el of rowsBox.children){
    const amount=calcFeeForRow(el);total+=amount;
    const label=el.querySelector('.person-fee-total');if(label)label.textContent=money(amount);
   }
   const overall=inner.querySelector('#allFeeExpected');if(overall)overall.textContent=money(total);
  }
  function addRow(row={}){
   const wrapper=document.createElement('div');
   wrapper.className='entry-row';
   wrapper.innerHTML=`<div class="entry-head"><strong>참가자 <span class="entry-index"></span></strong><button type="button" class="btn small outline remove-entry">삭제</button></div>
    <div class="form-grid">${fields.map(f=>{
     const options=optionsFor(f),value=String(row[f.key]||'');
     return `<label class="stack-sm"><span class="label">${e(f.label)} ${f.required?'*':''}</span>
      ${options?`<select class="input" data-key="${e(f.key)}">
       <option value="">선택</option>${options.map(opt=>`<option value="${e(opt)}" ${value===opt?'selected':''}>${e(opt)}</option>`).join('')}
      </select>`:`<input class="input" data-key="${e(f.key)}" maxlength="${f.key==='name'?'60':'80'}" value="${e(value)}" placeholder="${e(f.label)}">`}
      </label>`;
    }).join('')}</div>
    ${fees.length?`<fieldset class="attendee-fees"><legend>적용 참가비 / 비용 항목</legend><div class="fee-check-list">
     ${fees.map((fee,i)=>`<label class="checkrow fee-check"><input type="checkbox" data-fee="${e(fee.id)}" ${feeSelectedInRow(row,fee,i)?'checked':''}><span>${e(fee.label)} <small>${money(fee.amount)}</small></span></label>`).join('')}
     </div><div class="person-fee-amount">해당 참가자 합계 <strong class="person-fee-total">0원</strong></div></fieldset>`:''}`;
   rowsBox.append(wrapper);
   wrapper.querySelector('.remove-entry').onclick=()=>{wrapper.remove();recount();};
   wrapper.querySelectorAll('input[data-fee]').forEach(chk=>chk.addEventListener('change',updateAllFees));
   recount();
  }
  rows.forEach(addRow);
  if(!rows.length)addRow();
  inner.querySelector('#addEntry').onclick=()=>{
   if(rowsBox.children.length>=300){alert('한 단체당 최대 300명까지 입력할 수 있습니다.');return;}
   addRow();
  };
  inner.querySelector('#saveEntries').onclick=async()=>{
   try{
    const entries=[...rowsBox.children].map(el=>{
     const data=Object.fromEntries([...el.querySelectorAll('[data-key]')].map(inp=>[inp.dataset.key,inp.value.trim()]));
     if(Array.isArray(state.event.feeItems))data.feeIds=[...el.querySelectorAll('input[data-fee]:checked')].map(inp=>inp.dataset.fee);
     return data;
    });
    await save(entries);
    message(entries.length+'명의 상세 명단과 참가비를 저장했습니다.','success');
    if($('statusMessage'))$('statusMessage').hidden=false;
   }catch(err){message(errorText(err),'error');if($('statusMessage'))$('statusMessage').hidden=false;}
  };
 }
}
setup();
