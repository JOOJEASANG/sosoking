import { navigate } from '../router.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { renderPartyBadge, renderPresidentCrown } from '../utils/party-badge.js';

const TYPE_META = {
  citizen_speech: { cat: 'multi',  catLabel: '시민발언', icon: '🗣️', label: '시민발언' },
  ai_judge:       { cat: 'golra',  catLabel: '헌재기록', icon: '⚖️', label: '헌재기록' },
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

function getTypeMeta(post) {
  if (post.feedType === 'ai_judge' || post.type === 'ai_judge') return TYPE_META.ai_judge;
  return TYPE_META.citizen_speech;
}

function displayTitle(post) {
  const title = plainText(post.title || '').trim();
  const desc = plainText(post.desc || post.situation || '').trim();
  return title || desc || '제목 없음';
}

function displayDesc(post) {
  return plainText(post.desc || post.situation || '').slice(0, 220);
}

function renderHistoryBadges(post) {
  if (!post.isHistoryIssue) return '';
  const day = post.historyDay ? `Day ${String(post.historyDay).padStart(3, '0')}` : '오늘의 역사';
  const era = post.historyEra || '새공화국 기록';
  const year = post.motifYear ? `${post.motifYear}년 모티브` : '역사 모티브';
  return `
    <span class="feed-card__type-badge feed-card__type-badge--multi">📜 ${escHtml(day)}</span>
    <span class="tag">${escHtml(era)}</span>
    <span class="tag">${escHtml(year)}</span>`;
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
    <article class="card card--hover feed-card feed-card--${meta.cat}" data-id="${escAttr(post.id)}" onclick="navigate('/detail/${escAttr(post.id)}')">
      <div class="feed-card__header">
        <div class="feed-card__content">
          <div class="feed-card__badge-row">
            <span class="feed-card__type-badge feed-card__type-badge--${meta.cat}">
              ${meta.icon} ${escHtml(meta.label)}
            </span>
            ${renderHistoryBadges(post)}
            ${firstTag ? `<span class="tag">#${firstTag}</span>` : ''}
          </div>
          <h3 class="feed-card__title line-clamp-2">${escHtml(title)}</h3>
          ${post.eventQuestion ? `<p class="feed-card__desc line-clamp-2"><b>쟁점</b> · ${escHtml(String(post.eventQuestion).slice(0, 120))}</p>` : ''}
          ${desc ? `<p class="feed-card__desc line-clamp-2">${escHtml(desc)}</p>` : ''}
          <div class="feed-card__meta">
            <span>${renderPresidentCrown(post.authorId)}${renderPartyBadge(post.partyId)}${post.rankEmoji ? `<span class="comment-rank-emoji" title="정치 등급">${escHtml(post.rankEmoji)}</span>` : ''}${escHtml(post.authorName || '익명')}</span>
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
      ${images.length > 3 ? `<div class="feed-card__image-count">사진 ${images.length}장</div>` : ''}
      ${temp > 0 ? `<div class="feed-temp-bar" style="--temp-pct:${temp}%;--temp-color:${tempColor}" title="참여 온도 ${temp}°C"></div>` : ''}
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
      window.showToast?.('링크가 복사됐어요', 'success');
    }
  } catch {
    // intentionally ignored
  }
}, true);
