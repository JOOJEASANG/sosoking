import { auth } from '../firebase.js';
import { esc, timeText } from './utils.js';

export function renderVoteModule(post) {
  const vote = post.modules?.vote;
  if (!vote?.enabled) return '';
  const total = (vote.options || []).reduce((sum, option) => sum + Number(option.votes || 0), 0);
  const title = String(vote.question || post.desc || post.title || '').trim();
  return `
    <section class="multi-detail-module" data-multi-module="vote">
      <div class="multi-detail-module__title">🗳️ ${vote.voteMode === 'judgment' ? '판결 투표' : '토론 투표'}</div>
      ${title ? `<div class="multi-quiz-question">${esc(title).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="multi-vote-options">
        ${(vote.options || []).map((option, index) => {
          const count = Number(option.votes || 0);
          const percent = total ? Math.round(count / total * 100) : 0;
          return `<button type="button" class="multi-vote-option" data-community-vote="${index}">
            <span class="multi-vote-option__bar" style="width:${percent}%"></span>
            <span class="multi-vote-option__text">${esc(option.text || '')}</span>
            <span class="multi-vote-option__pct">${total ? `${percent}%` : '투표'}</span>
          </button>`;
        }).join('')}
      </div>
    </section>`;
}

export function renderDripModule(post) {
  const drip = post.modules?.drip;
  if (!drip?.enabled) return '';
  const topic = String(drip.prompt || post.desc || post.title || '').trim();
  return `
    <section class="multi-detail-module" data-multi-module="drip">
      <div class="multi-detail-module__title">😂 한 줄 드립</div>
      ${topic ? `<div class="multi-drip-prompt">${esc(topic).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="multi-module-hint">50자 이내로 짧게 참여해보세요.</div>
      <div class="multi-submit-row">
        <input id="multi-drip-input" class="form-input" maxlength="50" placeholder="한 줄 드립 입력">
        <button type="button" class="btn btn--primary btn--sm" id="multi-drip-submit">등록</button>
      </div>
      <div class="multi-participation-list" id="multi-drip-list"><div class="multi-empty">불러오는 중...</div></div>
    </section>`;
}

export function renderDripList(items) {
  if (!items.length) return '<div class="multi-empty">첫 드립을 남겨보세요.</div>';
  return items.map(item => {
    const reactions = item.reactions || {};
    return `
      <article class="multi-participation-item" data-drip-item="${esc(item.id)}">
        <div class="multi-participation-item__head">
          <b>${esc(item.authorName || '익명')}</b><span>${timeText(item.createdAt)}</span>
        </div>
        <div class="multi-participation-item__text">${esc(item.text || '')}</div>
        <div class="multi-participation-item__actions">
          <button type="button" data-drip-react="like">👍 ${Number(reactions.like || 0) || ''}</button>
          <button type="button" data-drip-react="funny">😂 ${Number(reactions.funny || 0) || ''}</button>
          <button type="button" data-drip-react="fire">🔥 ${Number(reactions.fire || 0) || ''}</button>
          <button type="button" data-drip-replies-toggle>답글 ${Number(item.replyCount || 0) || ''}</button>
        </div>
        <div class="multi-replies" hidden>
          <div class="multi-replies__list"></div>
          <div class="multi-submit-row">
            <input class="form-input multi-replies__input" maxlength="500" placeholder="답글 입력">
            <button type="button" class="btn btn--primary btn--sm multi-replies__submit">등록</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

export function renderDripReplies(items) {
  if (!items.length) return '<div class="multi-empty">답글이 없습니다.</div>';
  return items.map(item => `
    <div class="multi-reply-item">
      <b>${esc(item.authorName || '익명')}</b>
      <span>${esc(item.text || '')}</span>
      <small>${timeText(item.createdAt)}</small>
    </div>`).join('');
}

export function renderModules(post) {
  return `<div data-community-modules-root>${renderVoteModule(post)}${renderDripModule(post)}</div>`;
}
