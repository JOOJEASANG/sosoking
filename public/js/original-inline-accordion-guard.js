import { functions } from './firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

function ensureStyle() {
  if (document.getElementById('public-original-accordion-guard-style')) return;
  const style = document.createElement('style');
  style.id = 'public-original-accordion-guard-style';
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
    .result-original-accordion-trigger:focus-visible{outline:3px solid rgba(169,121,39,.35);outline-offset:-3px;}
    .result-original-accordion-trigger:disabled{opacity:.65;cursor:wait;}
    .result-original-accordion-label{display:flex;align-items:center;gap:8px;min-width:0;}
    .result-original-accordion-icon{flex:0 0 auto;font-size:12px;transition:transform .18s ease;}
    .result-original-accordion-trigger[aria-expanded='true'] .result-original-accordion-icon{transform:rotate(180deg);}
    .result-original-accordion-panel[hidden]{display:none!important;}
    .result-original-accordion-panel{border-top:1px solid #ddd2c0;padding:15px 16px 17px;background:#fffdf7;}
    .result-original-accordion-meta{margin-bottom:9px;font-size:11px;font-weight:800;color:#856225;}
    .result-original-accordion-note{margin-bottom:12px;padding:10px 12px;border-radius:10px;background:#f7f0e3;color:#665d54;font-size:11px;line-height:1.65;}
    .result-original-accordion-body{white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;color:#302b25;font-size:14px;line-height:1.9;}
    [data-theme='dark'] .result-original-accordion{border-color:rgba(209,173,80,.3);background:rgba(201,168,76,.075);color:#fff9ef;}
    [data-theme='dark'] .result-original-accordion-trigger{color:var(--gold);}
    [data-theme='dark'] .result-original-accordion-trigger:hover{background:rgba(201,168,76,.12);}
    [data-theme='dark'] .result-original-accordion-panel{border-top-color:rgba(209,173,80,.24);background:rgba(8,12,18,.34);}
    [data-theme='dark'] .result-original-accordion-meta{color:var(--gold);}
    [data-theme='dark'] .result-original-accordion-note{background:rgba(201,168,76,.09);color:rgba(255,249,239,.68);}
    [data-theme='dark'] .result-original-accordion-body{color:rgba(255,249,239,.86);}
    @media(max-width:640px){
      .result-original-accordion{margin-top:14px;border-radius:12px;}
      .result-original-accordion-trigger{min-height:46px;padding:11px 13px;font-size:12px;}
      .result-original-accordion-panel{padding:13px 13px 15px;}
      .result-original-accordion-body{font-size:13px;line-height:1.85;}
    }
    @media(prefers-reduced-motion:reduce){.result-original-accordion-icon{transition:none!important;}}
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

function createAccordion(page, caseId) {
  const cover = page.querySelector('.result-cover');
  const judgeSummary = cover?.querySelector('.judge-summary');
  if (!cover || !judgeSummary || cover.querySelector('[data-original-accordion]')) return;

  ensureStyle();
  const safeId = String(caseId).replace(/[^a-zA-Z0-9_-]/g, '') || 'case';
  const panelId = `result-original-inline-${safeId}`;
  const accordion = document.createElement('section');
  accordion.className = 'result-original-accordion';
  accordion.dataset.originalAccordion = 'true';
  accordion.dataset.originalSource = 'cache-guard';
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
    try {
      const response = await getOriginal({ caseId });
      const data = response.data || {};
      meta.textContent = data.docketNumber
        ? `${data.caseTitle || '접수 원문'} · 사건번호 ${data.docketNumber}`
        : (data.caseTitle || '접수 원문');
      body.textContent = data.caseDescription || '기록된 접수 원문이 없습니다.';
      loaded = true;
    } catch (error) {
      console.error('public case original accordion load failed:', error);
      meta.textContent = '접수 원문';
      body.textContent = (error?.message || '접수 원문을 불러오지 못했습니다.').replace('FirebaseError: ', '');
    } finally {
      loading = false;
      trigger.disabled = false;
    }
  });
}

function normalizeOriginalUi(root = document) {
  const pages = [];
  if (root instanceof HTMLElement && root.matches('.result-document-page')) pages.push(root);
  root.querySelectorAll?.('.result-document-page').forEach(page => pages.push(page));

  pages.forEach(page => {
    const legacyTrigger = page.querySelector('[data-original-trigger]');
    const isPublicResult = Boolean(legacyTrigger || page.querySelector('#court-comment-input'));
    if (!isPublicResult) return;

    page.querySelectorAll('.result-original-layer').forEach(layer => layer.remove());
    page.querySelectorAll('.result-original-actions').forEach(actions => actions.remove());
    legacyTrigger?.remove();

    const caseId = currentCaseId();
    if (caseId) createAccordion(page, caseId);
  });
}

function start() {
  const host = document.getElementById('page-content') || document.body;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      normalizeOriginalUi(host);
    });
  };

  normalizeOriginalUi(host);
  new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

export { normalizeOriginalUi };
