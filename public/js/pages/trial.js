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

const PROGRESS_STAGES = DOCKET_STEPS.map(([id]) => id);
const JUDGES = [
  ['엄벌주의형', '👨‍⚖️'],
  ['감성형', '🥹'],
  ['현실주의형', '🤦'],
  ['과몰입형', '🔥'],
  ['피곤형', '😴'],
  ['논리집착형', '🧮'],
  ['드립형', '🎭']
];

const STAGE_LOADING = {
  filed: '접수계가 사건 전체를 끌고 갈 핵심 장면을 사건기록 첫 줄에 올리는 중입니다... 📋',
  investigation: '조사관이 말과 행동의 어긋남을 시간순서로 맞추고 결정적 세부를 찾는 중입니다... 🔍',
  plaintiff: '원고 측이 원래 기대했던 아주 평범한 결말이 어떻게 무너졌는지 정리하는 중입니다... 💼',
  defendant: '피고 측의 그럴듯한 항변이 앞선 기록과 자기 논리에 걸리지 않는지 대조하는 중입니다... 🛡️',
  sentenced: '재판부가 사건의 핵심 물건과 연결된 생활형 처분과 마지막 콜백을 작성하는 중입니다... ⚖️'
};

const JUDGE_PROGRESS = {
  '엄벌주의형': [
    '엄벌주의형 판사가 사소함을 이유로 생활질서 위반을 감형할 수 있는지 검토 중입니다.',
    '경고를 한 번이라도 알아들을 기회가 있었는지 엄중히 확인 중입니다.',
    '원고의 청구를 즉시 시정과 재발 방지 항목으로 분류 중입니다.',
    '피고의 변명에 생활질서상 정상참작 사유가 있는지 엄격히 심사 중입니다.',
    '같은 행동이 반복될 경우의 생활상 가중처분까지 주문에 적는 중입니다.'
  ],
  '감성형': [
    '감성형 판사가 사건보다 오래 남은 서운함의 시작점을 찾는 중입니다.',
    '말하지 못한 기대와 사건 뒤의 침묵까지 감정의 시간순서로 살피는 중입니다.',
    '원고가 정말 원했던 평범한 한 가지를 청구취지로 복원 중입니다.',
    '피고가 놓친 마음의 신호가 무엇이었는지 조심스럽게 읽는 중입니다.',
    '사과보다 먼저 정확히 이해해야 할 한 문장을 판결에 남기는 중입니다.'
  ],
  '현실주의형': [
    '현실주의형 판사가 이 사건을 오늘 끝내려면 누가 무엇을 해야 하는지 찾는 중입니다.',
    '실행 불가능한 주장과 당장 바꿀 수 있는 행동을 분리하는 중입니다.',
    '원고의 요구를 담당자·기한·확인 방법이 있는 요청으로 정리 중입니다.',
    '피고의 설명보다 실제로 가능한 해결책이 빠른지 비교 중입니다.',
    '누가 무엇을 언제까지 할지 체크리스트형 주문으로 확정하는 중입니다.'
  ],
  '과몰입형': [
    '과몰입형 판사가 평범했던 하루가 대서사시로 꺾인 정확한 순간을 기록 중입니다.',
    '핵심 물건을 생활세계의 운명을 가른 결정적 단서로 심리 중입니다.',
    '원고의 사소한 기대를 최후 변론에 어울리는 비장한 문장으로 정리 중입니다.',
    '피고의 항변이 장대한 서사의 반전을 감당할 수 있는지 검토 중입니다.',
    '실행 가능한 처분을 최종 휴전협정처럼 선고하고 첫 장면을 회수하는 중입니다.'
  ],
  '피곤형': [
    '피곤형 판사가 대화 한 번이면 끝났을 사건이 왜 접수됐는지 한숨과 함께 확인 중입니다.',
    '핵심 사실과 굳이 여기까지 오게 만든 불필요한 부분을 잘라내는 중입니다.',
    '원고의 요구에서 꼭 필요한 한 가지만 남기는 중입니다.',
    '피고의 긴 설명을 한 문장으로 줄였을 때 말이 되는지 확인 중입니다.',
    '다시는 같은 설명을 듣지 않을 최소한의 주문을 작성하는 중입니다.'
  ],
  '논리집착형': [
    '논리집착형 판사가 사건 시각과 행동 순서를 1번부터 다시 맞추는 중입니다.',
    '진술과 남은 흔적 사이의 작은 모순을 결정적 쟁점으로 분류 중입니다.',
    '원고 주장 중 인정 사실과 감정 평가를 항목별로 나누는 중입니다.',
    '피고의 첫 문장과 마지막 문장이 동시에 참일 수 있는지 계산 중입니다.',
    '인정 사실·모순 지점·책임 결론을 번호로 매겨 판결하는 중입니다.'
  ],
  '드립형': [
    '드립형 판사가 이 사건에서만 통하는 핵심 물건과 한 문장을 고르는 중입니다.',
    '범용 농담은 기각하고 사실관계 자체가 웃기는 배열을 만드는 중입니다.',
    '원고의 진지함을 해치지 않으면서 사건 맞춤형 한 방을 준비 중입니다.',
    '피고의 그럴듯한 변명이 자기 말에 걸리는 순간을 포착하는 중입니다.',
    '접수 첫 장면이 판결 마지막에 다시 나타날 준비를 마치는 중입니다.'
  ]
};

let caseData = null;

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assignedJudge(caseId, existingType = '') {
  const existing = JUDGES.find(([type]) => type === existingType);
  if (existing) return { type: existing[0], icon: existing[1] };
  const selected = JUDGES[hashString(caseId) % JUDGES.length];
  return { type: selected[0], icon: selected[1] };
}

function progressMessage(stage, judge) {
  const stageIndex = Math.max(0, PROGRESS_STAGES.indexOf(stage));
  const judgeLine = JUDGE_PROGRESS[judge.type]?.[stageIndex] || '';
  return [STAGE_LOADING[stage] || STAGE_LOADING.filed, judgeLine].filter(Boolean).join('\n');
}

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
              <div id="docket-judge-icon" style="font-size:28px;">⚖️</div>
              <div id="docket-status" style="font-size:11px;color:var(--gold);font-weight:800;">접수중</div>
            </div>
          </div>
        </div>

        <div id="docket-timeline" style="display:flex;overflow-x:auto;gap:8px;margin-bottom:16px;padding-bottom:4px;"></div>
        <div id="steps-container"></div>

        <div id="loading-area" style="text-align:center;padding:34px 0;">
          <div class="loading-dots"><span></span><span></span><span></span></div>
          <div id="loading-text" style="font-size:13px;color:var(--cream-dim);white-space:pre-line;line-height:1.75;margin-top:10px;"></div>
        </div>
      </div>
    </div>`;

  let visualStepIndex = 0;

  const showVisualStage = (stage = 'filed', reset = false) => {
    const requestedIndex = Math.max(0, PROGRESS_STAGES.indexOf(stage));
    visualStepIndex = reset ? requestedIndex : Math.max(visualStepIndex, requestedIndex);
    const visualStage = PROGRESS_STAGES[visualStepIndex];
    const judge = assignedJudge(caseId, caseData?.judgeType || '');
    renderTimeline(visualStage);

    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = progressMessage(visualStage, judge);

    const status = document.getElementById('docket-status');
    if (status) status.textContent = stageLabel(visualStage);

    const icon = document.getElementById('docket-judge-icon');
    if (icon) icon.textContent = judge.icon;
  };

  showVisualStage('filed', true);

  const progressTimer = setInterval(() => {
    if (!container.isConnected) {
      clearInterval(progressTimer);
      return;
    }
    if (visualStepIndex < PROGRESS_STAGES.length - 1) visualStepIndex += 1;
    showVisualStage(PROGRESS_STAGES[visualStepIndex]);
  }, 3200);

  const stop = () => {
    clearInterval(progressTimer);
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
    visualStepIndex = PROGRESS_STAGES.length - 1;
    showVisualStage('sentenced');
    const el = document.getElementById('loading-text');
    if (el) el.textContent += '\n문서 작성 시간이 길어지고 있지만 완료되면 자동으로 판결문으로 이동합니다.';
  };

  const unsubscribeCase = onSnapshot(doc(db, 'cases', caseId), snap => {
    if (!snap.exists()) return;
    caseData = snap.data();
    const actualStage = stageFor(caseData.courtStage || caseData.status);
    updateDocket(caseData, caseId, PROGRESS_STAGES[visualStepIndex]);
    showVisualStage(actualStage);

    if (caseData.status === 'blocked') {
      showError(caseData.errorMessage || '접수할 수 없는 내용이 포함되어 있습니다.');
      return;
    }

    if (caseData.status === 'error') {
      visualStepIndex = 0;
      showVisualStage('filed', true);
      const el = document.getElementById('loading-text');
      if (el) el.textContent = '이전 작성 오류를 정리하고 같은 사건으로 다시 작성하는 중입니다... ♻️';
    }
  }, err => showError(err.message));

  const unsubscribeResult = onSnapshot(doc(db, 'results', caseId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    visualStepIndex = PROGRESS_STAGES.length - 1;
    showVisualStage('sentenced');

    if (data.verdict) {
      stop();
      const la = document.getElementById('loading-area');
      if (la) la.innerHTML = `
        <div class="card" style="padding:18px;text-align:center;border-color:rgba(201,168,76,.55);">
          <div style="font-size:30px;margin-bottom:6px;">🔨</div>
          <div style="font-weight:900;color:var(--gold);">판결문 작성 완료</div>
          <div style="font-size:12px;color:var(--cream-dim);margin-top:4px;">접수 장면부터 판결 콜백까지 완성된 기록으로 이동합니다.</div>
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

function updateDocket(c, caseId, visualStage = 'filed') {
  const title = document.getElementById('docket-title');
  const meta = document.getElementById('docket-meta');
  const status = document.getElementById('docket-status');
  const icon = document.getElementById('docket-judge-icon');
  const judge = assignedJudge(caseId, c.judgeType || '');

  if (title) title.textContent = c.caseTitle && c.caseTitle !== 'AI 사건명 작성 중'
    ? c.caseTitle
    : '사건명 분석 중';

  if (meta) meta.innerHTML = `${escapeHtml(c.docketNumber || '사건번호 부여중')}<br>${escapeHtml(c.division || '제3생활부')} · 원고 ${escapeHtml(c.nickname || '익명')}<br>${escapeHtml(judge.icon)} ${escapeHtml(judge.type)} 판사 배정`;
  if (status) status.textContent = stageLabel(visualStage);
  if (icon) icon.textContent = judge.icon;
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