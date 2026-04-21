import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
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
          ${[['cases','사건 목록'],['reports','신고 목록'],['usage','사용량·비용'],['settings','설정'],['biz','사업자 정보'],['policy','정책 문서'],['connection','연결 상태']]
            .map(([id,label])=>`<button class="admin-tab${currentTab===id?' active':''}" onclick="window._tab('${id}')">${label}</button>`).join('')}
        </div>
        <div id="tab-content"></div>
      </div>
    </div>`;
  window._logout = async () => { await signOut(auth); };
  window._tab = tab => { currentTab=tab; document.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('active',b.textContent==={cases:'사건 목록',reports:'신고 목록',usage:'사용량·비용',settings:'설정',biz:'사업자 정보',policy:'정책 문서',connection:'연결 상태'}[tab])); loadTab(tab); };
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

  const card = (label, value, sub='') => `<div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;"><div style="font-size:11px;color:var(--cream-dim);">${label}</div><div style="font-size:18px;font-weight:700;color:var(--cream);margin-top:4px;">${value}</div>${sub?`<div style="font-size:11px;color:var(--cream-dim);margin-top:2px;">${sub}</div>`:''}</div>`;

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
