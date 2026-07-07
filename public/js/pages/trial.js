import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦','과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const DOCKET_STEPS = [
  ['filed','소장 접수','사건번호 부여'],
  ['received','접수 심사','접수관 기록'],
  ['evidence','증거 조사','증거목록 검토'],
  ['plaintiff','원고 변론','준비서면 제출'],
  ['defendant','피고 답변','항변 제출'],
  ['verdict','판사 심리','판결문 작성'],
  ['sentenced','선고','생활형 처분']
];

const LOADING_MSGS = [
  '접수계 직원이 사건번호에 권위를 부여하는 중입니다... 📋',
  '재판부가 이 사건을 제404호 생활법정에 배당하는 중입니다... 🏛️',
  '조사관이 증거목록을 검토하는 중입니다... 🔍',
  '원고 측 대리인이 억울함을 정리하는 중입니다... 💼',
  '피고 측 대리인이 항변을 준비 중입니다... 🛡️',
  '판사님이 판결봉과 양심 사이를 조율하는 중입니다... ⚖️',
  '서기가 선고문을 정리하는 중입니다... 📝'
];

let caseData = null;

export async function renderTrial(container, caseId) {
  caseData = null;
  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">🏛️ 소소킹 전자재판</span></div>
      <div class="container" style="padding-top:20px;padding-bottom:70px;">
        <div id="docket-card" class="card" style="padding:18px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:5px;">E-COURT DOCKET</div>
              <div id="docket-title" style="font-family:var(--font-serif);font-size:20px;font-weight:900;line-height:1.45;">사건 배당 중</div>
              <div id="docket-meta" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">소소킹 판결소 제3생활부 · 제404호 생활법정</div>
            </div>
            <div style="text-align:right;min-width:72px;">
              <div style="font-size:28px;">⚖️</div>
              <div id="docket-status" style="font-size:11px;color:var(--gold);font-weight:800;">접수중</div>
            </div>
          </div>
        </div>

        <div id="docket-timeline" style="display:flex;overflow-x:auto;gap:8px;margin-bottom:16px;padding-bottom:4px;"></div>
        <div id="steps-container"></div>
        <div id="loading-area" style="text-align:center;padding:34px 0;">
          <div class="loading-dots"><span></span><span></span><span></span></div>
          <div id="loading-text" style="font-size:13px;color:var(--cream-dim);margin-top:10px;">${LOADING_MSGS[0]}</div>
        </div>
      </div>
    </div>`;
  renderTimeline('filed');

  let msgIdx = 0;
  const msgTimer = setInterval(() => {
    msgIdx = (msgIdx + 1) % LOADING_MSGS.length;
    const el = document.getElementById('loading-text');
    if (el) el.textContent = LOADING_MSGS[msgIdx];
  }, 2600);

  const stop = () => {
    clearInterval(msgTimer);
    try { unsubscribeCase?.(); } catch {}
    try { unsubscribeResult?.(); } catch {}
    window._pageCleanup = null;
  };

  const showError = (message = '') => {
    stop();
    const la = document.getElementById('loading-area');
    if (la) la.innerHTML = `
      <div class="card" style="border-color:rgba(231,76,60,.55);padding:18px;text-align:left;">
        <div style="font-size:17px;color:var(--red);font-weight:900;margin-bottom:8px;">⚠️ 재판 진행 중 오류</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(message || '재판부가 잠시 휴정했습니다.')}</div>
        <a href="#/submit" class="btn btn-secondary" style="margin-top:14px;">다시 접수하기</a>
      </div>`;
  };

  const keepWaiting = () => {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = '재판부 작성 시간이 길어지고 있습니다. 화면을 유지하면 완료 즉시 이동합니다... ⚖️';
  };

  const unsubscribeCase = onSnapshot(doc(db, 'cases', caseId), (snap) => {
    if (!snap.exists()) return;
    caseData = snap.data();
    updateDocket(caseData);
    renderTimeline(caseData.courtStage || 'filed');
    if (caseData.status === 'error' || caseData.status === 'blocked') showError(caseData.errorMessage || '접수 제한 내용이 포함되어 있습니다.');
  }, (err) => showError(err.message));

  const unsubscribeResult = onSnapshot(doc(db, 'results', caseId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    renderTimeline(data.courtStage || caseData?.courtStage || 'filed');
    if (data.sentence) {
      stop();
      const la = document.getElementById('loading-area');
      if (la) la.innerHTML = `<div class="card" style="padding:18px;text-align:center;border-color:rgba(201,168,76,.55);"><div style="font-size:30px;margin-bottom:6px;">🔨</div><div style="font-weight:900;color:var(--gold);">선고 완료</div><div style="font-size:12px;color:var(--cream-dim);margin-top:4px;">판결문 열람실로 이동합니다.</div></div>`;
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
    showError(e?.message || '재판 호출에 실패했습니다.');
  }
}

function updateDocket(c) {
  const title = document.getElementById('docket-title');
  const meta = document.getElementById('docket-meta');
  const status = document.getElementById('docket-status');
  if (title) title.textContent = c.caseTitle || '사건명 미상';
  if (meta) meta.innerHTML = `${escapeHtml(c.docketNumber || '사건번호 부여중')}<br>${escapeHtml(c.division || '제3생활부')} · ${escapeHtml(c.courtroom || '제404호 생활법정')} · 원고 ${escapeHtml(c.nickname || '익명')}`;
  if (status) status.textContent = stageLabel(c.courtStage || c.status || 'filed');
}

function stageLabel(stage) {
  const row = DOCKET_STEPS.find(([id]) => id === stage);
  if (row) return row[1];
  if (stage === 'hearing') return '심리중';
  if (stage === 'error') return '휴정';
  return '진행중';
}

function renderTimeline(activeStage) {
  const el = document.getElementById('docket-timeline');
  if (!el) return;
  const activeIndex = Math.max(0, DOCKET_STEPS.findIndex(([id]) => id === activeStage));
  el.innerHTML = DOCKET_STEPS.map(([id, title, sub], i) => {
    const done = i <= activeIndex;
    return `<div style="min-width:104px;padding:10px 9px;border-radius:12px;border:1px solid ${done ? 'rgba(201,168,76,.65)' : 'var(--border)'};background:${done ? 'rgba(201,168,76,.11)' : 'rgba(255,255,255,.025)'};">
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
  if (data.reception) html += stepCard('📋 접수계', '소장 접수 및 사건번호 부여', data.reception, '접수완료');
  if (data.investigation) html += stepCard('🔍 조사관', '증거조사조서 및 조정회부 검토', data.investigation, '증거조사');
  if (data.plaintiffArg) html += stepCard('💼 원고 측', '준비서면 및 최종변론', data.plaintiffArg, '변론기일');
  if (data.defendantArg) html += stepCard('🛡️ 피고 측', '답변서 및 항변', data.defendantArg, '반박제출');
  if (data.judgeType) {
    html += `<div class="card step-card visible" style="margin-bottom:14px;padding:20px;text-align:center;border-color:rgba(201,168,76,.55);">
      <div style="font-size:13px;color:var(--cream-dim);margin-bottom:6px;">재판부 배당 결과</div>
      <div style="font-size:44px;margin-bottom:6px;">${JUDGE_ICON[data.judgeType] || '⚖️'}</div>
      <div style="font-family:var(--font-serif);font-size:22px;color:var(--gold);font-weight:900;">${escapeHtml(data.judgeType)} 판사</div>
      <div style="font-size:12px;color:var(--cream-dim);margin-top:6px;">제404호 생활법정 단독재판부</div>
    </div>`;
  }
  if (data.verdict) html += stepCard('⚖️ 재판부', '판결문 초안 및 이유 설시', data.verdict, '판결작성', true);
  if (data.sentence) {
    html += `<div class="card sentence-card step-card visible" style="margin-bottom:14px;">
      <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">🔨 주문 · 생활형 처분</div>
      <div class="sentence-text">${escapeHtml(data.sentence)}</div>
    </div>`;
  }
  container.innerHTML = html;
}

function stepCard(role, label, content, badge, verdict = false) {
  return `<div class="card step-card visible" style="margin-bottom:14px;padding:18px;position:relative;overflow:hidden;">
    ${verdict ? '<div class="verdict-stamp">판결</div>' : ''}
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px;">
      <div class="step-role">${escapeHtml(role)} · ${escapeHtml(label)}</div>
      <span class="badge badge-gold">${escapeHtml(badge)}</span>
    </div>
    <div class="step-content">${escapeHtml(content)}</div>
  </div>`;
}
