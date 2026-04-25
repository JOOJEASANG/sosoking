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
  ['feedback',  '💬 의견함'],
  ['usage',     '📊 사용량'],
  ['settings',  '⚙️ 설정'],
  ['policy',    '📜 정책'],
];

function renderDashboard() {
  document.getElementById('admin-content').innerHTML = `
    <div>
      <div class="admin-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="admin-brand-icon">⚖️</span>
          <div>
            <div class="admin-brand-title">소소킹 생활법정</div>
            <div class="admin-brand-sub">Admin Console</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="admin-theme-toggle" class="admin-icon-btn" type="button" title="테마 전환">${localStorage.getItem('theme')==='light'?'🌙':'☀️'}</button>
          <button onclick="window._logout()" class="admin-logout-btn" type="button">로그아웃</button>
        </div>
      </div>
      <div class="admin-tab-bar">
        <div class="admin-tab-inner">
          ${TAB_DEFS.map(([id,label])=>`<button class="admin-tab${currentTab===id?' active':''}" data-tab="${id}" onclick="window._tab('${id}')">${label}</button>`).join('')}
        </div>
      </div>
      <div style="max-width:960px;margin:0 auto;padding:28px 24px 80px;">
        <div id="tab-content"></div>
      </div>
    </div>`;
  window._logout = async () => { await signOut(auth); };
  document.getElementById('admin-theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('admin-theme-toggle').textContent = next === 'light' ? '🌙' : '☀️';
  });
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
  else if (tab==='feedback') await tabFeedback(el);
  else if (tab==='usage') await tabUsage(el);
  else if (tab==='settings') await tabSettings(el);
  else if (tab==='policy') await tabPolicy(el);
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
  const inputPrice = s.geminiInputPricePerM ?? 0.15;
  const outputPrice = s.geminiOutputPricePerM ?? 0.60;
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
      · Gemini 2.5 Flash 단가: 입력 $${inputPrice}/1M · 출력 $${outputPrice}/1M (설정 탭에서 변경 가능)<br>
      · <a href="https://ai.google.dev/pricing" target="_blank" style="color:var(--gold);">Google AI 공식 단가 확인 →</a><br>
      · Firestore: 쓰기 $0.18/10만 · 읽기 $0.06/10만<br>
      · Functions 호출: $0.40/1M · 환율 ₩${krw}/$1<br>
      · 집계는 Cloud Function이 실행될 때만 기록됩니다. Firebase 콘솔 "사용량 및 결제"가 최종 기준입니다.<br>
      · <b style="color:var(--gold);">무료 할당량(Spark/Blaze) 차감 후 실제 청구액은 이보다 적을 수 있습니다.</b>
    </div>

    <div style="margin-top:28px;padding:20px;background:rgba(231,76,60,0.05);border:1.5px solid rgba(231,76,60,0.25);border-radius:12px;">
      <div style="font-size:14px;font-weight:700;color:var(--cream);margin-bottom:4px;">🗑️ 재판 데이터 정리</div>
      <div style="font-size:12px;color:var(--cream-dim);margin-bottom:16px;">Firestore 용량 절약을 위해 오래된 세션을 삭제합니다. 삭제된 데이터는 복구할 수 없습니다.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <label style="font-size:11px;color:var(--cream-dim);display:block;margin-bottom:4px;">대상 상태</label>
          <select id="cleanup-status" class="admin-input" style="width:100%;">
            <option value="completed">판결 완료만</option>
            <option value="cancelled">종료됨만</option>
            <option value="all">전체 (완료+종료)</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--cream-dim);display:block;margin-bottom:4px;">기준 일수</label>
          <select id="cleanup-days" class="admin-input" style="width:100%;">
            <option value="30">30일 이상 된 것</option>
            <option value="60">60일 이상 된 것</option>
            <option value="90">90일 이상 된 것</option>
            <option value="0">전체 (날짜 무관)</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button id="cleanup-count-btn" class="admin-btn" style="background:rgba(255,255,255,0.05);">개수 확인</button>
        <button id="cleanup-run-btn" class="admin-btn" style="background:rgba(231,76,60,0.15);color:#e74c3c;border-color:rgba(231,76,60,0.4);">삭제 실행</button>
        <span id="cleanup-result" style="font-size:13px;color:var(--cream-dim);"></span>
      </div>
    </div>
  `;

  el.querySelector('#cleanup-count-btn').addEventListener('click', async () => {
    const btn = el.querySelector('#cleanup-count-btn');
    const result = el.querySelector('#cleanup-result');
    btn.disabled = true; btn.textContent = '조회 중...';
    try {
      const fn = httpsCallable(functions, 'countSessionsForCleanup');
      const res = await fn({
        olderThanDays: Number(el.querySelector('#cleanup-days').value),
        statusFilter: el.querySelector('#cleanup-status').value,
      });
      result.textContent = `조회 결과: ${res.data.count}개`;
    } catch (e) { result.textContent = '오류: ' + e.message; }
    btn.disabled = false; btn.textContent = '개수 확인';
  });

  el.querySelector('#cleanup-run-btn').addEventListener('click', async () => {
    const statusVal = el.querySelector('#cleanup-status').value;
    const daysVal = el.querySelector('#cleanup-days').value;
    const label = el.querySelector('#cleanup-status option:checked').textContent;
    if (!confirm(`[${label}] ${daysVal === '0' ? '전체' : daysVal + '일 이상 된'} 세션을 삭제합니다.\n최대 500개씩 처리됩니다. 계속할까요?`)) return;
    const btn = el.querySelector('#cleanup-run-btn');
    const result = el.querySelector('#cleanup-result');
    btn.disabled = true; btn.textContent = '삭제 중...';
    try {
      const fn = httpsCallable(functions, 'cleanupCompletedSessions');
      const res = await fn({ olderThanDays: Number(daysVal), statusFilter: statusVal });
      result.style.color = '#27ae60';
      result.textContent = `✅ ${res.data.deleted}개 삭제 완료`;
    } catch (e) {
      result.style.color = 'var(--red)';
      result.textContent = '오류: ' + e.message;
    }
    btn.disabled = false; btn.textContent = '삭제 실행';
  });
}

const DEFAULT_BANNED_WORDS = [
  // 욕설
  '씨발','시발','씨바','시바','씨팔','시팔','ㅅㅂ','ㅆㅂ',
  '개새끼','개세끼','개새기','새끼','ㄱㅅㄲ',
  '병신','ㅂㅅ','지랄','개지랄',
  '미친놈','미친년','미친새끼','미쳤냐',
  '좆','보지','자지','씹','걸레년','창녀','창놈',
  '찐따','정신병자',
  // 혐오 표현
  '틀딱','노인충','맘충','한남충','김치녀','된장녀','개저씨',
  // 성적·폭력
  '강간','성폭행','성추행','윤간','성매매',
  // 위험 키워드
  '자살','자해','살인','살해','테러','폭탄','폭발물',
];

async function tabWords(el) {
  const snap = await getDoc(doc(db,'site_settings','config'));
  let words = snap.exists() ? (snap.data().bannedWords || []) : [];

  // 최초 등록 시 기본 금칙어 자동 적용
  if (words.length === 0) {
    words = [...DEFAULT_BANNED_WORDS];
    await setDoc(doc(db,'site_settings','config'), { bannedWords: words }, { merge: true });
  }

  const GROUPS = [
    { label: '욕설', color: '#e74c3c', words: ['씨발','시발','씨바','시바','씨팔','시팔','ㅅㅂ','ㅆㅂ','개새끼','개세끼','개새기','새끼','ㄱㅅㄲ','병신','ㅂㅅ','지랄','개지랄','미친놈','미친년','미친새끼','미쳤냐','좆','보지','자지','씹','걸레년','창녀','창놈','찐따','정신병자'] },
    { label: '혐오', color: '#e67e22', words: ['틀딱','노인충','맘충','한남충','김치녀','된장녀','개저씨'] },
    { label: '성적·폭력', color: '#8e44ad', words: ['강간','성폭행','성추행','윤간','성매매'] },
    { label: '위험', color: '#c0392b', words: ['자살','자해','살인','살해','테러','폭탄','폭발물'] },
  ];

  function groupLabel(w) {
    for (const g of GROUPS) { if (g.words.includes(w)) return g; }
    return { label: '기타', color: '#7f8c8d' };
  }

  function renderWords() {
    const tagsHtml = words.length
      ? words.map((w,i) => {
          const g = groupLabel(w);
          return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px 3px 8px;border-radius:20px;background:${g.color}18;border:1px solid ${g.color}44;font-size:12px;font-weight:600;color:${g.color};">
            <span style="font-size:9px;opacity:0.7;">${g.label}</span>
            ${w}
            <button onclick="window._removeWord(${i})" style="background:none;border:none;color:${g.color};cursor:pointer;font-size:14px;line-height:1;padding:0;margin-left:2px;">&times;</button>
          </span>`;
        }).join(' ')
      : `<span style="font-size:13px;color:var(--cream-dim);">등록된 금칙어가 없습니다.</span>`;

    const stats = GROUPS.map(g => {
      const cnt = words.filter(w => g.words.includes(w)).length;
      const extra = words.filter(w => !DEFAULT_BANNED_WORDS.includes(w)).length;
      return g;
    });
    const extraCnt = words.filter(w => !DEFAULT_BANNED_WORDS.includes(w)).length;

    el.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        ${GROUPS.map(g=>{
          const cnt = words.filter(w=>g.words.includes(w)).length;
          return `<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${g.color}18;border:1px solid ${g.color}44;color:${g.color};">${g.label} ${cnt}</span>`;
        }).join('')}
        ${extraCnt ? `<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--cream-dim);">추가 ${extraCnt}</span>` : ''}
        <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--cream);">전체 ${words.length}개</span>
      </div>
      <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">
        금칙어가 포함된 주제 등록·토론 주장이 자동 차단됩니다. × 버튼으로 개별 삭제, 아래에서 추가 가능합니다.
      </div>
      <div class="admin-section-box" style="padding:16px;min-height:60px;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;" id="word-tags">
        ${tagsHtml}
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end;margin-top:16px;">
        <div style="flex:1;">
          <div class="form-label">금칙어 직접 추가</div>
          <input type="text" id="word-input" class="form-input" placeholder="단어 입력 후 Enter 또는 추가" maxlength="30">
        </div>
        <button id="word-add-btn" class="btn btn-primary" style="width:auto;padding:12px 20px;">추가</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
        <button id="word-save-btn" class="btn btn-primary" style="flex:1;">💾 저장</button>
        <button id="word-reset-btn" class="admin-btn admin-btn-gold" style="padding:12px 16px;font-size:12px;">↺ 기본값으로 초기화</button>
      </div>`;

    document.getElementById('word-add-btn').addEventListener('click', addWord);
    document.getElementById('word-input').addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addWord();} });
    document.getElementById('word-save-btn').addEventListener('click', saveWords);
    document.getElementById('word-reset-btn').addEventListener('click', () => {
      if (!confirm(`기본 금칙어 ${DEFAULT_BANNED_WORDS.length}개로 초기화하시겠습니까?\n직접 추가한 단어는 삭제됩니다.`)) return;
      words = [...DEFAULT_BANNED_WORDS];
      renderWords();
      toast('기본값으로 초기화됐습니다. 저장 버튼을 눌러주세요.', 'info');
    });
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
  const biz = d.businessInfo || {};
  const bizFields = [['companyName','사업자명'],['ceoName','대표자명'],['businessNumber','사업자등록번호'],['contact','연락처'],['email','이메일'],['address','주소']];
  el.innerHTML = `
    <form id="sf">
      <div class="form-group"><label class="form-label">일일 주제 등록 한도 (유저당)</label><input type="number" id="dl" class="form-input" value="${d.dailyLimit||3}" min="1" max="20"></div>
      <div class="form-group"><label class="form-label">재등록 쿨다운 (초)</label><input type="number" id="cd" class="form-input" value="${d.cooldownSec||45}" min="0" max="300"></div>
      <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px 14px 8px;margin:20px 0;">
        <legend style="padding:0 8px;color:var(--gold);font-size:13px;">🤖 AI 상대 기능</legend>
        <div class="form-group" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <label class="form-label" style="margin:0;">AI와 대결 (소소봇)</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="ai-mode-enabled" ${d.aiModeEnabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--gold);">
            <span style="font-size:13px;color:var(--cream);">활성화</span>
          </label>
        </div>
        <div style="font-size:12px;color:var(--cream-dim);">활성화 시 주제 상세 페이지에 "AI와 대결" 버튼이 표시됩니다. 1인용 · 즉시 시작 · 하루 5회 제한</div>
      </fieldset>
      <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px 14px 4px;margin:20px 0;">
        <legend style="padding:0 8px;color:var(--gold);font-size:13px;">💰 비용 단가 (사용량·비용 계산용)</legend>
        <div class="form-group"><label class="form-label">Gemini 입력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gip" class="form-input" value="${d.geminiInputPricePerM ?? 0.15}"></div>
        <div class="form-group"><label class="form-label">Gemini 출력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gop" class="form-input" value="${d.geminiOutputPricePerM ?? 0.60}"></div>
        <div class="form-group"><label class="form-label">원-달러 환율 (₩/$1)</label><input type="number" id="krw" class="form-input" value="${d.krwUsdRate ?? 1400}"></div>
      </fieldset>
      <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px 14px 4px;margin:20px 0;">
        <legend style="padding:0 8px;color:var(--gold);font-size:13px;">🏢 사업자 정보</legend>
        ${bizFields.map(([k,l])=>`<div class="form-group"><label class="form-label">${l}</label><input type="text" id="b_${k}" class="form-input" value="${biz[k]||''}"></div>`).join('')}
      </fieldset>
      <button type="submit" class="btn btn-primary">저장</button>
    </form>`;
  document.getElementById('sf').addEventListener('submit', async e => {
    e.preventDefault();
    const businessInfo = {};
    bizFields.forEach(([k]) => { businessInfo[k] = document.getElementById(`b_${k}`).value.trim(); });
    await setDoc(doc(db,'site_settings','config'),{
      ...( snap.exists()?snap.data():{} ),
      dailyLimit: parseInt(document.getElementById('dl').value),
      cooldownSec: parseInt(document.getElementById('cd').value),
      aiModeEnabled: document.getElementById('ai-mode-enabled').checked,
      geminiInputPricePerM: parseFloat(document.getElementById('gip').value),
      geminiOutputPricePerM: parseFloat(document.getElementById('gop').value),
      krwUsdRate: parseFloat(document.getElementById('krw').value),
      businessInfo,
    },{merge:true});
    toast('저장되었습니다.','success');
  });
}

async function tabPolicy(el) {
  const DEFAULTS = {
    terms: `소소킹 생활법정 이용약관

시행일: 2026년 4월 25일

제1조 (목적)
소소킹 생활법정(이하 "서비스")는 일상의 사소한 갈등을 주제로 친구 또는 AI와 토론하고 AI 판사에게 재미있는 판결을 받는 순수 오락·엔터테인먼트 서비스입니다. 본 약관은 서비스 이용 조건 및 절차를 규정합니다.

제2조 (서비스의 성격)
① 본 서비스는 순수 오락 목적으로 제공되며, AI가 생성한 판결문은 어떠한 법적 효력도 없습니다.
② 본 서비스는 실제 법률 자문, 법률 상담, 분쟁 조정 서비스가 아닙니다.
③ 진지한 법적 문제가 있을 경우 반드시 변호사 등 법률 전문가에게 문의하시기 바랍니다.

제3조 (회원가입 및 계정)
① 서비스는 회원가입 없이 익명으로 이용할 수 있습니다.
② 구글 또는 이메일로 로그인 시 닉네임 설정 및 이용 기록 관리가 가능합니다.
③ 회원 탈퇴 시 계정 및 모든 관련 데이터가 즉시 영구 삭제됩니다.

제4조 (이용 제한)
① 재판 참여(친구·랜덤 대결)는 하루 2회로 제한됩니다.
② AI 상대(소소봇) 대결은 하루 5회로 제한됩니다.
③ 주제 등록은 하루 5회로 제한됩니다.

제5조 (이용자 의무)
① 이용자는 실명, 연락처, 주민등록번호 등 민감한 개인정보를 입력해서는 안 됩니다.
② 타인의 명예를 훼손하거나 사생활을 침해하는 내용은 사용할 수 없습니다.
③ 폭력, 혐오, 불법적인 내용이 포함된 경우 접수가 제한됩니다.

제6조 (서비스 제한)
서비스 운영자는 다음에 해당하는 경우 사전 통지 없이 콘텐츠를 삭제하거나 이용을 제한할 수 있습니다.
- 타인의 명예를 훼손하는 내용
- 개인정보가 포함된 내용
- 불법적이거나 반사회적인 내용
- 서비스 취지에 현저히 맞지 않는 내용

제7조 (면책)
① 서비스 운영자는 AI가 생성한 판결 결과의 정확성, 적절성에 대해 책임을 지지 않습니다.
② 서비스 이용으로 인해 발생하는 이용자 간 분쟁에 대해 서비스 운영자는 책임을 지지 않습니다.

제8조 (약관 변경)
서비스 운영자는 필요 시 약관을 변경할 수 있으며, 변경 시 서비스 내 공지합니다.`,

    privacy: `소소킹 생활법정 개인정보처리방침

시행일: 2026년 4월 25일

1. 수집하는 정보
서비스는 회원가입 없이 익명으로 이용할 수 있습니다.

[익명 이용 시]
- Firebase 익명 인증 UID (기기 특정 불가)
- 이용자가 입력한 사건 내용, 주장 텍스트
- 서비스 이용 기록 (참여 횟수 등 집계 통계)

[로그인 이용 시 추가 수집]
- 이메일 주소 (이메일 가입 또는 구글 로그인 시)
- 닉네임 (이용자가 직접 설정)
- Google 계정 프로필 (구글 로그인 시, 닉네임 참고용)

2. 수집 목적
- AI 판결 서비스 제공
- 이용 횟수 제한 및 부정 이용 방지
- 닉네임 중복 관리 및 계정 식별
- 서비스 품질 개선 및 오류 분석

3. 제3자 제공
수집된 정보는 원칙적으로 제3자에게 제공하지 않습니다.
단, AI 판결·반박 생성을 위해 이용자가 입력한 사건 내용이 Google LLC의 Gemini API로 전송됩니다.
Google 개인정보처리방침: https://policies.google.com/privacy

4. 보유 및 파기
- 서비스 운영 기간 동안 보관합니다.
- 회원 탈퇴 시 계정 및 모든 관련 데이터가 즉시 영구 삭제됩니다.
- 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.

5. 이용자의 권리
- 닉네임 변경: 계정 메뉴 → 닉네임 변경
- 계정 및 데이터 삭제: 계정 메뉴 → 회원 탈퇴
- 기타 문의: 서비스 내 의견 접수 또는 관리자 연락처

6. 보안
Firebase(Google Cloud) 인프라를 통해 데이터를 암호화·저장하며, 최소 권한 원칙으로 관리합니다.`,

    ai_disclaimer: `소소킹 생활법정 AI 서비스 안내

시행일: 2026년 4월 25일

━━━━━━━━━━━━━━━━━━━━
⚠️ 이 서비스는 순수 오락 목적입니다.
AI 판결은 어떠한 법적 효력도 없습니다.
━━━━━━━━━━━━━━━━━━━━

1. AI 사용 현황

[AI 판사]
매 재판마다 7가지 성향 중 랜덤 배정된 AI 판사가 양측 주장을 분석해 오락용 판결문을 생성합니다.
사용 모델: Google Gemini 2.5 Flash

[AI 상대 - 소소봇]
AI와 대결 모드에서 소소봇이 상대방 역할을 맡아 라운드마다 논리적인 주장을 자동 생성합니다.
사용 모델: Google Gemini 2.5 Flash

2. AI 판결·주장의 한계

· 오락용 콘텐츠로, 법률 전문 지식에 기반하지 않습니다.
· 동일 사건이라도 매번 다른 결과가 나올 수 있습니다.
· AI는 유머·과장·극적 표현을 포함한 오락용 콘텐츠를 생성합니다.
· AI 생성 내용에 사실과 다른 표현이 포함될 수 있습니다.

3. 법적 효력 없음
본 서비스에서 생성된 모든 판결문은 법원 또는 어떠한 공적 기관의 판결과도 무관하며, 법적 효력이 전혀 없습니다.

4. 입력 데이터 처리
이용자가 입력한 사건 내용 및 주장은 AI 생성 목적으로 Google Gemini API에 전송됩니다.
Google 개인정보처리방침: https://policies.google.com/privacy

5. 이용자 주의사항

· 실제 법적 문제는 반드시 변호사 등 전문 법률가에게 상담받으세요.
· 판결 결과를 타인과 공유 시 오락 목적 서비스임을 명시해 주세요.
· 특정인 비방·명예훼손 목적으로 사용하지 마세요.
· 민감한 개인정보나 실제 분쟁 중인 내용은 입력하지 마세요.

6. 진지한 법적 문제가 있다면
· 대한법률구조공단: 132
· 법률홈닥터: www.lawnb.com`
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


async function tabTopics(el) {
  const [activeSnap, pendingSnap, hiddenSnap, catSnap] = await Promise.all([
    getDocs(query(collection(db,'topics'), where('status','==','active'), orderBy('createdAt','desc'), limit(100))),
    getDocs(query(collection(db,'topics'), where('status','==','pending'), orderBy('createdAt','desc'), limit(50))),
    getDocs(query(collection(db,'topics'), where('status','==','hidden'), orderBy('createdAt','desc'), limit(50))),
    getDocs(query(collection(db,'categories'), orderBy('name','asc'))),
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
        <div style="font-size:11px;color:var(--cream-dim);margin-top:4px;">⚔️ ${(t.plaintiffPosition||'').substring(0,30)}...</div>
        <div style="font-size:11px;color:var(--cream-dim);">🛡️ ${(t.defendantPosition||'').substring(0,30)}...</div>
      </td>
      <td style="white-space:nowrap;vertical-align:middle;">
        <select id="${selId}" class="form-input" style="font-size:12px;padding:5px 8px;margin-bottom:6px;width:100%;">
          <option value="${t.category||'기타'}" selected>${t.category||'기타'}</option>
          ${cats.filter(c=>c!==(t.category||'기타')).map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
        <button onclick="window._editTopic('${d.id}')" class="admin-btn admin-btn-gold" style="width:100%;margin-bottom:3px;">✏️ 수정</button>
        <button onclick="window._approveTopic('${d.id}')" class="admin-btn admin-btn-approve" style="width:100%;margin-bottom:3px;">✅ 승인</button>
        <button onclick="window._delTopic('${d.id}')" class="admin-btn admin-btn-danger" style="width:100%;">🗑 거부·삭제</button>
      </td>
    </tr>`;
  };

  const renderActiveRow = d => {
    const t = d.data();
    return `<tr data-cat="${t.category||'기타'}">
      <td style="font-size:12px;">
        <div style="font-weight:700;line-height:1.4;">${t.title}</div>
        <div style="color:var(--cream-dim);font-size:11px;margin-top:2px;">${t.category||'기타'} · ${t.isOfficial?'⭐ 공식':'👤 유저'}</div>
      </td>
      <td style="font-size:12px;color:var(--cream-dim);max-width:180px;">${(t.plaintiffPosition||'').substring(0,45)}…</td>
      <td style="font-size:13px;font-weight:700;text-align:center;">${t.playCount||0}</td>
      <td class="topic-action-cell">
        <button onclick="window._editTopic('${d.id}')" class="admin-btn admin-btn-gold" style="margin-right:3px;">✏️</button>${!t.isOfficial?`<button onclick="window._adoptTopic('${d.id}')" class="admin-btn admin-btn-gold" style="margin-right:3px;">⭐</button>`:''}<button onclick="window._hideTopic('${d.id}')" class="admin-btn" style="margin-right:3px;">숨김</button><button onclick="window._delTopic('${d.id}')" class="admin-btn admin-btn-danger">삭제</button>
      </td>
    </tr>`;
  };

  const renderHiddenRow = d => {
    const t = d.data();
    return `<tr>
      <td style="font-size:12px;color:var(--cream-dim);">
        <div style="font-weight:700;color:var(--cream);">${t.title}</div>
        <div style="font-size:11px;">${t.category||'기타'} · ${t.isOfficial?'⭐ 공식':'👤 유저'}</div>
      </td>
      <td style="white-space:nowrap;">
        <button onclick="window._editTopic('${d.id}')" class="admin-btn admin-btn-gold" style="margin-right:3px;">✏️</button><button onclick="window._restoreTopic('${d.id}')" class="admin-btn admin-btn-approve" style="margin-right:3px;">♻️</button><button onclick="window._delTopic('${d.id}')" class="admin-btn admin-btn-danger">삭제</button>
      </td>
    </tr>`;
  };

  const allCats = ['all', ...new Set(activeSnap.docs.map(d=>d.data().category||'기타'))];

  el.innerHTML = `
    <!-- 사건 직접 등록 -->
    <div style="margin-bottom:24px;">
      <button id="new-topic-toggle" style="display:flex;align-items:center;gap:8px;width:100%;padding:12px 16px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.3);border-radius:10px;color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;text-align:left;">
        <span id="new-topic-arrow">▶</span> ✏️ 공식 사건 직접 등록
      </button>
      <div id="new-topic-form" style="display:none;margin-top:8px;padding:18px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;">
        <div style="display:grid;gap:12px;">
          <div><div class="form-label">사건명 <span style="color:var(--red);">*</span></div>
            <input type="text" id="nt-title" class="form-input" maxlength="30" placeholder="예: 카톡 읽씹 무죄 주장 사건"></div>
          <div><div class="form-label">한 줄 요약 <span style="color:var(--red);">*</span></div>
            <input type="text" id="nt-summary" class="form-input" maxlength="60" placeholder="예: 읽고 2시간 뒤 답장 — 무시인가, 나중에 답할 권리인가"></div>
          <div><div class="form-label">⚔️ 원고 입장 <span style="color:var(--red);">*</span></div>
            <textarea id="nt-plaintiff" class="form-textarea" style="min-height:60px;" maxlength="100" placeholder="원고 측 주장을 입력하세요"></textarea></div>
          <div><div class="form-label">🛡️ 피고 입장 <span style="color:var(--red);">*</span></div>
            <textarea id="nt-defendant" class="form-textarea" style="min-height:60px;" maxlength="100" placeholder="피고 측 주장을 입력하세요"></textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><div class="form-label">카테고리</div>
              <select id="nt-category" class="form-input">${catOptions}<option value="기타">기타</option></select></div>
            <div><div class="form-label">공개 상태</div>
              <select id="nt-status" class="form-input">
                <option value="active">즉시 공개</option>
                <option value="pending">검토 대기</option>
              </select></div>
          </div>
          <button id="nt-submit" class="btn btn-primary" style="margin-top:4px;">⚖️ 공식 사건으로 등록</button>
        </div>
      </div>
    </div>

    ${pendingSnap.docs.length?`
      <div class="admin-section-title" style="margin-top:4px;">🔍 검토 대기 <span style="background:rgba(231,76,60,0.15);color:var(--red);border-radius:20px;padding:1px 8px;font-size:11px;">${pendingSnap.docs.length}</span></div>
      <div style="font-size:12px;color:var(--cream-dim);margin-bottom:10px;">카테고리를 확인·변경하고 승인하세요.</div>
      <div class="admin-section-box" style="margin-bottom:24px;"><div style="overflow-x:auto;">
        <table class="admin-table"><thead><tr><th>사건 내용</th><th style="width:130px;">카테고리 · 처리</th></tr></thead>
        <tbody>${pendingSnap.docs.map(renderPendingRow).join('')}</tbody></table>
      </div></div>
    `:''}

    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
      <div class="admin-section-title" style="margin:0;">✅ 공개 사건 <span style="background:rgba(201,168,76,0.12);color:var(--gold);border-radius:20px;padding:1px 8px;font-size:11px;">${activeSnap.docs.length}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;" id="cat-filter-bar">
        ${allCats.map(c=>`<button class="cat-filter-btn${c==='all'?' active':''}" data-cat="${c}" style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:${c==='all'?'var(--gold-dim)':'none'};color:${c==='all'?'var(--gold)':'var(--cream-dim)'};transition:all 0.15s;">${c==='all'?'전체':c}</button>`).join('')}
      </div>
    </div>
    <div class="admin-section-box" style="margin-bottom:24px;"><div style="overflow-x:auto;">
      <table class="admin-table"><thead><tr><th>사건명</th><th>원고 주장</th><th style="text-align:center;width:60px;">재판수</th><th>관리</th></tr></thead>
      <tbody id="active-tbody">${activeSnap.docs.map(renderActiveRow).join('')||'<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--cream-dim);">없음</td></tr>'}</tbody></table>
    </div></div>

    ${hiddenSnap.docs.length?`
      <div class="admin-section-title">🚫 숨김 처리된 사건 <span style="background:rgba(255,255,255,0.08);color:var(--cream-dim);border-radius:20px;padding:1px 8px;font-size:11px;">${hiddenSnap.docs.length}</span></div>
      <div class="admin-section-box"><div style="overflow-x:auto;">
        <table class="admin-table"><thead><tr><th>사건명</th><th>관리</th></tr></thead>
        <tbody>${hiddenSnap.docs.map(renderHiddenRow).join('')}</tbody></table>
      </div></div>
    `:''}
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

  // 사건 직접 등록 토글
  document.getElementById('new-topic-toggle')?.addEventListener('click', () => {
    const form = document.getElementById('new-topic-form');
    const arrow = document.getElementById('new-topic-arrow');
    const open = form.style.display === 'none';
    form.style.display = open ? 'block' : 'none';
    arrow.textContent = open ? '▼' : '▶';
  });

  // 사건 직접 등록 제출
  document.getElementById('nt-submit')?.addEventListener('click', async () => {
    const title = document.getElementById('nt-title')?.value.trim();
    const summary = document.getElementById('nt-summary')?.value.trim();
    const plaintiff = document.getElementById('nt-plaintiff')?.value.trim();
    const defendant = document.getElementById('nt-defendant')?.value.trim();
    const category = document.getElementById('nt-category')?.value || '기타';
    const status = document.getElementById('nt-status')?.value || 'active';
    if (!title || !summary || !plaintiff || !defendant) { toast('필수 항목을 모두 입력해주세요', 'error'); return; }
    const btn = document.getElementById('nt-submit');
    btn.disabled = true; btn.textContent = '등록 중...';
    try {
      await addDoc(collection(db,'topics'), {
        title, summary,
        plaintiffPosition: plaintiff,
        defendantPosition: defendant,
        category, status,
        isOfficial: true,
        playCount: 0,
        createdAt: serverTimestamp(),
      });
      toast('사건이 등록되었습니다!', 'success');
      loadTab('topics');
    } catch(e) { toast('등록 실패: '+e.message, 'error'); btn.disabled=false; btn.textContent='⚖️ 공식 사건으로 등록'; }
  });

  window._approveTopic = async id => {
    const sel = document.getElementById(`cat-sel-${id}`);
    const cat = sel ? sel.value : '기타';
    await updateDoc(doc(db,'topics',id), { status:'active', category: cat });
    toast('승인됨','success'); loadTab('topics');
  };
  window._adoptTopic = async id => {
    await updateDoc(doc(db,'topics',id), { isOfficial: true });
    toast('⭐ 공식 사건으로 채택됐습니다!', 'success'); loadTab('topics');
  };
  window._hideTopic = async id => {
    await updateDoc(doc(db,'topics',id), { status:'hidden' });
    toast('숨김 처리됨','success'); loadTab('topics');
  };
  window._restoreTopic = async id => {
    await updateDoc(doc(db,'topics',id), { status:'active' });
    toast('복구됨','success'); loadTab('topics');
  };
  window._delTopic = async id => {
    if (!confirm('이 주제를 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db,'topics',id));
    toast('삭제 완료','success'); loadTab('topics');
  };

  // ── 수정 모달 (중복 생성 방지) ──
  let modalEl = document.getElementById('topic-edit-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'topic-edit-modal';
    modalEl.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);overflow-y:auto;padding:24px 16px;';
    modalEl.innerHTML = `
      <div style="max-width:560px;margin:0 auto;background:var(--navy-card);border:1px solid var(--border);border-radius:16px;padding:28px;position:relative;box-shadow:0 24px 64px rgba(0,0,0,0.6);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
          <div style="font-family:'Noto Serif KR',serif;font-size:16px;font-weight:700;color:var(--gold);">✏️ 사건 수정</div>
          <button id="modal-close" style="background:none;border:none;font-size:22px;color:var(--cream-dim);cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1;">✕</button>
        </div>
        <div style="display:grid;gap:14px;">
          <div><div class="form-label">사건명 <span style="color:var(--red);">*</span></div>
            <input id="et-title" class="form-input" maxlength="30"></div>
          <div><div class="form-label">한 줄 요약 <span style="color:var(--red);">*</span></div>
            <input id="et-summary" class="form-input" maxlength="60"></div>
          <div><div class="form-label">⚔️ 원고 입장 <span style="color:var(--red);">*</span></div>
            <textarea id="et-plaintiff" class="form-textarea" style="min-height:70px;" maxlength="100"></textarea></div>
          <div><div class="form-label">🛡️ 피고 입장 <span style="color:var(--red);">*</span></div>
            <textarea id="et-defendant" class="form-textarea" style="min-height:70px;" maxlength="100"></textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div><div class="form-label">카테고리</div>
              <select id="et-category" class="form-input"></select></div>
            <div><div class="form-label">공개 상태</div>
              <select id="et-status" class="form-input">
                <option value="active">공개</option>
                <option value="pending">대기</option>
                <option value="hidden">숨김</option>
              </select></div>
            <div><div class="form-label">구분</div>
              <select id="et-official" class="form-input">
                <option value="true">⭐ 공식</option>
                <option value="false">👤 유저</option>
              </select></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <button id="modal-save" class="btn btn-primary" style="flex:1;">저장</button>
            <button id="modal-cancel" class="admin-btn" style="padding:14px 20px;font-size:14px;">취소</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
    const closeModal = () => { modalEl.style.display = 'none'; };
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(); });
  }

  // 카테고리 옵션 항상 최신화
  document.getElementById('et-category').innerHTML = catOptions + '<option value="기타">기타</option>';

  window._editTopic = async id => {
    const snap = await getDoc(doc(db,'topics',id));
    if (!snap.exists()) { toast('사건을 찾을 수 없습니다','error'); return; }
    const t = snap.data();
    document.getElementById('et-title').value = t.title || '';
    document.getElementById('et-summary').value = t.summary || '';
    document.getElementById('et-plaintiff').value = t.plaintiffPosition || '';
    document.getElementById('et-defendant').value = t.defendantPosition || '';
    document.getElementById('et-category').value = t.category || '기타';
    document.getElementById('et-status').value = t.status || 'active';
    document.getElementById('et-official').value = t.isOfficial ? 'true' : 'false';
    modalEl.style.display = 'block';

    const saveBtn = document.getElementById('modal-save');
    const newSave = saveBtn.cloneNode(true);
    saveBtn.replaceWith(newSave);
    newSave.addEventListener('click', async () => {
      const title = document.getElementById('et-title').value.trim();
      const summary = document.getElementById('et-summary').value.trim();
      const plaintiff = document.getElementById('et-plaintiff').value.trim();
      const defendant = document.getElementById('et-defendant').value.trim();
      if (!title || !summary || !plaintiff || !defendant) { toast('필수 항목을 모두 입력해주세요','error'); return; }
      newSave.disabled = true; newSave.textContent = '저장 중...';
      try {
        await updateDoc(doc(db,'topics',id), {
          title, summary,
          plaintiffPosition: plaintiff,
          defendantPosition: defendant,
          category: document.getElementById('et-category').value,
          status: document.getElementById('et-status').value,
          isOfficial: document.getElementById('et-official').value === 'true',
        });
        toast('수정되었습니다','success');
        modalEl.style.display = 'none';
        loadTab('topics');
      } catch(e) { toast('저장 실패: '+e.message,'error'); newSave.disabled=false; newSave.textContent='저장'; }
    });
  };
}

async function tabCategories(el) {
  const snap = await getDocs(query(collection(db,'categories'), orderBy('name','asc')));
  const cats = snap.docs.map(d=>({id:d.id,...d.data()}));

  const CAT_ICONS = [
    '💬','📱','📞','📩','🗣️',
    '💰','💳','🧾','💸','🏦',
    '🍽️','🍺','☕','🍕','🛒',
    '❤️','💑','👫','🤝','💔',
    '🏠','🛋️','🔑','🏢','🏘️',
    '💼','📋','🖥️','📚','✏️',
    '🎮','🎬','🎵','🎲','⚽',
    '🚗','🚇','✈️','🛵','🚴',
    '🐾','🐕','🐱','🌿','🌸',
    '🛍️','👗','👟','💄','🎁',
    '⚖️','🔥','🌟','😤','🤬',
    '📌','❓','🎯','🏆','💡',
  ];

  const rows = cats.map(c=>`<tr>
    <td style="font-size:18px;text-align:center;">${c.icon||'📌'}</td>
    <td style="font-weight:700;">${c.name}</td>
    <td><button onclick="window._delCat('${c.id}')" class="admin-btn admin-btn-danger">삭제</button></td>
  </tr>`).join('');

  const iconBtns = CAT_ICONS.map(ic=>`
    <button type="button" class="icon-pick-btn" data-icon="${ic}" title="${ic}"
      style="font-size:20px;width:40px;height:40px;border:2px solid transparent;border-radius:8px;background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.15s;line-height:1;"
    >${ic}</button>`).join('');

  el.innerHTML = `
    <div class="admin-section-box" style="margin-bottom:24px;"><div style="overflow-x:auto;">
      <table class="admin-table">
        <thead><tr><th style="text-align:center;">아이콘</th><th>이름</th><th>관리</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--cream-dim);">카테고리 없음</td></tr>'}</tbody>
      </table>
    </div></div>
    <form id="cat-form" style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:20px;">
      <div style="margin-bottom:16px;">
        <div class="form-label" style="margin-bottom:10px;">아이콘 선택</div>
        <div id="icon-picker" style="display:flex;flex-wrap:wrap;gap:4px;">${iconBtns}</div>
        <div style="margin-top:10px;font-size:12px;color:var(--cream-dim);">선택된 아이콘: <span id="icon-preview" style="font-size:18px;vertical-align:middle;">💬</span></div>
        <input type="hidden" id="cat-icon" value="💬">
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <div style="flex:1;"><div class="form-label">카테고리명</div><input type="text" id="cat-name" class="form-input" placeholder="예: 카톡" maxlength="10" required></div>
        <button type="submit" class="btn btn-primary" style="width:auto;padding:12px 20px;">추가</button>
      </div>
    </form>
    <style>
      .icon-pick-btn:hover { background:rgba(201,168,76,0.1) !important; border-color:rgba(201,168,76,0.4) !important; }
      .icon-pick-btn.selected { background:rgba(201,168,76,0.15) !important; border-color:var(--gold) !important; }
      [data-theme="light"] .icon-pick-btn { background:rgba(0,0,0,0.03) !important; }
      [data-theme="light"] .icon-pick-btn:hover { background:rgba(154,112,24,0.1) !important; border-color:rgba(154,112,24,0.5) !important; }
      [data-theme="light"] .icon-pick-btn.selected { background:rgba(154,112,24,0.12) !important; border-color:var(--gold) !important; }
    </style>
  `;

  // 첫 번째 아이콘 기본 선택
  const firstBtn = el.querySelector('.icon-pick-btn');
  if (firstBtn) firstBtn.classList.add('selected');

  el.querySelectorAll('.icon-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.icon-pick-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('cat-icon').value = btn.dataset.icon;
      document.getElementById('icon-preview').textContent = btn.dataset.icon;
    });
  });

  document.getElementById('cat-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value.trim();
    if (!name) return;
    await addDoc(collection(db,'categories'), {
      name,
      icon: document.getElementById('cat-icon').value || '📌',
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
