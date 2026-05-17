const REPLACEMENTS = [
  ['막장릴레이', '막장킹'],
  ['릴레이 이야기', '막장킹 이야기'],
  ['이어쓰기', '막장 이어쓰기'],
  ['이야기를 이어썼어요!', '막장킹에 참여했어요!'],
  ['다음 이야기를 이어주세요', '다음 막장 전개를 이어주세요'],
  ['한 문장씩 이어가는 스토리', '한 문장씩 터지는 막장 전개'],
];

function replaceInTextNode(node) {
  let text = node.nodeValue;
  let changed = false;
  for (const [from, to] of REPLACEMENTS) {
    if (text.includes(from)) {
      text = text.split(from).join(to);
      changed = true;
    }
  }
  if (changed) node.nodeValue = text;
}

function replaceInAttributes(el) {
  for (const attr of ['placeholder', 'title', 'aria-label']) {
    if (!el.hasAttribute?.(attr)) continue;
    let value = el.getAttribute(attr);
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

function patchRelayLabels(root = document.body) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    replaceInTextNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root !== document.body) return;

  replaceInAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
      return REPLACEMENTS.some(([from]) => node.nodeValue.includes(from))
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceInTextNode);

  root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach(replaceInAttributes);
}

let timer = null;
const observer = new MutationObserver(mutations => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => patchRelayLabels(node));
    }
    patchRelayLabels();
  }, 30);
});

if (document.body) {
  patchRelayLabels();
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

window.addEventListener('hashchange', () => setTimeout(() => patchRelayLabels(), 100));
setTimeout(() => patchRelayLabels(), 300);
