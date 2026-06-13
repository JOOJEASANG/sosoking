import { escHtml } from '../utils/helpers.js';
import { renderLegacyVoteOptions, renderLegacyBattleVs } from './vote-actions.js';

function escAttr(value) {
  return escHtml(value).replace(/`/g, '&#96;');
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

function safeImageList(images) {
  return (Array.isArray(images) ? images : []).map(safeImageUrl).filter(Boolean).slice(0, 20);
}

export function renderImageSection(images) {
  const safeImages = safeImageList(images);
  if (!safeImages.length) return '';
  const dataAttr = encodeURIComponent(JSON.stringify(safeImages));
  const visible = safeImages.slice(0, 4);
  const extra = safeImages.length > 4 ? safeImages.length - 4 : 0;
  const cols = Math.min(safeImages.length, 4);
  return `
    <div class="detail-gallery detail-gallery--${cols}" data-images="${escAttr(dataAttr)}">
      ${visible.map((src, i) => `
        <div class="detail-gallery__thumb" data-gallery-idx="${i}">
          <img src="${escAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">
          ${i === 3 && extra > 0 ? `<div class="detail-gallery__more">+${extra}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

const AI_KING_AGAIN = {
  ai_judge: { path: '/constitutional-court', label: '🏛️ 헌법재판소 보기' },
};

function renderAiAgainBtn(type) {
  const info = AI_KING_AGAIN[type];
  if (!info) return '';
  return `
    <div class="ai-result-actions">
      <a href="#${info.path}" class="btn btn--primary">${info.label}</a>
      <a href="#/feed?type=${type}" class="btn btn--ghost">다른 결과 보기</a>
    </div>
    <div class="ai-result-share-row">
      <button id="btn-share" class="btn btn--primary btn--sm" style="flex:1;max-width:200px">📤 공유하기</button>
    </div>`;
}

export function renderTypeBody(post) {
  switch (post.type) {
    case 'ai_judge':
      return renderAiJudgeBody(post) + renderAiAgainBtn('ai_judge');
    case 'balance':
    case 'vote':
      if (!post.options?.length) return '';
      return `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderLegacyVoteOptions(post)}</div>`;

    case 'battle':
      return renderLegacyBattleVs(post);

    default:
      return '';
  }
}

function renderAiJudgeBody(post) {
  const verdicts = Array.isArray(post.verdicts) ? post.verdicts : [];
  return `
    <div class="ai-judge-result">
      <div class="ai-judge-situation">
        <strong>📋 상황</strong><br>
        ${escHtml(post.situation || post.title || '').replace(/\n/g, '<br>')}
      </div>
      <div class="ai-verdict-list">
        ${verdicts.map(v => `
          <div class="ai-verdict-item ai-verdict-item--judge" data-judge="${escHtml(v.charId || v.judgeId || '')}">
            <div class="ai-verdict-judge">${escHtml(v.charName || v.judgeName || '')}</div>
            <div class="ai-verdict-text">${escHtml(v.verdict || '').replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

