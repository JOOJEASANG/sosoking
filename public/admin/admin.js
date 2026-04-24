import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-northeast3');

function toast(msg, type='info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(),300); }, 3000);
}

// 로딩 상태를 즉시 표시 (onAuthStateChanged 대기 중 빈 화면 방지)
document.getElementById('admin-content').innerHTML =
  '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;">' +
  '<div class="loading-dots"><span></span><span></span><span></span></div></div>';

onAuthStateChanged(auth, user => { user ? renderDashboard(user) : renderLogin(); });

function renderLogin() {
  document.getElementById('admin-content').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.07) 0%, transparent 55%);">
      <div style="width:100%;max-width:380px;">
        <div style="text-align:center;margin-bottom:36px;">
          <div style="font-size:56px;line-height:1;filter:drop-shadow(0 0 24px rgba(201,168,76,0.35));">⚖️</div>
          <div style="font-family:'Noto Serif KR',serif;font-size:22px;color:var(--gold);margin-top:14px;font-weight:700;letter-spacing:-0.01em;">소소킹 생활법정</div>
          <div style="font-size:12px;color:var(--cream-dim);margin-top:6px;letter-spacing:0.1em;text-transform:uppercase;">Admin Console</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(201,168,76,0.18);border-radius:20px;padding:32px 28px;box-shadow:0 24px 64px rgba(0,0,0,0.45),inset 0 1px 0 rgba(201,168,76,0.08);">
          <form id="login-form">
            <div class="form-group" style="margin-bottom:18px;">
              <label class="form-label" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">이메일</label>
              <input type="email" id="em" class="form-input" required autocomplete="email" placeholder="admin@example.com" style="font-size:15px;">
            </div>
            <div class="form-group" style="margin-bottom:26px;">
              <label class="form-label" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">비밀번호</label>
              <input type="password" id="pw" class="form-input" required autocomplete="current-password" placeholder="••••••••" style="font-size:15px;letter-spacing:0.1em;">
            </div>
            <button type="submit" class="btn btn-primary" id="login-btn" style="font-size:15px;padding:15px;border-radius:12px;">로그인</button>
            <button type="button" id="reset-btn" style="width:100%;margin-top:12px;background:none;border:none;color:var(--cream-dim);font-size:12px;cursor:pointer;padding:8px;opacity:0.65;">비밀번호를 잊으셨나요?</button>
          </form>
        </div>
        <div style="text-align:center;margin-top:20px;font-size:11px;color:rgba(245,240,232,0.2);">소소킹 생활법정 · 내부 전용</div>
      </div>
    </div>`;
  document.getElementById('reset-btn').addEventListener('click', async () => {
    const email = document.getElementById('em').value.trim();
    if (!email) { toast('이메일을 먼저 입력해주세요.', 'error'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      toast('비밀번호 재설정 메일을 발송했습니다. 메일함을 확인하세요.', 'success');
    } catch(err) { toast('발송 실패: ' + err.message, 'error'); }
  });

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled=true; btn.textContent='로그인 중...';
    try { await signInWithEmailAndPassword(auth, document.getElementById('em').value, document.getElementById('pw').value); }
    catch(err) { toast('로그인 실패: '+err.message,'error'); btn.disabled=false; btn.textContent='로그인'; }
  });
}

let currentTab = 'topics';
let _pendingCount = 0;

const TAB_DEFS = [
  ['topics',    '📋 주제 관리'],
  ['categories','🏷️ 카테고리'],
  ['words',     '🚫 금칙어'],
  ['cases',     '⚖️ 사건 목록'],
  ['reports',   '🚨 신고'],
  ['feedback',  '💬 의견함'],
  ['usage',     '📊 사용량'],
  ['settings',  '⚙️ 설정'],
  ['biz',       '🏢 사업자'],
  ['policy',    '📜 정책'],
  ['connection','🔌 연결'],
];

function renderDashboard() {
  document.getElementById('admin-content').innerHTML = `
    <div>
      <div class="admin-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;line-height:1;filter:drop-shadow(0 0 8px rgba(201,168,76,0.4));">⚖️</span>
          <div>
            <div style="font-family:'Noto Serif KR',serif;font-size:14px;font-weight:700;color:var(--gold);line-height:1.2;">소소킹 생활법정</div>
            <div style="font-size:10px;color:var(--cream-dim);letter-spacing:0.1em;text-transform:uppercase;">Admin Console</div>
          </div>
        </div>
        <button onclick="window._logout()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--cream-dim);font-size:12px;cursor:pointer;padding:7px 14px;border-radius:8px;transition:all 0.15s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.25)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'">로그아웃</button>
      </div>
      <div class="admin-tab-bar">
        <div style="display:inline-flex;padding:0 8px;">
          ${TAB_DEFS.map(([id,label])=>`<button class="admin-tab${currentTab===id?' active':''}" data-tab="${id}" onclick="window._tab('${id}')">${label}</button>`).join('')}
        </div>
      </div>
      <div style="max-width:960px;margin:0 auto;padding:24px 20px 80px;">
        <div id="tab-content"></div>
      </div>
    </div>`;
  window._logout = async () => { await signOut(auth); };
  window._tab = tab => {
    currentTab = tab;
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    loadTab(tab);
  };
  loadTab(currentTab);
  // 대기 주제 뱃지 업데이트
  getDocs(query(collection(db,'topics'), where('status','==','pending'))).then(s => {
    _pendingCount = s.size;
    const btn = document.querySelector('[data-tab="topics"]');
    if (btn && s.size > 0) btn.innerHTML = `📋 주제 관리 <span style="background:var(--red);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px;">${s.size}</span>`;
  }).catch(()=>{});
}

async function loadTab(tab) {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>';
  if (tab==='topics') await tabTopics(el);
  else if (tab==='categories') await tabCategories(el);
  else if (tab==='words') await tabWords(el);
  else if (tab==='cases') await tabCases(el);
  else if (tab==='reports') await tabReports(el);
  else if (tab==='feedback') await tabFeedback(el);
  else if (tab==='usage') await tabUsage(el);
  else if (tab==='settings') await tabSettings(el);
  else if (tab==='biz') await tabBiz(el);
  else if (tab==='policy') await tabPolicy(el);
  else if (tab==='connection') await tabConnection(el);
}

async function tabCases(el) {
  const snap = await getDocs(query(collection(db,'cases'),orderBy('createdAt','desc'),limit(50)));
  const rows = snap.docs.map(d=>{
    const c=d.data(), date=c.createdAt?.toDate?c.createdAt.toDate().toLocaleDateString('ko'):'-';
    return `<tr>
      <td><div style="font-weight:700;font-size:13px;">${c.caseTitle||'-'}</div><div style="font-size:11px;color:var(--cream-dim);">${c.nickname||'익명'} · ${date}</div></td>
      <td style="font-size:12px;color:var(--cream-dim);max-width:180px;">${(c.caseDescription||'').substring(0,50)}...</td>
      <td><span class="badge ${c.status==='completed'?'badge-gold':'badge-red'}">${c.status||'-'}</span></td>
      <td style="white-space:nowrap;">
        <button onclick="window._hide('${d.id}')" class="admin-btn">숨김</button>
        <button onclick="window._del('${d.id}')" class="admin-btn admin-btn-danger" style="margin-left:4px;">삭제</button>
      </td></tr>`;
  }).join('');
  el.innerHTML = `<div class="admin-section-box"><div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>사건</th><th>내용</th><th>상태</th><th>관리</th></tr></thead><tbody>${rows||'<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--cream-dim);">사건 없음</td></tr>'}</tbody></table></div></div>`;
  window._hide = async id => { await updateDoc(doc(db,'cases',id),{status:'hidden'}); toast('숨김 처리됨','success'); loadTab('cases'); };
  window._del = async id => {
    if (!confirm('⚠️ 이 사건을 영구 삭제하시겠습니까?\n사건 + 판결 결과가 모두 삭제되며 복구할 수 없습니다.')) return;
    try { await deleteDoc(doc(db,'results',id)); } catch(e) {}
    try { await deleteDoc(doc(db,'cases',id)); toast('영구 삭제 완료','success'); }
    catch(e) { toast('삭제 실패: '+e.message,'error'); }
    loadTab('cases');
  };
}

async function tabReports(el) {
  const snap = await getDocs(query(collection(db,'reports'),orderBy('createdAt','desc'),limit(50)));
  const rows = snap.docs.map(d=>{
    const r=d.data(), date=r.createdAt?.toDate?r.createdAt.toDate().toLocaleDateString('ko'):'-';
    return `<tr><td style="font-size:12px;">${r.caseId||'-'}</td><td>${r.reason||'-'}</td><td><span class="badge ${r.status==='resolved'?'badge-gold':'badge-red'}">${r.status||'pending'}</span></td><td style="font-size:12px;color:var(--cream-dim);">${date}</td><td><button onclick="window._resolve('${d.id}')" class="admin-btn admin-btn-gold">처리완료</button></td></tr>`;
  }).join('');
  el.innerHTML = `<div class="admin-section-box"><div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>사건ID</th><th>신고사유</th><th>상태</th><th>날짜</th><th>관리</th></tr></thead><tbody>${rows||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--cream-dim);">신고 없음</td></tr>'}</tbody></table></div></div>`;
  window._resolve = async id => { await updateDoc(doc(db,'reports',id),{status:'resolved'}); toast('처리완료','success'); loadTab('reports'); };
}

async function tabFeedback(el) {
  const snap = await getDocs(query(collection(db,'feedback'),orderBy('createdAt','desc'),limit(100)));
  const catColors = {'버그신고':'var(--red)','기능제안':'#3498db','칭찬':'#27ae60','기타':'var(--gold)'};
  const rows = snap.docs.map(d => {
    const f = d.data(), date = f.createdAt?.toDate ? f.createdAt.toDate().toLocaleDateString('ko') : '-';
    const color = catColors[f.category] || 'var(--gold)';
    return `<tr>
      <td><span style="font-size:11px;font-weight:700;color:${color};padding:2px 8px;background:${color}22;border-radius:20px;">${f.category||'기타'}</span></td>
      <td style="font-size:12px;color:var(--cream-dim);">${f.nickname||'익명'}</td>
      <td style="font-size:13px;max-width:360px;white-space:pre-wrap;line-height:1.6;">${(f.content||'').replace(/</g,'&lt;')}</td>
      <td style="font-size:11px;color:var(--cream-dim);">${date}</td>
      <td><button onclick="window._delFb('${d.id}')" class="admin-btn admin-btn-danger">삭제</button></td>
    </tr>`;
  }).join('');
  el.innerHTML = `
    <div style="margin-bottom:14px;font-size:12px;color:var(--cream-dim);">총 <strong style="color:var(--cream);">${snap.docs.length}</strong>건</div>
    <div class="admin-section-box"><div style="overflow-x:auto;">
      <table class="admin-table">
        <thead><tr><th>유형</th><th>닉네임</th><th>내용</th><th>날짜</th><th>관리</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--cream-dim);">의견 없음</td></tr>'}</tbody>
      </table>
    </div></div>`;
  window._delFb = async id => {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteDoc(doc(db,'feedback',id));
    toast('삭제됨','success');
    loadTab('feedback');
  };
}

async function tabUsage(el) {
  const settingsSnap = await getDoc(doc(db,'site_settings','config'));
  const s = settingsSnap.exists() ? settingsSnap.data() : {};
  const inputPrice = s.geminiInputPricePerM ?? 0.075;
  const outputPrice = s.geminiOutputPricePerM ?? 0.30;
  const firestoreWritePrice = 0.18 / 100000;
  const firestoreReadPrice = 0.06 / 100000;
  const invocationPrice = 0.40 / 1000000;
  const krw = s.krwUsdRate ?? 1400;

  const days = [];
  for (let i = 0; i < 30; i++) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    days.push(dt.toISOString().slice(0,10));
  }
  const snaps = await Promise.all(days.map(date => getDoc(doc(db,'usage_stats',`daily_${date}`))));
  const rows = days.map((date, i) => {
    const d = snaps[i].exists() ? snaps[i].data() : {};
    const gIn = d.geminiInputTokens||0, gOut = d.geminiOutputTokens||0;
    const gReq = d.geminiRequests||0, fw = d.firestoreWrites||0, fr = d.firestoreReads||0;
    const inv = d.functionInvocations||0, cases = d.caseCount||0;
    const cost = (gIn/1e6)*inputPrice + (gOut/1e6)*outputPrice + fw*firestoreWritePrice + fr*firestoreReadPrice + inv*invocationPrice;
    return { date, cases, gReq, gIn, gOut, fw, fr, inv, cost };
  });
  const total = rows.reduce((a,r)=>({
    cases:a.cases+r.cases, gReq:a.gReq+r.gReq, gIn:a.gIn+r.gIn, gOut:a.gOut+r.gOut,
    fw:a.fw+r.fw, fr:a.fr+r.fr, inv:a.inv+r.inv, cost:a.cost+r.cost
  }), {cases:0,gReq:0,gIn:0,gOut:0,fw:0,fr:0,inv:0,cost:0});
  const today = rows[0];

  const card = (label, value, sub='') => `<div class="admin-stat-card"><div class="admin-stat-label">${label}</div><div class="admin-stat-value">${value}</div>${sub?`<div style="font-size:11px;color:var(--cream-dim);margin-top:2px;">${sub}</div>`:''}</div>`;

  el.innerHTML = `
    <div style="margin-bottom:16px;padding:10px 14px;background:rgba(201,168,76,0.08);border-radius:8px;font-size:12px;color:var(--gold);">오늘 · ${today.date} · 사건 ${today.cases}건 · Gemini ${today.gReq}회 호출 · 예상 $${today.cost.toFixed(4)} (₩${Math.round(today.cost*krw).toLocaleString()})</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:20px;">
      ${card('30일 사건', total.cases+'건')}
      ${card('Gemini 요청', total.gReq.toLocaleString()+'회')}
      ${card('입력 토큰', total.gIn.toLocaleString())}
      ${card('출력 토큰', total.gOut.toLocaleString())}
      ${card('Firestore 쓰기', total.fw.toLocaleString())}
      ${card('Firestore 읽기', total.fr.toLocaleString())}
      ${card('Functions 호출', total.inv.toLocaleString())}
    </div>
    <div style="padding:18px;background:linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.04));border:1px solid var(--gold-dim);border-radius:10px;margin-bottom:20px;">
      <div style="font-size:12px;color:var(--gold);margin-bottom:6px;">📊 최근 30일 예상 비용</div>
      <div style="font-size:28px;font-weight:700;color:var(--gold);">$${total.cost.toFixed(4)}</div>
      <div style="font-size:14px;color:var(--cream-dim);margin-top:4px;">≈ ₩${Math.round(total.cost*krw).toLocaleString()} (환율 ₩${krw}/$1 기준)</div>
    </div>
    <div style="overflow-x:auto;">
      <table class="admin-table">
        <thead><tr><th>날짜</th><th>사건</th><th>Gemini</th><th>토큰 (입/출)</th><th>Firestore (R/W)</th><th>비용</th></tr></thead>
        <tbody>${rows.filter(r=>r.cases||r.gReq).map(r=>`
          <tr>
            <td style="font-size:12px;">${r.date}</td>
            <td>${r.cases}</td>
            <td>${r.gReq}</td>
            <td style="font-size:11px;">${r.gIn.toLocaleString()} / ${r.gOut.toLocaleString()}</td>
            <td style="font-size:11px;">${r.fr.toLocaleString()} / ${r.fw.toLocaleString()}</td>
            <td style="color:var(--gold);font-size:12px;">$${r.cost.toFixed(4)}</td>
          </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--cream-dim);">아직 집계된 데이터가 없습니다</td></tr>'}
        </tbody>
      </table>
    </div>
    <div style="margin-top:20px;padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--cream-dim);line-height:1.7;">
      💡 <b style="color:var(--cream);">비용 안내</b><br>
      · Gemini 단가: 입력 $${inputPrice}/1M · 출력 $${outputPrice}/1M (gemini-2.5-flash 기준, 설정 탭에서 변경 가능)<br>
      · Firestore: 쓰기 $0.18/10만 · 읽기 $0.06/10만<br>
      · Functions 호출: $0.40/1M · 환율 ₩${krw}/$1<br>
      · 집계는 Cloud Function이 실행될 때만 기록됩니다. Firebase 콘솔 "사용량 및 결제"가 최종 기준입니다.<br>
      · <b style="color:var(--gold);">무료 할당량(Spark/Blaze) 차감 후 실제 청구액은 이보다 적을 수 있습니다.</b>
    </div>`;
}

async function tabWords(el) {
  const snap = await getDoc(doc(db,'site_settings','config'));
  let words = snap.exists() ? (snap.data().bannedWords || []) : [];

  function renderWords() {
    const tagsHtml = words.length
      ? words.map((w,i) => `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);color:var(--red);font-size:12px;font-weight:600;">
          ${w}
          <button onclick="window._removeWord(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;line-height:1;padding:0;">&times;</button>
        </span>`).join(' ')
      : `<span style="font-size:13px;color:var(--cream-dim);">등록된 금칙어가 없습니다.</span>`;

    el.innerHTML = `
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:16px;">
          금칙어가 포함된 주제 등록 및 토론 주장 제출이 자동으로 차단됩니다.<br>
          욕설·혐오 표현·개인정보(이름, 전화번호 등) 키워드를 등록하세요.
        </div>
        <div class="admin-section-box" style="padding:16px;min-height:60px;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;" id="word-tags">
          ${tagsHtml}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <div style="flex:1;">
          <div class="form-label">금칙어 추가</div>
          <input type="text" id="word-input" class="form-input" placeholder="단어 입력 후 Enter 또는 추가 버튼" maxlength="30">
        </div>
        <button id="word-add-btn" class="btn btn-primary" style="width:auto;padding:12px 20px;">추가</button>
      </div>
      <div style="margin-top:20px;">
        <button id="word-save-btn" class="btn btn-primary">💾 저장</button>
      </div>`;

    document.getElementById('word-add-btn').addEventListener('click', addWord);
    document.getElementById('word-input').addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addWord();} });
    document.getElementById('word-save-btn').addEventListener('click', saveWords);
  }

  function addWord() {
    const input = document.getElementById('word-input');
    const w = input.value.trim();
    if (!w) return;
    if (words.includes(w)) { toast('이미 등록된 단어입니다','error'); return; }
    words = [...words, w];
    input.value = '';
    renderWords();
  }

  async function saveWords() {
    await setDoc(doc(db,'site_settings','config'), { bannedWords: words }, { merge: true });
    toast(`금칙어 ${words.length}개 저장됨`, 'success');
  }

  window._removeWord = i => { words = words.filter((_,idx)=>idx!==i); renderWords(); };

  renderWords();
}

async function tabSettings(el) {
  const snap = await getDoc(doc(db,'site_settings','config'));
  const d = snap.exists()?snap.data():{};
  el.innerHTML = `
    <form id="sf">
      <div class="form-group"><label class="form-label">일일 주제 등록 한도 (유저당)</label><input type="number" id="dl" class="form-input" value="${d.dailyLimit||3}" min="1" max="20"></div>
      <div class="form-group"><label class="form-label">재등록 쿨다운 (초)</label><input type="number" id="cd" class="form-input" value="${d.cooldownSec||45}" min="0" max="300"></div>
      <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px 14px 4px;margin:20px 0;">
        <legend style="padding:0 8px;color:var(--gold);font-size:13px;">💰 비용 단가 (사용량·비용 계산용)</legend>
        <div class="form-group"><label class="form-label">Gemini 입력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gip" class="form-input" value="${d.geminiInputPricePerM ?? 0.075}"></div>
        <div class="form-group"><label class="form-label">Gemini 출력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gop" class="form-input" value="${d.geminiOutputPricePerM ?? 0.30}"></div>
        <div class="form-group"><label class="form-label">원-달러 환율 (₩/$1)</label><input type="number" id="krw" class="form-input" value="${d.krwUsdRate ?? 1400}"></div>
      </fieldset>
      <button type="submit" class="btn btn-primary">저장</button>
    </form>`;
  document.getElementById('sf').addEventListener('submit', async e => {
    e.preventDefault();
    await setDoc(doc(db,'site_settings','config'),{
      ...( snap.exists()?snap.data():{} ),
      dailyLimit:parseInt(document.getElementById('dl').value),
      cooldownSec:parseInt(document.getElementById('cd').value),
      geminiInputPricePerM: parseFloat(document.getElementById('gip').value),
      geminiOutputPricePerM: parseFloat(document.getElementById('gop').value),
      krwUsdRate: parseFloat(document.getElementById('krw').value),
    },{merge:true});
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
  const DEFAULTS = {
    terms: `제1조 (목적)
소소킹 생활법정(이하 "서비스")는 일상의 사소한 억울함을 AI가 과하게 진지하게 판결해주는 오락형 서비스입니다. 본 약관은 서비스 이용에 관한 기본 사항을 규정합니다.

제2조 (서비스의 성격)
① 본 서비스는 순수 오락 목적으로 제공되며, AI가 생성한 판결문은 어떠한 법적 효력도 없습니다.
② 본 서비스는 실제 법률 자문, 법률 상담, 분쟁 조정 서비스가 아닙니다.
③ 진지한 법적 문제가 있을 경우 반드시 변호사 등 법률 전문가에게 문의하시기 바랍니다.

제3조 (이용자 의무)
① 이용자는 사건 접수 시 실명, 연락처, 주민등록번호 등 개인정보를 입력해서는 안 됩니다.
② 타인의 명예를 훼손하거나 사생활을 침해하는 내용은 접수할 수 없습니다.
③ 폭력, 혐오, 불법적인 내용이 포함된 사건은 접수가 제한됩니다.
④ 이용자는 하루 최대 3건까지 사건을 접수할 수 있습니다.

제4조 (서비스 제한)
서비스 운영자는 다음에 해당하는 경우 사전 통지 없이 접수를 차단하거나 콘텐츠를 삭제할 수 있습니다.
- 타인의 명예를 훼손하는 내용
- 개인정보가 포함된 내용
- 불법적이거나 반사회적인 내용
- 서비스 취지에 현저히 맞지 않는 내용

제5조 (면책)
① 서비스 운영자는 AI가 생성한 판결 결과의 정확성, 적절성에 대해 책임을 지지 않습니다.
② 서비스 이용으로 인해 발생하는 분쟁에 대해 서비스 운영자는 책임을 지지 않습니다.

제6조 (약관 변경)
서비스 운영자는 필요 시 약관을 변경할 수 있으며, 변경 시 서비스 내 공지합니다.

시행일: 2025년 1월 1일`,

    privacy: `소소킹 생활법정 개인정보처리방침

1. 수집하는 개인정보 항목
본 서비스는 별도의 회원가입 없이 익명 인증(Firebase Anonymous Authentication)을 통해 서비스를 제공합니다. 이용자가 직접 입력하는 개인정보는 수집하지 않으며, 사건 접수 시 입력한 사건 내용(사건명, 경위 등)만 처리됩니다.

수집 항목:
- 익명 인증 토큰(UID): 서비스 이용 식별 목적
- 사건 접수 내용: 사건명, 사건 경위, 억울 지수, 원하는 판결 (이용자가 직접 입력)
- 서비스 이용 일시

2. 개인정보 수집 및 이용 목적
- AI 판결 서비스 제공
- 접수 횟수 제한(1일 3건) 관리
- 서비스 부정 이용 방지

3. 개인정보 보유 및 이용 기간
서비스 이용 종료 시 또는 이용자 요청 시까지 보관하며, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.

4. 개인정보의 제3자 제공
서비스 운영자는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 단, 법령의 규정에 의한 경우는 예외로 합니다.

5. 개인정보 처리 위탁
본 서비스는 Google Firebase를 통해 데이터를 저장·처리합니다. Firebase의 개인정보 처리방침은 Google 개인정보 보호정책을 따릅니다.

6. 이용자의 권리
이용자는 서비스 내 본인이 접수한 사건의 공개 여부를 직접 설정할 수 있습니다.

7. 개인정보 보호책임자
문의: 서비스 내 안내된 연락처를 이용해 주시기 바랍니다.

시행일: 2025년 1월 1일`,

    ai_disclaimer: `AI 서비스 이용 안내

1. 서비스 개요
소소킹 생활법정는 Google Gemini AI를 활용하여 이용자가 접수한 사건에 대한 판결문을 자동 생성하는 오락형 서비스입니다.

2. AI 생성 콘텐츠 안내
① 본 서비스의 모든 판결문, 수사 기록, 변론 내용은 AI(Google Gemini)가 자동으로 생성한 창작물입니다.
② AI가 생성한 판결 결과는 오락 목적의 콘텐츠이며, 실제 법적 판단·법률 해석·법률 자문과 무관합니다.
③ AI 생성 결과는 사실과 다를 수 있으며, 부정확하거나 편향된 내용이 포함될 수 있습니다.

3. 법적 효력 없음
본 서비스에서 생성된 모든 판결문은 대한민국 법원 또는 어떠한 공적 기관의 판결과도 무관하며, 법적 효력이 전혀 없습니다.

4. 이용자 책임
이용자는 AI 생성 결과를 실제 법률 판단의 근거로 사용해서는 안 되며, 이를 제3자에게 공유할 경우 오락 목적의 AI 생성 콘텐츠임을 명확히 해야 합니다.

5. AI 서비스 제공사
본 서비스는 Google LLC의 Gemini API를 사용합니다. AI 모델의 동작 및 생성 결과에 대한 책임은 서비스 운영자에게 있지 않으며, Google의 이용약관 및 정책이 함께 적용됩니다.

6. 진지한 법적 문제가 있다면
본 서비스는 심각한 법적 분쟁, 형사 사건, 가정 문제 등에 적합하지 않습니다. 실제 법률 문제는 반드시 변호사 등 법률 전문가에게 문의하시기 바랍니다.
- 대한법률구조공단: 132
- 법률홈닥터: www.lawnb.com

시행일: 2025년 1월 1일`
  };

  const types=[['terms','이용약관'],['privacy','개인정보처리방침'],['ai_disclaimer','AI 서비스 안내']];
  const snaps=await Promise.all(types.map(([t])=>getDoc(doc(db,'policy_docs',t))));
  let active='terms';
  function render() {
    const idx=types.findIndex(([t])=>t===active);
    const content=snaps[idx].exists()?snaps[idx].data().content:(DEFAULTS[active]||'');
    el.innerHTML=`
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">${types.map(([t,l])=>`<button onclick="window._pt('${t}')" style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:${active===t?'var(--gold-dim)':'none'};color:${active===t?'var(--gold)':'var(--cream-dim)'};font-size:13px;cursor:pointer;">${l}</button>`).join('')}</div>
      ${!snaps[idx].exists()?'<div style="font-size:12px;color:var(--gold);margin-bottom:10px;padding:8px 12px;background:rgba(201,168,76,0.08);border-radius:6px;">📝 기본 내용이 준비되었습니다. 확인 후 저장해 주세요.</div>':''}
      <form id="pf"><div class="form-group"><label class="form-label">${types[idx][1]}</label><textarea id="pc" class="form-textarea" style="min-height:320px;">${content}</textarea></div><button type="submit" class="btn btn-primary">저장</button></form>`;
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

const DEFAULT_CATEGORIES = [
  {name:'카톡',icon:'💬',order:1},{name:'연애',icon:'💑',order:2},{name:'음식',icon:'🍗',order:3},
  {name:'정산',icon:'💸',order:4},{name:'직장',icon:'🏢',order:5},{name:'생활',icon:'🏠',order:6},
  {name:'친구',icon:'👫',order:7},{name:'기타',icon:'📌',order:8},
];

const DEFAULT_TOPICS = [
  {title:'카톡 읽씹 무죄 주장 사건',summary:'읽고 2시간 뒤 답장 — 무시인가, 나중에 답할 권리인가',plaintiffPosition:'읽었으면 바로 답장하는 게 기본 예의다',defendantPosition:'바로 답 못 할 상황도 있다, 나중에 답할 자유가 있다',category:'카톡',isOfficial:true,status:'active',playCount:0},
  {title:'치킨 마지막 조각 선취 사건',summary:'먼저 집으면 임자 vs 마지막은 눈치 봐야 한다',plaintiffPosition:'마지막 조각은 같이 먹는 사람 모두의 것, 눈치 봐야 한다',defendantPosition:'테이블 위 음식은 먼저 집는 사람 것이다, 망설임이 패배다',category:'음식',isOfficial:true,status:'active',playCount:0},
  {title:'더치페이 계산기 사건',summary:'밥 먹자마자 계산기 꺼내는 게 맞는 행동인가',plaintiffPosition:'공평함이 최고다, 더치페이가 관계를 깔끔하게 한다',defendantPosition:'분위기 보고 한 번쯤은 그냥 내는 게 사람 사는 방식이다',category:'정산',isOfficial:true,status:'active',playCount:0},
  {title:'퇴근 5분 전 업무 지시 사건',summary:'퇴근 직전 업무 지시 — 오늘 해야 하는가, 내일 해도 되는가',plaintiffPosition:'퇴근 시간 이후는 내 시간이다, 내일 하면 된다',defendantPosition:'급한 일은 상황에 따라 유연하게 해야 하는 게 직장인이다',category:'직장',isOfficial:true,status:'active',playCount:0},
  {title:'에어컨 온도 설정권 분쟁',summary:'함께 쓰는 공간에서 에어컨 온도는 누가 결정하는가',plaintiffPosition:'여름에 더운 게 정상, 시원하게 트는 게 기본이다',defendantPosition:'추위를 타는 사람도 있다, 서로 배려해야 한다',category:'생활',isOfficial:true,status:'active',playCount:0},
  {title:'5분 지각 무죄 주장 사건',summary:'약속에 5분 늦는 건 지각인가, 오차 범위인가',plaintiffPosition:'약속 시간은 정확히 지켜야 한다, 5분도 지각은 지각이다',defendantPosition:'5분은 현실적 오차 범위다, 예민한 게 오히려 이상하다',category:'생활',isOfficial:true,status:'active',playCount:0},
  {title:'자정 생일 카톡 강요 사건',summary:'자정에 생일 카톡 못 보내면 친한 친구가 아닌가',plaintiffPosition:'자정에 챙겨주는 게 진짜 친한 친구의 기본이다',defendantPosition:'당일 낮에 진심으로 챙기면 그게 더 의미 있다',category:'친구',isOfficial:true,status:'active',playCount:0},
  {title:'단톡방 알림 차단 무례 논쟁',summary:'단톡방 알림 꺼두고 나중에 보는 게 실례인가',plaintiffPosition:'공지나 연락에 늦게 반응하면 그룹을 무시하는 것이다',defendantPosition:'알림 설정은 개인 자유다, 읽기만 하면 문제없다',category:'카톡',isOfficial:true,status:'active',playCount:0},
  {title:'소개팅 후 연락 의무 부존재 사건',summary:'소개팅 후 먼저 연락해야 하는 쪽이 있는가',plaintiffPosition:'먼저 연락 안 하면 관심 없다는 신호, 용기 있는 쪽이 먼저 해야 한다',defendantPosition:'마음에 들면 서로 연락하게 돼 있다, 의무는 없다',category:'연애',isOfficial:true,status:'active',playCount:0},
  {title:'빌린 우산 반환 의무 사건',summary:'우산 빌려줬으면 꼭 돌려받아야 하는가',plaintiffPosition:'빌린 건 돌려주는 게 기본 중의 기본이다',defendantPosition:'우산은 사실상 주는 거다, 다들 그렇게 생각하며 살아왔다',category:'친구',isOfficial:true,status:'active',playCount:0},
];

async function tabTopics(el) {
  const [activeSnap, pendingSnap, catSnap] = await Promise.all([
    getDocs(query(collection(db,'topics'), where('status','==','active'), orderBy('createdAt','desc'), limit(100))),
    getDocs(query(collection(db,'topics'), where('status','==','pending'), orderBy('createdAt','desc'), limit(50))),
    getDocs(query(collection(db,'categories'), orderBy('order','asc'))),
  ]);

  const cats = catSnap.docs.map(d => d.data().name);
  const catOptions = cats.map(c=>`<option value="${c}">${c}</option>`).join('');

  let activeCatFilter = 'all';

  const renderPendingRow = d => {
    const t = d.data();
    const selId = `cat-sel-${d.id}`;
    return `<tr data-id="${d.id}">
      <td style="font-size:12px;">
        <div style="font-weight:700;">${t.title}</div>
        <div style="font-size:11px;color:var(--cream-dim);margin-top:2px;">${t.summary||''}</div>
        <div style="display:flex;gap:8px;margin-top:6px;font-size:11px;color:var(--cream-dim);">
          <span>⚔️ ${(t.plaintiffPosition||'').substring(0,30)}...</span>
        </div>
        <div style="font-size:11px;color:var(--cream-dim);">🛡️ ${(t.defendantPosition||'').substring(0,30)}...</div>
      </td>
      <td style="white-space:nowrap;vertical-align:middle;">
        <select id="${selId}" class="form-input" style="font-size:12px;padding:5px 8px;margin-bottom:6px;width:100%;">
          <option value="${t.category||'기타'}" selected>${t.category||'기타'}</option>
          ${cats.filter(c=>c!==(t.category||'기타')).map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
        <button onclick="window._approveTopic('${d.id}')" class="admin-btn admin-btn-approve" style="width:100%;margin-bottom:3px;">✅ 승인</button>
        <button onclick="window._delTopic('${d.id}')" class="admin-btn admin-btn-danger" style="width:100%;">🗑 거부·삭제</button>
      </td>
    </tr>`;
  };

  const renderActiveRow = d => {
    const t = d.data();
    return `<tr data-cat="${t.category||'기타'}">
      <td style="font-size:12px;">
        <div style="font-weight:700;">${t.title}</div>
        <div style="color:var(--cream-dim);font-size:11px;">${t.category||'기타'} · ${t.isOfficial?'공식':'유저'}</div>
      </td>
      <td style="font-size:12px;color:var(--cream-dim);max-width:160px;">${(t.plaintiffPosition||'').substring(0,40)}...</td>
      <td style="font-size:12px;">${t.playCount||0}</td>
      <td style="white-space:nowrap;">
        <button onclick="window._hideTopic('${d.id}','active')" class="admin-btn">숨김</button>
        <button onclick="window._delTopic('${d.id}')" class="admin-btn admin-btn-danger" style="margin-left:4px;">삭제</button>
      </td>
    </tr>`;
  };

  const hasSeedData = activeSnap.docs.some(d=>d.data().isOfficial);
  const allCats = ['all', ...new Set(activeSnap.docs.map(d=>d.data().category||'기타'))];

  el.innerHTML = `
    ${!hasSeedData?`<div style="margin-bottom:20px;padding:14px 18px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div style="font-size:13px;color:var(--cream);">⚠️ 초기 사건 데이터가 없습니다.</div>
      <button id="seed-btn" style="background:linear-gradient(135deg,var(--gold),var(--gold-light));color:#0d1117;border:none;padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap;">기본 사건 10개 + 카테고리 세팅</button>
    </div>`:''}

    ${pendingSnap.docs.length?`
      <div class="admin-section-title" style="margin-top:4px;">🔍 검토 대기 <span style="background:rgba(231,76,60,0.15);color:var(--red);border-radius:20px;padding:1px 8px;font-size:11px;">${pendingSnap.docs.length}</span></div>
      <div style="font-size:12px;color:var(--cream-dim);margin-bottom:10px;">카테고리를 확인·변경하고 승인하세요.</div>
      <div class="admin-section-box" style="margin-bottom:24px;"><div style="overflow-x:auto;">
        <table class="admin-table"><thead><tr><th>사건 내용</th><th style="width:130px;">카테고리 · 처리</th></tr></thead>
        <tbody id="pending-tbody">${pendingSnap.docs.map(renderPendingRow).join('')}</tbody></table>
      </div></div>
    `:''}

    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
      <div class="admin-section-title" style="margin:0;">✅ 공개 사건 <span style="background:rgba(201,168,76,0.12);color:var(--gold);border-radius:20px;padding:1px 8px;font-size:11px;">${activeSnap.docs.length}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;" id="cat-filter-bar">
        ${allCats.map(c=>`<button class="cat-filter-btn${c==='all'?' active':''}" data-cat="${c}" style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:${c==='all'?'var(--gold-dim)':'none'};color:${c==='all'?'var(--gold)':'var(--cream-dim)'};transition:all 0.15s;">${c==='all'?'전체':c}</button>`).join('')}
      </div>
    </div>
    <div class="admin-section-box"><div style="overflow-x:auto;">
      <table class="admin-table"><thead><tr><th>사건명</th><th>원고 주장</th><th>재판수</th><th>관리</th></tr></thead>
      <tbody id="active-tbody">${activeSnap.docs.map(renderActiveRow).join('')||'<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--cream-dim);">없음</td></tr>'}</tbody></table>
    </div></div>
  `;

  // 카테고리 필터
  document.getElementById('cat-filter-bar')?.addEventListener('click', e => {
    const btn = e.target.closest('.cat-filter-btn');
    if (!btn) return;
    activeCatFilter = btn.dataset.cat;
    document.querySelectorAll('.cat-filter-btn').forEach(b => {
      const on = b.dataset.cat === activeCatFilter;
      b.style.background = on ? 'var(--gold-dim)' : 'none';
      b.style.color = on ? 'var(--gold)' : 'var(--cream-dim)';
      b.style.borderColor = on ? 'rgba(201,168,76,0.4)' : 'var(--border)';
    });
    document.querySelectorAll('#active-tbody tr[data-cat]').forEach(row => {
      row.style.display = (activeCatFilter === 'all' || row.dataset.cat === activeCatFilter) ? '' : 'none';
    });
  });

  document.getElementById('seed-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('seed-btn');
    btn.disabled=true; btn.textContent='세팅 중...';
    try {
      for (const cat of DEFAULT_CATEGORIES) { await setDoc(doc(db,'categories',cat.name),{...cat}); }
      for (const t of DEFAULT_TOPICS) { await addDoc(collection(db,'topics'),{...t,createdAt:serverTimestamp()}); }
      toast('초기 데이터 세팅 완료!','success'); loadTab('topics');
    } catch(e) { toast('세팅 실패: '+e.message,'error'); btn.disabled=false; btn.textContent='기본 사건 10개 + 카테고리 세팅'; }
  });

  window._approveTopic = async id => {
    const sel = document.getElementById(`cat-sel-${id}`);
    const cat = sel ? sel.value : '기타';
    await updateDoc(doc(db,'topics',id), { status:'active', category: cat });
    toast('승인됨','success'); loadTab('topics');
  };
  window._hideTopic = async (id,cur) => { await updateDoc(doc(db,'topics',id),{status:cur==='active'?'hidden':'active'}); toast('처리됨','success'); loadTab('topics'); };
  window._delTopic = async id => {
    if (!confirm('이 주제를 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db,'topics',id));
    toast('삭제 완료','success'); loadTab('topics');
  };
}

async function tabCategories(el) {
  const snap = await getDocs(query(collection(db,'categories'), orderBy('order','asc')));
  const cats = snap.docs.map(d=>({id:d.id,...d.data()}));

  const rows = cats.map(c=>`<tr>
    <td style="font-size:16px;">${c.icon||''}</td>
    <td style="font-weight:700;">${c.name}</td>
    <td style="color:var(--cream-dim);">${c.order}</td>
    <td>
      <button onclick="window._delCat('${c.id}')" class="admin-btn admin-btn-danger">삭제</button>
    </td></tr>`).join('');

  el.innerHTML = `
    <div class="admin-section-box" style="margin-bottom:24px;"><div style="overflow-x:auto;">
      <table class="admin-table"><thead><tr><th>아이콘</th><th>이름</th><th>순서</th><th>관리</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--cream-dim);">카테고리 없음</td></tr>'}</tbody></table>
    </div></div>
    <form id="cat-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
      <div><div class="form-label">아이콘</div><input type="text" id="cat-icon" class="form-input" style="width:70px;" placeholder="💬" maxlength="2"></div>
      <div style="flex:1;min-width:120px;"><div class="form-label">카테고리명</div><input type="text" id="cat-name" class="form-input" placeholder="예: 카톡" maxlength="10" required></div>
      <div><div class="form-label">순서</div><input type="number" id="cat-order" class="form-input" style="width:80px;" value="${cats.length+1}" min="1"></div>
      <button type="submit" class="btn btn-primary" style="width:auto;padding:12px 20px;">추가</button>
    </form>
  `;

  document.getElementById('cat-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value.trim();
    if (!name) return;
    await addDoc(collection(db,'categories'), {
      name,
      icon: document.getElementById('cat-icon').value.trim() || '📌',
      order: parseInt(document.getElementById('cat-order').value) || cats.length+1,
    });
    toast('카테고리 추가됨','success');
    loadTab('categories');
  });

  window._delCat = async id => {
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db,'categories',id));
    toast('삭제됨','success'); loadTab('categories');
  };
}

async function tabConnection(el) {
  const statusRow = (label, ok, errMsg='') => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
      <span style="font-size:14px;">${label}</span>
      <span style="font-weight:700;color:${ok?'#27ae60':'var(--red)'};">${ok?'✅ 정상':`❌ 오류${errMsg?' — '+errMsg:''}`}</span>
    </div>`;

  el.innerHTML = `
    <div style="max-width:480px;">
      <div style="margin-bottom:20px;">
        <div style="font-size:15px;font-weight:700;color:var(--cream);margin-bottom:6px;">🔌 연결 상태 확인</div>
        <div style="font-size:13px;color:var(--cream-dim);">Firestore 데이터베이스와 Gemini AI API의 연결을 실시간으로 확인합니다.</div>
      </div>
      <button id="conn-btn" class="btn btn-primary" style="width:auto;padding:10px 24px;margin-bottom:24px;">🔍 연결 확인</button>
      <div id="conn-result"></div>
    </div>`;

  document.getElementById('conn-btn').addEventListener('click', async () => {
    const btn = document.getElementById('conn-btn');
    const resultEl = document.getElementById('conn-result');
    btn.disabled = true;
    btn.textContent = '확인 중...';
    resultEl.innerHTML = '<div class="loading-dots" style="padding:20px 0;"><span></span><span></span><span></span></div>';

    try {
      const checkConnection = httpsCallable(functions, 'checkConnection');
      const { data } = await checkConnection();
      resultEl.innerHTML = `
        ${statusRow('Firestore 데이터베이스', data.firestore)}
        ${statusRow('Gemini AI API', data.gemini)}
        <div style="margin-top:12px;padding:10px 14px;background:rgba(201,168,76,0.08);border-radius:8px;font-size:12px;color:var(--gold);">
          확인 시각: ${new Date().toLocaleString('ko')}
        </div>`;
    } catch (err) {
      const msg = err.message || '알 수 없는 오류';
      resultEl.innerHTML = `
        <div style="padding:16px;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.3);border-radius:8px;color:var(--red);font-size:14px;">
          ⚠️ 연결 확인 실패<br>
          <span style="font-size:12px;color:var(--cream-dim);margin-top:6px;display:block;">${msg}</span>
        </div>`;
    }

    btn.disabled = false;
    btn.textContent = '🔍 재확인';
  });
}
