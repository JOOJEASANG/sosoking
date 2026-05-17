import { navigate } from '../router.js';
import { escHtml, formatTime } from '../utils/helpers.js';

/* 카테고리/유형 메타 */
const TYPE_META = {
  // 골라봐 — 선택·투표·배틀
  balance:      { cat: 'golra', catLabel: '골라봐', icon: '⚖️', label: '밸런스게임' },
  vote:         { cat: 'golra', catLabel: '골라봐', icon: '🗳️', label: '민심투표' },
  battle:       { cat: 'golra', catLabel: '골라봐', icon: '⚔️', label: '선택지배틀' },
  challenge24:  { cat: 'golra', catLabel: '골라봐', icon: '⏰', label: '24시간챌린지' },
  tournament:   { cat: 'golra', catLabel: '골라봐', icon: '🏆', label: '이상형월드컵' },
  // 웃겨봐 — 센스·유머 대결
  naming:       { cat: 'usgyo', catLabel: '웃겨봐', icon: '😜', label: '미친작명소' },
  acrostic:     { cat: 'usgyo', catLabel: '웃겨봐', icon: '✍️', label: '삼행시짓기' },
  drip:         { cat: 'usgyo', catLabel: '웃겨봐', icon: '🎤', label: '한줄드립' },
  cbattle:      { cat: 'usgyo', catLabel: '웃겨봐', icon: '💥', label: '댓글배틀' },
  laugh:        { cat: 'usgyo', catLabel: '웃겨봐', icon: '🙈', label: '웃참챌린지' },
  // 도전봐 — 퀴즈·릴레이·창작
  ox:           { cat: 'malhe', catLabel: '도전봐', icon: '❓', label: 'OX퀴즈' },
  quiz:         { cat: 'malhe', catLabel: '도전봐', icon: '🧠', label: '4지선다' },
  relay:        { cat: 'malhe', catLabel: '도전봐', icon: '🎭', label: '막장릴레이' },
  word_relay:   { cat: 'malhe', catLabel: '도전봐', icon: '🔗', label: '단어릴레이' },
  random_battle:{ cat: 'malhe', catLabel: '도전봐', icon: '🎰', label: '랜덤대결' },
  // 구형 타입 — 기존 게시물 표시용 (신규 작성 불가)
  howto:   { cat: 'malhe', catLabel: '도전봐', icon: '💡', label: '노하우' },
  story:   { cat: 'malhe', catLabel: '도전봐', icon: '📖', label: '경험담' },
  fail:    { cat: 'malhe', catLabel: '도전봐', icon: '💀', label: '실패담' },
  concern: { cat: 'malhe', catLabel: '도전봐', icon: '🤔', label: '고민/질문' },
};

export function renderFeedCard(post) {
  const meta = TYPE_META[post.type] || { cat: 'malhe', catLabel: '', icon: '📝', label: post.type || '글' };
  const images = post.images || [];
  const timeStr = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  const reactions = post.reactions || {};
  const totalReactions = reactions.total || 0;
  const commentCount = post.commentCount || 0;

  const viewCount = post.viewCount || 0;
  const temp = Math.min(100, Math.round((totalReactions * 2 + commentCount * 3) / 2));
  const tempColor = temp >= 70 ? '#FF4422' : temp >= 40 ? '#FF8800' : temp >= 20 ? '#FFAA00' : '#4F8EF7';

  return `
    <article class="card card--hover feed-card feed-card--${meta.cat}" onclick="navigate('/detail/${post.id}')">
      <div class="feed-card__header">
        <div class="feed-card__content">
          <div class="feed-card__badge-row">
            <span class="feed-card__type-badge feed-card__type-badge--${meta.cat}">
              ${meta.icon} ${meta.label}
            </span>
            ${post.tags?.length ? `<span class="tag">#${post.tags[0]}</span>` : ''}
          </div>
          <h3 class="feed-card__title line-clamp-2">${escHtml(post.title || '')}</h3>
          ${post.desc ? `<p class="feed-card__desc line-clamp-2">${escHtml(post.desc)}</p>` : ''}
          <div class="feed-card__meta">
            <span>${escHtml(post.authorName || '익명')}</span>
            <span class="feed-card__meta-dot"></span>
            <span>${timeStr}</span>
            ${viewCount ? `<span class="feed-card__meta-dot"></span><span>👁 ${viewCount}</span>` : ''}
            ${totalReactions ? `<span class="feed-card__meta-dot"></span><span>❤️ ${totalReactions}</span>` : ''}
            ${commentCount ? `<span class="feed-card__meta-dot"></span><span>💬 ${commentCount}</span>` : ''}
          </div>
        </div>
        ${images.length === 1 ? `<div class="feed-card__thumb"><img src="${images[0]}" alt="" loading="lazy"></div>` : ''}
      </div>
      ${images.length > 1 ? renderImageGrid(images) : ''}
      ${temp > 0 ? `<div class="feed-temp-bar" style="--temp-pct:${temp}%;--temp-color:${tempColor}" title="참여 온도 ${temp}°C"></div>` : ''}
      <div class="feed-card__actions" onclick="event.stopPropagation()">
        <button class="feed-share-btn" onclick="(async()=>{const u=location.origin+'/p/${post.id}';if(navigator.share){await navigator.share({title:${JSON.stringify(post.title||'소소킹')},url:u})}else{await navigator.clipboard.writeText(u);window.showToast?.('링크가 복사됐어요','success')}})()">
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
      ${shown.map(src => `<img class="feed-card__img" src="${src}" alt="" loading="lazy">`).join('')}
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

