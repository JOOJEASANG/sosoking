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
  ['꼰대형', '🧓'],
  ['냉혈형', '🧊'],
  ['회피형', '🏃'],
  ['추궁형', '🔎'],
  ['오버형', '🚨'],
  ['드립형', '🎭'],
  ['빙의형', '🌀']
];

const STAGE_LOADING = {
  filed: '도장 찍는 소리가 복도에 울려 퍼지고 있습니다.\n사건번호 부여 중 · 담당 판사 긴급 호출 중',
  investigation: '현장 보존 완료. CCTV 영상 되감는 중...\n국과수에 감정 의뢰서 발송 완료. 잠복 보고서 취합 중.',
  plaintiff: '원고 측이 억울함을 조목조목 정리하고 있습니다.\n청구취지에 커피 잔 수 또는 저녁 메뉴가 포함될 예정입니다.',
  defendant: '피고 측 변명을 수신 중입니다.\n앞선 진술과 조용히 충돌하는 부분을 포착 중.',
  sentenced: '재판부가 망치를 들었습니다.\n이 사건에만 맞는 생활형 처분 최종 확정 임박.'
};

const STAGE_EMOJI = {
  filed: '📋',
  investigation: '🔍',
  plaintiff: '💬',
  defendant: '🛡️',
  sentenced: '⚖️'
};

const JUDGE_PROGRESS = {
  '꼰대형': [
    '꼰대형 판사가 이 사건이 결국 기본과 예의의 문제였다는 결론부터 참지 못하고 있습니다.',
    '조사 기록에서 “그 정도는 알아서 했어야지”라고 말할 지점을 찾는 중입니다.',
    '원고가 원했던 평범한 기본사항을 굳이 청구취지로 만드는 중입니다.',
    '피고의 해명이 왜 일을 시키기 전에 했어야 할 일을 더 분명하게 만드는지 검토 중입니다.',
    '생활수칙과 짧은 인생훈계가 함께 들어간 주문을 작성하는 중입니다.'
  ],
  '냉혈형': [
    '냉혈형 판사가 서운함을 잠시 치우고 실제로 무엇이 없어졌고 늦었는지 계산 중입니다.',
    '시간·횟수·결과만 남겨 사건을 냉정하게 재구성하는 중입니다.',
    '원고의 감정을 실제 불편과 결과 단위로 환산하는 중입니다.',
    '피고의 사정 설명 중 결과를 바꾸지 못하는 부분을 조용히 제외하는 중입니다.',
    '말보다 이행 여부가 바로 확인되는 차가운 생활형 처분을 확정하는 중입니다.'
  ],
  '회피형': [
    '회피형 판사가 왜 재판부가 여기까지 관여해야 하는지 관할부터 고민 중입니다.',
    '당사자끼리 해결할 마지막 탈출구가 남았는지 수사기록을 뒤지는 중입니다.',
    '원고 요구에서 재판부가 최소한으로 손댈 한 가지만 고르는 중입니다.',
    '피고가 지금 바로 해결하면 재판부가 퇴장할 수 있는지 검토 중입니다.',
    '다시는 이 사건을 보지 않기 위한 최소개입형 주문을 작성하는 중입니다.'
  ],
  '추궁형': [
    '추궁형 판사가 첫 문장부터 시간표현과 단어 하나를 표시해두는 중입니다.',
    '앞뒤가 맞지 않는 한 지점을 잡고 진술 순서를 다시 맞추는 중입니다.',
    '원고 주장 중 피고에게 다시 물어볼 정확한 질문을 뽑는 중입니다.',
    '피고의 설명이 자기 앞문장과 충돌하는 순간을 끝까지 추적하는 중입니다.',
    '마지막까지 남은 모순 하나를 판결 이유에 못 박는 중입니다.'
  ],
  '오버형': [
    '오버형 판사가 생활분쟁을 비상상황으로 격상하고 상황판부터 펼치는 중입니다.',
    '사소한 현장을 대형사건 수사본부급 절차로 과하게 재구성하는 중입니다.',
    '원고의 평범한 요구를 생활질서 복구 작전의 목표로 격상하는 중입니다.',
    '피고의 항변이 이번 사태의 위기등급을 낮출 수 있는지 엄숙히 심사 중입니다.',
    '생활질서 정상화 조치를 국가적 선포처럼 주문에 적는 중입니다.'
  ],
  '드립형': [
    '드립형 판사가 이 사건에서만 가능한 핵심 소재 한 방을 찾는 중입니다.',
    '범용 농담은 기각하고 실제 사건 장면에서 웃기는 연결만 남기는 중입니다.',
    '원고의 진지함을 깨지 않으면서 사건 맞춤형 한 줄을 준비하는 중입니다.',
    '피고의 변명이 자기 말에 걸리는 순간을 드립 없이도 웃기게 정리하는 중입니다.',
    '첫 장면을 마지막 두 문장에서 회수할 콜백을 확정하는 중입니다.'
  ],
  '빙의형': [
    '빙의형 판사가 사건이 속한 세계의 실제 규칙과 익숙한 표현부터 파악하는 중입니다.',
    '게임이면 플레이 구조, 회사면 업무 흐름처럼 사건 분야의 문법으로 정황을 읽는 중입니다.',
    '원고가 그 세계에서 당연히 기대했을 정상적인 결과를 복원하는 중입니다.',
    '피고의 설명이 해당 분야의 실제 관습과 맞는지 과몰입 검토 중입니다.',
    '사건 세계관 안에서만 성립하는 생활형 처분과 마지막 콜백을 작성하는 중입니다.'
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
          <div id="stage-emoji" style="font-size:46px;display:inline-block;animation:stage-bounce 1s ease-in-out infinite;">📋</div>
          <div id="loading-text" style="font-size:13px;color:var(--cream-dim);white-space:pre-line;line-height:1.75;margin-top:12px;"></div>
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

    const stageEmojiEl = document.getElementById('stage-emoji');
    if (stageEmojiEl) stageEmojiEl.textContent = STAGE_EMOJI[visualStage] || '⚖️';

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
    const isActive = i === activeIndex;
    const isDone = i < activeIndex;
    const emoji = isActive ? (STAGE_EMOJI[id] || '⚖️') : (isDone ? '✅' : '▫️');
    const emojiStyle = isActive ? `font-size:18px;display:inline-block;animation:stage-bounce 0.9s ease-in-out infinite;` : `font-size:15px;`;
    const cardBorder = isActive
      ? 'rgba(201,168,76,.9)'
      : isDone ? 'rgba(201,168,76,.5)' : 'var(--border)';
    const cardBg = isActive
      ? 'rgba(201,168,76,.18)'
      : isDone ? 'rgba(201,168,76,.08)' : 'rgba(255,255,255,.025)';
    const cardAnim = isActive ? 'animation:step-glow 1.5s ease-in-out infinite;' : '';
    const titleColor = (isActive || isDone) ? 'var(--gold)' : 'var(--cream-dim)';
    return `<div style="min-width:116px;padding:10px 9px;border-radius:12px;border:1px solid ${cardBorder};background:${cardBg};${cardAnim}">
      <div style="${emojiStyle}margin-bottom:3px;">${emoji}</div>
      <div style="font-size:12px;font-weight:900;color:${titleColor};">${escapeHtml(title)}</div>
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