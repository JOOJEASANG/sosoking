const EMOJI_REPLACEMENTS = new Map([
  ['🥹', '😢']
]);

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

export function applyEmojiCompat(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceTextNode);
}
