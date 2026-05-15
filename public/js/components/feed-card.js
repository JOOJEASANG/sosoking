import { navigate } from '../router.js';

/* 카테고리/유형 메타 */
const TYPE_META = {
  // 골라봐
  balance:  { cat: 'golra', catLabel: '골라봐', icon: '⚖️', label: '밸런스게임' },
  vote:     { cat: 'golra', catLabel: '골라봐', icon: '🗳️', label: '민심투표' },
  battle:   { cat: 'golra', catLabel: '골라봐', icon: '⚔️', label: '선택지배틀' },
  ox:       { cat: 'golra', catLabel: '골라봐', icon: '❓', label: 'OX퀴즈' },
  quiz:     { cat: 'golra', catLabel: '골라봐', icon: '🧠', label: '내맘대로퀴즈' },
  // 웃겨봐
  naming:   { cat: 'usgyo', catLabel: '웃겨봐', icon: '😜', label: '미친작명소' },
  acrostic: { cat: 'usgyo', catLabel: '웃겨봐', icon: '✍️', label: '삼행시짓기' },
  cbattle:  { cat: 'usgyo', catLabel: '웃겨봐', icon: '💥', label: '댓글배틀' },
  laugh:    { cat: 'usgyo', catLabel: '웃겨봐', icon: '🙈', label: '웃참챌린지' },
  drip:     { cat: 'usgyo', catLabel: '웃겨봐', icon: '🎤', label: '한줄드립' },
  // 말해봐
  howto:    { cat: 'malhe', catLabel: '말해봐', icon: '💡', label: '나만의노하우' },
  story:    { cat: 'malhe', catLabel: '말해봐', icon: '📖', label: '경험담' },
  fail:     { cat: 'malhe', catLabel: '말해봐', icon: '💀', label: '실패담' },
  concern:  { cat: 'malhe', catLabel: '말해봐', icon: '🤔', label: '고민/질문' },
  relay:    { cat: 'malhe', catLabel: '말해봐', icon: '🎭', label: '막장릴레이' },
};

export function renderFeedCard(post) {
  const meta = TYPE_META[post.type] || { cat: 'malhe', catLabel: '', icon: '📝', label: post.type || '글' };
  const images = post.images || [];
  const timeStr = formatTime(post.createdAt?.toDate?.() || post.createdAt);
  const reactions = post.reactions || {};
  const totalReactions = reactions.total || 0;
  const commentCount = post.commentCount || 0;

  return `
    <article class="card card--hover feed-card" onclick="navigate('/detail/${post.id}')">
      <div class="feed-card__header" style="padding-bottom:0">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="feed-card__type-badge feed-card__type-badge--${meta.cat}">
              ${meta.icon} ${meta.label}
            </span>
            ${post.tags?.length ? `<span class="tag">#${post.tags[0]}</span>` : ''}
          </div>
          <h3 class="feed-card__title line-clamp-2">${escHtml(post.title || '')}</h3>
          ${post.desc ? `<p class="feed-card__desc line-clamp-2">${escHtml(post.desc)}</p>` : ''}
          <div class="feed-card__meta">
            <span>${escHtml(post.authorName || '익명')}</span>
            <span>${timeStr}</span>
            ${totalReactions ? `<span>❤️ ${totalReactions}</span>` : ''}
            ${commentCount ? `<span>💬 ${commentCount}</span>` : ''}
          </div>
        </div>
        ${images.length === 1 ? `
          <div style="flex-shrink:0;margin-left:12px">
            <img src="${images[0]}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:10px">
          </div>` : ''}
      </div>
      ${images.length > 1 ? renderImageGrid(images) : ''}
    </article>`;
}

function renderImageGrid(images) {
  const shown = images.slice(0, 3);
  return `
    <div class="feed-card__images feed-card__images--${Math.min(shown.length, 3)}" style="margin-top:8px">
      ${shown.map(src => `<img class="feed-card__img" src="${src}" alt="" loading="lazy">`).join('')}
    </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)   return '방금 전';
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400)return `${Math.floor(diff/3600)}시간 전`;
  return `${Math.floor(diff/86400)}일 전`;
}
