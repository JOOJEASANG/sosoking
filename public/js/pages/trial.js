import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const DOCKET_STEPS = [
  ['filed', '사건접수', '사건번호 부여'],
  ['investigation', '수사보고', '정황·증거 검토'],
  ['plaintiff', '원고측 변론', '청구취지 정리'],
  ['defendant', '피고측 변론', '답변·항변 정리'],
  ['sentenced', '재판부 판결', '주문 및 이유']
];

const LOADING_MSGS = [
  '접수계가 사건 내용을 읽고 사건명을 정리하는 중입니다... 📋',
  '조사관이 하찮지만 결정적인 증거를 수집하는 중입니다... 🔍',
  '원고 측이 서운함을 공식 문서로 승격하는 중입니다... 💼',
  '피고 측이 말이 되는 듯한 항변을 준비하는 중입니다... 🛡️',
  '재판부가 판결문과 생활형 처분을 작성하는 중입니다... ⚖️'
];

let caseData = null;

export async function renderTrial(container, caseId) {
  caseData = null;
  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">🏛️ 사건 처리 중</span></div>
      <div class="container" style="padding-top:20px;padding-bottom:70px;">
        <div id="docket-card" class="card court-document" style="padding:20px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:5px;">소소킹 판결소 사건기록</div>
              <div id="docket-title" style="font-family:var(--font-serif);font-size:20px;font-weight:900;line-height:1.45;">사건명 분석 중</div>
              <div id="docket-meta" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">사건번호 부여 중 · 제3생활부</div>
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
    if (la) {
      la.innerHTML = `
        <div class="card" style="border-color:rgba(231,76,60,.55);padding:18px;text-align:left;">
          <div style="font-size:17px;color:var(--red);font-weight:900;margin-bottom:8px;">⚠️ 판결문 작성 중 오류</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(message || 'AI 재판부가 판결문을 완성하지 못했습니다.')}</div>
          <button type="button" class="btn btn-primary" id="retry-current-case" style="margin-top:14px;">같은 사건 다시 작성</button>
          <a href="#/submit" class="btn btn-secondary" style="margin-top:8px;">새 사건 접수하기</a>
        </div>`;
      document.getElementById('retry-current-case')?.addEventListener('click', () => location.reload());
    }
  };

  const keepWaiting = () => {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = '문서 작성 시간이 길어지고 있습니다. 완료되면 자동으로 판결문으로 이동합니다... ⚖️';
  };

  const unsubscribeCase = onSnapshot(doc(db, 'cases', caseId), snap => {
    if (!snap.exists()) return;
    caseData = snap.data();
    updateDocket(caseData);
    renderTimeline(stageFor(caseData.courtStage || caseData.status));

    if (caseData.status === 'blocked') {
      showError(caseData.errorMessage || '접수할 수 없는 내용이 포함되어 있습니다.');
      return;
    }

    if (caseData.status === 'error') {
      const el = document.getElementById('loading-text');
      if (el) el.textContent = '이전 작성 오류를 정리하고 같은 사건으로 다시 작성하는 중입니다... ♻️';
      renderTimeline('filed');
    }
  }, err => showError(err.message));

  const unsubscribeResult = onSnapshot(doc(db, 'results', caseId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    renderTimeline('sentenced');

    if (data.verdict) {
      stop();
      const la = document.getElementById('loading-area');
      if (la) la.innerHTML = `
        <div class="card" style="padding:18px;text-align:center;border-color:rgba(201,168,76,.55);">
          <div style="font-size:30px;margin-bottom:6px;">🔨</div>
          <div style="font-weight:900;color:var(--gold);">판결문 작성 완료</div>
          <div style="font-size:12px;color:var(--cream-dim);margin-top:4px;">문서 열람 화면으로 이동합니다.</div>
        </div>`;
      setTimeout(() => { location.hash = `#/verdict/${encodeURIComponent(caseId)}`; }, 1200);
    }
  }, err => showError(err.message));

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
    showError(e?.message || 'AI 판결문 생성에 실패했습니다.');
  }
}

function stageFor(stage) {
  if (stage === 'hearing' || stage === 'received' || stage === 'evidence') return 'investigation';
  if (stage === 'verdict') return 'defendant';
  if (stage === 'error') return 'filed';
  return stage || 'filed';
}

function updateDocket(c) {
  const title = document.getElementById('docket-title');
  const meta = document.getElementById('docket-meta');
  const status = document.getElementById('docket-status');

  if (title) title.textContent = c.caseTitle && c.caseTitle !== 'AI 사건명 작성 중'
    ? c.caseTitle
    : '사건명 분석 중';

  if (meta) meta.innerHTML = `${escapeHtml(c.docketNumber || '사건번호 부여중')}<br>${escapeHtml(c.division || '제3생활부')} · 원고 ${escapeHtml(c.nickname || '익명')}`;
  if (status) status.textContent = stageLabel(stageFor(c.courtStage || c.status));
}

function stageLabel(stage) {
  const row = DOCKET_STEPS.find(([id]) => id === stage);
  if (row) return row[1];
  return '문서작성중';
}

function renderTimeline(activeStage) {
  const el = document.getElementById('docket-timeline');
  if (!el) return;

  const activeIndex = Math.max(0, DOCKET_STEPS.findIndex(([id]) => id === activeStage));
  el.innerHTML = DOCKET_STEPS.map(([id, title, sub], i) => {
    const done = i <= activeIndex;
    return `<div style="min-width:116px;padding:10px 9px;border-radius:12px;border:1px solid ${done ? 'rgba(201,168,76,.65)' : 'var(--border)'};background:${done ? 'rgba(201,168,76,.11)' : 'rgba(255,255,255,.025)'};">
      <div style="font-size:15px;margin-bottom:3px;">${done ? '✅' : '▫️'}</div>
      <div style="font-size:12px;font-weight:900;color:${done ? 'var(--gold)' : 'var(--cream-dim)'};">${escapeHtml(title)}</div>
      <div style="font-size:10px;color:var(--cream-dim);margin-top:2px;">${escapeHtml(sub)}</div>
    </div>`;
  }).join('');
}

function renderSteps(data) {
  const target = document.getElementById('steps-container');
  if (!target) return;

  const sections = [
    ['01', '사건접수', '사건접수보고서', data.reception],
    ['02', '수사보고', '정황 및 증거 검토', data.investigation],
    ['03', '원고측 변론', '청구취지 및 주장요지', data.plaintiffArg],
    ['04', '피고측 변론', '답변취지 및 항변요지', data.defendantArg],
    ['05', '재판부 판결', '주문 및 판단이유', data.verdict]
  ];

  target.innerHTML = sections
    .filter(([, , , content]) => content)
    .map(([number, title, subtitle, content], index) => documentCard(number, title, subtitle, content, index === 4))
    .join('');
}

function documentCard(number, title, subtitle, content, verdict = false) {
  return `<section class="card court-document step-card visible" style="margin-bottom:14px;padding:20px;position:relative;overflow:hidden;">
    ${verdict ? '<div class="verdict-stamp">판결</div>' : ''}
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:10px;color:var(--gold);font-weight:900;letter-spacing:.14em;">DOCUMENT ${number}</div>
        <div style="font-family:var(--font-serif);font-size:19px;font-weight:900;margin-top:4px;">${escapeHtml(title)}</div>
      </div>
      <span class="badge badge-gold">${escapeHtml(subtitle)}</span>
    </div>
    <div class="step-content" style="white-space:pre-line;line-height:1.9;">${escapeHtml(content)}</div>
  </section>`;
}
