/* final-consistency-20260705.js
   문구 통일, 글쓰기 진입 가드, 레거시 inline handler 보정
*/
import { auth } from './firebase.js';
import { navigate } from './router.js';

const DEFAULT_WRITE_PATH = '/write?type=multi&preset=drip';
const WRITE_PRESET_BY_ROOM = {
  'write-judgment': 'vote',
  'write-consult': 'drip',
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
  if (value.startsWith('/write')) return value
    .replace('preset=judgment', 'preset=vote')
    .replace('preset=consult', 'preset=drip');
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
    const preset = activeType && ['vote', 'drip'].includes(activeType) ? activeType : 'drip';
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
  [/판결 · 상담 · 토론 · 드립/g, '토론소 · 드립소'],
  [/4가지로 놀아요/g, '두 곳에서 놀아요'],
  [/사소한 이야기도 8명의 AI 캐릭터가 끼어들면 재미있는 참여 콘텐츠가 됩니다\./g, '웃긴 토론과 드립으로 소소한 이야기를 콘텐츠로 바꿉니다.'],
  [/토론/g, '토론소'],
  [/드립/g, '드립소'],
  [/\+ 글 열기/g, '+ 글쓰기'],
  [/글 열기/g, '글쓰기'],
  [/콘텐츠 쓰기/g, '글쓰기'],
  [/일반게시판 글쓰기/g, '소소킹 글쓰기'],
  [/게임형 커뮤니티/g, '참여형 커뮤니티'],
  [/8명 캐릭터 대기중/g, '8명 캐릭터 대기 중'],
  [/캐릭터에게 판결받기/g, '드립소 열기'],
  [/캐릭터 댓글과 유저 반응은 항상 켜져 있습니다\./g, '유저 댓글과 반응으로 같이 참여할 수 있습니다.'],
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

  document.querySelectorAll('.home-onboard__room--judgment, .home-onboard__room--consult').forEach(el => {
    el.style.display = 'none';
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
