import { functions } from './firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

function ensureStyle() {
  if (document.getElementById('original-detail-header-guard-style')) return;

  const style = document.createElement('style');
  style.id = 'original-detail-header-guard-style';
  style.textContent = `
    .result-document-page .result-cover{
      position:relative!important;
      padding-top:70px!important;
    }
    .result-document-page .result-cover-toolbar{
      position:absolute!important;
      top:18px!important;
      left:22px!important;
      right:22px!important;
      z-index:3!important;
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:12px!important;
      min-height:36px!important;
      margin:0!important;
      text-align:left!important;
    }
    .result-document-page .result-cover-toolbar .result-court-name{
      flex:1!important;
      min-width:0!important;
      margin:0!important;
      text-align:left!important;
    }
    .result-document-page .result-cover-toolbar .result-original-accordion-trigger{
      position:static!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      gap:6px!important;
      flex:0 0 auto!important;
      width:auto!important;
      min-width:88px!important;
      min-height:36px!important;
      margin:0!important;
      padding:7px 12px!important;
      border:1px solid #d5c5a9!important;
      border-radius:999px!important;
      background:#f7f0e3!important;
      color:#654b24!important;
      font:inherit!important;
      font-size:12px!important;
      font-weight:900!important;
      line-height:1.2!important;
      cursor:pointer!important;
      text-align:center!important;
      white-space:nowrap!important;
      box-shadow:0 5px 14px rgba(89,66,32,.1)!important;
    }
    .result-document-page .result-cover-toolbar .result-original-accordion-trigger:hover{
      background:#efe2ca!important;
      border-color:#a97927!important;
      color:#4c3517!important;
    }
    .result-document-page .result-cover-toolbar .result-original-accordion-trigger:focus-visible{
      outline:3px solid rgba(169,121,39,.35)!important;
      outline-offset:2px!important;
    }
    .result-document-page .result-cover-toolbar .result-original-accordion-trigger:disabled{
      opacity:.65!important;
      cursor:wait!important;
    }
    .result-document-page .result-original-panel-host{
      display:block!important;
      margin:17px 0 0!important;
      border:1px solid #d8cfbf!important;
      border-radius:14px!important;
      background:#faf6ee!important;
      color:#302b25!important;
      overflow:hidden!important;
      text-align:left!important;
    }
    .result-document-page .result-original-panel-host:not(.is-open){display:none!important;}
    .result-document-page .result-original-panel-host .result-original-accordion-panel{
      border-top:0!important;
      padding:15px 16px 17px!important;
      background:#fffdf7!important;
    }
    [data-theme='dark'] .result-document-page .result-cover-toolbar .result-original-accordion-trigger{
      border-color:rgba(209,173,80,.34)!important;
      background:rgba(201,168,76,.12)!important;
      color:var(--gold)!important;
      box-shadow:0 5px 16px rgba(0,0,0,.18)!important;
    }
    [data-theme='dark'] .result-document-page .result-cover-toolbar .result-original-accordion-trigger:hover{
      background:rgba(201,168,76,.2)!important;
      border-color:var(--gold)!important;
      color:var(--gold)!important;
    }
    [data-theme='dark'] .result-document-page .result-original-panel-host{
      border-color:rgba(209,173,80,.3)!important;
      background:rgba(201,168,76,.075)!important;
      color:#fff9ef!important;
    }
    [data-theme='dark'] .result-document-page .result-original-panel-host .result-original-accordion-panel{
      background:rgba(8,12,18,.34)!important;
    }
    @media(max-width:640px){
      .result-document-page .result-cover{
        padding-top:62px!important;
      }
      .result-document-page .result-cover-toolbar{
        top:14px!important;
        left:14px!important;
        right:14px!important;
        gap:8px!important;
        min-height:34px!important;
      }
      .result-document-page .result-cover-toolbar .result-court-name{
        font-size:9px!important;
        letter-spacing:.07em!important;
      }
      .result-document-page .result-cover-toolbar .result-original-accordion-trigger{
        min-width:82px!important;
        min-height:34px!important;
        padding:7px 10px!important;
        font-size:11px!important;
      }
      .result-document-page .result-original-panel-host{
        margin-top:14px!important;
        border-radius:12px!important;
      }
      .result-document-page .result-original-panel-host .result-original-accordion-panel{
        padding:13px 13px 15px!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function currentCaseId() {
  const hash = location.hash || '';
  const hashMatch = hash.match(/^#\/(?:result|verdict)\/(.+)$/);
  const pathMatch = location.pathname.match(/^\/result\/(.+)$/);
  const raw = hashMatch?.[1] || pathMatch?.[1] || '';
  try { return decodeURIComponent(raw); }
  catch { return ''; }
}

function createOriginalControl(cover, judgeSummary, caseId) {
  const safeId = String(caseId).replace(/[^a-zA-Z0-9_-]/g, '') || 'case';
  const panelId = `result-original-detail-${safeId}`;
  const accordion = document.createElement('section');
  accordion.className = 'result-original-accordion result-original-panel-host';
  accordion.dataset.originalAccordion = 'true';
  accordion.dataset.originalSource = 'detail-header-guard';
  accordion.innerHTML = `
    <button type="button" class="result-original-accordion-trigger" aria-expanded="false" aria-controls="${panelId}" data-original-accordion-trigger="true">
      <span class="result-original-accordion-label">원문보기</span>
      <span class="result-original-accordion-icon" aria-hidden="true">▼</span>
    </button>
    <div class="result-original-accordion-panel" id="${panelId}" hidden>
      <div class="result-original-accordion-meta"></div>
      <div class="result-original-accordion-note">AI가 정리한 사건접수보고서가 아니라, 사용자가 처음 접수한 내용을 보여드립니다.</div>
      <div class="result-original-accordion-body">접수 원문을 불러오는 중입니다.</div>
    </div>`;
  judgeSummary.insertAdjacentElement('beforebegin', accordion);
  return accordion;
}

function bindPrivateOrOwnerControl(accordion, caseId) {
  if (accordion.dataset.originalSource !== 'detail-header-guard') return;

  const trigger = accordion.querySelector('[data-original-accordion-trigger]');
  const label = accordion.querySelector('.result-original-accordion-label');
  const panel = accordion.querySelector('.result-original-accordion-panel');
  const meta = accordion.querySelector('.result-original-accordion-meta');
  const body = accordion.querySelector('.result-original-accordion-body');
  if (!trigger || !label || !panel || !meta || !body || trigger.dataset.detailOriginalBound === 'true') return;

  trigger.dataset.detailOriginalBound = 'true';
  const getOriginal = httpsCallable(functions, 'getPublicCaseOriginal');
  let loaded = false;
  let loading = false;

  trigger.addEventListener('click', async () => {
    const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
    trigger.setAttribute('aria-expanded', String(willOpen));
    panel.hidden = !willOpen;
    accordion.classList.toggle('is-open', willOpen);
    label.textContent = willOpen ? '원문닫기' : '원문보기';
    trigger.setAttribute('aria-label', willOpen ? '접수 원문 닫기' : '사용자가 접수한 원문 보기');
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
      console.error('case original detail load failed:', error);
      meta.textContent = '접수 원문';
      body.textContent = (error?.message || '접수 원문을 불러오지 못했습니다.').replace('FirebaseError: ', '');
    } finally {
      loading = false;
      trigger.disabled = false;
    }
  });
}

function placeControl(page) {
  const caseId = currentCaseId();
  const cover = page.querySelector('.result-cover');
  const judgeSummary = cover?.querySelector('.judge-summary');
  const courtName = cover?.querySelector('.result-court-name');
  if (!caseId || !cover || !judgeSummary || !courtName) return;

  let accordion = cover.querySelector('[data-original-accordion]');
  if (!accordion) accordion = createOriginalControl(cover, judgeSummary, caseId);

  const trigger = accordion.querySelector('[data-original-accordion-trigger]');
  const panel = accordion.querySelector('.result-original-accordion-panel');
  if (!trigger || !panel) return;

  let toolbar = cover.querySelector('.result-cover-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'result-cover-toolbar';
    toolbar.dataset.originalHeaderToolbar = 'true';
    cover.insertBefore(toolbar, cover.firstChild);
  }

  if (courtName.parentElement !== toolbar) toolbar.prepend(courtName);
  if (trigger.parentElement !== toolbar) toolbar.appendChild(trigger);

  accordion.classList.add('result-original-panel-host');
  accordion.classList.toggle('is-open', !panel.hidden);
  trigger.dataset.originalHeaderPosition = 'cover-top-right';
  trigger.setAttribute(
    'aria-label',
    trigger.getAttribute('aria-expanded') === 'true' ? '접수 원문 닫기' : '사용자가 접수한 원문 보기'
  );
  bindPrivateOrOwnerControl(accordion, caseId);
}

function normalize(root = document) {
  ensureStyle();
  const pages = [];
  if (root instanceof HTMLElement && root.matches('.result-document-page')) pages.push(root);
  root.querySelectorAll?.('.result-document-page').forEach(page => pages.push(page));
  pages.forEach(placeControl);
}

function start() {
  const host = document.body;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      normalize(document);
    });
  };

  normalize(document);
  new MutationObserver(schedule).observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-expanded', 'hidden']
  });
  window.addEventListener('hashchange', schedule);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

export { normalize, placeControl };
