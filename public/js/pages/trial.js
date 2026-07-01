import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const DOCKET_STEPS = [
  ['filed','접수','사건번호 부여'],
  ['evidence','조사','기록 검토'],
  ['hearing','공방','원고·피고 주장'],
  ['verdict','대법원 판결','최종 판단'],
  ['sentenced','처분','생활형 명령']
];

const LOADING_MSGS = [
  '접수계가 사소한 사건에 괜히 사건번호를 붙이는 중입니다... 📋',
  '조사관이 별것 아닌 증거를 매우 진지하게 들여다보는 중입니다... 🔍',
  '원고와 피고가 말이 되는 듯 안 되는 듯 공방 중입니다... ⚔️',
  '대법원 소소부가 생활상 억울함의 한계를 검토 중입니다... 🏛️',
  '처분문을 웃기지만 실행 가능한 수준으로 다듬는 중입니다... 🔨'
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
    if (el) el.textContent = '대법원 소소부 작성 시간이 길어지고 있습니다. 화면을 유지하면 완료 즉시 이동합니다... 🏛️';
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
      if (la) la.innerHTML = `<div class="card" style="padding:18px;text-align:center;border-color:rgba(201,168,76,.55);"><div style="font-size:30px;margin-bottom:6px;">🔨</div><div style="font-weight:900;color:var(--gold);">처분 확정</div><div style="font-size:12px;color:var(--cream-dim);margin-top:4px;">판결문 열람실로 이동합니다.</div></div>`;
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
  if (stage === 'received') return '접수';
  if (stage === 'plaintiff' || stage === 'defendant') return '공방';
  if (stage === 'error') return '휴정';
  return '진행중';
}

function renderTimeline(activeStage) {
  const el = document.getElementById('docket-timeline');
  if (!el) return;
  const mapped = activeStage === 'received' ? 'filed' : (activeStage === 'plaintiff' || activeStage === 'defendant' ? 'hearing' : activeStage);
  const activeIndex = Math.max(0, DOCKET_STEPS.findIndex(([id]) => id === mapped));
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
  if (data.reception) html += stepCard('📋 접수', '사건 접수', data.reception, '접수완료');
  if (data.investigation) html += stepCard('🔍 조사', '기록 검토', data.investigation, '조사완료');
  const debate = [data.plaintiffArg ? `원고 측: ${data.plaintiffArg}` : '', data.defendantArg ? `피고 측: ${data.defendantArg}` : ''].filter(Boolean).join('\n\n');
  if (debate) html += stepCard('⚔️ 공방', '원고·피고 주장 정리', debate, '공방정리');
  const finalVerdict = data.supremeFinal || data.verdict;
  if (finalVerdict) html += stepCard('🏛️ 대법원', '최종 판결', finalVerdict, '판결확정', true);
  if (data.sentence) {
    html += `<div class="card sentence-card step-card visible" style="margin-bottom:14px;">
      <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">🔨 처분 · 생활형 명령</div>
      <div class="sentence-text">${escapeHtml(data.sentence)}</div>
    </div>`;
  }
  container.innerHTML = html;
}

function stepCard(role, label, content, badge, verdict = false) {
  return `<div class="card step-card visible" style="margin-bottom:14px;padding:18px;position:relative;overflow:hidden;">
    ${verdict ? '<div class="verdict-stamp">확정</div>' : ''}
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px;">
      <div class="step-role">${escapeHtml(role)} · ${escapeHtml(label)}</div>
      <span class="badge badge-gold">${escapeHtml(badge)}</span>
    </div>
    <div class="step-content" style="white-space:pre-line;">${escapeHtml(content)}</div>
  </div>`;
}
