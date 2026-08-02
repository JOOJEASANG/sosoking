'use strict';

const SECTION_HEADINGS = new Set([
  '접수번호', '접수일자', '접수처', '접수취지', '사건개요', '접수의견',
  '사건번호', '수사관', '조사일자', '확인 정황', '정황 검토', '주요 증거',
  '진술 검토', '진술의 모순', '조사관 의견', '청구취지', '주장요지',
  '피해 및 요구사항', '원고측 최종의견', '답변취지', '항변요지',
  '피고측 최종의견', '주문', '판단이유', '판결 이유', '재판부 의견', '결론'
]);

function ensureStyle() {
  if (document.getElementById('court-document-format-style')) return;
  const style = document.createElement('style');
  style.id = 'court-document-format-style';
  style.textContent = `
    .court-formatted-body{white-space:normal!important;max-height:none!important;overflow:visible!important;}
    .court-formatted-body .doc-subheading{position:relative;margin:24px 0 10px;padding-left:12px;font-size:15px;font-weight:900;line-height:1.5;word-break:keep-all;}
    .court-formatted-body .doc-subheading::before{content:'';position:absolute;left:0;top:.35em;width:4px;height:1.1em;border-radius:3px;background:var(--gold,#a97927);}
    .court-formatted-body .doc-subheading:first-child{margin-top:0;}
    .court-formatted-body .doc-paragraph{margin:0 0 15px;line-height:1.95;word-break:keep-all;overflow-wrap:anywhere;}
    .court-formatted-body .doc-order-item{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;margin:0 0 12px;padding:13px 14px;border-left:4px solid var(--gold,#a97927);border-radius:0 8px 8px 0;background:rgba(169,121,39,.08);line-height:1.9;word-break:keep-all;overflow-wrap:anywhere;}
    .court-formatted-body .doc-order-number{font-weight:900;color:var(--gold,#8a611f);}
    .court-formatted-body .doc-order-text{margin:0;min-width:0;}
    [data-theme='dark'] .court-formatted-body .doc-order-item{background:rgba(201,168,76,.08);}

    .result-original-actions{
      display:flex;align-items:center;justify-content:center;margin:15px 0 0;
    }
    .result-document-page .result-original-actions .result-original-trigger{
      display:inline-flex!important;align-items:center;justify-content:center;min-height:38px!important;
      width:auto!important;margin:0!important;padding:9px 15px!important;border:1px solid #d5c5a9!important;
      border-radius:999px!important;background:#f7f0e3!important;color:#654b24!important;
      font:inherit!important;font-size:12px!important;font-weight:900!important;cursor:pointer!important;
      white-space:nowrap!important;box-shadow:0 5px 14px rgba(89,66,32,.1)!important;
    }
    .result-document-page .result-original-actions .result-original-trigger:hover{
      background:#efe2ca!important;border-color:#a97927!important;color:#4c3517!important;
    }
    [data-theme='dark'] .result-document-page .result-original-actions .result-original-trigger{
      border-color:rgba(209,173,80,.34)!important;background:rgba(201,168,76,.12)!important;
      color:var(--gold)!important;box-shadow:0 5px 16px rgba(0,0,0,.18)!important;
    }
    [data-theme='dark'] .result-document-page .result-original-actions .result-original-trigger:hover{
      background:rgba(201,168,76,.2)!important;border-color:var(--gold)!important;color:var(--gold)!important;
    }

    @media(max-width:640px){
      .court-formatted-body .doc-order-item{grid-template-columns:26px minmax(0,1fr);gap:6px;padding:12px 12px;}
      .court-formatted-body .doc-paragraph{text-align:left;}
      .result-original-actions{margin-top:13px;}
      .result-document-page .result-original-actions .result-original-trigger{
        width:min(100%,240px)!important;padding:10px 14px!important;font-size:12px!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function sourceText(element) {
  if (!element.matches('.result-paper-body')) return element.textContent || '';

  return [...element.children].map(child => {
    const text = (child.textContent || '').trim();
    if (!text) return '';
    if (child.matches('.doc-subheading')) return `\n${text}\n`;
    if (child.matches('.doc-order-item')) {
      const number = (child.querySelector('span')?.textContent || '').trim();
      const body = (child.querySelector('p')?.textContent || text).trim();
      return `\n${number} ${body}\n`;
    }
    return `${text}\n\n`;
  }).join('');
}

function normalizeCourtText(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/([.!?。)])\s*(?=(?:\d{1,2})\.\s+)/g, '$1\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function headingName(line) {
  const normalized = line.replace(/[:：]\s*$/, '').trim();
  return SECTION_HEADINGS.has(normalized) ? normalized : '';
}

function appendParagraph(fragment, text) {
  const clean = text.trim();
  if (!clean) return;
  const paragraph = document.createElement('p');
  paragraph.className = 'doc-paragraph';
  paragraph.textContent = clean;
  fragment.appendChild(paragraph);
}

function appendOrder(fragment, number, text) {
  const item = document.createElement('div');
  item.className = 'doc-order-item';

  const marker = document.createElement('span');
  marker.className = 'doc-order-number';
  marker.textContent = `${number}.`;

  const body = document.createElement('p');
  body.className = 'doc-order-text';
  body.textContent = text.trim();

  item.append(marker, body);
  fragment.appendChild(item);
}

function structuredFragment(value) {
  const fragment = document.createDocumentFragment();
  const lines = normalizeCourtText(value).split('\n');
  let paragraphParts = [];
  let order = null;

  const flushParagraph = () => {
    appendParagraph(fragment, paragraphParts.join(' '));
    paragraphParts = [];
  };

  const flushOrder = () => {
    if (order) appendOrder(fragment, order.number, order.parts.join(' '));
    order = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushOrder();
      flushParagraph();
      continue;
    }

    const heading = headingName(line);
    if (heading) {
      flushOrder();
      flushParagraph();
      const title = document.createElement('h3');
      title.className = 'doc-subheading';
      title.textContent = heading;
      fragment.appendChild(title);
      continue;
    }

    const numbered = line.match(/^(\d{1,2})[.)]\s+(.+)$/s);
    if (numbered) {
      flushOrder();
      flushParagraph();
      order = { number: numbered[1], parts: [numbered[2]] };
      continue;
    }

    if (order) order.parts.push(line);
    else paragraphParts.push(line);
  }

  flushOrder();
  flushParagraph();
  return fragment;
}

function formatDocumentBody(element) {
  if (!(element instanceof HTMLElement) || element.dataset.courtFormatted === 'true') return;
  const text = sourceText(element);
  if (!text.trim()) return;

  const fragment = structuredFragment(text);
  element.replaceChildren(fragment);
  element.classList.add('court-formatted-body');
  element.dataset.courtFormatted = 'true';
}

function repositionOriginalViewButton(root = document) {
  const pages = [];
  if (root instanceof HTMLElement && root.matches('.result-document-page')) pages.push(root);
  root.querySelectorAll?.('.result-document-page').forEach(page => pages.push(page));

  pages.forEach(page => {
    const trigger = page.querySelector('[data-original-trigger]');
    const cover = page.querySelector('.result-cover');
    const judgeSummary = cover?.querySelector('.judge-summary');
    if (!(trigger instanceof HTMLElement) || !cover || !judgeSummary) return;

    let actions = cover.querySelector('.result-original-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'result-original-actions';
      actions.dataset.originalLayout = 'cover';
      judgeSummary.insertAdjacentElement('beforebegin', actions);
    }

    if (trigger.parentElement !== actions) actions.appendChild(trigger);
    trigger.setAttribute('aria-label', '사용자가 접수한 원문 보기');
    trigger.dataset.originalPosition = 'cover';
  });
}

function formatAll(root = document) {
  ensureStyle();
  repositionOriginalViewButton(root);
  if (root instanceof HTMLElement && root.matches('.result-paper-body,.step-content')) {
    formatDocumentBody(root);
  }
  root.querySelectorAll?.('.result-paper-body,.step-content').forEach(formatDocumentBody);
}

function start() {
  const host = document.getElementById('page-content') || document.body;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      formatAll(host);
    });
  };

  formatAll(host);
  new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

export { formatAll, normalizeCourtText, repositionOriginalViewButton, structuredFragment };
