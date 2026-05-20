import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const MODULE_LABELS = {
  general: '피드 글',
  vote: '투표/판정',
  naming: '미친작명소',
  acrostic: '삼행시',
  fill: '빈칸 채우기',
  relay: '릴레이',
  quiz: '퀴즈',
};

function getDetailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function detectSubtype(post) {
  if (post.subtype && MODULE_LABELS[post.subtype]) return post.subtype;
  const modules = post.modules || {};
  if (modules.vote?.enabled) return 'vote';
  if (modules.naming?.enabled) return 'naming';
  if (modules.acrostic?.enabled) return 'acrostic';
  if (modules.fill?.enabled) return 'fill';
  if (modules.relay?.enabled) return 'relay';
  if (modules.quiz?.enabled) return 'quiz';
  return 'general';
}

function hasInteractiveModule(post) {
  const modules = post.modules || {};
  return !!(
    modules.vote?.enabled ||
    modules.naming?.enabled ||
    modules.acrostic?.enabled ||
    modules.fill?.enabled ||
    modules.relay?.enabled ||
    modules.quiz?.enabled
  );
}

async function cleanupMultiDetail() {
  const postId = getDetailId();
  if (!postId) return;
  const page = document.getElementById('page-content');
  if (!page) return;
  const badge = page.querySelector('.feed-card__type-badge');
  if (!badge) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.type !== 'multi') return;

    const subtype = detectSubtype(post);
    badge.textContent = MODULE_LABELS[subtype] || '피드 글';
    badge.classList.add('feed-card__type-badge--multi-clean');

    const root = page.querySelector('[data-multi-modules-root]');
    if (!hasInteractiveModule(post)) {
      root?.remove();
      return;
    }

    root?.querySelector('.multi-detail-root__title')?.replaceChildren(document.createTextNode(`${MODULE_LABELS[subtype] || '참여'} 기능`));
    const desc = root?.querySelector('.multi-detail-root__desc');
    if (desc) desc.textContent = '이 글 형식에 맞는 참여 기능입니다.';

    root?.querySelectorAll('.multi-detail-module').forEach(module => {
      const kind = module.dataset.multiModule;
      if (kind && kind !== subtype) module.remove();
    });
  } catch (error) {
    console.warn('[multi-detail-cleanup] failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(cleanupMultiDetail, 260);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 900);
