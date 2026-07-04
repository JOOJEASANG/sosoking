/* final-consistency-20260705.js
   문구 통일, 글쓰기 진입 가드, 레거시 inline handler 보정
*/
import { auth } from './firebase.js';
import { navigate } from './router.js';

const DEFAULT_WRITE_PATH = '/write?type=multi&preset=judgment';
const WRITE_PRESET_BY_ROOM = {
  'write-judgment': 'judgment',
  'write-consult': 'consult',
  'write-vote': 'vote',
  'write-drip': 'drip',
};

window.navigate = navigate;

function loginPath(returnTo = DEFAULT_WRITE_PATH) {
  return `/login?return=${encodeURIComponent(returnTo)}`;
}

function normalizeWritePath(path = '') {
  const value = String(path || '').trim();
  if (!value) return DEFAULT_WRITE_PATH;
  if (value.startsWith('#')) return normalizeWritePath(value.slice(1));
  if (value.startsWith('/write')) return value;
  return DEFAULT_WRITE_PATH;
}

function pathFromTrigger(trigger) {
  const href = trigger.getAttribute?.('href') || '';
  if (href.startsWith('#/write')) return normalizeWritePath(href.slice(1));

  const dataPath = trigger.dataset?.navPath || trigger.dataset?.path || '';
  if (dataPath.startsWith('/write')) return normalizeWritePath(dataPath);

  const room = trigger.dataset?.roomNav || '';
  if (WRITE_PRESET_BY_ROOM[room]) return `/write?type=multi&preset=${WRITE_PRESET_BY_ROOM[room]}`;

  if (trigger.id === 'hbtn-write' || trigger.id === 'room-write-btn' || trigger.id === 'ai-residents-write-btn' || trigger.id === 'sb-write-btn') {
    const activeType = document.querySelector('.soso-room-tab.active')?.dataset?.typeFilter || '';
    const preset = activeType && ['judgment', 'consult', 'vote', 'drip'].includes(activeType) ? activeType : 'judgment';
    return `/write?type=multi&preset=${preset}`;
  }

  return '';
}

function guardWriteEntry(event) {
  const trigger = event.target?.closest?.(
    'a[href^="#/write"], button[data-nav-path^="/write"], [data-room-nav], #hbtn-write, #room-write-btn, #ai-residents-write-btn, #sb-write-btn'
  );
  if (!trigger) return;

  const writePath = pathFromTrigger(trigger);
  if (!writePath) return;

  if (!auth.currentUser) {
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(loginPath(writePath));
  }
}

function guardWriteLoginButton(event) {
  if (!window.location.hash.startsWith('#/write')) return;
  const button = event.target?.closest?.('button, a');
  if (!button) return;
  if (!/로그인/.test(button.textContent || '')) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const current = normalizeWritePath(window.location.hash.slice(1));
  navigate(loginPath(current));
}

const TEXT_REPLACEMENTS = [
  [/\+ 글 열기/g, '+ 글쓰기'],
  [/글 열기/g, '글쓰기'],
  [/콘텐츠 쓰기/g, '글쓰기'],
  [/일반게시판 글쓰기/g, '소소킹 글쓰기'],
  [/게임형 커뮤니티/g, '참여형 커뮤니티'],
  [/8명 캐릭터 대기중/g, '8명 캐릭터 대기 중'],
  [/캐릭터에게 판결받기/g, '판결 글쓰기'],
];

function replaceText(value) {
  return TEXT_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value || ''));
}

function normalizeTextNodes(root = document.body) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const next = replaceText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  });

  document.querySelectorAll('[aria-label], [title], [placeholder]').forEach(el => {
    ['aria-label', 'title', 'placeholder'].forEach(attr => {
      const current = el.getAttribute(attr);
      if (!current) return;
      const next = replaceText(current);
      if (next !== current) el.setAttribute(attr, next);
    });
  });
}

let normalizeTimer = null;
function scheduleNormalize() {
  clearTimeout(normalizeTimer);
  normalizeTimer = setTimeout(() => normalizeTextNodes(), 40);
}

document.addEventListener('click', guardWriteEntry, true);
document.addEventListener('click', guardWriteLoginButton, true);
window.addEventListener('hashchange', scheduleNormalize);
window.addEventListener('sosoking:extensions-ready', scheduleNormalize);
document.addEventListener('DOMContentLoaded', scheduleNormalize);

new MutationObserver(scheduleNormalize).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

scheduleNormalize();
