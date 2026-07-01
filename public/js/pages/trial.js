import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const DOCKET_STEPS = [
  ['filed','속보','긴급 편성'],
  ['briefing','브리핑','현장 정리'],
  ['issue','쟁점','핵심 안건'],
  ['decision','위원회 결정','엄중 판단'],
  ['sentenced','소소 처분','하찮은 명령']
];

const LOADING_MSGS = [
  '긴급속보 자막을 띄우는 중입니다... 🚨',
  '제보자의 한 줄을 국가적 안건처럼 포장하는 중입니다... 🎙️',
  '위원들이 양말과 라면의 질서를 엄중히 검토 중입니다... 🧑‍💼',
  '소소분쟁위원회가 말도 안 되게 진지한 결정을 쓰는 중입니다... 📋',
  '마지막 소소 처분을 실행 가능한 수준으로 다듬는 중입니다... 🔨'
];

let caseData = null;

export async function renderTrial(container, caseId) {
  caseData = null;
  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">🚨 소소킹 긴급심판</span></div>
      <div class="container" style="padding-top:20px;padding-bottom:70px;">
        <div id="docket-card" class="card" style="padding:18px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:5px;">BREAKING DISPUTE</div>
              <div id="docket-title" style="font-family:var(--font-serif);font-size:20px;font-weight:900;line-height:1.45;">속보 편성 중</div>
              <div id="docket-meta" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">소소분쟁위원회 · 긴급소소속보실</div>
            </div>
            <div style="text-align:right;min-width:72px;">
              <div style="font-size:28px;">📡</div>
              <div id="docket-status" style="font-size:11px;color:var(--gold);font-weight:800;">속보중</div>
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
  }, 2400);

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
        <div style="font-size:17px;color:var(--red);font-weight:900;margin-bottom:8px;">⚠️ 긴급심판 진행 중 오류</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(message || '위원회가 잠시 정회했습니다.')}</div>
        <a href="#/submit" class="btn btn-secondary" style="margin-top:14px;">다시 접수하기</a>
      </div>`;
  };

  const keepWaiting = () => {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = '소소분쟁위원회 회의가 길어지고 있습니다. 완료되면 바로 결과로 이동합니다... 📋';
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
      if (la) la.innerHTML = `<div class="card" style="padding:18px;text-align:center;border-color:rgba(201,168,76,.55);"><div style="font-size:30px;margin-bottom:6px;">🔨</div><div style="font-weight:900;color:var(--gold);">소소 처분 확정</div><div style="font-size:12px;color:var(--cream-dim);margin-top:4px;">긴급 결정문으로 이동합니다.</div></div>`;
      setTimeout(() => { location.hash = `#/result/${encodeURIComponent(caseId)}`; }, 1200);
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
    showError(e?.message || '긴급심판 호출에 실패했습니다.');
  }
}

function updateDocket(c) {
  const title = document.getElementById('docket-title');
  const meta = document.getElementById('docket-meta');
  const status = document.getElementById('docket-status');
  if (title) title.textContent = c.caseTitle || '분쟁명 미상';
  if (meta) meta.innerHTML = `${escapeHtml(c.docketNumber || '접수번호 부여중')}<br>${escapeHtml(c.division || '한줄분쟁심의부')} · ${escapeHtml(c.courtroom || '긴급소소속보실')} · 제보자 ${escapeHtml(c.nickname || '익명')}`;
  if (status) status.textContent = stageLabel(c.courtStage || c.status || 'filed');
}

function stageLabel(stage) {
  const row = DOCKET_STEPS.find(([id]) => id === stage);
  if (row) return row[1];
  if (stage === 'received') return '속보';
  if (stage === 'hearing') return '브리핑';
  if (stage === 'verdict') return '결정';
  if (stage === 'error') return '정회';
  return '진행중';
}

function renderTimeline(activeStage) {
  const el = document.getElementById('docket-timeline');
  if (!el) return;
  const mapped = activeStage === 'received' ? 'filed' : (activeStage === 'hearing' ? 'briefing' : (activeStage === 'verdict' ? 'decision' : activeStage));
  const activeIndex = Math.max(0, DOCKET_STEPS.findIndex(([id]) => id === mapped));
  el.innerHTML = DOCKET_STEPS.map(([id, title, sub], i) => {
    const done = i <= activeIndex;
    return `<div style="min-width:108px;padding:10px 9px;border-radius:12px;border:1px solid ${done ? 'rgba(201,168,76,.65)' : 'var(--border)'};background:${done ? 'rgba(201,168,76,.11)' : 'rgba(255,255,255,.025)'};">
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
  if (data.breakingNews || data.reception) html += stepCard('🚨 속보', '긴급 편성', data.breakingNews || data.reception, '속보완료');
  if (data.briefing || data.investigation) html += stepCard('🎙️ 브리핑', '현장 정리', data.briefing || data.investigation, '브리핑완료');
  if (data.issue || data.plaintiffArg) html += stepCard('🧩 쟁점', '핵심 안건', data.issue || data.plaintiffArg, '쟁점정리');
  if (data.committeeJudgment || data.verdict) html += stepCard('📋 위원회', '엄중 판단', data.committeeJudgment || data.verdict, '판단완료', true);
  if (data.finalDecision || data.supremeFinal) html += stepCard('✅ 최종 결정', '위원회 결정', data.finalDecision || data.supremeFinal, '결정확정', true);
  if (data.sentence) {
    html += `<div class="card sentence-card step-card visible" style="margin-bottom:14px;">
      <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">🔨 소소 처분</div>
      <div class="sentence-text">${escapeHtml(data.sentence)}</div>
    </div>`;
  }
  container.innerHTML = html;
}

function stepCard(role, label, content, badge, stamp = false) {
  return `<div class="card step-card visible" style="margin-bottom:14px;padding:18px;position:relative;overflow:hidden;">
    ${stamp ? '<div class="verdict-stamp">확정</div>' : ''}
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px;">
      <div class="step-role">${escapeHtml(role)} · ${escapeHtml(label)}</div>
      <span class="badge badge-gold">${escapeHtml(badge)}</span>
    </div>
    <div class="step-content" style="white-space:pre-line;">${escapeHtml(content)}</div>
  </div>`;
}
