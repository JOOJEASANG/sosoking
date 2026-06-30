import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { firebaseConfig } from '../js/firebase-config.js';
import { escapeHtml, escapeAttr, compactText } from '../js/utils/sanitize.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentTab = 'cases';
let currentUser = null;

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function fmtDate(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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
  if (!user) {
    renderLogin();
    return;
  }
  document.getElementById('admin-content').innerHTML = '<div class="loading-dots" style="min-height:100vh;"><span></span><span></span><span></span></div>';
  const ok = await isAdminUser(user);
  ok ? renderDashboard() : renderNoAccess();
});

function renderLogin() {
  document.getElementById('admin-content').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="width:100%;max-width:360px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-size:44px;">⚖️</div>
          <div style="font-family:'Noto Serif KR',serif;font-size:20px;color:var(--gold);margin-top:8px;">소소킹 판결소</div>
          <div style="font-size:13px;color:var(--cream-dim);margin-top:4px;">관리자 전용 생활법정 기록실</div>
        </div>
        <form id="login-form">
          <div class="form-group"><label class="form-label">이메일</label><input type="email" id="em" class="form-input" required></div>
          <div class="form-group"><label class="form-label">비밀번호</label><input type="password" id="pw" class="form-input" required></div>
          <button type="submit" class="btn btn-primary" id="login-btn">로그인</button>
          <button type="button" id="reset-btn" style="width:100%;margin-top:10px;background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;padding:8px;">비밀번호를 잊으셨나요?</button>
        </form>
      </div>
    </div>`;

  document.getElementById('reset-btn').addEventListener('click', async () => {
    const email = document.getElementById('em').value.trim();
    if (!email) { toast('이메일을 먼저 입력해주세요.', 'error'); return; }
    try { await sendPasswordResetEmail(auth, email); toast('비밀번호 재설정 메일을 발송했습니다.', 'success'); }
    catch (err) { toast('발송 실패: ' + err.message, 'error'); }
  });

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = '로그인 중...';
    try {
      await signInWithEmailAndPassword(auth, document.getElementById('em').value, document.getElementById('pw').value);
    } catch (err) {
      toast('로그인 실패: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '로그인';
    }
  });
}

function renderNoAccess() {
  document.getElementById('admin-content').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;">
      <div class="card" style="max-width:420px;">
        <div style="font-size:44px;margin-bottom:12px;">🚫</div>
        <div style="font-family:var(--font-serif);font-size:20px;color:var(--gold);font-weight:700;margin-bottom:8px;">관리자 권한 없음</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin-bottom:20px;">로그인은 되었지만 관리자 명부에 없는 계정입니다.<br>판사석은 아무나 앉을 수 없습니다.</div>
        <button class="btn btn-secondary" id="noaccess-logout">로그아웃</button>
      </div>
    </div>`;
  document.getElementById('noaccess-logout').onclick = () => signOut(auth);
}

function renderDashboard() {
  document.getElementById('admin-content').innerHTML = `
    <div>
      <div class="admin-header">
        <span class="logo">⚖️ 관리자</span>
        <button onclick="window._logout()" style="background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;">로그아웃</button>
      </div>
      <div style="max-width:960px;margin:0 auto;padding:20px;">
        <div style="font-size:12px;color:var(--cream-dim);margin-bottom:12px;">현재 계정: ${escapeHtml(currentUser?.email || currentUser?.uid || '-')}</div>
        <div class="admin-nav" id="admin-nav">
          ${[
            ['cases','사건 목록'],['reports','신고 목록'],['usage','사용량·비용'],['settings','설정'],['biz','사업자 정보'],['policy','정책 문서']
          ].map(([id,label]) => `<button class="admin-tab${currentTab === id ? ' active' : ''}" onclick="window._tab('${id}')">${label}</button>`).join('')}
        </div>
        <div id="tab-content"></div>
      </div>
    </div>`;
  window._logout = async () => { await signOut(auth); };
  window._tab = tab => { currentTab = tab; renderDashboard(); };
  loadTab(currentTab);
}

async function loadTab(tab) {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>';
  try {
    if (tab === 'cases') await tabCases(el);
    else if (tab === 'reports') await tabReports(el);
    else if (tab === 'usage') await tabUsage(el);
    else if (tab === 'settings') await tabSettings(el);
    else if (tab === 'biz') await tabBiz(el);
    else if (tab === 'policy') await tabPolicy(el);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="card" style="color:var(--cream-dim);font-size:13px;">불러오기 실패<br><span style="font-size:11px;color:var(--red);">${escapeHtml(err.message || '')}</span></div>`;
  }
}

async function tabCases(el) {
  const snap = await getDocs(query(collection(db, 'cases'), orderBy('createdAt', 'desc'), limit(50)));
  const rows = snap.docs.map(d => {
    const c = d.data();
    return `<tr>
      <td><div style="font-weight:700;font-size:13px;">${escapeHtml(c.caseTitle || '-')}</div><div style="font-size:11px;color:var(--cream-dim);">${escapeHtml(c.nickname || '익명')} · ${escapeHtml(fmtDate(c.createdAt))}</div></td>
      <td style="font-size:12px;color:var(--cream-dim);max-width:220px;">${escapeHtml(compactText(c.caseDescription || '', 70))}</td>
      <td><span class="badge ${c.status === 'completed' ? 'badge-gold' : 'badge-red'}">${escapeHtml(c.status || '-')}</span></td>
      <td style="white-space:nowrap;">
        <button onclick="window._hide('${escapeAttr(d.id)}')" style="background:none;border:1px solid var(--border);color:var(--cream-dim);padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;">숨김</button>
        <button onclick="window._del('${escapeAttr(d.id)}')" style="background:none;border:1px solid var(--red);color:var(--red);padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;margin-left:4px;">삭제</button>
      </td></tr>`;
  }).join('');
  el.innerHTML = `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>사건</th><th>내용</th><th>상태</th><th>관리</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--cream-dim);">사건 없음</td></tr>'}</tbody></table></div>`;
  window._hide = async id => { await updateDoc(doc(db, 'cases', id), { status: 'hidden' }); toast('숨김 처리됨', 'success'); loadTab('cases'); };
  window._del = async id => {
    if (!confirm('이 사건을 영구 삭제하시겠습니까? 사건 + 판결 결과가 모두 삭제됩니다.')) return;
    try { await deleteDoc(doc(db, 'results', id)); } catch {}
    await deleteDoc(doc(db, 'cases', id));
    toast('영구 삭제 완료', 'success');
    loadTab('cases');
  };
}

async function tabReports(el) {
  const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50)));
  const rows = snap.docs.map(d => {
    const r = d.data();
    return `<tr>
      <td style="font-size:12px;">${escapeHtml(r.caseId || '-')}</td>
      <td>${escapeHtml(r.reason || '-')}</td>
      <td><span class="badge ${r.status === 'resolved' ? 'badge-gold' : 'badge-red'}">${escapeHtml(r.status || 'pending')}</span></td>
      <td style="font-size:12px;color:var(--cream-dim);">${escapeHtml(fmtDate(r.createdAt))}</td>
      <td><button onclick="window._resolve('${escapeAttr(d.id)}')" style="background:none;border:1px solid var(--gold);color:var(--gold);padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;">처리완료</button></td>
    </tr>`;
  }).join('');
  el.innerHTML = `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>사건ID</th><th>신고사유</th><th>상태</th><th>날짜</th><th>관리</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--cream-dim);">신고 없음</td></tr>'}</tbody></table></div>`;
  window._resolve = async id => { await updateDoc(doc(db, 'reports', id), { status: 'resolved' }); toast('처리완료', 'success'); loadTab('reports'); };
}

async function tabUsage(el) {
  const settingsSnap = await getDoc(doc(db, 'site_settings', 'config'));
  const s = settingsSnap.exists() ? settingsSnap.data() : {};
  const inputPrice = Number(s.geminiInputPricePerM ?? 0.075);
  const outputPrice = Number(s.geminiOutputPricePerM ?? 0.30);
  const krw = Number(s.krwUsdRate ?? 1400);
  const monthlyBudgetKrw = Number(s.monthlyBudgetKrw ?? 50000);

  const days = [];
  for (let i = 0; i < 60; i++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
    days.push(key);
  }
  const snaps = await Promise.all(days.map(date => getDoc(doc(db, 'usage_stats', `daily_${date}`))));
  const rows = days.map((date, i) => {
    const d = snaps[i].exists() ? snaps[i].data() : {};
    const cost = (d.geminiInputTokens || 0) / 1e6 * inputPrice + (d.geminiOutputTokens || 0) / 1e6 * outputPrice;
    return { date, cases: d.caseCount || 0, req: d.geminiRequests || 0, input: d.geminiInputTokens || 0, output: d.geminiOutputTokens || 0, writes: d.firestoreWrites || 0, reads: d.firestoreReads || 0, inv: d.functionInvocations || 0, costKrw: Math.round(cost * krw) };
  });
  const thisMonth = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date());
  const monthRows = rows.filter(r => r.date.startsWith(thisMonth));
  const month = monthRows.reduce((a, r) => ({ cases: a.cases + r.cases, req: a.req + r.req, input: a.input + r.input, output: a.output + r.output, costKrw: a.costKrw + r.costKrw }), { cases: 0, req: 0, input: 0, output: 0, costKrw: 0 });
  const budgetPct = monthlyBudgetKrw ? Math.min(month.costKrw / monthlyBudgetKrw * 100, 100) : 0;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
      ${mini('이번 달 사건', month.cases + '건')}
      ${mini('Gemini 호출', month.req + '회')}
      ${mini('토큰 입/출', `${month.input.toLocaleString()} / ${month.output.toLocaleString()}`)}
      ${mini('예상 AI 비용', '₩' + month.costKrw.toLocaleString(), `${budgetPct.toFixed(1)}%`)}
    </div>
    <div class="card" style="margin-bottom:16px;font-size:12px;color:var(--cream-dim);line-height:1.8;">
      실제 청구 금액은 Firebase Console과 Google AI Studio/Cloud Billing이 최종 기준입니다. 이 화면은 함수가 기록한 usage_stats 기반 추정치입니다.
    </div>
    <div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>날짜</th><th>사건</th><th>Gemini</th><th>토큰</th><th>Firestore</th><th>Functions</th><th>예상비용</th></tr></thead><tbody>
      ${rows.filter(r => r.cases || r.req).slice(0, 30).map(r => `<tr><td>${r.date}</td><td>${r.cases}</td><td>${r.req}</td><td style="font-size:11px;">${r.input.toLocaleString()} / ${r.output.toLocaleString()}</td><td style="font-size:11px;">R ${r.reads.toLocaleString()} / W ${r.writes.toLocaleString()}</td><td>${r.inv}</td><td>₩${r.costKrw.toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--cream-dim);">집계된 데이터 없음</td></tr>'}
    </tbody></table></div>`;
}

function mini(label, value, sub = '') {
  return `<div style="text-align:center;padding:14px 8px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;"><div style="font-size:16px;font-weight:700;color:var(--cream);">${escapeHtml(value)}</div>${sub ? `<div style="font-size:10px;color:var(--gold);margin-top:1px;">${escapeHtml(sub)}</div>` : ''}<div style="font-size:10px;color:var(--cream-dim);margin-top:2px;">${escapeHtml(label)}</div></div>`;
}

async function tabSettings(el) {
  const snap = await getDoc(doc(db, 'site_settings', 'config'));
  const d = snap.exists() ? snap.data() : {};
  el.innerHTML = `
    <form id="sf">
      <div class="form-group"><label class="form-label">일일 접수 한도</label><input type="number" id="dl" class="form-input" value="${escapeAttr(d.dailyLimit || 3)}" min="1" max="20"></div>
      <div class="form-group"><label class="form-label">쿨다운 (초)</label><input type="number" id="cd" class="form-input" value="${escapeAttr(d.cooldownSec || 45)}" min="0" max="300"></div>
      <div class="form-group"><label class="form-label">금칙어 (쉼표 구분)</label><textarea id="bw" class="form-textarea" style="min-height:80px;">${escapeHtml((d.bannedWords || []).join(', '))}</textarea></div>
      <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px 14px 4px;margin:20px 0;">
        <legend style="padding:0 8px;color:var(--gold);font-size:13px;">💰 비용 계산 기준</legend>
        <div class="form-group"><label class="form-label">Gemini 입력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gip" class="form-input" value="${escapeAttr(d.geminiInputPricePerM ?? 0.075)}"></div>
        <div class="form-group"><label class="form-label">Gemini 출력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gop" class="form-input" value="${escapeAttr(d.geminiOutputPricePerM ?? 0.30)}"></div>
        <div class="form-group"><label class="form-label">원-달러 환율 (₩/$1)</label><input type="number" id="krw" class="form-input" value="${escapeAttr(d.krwUsdRate ?? 1400)}"></div>
        <div class="form-group"><label class="form-label">월 예산 기준 (₩)</label><input type="number" id="budget" class="form-input" value="${escapeAttr(d.monthlyBudgetKrw ?? 50000)}" step="10000" min="0"></div>
      </fieldset>
      <button type="submit" class="btn btn-primary">저장</button>
    </form>`;
  document.getElementById('sf').addEventListener('submit', async e => {
    e.preventDefault();
    await setDoc(doc(db, 'site_settings', 'config'), {
      dailyLimit: parseInt(document.getElementById('dl').value, 10),
      cooldownSec: parseInt(document.getElementById('cd').value, 10),
      bannedWords: document.getElementById('bw').value.split(',').map(w => w.trim()).filter(Boolean),
      geminiInputPricePerM: parseFloat(document.getElementById('gip').value),
      geminiOutputPricePerM: parseFloat(document.getElementById('gop').value),
      krwUsdRate: parseFloat(document.getElementById('krw').value),
      monthlyBudgetKrw: parseFloat(document.getElementById('budget').value),
    }, { merge: true });
    toast('저장되었습니다.', 'success');
  });
}

async function tabBiz(el) {
  const snap = await getDoc(doc(db, 'site_settings', 'config'));
  const biz = snap.exists() ? (snap.data().businessInfo || {}) : {};
  const fields = [['companyName','사업자명'],['ceoName','대표자명'],['businessNumber','사업자등록번호'],['contact','연락처'],['email','이메일'],['address','주소']];
  el.innerHTML = `<form id="bf">${fields.map(([k,l]) => `<div class="form-group"><label class="form-label">${l}</label><input type="text" id="b_${k}" class="form-input" value="${escapeAttr(biz[k] || '')}"></div>`).join('')}<button type="submit" class="btn btn-primary">저장</button></form>`;
  document.getElementById('bf').addEventListener('submit', async e => {
    e.preventDefault();
    const businessInfo = {};
    fields.forEach(([k]) => { businessInfo[k] = document.getElementById(`b_${k}`).value.trim(); });
    await setDoc(doc(db, 'site_settings', 'config'), { businessInfo }, { merge: true });
    toast('저장되었습니다.', 'success');
  });
}

async function tabPolicy(el) {
  const defaults = {
    terms: '소소킹 판결소 이용약관\n\n본 서비스는 AI 기반 오락 서비스이며 실제 법률 자문이 아닙니다.',
    privacy: '소소킹 판결소 개인정보처리방침\n\n본 서비스는 Firebase 익명 인증과 사건 접수 내용을 처리합니다.',
    ai_disclaimer: 'AI 서비스 이용 안내\n\nAI가 생성한 판결문은 오락 목적이며 법적 효력이 없습니다.'
  };
  const types = [['terms','이용약관'],['privacy','개인정보처리방침'],['ai_disclaimer','AI 서비스 안내']];
  const snaps = await Promise.all(types.map(([t]) => getDoc(doc(db, 'policy_docs', t))));
  let active = 'terms';
  function render() {
    const idx = types.findIndex(([t]) => t === active);
    const content = snaps[idx].exists() ? snaps[idx].data().content : (defaults[active] || '');
    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">${types.map(([t,l]) => `<button onclick="window._pt('${t}')" style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:${active === t ? 'var(--gold-dim)' : 'none'};color:${active === t ? 'var(--gold)' : 'var(--cream-dim)'};font-size:13px;cursor:pointer;">${l}</button>`).join('')}</div>
      ${!snaps[idx].exists() ? '<div style="font-size:12px;color:var(--gold);margin-bottom:10px;padding:8px 12px;background:rgba(201,168,76,0.08);border-radius:6px;">기본 내용이 준비되었습니다. 확인 후 저장하세요.</div>' : ''}
      <form id="pf"><div class="form-group"><label class="form-label">${types[idx][1]}</label><textarea id="pc" class="form-textarea" style="min-height:320px;">${escapeHtml(content)}</textarea></div><button type="submit" class="btn btn-primary">저장</button></form>`;
    document.getElementById('pf').addEventListener('submit', async e => {
      e.preventDefault();
      const val = document.getElementById('pc').value;
      await setDoc(doc(db, 'policy_docs', active), { content: val, updatedAt: new Date() });
      snaps[idx] = { exists: () => true, data: () => ({ content: val }) };
      toast('저장되었습니다.', 'success');
    });
    window._pt = t => { active = t; render(); };
  }
  render();
}
