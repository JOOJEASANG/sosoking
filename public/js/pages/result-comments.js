import { renderResult as renderStyledResult } from './result-court.js?v=20260829-arena-1';
import { db, auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';

const OWNER_VERDICT_LABEL = {
  plaintiff: '원고 승',
  defendant: '피고 승',
  both: '쌍방 과실'
};

function stripJuryVote(container) {
  const reactionButton = container.querySelector('.reaction-btn');
  reactionButton?.closest('.card')?.remove();
  container.querySelector('.result-audience-title')?.remove();
}

function isOwnerVerdictVote(value) {
  return Object.prototype.hasOwnProperty.call(OWNER_VERDICT_LABEL, String(value || ''));
}

function isOwnedVerdictRoute() {
  return String(location.hash || '').startsWith('#/verdict/');
}

function renderOwnerStateLoading(container) {
  container.innerHTML = `
    <div class="page-header"><span class="logo">⚖️ 판결문</span></div>
    <div class="container" style="padding:60px 20px;text-align:center;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <div style="margin-top:14px;font-size:12px;color:var(--cream-dim);">판결 봉인 상태를 확인하고 있습니다.</div>
    </div>`;
}

async function loadOwnerVerdictState(caseId) {
  const user = auth.currentUser;
  if (!user) {
    return { isOwner: false, vote: '', verificationFailed: isOwnedVerdictRoute() };
  }

  try {
    const caseSnap = await getDoc(doc(db, 'cases', caseId));
    if (!caseSnap.exists()) {
      return { isOwner: false, vote: '', verificationFailed: isOwnedVerdictRoute() };
    }
    const caseData = caseSnap.data();
    if (caseData.userId !== user.uid) {
      return { isOwner: false, vote: '', verificationFailed: isOwnedVerdictRoute() };
    }
    const vote = isOwnerVerdictVote(caseData.ownerVerdictVote) ? caseData.ownerVerdictVote : '';
    return { isOwner: true, vote, verificationFailed: false };
  } catch (error) {
    // 공개 판결을 보는 일반 사용자는 cases 문서를 읽을 수 없으므로 정상적인 permission-denied다.
    // 다만 /verdict/는 본인 전용 경로이므로 소유권을 확인하지 못하면 판결을 먼저 보여주지 않는다.
    if (isOwnedVerdictRoute()) {
      console.warn('owner verdict state verification failed:', error?.code || error);
      return { isOwner: false, vote: '', verificationFailed: true };
    }
    return { isOwner: false, vote: '', verificationFailed: false };
  }
}

function renderOwnerVerificationError(container, caseId) {
  container.innerHTML = `
    <div class="page-header"><span class="logo">⚖️ 판결문</span></div>
    <div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">
      판결 봉인 상태를 확인하지 못했습니다.<br>
      잠시 후 다시 시도해 주세요.<br><br>
      <button type="button" class="btn btn-primary" id="owner-verdict-retry">다시 확인하기</button>
      <a href="#/my-cases" class="btn btn-ghost" style="margin-top:10px;">내 사건으로 돌아가기</a>
    </div>`;
  container.querySelector('#owner-verdict-retry')?.addEventListener('click', () => renderResult(container, caseId));
}

function ensureOwnerBlindStyle() {
  if (document.getElementById('owner-blind-verdict-style')) return;

  const style = document.createElement('style');
  style.id = 'owner-blind-verdict-style';
  style.textContent = `
    .owner-verdict-gate{
      padding:26px 24px 28px!important;text-align:center;
      border:1px solid rgba(201,168,76,.5)!important;
      background:linear-gradient(145deg,rgba(201,168,76,.12),rgba(255,255,255,.025))!important;
    }
    .owner-verdict-lock{font-size:38px;line-height:1;margin-bottom:12px;}
    .owner-verdict-kicker{font-size:10px;font-weight:900;letter-spacing:.14em;color:var(--gold);margin-bottom:7px;}
    .owner-verdict-gate h2{margin:0 0 10px;font-family:var(--font-serif);font-size:21px;line-height:1.5;color:var(--cream);}
    .owner-verdict-gate p{margin:0 auto 20px;max-width:520px;font-size:13px;line-height:1.75;color:var(--cream-dim);word-break:keep-all;}
    .owner-verdict-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;max-width:560px;margin:0 auto;}
    .owner-verdict-choice{
      min-width:0;min-height:54px;padding:10px 8px;border:1px solid rgba(201,168,76,.35);border-radius:12px;
      background:rgba(255,255,255,.035);color:var(--cream);font:inherit;font-size:13px;font-weight:900;cursor:pointer;
      transition:transform .14s ease,border-color .14s ease,background .14s ease;
    }
    .owner-verdict-choice:hover{transform:translateY(-1px);border-color:var(--gold);background:rgba(201,168,76,.12);}
    .owner-verdict-choice:disabled{opacity:.55;cursor:wait;transform:none;}
    .owner-verdict-once{margin-top:13px;font-size:10.5px;color:var(--cream-dim);}
    .owner-verdict-reveal{
      margin:0 0 16px;padding:14px 16px;border:1px solid rgba(201,168,76,.45);border-radius:13px;
      background:rgba(201,168,76,.09);text-align:center;font-size:12.5px;line-height:1.7;color:var(--cream-dim);
    }
    .owner-verdict-reveal strong{color:var(--gold);}
    [data-theme='light'] .owner-verdict-gate h2,[data-theme='light'] .owner-verdict-choice{color:#30251a;}
    [data-theme='light'] .owner-verdict-choice{background:#fffaf1;}
    [data-theme='light'] .owner-verdict-reveal{color:#665d54;background:#fff8e9;}
    @media(max-width:520px){
      .owner-verdict-gate{padding:22px 16px 24px!important;}
      .owner-verdict-choices{grid-template-columns:minmax(0,1fr);}
      .owner-verdict-choice{min-height:48px;}
    }
  `;
  document.head.appendChild(style);
}

function addOwnerBlindGate(container, caseId) {
  const verdictCard = container.querySelector('.verdict-card');
  if (!verdictCard) return false;

  ensureOwnerBlindStyle();

  const gate = document.createElement('section');
  gate.className = 'card owner-verdict-gate';
  gate.dataset.ownerVerdictGate = 'true';
  gate.innerHTML = `
    <div class="owner-verdict-lock" aria-hidden="true">🔒</div>
    <div class="owner-verdict-kicker">AI 판결 봉인 중</div>
    <h2>내 사건, 판결을 보기 전에 먼저 찍어보세요</h2>
    <p>사건접수와 양측 주장을 다시 읽어본 뒤, 내가 재판장이라면 누구의 손을 들어줄지 선택하세요. 선택하는 순간 AI 재판부의 판결문이 공개됩니다.</p>
    <div class="owner-verdict-choices" role="group" aria-label="내 사건 예상 판정">
      <button type="button" class="owner-verdict-choice" data-owner-verdict-vote="plaintiff">⚖️ 원고 승</button>
      <button type="button" class="owner-verdict-choice" data-owner-verdict-vote="defendant">🛡️ 피고 승</button>
      <button type="button" class="owner-verdict-choice" data-owner-verdict-vote="both">🤝 쌍방 과실</button>
    </div>
    <div class="owner-verdict-once">첫 선택이 기록되며, AI 판결을 본 뒤에는 바꿀 수 없습니다.</div>`;

  verdictCard.replaceWith(gate);
  container.querySelector('.result-audience')?.remove();
  container.querySelector('.result-actions')?.remove();

  const voteOwnVerdict = httpsCallable(functions, 'voteOwnVerdict');
  const buttons = [...gate.querySelectorAll('[data-owner-verdict-vote]')];
  buttons.forEach(button => {
    button.addEventListener('click', async () => {
      const reaction = button.dataset.ownerVerdictVote;
      if (!isOwnerVerdictVote(reaction)) return;

      buttons.forEach(item => { item.disabled = true; });
      const oldText = button.textContent;
      button.textContent = '판정 기록 중...';
      try {
        await voteOwnVerdict({ caseId, reaction });
        showToast('내 판정을 기록했습니다. 이제 AI 판결을 공개합니다.', 'success');
        await renderResult(container, caseId);
      } catch (error) {
        console.error('owner verdict vote failed:', error);
        buttons.forEach(item => { item.disabled = false; });
        button.textContent = oldText;
        showToast((error?.message || '판정을 기록하지 못했습니다.').replace('FirebaseError: ', ''), 'error');
      }
    });
  });

  return true;
}

function addOwnerRevealNotice(container, vote) {
  if (!isOwnerVerdictVote(vote) || container.querySelector('[data-owner-verdict-reveal]')) return;
  const verdictCard = container.querySelector('.verdict-card');
  if (!verdictCard) return;

  ensureOwnerBlindStyle();
  const notice = document.createElement('div');
  notice.className = 'owner-verdict-reveal';
  notice.dataset.ownerVerdictReveal = 'true';
  notice.innerHTML = `내 선택은 <strong>${OWNER_VERDICT_LABEL[vote]}</strong>이었습니다. 🔓 판결 봉인 해제 — 이제 AI 재판부의 판단과 비교해보세요.`;
  verdictCard.insertAdjacentElement('beforebegin', notice);
}

function addEntertainmentNotice(container) {
  const cover = container.querySelector('.result-cover');
  if (!cover || container.querySelector('.result-comedy-notice')) return;

  const notice = document.createElement('div');
  notice.className = 'result-comedy-notice';
  notice.setAttribute('role', 'note');
  notice.style.cssText = 'margin:0 0 16px;padding:15px 17px;border:1px dashed rgba(201,168,76,.65);border-radius:14px;background:rgba(201,168,76,.1);font-size:13px;line-height:1.75;color:var(--cream);text-align:center;';
  notice.innerHTML = '<strong style="color:var(--gold);">🎭 진지한 형식으로 즐기는 오락형 생활법정</strong><br>사건의 상황과 판결 내용을 읽는 AI 창작물이며, 실제 법률 판단이나 법적 효력은 없습니다.';
  cover.insertAdjacentElement('afterend', notice);
}

function addDiscussionLink(container, caseId) {
  if (!container.querySelector('#court-comment-input')) return;
  const actions = container.querySelector('.result-actions');
  if (!actions || actions.querySelector('[data-discussion-link]')) return;

  const link = document.createElement('a');
  link.href = `#/discussion/${encodeURIComponent(caseId)}`;
  link.className = 'btn btn-primary';
  link.dataset.discussionLink = 'true';
  link.textContent = '💬 이 판결로 토론하기';
  actions.prepend(link);
}

function ensureOriginalAccordionStyle() {
  if (document.getElementById('public-original-accordion-style')) return;

  const style = document.createElement('style');
  style.id = 'public-original-accordion-style';
  style.textContent = `
    .result-original-accordion{
      margin:17px 0 0;border:1px solid #d8cfbf;border-radius:14px;
      background:#faf6ee;color:#302b25;overflow:hidden;text-align:left;
    }
    .result-original-accordion-trigger{
      width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;
      min-height:48px;padding:12px 15px;border:0;background:transparent;color:#654b24;
      font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-align:left;
    }
    .result-original-accordion-trigger:hover{background:#f2e8d7;color:#4c3517;}
    .result-original-accordion-trigger:focus-visible{
      outline:3px solid rgba(169,121,39,.35);outline-offset:-3px;
    }
    .result-original-accordion-trigger:disabled{opacity:.65;cursor:wait;}
    .result-original-accordion-label{display:flex;align-items:center;gap:8px;min-width:0;}
    .result-original-accordion-icon{flex:0 0 auto;font-size:12px;transition:transform .18s ease;}
    .result-original-accordion-trigger[aria-expanded='true'] .result-original-accordion-icon{transform:rotate(180deg);}
    .result-original-accordion-panel[hidden]{display:none!important;}
    .result-original-accordion-panel{
      border-top:1px solid #ddd2c0;padding:15px 16px 17px;background:#fffdf7;
    }
    .result-original-accordion-meta{margin-bottom:9px;font-size:11px;font-weight:800;color:#856225;}
    .result-original-accordion-note{
      margin-bottom:12px;padding:10px 12px;border-radius:10px;background:#f7f0e3;
      color:#665d54;font-size:11px;line-height:1.65;
    }
    .result-original-accordion-body{
      white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;
      color:#302b25;font-size:14px;line-height:1.9;
    }
    [data-theme='dark'] .result-original-accordion{
      border-color:rgba(209,173,80,.3);background:rgba(201,168,76,.075);color:#fff9ef;
    }
    [data-theme='dark'] .result-original-accordion-trigger{color:var(--gold);}
    [data-theme='dark'] .result-original-accordion-trigger:hover{background:rgba(201,168,76,.12);}
    [data-theme='dark'] .result-original-accordion-panel{
      border-top-color:rgba(209,173,80,.24);background:rgba(8,12,18,.34);
    }
    [data-theme='dark'] .result-original-accordion-meta{color:var(--gold);}
    [data-theme='dark'] .result-original-accordion-note{
      background:rgba(201,168,76,.09);color:rgba(255,249,239,.68);
    }
    [data-theme='dark'] .result-original-accordion-body{color:rgba(255,249,239,.86);}
    @media(max-width:640px){
      .result-original-accordion{margin-top:14px;border-radius:12px;}
      .result-original-accordion-trigger{min-height:46px;padding:11px 13px;font-size:12px;}
      .result-original-accordion-panel{padding:13px 13px 15px;}
      .result-original-accordion-body{font-size:13px;line-height:1.85;}
    }
    @media(prefers-reduced-motion:reduce){
      .result-original-accordion-icon{transition:none!important;}
    }
  `;
  document.head.appendChild(style);
}

function addOriginalAccordion(container, caseId) {
  // 판결기록의 공개 판결과 내 사건의 소유자 판결 모두 같은 원문 UI를 사용한다.
  // 실제 원문 접근 권한은 getPublicCaseOriginal 서버 함수가 소유자/공개 여부로 최종 검증한다.
  const cover = container.querySelector('.result-cover');
  const judgeSummary = cover?.querySelector('.judge-summary');
  if (!cover || !judgeSummary || cover.querySelector('[data-original-accordion]')) return;

  ensureOriginalAccordionStyle();

  const accordion = document.createElement('section');
  accordion.className = 'result-original-accordion';
  accordion.dataset.originalAccordion = 'true';

  const panelId = `result-original-panel-${String(caseId).replace(/[^a-zA-Z0-9_-]/g, '') || 'case'}`;
  accordion.innerHTML = `
    <button type="button" class="result-original-accordion-trigger" aria-expanded="false" aria-controls="${panelId}" data-original-accordion-trigger="true">
      <span class="result-original-accordion-label">📄 접수 원문 펼쳐보기</span>
      <span class="result-original-accordion-icon" aria-hidden="true">▼</span>
    </button>
    <div class="result-original-accordion-panel" id="${panelId}" hidden>
      <div class="result-original-accordion-meta"></div>
      <div class="result-original-accordion-note">AI가 정리한 사건접수보고서가 아니라, 사용자가 처음 접수한 내용을 보여드립니다.</div>
      <div class="result-original-accordion-body">접수 원문을 불러오는 중입니다.</div>
    </div>`;

  judgeSummary.insertAdjacentElement('beforebegin', accordion);

  const trigger = accordion.querySelector('[data-original-accordion-trigger]');
  const label = accordion.querySelector('.result-original-accordion-label');
  const panel = accordion.querySelector('.result-original-accordion-panel');
  const meta = accordion.querySelector('.result-original-accordion-meta');
  const body = accordion.querySelector('.result-original-accordion-body');
  const getOriginal = httpsCallable(functions, 'getPublicCaseOriginal');
  let loaded = false;
  let loading = false;

  trigger.addEventListener('click', async () => {
    const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
    trigger.setAttribute('aria-expanded', String(willOpen));
    panel.hidden = !willOpen;
    label.textContent = willOpen ? '📄 접수 원문 접기' : '📄 접수 원문 펼쳐보기';

    if (!willOpen || loaded || loading) return;

    loading = true;
    trigger.disabled = true;
    body.textContent = '접수 원문을 불러오는 중입니다.';

    try {
      const response = await getOriginal({ caseId });
      const data = response.data || {};
      meta.textContent = data.docketNumber
        ? `${data.caseTitle || '접수 원문'} · 사건번호 ${data.docketNumber}`
        : (data.caseTitle || '접수 원문');
      body.textContent = data.caseDescription || '기록된 접수 원문이 없습니다.';
      loaded = true;
    } catch (error) {
      console.error('case original load failed:', error);
      meta.textContent = '접수 원문';
      body.textContent = (error?.message || '접수 원문을 불러오지 못했습니다.')
        .replace('FirebaseError: ', '');
    } finally {
      loading = false;
      trigger.disabled = false;
    }
  });
}

export async function renderResult(container, caseId) {
  if (isOwnedVerdictRoute()) renderOwnerStateLoading(container);
  const ownerState = await loadOwnerVerdictState(caseId);
  if (ownerState.verificationFailed) {
    renderOwnerVerificationError(container, caseId);
    return;
  }

  await renderStyledResult(container, caseId);
  stripJuryVote(container);
  addEntertainmentNotice(container);
  addOriginalAccordion(container, caseId);

  if (ownerState.isOwner && !ownerState.vote) {
    addOwnerBlindGate(container, caseId);
    return;
  }

  if (ownerState.isOwner) addOwnerRevealNotice(container, ownerState.vote);
  addDiscussionLink(container, caseId);
}