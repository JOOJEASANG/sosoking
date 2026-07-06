import { navigate } from '../router.js';
import { escHtml, formatTime } from '../utils/helpers.js';

const TYPE_META = {
  judgment: { cat: 'judgment', catLabel: '판결', icon: '⚖️', label: '판결' },
  consult:  { cat: 'consult',  catLabel: '상담', icon: '🫠', label: '상담' },
  vote:     { cat: 'vote',     catLabel: '토론', icon: '🗳️', label: '토론' },
  drip:     { cat: 'drip',     catLabel: '드립', icon: '😂', label: '드립' },

  // 예전 데이터 호환: 화면에는 4게임 이름으로만 표시합니다.
  multi:        { cat: 'judgment', catLabel: '판결', icon: '⚖️', label: '판결' },
  general:      { cat: 'judgment', catLabel: '판결', icon: '⚖️', label: '판결' },
  collect:      { cat: 'judgment', catLabel: '판결', icon: '⚖️', label: '판결' },
  anonymous:    { cat: 'judgment', catLabel: '판결', icon: '⚖️', label: '판결' },
  crazy_court:  { cat: 'judgment', catLabel: '판결', icon: '⚖️', label: '판결' },
  battle:       { cat: 'vote',     catLabel: '토론', icon: '🗳️', label: '토론' },
  balance:      { cat: 'vote',     catLabel: '토론', icon: '🗳️', label: '토론' },
  ox:           { cat: 'vote',     catLabel: '토론', icon: '🗳️', label: '토론' },
  cbattle:      { cat: 'drip',     catLabel: '드립', icon: '😂', label: '드립' },
  quiz:         { cat: 'consult',  catLabel: '상담', icon: '🫠', label: '상담' },
  initial_game: { cat: 'consult',  catLabel: '상담', icon: '🫠', label: '상담' },
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

function getGameSubtype(post) {
  if (post.subtype === 'judgment' || post.modules?.vote?.voteMode === 'judgment') return 'judgment';
  if (post.subtype === 'consult' || post.modules?.consult?.enabled || post.modules?.quiz?.enabled || post.type === 'quiz' || post.type === 'initial_game') return 'consult';
  if (post.subtype === 'drip' || post.feedType === 'drip' || post.modules?.drip?.enabled) return 'drip';
  if (post.subtype === 'vote' || post.feedType === 'vote' || post.modules?.vote?.enabled || post.type === 'vote' || post.type === 'ox' || post.type === 'battle' || post.type === 'balance') return 'vote';
  if (post.subtype && TYPE_META[post.subtype]) return post.subtype;
  return 'judgment';
}

function getTypeMeta(post) {
  const subtype = getGameSubtype(post);
  return TYPE_META[subtype] || TYPE_META.judgment;
}

function displayTitle(post) {
  const title = plainText(post.title || '').trim();
  const desc = plainText(post.desc || '').trim();
  const dripTopic = plainText(post.modules?.drip?.prompt || '').trim();
  if (post.modules?.drip?.enabled) {
    const generic = ['오늘의 드립 주제', '오늘의 한줄', '드립 AI 글'];
    return (generic.includes(title) ? (dripTopic || desc) : title) || dripTopic || desc || '드립 주제';
  }
  return title || desc || '제목 없음';
}

function displayDesc(post) {
  if (post.modules?.drip?.enabled) return '';
  return plainText(post.desc || '').slice(0, 220);
}

function renderModuleChips(post) {
  if (post.type !== 'multi' || !post.modules) return '';
  const labels = [];
  if (post.anonymous || post.modules.anonymous?.enabled) labels.push('익명');
  if (post.subtype === 'judgment' || post.modules.vote?.voteMode === 'judgment') labels.push('판결');
  else if (post.modules.consult?.enabled || post.modules.quiz?.enabled) labels.push('상담');
  else if (post.modules.vote?.enabled || post.modules.vote?.ox) labels.push('토론');
  if (post.modules.drip?.enabled) labels.push('드립');
  if (!labels.length) return '';
  const unique = labels.filter((label, index, self) => self.indexOf(label) === index);
  return `<div class="feed-card__multi-chips">${unique.map(label => `<span>${escHtml(label)}</span>`).join('')}</div>`;
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
            ${firstTag ? `<span class="tag">#${firstTag}</span>` : ''}
          </div>
          <h3 class="feed-card__title line-clamp-2">${escHtml(title)}</h3>
          ${desc ? `<p class="feed-card__desc line-clamp-2">${escHtml(desc)}</p>` : ''}
          ${renderModuleChips(post)}
          <div class="feed-card__meta">
            <span>${escHtml(post.authorName || '익명')}</span>
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
        <button class="feed-share-btn" type="button" data-feed-share="${escAttr(post.id)}" data-feed-title="${escAttr(title || '소소킹')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          공유
        </button>
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
    // 사용자가 공유창을 닫은 경우는 조용히 무시합니다.
  }
}, true);
