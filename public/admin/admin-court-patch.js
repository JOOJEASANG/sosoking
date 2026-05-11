const REPLACEMENTS = [
  ['소소킹 토론배틀', '소소킹 생활법정'],
  ['토론배틀', '생활법정'],
  ['토론 배틀', '생활법정'],
  ['토론 주제', '생활 사건'],
  ['주제 관리', '사건 관리'],
  ['주제 등록', '사건 등록'],
  ['주제', '사건'],
  ['배틀 데이터', '재판 데이터'],
  ['배틀', '재판'],
  ['토론', '변론'],
  ['AI 심판', 'AI 판사'],
  ['심판', '판사'],
  ['판정 완료', '판결 완료'],
  ['판정', '판결'],
  ['A팀', '원고'],
  ['B팀', '피고'],
  ['찬성', '원고'],
  ['반대', '피고'],
];

function replaceText(text) {
  let out = text;
  for (const [from, to] of REPLACEMENTS) out = out.split(from).join(to);
  return out;
}

function walkText(node) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const next = replaceText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.tagName)) return;
  for (const child of Array.from(node.childNodes)) walkText(child);
}

function patchAttributes(root = document) {
  root.querySelectorAll?.('[placeholder], [title], [aria-label], input[value], button[value]').forEach(el => {
    for (const attr of ['placeholder', 'title', 'aria-label', 'value']) {
      if (!el.hasAttribute(attr)) continue;
      const old = el.getAttribute(attr);
      const next = replaceText(old);
      if (next !== old) el.setAttribute(attr, next);
    }
  });
}

function patchBranding() {
  document.title = replaceText(document.title || '관리자 · 소소킹 생활법정');
  document.querySelectorAll('.admin-brand-icon').forEach(el => { if (el.textContent === '🔥') el.textContent = '⚖️'; });
  document.querySelectorAll('.admin-brand-title').forEach(el => { el.textContent = '소소킹 생활법정'; });
  document.querySelectorAll('.admin-brand-sub').forEach(el => { el.textContent = 'Admin Court Console'; });
}

function patchAdmin() {
  walkText(document.getElementById('admin-content') || document.body);
  patchAttributes(document);
  patchBranding();
}

let timer = null;
function schedulePatch() {
  clearTimeout(timer);
  timer = setTimeout(patchAdmin, 20);
}

patchAdmin();
const observer = new MutationObserver(schedulePatch);
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
window.addEventListener('hashchange', schedulePatch);
window.addEventListener('load', schedulePatch);
