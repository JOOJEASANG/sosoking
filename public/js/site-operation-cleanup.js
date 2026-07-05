// site-operation-cleanup.js
// 운영 범위를 토론소/드립소로 고정하고, 화면 문구와 모바일 폭 기준을 마지막 단계에서 보정합니다.

const SITE_COPY_RULES = new Map([
  ['AI CHARACTER COMMUNITY', '토론 · 드립 전용 커뮤니티'],
  ['AI 캐릭터 콘텐츠 커뮤니티', '토론·드립 캐릭터 커뮤니티'],
  ['캐릭터·유저 댓글 반응', '토론·드립 댓글 반응'],
  ['인기 콘텐츠', '인기 토론·드립'],
  ['콘텐츠 관리', '토론·드립 관리'],
]);

const ROOM_LABELS = new Set(['토론', '드립', '토론소', '드립소']);

function replaceTextNode(node) {
  let next = node.nodeValue || '';
  for (const [from, to] of SITE_COPY_RULES) next = next.replaceAll(from, to);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function walkText(root) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceTextNode);
}

function normalizeRoomLinks(root = document) {
  root.querySelectorAll('[data-room-nav], .soso-room-tab, .home-onboard__room, .bottom-nav__item, .sidebar__nav-item').forEach(el => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const isAllowed = [...ROOM_LABELS].some(label => text.includes(label));
    const isLegacyGame = /마피아|라이어|추리|게임|퀴즈|오락실|소소랜드/.test(text);
    if (isLegacyGame && !isAllowed) {
      el.setAttribute('hidden', 'hidden');
      el.setAttribute('aria-hidden', 'true');
    }
  });
}

function normalizeMeta() {
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute('content', '사소한 주제를 토론소와 드립소에서 나누고, 운영봇과 8명의 캐릭터가 사회자·참여자로 반응하는 커뮤니티입니다.');
  }
  document.title = document.title.replace('웃긴토론과 드립 커뮤니티', '토론소·드립소 커뮤니티');
}

function applyCleanup(root = document) {
  normalizeMeta();
  walkText(root === document ? document.body : root);
  normalizeRoomLinks(root === document ? document : root);
}

applyCleanup();

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) applyCleanup(node);
      else if (node.nodeType === Node.TEXT_NODE) replaceTextNode(node);
    });
  }
});

observer.observe(document.body, { childList: true, subtree: true });

window.__SOSOKING_OPERATION__ = Object.freeze({
  rooms: ['토론소', '드립소'],
  publicCharacters: 8,
  host: '운영봇',
  generatedAuthorMode: 'virtual-nickname',
});
