import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { firebaseConfig } from '../js/firebase-config.js';
import { escapeHtml, escapeAttr, compactText } from '../js/utils/sanitize.js?v=20260630-3';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let currentTab = 'overview';
let currentUser = null;

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 2800);
}

function fmtDate(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function money(n) { return '₩' + Math.round(Number(n || 0)).toLocaleString('ko-KR'); }
function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }

async function isAdminUser(user) {
  if (!user) return false;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) return renderLogin();
  document.getElementById('admin-content').innerHTML = '<div class="loading-dots" style="min-height:100vh;"><span></span><span></span><span></span></div>';
  const ok = await isAdminUser(user);
  ok ? renderDashboard() : renderNoAccess();
});

function renderLogin() {
  document.getElementById('admin-content').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div class="card" style="width:100%;max-width:390px;padding:26px;">
        <div style="text-align:center;margin-bottom:24px;">
          <img src="/app-icon.svg?v=20260630-3" style="width:70px;height:70px;margin-bottom:10px;" alt="">
          <div style="font-family:var(--font-serif);font-size:21px;color:var(--gold);font-weight:800;">소소킹 관리자</div>
          <div style="font-size:13px;color:var(--cream-dim);margin-top:4px;">사이트 · AI · 게시판 관리</div>
        </div>
        <button class="btn btn-secondary" id="google-admin" style="margin-bottom:16px;">Google 관리자 로그인</button>
        <form id="login-form">
          <div class="form-group"><label class="form-label">이메일</label><input type="email" id="em" class="form-input" required></div>
          <div class="form-group"><label class="form-label">비밀번호</label><input type="password" id="pw" class="form-input" required></div>
          <button type="submit" class="btn btn-primary" id="login-btn">이메일 로그인</button>
          <button type="button" id="reset-btn" style="width:100%;margin-top:10px;background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;padding:8px;">비밀번호 재설정</button>
        </form>
      </div>
    </div>`;

  document.getElementById('google-admin').onclick = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { toast('구글 로그인 실패: ' + err.message, 'error'); }
  };
  document.getElementById('reset-btn').onclick = async () => {
    const email = document.getElementById('em').value.trim();
    if (!email) return toast('이메일을 먼저 입력해주세요.', 'error');
    try { await sendPasswordResetEmail(auth, email); toast('재설정 메일을 보냈습니다.', 'success'); }
    catch (err) { toast('발송 실패: ' + err.message, 'error'); }
  };
  document.getElementById('login-form').onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = '로그인 중...';
    try { await signInWithEmailAndPassword(auth, document.getElementById('em').value.trim(), document.getElementById('pw').value); }
    catch (err) { toast('로그인 실패: ' + err.message, 'error'); btn.disabled = false; btn.textContent = '이메일 로그인'; }
  };
}

function renderNoAccess() {
  document.getElementById('admin-content').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;">
      <div class="card" style="max-width:430px;padding:26px;">
        <div style="font-size:46px;margin-bottom:12px;">🚫</div>
        <div style="font-family:var(--font-serif);font-size:20px;color:var(--gold);font-weight:800;margin-bottom:8px;">관리자 권한 없음</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin-bottom:20px;">로그인은 되었지만 관리자 명부에 없는 계정입니다.<br>Firestore의 <code>admins/${escapeHtml(currentUser?.uid || '')}</code> 문서가 필요합니다.</div>
        <button class="btn btn-secondary" id="noaccess-logout">로그아웃</button>
      </div>
    </div>`;
  document.getElementById('noaccess-logout').onclick = () => signOut(auth);
}

function renderDashboard() {
  const tabs = [
    ['overview','대시보드'], ['cases','사건'], ['board','게시판'], ['users','회원'],
    ['ai','AI 관리'], ['usage','사용량'], ['site','사이트 설정'], ['biz','사업자'], ['policy','정책']
  ];
  document.getElementById('admin-content').innerHTML = `
    <div>
      <div class="admin-header">
        <span class="logo">⚖️ 관리자 대시보드</span>
        <div style="display:flex;gap:10px;align-items:center;">
          <a href="/#/" style="font-size:12px;color:var(--cream-dim);text-decoration:none;">사이트 보기</a>
          <button onclick="window._logout()" style="background:none;border:none;color:var(--cream-dim);font-size:12px;cursor:pointer;">로그아웃</button>
        </div>
      </div>
      <div class="admin-shell">
        <div style="font-size:12px;color:var(--cream-dim);">관리자: ${escapeHtml(currentUser?.email || currentUser?.uid || '-')}</div>
        <div class="admin-nav">${tabs.map(([id,label]) => `<button class="admin-tab${currentTab === id ? ' active' : ''}" onclick="window._tab('${id}')">${label}</button>`).join('')}</div>
        <div id="tab-content"></div>
      </div>
    </div>`;
  window._logout = async () => signOut(auth);
  window._tab = tab => { currentTab = tab; renderDashboard(); };
  loadTab(currentTab);
}

async function loadTab(tab) {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>';
  try {
    if (tab === 'overview') await tabOverview(el);
    else if (tab === 'cases') await tabCases(el);
    else if (tab === 'board') await tabBoard(el);
    else if (tab === 'users') await tabUsers(el);
    else if (tab === 'ai') await tabAi(el);
    else if (tab === 'usage') await tabUsage(el);
    else if (tab === 'site') await tabSite(el);
    else if (tab === 'biz') await tabBiz(el);
    else if (tab === 'policy') await tabPolicy(el);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="card" style="color:var(--cream-dim);font-size:13px;">불러오기 실패<br><span style="font-size:11px;color:var(--red);">${escapeHtml(err.message || '')}</span></div>`;
  }
}

function mini(label, value, sub = '') {
  return `<div style="text-align:center;padding:15px 8px;background:rgba(255,255,255,.035);border:1px solid var(--border);border-radius:12px;"><div style="font-size:18px;font-weight:900;color:var(--cream);">${escapeHtml(String(value))}</div>${sub ? `<div style="font-size:10px;color:var(--gold);margin-top:2px;">${escapeHtml(String(sub))}</div>` : ''}<div style="font-size:10px;color:var(--cream-dim);margin-top:3px;">${escapeHtml(label)}</div></div>`;
}

async function tabOverview(el) {
  const [cases, results, users, reports, settingsSnap] = await Promise.all([
    getDocs(query(collection(db, 'cases'), orderBy('createdAt', 'desc'), limit(80))),
    getDocs(query(collection(db, 'results'), orderBy('createdAt', 'desc'), limit(80))),
    getDocs(query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(80))),
    getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(80))),
    getDoc(doc(db, 'site_settings', 'config')),
  ]);
  const s = settingsSnap.exists() ? settingsSnap.data() : {};
  const completed = cases.docs.filter(d => d.data().status === 'completed').length;
  const daily = results.docs.filter(d => d.data().source === 'daily_ai').length;
  const pendingReports = reports.docs.filter(d => (d.data().status || 'pending') === 'pending').length;
  el.innerHTML = `
    <div class="admin-grid">
      ${mini('최근 사건', cases.size + '건', completed + '건 완료')}
      ${mini('공개 판결', results.docs.filter(d => d.data().isPublic).length + '건', `AI 자동 ${daily}건`)}
      ${mini('회원', users.size + '명')}
      ${mini('미처리 신고', pendingReports + '건')}
    </div>
    <div class="card" style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin-bottom:16px;">
      <strong style="color:var(--gold);">AI 자동 사건</strong>: ${s.dailyAiEnabled === false ? '꺼짐' : '켜짐'} · 매일 오전 9시 기준 생성<br>
      <strong style="color:var(--gold);">접수 제한</strong>: 일 ${s.dailyLimit || 3}건 · 쿨다운 ${s.cooldownSec || 45}초
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div>${simpleList('최근 사건', cases.docs.slice(0, 6).map(d => [d.data().caseTitle, d.data().status, fmtDate(d.data().createdAt)]))}</div>
      <div>${simpleList('최근 공개 판결', results.docs.filter(d => d.data().isPublic).slice(0, 6).map(d => [d.data().caseTitle, d.data().source === 'daily_ai' ? 'AI 자동' : '사용자', fmtDate(d.data().createdAt)]))}</div>
    </div>`;
}

function simpleList(title, rows) {
  return `<div class="card"><div style="font-weight:800;color:var(--gold);margin-bottom:10px;">${title}</div>${rows.map(([a,b,c]) => `<div style="padding:8px 0;border-top:1px solid var(--border);font-size:12px;"><div style="font-weight:700;">${escapeHtml(a || '-')}</div><div style="color:var(--cream-dim);margin-top:2px;">${escapeHtml(b || '-')} · ${escapeHtml(c || '-')}</div></div>`).join('') || '<div style="color:var(--cream-dim);font-size:12px;">데이터 없음</div>'}</div>`;
}

async function tabCases(el) {
  const snap = await getDocs(query(collection(db, 'cases'), orderBy('createdAt', 'desc'), limit(100)));
  el.innerHTML = tableWrap(['사건','내용','상태','공개','관리'], snap.docs.map(d => {
    const c = d.data();
    return `<tr><td><b>${escapeHtml(c.caseTitle || '-')}</b><div style="font-size:11px;color:var(--cream-dim);">${escapeHtml(c.nickname || '익명')} · ${escapeHtml(fmtDate(c.createdAt))}</div></td><td>${escapeHtml(compactText(c.caseDescription || '', 80))}</td><td>${escapeHtml(c.status || '-')}</td><td>${c.isPublic ? '공개' : '비공개'}</td><td><div class="admin-actions"><button class="admin-btn gold" onclick="location.href='/#/result/${escapeAttr(d.id)}'">보기</button><button class="admin-btn" onclick="window._casePublic('${escapeAttr(d.id)}', ${!c.isPublic})">${c.isPublic ? '비공개' : '공개'}</button><button class="admin-btn red" onclick="window._delCase('${escapeAttr(d.id)}')">삭제</button></div></td></tr>`;
  }));
  window._casePublic = async (id, val) => { await updateDoc(doc(db, 'cases', id), { isPublic: val }); try { await updateDoc(doc(db, 'results', id), { isPublic: val, updatedAt: serverTimestamp() }); } catch {} toast('변경 완료', 'success'); loadTab('cases'); };
  window._delCase = async id => { if (!confirm('사건과 판결 결과를 삭제할까요?')) return; try { await deleteDoc(doc(db, 'results', id)); } catch {} await deleteDoc(doc(db, 'cases', id)); toast('삭제 완료', 'success'); loadTab('cases'); };
}

async function tabBoard(el) {
  const snap = await getDocs(query(collection(db, 'results'), orderBy('createdAt', 'desc'), limit(100)));
  el.innerHTML = tableWrap(['제목','처분','유형','공개','관리'], snap.docs.map(d => {
    const r = d.data();
    return `<tr><td><b>${escapeHtml(r.caseTitle || '-')}</b><div style="font-size:11px;color:var(--cream-dim);">${escapeHtml(fmtDate(r.createdAt))}</div></td><td>${escapeHtml(compactText(r.sentence || '', 70))}</td><td>${r.source === 'daily_ai' ? 'AI 자동' : '사용자'} · ${escapeHtml(r.judgeType || '-')}</td><td>${r.isPublic ? '공개' : '비공개'}</td><td><div class="admin-actions"><button class="admin-btn gold" onclick="location.href='/#/result/${escapeAttr(d.id)}'">보기</button><button class="admin-btn" onclick="window._resultPublic('${escapeAttr(d.id)}', ${!r.isPublic})">${r.isPublic ? '비공개' : '공개'}</button><button class="admin-btn red" onclick="window._delResult('${escapeAttr(d.id)}')">삭제</button></div></td></tr>`;
  }));
  window._resultPublic = async (id, val) => { await updateDoc(doc(db, 'results', id), { isPublic: val, updatedAt: serverTimestamp() }); try { await updateDoc(doc(db, 'cases', id), { isPublic: val }); } catch {} toast('변경 완료', 'success'); loadTab('board'); };
  window._delResult = async id => { if (!confirm('게시글/판결 결과를 삭제할까요?')) return; await deleteDoc(doc(db, 'results', id)); toast('삭제 완료', 'success'); loadTab('board'); };
}

async function tabUsers(el) {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(100)));
  el.innerHTML = tableWrap(['닉네임','이메일','가입방식','관리'], snap.docs.map(d => {
    const u = d.data();
    return `<tr><td><b>${escapeHtml(u.nickname || '-')}</b><div style="font-size:10px;color:var(--cream-dim);">${escapeHtml(d.id)}</div></td><td>${escapeHtml(u.email || '-')}</td><td>${escapeHtml(u.provider || '-')}</td><td><button class="admin-btn red" onclick="window._delUserProfile('${escapeAttr(d.id)}')">프로필 삭제</button></td></tr>`;
  }));
  window._delUserProfile = async id => { if (!confirm('Auth 계정은 삭제되지 않고 프로필 문서만 삭제됩니다. 계속할까요?')) return; await deleteDoc(doc(db, 'users', id)); toast('프로필 삭제 완료', 'success'); loadTab('users'); };
}

async function tabAi(el) {
  const snap = await getDoc(doc(db, 'site_settings', 'config'));
  const d = snap.exists() ? snap.data() : {};
  el.innerHTML = `
    <form id="ai-form">
      <div class="card" style="margin-bottom:16px;">
        <div style="font-weight:900;color:var(--gold);margin-bottom:12px;">🤖 AI 자동 사건 생성</div>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:14px;"><input type="checkbox" id="dailyOn" ${d.dailyAiEnabled === false ? '' : 'checked'}> 매일 자동 사건 생성 켜기</label>
        <div class="form-group"><label class="form-label">자동 생성 주제 힌트</label><textarea id="dailyHints" class="form-textarea" style="min-height:90px;" placeholder="예: 편의점, 회사, 가족, 친구, 음식, 카톡, 택배">${escapeHtml(d.dailyAiTopicHints || '')}</textarea></div>
        <div class="form-group"><label class="form-label">AI 추가 지시문</label><textarea id="dailyPrompt" class="form-textarea" style="min-height:150px;" placeholder="예: 너무 자극적인 소재는 피하고, 제목은 짧고 웃기게">${escapeHtml(d.dailyAiPrompt || '')}</textarea></div>
        <div class="form-group"><label class="form-label">Gemini 모델명</label><input type="text" id="model" class="form-input" value="${escapeAttr(d.geminiModel || 'gemini-2.5-flash')}"></div>
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div style="font-weight:900;color:var(--gold);margin-bottom:12px;">🚫 AI 안전 관리</div>
        <div class="form-group"><label class="form-label">금칙어</label><textarea id="banned" class="form-textarea" style="min-height:90px;">${escapeHtml((d.bannedWords || []).join(', '))}</textarea></div>
      </div>
      <button type="submit" class="btn btn-primary">AI 설정 저장</button>
    </form>
    <div class="disclaimer" style="margin-top:16px;font-size:12px;">자동 사건은 배포된 예약 함수가 매일 오전 9시(KST)에 생성합니다. 같은 날짜 문서가 있으면 중복 생성하지 않습니다.</div>`;
  document.getElementById('ai-form').onsubmit = async e => {
    e.preventDefault();
    await setDoc(doc(db, 'site_settings', 'config'), {
      dailyAiEnabled: document.getElementById('dailyOn').checked,
      dailyAiTopicHints: document.getElementById('dailyHints').value.trim(),
      dailyAiPrompt: document.getElementById('dailyPrompt').value.trim(),
      geminiModel: document.getElementById('model').value.trim() || 'gemini-2.5-flash',
      bannedWords: document.getElementById('banned').value.split(',').map(v => v.trim()).filter(Boolean),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    toast('AI 설정 저장 완료', 'success');
  };
}

async function tabUsage(el) {
  const settingsSnap = await getDoc(doc(db, 'site_settings', 'config'));
  const s = settingsSnap.exists() ? settingsSnap.data() : {};
  const inputPrice = Number(s.geminiInputPricePerM ?? 0.075);
  const outputPrice = Number(s.geminiOutputPricePerM ?? 0.30);
  const krw = Number(s.krwUsdRate ?? 1400);
  const monthlyBudgetKrw = Number(s.monthlyBudgetKrw ?? 50000);
  const days = [];
  for (let i = 0; i < 60; i++) { const dt = new Date(); dt.setDate(dt.getDate() - i); days.push(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt)); }
  const snaps = await Promise.all(days.map(date => getDoc(doc(db, 'usage_stats', `daily_${date}`))));
  const rows = days.map((date, i) => { const d = snaps[i].exists() ? snaps[i].data() : {}; const cost = (d.geminiInputTokens || 0) / 1e6 * inputPrice + (d.geminiOutputTokens || 0) / 1e6 * outputPrice; return { date, cases: d.caseCount || 0, req: d.geminiRequests || 0, input: d.geminiInputTokens || 0, output: d.geminiOutputTokens || 0, writes: d.firestoreWrites || 0, reads: d.firestoreReads || 0, inv: d.functionInvocations || 0, costKrw: Math.round(cost * krw) }; });
  const month = rows.reduce((a, r) => ({ cases: a.cases + r.cases, req: a.req + r.req, input: a.input + r.input, output: a.output + r.output, costKrw: a.costKrw + r.costKrw }), { cases: 0, req: 0, input: 0, output: 0, costKrw: 0 });
  el.innerHTML = `<div class="admin-grid">${mini('60일 사건', month.cases + '건')}${mini('Gemini 호출', month.req + '회')}${mini('토큰 입/출', `${num(month.input)} / ${num(month.output)}`)}${mini('예상 AI 비용', money(month.costKrw), monthlyBudgetKrw ? (month.costKrw / monthlyBudgetKrw * 100).toFixed(1) + '%' : '')}</div>${tableWrap(['날짜','사건','Gemini','토큰','Firestore','Functions','예상비용'], rows.filter(r => r.cases || r.req).slice(0, 40).map(r => `<tr><td>${r.date}</td><td>${r.cases}</td><td>${r.req}</td><td>${num(r.input)} / ${num(r.output)}</td><td>R ${num(r.reads)} / W ${num(r.writes)}</td><td>${r.inv}</td><td>${money(r.costKrw)}</td></tr>`))}`;
}

async function tabSite(el) {
  const snap = await getDoc(doc(db, 'site_settings', 'config'));
  const d = snap.exists() ? snap.data() : {};
  el.innerHTML = `
    <form id="site-form">
      <div class="form-group"><label class="form-label">일일 접수 한도</label><input type="number" id="dl" class="form-input" value="${escapeAttr(d.dailyLimit || 3)}" min="1" max="20"></div>
      <div class="form-group"><label class="form-label">재접수 대기시간(초)</label><input type="number" id="cd" class="form-input" value="${escapeAttr(d.cooldownSec || 45)}" min="0" max="300"></div>
      <div class="form-group"><label class="form-label">Gemini 입력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gip" class="form-input" value="${escapeAttr(d.geminiInputPricePerM ?? 0.075)}"></div>
      <div class="form-group"><label class="form-label">Gemini 출력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gop" class="form-input" value="${escapeAttr(d.geminiOutputPricePerM ?? 0.30)}"></div>
      <div class="form-group"><label class="form-label">원-달러 환율</label><input type="number" id="krw" class="form-input" value="${escapeAttr(d.krwUsdRate ?? 1400)}"></div>
      <div class="form-group"><label class="form-label">월 예산 기준(원)</label><input type="number" id="budget" class="form-input" value="${escapeAttr(d.monthlyBudgetKrw ?? 50000)}"></div>
      <button type="submit" class="btn btn-primary">사이트 설정 저장</button>
    </form>`;
  document.getElementById('site-form').onsubmit = async e => {
    e.preventDefault();
    await setDoc(doc(db, 'site_settings', 'config'), {
      dailyLimit: parseInt(document.getElementById('dl').value, 10),
      cooldownSec: parseInt(document.getElementById('cd').value, 10),
      geminiInputPricePerM: parseFloat(document.getElementById('gip').value),
      geminiOutputPricePerM: parseFloat(document.getElementById('gop').value),
      krwUsdRate: parseFloat(document.getElementById('krw').value),
      monthlyBudgetKrw: parseFloat(document.getElementById('budget').value),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    toast('저장되었습니다.', 'success');
  };
}

async function tabBiz(el) {
  const snap = await getDoc(doc(db, 'site_settings', 'config'));
  const biz = snap.exists() ? (snap.data().businessInfo || {}) : {};
  const fields = [['companyName','사업자명'],['ceoName','대표자명'],['businessNumber','사업자등록번호'],['contact','연락처'],['email','이메일'],['address','주소']];
  el.innerHTML = `<form id="biz-form">${fields.map(([k,l]) => `<div class="form-group"><label class="form-label">${l}</label><input type="text" id="b_${k}" class="form-input" value="${escapeAttr(biz[k] || '')}"></div>`).join('')}<button type="submit" class="btn btn-primary">저장</button></form>`;
  document.getElementById('biz-form').onsubmit = async e => { e.preventDefault(); const businessInfo = {}; fields.forEach(([k]) => businessInfo[k] = document.getElementById(`b_${k}`).value.trim()); await setDoc(doc(db, 'site_settings', 'config'), { businessInfo, updatedAt: serverTimestamp() }, { merge: true }); toast('저장되었습니다.', 'success'); };
}

async function tabPolicy(el) {
  const types = [['terms','이용약관'],['privacy','개인정보처리방침'],['ai_disclaimer','AI 서비스 안내']];
  const defaults = { terms: '소소킹 판결소 이용약관\n\n본 서비스는 AI 기반 오락 서비스이며 실제 법률 자문이 아닙니다.', privacy: '소소킹 판결소 개인정보처리방침\n\n본 서비스는 Firebase 인증과 사건 접수 내용을 처리합니다.', ai_disclaimer: 'AI 서비스 이용 안내\n\nAI가 생성한 판결문은 오락 목적이며 법적 효력이 없습니다.' };
  const snaps = await Promise.all(types.map(([t]) => getDoc(doc(db, 'policy_docs', t))));
  let active = 'terms';
  function render() {
    const idx = types.findIndex(([t]) => t === active);
    const content = snaps[idx].exists() ? snaps[idx].data().content : defaults[active];
    el.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;">${types.map(([t,l]) => `<button class="admin-tab${active === t ? ' active' : ''}" onclick="window._pt('${t}')">${l}</button>`).join('')}</div><form id="policy-form"><div class="form-group"><label class="form-label">${types[idx][1]}</label><textarea id="pc" class="form-textarea" style="min-height:330px;">${escapeHtml(content)}</textarea></div><button type="submit" class="btn btn-primary">저장</button></form>`;
    document.getElementById('policy-form').onsubmit = async e => { e.preventDefault(); const val = document.getElementById('pc').value; await setDoc(doc(db, 'policy_docs', active), { content: val, updatedAt: serverTimestamp() }); snaps[idx] = { exists: () => true, data: () => ({ content: val }) }; toast('저장되었습니다.', 'success'); };
    window._pt = t => { active = t; render(); };
  }
  render();
}

function tableWrap(headers, rows) {
  return `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${headers.length}" style="text-align:center;padding:32px;color:var(--cream-dim);">데이터 없음</td></tr>`}</tbody></table></div>`;
}
