import { escHtml, formatTime } from '../utils/helpers.js';

const TYPE_META = {
  judgment: { css: 'judgment', label: '판결', icon: '⚖️' },
  consult: { css: 'consult', label: '상담', icon: '🫠' },
  vote: { css: 'vote', label: '토론', icon: '🗳️' },
  drip: { css: 'drip', label: '드립', icon: '😂' },
};

function subtype(post) {
  if (TYPE_META[post.subtype]) return post.subtype;
  if (post.modules?.consult?.enabled) return 'consult';
  if (post.modules?.drip?.enabled) return 'drip';
  if (post.modules?.vote?.voteMode === 'pros_cons') return 'vote';
  return 'judgment';
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim(), location.origin);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', location.hostname].includes(url.hostname))) return url.toString();
  } catch {}
  return '';
}

function plainText(value) {
  const source = String(value || '');
  if (!/<[a-z][\s\S]*>/i.test(source)) return source;
  const element = document.createElement('div');
  element.innerHTML = source;
  return element.textContent || '';
}

function cardTitle(post) {
  const title = plainText(post.title || '').trim();
  const desc = plainText(post.desc || '').trim();
  return (title || desc || '제목 없음').slice(0, 120);
}

function cardDesc(post) {
  if (subtype(post) === 'drip') return '';
  return plainText(post.desc || '').trim().slice(0, 220);
}

export function renderFeedCard(post) {
  const meta = TYPE_META[subtype(post)];
  const images = (Array.isArray(post.images) ? post.images : []).map(safeUrl).filter(Boolean).slice(0, 20);
  const title = cardTitle(post);
  const desc = cardDesc(post);
  const reactions = Number(post.reactions?.total || 0);
  const comments = Number(post.commentCount || 0);
  const views = Number(post.viewCount || 0);
  const time = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  return `
    <article class="card card--hover feed-card feed-card--${meta.css}" data-feed-open="${escHtml(post.id)}">
      <div class="feed-card__header">
        <div class="feed-card__content">
          <div class="feed-card__badge-row">
            <span class="feed-card__type-badge feed-card__type-badge--${meta.css}">${meta.icon} ${meta.label}</span>
            ${(post.tags || []).slice(0, 1).map(tag => `<span class="tag">#${escHtml(tag)}</span>`).join('')}
          </div>
          <h3 class="feed-card__title line-clamp-2">${escHtml(title)}</h3>
          ${desc ? `<p class="feed-card__desc line-clamp-2">${escHtml(desc)}</p>` : ''}
          <div class="feed-card__meta">
            <span>${escHtml(post.authorName || '익명')}</span><span class="feed-card__meta-dot"></span><span>${time}</span>
            ${views ? `<span class="feed-card__meta-dot"></span><span>👁 ${views.toLocaleString()}</span>` : ''}
            ${reactions ? `<span class="feed-card__meta-dot"></span><span>❤️ ${reactions.toLocaleString()}</span>` : ''}
            ${comments ? `<span class="feed-card__meta-dot"></span><span>💬 ${comments.toLocaleString()}</span>` : ''}
          </div>
        </div>
        ${images.length === 1 ? `<div class="feed-card__thumb"><img src="${escHtml(images[0])}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>` : ''}
      </div>
      ${images.length > 1 ? `<div class="feed-card__images feed-card__images--${Math.min(images.length, 3)}">${images.slice(0, 3).map(src => `<img class="feed-card__img" src="${escHtml(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>` : ''}
      <div class="feed-card__actions">
        <button class="feed-share-btn" type="button" data-feed-share="${escHtml(post.id)}" data-feed-title="${escHtml(title)}">공유</button>
      </div>
    </article>`;
}

export function renderSkeletonCards(count = 3) {
  return Array.from({ length: count }, () => '<div class="skeleton-card"><div class="skeleton-body"><div class="skeleton skeleton-line--title"></div><div class="skeleton skeleton-line--desc"></div><div class="skeleton skeleton-line--meta"></div></div><div class="skeleton skeleton-thumb"></div></div>').join('');
}

document.addEventListener('click', async event => {
  const share = event.target.closest?.('[data-feed-share]');
  if (share) {
    event.preventDefault();
    event.stopPropagation();
    const url = `${location.origin}/p/${encodeURIComponent(share.dataset.feedShare || '')}`;
    try {
      if (navigator.share) await navigator.share({ title: share.dataset.feedTitle || '소소킹', url });
      else await navigator.clipboard.writeText(url);
    } catch {}
    return;
  }
  const card = event.target.closest?.('[data-feed-open]');
  if (card) window.navigate?.(`/detail/${card.dataset.feedOpen}`);
}, true);
