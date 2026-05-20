import { db } from './firebase.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { formatTime } from './utils/helpers.js';

const LABELS = {
  general: '일반글', vote: '투표/판정', ox: '투표/판정', fill: '빈칸 채우기', naming: '미친작명소',
  acrostic: '삼행시', relay: '막장릴레이', quiz: '미친퀴즈', anonymous: '익명비밀글'
};

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function typeKey(post) {
  if (post.subtype === 'ox') return 'vote';
  if (post.subtype && LABELS[post.subtype]) return post.subtype;
  const m = post.modules || {};
  if (post.anonymous || m.anonymous?.enabled) return 'anonymous';
  if (m.fill?.enabled) return 'fill';
  if (m.vote?.enabled) return 'vote';
  if (m.naming?.enabled) return 'naming';
  if (m.acrostic?.enabled) return 'acrostic';
  if (m.relay?.enabled) return 'relay';
  if (m.quiz?.enabled) return 'quiz';
  return 'general';
}

async function fetchRecent(n = 6) {
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n + 6)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden).slice(0, n);
}

function renderList(posts) {
  if (!posts.length) return '';
  return `
    <div class="home-section-header">
      <span class="home-section-title">최근 피드</span>
      <button class="home-section-more home-section-more--button" data-home-more-feed>더 보기</button>
    </div>
    <div class="home-compact-feed-list">
      ${posts.map(post => `
        <button type="button" class="home-compact-feed-item" data-home-post-id="${esc(post.id)}">
          <span class="home-compact-feed-item__badge">${esc(LABELS[typeKey(post)] || '피드')}</span>
          <span class="home-compact-feed-item__title">${esc(post.title || '제목 없음')}</span>
          <span class="home-compact-feed-item__meta">${esc(formatTime(post.createdAt?.toDate?.() || post.createdAt))} · 💬 ${Number(post.commentCount || 0)}</span>
        </button>`).join('')}
    </div>`;
}

async function compactHomeRecent() {
  if ((location.hash || '#/').split('?')[0] !== '#/' && location.hash) return;
  const grid = document.querySelector('.home-recent-grid');
  if (!grid || grid.dataset.compactReady === '1') return;
  const section = grid.previousElementSibling;
  const wrap = document.createElement('div');
  wrap.dataset.compactHomeRecent = '1';
  try {
    const posts = await fetchRecent(6);
    wrap.innerHTML = renderList(posts);
    if (section) section.remove();
    grid.replaceWith(wrap);
    wrap.querySelector('[data-home-more-feed]')?.addEventListener('click', () => navigate('/feed'));
    wrap.querySelectorAll('[data-home-post-id]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/detail/${btn.dataset.homePostId}`));
    });
  } catch (error) {
    console.warn('[home-feed-compact-fix] failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(compactHomeRecent, 200);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 800);
