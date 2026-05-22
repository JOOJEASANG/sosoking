import { auth, db } from './firebase.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { appState } from './state.js';
import { toast } from './components/toast.js';

function esc(v){return String(v||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function isAdminPage(){return (location.hash||'').startsWith('#/admin');}
function removeButton(){document.getElementById('feedback-open-btn')?.remove();}
function getPageContext(){const hash=location.hash||'#/';return{hash,path:location.pathname,url:`${location.origin}${location.pathname}${hash}`,title:document.title||'소소킹'};}

function openFeedbackModal(){
  removeButton();
  if(isAdminPage())return;
  if(!auth.currentUser){toast.warn('로그인 후 의견이나 버그를 보낼 수 있어요.');navigate('/login');return;}
  document.getElementById('feedback-modal')?.remove();
  const page=getPageContext();
  const overlay=document.createElement('div');
  overlay.id='feedback-modal';overlay.className='feedback-modal';
  overlay.innerHTML=`<div class="feedback-modal__backdrop"></div><div class="feedback-modal__panel" role="dialog" aria-modal="true" aria-label="의견 및 버그 신고"><div class="feedback-modal__header"><div><div class="feedback-modal__eyebrow">소소킹 제작중</div><div class="feedback-modal__title">의견 · 버그 신고</div></div><button type="button" class="feedback-modal__close" id="feedback-close" aria-label="닫기">✕</button></div><div class="feedback-modal__body"><div class="feedback-type-tabs" role="tablist"><label class="feedback-type-tab active"><input type="radio" name="feedback-type" value="bug" checked><span>🐞 버그</span></label><label class="feedback-type-tab"><input type="radio" name="feedback-type" value="opinion"><span>💡 의견</span></label><label class="feedback-type-tab"><input type="radio" name="feedback-type" value="feature"><span>✨ 기능제안</span></label></div><div class="form-group"><label class="form-label">제목 <span class="required">*</span></label><input id="feedback-title" class="form-input" maxlength="80" placeholder="예: 모바일에서 버튼이 안 눌려요"></div><div class="form-group"><label class="form-label">내용 <span class="required">*</span></label><textarea id="feedback-message" class="form-textarea" rows="6" maxlength="1000" placeholder="어떤 화면에서 어떤 문제가 있었는지 최대한 자세히 적어주세요."></textarea><div class="form-hint">현재 페이지 주소, 브라우저 정보가 함께 저장됩니다.</div></div><div class="form-group"><label class="form-label">답변 받을 연락처 <span style="font-size:11px;color:var(--color-text-muted)">(선택)</span></label><input id="feedback-contact" class="form-input" maxlength="120" placeholder="이메일, 카톡 오픈채팅 등"></div><div class="feedback-page-box"><div class="feedback-page-box__label">현재 페이지</div><div class="feedback-page-box__url">${esc(page.url)}</div></div></div><div class="feedback-modal__footer"><button type="button" class="btn btn--ghost" id="feedback-cancel">취소</button><button type="button" class="btn btn--primary" id="feedback-submit">보내기</button></div></div>`;
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();
  overlay.querySelector('#feedback-close')?.addEventListener('click',close);
  overlay.querySelector('#feedback-cancel')?.addEventListener('click',close);
  overlay.querySelector('.feedback-modal__backdrop')?.addEventListener('click',close);
  overlay.querySelectorAll('[name="feedback-type"]').forEach(input=>input.addEventListener('change',()=>overlay.querySelectorAll('.feedback-type-tab').forEach(label=>label.classList.toggle('active',!!label.querySelector('input')?.checked))));
  overlay.querySelector('#feedback-submit')?.addEventListener('click',()=>submitFeedback(overlay));
  setTimeout(()=>overlay.querySelector('#feedback-title')?.focus(),50);
}

async function submitFeedback(overlay){
  const user=auth.currentUser;if(!user)return;
  const type=overlay.querySelector('[name="feedback-type"]:checked')?.value||'bug';
  const title=overlay.querySelector('#feedback-title')?.value.trim()||'';
  const message=overlay.querySelector('#feedback-message')?.value.trim()||'';
  const contact=overlay.querySelector('#feedback-contact')?.value.trim()||'';
  const btn=overlay.querySelector('#feedback-submit');
  if(!title){toast.warn('제목을 입력해주세요.');return;}
  if(!message||message.length<5){toast.warn('내용을 5자 이상 입력해주세요.');return;}
  try{btn.disabled=true;btn.textContent='전송 중...';await addDoc(collection(db,'feedback'),{type,title:title.slice(0,80),message:message.slice(0,1000),contact:contact.slice(0,120),status:'new',page:getPageContext(),userAgent:navigator.userAgent||'',reporterId:user.uid,reporterName:appState.nickname||user.displayName||user.email?.split('@')[0]||'익명',reporterEmail:user.email||'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});overlay.remove();toast.success('접수됐어요. 확인해볼게요!');}
  catch(e){console.error(e);toast.error('전송에 실패했어요. 잠시 후 다시 시도해주세요.');btn.disabled=false;btn.textContent='보내기';}
}

function makeFeedbackButton(cls=''){const btn=document.createElement('button');btn.type='button';btn.className=`btn btn--ghost btn--sm account-feedback-btn ${cls}`.trim();btn.innerHTML='💬 의견·버그';btn.addEventListener('click',openFeedbackModal);return btn;}
function ensureFeedbackEntrypoints(){
  removeButton();if(isAdminPage())return;
  const accountActions=document.querySelector('.account-profile-actions');
  if(accountActions&&!accountActions.querySelector('.account-feedback-btn')){const logout=accountActions.querySelector('#btn-logout');const btn=makeFeedbackButton('account-feedback-btn--profile');logout?accountActions.insertBefore(btn,logout):accountActions.appendChild(btn);}
  const sidebarWrap=document.querySelector('.sidebar__user-wrap');
  if(sidebarWrap&&!sidebarWrap.querySelector('.account-feedback-btn')){const logout=sidebarWrap.querySelector('#sb-logout-btn');const btn=makeFeedbackButton('account-feedback-btn--sidebar');logout?sidebarWrap.insertBefore(btn,logout):sidebarWrap.appendChild(btn);}
}

function statusLabel(s){return s==='done'?'처리완료':s==='reviewing'?'확인중':'신규';}
function typeLabel(t){return t==='opinion'?'💡 의견':t==='feature'?'✨ 기능제안':'🐞 버그';}
async function firestoreAdmin(){return import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');}
async function renderFeedbackAdmin(){
  const content=document.getElementById('admin-content');if(!content)return;
  content.innerHTML='<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
  const {query,orderBy,limit,getDocs,doc,updateDoc,deleteDoc}=await firestoreAdmin();
  const snap=await getDocs(query(collection(db,'feedback'),orderBy('createdAt','desc'),limit(80))).catch(()=>null);
  const items=snap?.docs.map(d=>({id:d.id,...d.data()}))||[];
  const counts={new:items.filter(i=>(i.status||'new')==='new').length,reviewing:items.filter(i=>i.status==='reviewing').length,done:items.filter(i=>i.status==='done').length};
  content.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px"><h2 class="admin-section-title">💬 의견 · 버그 접수함</h2><div class="admin-stat-grid" style="grid-template-columns:repeat(3,1fr)"><div class="admin-stat-card"><div class="admin-stat-card__num" style="color:var(--color-primary)">${counts.new}</div><div class="admin-stat-card__label">신규</div></div><div class="admin-stat-card"><div class="admin-stat-card__num" style="color:#b77900">${counts.reviewing}</div><div class="admin-stat-card__label">확인중</div></div><div class="admin-stat-card"><div class="admin-stat-card__num" style="color:var(--color-success)">${counts.done}</div><div class="admin-stat-card__label">처리완료</div></div></div><div class="card"><div class="card__body--lg">${items.length?items.map(item=>`<div class="admin-feedback-item" data-feedback-id="${esc(item.id)}"><div class="admin-feedback-item__top"><div><div class="admin-feedback-item__title">${typeLabel(item.type)} ${esc(item.title||'(제목없음)')}</div><div class="admin-feedback-item__meta">${esc(item.reporterName||'익명')} · ${item.createdAt?.toDate?.().toLocaleString('ko-KR')||'-'}</div></div><span class="feedback-status-badge feedback-status-badge--${esc(item.status||'new')}">${statusLabel(item.status||'new')}</span></div><div class="admin-feedback-item__message">${esc(item.message||'').replace(/\n/g,'<br>')}</div>${item.contact?`<div class="admin-feedback-item__line"><b>연락처</b> ${esc(item.contact)}</div>`:''}${item.page?.url?`<div class="admin-feedback-item__line"><b>페이지</b> <a href="${esc(item.page.url)}" target="_blank" rel="noopener">${esc(item.page.url)}</a></div>`:''}<div class="admin-feedback-item__actions"><button class="btn btn--ghost btn--sm" data-feedback-status="reviewing" data-id="${esc(item.id)}">확인중</button><button class="btn btn--ghost btn--sm" data-feedback-status="done" data-id="${esc(item.id)}">처리완료</button><button class="btn btn--ghost btn--sm" data-feedback-delete="${esc(item.id)}" style="color:var(--color-danger)">삭제</button></div></div>`).join(''):'<div style="text-align:center;padding:28px;color:var(--color-text-muted);font-size:13px">접수된 의견이나 버그가 없습니다.</div>'}</div></div></div>`;
  content.querySelectorAll('[data-feedback-status]').forEach(btn=>btn.addEventListener('click',async()=>{try{await updateDoc(doc(db,'feedback',btn.dataset.id),{status:btn.dataset.feedbackStatus,updatedAt:serverTimestamp()});toast.success('상태를 변경했어요');renderFeedbackAdmin();}catch{toast.error('상태 변경에 실패했어요');}}));
  content.querySelectorAll('[data-feedback-delete]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('이 접수 항목을 삭제할까요?'))return;try{await deleteDoc(doc(db,'feedback',btn.dataset.feedbackDelete));toast.success('삭제했어요');renderFeedbackAdmin();}catch{toast.error('삭제에 실패했어요');}}));
}
function ensureAdminFeedbackMenu(){
  const nav=document.querySelector('.admin-layout .admin-nav');const content=document.getElementById('admin-content');
  if(!nav||!content||nav.querySelector('[data-admin-feedback-tab]'))return;
  const reportsBtn=nav.querySelector('[data-admin-tab="reports"], [data-tab="reports"]');
  const btn=document.createElement('button');btn.className='admin-menu-item';btn.dataset.adminFeedbackTab='1';btn.innerHTML='<span class="admin-menu-item__icon">💬</span><span class="admin-menu-item__label">의견·버그</span>';
  btn.addEventListener('click',()=>{document.querySelectorAll('.admin-menu-item').forEach(b=>b.classList.toggle('active',b===btn));renderFeedbackAdmin();});
  reportsBtn?.insertAdjacentElement('afterend',btn)||nav.appendChild(btn);
}
function run(){ensureFeedbackEntrypoints();ensureAdminFeedbackMenu();}

removeButton();window.openSosokingFeedback=openFeedbackModal;window.addEventListener('sosoking:open-feedback',openFeedbackModal);
let timer=null;function schedule(){clearTimeout(timer);timer=setTimeout(run,180);}
window.addEventListener('hashchange',schedule);window.addEventListener('themechange',schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});setTimeout(run,500);
