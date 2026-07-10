import { db, auth } from '../firebase.js?v=20260708-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderResult as renderBaseResult } from './result.js?v=20260710-v2result1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

function ensureOriginalCaseStyle() {
  if (document.getElementById('original-case-story-style')) return;
  const style = document.createElement('style');
  style.id = 'original-case-story-style';
  style.textContent = `
    .original-case-card{position:relative;overflow:hidden;border-color:rgba(201,168,76,.62)!important;background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.035))!important;}
    .original-case-card::before{content:'접수원문';position:absolute;right:12px;top:12px;border:1px solid rgba(201,168,76,.4);border-radius:999px;padding:3px 8px;font-size:9px;font-weight:900;letter-spacing:.08em;color:var(--gold);}
    .original-case-card .original-case-title{font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--gold);margin-bottom:9px;}
    .original-case-card .original-case-text{font-size:14px;line-height:1.85;color:var(--cream);white-space:pre-wrap;word-break:keep-all;padding-right:54px;}
    .original-case-card .original-case-wish{margin-top:10px;padding-top:10px;border-top:1px dashed rgba(201,168,76,.28);font-size:12px;line-height:1.65;color:var(--cream-dim);}
    [data-theme="light"] .original-case-card,:root:not([data-theme="dark"]) .original-case-card{background:linear-gradient(135deg,#fff5d5,#fffaf0)!important;}
    [data-theme="light"] .original-case-card .original-case-text,:root:not([data-theme="dark"]) .original-case-card .original-case-text{color:#342514!important;}
  `;
  document.head.appendChild(style);
}

async function loadOriginalCase(caseId) {
  const resultSnap = await getDoc(doc(db, 'results', caseId)).catch(() => null);
  const result = resultSnap?.exists() ? resultSnap.data() : {};
  let description = String(result.caseDescription || '').trim();
  let desiredVerdict = String(result.desiredVerdict || '').trim();

  if ((!description || !desiredVerdict) && auth.currentUser) {
    const caseSnap = await getDoc(doc(db, 'cases', caseId)).catch(() => null);
    if (caseSnap?.exists()) {
      const data = caseSnap.data() || {};
      description ||= String(data.caseDescription || '').trim();
      desiredVerdict ||= String(data.desiredVerdict || '').trim();
    }
  }
  return { description, desiredVerdict };
}

function decorateOriginalCase(container, original) {
  if (!original.description || container.querySelector('.original-case-card')) return;
  const cover = container.querySelector('.result-cover');
  if (!cover) return;
  cover.insertAdjacentHTML('afterend', `
    <section class="result-card original-case-card">
      <div class="original-case-title">사용자가 접수한 실제 사건 내용</div>
      <div class="original-case-text">${escapeHtml(original.description)}</div>
      ${original.desiredVerdict ? `<div class="original-case-wish"><strong>희망 판결</strong> · ${escapeHtml(original.desiredVerdict)}</div>` : ''}
    </section>`);
}

export async function renderResult(container, caseId) {
  ensureOriginalCaseStyle();
  const originalPromise = loadOriginalCase(caseId);
  await renderBaseResult(container, caseId);
  const original = await originalPromise;
  decorateOriginalCase(container, original);

  const observer = new MutationObserver(() => decorateOriginalCase(container, original));
  observer.observe(container, { childList: true, subtree: true });
  const previousCleanup = window._pageCleanup;
  window._pageCleanup = () => {
    observer.disconnect();
    previousCleanup?.();
  };
}
