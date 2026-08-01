import { renderResult as renderStyledResult } from './result-court.js?v=20260729-dark-record-participation-1';
import { functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

function stripJuryVote(container) {
  const reactionButton = container.querySelector('.reaction-btn');
  reactionButton?.closest('.card')?.remove();
  container.querySelector('.result-audience-title')?.remove();
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

function ensureOriginalModalStyle() {
  if (document.getElementById('public-original-modal-style')) return;

  const style = document.createElement('style');
  style.id = 'public-original-modal-style';
  style.textContent = `
    .result-original-trigger{
      margin-left:auto;border:1px solid var(--border);border-radius:999px;
      background:rgba(201,168,76,.12);color:var(--gold);padding:8px 13px;
      font:inherit;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;
    }
    .result-original-trigger:hover{background:rgba(201,168,76,.2);border-color:var(--gold);}
    .result-original-trigger:disabled{opacity:.6;cursor:wait;}
    .result-original-layer[hidden]{display:none!important;}
    .result-original-layer{
      position:fixed;inset:0;z-index:1400;display:grid;place-items:center;
      padding:18px;isolation:isolate;
    }
    .result-original-backdrop{position:absolute;inset:0;background:rgba(4,7,12,.76);backdrop-filter:blur(5px);}
    .result-original-panel{
      position:relative;z-index:1;width:min(640px,100%);max-height:min(78vh,760px);
      display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(201,168,76,.42);
      border-radius:18px;background:var(--navy-card);color:var(--cream);
      box-shadow:0 28px 80px rgba(0,0,0,.55);
    }
    .result-original-head{
      display:flex;align-items:flex-start;gap:14px;padding:18px 20px 15px;
      border-bottom:1px solid var(--border);background:rgba(201,168,76,.07);
    }
    .result-original-heading{min-width:0;flex:1;}
    .result-original-kicker{font-size:10px;font-weight:900;letter-spacing:.13em;color:var(--gold);}
    .result-original-title{margin-top:4px;font-family:var(--font-serif);font-size:19px;font-weight:900;line-height:1.45;word-break:keep-all;}
    .result-original-meta{margin-top:4px;font-size:11px;color:var(--cream-dim);}
    .result-original-close{
      flex:0 0 auto;width:34px;height:34px;border:1px solid var(--border);border-radius:50%;
      background:rgba(255,255,255,.05);color:var(--cream);font-size:22px;line-height:1;cursor:pointer;
    }
    .result-original-scroll{overflow:auto;padding:20px;overscroll-behavior:contain;}
    .result-original-note{
      margin-bottom:14px;padding:11px 13px;border-radius:11px;background:rgba(201,168,76,.09);
      color:var(--cream-dim);font-size:12px;line-height:1.65;
    }
    .result-original-body{
      min-height:120px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;
      font-size:15px;line-height:1.95;color:var(--cream);
    }
    body.result-original-open{overflow:hidden;}
    @media(max-width:640px){
      .result-original-layer{padding:10px;align-items:end;}
      .result-original-panel{width:100%;max-height:86vh;border-radius:18px 18px 12px 12px;}
      .result-original-head{padding:16px 16px 13px;}
      .result-original-scroll{padding:17px 16px 22px;}
      .result-original-trigger{padding:7px 11px;font-size:11px;}
    }
  `;
  document.head.appendChild(style);
}

function addOriginalView(container, caseId) {
  // 공개 판결에서만 생성되는 방청석 입력창을 공개 상태 판별 기준으로 사용한다.
  if (!container.querySelector('#court-comment-input')) return;

  const header = container.querySelector('.result-document-page > .page-header');
  const page = container.querySelector('.result-document-page');
  if (!header || !page || header.querySelector('[data-original-trigger]')) return;

  ensureOriginalModalStyle();

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'result-original-trigger';
  trigger.dataset.originalTrigger = 'true';
  trigger.textContent = '📄 원문보기';
  trigger.setAttribute('aria-haspopup', 'dialog');

  const layer = document.createElement('div');
  layer.className = 'result-original-layer';
  layer.id = 'result-original-layer';
  layer.hidden = true;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'result-original-title');
  layer.innerHTML = `
    <div class="result-original-backdrop" data-original-close="true"></div>
    <section class="result-original-panel" tabindex="-1">
      <header class="result-original-head">
        <div class="result-original-heading">
          <div class="result-original-kicker">ORIGINAL SUBMISSION</div>
          <div class="result-original-title" id="result-original-title">접수 원문</div>
          <div class="result-original-meta" id="result-original-meta"></div>
        </div>
        <button type="button" class="result-original-close" data-original-close="true" aria-label="접수 원문 닫기">×</button>
      </header>
      <div class="result-original-scroll">
        <div class="result-original-note">AI가 정리한 사건접수보고서가 아니라, 사용자가 처음 접수한 내용을 보여드립니다.</div>
        <div class="result-original-body" id="result-original-body">접수 원문을 불러오는 중입니다.</div>
      </div>
    </section>`;

  header.appendChild(trigger);
  page.appendChild(layer);

  const panel = layer.querySelector('.result-original-panel');
  const title = layer.querySelector('#result-original-title');
  const meta = layer.querySelector('#result-original-meta');
  const body = layer.querySelector('#result-original-body');
  const closeButton = layer.querySelector('.result-original-close');
  const getOriginal = httpsCallable(functions, 'getPublicCaseOriginal');
  let loaded = false;
  let previousFocus = null;

  const closeLayer = () => {
    if (layer.hidden) return;
    layer.hidden = true;
    document.body.classList.remove('result-original-open');
    document.removeEventListener('keydown', handleEscape);
    previousFocus?.focus?.();
  };

  const handleEscape = event => {
    if (event.key === 'Escape') closeLayer();
  };

  layer.addEventListener('click', event => {
    if (event.target.closest('[data-original-close="true"]')) closeLayer();
  });

  trigger.addEventListener('click', async () => {
    previousFocus = document.activeElement;
    layer.hidden = false;
    document.body.classList.add('result-original-open');
    document.addEventListener('keydown', handleEscape);
    closeButton?.focus();

    if (loaded) return;
    trigger.disabled = true;
    body.textContent = '접수 원문을 불러오는 중입니다.';

    try {
      const response = await getOriginal({ caseId });
      const data = response.data || {};
      title.textContent = data.caseTitle || '접수 원문';
      meta.textContent = data.docketNumber ? `사건번호 ${data.docketNumber}` : '';
      body.textContent = data.caseDescription || '기록된 접수 원문이 없습니다.';
      loaded = true;
      panel?.focus({ preventScroll: true });
    } catch (error) {
      console.error('public case original load failed:', error);
      title.textContent = '접수 원문';
      meta.textContent = '';
      body.textContent = (error?.message || '접수 원문을 불러오지 못했습니다.')
        .replace('FirebaseError: ', '');
    } finally {
      trigger.disabled = false;
    }
  });
}

export async function renderResult(container, caseId) {
  await renderStyledResult(container, caseId);
  stripJuryVote(container);
  addEntertainmentNotice(container);
  addDiscussionLink(container, caseId);
  addOriginalView(container, caseId);
}
