import { auth } from '../firebase.js';
import { escHtml, formatTime as timeText } from '../utils/helpers.js';
import { COMMENT_REACTIONS } from './constants.js';
import { markBestComment } from './data.js';
import { renderPartyBadge, renderPresidentCrown } from '../utils/party-badge.js';

export function renderComment(c) {
  const timeStr = timeText(c.createdAt?.toDate?.() || c.createdAt);
  const isOwn = auth.currentUser?.uid === c.authorId;
  const uid = auth.currentUser?.uid || '';
  const myReact = c.reactedWith?.[uid] ?? null;
  const isBest = c._isBest;

  return `
    <div class="comment-item ${isBest ? 'comment-item--best' : ''}" data-comment-id="${escHtml(c.id)}">
      ${isBest ? '<div class="best-badge">🏆 베스트</div>' : ''}
      <div class="avatar avatar--sm">${escHtml((c.authorName || '?')[0])}</div>
      <div class="comment-item__body">
        <div class="comment-item__author">${renderPresidentCrown(c.authorId)}${renderPartyBadge(c.partyId)}${c.rankEmoji ? `<span class="comment-rank-emoji" title="${escHtml(c.rankLabel || '')}">${escHtml(c.rankEmoji)}</span>` : ''}${escHtml(c.authorName || '익명')}</div>
        <div class="comment-item__text">${escHtml(c.text || '').replace(/\n/g, '<br>')}</div>
        <div class="comment-item__meta">
          <span>${timeStr}</span>
          <div class="comment-reactions">
            ${COMMENT_REACTIONS.map(r => renderCommentReactionButton(c, r, myReact)).join('')}
          </div>
          ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${escHtml(c.id)}">삭제</button>` : ''}
        </div>
      </div>
    </div>`;
}

function renderCommentReactionButton(c, reaction, myReact) {
  const count = c.reactions?.[reaction.key] || 0;
  const active = myReact === reaction.key ? 'active' : '';
  return `<button class="comment-react-btn ${active}" data-comment-id="${escHtml(c.id)}" data-react="${reaction.key}">${reaction.emoji}${count > 0 ? ` <b>${count}</b>` : ''}</button>`;
}

export function renderCommentSection(post, comments) {
  const loggedIn = !!auth.currentUser;
  const markedComments = markBestComment(comments);

  return `
    <div class="comment-section">
      <div class="comment-section__title">시민토론 ${comments.length}</div>
      <div class="comment-write-box" id="comment-write">
        ${!loggedIn ? '<input id="comment-guest-name" class="form-input" placeholder="닉네임 (선택, 최대 12자)" maxlength="12" style="margin-bottom:6px">' : ''}
        <textarea id="comment-input" placeholder="정치 의견을 입력하세요"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">등록</button>
      </div>
      <div id="comment-list">
        ${markedComments.length
          ? markedComments.map(c => renderComment(c)).join('')
          : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 시민토론을 남겨보세요!</div>'}
      </div>
    </div>`;
}
