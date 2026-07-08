const EMOJI_REPLACEMENTS = new Map([
  ['🥹', '😢']
]);

let observer = null;
let observedRoot = null;

function replaceTextNode(node) {
  let text = node.nodeValue || '';
  let changed = false;
  EMOJI_REPLACEMENTS.forEach((safe, unsafe) => {
    if (text.includes(unsafe)) {
      text = text.replaceAll(unsafe, safe);
      changed = true;
    }
  });
  if (changed) node.nodeValue = text;
}

function shouldSkip(parent) {
  if (!parent) return true;
  return ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName);
}

export function applyEmojiCompat(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceTextNode);
}

export function startEmojiCompatObserver(root = document.getElementById('page-content') || document.body) {
  if (!root) return;
  applyEmojiCompat(root);
  if (observer && observedRoot === root) return;
  if (observer) observer.disconnect();
  observedRoot = root;
  observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (!shouldSkip(node.parentElement)) replaceTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          if (!shouldSkip(node)) applyEmojiCompat(node);
        }
      });
    });
  });
  observer.observe(root, { childList: true, subtree: true });
}
