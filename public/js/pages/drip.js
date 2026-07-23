/* drip.js — 드립방 전용 무한스크롤 페이지 */
import { db } from '../firebase.js';
import { navigate } from '../router.js';
import { formatTime, escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs, startAfter, where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { setMeta } from '../utils/seo.js';

let lastDoc = null;
let hasMore = true;
let loading = false;
let totalCount = 0;
let observer = null;

function isDrip(post) {
  return post.subtype === 'drip' || post.modules?.drip?.enabled === true || post.cat === 'usgyo';
}

function renderDripItem(post, index) {
  const reactions = post.reactions?.total || 0;
  const comments = post.commentCount || 0;
  const time = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  const text = escHtml((post.title || post.desc || '').slice(0, 200) || '(내용 없음)');
  const rank = index <= 3 ? `drip-item__rank--${index}` : 'drip-item__rank--rest';

  return `
    <li class="drip-item" data-id="${escHtml(post.id)}">
      <span class="drip-item__rank ${rank}">${index}</span>
      <span class="drip-item__text">${text}</span>
      <span class="drip-item__meta">
        ${reactions ? `<span>🔥 ${reactions}</span>` : ''}
        ${comments ? `<span>💬 ${comments}</span>` : ''}
        <span>${time}</span>
      </span>
    </li>`;
}

function bindClicks(listEl) {
  listEl.querySelectorAll('.drip-item[data-id]:not([data-bound])').forEach(el => {
    el.dataset.bound = '1';
    el.addEventListener('click', () => navigate(`/detail/${el.dataset.id}`));
  });
}

async function loadMore(listEl, sentinelEl) {
  if (loading || !hasMore) return;
  loading = true;

  try {
    const constraints = [
      where('cat', '==', 'usgyo'),
      orderBy('createdAt', 'desc'),
      limit(30),
    ];
    if (lastDoc) constraints.push(startAfter(lastDoc));

    const snap = await getDocs(query(collection(db, 'feeds'), ...constraints));
    const posts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.hidden && isDrip(p));

    lastDoc = snap.docs[snap.docs.length - 1] || null;
    hasMore = snap.docs.length >= 30;

    if (posts.length === 0 && totalCount === 0) {
      listEl.innerHTML = `
        <li class="drip-empty">
          <div class="drip-empty__icon">🤣</div>
          <div class="drip-empty__msg">아직 드립이 없어요.<br>첫 한줄을 올려보세요!</div>
        </li>`;
      sentinelEl.hidden = true;
      if (observer) observer.disconnect();
      return;
    }

    posts.forEach(post => {
      totalCount++;
      listEl.insertAdjacentHTML('beforeend', renderDripItem(post, totalCount));
    });
    bindClicks(listEl);

    if (!hasMore) {
      sentinelEl.hidden = true;
      if (observer) observer.disconnect();
    }
  } catch (err) {
    console.error('[drip] loadMore error:', err);
  } finally {
    loading = false;
  }
}

export async function renderDrip() {
  lastDoc = null;
  hasMore = true;
  loading = false;
  totalCount = 0;
  if (observer) { observer.disconnect(); observer = null; }

  const el = document.getElementById('page-content');
  if (!el) return;

  setMeta('드립방 · 소소킹 한줄 모음');

  el.innerHTML = `
    <div class="drip-page page-enter">
      <div class="drip-header">
        <div class="drip-header__info">
          <h1 class="drip-header__title">🤣 드립방</h1>
          <p class="drip-header__desc">제목 없이 한줄만 올리는 공간</p>
        </div>
        <button class="drip-header__write-btn" id="drip-write-btn">+ 한줄 올리기</button>
      </div>
      <ul class="drip-list" id="drip-list"></ul>
      <div class="drip-sentinel" id="drip-sentinel">
        <div class="drip-spinner"></div>
      </div>
    </div>`;

  const listEl = el.querySelector('#drip-list');
  const sentinelEl = el.querySelector('#drip-sentinel');

  el.querySelector('#drip-write-btn').addEventListener('click', () => {
    navigate('/write?type=multi&preset=drip');
  });

  observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadMore(listEl, sentinelEl);
  }, { rootMargin: '200px' });

  observer.observe(sentinelEl);
  await loadMore(listEl, sentinelEl);
}
