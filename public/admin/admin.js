import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
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
          <button type="button" id="reset-btn" style="width:100%;margin-top:10px;background:none;border:none;color:var(--cream-dim);font-size:13px;cursor:pointer;padding:8px;">비밀번호를 잊으셨나요?</button>
        </form>
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
          ${[['cases','사건 목록'],['reports','신고 목록'],['usage','사용량·비용'],['settings','설정'],['biz','사업자 정보'],['policy','정책 문서']]
            .map(([id,label])=>`<button class="admin-tab${currentTab===id?' active':''}" onclick="window._tab('${id}')">${label}</button>`).join('')}
        </div>
        <div id="tab-content"></div>
      </div>
    </div>`;
  window._logout = async () => { await signOut(auth); };
  window._tab = tab => { currentTab=tab; document.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('active',b.textContent==={cases:'사건 목록',reports:'신고 목록',usage:'사용량·비용',settings:'설정',biz:'사업자 정보',policy:'정책 문서'}[tab])); loadTab(tab); };
  loadTab(currentTab);
}

async function loadTab(tab) {
  const el = document.getElementById('tab-content');
  el.innerHTML = '<div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>';
  if (tab==='cases') await tabCases(el);
  else if (tab==='reports') await tabReports(el);
  else if (tab==='usage') await tabUsage(el);
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
    return `<tr><td style="font-size:12px;">${r.caseId||'-'}</td><td>${r.reason||'-'}</td><td><span class="badge ${r.status==='resolved'?'badge-gold':'badge-red'}">${r.status||'pending'}</span></td><td style="font-size:12px;color:var(--cream-dim);">${date}</td><td><button onclick="window._resolve('${d.id}')" style="background:none;border:1px solid var(--gold);color:var(--gold);padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;">처리완료</button></td></tr>`;
  }).join('');
  el.innerHTML = `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>사건ID</th><th>신고사유</th><th>상태</th><th>날짜</th><th>관리</th></tr></thead><tbody>${rows||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--cream-dim);">신고 없음</td></tr>'}</tbody></table></div>`;
  window._resolve = async id => { await updateDoc(doc(db,'reports',id),{status:'resolved'}); toast('처리완료','success'); loadTab('reports'); };
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
  const monthlyBudgetKrw = s.monthlyBudgetKrw ?? 50000;

  // ─── 실제 무료 한도 (공식 문서 기준, 2025-2026) ───
  // Gemini 2.5 Flash: 무료 티어는 달러 크레딧이 아닌 횟수 제한
  const GEMINI_FREE_RPD  = 250;      // 요청 수/일 (requests per day)
  const GEMINI_FREE_RPM  = 10;       // 요청 수/분 (requests per minute)
  const GEMINI_FREE_TPM  = 250000;   // 토큰/분 (tokens per minute)
  // Firebase Spark 플랜 무료 한도
  const FS_FREE_READS_DAY    = 50000;    // Firestore 읽기/일
  const FS_FREE_WRITES_DAY   = 20000;    // Firestore 쓰기/일
  const FS_FREE_DELETES_DAY  = 20000;    // Firestore 삭제/일
  const FUNC_FREE_INVOC_MONTH = 2000000; // Functions 호출/월
  const FUNC_FREE_GBSEC_MONTH = 400000;  // Functions GB-초/월

  // 60일치 조회 (이번 달 + 지난 달)
  const days = [];
  for (let i = 0; i < 60; i++) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    days.push(dt.toISOString().slice(0,10));
  }
  const snaps = await Promise.all(days.map(date => getDoc(doc(db,'usage_stats',`daily_${date}`))));

  const calcCost = d =>
    (d.geminiInputTokens||0)/1e6*inputPrice + (d.geminiOutputTokens||0)/1e6*outputPrice
    + (d.firestoreWrites||0)*firestoreWritePrice + (d.firestoreReads||0)*firestoreReadPrice
    + (d.functionInvocations||0)*invocationPrice;

  const rows = days.map((date, i) => {
    const d = snaps[i].exists() ? snaps[i].data() : {};
    const cost = calcCost(d);
    return {
      date, cases: d.caseCount||0, gReq: d.geminiRequests||0,
      gIn: d.geminiInputTokens||0, gOut: d.geminiOutputTokens||0,
      fw: d.firestoreWrites||0, fr: d.firestoreReads||0,
      inv: d.functionInvocations||0, cost, costKrw: Math.round(cost * krw),
    };
  });

  const now = new Date();
  const thisMonth = now.toISOString().slice(0,7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0,7);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();

  const sumRows = arr => arr.reduce((a,r) => ({
    cases:a.cases+r.cases, gReq:a.gReq+r.gReq, gIn:a.gIn+r.gIn, gOut:a.gOut+r.gOut,
    fw:a.fw+r.fw, fr:a.fr+r.fr, inv:a.inv+r.inv, cost:a.cost+r.cost, costKrw:a.costKrw+r.costKrw,
  }), {cases:0,gReq:0,gIn:0,gOut:0,fw:0,fr:0,inv:0,cost:0,costKrw:0});

  const thisM = sumRows(rows.filter(r => r.date.startsWith(thisMonth)));
  const lastM = sumRows(rows.filter(r => r.date.startsWith(lastMonth)));
  const today = rows[0];

  const tierColor = (pct, warn=70, danger=90) =>
    pct >= danger ? '#e74c3c' : pct >= warn ? '#f39c12' : '#27ae60';

  const pbar = (used, total, label, unit='') => {
    const pct = Math.min((used / total) * 100, 100);
    const color = tierColor(pct);
    const warn = pct >= 90 ? '🚨 한도 초과 임박!' : pct >= 70 ? '⚠️ 주의 필요' : '';
    return `<div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:5px;">
        <span style="color:var(--cream-dim);">${label}</span>
        <span style="color:${color};font-weight:700;">${used.toLocaleString()} / ${total.toLocaleString()}${unit} <span style="font-size:10px;opacity:.8;">(${pct.toFixed(1)}%)</span> ${warn}</span>
      </div>
      <div style="background:rgba(255,255,255,0.08);border-radius:100px;height:8px;overflow:hidden;">
        <div style="width:${pct.toFixed(1)}%;height:100%;background:linear-gradient(90deg,${color}99,${color});border-radius:100px;transition:width .3s;"></div>
      </div>
    </div>`;
  };

  const miniStat = (label, value, sub='') =>
    `<div style="text-align:center;padding:12px 8px;background:rgba(255,255,255,0.03);border-radius:8px;">
      <div style="font-size:16px;font-weight:700;color:var(--cream);">${value}</div>
      ${sub ? `<div style="font-size:10px;color:var(--gold);margin-top:1px;">${sub}</div>` : ''}
      <div style="font-size:10px;color:var(--cream-dim);margin-top:2px;">${label}</div>
    </div>`;

  const gInCostKrw  = Math.round((thisM.gIn/1e6)*inputPrice*krw);
  const gOutCostKrw = Math.round((thisM.gOut/1e6)*outputPrice*krw);
  const budgetPct   = Math.min((thisM.costKrw / monthlyBudgetKrw) * 100, 100);
  const budgetColor = tierColor(budgetPct, 50, 80);
  const geminiTokenAvg = thisM.gReq ? Math.round((thisM.gIn+thisM.gOut)/thisM.gReq) : 0;

  el.innerHTML = `
    <!-- 오늘 요약 배너 -->
    <div style="margin-bottom:20px;padding:10px 16px;background:rgba(201,168,76,0.08);border-radius:8px;font-size:12px;color:var(--gold);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
      <span>📅 오늘 ${today.date}</span>
      <span>사건 <b>${today.cases}</b>건</span>
      <span>Gemini <b>${today.gReq}</b>회 호출</span>
      <span>Firestore 읽기 <b>${today.fr.toLocaleString()}</b> · 쓰기 <b>${today.fw.toLocaleString()}</b></span>
    </div>

    <!-- ① Gemini 무료 한도 (오늘) -->
    <div style="padding:18px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:var(--cream);">🤖 Gemini 2.5 Flash 무료 한도 (오늘)</div>
        <div style="font-size:10px;color:var(--cream-dim);background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:4px;">무료 티어 = 횟수 제한, 금액 아님</div>
      </div>
      ${pbar(today.gReq, GEMINI_FREE_RPD, `요청 수/일 (RPD)`, '회')}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px;">
        ${miniStat('오늘 요청', today.gReq+'회', `/ ${GEMINI_FREE_RPD}회 무료`)}
        ${miniStat('분당 한도', GEMINI_FREE_RPM+'RPM', '무료 한도')}
        ${miniStat('분당 토큰', (GEMINI_FREE_TPM/1000)+'K TPM', '무료 한도')}
      </div>
      <div style="margin-top:12px;padding:8px 12px;background:rgba(255,255,255,0.04);border-radius:6px;font-size:11px;color:var(--cream-dim);line-height:1.7;">
        · 무료 한도 초과 시 API 오류 발생 (요금 청구 아님 — 요청 차단)<br>
        · 유료 전환(Blaze/Pay-as-you-go) 시: 입력 $${inputPrice}/1M · 출력 $${outputPrice}/1M 토큰
      </div>
    </div>

    <!-- ② Firebase Spark 플랜 무료 한도 (오늘 기준) -->
    <div style="padding:18px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:var(--cream);margin-bottom:14px;">🔥 Firebase Spark 플랜 무료 한도</div>
      <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:10px;">Firestore — 일별 한도 (오늘)</div>
      ${pbar(today.fr, FS_FREE_READS_DAY,   'Firestore 읽기/일', '회')}
      ${pbar(today.fw, FS_FREE_WRITES_DAY,  'Firestore 쓰기/일', '회')}
      <div style="font-size:11px;font-weight:700;color:var(--gold);margin:14px 0 10px;">Cloud Functions — 월별 한도 (이번 달)</div>
      ${pbar(thisM.inv, FUNC_FREE_INVOC_MONTH, 'Functions 호출/월', '회')}
      <div style="margin-top:8px;padding:8px 12px;background:rgba(255,255,255,0.04);border-radius:6px;font-size:11px;color:var(--cream-dim);line-height:1.7;">
        · Firestore 삭제 무료: ${FS_FREE_DELETES_DAY.toLocaleString()}/일 · 스토리지: 1GiB 무료<br>
        · Functions GB-초: ${FUNC_FREE_GBSEC_MONTH.toLocaleString()}/월 무료 · 아웃바운드: 5GB/월 무료<br>
        · Firebase Hosting: 스토리지 10GB · 전송 360MB/일 무료
      </div>
    </div>

    <!-- ③ 이번 달 vs 지난 달 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div style="padding:16px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.3);border-radius:10px;">
        <div style="font-size:11px;color:var(--gold);font-weight:700;margin-bottom:8px;">이번 달 ${thisMonth} · ${now.getDate()}/${daysInMonth}일</div>
        <div style="font-size:24px;font-weight:700;color:var(--gold);">${thisM.gReq}회 호출</div>
        <div style="font-size:11px;color:var(--cream-dim);margin-top:8px;line-height:2;">
          사건 ${thisM.cases}건<br>
          토큰 ${(thisM.gIn+thisM.gOut).toLocaleString()} (입력${thisM.gIn.toLocaleString()}/출력${thisM.gOut.toLocaleString()})<br>
          Firestore R/W ${thisM.fr.toLocaleString()} / ${thisM.fw.toLocaleString()}
        </div>
      </div>
      <div style="padding:16px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;">
        <div style="font-size:11px;color:var(--cream-dim);font-weight:700;margin-bottom:8px;">지난 달 ${lastMonth}</div>
        <div style="font-size:24px;font-weight:700;color:var(--cream);">${lastM.gReq}회 호출</div>
        <div style="font-size:11px;color:var(--cream-dim);margin-top:8px;line-height:2;">
          사건 ${lastM.cases}건<br>
          토큰 ${(lastM.gIn+lastM.gOut).toLocaleString()} (입력${lastM.gIn.toLocaleString()}/출력${lastM.gOut.toLocaleString()})<br>
          Firestore R/W ${lastM.fr.toLocaleString()} / ${lastM.fw.toLocaleString()}
        </div>
      </div>
    </div>

    <!-- ④ 유료 전환 시 예상 비용 (참고용) -->
    <div style="padding:18px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:13px;font-weight:700;color:var(--cream);">💳 유료 전환 시 예상 비용 (이번 달 기준)</div>
        <div style="font-size:10px;color:var(--cream-dim);">현재 무료 티어 사용 중이라면 실제 청구 없음</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
        ${miniStat('Gemini 입력', '₩'+gInCostKrw.toLocaleString(), `${thisM.gIn.toLocaleString()} 토큰`)}
        ${miniStat('Gemini 출력', '₩'+gOutCostKrw.toLocaleString(), `${thisM.gOut.toLocaleString()} 토큰`)}
        ${miniStat('평균 토큰/회', geminiTokenAvg.toLocaleString(), `${thisM.gReq}회 기준`)}
      </div>
      <div style="font-size:11px;color:var(--cream-dim);margin-bottom:12px;">
        Firestore + Functions 예상: ₩${(thisM.costKrw - gInCostKrw - gOutCostKrw).toLocaleString()}
        &nbsp;→&nbsp; <b style="color:var(--cream);">이번 달 총 예상: ₩${thisM.costKrw.toLocaleString()}</b>
      </div>
      <div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:12px;">
        <span style="color:var(--cream-dim);">설정 예산 대비 (₩${monthlyBudgetKrw.toLocaleString()})</span>
        <span style="color:${budgetColor};font-weight:700;">${budgetPct.toFixed(1)}%</span>
      </div>
      <div style="background:rgba(255,255,255,0.08);border-radius:100px;height:8px;overflow:hidden;">
        <div style="width:${budgetPct.toFixed(1)}%;height:100%;background:linear-gradient(90deg,${budgetColor}99,${budgetColor});border-radius:100px;"></div>
      </div>
    </div>

    <!-- ⑤ 일별 테이블 -->
    <div style="overflow-x:auto;">
      <table class="admin-table">
        <thead><tr><th>날짜</th><th>사건</th><th>Gemini 요청</th><th>토큰 (입/출)</th><th>Firestore (R/W)</th><th>Functions</th></tr></thead>
        <tbody>${rows.filter(r=>r.cases||r.gReq).slice(0,30).map(r => {
          const gPct = ((r.gReq/GEMINI_FREE_RPD)*100).toFixed(0);
          const rPct = ((r.fr/FS_FREE_READS_DAY)*100).toFixed(0);
          const wPct = ((r.fw/FS_FREE_WRITES_DAY)*100).toFixed(0);
          const gColor = tierColor(r.gReq/GEMINI_FREE_RPD*100);
          return `<tr>
            <td style="font-size:12px;">${r.date}</td>
            <td>${r.cases}</td>
            <td style="color:${gColor};font-weight:${r.gReq >= GEMINI_FREE_RPD*0.7?'700':'400'};">${r.gReq} <span style="font-size:10px;opacity:.7;">/ ${GEMINI_FREE_RPD} (${gPct}%)</span></td>
            <td style="font-size:11px;">${r.gIn.toLocaleString()} / ${r.gOut.toLocaleString()}</td>
            <td style="font-size:11px;">${r.fr.toLocaleString()}<span style="font-size:9px;color:var(--cream-dim);"> (${rPct}%)</span> / ${r.fw.toLocaleString()}<span style="font-size:9px;color:var(--cream-dim);"> (${wPct}%)</span></td>
            <td style="font-size:11px;">${r.inv.toLocaleString()}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--cream-dim);">아직 집계된 데이터가 없습니다</td></tr>'}
        </tbody>
      </table>
    </div>
    <div style="margin-top:16px;padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--cream-dim);line-height:1.9;">
      📌 <b style="color:var(--cream);">출처: 공식 문서 기준 (2025-2026)</b><br>
      · Gemini 2.5 Flash 무료: 250 RPD · 10 RPM · 250,000 TPM — 한도 초과 시 요금 청구 없이 요청 차단됨<br>
      · Firebase Spark: Firestore 읽기 5만/일 · 쓰기 2만/일 · Functions 200만 호출/월 · GB-초 40만/월<br>
      · 유료 단가 (Pay-as-you-go): Gemini 입력 $${inputPrice}/1M · 출력 $${outputPrice}/1M · 환율 ₩${krw}/$1<br>
      · 집계는 Cloud Function 호출 시만 기록. <b style="color:var(--gold);">Firebase 콘솔 "사용량 및 결제"가 최종 기준.</b>
    </div>`;
}

async function tabSettings(el) {
  const snap = await getDoc(doc(db,'site_settings','config'));
  const d = snap.exists()?snap.data():{};
  el.innerHTML = `
    <form id="sf">
      <div class="form-group"><label class="form-label">일일 접수 한도</label><input type="number" id="dl" class="form-input" value="${d.dailyLimit||3}" min="1" max="20"></div>
      <div class="form-group"><label class="form-label">쿨다운 (초)</label><input type="number" id="cd" class="form-input" value="${d.cooldownSec||45}" min="0" max="300"></div>
      <div class="form-group"><label class="form-label">금칙어 (쉼표 구분)</label><textarea id="bw" class="form-textarea" style="min-height:80px;">${(d.bannedWords||[]).join(', ')}</textarea></div>
      <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px 14px 4px;margin:20px 0;">
        <legend style="padding:0 8px;color:var(--gold);font-size:13px;">💰 비용 단가 (사용량·비용 계산용)</legend>
        <div class="form-group"><label class="form-label">Gemini 입력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gip" class="form-input" value="${d.geminiInputPricePerM ?? 0.075}"></div>
        <div class="form-group"><label class="form-label">Gemini 출력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gop" class="form-input" value="${d.geminiOutputPricePerM ?? 0.30}"></div>
        <div class="form-group"><label class="form-label">원-달러 환율 (₩/$1)</label><input type="number" id="krw" class="form-input" value="${d.krwUsdRate ?? 1400}"></div>
        <div class="form-group"><label class="form-label">유료 전환 시 월 예산 (₩) <span style="font-weight:400;color:var(--cream-dim);font-size:11px;">— 유료 플랜 사용 시 예산 기준선 (무료 티어에서는 참고용)</span></label><input type="number" id="budget" class="form-input" value="${d.monthlyBudgetKrw ?? 50000}" step="10000" min="0"></div>
      </fieldset>
      <button type="submit" class="btn btn-primary">저장</button>
    </form>`;
  document.getElementById('sf').addEventListener('submit', async e => {
    e.preventDefault();
    await setDoc(doc(db,'site_settings','config'),{
      ...( snap.exists()?snap.data():{} ),
      dailyLimit:parseInt(document.getElementById('dl').value),
      cooldownSec:parseInt(document.getElementById('cd').value),
      bannedWords:document.getElementById('bw').value.split(',').map(w=>w.trim()).filter(Boolean),
      geminiInputPricePerM: parseFloat(document.getElementById('gip').value),
      geminiOutputPricePerM: parseFloat(document.getElementById('gop').value),
      krwUsdRate: parseFloat(document.getElementById('krw').value),
      monthlyBudgetKrw: parseFloat(document.getElementById('budget').value),
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
소소킹 판결소(이하 "서비스")는 일상의 사소한 억울함을 AI가 과하게 진지하게 판결해주는 오락형 서비스입니다. 본 약관은 서비스 이용에 관한 기본 사항을 규정합니다.

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

    privacy: `소소킹 판결소 개인정보처리방침

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
소소킹 판결소는 Google Gemini AI를 활용하여 이용자가 접수한 사건에 대한 판결문을 자동 생성하는 오락형 서비스입니다.

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
