// points-removal-ui.js
// 기존 포인트/정치력 중심 UI를 자료·댓글 중심 문구로 정리한다.

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

const TEXT_REPLACERS = [
  [/\(\s*[+\-]?\d[\d,]*\s*P\s*\)/g, ''],
  [/\s*[+\-]\d[\d,]*\s*P\b/g, ''],
  [/\d[\d,]*\s*P\s*(?:남음|남았습니다\.?|가\s*차감됩니다\.?|차감)?/g, ''],
  [/정치력\s*보너스/g, '참여 기록'],
  [/정치력/g, '참여'],
  [/포인트/g, '활동'],
  [/데일리\s*퀘스트/g, '오늘 자료'],
  [/오늘게임/g, '오늘자료'],
  [/정당\s*대항전/g, '오늘의 쟁점'],
  [/정당·대선/g, '관심 분야'],
  [/대통령\s*선거/g, '댓글·랭킹'],
  [/공화국\s*현황/g, '자료 현황'],
  [/유세하기/g, '자료 참여'],
  [/탈당/g, '관심 분야 변경'],
  [/정당\s*활동/g, '관심 분야'],
  [/정당\s*관리/g, '관심 분야'],
];

const WATCH_RE = /(P\b|정치력|포인트|데일리\s*퀘스트|오늘게임|정당\s*대항전|정당·대선|대통령\s*선거|공화국\s*현황|유세하기|탈당|정당\s*활동|정당\s*관리)/;

function cleanText(text) {
  return TEXT_REPLACERS.reduce((next, [pattern, replace]) => next.replace(pattern, replace), text).replace(/\s{2,}/g, ' ').trimStart();
}

function sanitizeTextNodes(root = document.body) {
  if (!root || SKIP_TAGS.has(root.nodeName)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !WATCH_RE.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const next = cleanText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  });
}

function installPointlessStyle() {
  if (document.getElementById('soso-pointless-style')) return;
  const style = document.createElement('style');
  style.id = 'soso-pointless-style';
  style.textContent = `
    .battle-game-bar,
    .battle-power-hint,
    .battle-discuss__reward,
    .account-rank-progress,
    .account-badge-showcase,
    .point-popup,
    .points-popup,
    [class*="point-popup"],
    [class*="points-popup"]{display:none!important}
    .account-stat:first-child{display:none!important}
    .account-level .title-badge{display:none!important}
    .battle-party-vote-btn::after{content:' 의견 선택하기'}
    .battle-party-vote-btn{font-size:0!important}
    .battle-party-vote-btn::after{font-size:14px;font-weight:900}
  `;
  document.head.appendChild(style);
}

let scheduled = false;
function scheduleSanitize() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    installPointlessStyle();
    sanitizeTextNodes(document.body);
  });
}

installPointlessStyle();
sanitizeTextNodes(document.body);

const observer = new MutationObserver(scheduleSanitize);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('hashchange', scheduleSanitize);
window.addEventListener('sosoking:page-rendered', scheduleSanitize);
