const REPLACEMENTS = [
  ['골라봐', '골라킹'],
  ['웃겨봐', '대표 놀이'],
  ['도전봐', '대표 놀이'],
  ['3가지 카테고리', '대표 놀이'],
  ['9가지 게임', '대표 6가지 놀이'],
  ['9가지 유형', '대표 6가지 유형'],
  ['게임 유형', '대표 유형'],
  ['카테고리별 통계', '대표 유형별 통계'],
  ['카테고리·유형', '대표 유형'],
  ['카테고리', '유형'],
  ['OX퀴즈', '미친퀴즈'],
  ['4지선다', '미친퀴즈'],
  ['막장릴레이', '막장킹'],
  ['삼행시짓기', '초성게임'],
  ['한줄드립', '구형: 한줄드립'],
  ['랜덤대결', '구형: 랜덤대결'],
  ['골라킹 · 드립킹 · 도전킹', '대표 6가지 놀이'],
];

function shouldSkip(node) {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!el) return true;
  const tag = el.tagName;
  return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT';
}

function replaceTextNode(node) {
  if (shouldSkip(node)) return;
  let value = node.nodeValue || '';
  let changed = false;
  for (const [from, to] of REPLACEMENTS) {
    if (value.includes(from)) {
      value = value.split(from).join(to);
      changed = true;
    }
  }
  if (changed) node.nodeValue = value;
}

function replaceAttr(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE || shouldSkip(el)) return;
  for (const attr of ['title', 'aria-label', 'placeholder']) {
    if (!el.hasAttribute(attr)) continue;
    let value = el.getAttribute(attr) || '';
    let changed = false;
    for (const [from, to] of REPLACEMENTS) {
      if (value.includes(from)) {
        value = value.split(from).join(to);
        changed = true;
      }
    }
    if (changed) el.setAttribute(attr, value);
  }
}

function normalize(root = document.body) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    replaceTextNode(root);
    return;
  }
  replaceAttr(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
      return REPLACEMENTS.some(([from]) => (node.nodeValue || '').includes(from))
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceTextNode);
  root.querySelectorAll?.('[title], [aria-label], [placeholder]').forEach(replaceAttr);
}

let timer = null;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => normalize(), 60);
});

if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
window.addEventListener('hashchange', () => setTimeout(() => normalize(), 120));
setTimeout(() => normalize(), 400);
