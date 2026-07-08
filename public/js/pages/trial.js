import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦','과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const DOCKET_STEPS = [
  ['filed','사건접수','사건번호 발급'],
  ['received','소소경찰','초동수사 착수'],
  ['evidence','증거채집','증거 아닌 증거'],
  ['plaintiff','황당검사','엄숙한 공소제기'],
  ['defendant','변호인','말은 되는 반박'],
  ['verdict','재판공방','과몰입 심리'],
  ['sentenced','판결선고','황당 처분']
];

const LOADING_MSGS = [
  '소소경찰서 접수계가 사건번호를 붙이고 서류철 색깔을 고르는 중입니다... 📋',
  '생활반경 CCTV를 확인하는 척 0.5배속으로 돌려보는 중입니다... 📹',
  '현장검증팀이 빈자리와 수상한 침묵을 표시하는 중입니다... 🚓',
  '소과수 감식반이 별일 아닌 흔적을 대형 단서처럼 포장하는 중입니다... 🔍',
  '탐문수사 결과 “듣다 보니 원고 말도 맞다”는 진술을 확보하는 중입니다... 📝',
  '황당검사가 작은 일을 공소장 세 장 분량으로 키우는 중입니다... 💼',
  '피고측 변호인이 말은 되지만 얄미운 반박을 준비하는 중입니다... 🛡️',
  '재판부가 CCTV 사각지대보다 마음속 사각지대를 더 중하게 보는 중입니다... ⚖️',
  '방청석이 왜인지 고개를 끄덕이다가 웃음을 참는 중입니다... 🤫',
  '황당 처분에 간식 배상과 재발방지 자가진단을 끼워 넣는 중입니다... 🔨'
];

let caseData = null;
let unsubscribeCase = null;
let unsubscribeResult = null;

export async function renderTrial(container, caseId) {
  caseData = null;
  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">🏛️ 소소킹 황당재판</span></div>
      <div class="container" style="padding-top:20px;padding-bottom:70px;">
        <div id="docket-card" class="card" style="padding:18px;margin-bottom:14px;border-color:rgba(201,168,76,.45);">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:5px;">ABSURD COURT DRAMA</div>
              <div id="docket-title" style="font-family:var(--font-serif);font-size:20px;font-weight:900;line-height:1.45;">황당사건 배당 중</div>
              <div id="docket-meta" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">소소킹 황당재판소 · 제404호 황당법정</div>
            </div>
            <div style="text-align:right;min-width:72px;">
              <div style="font-size:28px;">⚖️</div>
              <div id="docket-status" style="font-size:11px;color:var(--gold);font-weight:800;">접수중</div>
            </div>
          </div>
        </div>

        <div class="card" style="padding:14px;margin-bottom:14px;background:rgba(201,168,76,.07);border-color:rgba(201,168,76,.32);">
          <div style="font-weight:900;color:var(--gold);margin-bottom:6px;">소소한 일도 수사·공방·판결까지 갑니다</div>
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.75;">소소경찰이 CCTV를 돌려보고, 황당검사와 피고측 변호인이 억지로 다툰 뒤, 재판부가 작은 일을 크게 판결합니다.</div>
        </div>

        <div id="docket-timeline" style="display:flex;overflow-x:auto;gap:8px;margin-bottom:16px;padding-bottom:4px;"></div>
        <div id="steps-container"></div>
        <div id="loading-area" style="text-align:center;padding:34px 0;">
          <div class="loading-dots"><span></span><span></span><span></span></div>
          <div id="loading-text" style="font-size:13px;color:var(--cream-dim);margin-top:10px;line-height:1.7;">${LOADING_MSGS[0]}</div>
        </div>
      </div>
    </div>`;
  renderTimeline('filed');

  let msgIdx = 0;
  const msgTimer = setInterval(() => {
    msgIdx = (msgIdx + 1) % LOADING_MSGS.length;
    const el = document.getElementById('loading-text');
    if (el) el.textContent = LOADING_MSGS[msgIdx];
  }, 2300);

  const stop = () => {
    clearInterval(msgTimer);
    try { unsubscribeCase?.(); } catch {}
    try { unsubscribeResult?.(); } catch {}
    unsubscribeCase = null;
    unsubscribeResult = null;
    window._pageCleanup = null;
  };

  const showError = (message = '') => {
    stop();
    const la = document.getElementById('loading-area');
    if (la) la.innerHTML = `
      <div class="card" style="border-color:rgba(231,76,60,.55);padding:18px;text-align:left;">
        <div style="font-size:17px;color:var(--red);font-weight:900;margin-bottom:8px;">⚠️ 황당재판 진행 중 오류</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(message || '재판부가 황당함을 감당하지 못하고 잠시 휴정했습니다.')}</div>
        <a href="#/submit" class="btn btn-secondary" style="margin-top:14px;">다시 접수하기</a>
      </div>`;
  };

  const keepWaiting = () => {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = '수사기록과 공방기록이 장황해지고 있습니다. 판결문 완성 즉시 이동합니다... ⚖️';
  };

  unsubscribeCase = onSnapshot(doc(db, 'cases', caseId), (snap) => {
    if (!snap.exists()) return;
    caseData = snap.data();
    updateDocket(caseData);
    renderTimeline(caseData.courtStage || 'filed');
    if (caseData.status === 'error' || caseData.status === 'blocked') showError(caseData.errorMessage || '접수 제한 내용이 포함되어 있습니다.');
  }, (err) => showError(err.message));

  unsubscribeResult = onSnapshot(doc(db, 'results', caseId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    renderTimeline(data.courtStage || caseData?.courtStage || 'filed');
    if (data.sentence) {
      stop();
      const la = document.getElementById('loading-area');
      if (la) la.innerHTML = `<div class="card" style="padding:18px;text-align:center;border-color:rgba(201,168,76,.55);"><div style="font-size:30px;margin-bottom:6px;">🔨</div><div style="font-weight:900;color:var(--gold);">황당판결 선고 완료</div><div style="font-size:12px;color:var(--cream-dim);margin-top:4px;">판결문 열람실로 이동합니다.</div></div>`;
      setTimeout(() => { location.hash = `#/result/${encodeURIComponent(caseId)}`; }, 1400);
    }
  }, (err) => showError(err.message));

  window._pageCleanup = stop;

  try {
    const generateTrial = httpsCallable(functions, 'generateTrial');
    await generateTrial({ caseId });
  } catch (e) {
    console.error(e);
    const msg = `${e?.code || ''} ${e?.message || ''}`.toLowerCase();
    if (msg.includes('deadline') || msg.includes('timeout')) {
      keepWaiting();
      return;
    }
    showError(e?.message || '황당재판 호출에 실패했습니다.');
  }
}

function updateDocket(c) {
  const title = document.getElementById('docket-title');
  const meta = document.getElementById('docket-meta');
  const status = document.getElementById('docket-status');
  if (title) title.textContent = c.caseTitle || '사건명 미상';
  if (meta) meta.innerHTML = `${escapeHtml(c.docketNumber || '사건번호 부여중')}<br>${escapeHtml(c.division || '제3황당재판부')} · ${escapeHtml(c.courtroom || '제404호 황당법정')} · 원고 ${escapeHtml(c.nickname || '익명')}`;
  if (status) status.textContent = stageLabel(c.courtStage || c.status || 'filed');
}

function stageLabel(stage) {
  const row = DOCKET_STEPS.find(([id]) => id === stage);
  if (row) return row[1];
  if (stage === 'hearing') return '공방중';
  if (stage === 'error') return '휴정';
  return '진행중';
}

function renderTimeline(activeStage) {
  const el = document.getElementById('docket-timeline');
  if (!el) return;
  const activeIndex = Math.max(0, DOCKET_STEPS.findIndex(([id]) => id === activeStage));
  el.innerHTML = DOCKET_STEPS.map(([id, title, sub], i) => {
    const done = i <= activeIndex;
    return `<div style="min-width:106px;padding:10px 9px;border-radius:12px;border:1px solid ${done ? 'rgba(201,168,76,.65)' : 'var(--border)'};background:${done ? 'rgba(201,168,76,.11)' : 'rgba(255,255,255,.025)'};">
      <div style="font-size:15px;margin-bottom:3px;">${done ? '✅' : '▫️'}</div>
      <div style="font-size:12px;font-weight:900;color:${done ? 'var(--gold)' : 'var(--cream-dim)'};">${escapeHtml(title)}</div>
      <div style="font-size:10px;color:var(--cream-dim);margin-top:2px;">${escapeHtml(sub)}</div>
    </div>`;
  }).join('');
}

function renderSteps(data) {
  const container = document.getElementById('steps-container');
  if (!container) return;
  let html = '';
  if (data.reception) html += stepCard('📋 접수계', '사건번호 부여 및 수사 배당', data.reception, '접수완료');
  if (data.investigation) html += stepCard('🚓 소소경찰 수사기록', `${escapeHtml(data.analystName || '사건담당 조사관')}의 CCTV·탐문·감식`, data.investigation, '수사보고');
  if (Array.isArray(data.evidenceList) && data.evidenceList.length) html += listCard('🔍 증거채집 목록', data.evidenceList, '증거 아닌 증거');
  if (data.absurdityReview) html += stepCard('😳 재판부 사전검토', '작은 일이 대형사건이 된 경위', data.absurdityReview, '사전검토');
  if (Array.isArray(data.keyIssues) && data.keyIssues.length) html += listCard('🧷 공판 쟁점', data.keyIssues, '쟁점정리');
  if (data.plaintiffArg) html += stepCard('💼 황당검사 측', `${escapeHtml(data.prosecutorName || '황당검사')}의 억지 공소제기`, data.plaintiffArg, '검사');
  if (data.defendantArg) html += stepCard('🛡️ 피고측 변호인', `${escapeHtml(data.defenderName || '피고측 변호인')}의 말은 되는 반박`, data.defendantArg, '변호인');
  if (data.judgeType) {
    html += `<div class="card step-card visible" style="margin-bottom:14px;padding:20px;text-align:center;border-color:rgba(201,168,76,.55);">
      <div style="font-size:13px;color:var(--cream-dim);margin-bottom:6px;">황당재판부 배당 결과</div>
      <div style="font-size:44px;margin-bottom:6px;">${JUDGE_ICON[data.judgeType] || '⚖️'}</div>
      <div style="font-family:var(--font-serif);font-size:22px;color:var(--gold);font-weight:900;">${escapeHtml(data.judgeType)} 재판부</div>
      <div style="font-size:12px;color:var(--cream-dim);margin-top:6px;">${escapeHtml(data.courtroom || '제404호 황당법정')}</div>
    </div>`;
  }
  if (data.courtOpinion) html += stepCard('⚖️ 재판부', '검사와 변호인의 공방에 대한 과몰입 판단', data.courtOpinion, '판단', true);
  if (data.verdict) html += stepCard('📜 재판부', '황당판결문 작성', data.verdict, '판결', true);
  if (data.sentence) {
    html += `<div class="card sentence-card step-card visible" style="margin-bottom:14px;">
      <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">🔨 주문 · 황당 처분</div>
      <div class="sentence-text" style="white-space:pre-line;line-height:1.9;">${escapeHtml(data.sentence)}</div>
    </div>`;
  }
  container.innerHTML = html;
}

function listCard(title, items, badge) {
  return `<div class="card step-card visible" style="margin-bottom:14px;padding:18px;">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px;">
      <div class="step-role">${escapeHtml(title)}</div>
      <span class="badge badge-gold">${escapeHtml(badge)}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${items.map((x, i) => `<div style="display:flex;gap:10px;padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.025);"><div style="color:var(--gold);font-weight:900;min-width:20px;">${i + 1}</div><div style="font-size:13px;color:var(--cream);line-height:1.7;">${escapeHtml(x)}</div></div>`).join('')}
    </div>
  </div>`;
}

function stepCard(role, label, content, badge, verdict = false) {
  return `<div class="card step-card visible" style="margin-bottom:14px;padding:18px;position:relative;overflow:hidden;">
    ${verdict ? '<div class="verdict-stamp">판결</div>' : ''}
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px;">
      <div class="step-role">${role} · ${label}</div>
      <span class="badge badge-gold">${escapeHtml(badge)}</span>
    </div>
    <div class="step-content" style="white-space:pre-line;line-height:1.85;">${escapeHtml(content)}</div>
  </div>`;
}
