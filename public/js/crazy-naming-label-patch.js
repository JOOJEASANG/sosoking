const LABEL_STYLE_ID = 'sosoking-crazy-naming-label-patch';
const OLD_LABEL = '사진 제목학원';
const NEW_LABEL = '미친작명소';

function injectLabelStyle() {
  if (document.getElementById(LABEL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LABEL_STYLE_ID;
  style.textContent = `
    [data-crazy-naming-patched="1"] { transition: none !important; }
  `;
  document.head.appendChild(style);
}

function replaceTextInNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  if (!node.nodeValue || !node.nodeValue.includes(OLD_LABEL)) return;
  node.nodeValue = node.nodeValue.replaceAll(OLD_LABEL, NEW_LABEL);
}

function patchAttributes(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
  ['placeholder', 'title', 'aria-label', 'value'].forEach(attr => {
    const value = el.getAttribute?.(attr);
    if (value && value.includes(OLD_LABEL)) el.setAttribute(attr, value.replaceAll(OLD_LABEL, NEW_LABEL));
  });
  if (el.dataset?.type === OLD_LABEL) el.dataset.type = NEW_LABEL;
  if (el.value && typeof el.value === 'string' && el.value.includes(OLD_LABEL)) el.value = el.value.replaceAll(OLD_LABEL, NEW_LABEL);
}

function patchCrazyNamingLabels(root = document.body) {
  injectLabelStyle();
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && node.nodeValue.includes(OLD_LABEL) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(replaceTextInNode);

  root.querySelectorAll?.('[placeholder*="사진 제목학원"], [title*="사진 제목학원"], [aria-label*="사진 제목학원"], [value*="사진 제목학원"], [data-type="사진 제목학원"]').forEach(patchAttributes);
  document.body.dataset.crazyNamingPatched = '1';
}

let scheduled = false;
function schedulePatch() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    patchCrazyNamingLabels();
  });
}

new MutationObserver(schedulePatch).observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true, characterData: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedulePatch);
else schedulePatch();
window.addEventListener('hashchange', () => setTimeout(schedulePatch, 30));
setTimeout(schedulePatch, 0);
setTimeout(schedulePatch, 500);
