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
  ['evidence','증거채집','생활증거 검토'],
  ['plaintiff','황당검사','엄숙한 공소제기'],
  ['defendant','변호인','말은 되는 반박'],
  ['hearing','재판공방','과몰입 심리'],
  ['sentenced','판결선고','황당 처분']
];
const LOADING_MSGS = [
  '접수계가 사건번호를 부여하고 사건표지를 작성하는 중입니다... 📋',
  '수사관이 발생 시각과 관계자 진술 요지를 기록하는 중입니다... 📝',
  '현장 분위기와 사소한 정황을 지나치게 진지하게 분석하는 중입니다... 🔍',
  '황당검사가 작은 사실관계를 공소사실로 확대 구성하는 중입니다... 💼',
  '피고 측 변호인이 상식적이지만 얄미운 반박을 준비하는 중입니다... 🛡️',
  '재판부가 기록과 양측 주장을 종합 검토하는 중입니다... ⚖️',
  '구체적이고 실행 가능한 소소한 주문을 작성하는 중입니다... 🔨'
];

let caseData = null;
let unsubscribeCase = null;
let unsubscribeResult = null;

function isCompleteResult(data = {}) {
  const judgment = data.judgment;
  if (Number(data.schemaVersion) === 2 && judgment && Array.isArray(judgment.orders)) {
    return judgment.orders.length >= 3 && !!String(judgment.opinion || '').trim();
  }
  return !!(String(data.sentence || '').trim() || String(data.judgmentScript || '').trim());
}

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
              <div id="docket-meta" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-top:6px;">소소킹 판결소 · 황당법정</div>
            </div>
            <div style="text-align:right;min-width:72px;">
              <div style="font-size:28px;">⚖️</div>
              <div id="docket-status" style="font-size:11px;color:var(--gold);font-weight:800;">접수중</div>
            </div>
          </div>
        </div>
        <div class="card" style="padding:14px;margin-bottom:14px;background:rgba(201,168,76,.07);border-color:rgba(201,168,76,.32);">
          <div style="font-weight:900;color:var(--gold);margin-bottom:6px;">사건의 경위부터 최종 주문까지 한 번에 작성합니다</div>
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.75;">AI 재판부가 수사기록, 검사와 변호인의 주장, 재판부 판단, 생활형 처분을 하나의 판결 객체로 편철합니다.</div>
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

  let msgIndex = 0;
  const msgTimer = setInterval(() => {
    msgIndex = (msgIndex + 1) % LOADING_MSGS.length;
    const element = document.getElementById('loading-text');
    if (element) element.textContent = LOADING_MSGS[msgIndex];
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
    const loading = document.getElementById('loading-area');
    if (loading) loading.innerHTML = `
      <div class="card" style="border-color:rgba(231,76,60,.55);padding:18px;text-align:left;">
        <div style="font-size:17px;color:var(--red);font-weight:900;margin-bottom:8px;">⚠️ 황당재판 진행 중 오류</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(message || '재판부가 황당함을 감당하지 못하고 잠시 휴정했습니다.')}</div>
        <a href="#/submit" class="btn btn-secondary" style="margin-top:14px;">다시 접수하기</a>
      </div>`;
  };

  unsubscribeCase = onSnapshot(doc(db, 'cases', caseId), snap => {
    if (!snap.exists()) return;
    caseData = snap.data();
    updateDocket(caseData);
    renderTimeline(caseData.courtStage || 'filed');
    if (caseData.status === 'error' || caseData.status === 'blocked') {
      showError(caseData.errorMessage || '접수 제한 내용이 포함되어 있습니다.');
    }
  }, error => showError(error.message));

  unsubscribeResult = onSnapshot(doc(db, 'results', caseId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    renderTimeline(data.courtStage || caseData?.courtStage || 'filed');
    if (isCompleteResult(data)) {
      stop();
      const loading = document.getElementById('loading-area');
      if (loading) loading.innerHTML = `<div class="card" style="padding:18px;text-align:center;border-color:rgba(201,168,76,.55);"><div style="font-size:30px;margin-bottom:6px;">🔨</div><div style="font-weight:900;color:var(--gold);">황당판결 선고 완료</div><div style="font-size:12px;color:var(--cream-dim);margin-top:4px;">판결문 열람실로 이동합니다.</div></div>`;
      setTimeout(() => { location.hash = `#/result/${encodeURIComponent(caseId)}`; }, 1000);
    }
  }, error => showError(error.message));

  window._pageCleanup = stop;
  try {
    await httpsCallable(functions, 'generateTrial')({ caseId });
  } catch (error) {
    console.error(error);
    const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
    if (message.includes('deadline') || message.includes('timeout')) {
      const loading = document.getElementById('loading-text');
      if (loading) loading.textContent = '판결 작성이 계속 진행 중입니다. 완료되는 즉시 판결문으로 이동합니다... ⚖️';
      return;
    }
    showError(error?.message || '황당재판 호출에 실패했습니다.');
  }
}

function updateDocket(data) {
  const title = document.getElementById('docket-title');
  const meta = document.getElementById('docket-meta');
  const status = document.getElementById('docket-status');
  if (title) title.textContent = data.caseTitle || '사건명 미상';
  if (meta) meta.innerHTML = `${escapeHtml(data.docketNumber || '사건번호 부여중')}<br>${escapeHtml(data.division || '소소재판부')} · ${escapeHtml(data.courtroom || '황당법정')} · 원고 ${escapeHtml(data.nickname || '익명')}`;
  if (status) status.textContent = stageLabel(data.courtStage || data.status || 'filed');
}

function stageLabel(stage) {
  const row = DOCKET_STEPS.find(([id]) => id === stage);
  if (row) return row[1];
  if (stage === 'verdict') return '공방중';
  if (stage === 'error') return '휴정';
  return '진행중';
}

function renderTimeline(activeStage) {
  const element = document.getElementById('docket-timeline');
  if (!element) return;
  const activeIndex = Math.max(0, DOCKET_STEPS.findIndex(([id]) => id === activeStage));
  element.innerHTML = DOCKET_STEPS.map(([id, title, sub], index) => {
    const done = index <= activeIndex;
    return `<div style="min-width:106px;padding:10px 9px;border-radius:12px;border:1px solid ${done ? 'rgba(201,168,76,.65)' : 'var(--border)'};background:${done ? 'rgba(201,168,76,.11)' : 'rgba(255,255,255,.025)'};"><div style="font-size:15px;margin-bottom:3px;">${done ? '✅' : '▫️'}</div><div style="font-size:12px;font-weight:900;color:${done ? 'var(--gold)' : 'var(--cream-dim)'};">${escapeHtml(title)}</div><div style="font-size:10px;color:var(--cream-dim);margin-top:2px;">${escapeHtml(sub)}</div></div>`;
  }).join('');
}

function renderSteps(data = {}) {
  const container = document.getElementById('steps-container');
  if (!container) return;
  const judgment = data.judgment && typeof data.judgment === 'object' ? data.judgment : null;
  let html = '';

  if (judgment) {
    if (judgment.facts) html += stepCard('📋 접수계', '사건의 경위', judgment.facts, '접수완료');
    if (judgment.investigation) html += stepCard('🚓 소소경찰', '생활증거 수사기록', judgment.investigation, '수사보고');
    if (judgment.prosecution) html += stepCard('💼 황당검사', '공소 의견', judgment.prosecution, '검사');
    if (judgment.defense) html += stepCard('🛡️ 피고측 변호인', '반박 의견', judgment.defense, '변호인');
    html += judgeCard(data.judgeType, data.courtroom);
    if (judgment.opinion) html += stepCard('⚖️ 재판부', '기록과 양측 주장에 대한 판단', judgment.opinion, '판단', true);
    if (Array.isArray(judgment.orders) && judgment.orders.length) {
      html += listCard('🔨 주문 · 황당 처분', judgment.orders.map(order => order?.text || order), '선고');
    }
  } else if (data.judgmentScript) {
    html += judgeCard(data.judgeType, data.courtroom);
    html += stepCard('📜 재판부', '기존 판결 기록 전문', data.judgmentScript, '판결', true);
  } else {
    if (data.reception) html += stepCard('📋 접수계', '사건번호 부여 및 수사 배당', data.reception, '접수완료');
    if (data.investigation) html += stepCard('🚓 소소경찰', '수사기록', data.investigation, '수사보고');
    if (Array.isArray(data.evidenceList) && data.evidenceList.length) html += listCard('🔍 증거채집 목록', data.evidenceList, '증거');
    if (data.plaintiffArg) html += stepCard('💼 황당검사', '공소 의견', data.plaintiffArg, '검사');
    if (data.defendantArg) html += stepCard('🛡️ 피고측 변호인', '반박 의견', data.defendantArg, '변호인');
    html += judgeCard(data.judgeType, data.courtroom);
    if (data.courtOpinion || data.verdict) html += stepCard('⚖️ 재판부', '최종 판단', data.courtOpinion || data.verdict, '판결', true);
    if (data.sentence) html += listCard('🔨 주문 · 황당 처분', String(data.sentence).split('\n').filter(Boolean), '선고');
  }
  container.innerHTML = html;
}

function judgeCard(judgeType, courtroom) {
  if (!judgeType) return '';
  return `<div class="card step-card visible" style="margin-bottom:14px;padding:20px;text-align:center;border-color:rgba(201,168,76,.55);"><div style="font-size:13px;color:var(--cream-dim);margin-bottom:6px;">황당재판부 배당 결과</div><div style="font-size:44px;margin-bottom:6px;">${JUDGE_ICON[judgeType] || '⚖️'}</div><div style="font-family:var(--font-serif);font-size:22px;color:var(--gold);font-weight:900;">${escapeHtml(judgeType)} 재판부</div><div style="font-size:12px;color:var(--cream-dim);margin-top:6px;">${escapeHtml(courtroom || '황당법정')}</div></div>`;
}

function listCard(title, items, badge) {
  const rows = items.map(item => String(item || '').trim()).filter(Boolean);
  if (!rows.length) return '';
  return `<div class="card step-card visible" style="margin-bottom:14px;padding:18px;"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px;"><div class="step-role">${escapeHtml(title)}</div><span class="badge badge-gold">${escapeHtml(badge)}</span></div><div style="display:flex;flex-direction:column;gap:8px;">${rows.map((item, index) => `<div style="display:flex;gap:10px;padding:10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.025);"><div style="color:var(--gold);font-weight:900;min-width:20px;">${index + 1}</div><div style="font-size:13px;color:var(--cream);line-height:1.7;">${escapeHtml(item)}</div></div>`).join('')}</div></div>`;
}

function stepCard(role, label, content, badge, verdict = false) {
  return `<div class="card step-card visible" style="margin-bottom:14px;padding:18px;position:relative;overflow:hidden;">${verdict ? '<div class="verdict-stamp">판결</div>' : ''}<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:9px;"><div class="step-role">${escapeHtml(role)} · ${escapeHtml(label)}</div><span class="badge badge-gold">${escapeHtml(badge)}</span></div><div class="step-content" style="white-space:pre-line;line-height:1.85;">${escapeHtml(content)}</div></div>`;
}
