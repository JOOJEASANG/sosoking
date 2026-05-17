import { navigate } from './router.js';
import { toast } from './components/toast.js';

const COPY_REPLACEMENTS = [
  ['골라봐', '대표 놀이'],
  ['웃겨봐', '대표 놀이'],
  ['도전봐', '대표 놀이'],
  ['밸런스게임', '골라킹'],
  ['민심투표', '골라킹'],
  ['선택지배틀', '골라킹'],
  ['삼행시짓기', '초성게임'],
  ['제시어로 삼행시 도전', '초성을 보고 떠오르는 단어를 댓글로 참여'],
  ['막장릴레이', '막장킹'],
  ['한 문장씩 이어가는 스토리', '한 문장씩 터지는 막장 전개'],
];

const REPRESENTATIVE_TYPES = new Set(['vote', 'naming', 'initial_game', 'ox', 'relay']);
const HIDE_TYPES = new Set(['balance', 'battle', 'drip', 'random_battle']);

function getParams() {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.split('?')[1] : '';
  return new URLSearchParams(query);
}

function isWritePage() {
  return (window.location.hash || '').startsWith('#/write');
}

function isAcrosticRoute() {
  return isWritePage() && getParams().get('type') === 'acrostic';
}

function hasMissionKeyword() {
  const keyword = (getParams().get('keyword') || '').trim();
  const len = [...keyword].length;
  return len >= 3 && len <= 6;
}

function guardAcrosticRoute() {
  if (!isAcrosticRoute()) return;
  if (hasMissionKeyword()) return;
  toast.warn('행시는 미션에서만 참여할 수 있어요');
  navigate('/mission');
}

function replaceTextNode(node) {
  let text = node.nodeValue;
  let changed = false;
  for (const [from, to] of COPY_REPLACEMENTS) {
    if (text.includes(from)) {
      text = text.split(from).join(to);
      changed = true;
    }
  }
  if (changed) node.nodeValue = text;
}

function replaceAttributes(el) {
  for (const attr of ['placeholder', 'title', 'aria-label']) {
    if (!el.hasAttribute?.(attr)) continue;
    let value = el.getAttribute(attr);
    let changed = false;
    for (const [from, to] of COPY_REPLACEMENTS) {
      if (value.includes(from)) {
        value = value.split(from).join(to);
        changed = true;
      }
    }
    if (changed) el.setAttribute(attr, value);
  }
}

function patchCardToInitialGame(card) {
  card.dataset.type = 'initial_game';
  const icon = card.querySelector('.type-select-card__icon');
  const title = card.querySelector('.type-select-card__name');
  const desc = card.querySelector('.type-select-card__desc');
  if (icon) icon.textContent = '🔤';
  if (title) title.textContent = '초성게임';
  if (desc) desc.textContent = '초성을 보고 떠오르는 단어를 댓글로 참여';
}

function patchCardToVote(card) {
  card.dataset.type = 'vote';
  const icon = card.querySelector('.type-select-card__icon');
  const title = card.querySelector('.type-select-card__name');
  const desc = card.querySelector('.type-select-card__desc');
  if (icon) icon.textContent = '🗳️';
  if (title) title.textContent = '골라킹';
  if (desc) desc.textContent = '선택지를 올리고 사람들의 선택을 받아요';
}

function normalizeWriteTypeCards(root = document.body) {
  if (!isWritePage() || !root) return;
  const cards = [...document.querySelectorAll('.type-select-card')];
  const seen = new Set();

  for (const card of cards) {
    const name = card.querySelector('.type-select-card__name')?.textContent || '';
    let type = card.dataset.type;

    if (type === 'acrostic' || name.includes('삼행시')) {
      patchCardToInitialGame(card);
      type = 'initial_game';
    }

    if (['balance', 'battle'].includes(type)) {
      patchCardToVote(card);
      type = 'vote';
    }

    if (type === 'relay' || name.includes('막장릴레이')) {
      const title = card.querySelector('.type-select-card__name');
      const desc = card.querySelector('.type-select-card__desc');
      if (title) title.textContent = '막장킹';
      if (desc) desc.textContent = '한 문장씩 터지는 막장 전개';
    }

    if (HIDE_TYPES.has(type)) {
      card.style.display = 'none';
      continue;
    }

    if (!REPRESENTATIVE_TYPES.has(type)) {
      card.style.display = 'none';
      continue;
    }

    if (seen.has(type)) {
      card.style.display = 'none';
      continue;
    }
    seen.add(type);
    card.style.display = '';
  }

  document.querySelectorAll('.type-select-grid').forEach(grid => {
    const visible = [...grid.children].some(child => child.style.display !== 'none');
    const group = grid.closest('div[style*="margin-bottom"]');
    if (group) group.style.display = visible ? '' : 'none';
  });
}

function normalizeCopy(root = document.body) {
  if (!root || !isWritePage()) return;
  if (root.nodeType === Node.TEXT_NODE) {
    replaceTextNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root !== document.body) return;

  replaceAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
      return COPY_REPLACEMENTS.some(([from]) => node.nodeValue.includes(from))
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceTextNode);
  root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach(replaceAttributes);
  normalizeWriteTypeCards(root);
}

function run() {
  guardAcrosticRoute();
  normalizeCopy();
}

let timer = null;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(run, 40);
});

if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
window.addEventListener('hashchange', () => setTimeout(run, 80));
setTimeout(run, 200);
