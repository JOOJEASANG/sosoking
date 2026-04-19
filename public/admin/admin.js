import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function toast(msg, type='info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(),300); }, 3000);
}

onAuthStateChanged(auth, user => { user ? renderDashboard(user) : renderLogin(); });

function renderLogin() {
  document.getElementById('admin-content').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="width:100%;max-width:360px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:40px;">⚖️</div>
          <div style="font-family:'Noto Serif KR',serif;font-size:20px;color:var(--gold);margin-top:8px;">소소킹 판결소</div>
          <div style="font-size:13px;color:var(--cream-dim);margin-top:4px;">관리자 페이지</div>
        </div>
        <form id="login-form">
          <div class="form-group"><label class="form-label">이메일</label><input type="email" id="em" class="form-input" required></div>
          <div class="form-group"><label class="form-label">비밀번호</label><input type="password" id="pw" class="form-input" required></div>
          <button type="submit" class="btn btn-primary" id="login-btn">로그인</button>
        </form>
      </div>
    </div>`;
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled=true; btn.textContent='로그인 중...';
    try { await signInWithEmailAndPassword(auth, document.getElementById('em').value, document.getElementById('pw').value); }
    catch(err) { toast('로그인 실패: '+err.message,'error'); btn.disabled=false; btn.textContent='로그인'; }
  });
}

let currentTab = 'cases';

function renderDashboard() {
  document.getElementById('admin-content').innerHTML = `
    <div>
      <div class="admin-header">
        <span class="logo">⚖️ 관리자</span>
        <button onclick="window._logout()" style="background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;">로그아웃</button>
      </div>
      <div style="max-width:900px;margin:0 auto;padding:20px;">
        <div class="admin-nav" id="admin-nav">
          ${[['cases','사건 목록'],['reports','신고 목록'],['settings','설정'],['biz','사업자 정보'],['policy','정책 문서']]
            .map(([id,label])=>`<button class="admin-tab${currentTab===id?' active':''}" onclick="window._tab('${id}')">${label}</button>`).join('')}
        </div>
        <div id="tab-content"></div>
      </div>
    </div>`;
  window._logout = async () => { await signOut(auth); };
  window._tab = tab => { currentTab=tab; document.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('active',b.textContent==={cases:'사건 목록',reports:'신고 목록',settings:'설정',biz:'사업자 정보',policy:'정책 문서'}[tab])); loadTab(tab); };
  loadTab(currentTab);
}

async function loadTab(tab) {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>';
  if (tab==='cases') await tabCases(el);
  else if (tab==='reports') await tabReports(el);
  else if (tab==='settings') await tabSettings(el);
  else if (tab==='biz') await tabBiz(el);
  else if (tab==='policy') await tabPolicy(el);
}

async function tabCases(el) {
  const snap = await getDocs(query(collection(db,'cases'),orderBy('createdAt','desc'),limit(50)));
  const rows = snap.docs.map(d=>{
    const c=d.data(), date=c.createdAt?.toDate?c.createdAt.toDate().toLocaleDateString('ko'):'-';
    return `<tr>
      <td><div style="font-weight:700;font-size:13px;">${c.caseTitle||'-'}</div><div style="font-size:11px;color:var(--cream-dim);">${c.nickname||'익명'} · ${date}</div></td>
      <td style="font-size:12px;color:var(--cream-dim);max-width:180px;">${(c.caseDescription||'').substring(0,50)}...</td>
      <td><span class="badge ${c.status==='completed'?'badge-gold':'badge-red'}">${c.status||'-'}</span></td>
      <td>
        <button onclick="window._hide('${d.id}')" style="background:none;border:1px solid var(--border);color:var(--cream-dim);padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;">숨김</button>
        <button onclick="window._del('${d.id}')" style="background:none;border:1px solid var(--red);color:var(--red);padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;margin-left:4px;">삭제</button>
      </td></tr>`;
  }).join('');
  el.innerHTML = `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>사건</th><th>내용</th><th>상태</th><th>관리</th></tr></thead><tbody>${rows||'<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--cream-dim);">사건 없음</td></tr>'}</tbody></table></div>`;
  window._hide = async id => { await updateDoc(doc(db,'cases',id),{status:'hidden'}); toast('숨김 처리됨','success'); loadTab('cases'); };
  window._del = async id => { if(!confirm('삭제하시겠습니까?'))return; await updateDoc(doc(db,'cases',id),{status:'deleted'}); toast('삭제됨','success'); loadTab('cases'); };
}

async function tabReports(el) {
  const snap = await getDocs(query(collection(db,'reports'),orderBy('createdAt','desc'),limit(50)));
  const rows = snap.docs.map(d=>{
    const r=d.data(), date=r.createdAt?.toDate?r.createdAt.toDate().toLocaleDateString('ko'):'-';
    return `<tr><td style="font-size:12px;">${r.caseId||'-'}</td><td>${r.reason||'-'}</td><td><span class="badge ${r.status==='resolved'?'badge-gold':'badge-red'}">${r.status||'pending'}</span></td><td style="font-size:12px;color:var(--cream-dim);">${date}</td><td><button onclick="window._resolve('${d.id}')" style="background:none;border:1px solid var(--gold);color:var(--gold);padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;">처리완료</button></td></tr>`;
  }).join('');
  el.innerHTML = `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>사건ID</th><th>신고사유</th><th>상태</th><th>날짜</th><th>관리</th></tr></thead><tbody>${rows||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--cream-dim);">신고 없음</td></tr>'}</tbody></table></div>`;
  window._resolve = async id => { await updateDoc(doc(db,'reports',id),{status:'resolved'}); toast('처리완료','success'); loadTab('reports'); };
}

async function tabSettings(el) {
  const snap = await getDoc(doc(db,'site_settings','config'));
  const d = snap.exists()?snap.data():{};
  el.innerHTML = `
    <form id="sf">
      <div class="form-group"><label class="form-label">일일 접수 한도</label><input type="number" id="dl" class="form-input" value="${d.dailyLimit||3}" min="1" max="20"></div>
      <div class="form-group"><label class="form-label">쿨다운 (초)</label><input type="number" id="cd" class="form-input" value="${d.cooldownSec||45}" min="0" max="300"></div>
      <div class="form-group"><label class="form-label">금칙어 (쉼표 구분)</label><textarea id="bw" class="form-textarea" style="min-height:80px;">${(d.bannedWords||[]).join(', ')}</textarea></div>
      <button type="submit" class="btn btn-primary">저장</button>
    </form>`;
  document.getElementById('sf').addEventListener('submit', async e => {
    e.preventDefault();
    await setDoc(doc(db,'site_settings','config'),{ ...( snap.exists()?snap.data():{} ), dailyLimit:parseInt(document.getElementById('dl').value), cooldownSec:parseInt(document.getElementById('cd').value), bannedWords:document.getElementById('bw').value.split(',').map(w=>w.trim()).filter(Boolean) },{merge:true});
    toast('저장되었습니다.','success');
  });
}

async function tabBiz(el) {
  const snap = await getDoc(doc(db,'site_settings','config'));
  const biz = snap.exists()?(snap.data().businessInfo||{}):{};
  const fields = [['companyName','사업자명'],['ceoName','대표자명'],['businessNumber','사업자등록번호'],['contact','연락처'],['email','이메일'],['address','주소']];
  el.innerHTML = `<form id="bf">${fields.map(([k,l])=>`<div class="form-group"><label class="form-label">${l}</label><input type="text" id="b_${k}" class="form-input" value="${biz[k]||''}"></div>`).join('')}<button type="submit" class="btn btn-primary">저장</button></form>`;
  document.getElementById('bf').addEventListener('submit', async e => {
    e.preventDefault();
    const businessInfo={}; fields.forEach(([k])=>{businessInfo[k]=document.getElementById(`b_${k}`).value.trim();});
    await setDoc(doc(db,'site_settings','config'),{businessInfo},{merge:true});
    toast('저장되었습니다.','success');
  });
}

async function tabPolicy(el) {
  const types=[['terms','이용약관'],['privacy','개인정보처리방침'],['ai_disclaimer','AI 서비스 안내']];
  const snaps=await Promise.all(types.map(([t])=>getDoc(doc(db,'policy_docs',t))));
  let active='terms';
  function render() {
    const idx=types.findIndex(([t])=>t===active);
    const content=snaps[idx].exists()?snaps[idx].data().content:'';
    el.innerHTML=`
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">${types.map(([t,l])=>`<button onclick="window._pt('${t}')" style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:${active===t?'var(--gold-dim)':'none'};color:${active===t?'var(--gold)':'var(--cream-dim)'};font-size:13px;cursor:pointer;">${l}</button>`).join('')}</div>
      <form id="pf"><div class="form-group"><label class="form-label">${types[idx][1]}</label><textarea id="pc" class="form-textarea" style="min-height:280px;">${content}</textarea></div><button type="submit" class="btn btn-primary">저장</button></form>`;
    document.getElementById('pf').addEventListener('submit', async e => {
      e.preventDefault();
      const val=document.getElementById('pc').value;
      await setDoc(doc(db,'policy_docs',active),{content:val,updatedAt:new Date()});
      snaps[idx]={exists:()=>true,data:()=>({content:val})};
      toast('저장되었습니다.','success');
    });
    window._pt=t=>{active=t;render();};
  }
  render();
}
