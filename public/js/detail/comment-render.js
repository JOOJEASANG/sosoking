import { auth } from '../firebase.js';
import { escHtml, formatTime as timeText } from '../utils/helpers.js';
import { COMMENT_REACTIONS } from './constants.js';
import { markBestComment } from './data.js';

export function renderComment(c) {
  const timeStr = timeText(c.createdAt?.toDate?.() || c.createdAt);
  const isOwn = auth.currentUser?.uid === c.authorId;
  const uid = auth.currentUser?.uid || '';
  const myReact = c.reactedWith?.[uid] ?? null;
  const isBest = c._isBest;

  return `
    <div class="comment-item ${isBest ? 'comment-item--best' : ''}" data-comment-id="${c.id}">
      ${isBest ? '<div class="best-badge">🏆 베스트</div>' : ''}
      <div class="avatar avatar--sm">${escHtml((c.authorName || '?')[0])}</div>
      <div class="comment-item__body">
        <div class="comment-item__author">${escHtml(c.authorName || '익명')}</div>
        <div class="comment-item__text">${escHtml(c.text || '').replace(/\n/g, '<br>')}</div>
        <div class="comment-item__meta">
          <span>${timeStr}</span>
          <div class="comment-reactions">
            ${COMMENT_REACTIONS.map(r => renderCommentReactionButton(c, r, myReact)).join('')}
          </div>
          ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${c.id}">삭제</button>` : ''}
        </div>
      </div>
    </div>`;
}

export function renderLikeableComment(c) {
  const timeStr = timeText(c.createdAt?.toDate?.() || c.createdAt);
  const isOwn = auth.currentUser?.uid === c.authorId;
  const uid = auth.currentUser?.uid || '';
  const myReact = c.reactedWith?.[uid] ?? null;
  const isBest = c._isBest;

  return `
    <div class="likeable-comment" data-comment-id="${c.id}">
      ${isBest ? '<div class="best-badge">🏆 베스트</div>' : ''}
      <div class="likeable-comment__content">
        <span class="likeable-comment__text">${escHtml(c.text || '')}</span>
        <span class="likeable-comment__meta">${escHtml(c.authorName || '익명')} · ${timeStr}</span>
      </div>
      <div class="likeable-comment__actions">
        <div class="comment-reactions">
          ${COMMENT_REACTIONS.map(r => renderCommentReactionButton(c, r, myReact)).join('')}
        </div>
        ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${c.id}">삭제</button>` : ''}
      </div>
    </div>`;
}

function renderCommentReactionButton(c, reaction, myReact) {
  const count = c.reactions?.[reaction.key] || 0;
  const active = myReact === reaction.key ? 'active' : '';
  return `<button class="comment-react-btn ${active}" data-comment-id="${c.id}" data-react="${reaction.key}">${reaction.emoji}${count > 0 ? ` <b>${count}</b>` : ''}</button>`;
}

export function renderCbattleComment(c) {
  const timeStr = timeText(c.createdAt?.toDate?.() || c.createdAt);
  const isOwn = auth.currentUser?.uid === c.authorId;
  return `
    <div class="cbattle-comment cbattle-comment--${escHtml((c.side || 'a').toLowerCase())}" data-comment-id="${c.id}">
      <div class="cbattle-comment__text">${escHtml(c.text || '').replace(/\n/g, '<br>')}</div>
      <div class="cbattle-comment__meta">
        <span>${escHtml(c.authorName || '익명')}</span>
        <span>${timeStr}</span>
        ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${c.id}">삭제</button>` : ''}
      </div>
    </div>`;
}

export function renderCommentSection(post, comments) {
  const loggedIn = !!auth.currentUser;

  if (post.type === 'cbattle') return renderCbattleSection(comments, loggedIn);
  if (post.type === 'drip') return renderDripSection(comments, loggedIn);

  return `
    <div class="comment-section">
      <div class="comment-section__title">댓글 ${comments.length}</div>
      <div class="comment-write-box" id="comment-write">
        <textarea id="comment-input" placeholder="${loggedIn ? '댓글을 입력하세요' : '로그인 후 댓글 작성 가능'}"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">등록</button>
      </div>
      <div id="comment-list">
        ${comments.length
          ? markBestComment(comments).map(c => renderComment(c)).join('')
          : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 댓글을 남겨보세요!</div>'}
      </div>
    </div>`;
}

function renderCbattleSection(comments, loggedIn) {
  const aList = comments.filter(c => c.side === 'A');
  const bList = comments.filter(c => c.side === 'B');
  return `
    <div class="comment-section">
      <div class="comment-section__title">⚔️ 댓글 배틀 (${comments.length}개)</div>
      <div class="cbattle-side-select">
        <button class="cbattle-side-btn cbattle-side-btn--a" data-side="A">🔴 A팀</button>
        <button class="cbattle-side-btn cbattle-side-btn--b" data-side="B">🔵 B팀</button>
      </div>
      <div class="comment-write-box" id="comment-write">
        <textarea id="comment-input" placeholder="${loggedIn ? '팀을 선택 후 참여해보세요' : '로그인 후 참여 가능'}"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">참여하기</button>
      </div>
      <div class="cbattle-columns">
        <div class="cbattle-col cbattle-col--a"><div class="cbattle-col__title">🔴 A팀 ${aList.length}</div>${aList.length ? aList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}</div>
        <div class="cbattle-col cbattle-col--b"><div class="cbattle-col__title">🔵 B팀 ${bList.length}</div>${bList.length ? bList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}</div>
      </div>
    </div>`;
}

function renderDripSection(comments, loggedIn) {
  return `
    <div class="comment-section">
      <div class="comment-section__title">🎤 드립 올리기 (${comments.length}개)</div>
      <div class="comment-write-box" id="comment-write">
        <textarea id="comment-input" placeholder="${loggedIn ? '한 줄 드립을 올려보세요!' : '로그인 후 참여 가능'}"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">올리기</button>
      </div>
      <div id="comment-list">
        ${comments.length
          ? comments.map(c => renderLikeableComment(c)).join('')
          : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 번째로 드립을 올려보세요!</div>'}
      </div>
    </div>`;
}

export function renderCommentListHTML(post, comments) {
  if (post.type === 'cbattle') {
    const aList = comments.filter(c => c.side === 'A');
    const bList = comments.filter(c => c.side === 'B');
    return {
      a: `<div class="cbattle-col__title">🔴 A팀 ${aList.length}</div>${aList.length ? aList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}`,
      b: `<div class="cbattle-col__title">🔵 B팀 ${bList.length}</div>${bList.length ? bList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}`,
    };
  }

  if (post.type === 'drip') {
    return comments.length
      ? comments.map(c => renderLikeableComment(c)).join('')
      : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 번째로 드립을 올려보세요!</div>';
  }

  return comments.length
    ? markBestComment(comments).map(c => renderComment(c)).join('')
    : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 댓글을 남겨보세요!</div>';
}
