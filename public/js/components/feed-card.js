import { navigate } from '../router.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { renderPartyBadge, renderPresidentCrown } from '../utils/party-badge.js';

const TYPE_META = {
  tournament:   { cat: 'multi',  catLabel: '\uB05D\uD310\uC655', icon: '🏆', label: '\uB05D\uD310\uC655' },
  collect:      { cat: 'multi',  catLabel: '\uBAA8\uC74C\uBC29', icon: '📌', label: '\uBAA8\uC74C\uBC29' },
  vote:         { cat: 'multi',  catLabel: '\uD1A0\uB860\uBC29', icon: '🗳️', label: '\uD1A0\uB860\uBC29' },
  drip:         { cat: 'multi',  catLabel: '\uB4DC\uB9BD\uBC29', icon: '🤣', label: '\uB4DC\uB9BD\uBC29' },
  quiz:         { cat: 'multi',  catLabel: '\uD034\uC988\uBC29', icon: '🧠', label: '\uD034\uC988\uBC29' },
  multi:        { cat: 'multi',  catLabel: '\uBAA8\uC74C\uBC29', icon: '📌', label: '\uBAA8\uC74C\uBC29' },
  ai_judge:     { cat: 'golra',  catLabel: 'AI\uD310\uC0AC', icon: '⚖️', label: 'AI\uD310\uC0AC' },
  ai_translate: { cat: 'usgyo',  catLabel: 'AI\uBC88\uC5ED\uC0AC', icon: '🌍', label: 'AI\uBC88\uC5ED\uC0AC' },
  ai_naming:    { cat: 'usgyo',  catLabel: 'AI\uC791\uBA85\uC18C', icon: '🎭', label: 'AI\uC791\uBA85\uC18C' },
};

function escAttr(value) {
  return escHtml(value).replace(/`/g, '&#96;');
}

function plainText(value) {
  const source = String(value || '');
  if (!/<[a-z][\s\S]*>/i.test(source)) return source;
  const tmp = document.createElement('div');
  tmp.innerHTML = source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n');
  return (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function safeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /[\s"'<>]/.test(raw)) return '';
  try {
    const url = new URL(raw, window.location.origin);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (url.protocol === 'http:' && url.hostname !== window.location.hostname && url.hostname !== 'localhost') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function getSafeImages(images) {
  return (Array.isArray(images) ? images : []).map(safeImageUrl).filter(Boolean).slice(0, 20);
}

function safeTag(value) {
  return escHtml(String(value || '').replace(/^#/, '').trim().slice(0, 24));
}

function getMultiSubtype(post) {
  if (post.modules?.tournament?.enabled || post.subtype === 'tournament') return 'tournament';
  if (post.subtype && TYPE_META[post.subtype]) return post.subtype;
  if (post.feedType && TYPE_META[post.feedType]) return post.feedType;
  if (post.modules?.vote?.enabled) return 'vote';
  if (post.modules?.drip?.enabled) return 'drip';
  if (post.modules?.quiz?.enabled) return 'quiz';
  if (post.modules?.collect?.enabled) return 'collect';
  return 'collect';
}

function getTypeMeta(post) {
  if (post.type === 'multi') {
    const subtype = getMultiSubtype(post);
    return TYPE_META[subtype] || TYPE_META.collect;
  }
  return TYPE_META[post.type] || { cat: 'multi', catLabel: '', icon: '📝', label: '\uC77C\uBC18' };
}

function displayTitle(post) {
  const title = plainText(post.title || '').trim();
  const desc = plainText(post.desc || '').trim();
  return title || desc || '\uC81C\uBAA9 \uC5C6\uC74C';
}

function displayDesc(post) {
  return plainText(post.desc || '').slice(0, 220);
}

function renderModuleChips(post) {
  if (post.type !== 'multi' || !post.modules) return '';
  const labels = [];
  if (post.anonymous || post.modules.anonymous?.enabled) labels.push('\uC775\uBA85');
  if (post.modules.tournament?.enabled) labels.push('\uD1A0\uB108\uBA3C\uD2B8');
  if (!labels.length) return '';
  return `<div class="feed-card__multi-chips">${labels.map(label => `<span>${escHtml(label)}</span>`).join('')}</div>`;
}

export function renderFeedCard(post) {
  const meta = getTypeMeta(post);
  const images = getSafeImages(post.images);
  const timeStr = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  const reactions = post.reactions || {};
  const totalReactions = reactions.total || 0;
  const commentCount = post.commentCount || 0;
  const viewCount = post.viewCount || 0;
  const temp = Math.min(100, Math.round((totalReactions * 2 + commentCount * 3) / 2));
  const tempColor = temp >= 70 ? '#FF4422' : temp >= 40 ? '#FF8800' : temp >= 20 ? '#FFAA00' : '#4F8EF7';
  const firstTag = post.tags?.length ? safeTag(post.tags[0]) : '';
  const desc = displayDesc(post);
  const title = displayTitle(post).slice(0, 120);

  return `
    <article class="card card--hover feed-card feed-card--${meta.cat}" onclick="navigate('/detail/${escAttr(post.id)}')">
      <div class="feed-card__header">
        <div class="feed-card__content">
          <div class="feed-card__badge-row">
            <span class="feed-card__type-badge feed-card__type-badge--${meta.cat}">
              ${meta.icon} ${escHtml(meta.label)}
            </span>
            ${post.isUserCreated ? `<span class="tag" style="background:var(--color-primary-bg);color:var(--color-primary);font-size:10px">👤 유저 주제</span>` : ''}
            ${firstTag ? `<span class="tag">#${firstTag}</span>` : ''}
          </div>
          <h3 class="feed-card__title line-clamp-2">${escHtml(title)}</h3>
          ${desc ? `<p class="feed-card__desc line-clamp-2">${escHtml(desc)}</p>` : ''}
          ${renderModuleChips(post)}
          <div class="feed-card__meta">
            <span>${renderPresidentCrown(post.authorId)}${renderPartyBadge(post.partyId)}${post.rankEmoji ? `<span class="comment-rank-emoji" title="\uC815\uCE58 \uB4F1\uAE09">${escHtml(post.rankEmoji)}</span>` : ''}${escHtml(post.authorName || '\uC775\uBA85')}</span>
            <span class="feed-card__meta-dot"></span>
            <span>${timeStr}</span>
            ${viewCount ? `<span class="feed-card__meta-dot"></span><span>👁 ${Number(viewCount || 0).toLocaleString()}</span>` : ''}
            ${totalReactions ? `<span class="feed-card__meta-dot"></span><span>❤️ ${Number(totalReactions || 0).toLocaleString()}</span>` : ''}
            ${commentCount ? `<span class="feed-card__meta-dot"></span><span>💬 ${Number(commentCount || 0).toLocaleString()}</span>` : ''}
          </div>
        </div>
        ${images.length === 1 ? `<div class="feed-card__thumb"><img src="${escAttr(images[0])}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>` : ''}
      </div>
      ${images.length > 1 ? renderImageGrid(images) : ''}
      ${images.length > 3 ? `<div class="feed-card__image-count">\uC0AC\uC9C4 ${images.length}\uC7A5</div>` : ''}
      ${temp > 0 ? `<div class="feed-temp-bar" style="--temp-pct:${temp}%;--temp-color:${tempColor}" title="\uCC38\uC5EC \uC628\uB3C4 ${temp}°C"></div>` : ''}
      <div class="feed-card__actions" onclick="event.stopPropagation()">
        <button class="feed-share-btn" type="button" data-feed-share="${escAttr(post.id)}" data-feed-title="${escAttr(title || '소소킹')}">🔗 공유</button>
      </div>
    </article>`;
}

function renderImageGrid(images) {
  const shown = images.slice(0, 3);
  return `
    <div class="feed-card__images feed-card__images--${Math.min(shown.length, 3)}">
      ${shown.map(src => `<img class="feed-card__img" src="${escAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('')}
    </div>`;
}

export function renderSkeletonCards(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-body">
        <div class="skeleton skeleton-line--title"></div>
        <div class="skeleton skeleton-line--desc"></div>
        <div class="skeleton skeleton-line--desc2"></div>
        <div class="skeleton skeleton-line--meta"></div>
      </div>
      <div class="skeleton skeleton-thumb"></div>
    </div>`).join('');
}

document.addEventListener('click', async event => {
  const btn = event.target.closest?.('[data-feed-share]');
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  const id = btn.dataset.feedShare || '';
  const title = btn.dataset.feedTitle || '소소킹';
  const url = `${location.origin}/p/${encodeURIComponent(id)}`;
  try {
    if (navigator.share) await navigator.share({ title, url });
    else {
      await navigator.clipboard.writeText(url);
      window.showToast?.('\uB9C1\uD06C\uAC00 \uBCF5\uC0AC\uB410\uC5B4\uC694', 'success');
    }
  } catch {
    // intentionally ignored
  }
}, true);
