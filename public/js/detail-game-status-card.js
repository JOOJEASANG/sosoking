import { db } from './firebase.js';
import { collection, doc, getCountFromServer, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const KIND_INFO = {
  vote: {
    icon: '🗳️',
    title: '투표 현황',
    guide: '마음에 드는 선택지에 투표하고 댓글로 이유를 남겨보세요.',
    reward: '투표 참여 +1P',
    collection: null,
  },
  quiz: {
    icon: '🧠',
    title: '퀴즈 현황',
    guide: '정답을 맞히면 해설이 열리고 정답 보상을 받을 수 있어요.',
    reward: '정답 +5P',
    collection: null,
  },
  naming: {
    icon: '😜',
    title: '작명 현황',
    guide: '가장 웃긴 이름을 남기고 반응을 받아 베스트에 도전하세요.',
    reward: '참여 +3P · 답글 +2P · 반응 받음 +1P',
    collection: 'multi_naming',
  },
  acrostic: {
    icon: '✍️',
    title: '삼행시 현황',
    guide: '제시어로 센스 있는 한 줄들을 완성해보세요.',
    reward: '참여 +3P · 답글 +2P · 반응 받음 +1P',
    collection: 'multi_acrostic',
  },
  fill: {
    icon: '🧩',
    title: '빈칸 현황',
    guide: '빈칸마다 글자를 채워 가장 재밌는 답을 만들어보세요.',
    reward: '참여 +3P · 답글 +2P · 반응 받음 +1P',
    collection: 'multi_fill',
  },
  relay: {
    icon: '🎭',
    title: '릴레이 현황',
    guide: '앞 문장 뒤로 이야기를 이어 쓰고 베스트 릴레이에 도전하세요.',
    reward: '참여 +3P · 답글 +2P · 반응 받음 +1P',
    collection: 'multi_relay',
  },
};

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function getDetailId() {
  const hash = window.location.hash || '';
  const match = hash.match(/#\/detail\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function activeKind(post = {}) {
  const modules = post.modules || {};
  if (modules.vote?.enabled) return 'vote';
  if (modules.quiz?.enabled) return 'quiz';
  if (modules.naming?.enabled) return 'naming';
  if (modules.acrostic?.enabled) return 'acrostic';
  if (modules.fill?.enabled) return 'fill';
  if (modules.relay?.enabled) return 'relay';
  return post.subtype && KIND_INFO[post.subtype] ? post.subtype : '';
}

function voteTotal(post) {
  return (post.modules?.vote?.options || []).reduce((sum, option) => sum + Number(option.votes || 0), 0);
}

async function countSubcollection(postId, kind) {
  const info = KIND_INFO[kind];
  if (!info?.collection) return 0;
  try {
    const snap = await getCountFromServer(collection(db, 'feeds', postId, info.collection));
    return Number(snap.data().count || 0);
  } catch (error) {
    console.warn('[detail-game-status] count failed', kind, error);
    return 0;
  }
}

async function getStats(postId, post, kind) {
  if (kind === 'vote') {
    return {
      primaryLabel: '총 투표',
      primaryValue: `${voteTotal(post)}표`,
      secondaryLabel: '댓글',
      secondaryValue: `${Number(post.commentCount || 0)}개`,
      extra: '',
    };
  }

  if (kind === 'quiz') {
    const quiz = post.modules?.quiz || {};
    const first = quiz.firstCorrect?.authorName ? `첫 정답자 ${quiz.firstCorrect.authorName}` : '첫 정답자 대기중';
    return {
      primaryLabel: '정답자',
      primaryValue: `${Number(quiz.correctCount || 0)}명`,
      secondaryLabel: '상태',
      secondaryValue: first,
      extra: '',
    };
  }

  const count = await countSubcollection(postId, kind);
  return {
    primaryLabel: '참여글',
    primaryValue: `${count}개`,
    secondaryLabel: '댓글/반응',
    secondaryValue: '항상 가능',
    extra: '',
  };
}

function renderCard(kind, stats) {
  const info = KIND_INFO[kind];
  if (!info) return '';
  return `
    <div class="detail-game-status-card" data-detail-game-status-card="1">
      <div class="detail-game-status-card__top">
        <div class="detail-game-status-card__title"><span>${info.icon}</span><b>${esc(info.title)}</b></div>
        <div class="detail-game-status-card__reward">${esc(info.reward)}</div>
      </div>
      <div class="detail-game-status-card__stats">
        <div><small>${esc(stats.primaryLabel)}</small><b>${esc(stats.primaryValue)}</b></div>
        <div><small>${esc(stats.secondaryLabel)}</small><b>${esc(stats.secondaryValue)}</b></div>
      </div>
      <div class="detail-game-status-card__guide">${esc(info.guide)}</div>
    </div>`;
}

function findInsertTarget() {
  return document.querySelector('[data-multi-modules-root]') || document.querySelector('.detail-body');
}

async function enhanceDetailStatus() {
  const postId = getDetailId();
  if (!postId) return;
  if (document.querySelector('[data-detail-game-status-card]')) return;
  const root = document.getElementById('page-content');
  if (!root || !root.querySelector('.feed-card__type-badge')) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.type !== 'multi') return;
    const kind = activeKind(post);
    if (!kind || !KIND_INFO[kind]) return;
    const stats = await getStats(postId, post, kind);
    const html = renderCard(kind, stats);
    const target = findInsertTarget();
    if (!target) return;
    if (target.matches('[data-multi-modules-root]')) target.insertAdjacentHTML('beforebegin', html);
    else target.insertAdjacentHTML('afterend', html);
  } catch (error) {
    console.warn('[detail-game-status] enhance failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhanceDetailStatus, 220);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
