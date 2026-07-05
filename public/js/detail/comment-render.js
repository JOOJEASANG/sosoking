import { auth } from '../firebase.js';
import { escHtml, formatTime as timeText } from '../utils/helpers.js';
import { COMMENT_REACTIONS } from './constants.js';
import { markBestComment } from './data.js';

function isDebatePost(post = {}) {
  const m = post.modules || {};
  return post.type === 'cbattle'
    || post.type === 'vote'
    || post.type === 'balance'
    || post.feedType === 'vote'
    || post.subtype === 'vote'
    || m.vote?.enabled === true;
}

function isDripPost(post = {}) {
  const m = post.modules || {};
  return post.type === 'drip'
    || post.feedType === 'drip'
    || post.subtype === 'drip'
    || m.drip?.enabled === true;
}

function debateOptions(post = {}) {
  const moduleOptions = post.modules?.vote?.options;
  const legacyOptions = post.options;
  const source = Array.isArray(moduleOptions) && moduleOptions.length ? moduleOptions : (Array.isArray(legacyOptions) ? legacyOptions : []);
  const labels = source.map(item => String(item?.text || item || '').trim()).filter(Boolean).slice(0, 2);
  return [labels[0] || 'A 선택지', labels[1] || 'B 선택지'];
}

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

export function renderRelayStory(startSentence, comments) {
  if (!startSentence && !comments.length) return '';
  return `
    <div class="relay-story">
      ${startSentence ? `
        <div class="relay-story__segment">
          <div class="relay-story__num">시작</div>
          <div class="relay-story__text">${escHtml(startSentence)}</div>
        </div>` : ''}
      ${comments.map((c, i) => `
        <div class="relay-story__segment">
          <div class="relay-story__num">${i + 1}</div>
          <div class="relay-story__body">
            <div class="relay-story__text">${escHtml(c.text || '').replace(/\n/g, '<br>')}</div>
            <div class="relay-story__author">${escHtml(c.authorName || '익명')}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

export function renderCharBoxArea(count) {
  return `<div class="char-boxes-wrap" id="char-boxes-participate" data-count="${count}">
    ${Array.from({ length: count }, (_, i) => `<input class="char-box" data-idx="${i}" maxlength="2" autocomplete="off" inputmode="text">`).join('')}
  </div>`;
}

export function renderCharCommentSection(post, comments) {
  const loggedIn = !!auth.currentUser;
  const isNaming = post.type === 'naming';
  const isFreeNaming = isNaming && (post.charCount === 0);
  const count = isNaming ? (post.charCount || 3) : ([...(post.initials || '')].length || 3);
  const title = isNaming ? '✏️ 작명 참여' : '🔤 초성 참여';
  const emptyMsg = isNaming ? '첫 번째로 작명해보세요!' : '첫 번째로 참여해보세요!';
  const participateInput = isFreeNaming
    ? `<input id="free-naming-input" class="form-input" placeholder="자유롭게 이름을 지어봐요!" maxlength="20" autocomplete="off" style="flex:1">`
    : renderCharBoxArea(count);

  return `
    <div class="comment-section">
      <div class="comment-section__title">${title} (${comments.length}개)</div>
      ${loggedIn
        ? `<div class="char-participate-box" id="char-participate">${participateInput}<button class="btn btn--primary btn--sm" id="btn-char-submit">등록</button></div>`
        : `<div style="text-align:center;padding:12px;font-size:13px;color:var(--color-text-muted)"><a href="#/login" style="color:var(--color-primary)">로그인</a> 후 참여 가능</div>`}
      <div id="comment-list">
        ${comments.length
          ? markBestComment(comments).map(c => renderLikeableComment(c)).join('')
          : `<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">${emptyMsg}</div>`}
      </div>
    </div>`;
}

export function renderCommentSection(post, comments) {
  const loggedIn = !!auth.currentUser;

  if (post.type === 'naming' || post.type === 'initial_game') return renderCharCommentSection(post, comments);

  if (post.type === 'relay') {
    return `
      <div class="comment-section">
        <div class="comment-section__title">📖 릴레이 이야기</div>
        ${renderRelayStory(post.startSentence, comments)}
        <div class="comment-write-box" id="comment-write">
          <textarea id="comment-input" placeholder="${loggedIn ? '다음 이야기를 이어주세요 (최대 150자)' : '로그인 후 참여 가능'}" maxlength="150"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <span id="relay-char-count" style="font-size:12px;color:var(--color-text-muted)">0 / 150</span>
            <button class="btn btn--primary btn--sm" id="btn-comment">이어쓰기</button>
          </div>
        </div>
      </div>`;
  }

  if (post.type === 'cbattle') return renderCbattleSection(post, comments, loggedIn);
  if (isDebatePost(post)) return renderDebateSection(post, comments, loggedIn);
  if (isDripPost(post)) return renderDripSection(comments, loggedIn);

  return `
    <div class="comment-section">
      <div class="comment-section__title">댓글 ${comments.length}</div>
      <div class="comment-write-box" id="comment-write">
        ${!loggedIn ? '<input id="comment-guest-name" class="form-input" placeholder="닉네임 (선택, 최대 12자)" maxlength="12" style="margin-bottom:6px">' : ''}
        <textarea id="comment-input" placeholder="댓글을 입력하세요"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">등록</button>
      </div>
      <div id="comment-list">
        ${comments.length
          ? markBestComment(comments).map(c => renderComment(c)).join('')
          : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 댓글을 남겨보세요!</div>'}
      </div>
    </div>`;
}

function renderCbattleSection(post, comments, loggedIn) {
  return `
    <div class="comment-section comment-section--debate">
      <div class="comment-section__title">⚔️ 토론 의견 (${comments.length}명)</div>
      <div class="comment-write-box" id="comment-write">
        ${!loggedIn ? '<input id="comment-guest-name" class="form-input" placeholder="닉네임 (선택, 최대 12자)" maxlength="12" style="margin-bottom:6px">' : ''}
        <div class="cbattle-ox" style="margin-bottom:10px">
          <button type="button" class="cbattle-ox-btn cbattle-ox-btn--a cbattle-side-btn" data-side="A"><span class="cbattle-ox-emoji">🔴</span><span class="cbattle-ox-label">왼쪽 A팀</span></button>
          <div class="cbattle-ox-vs">VS</div>
          <button type="button" class="cbattle-ox-btn cbattle-ox-btn--b cbattle-side-btn" data-side="B"><span class="cbattle-ox-emoji">🔵</span><span class="cbattle-ox-label">오른쪽 B팀</span></button>
        </div>
        <textarea id="comment-input" placeholder="왼쪽/오른쪽을 고르고 의견을 입력해주세요"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">선택한 쪽에 등록</button>
      </div>
      <div class="debate-comment-board">${renderDebateCommentBoard(post, comments)}</div>
    </div>`;
}

function renderDebateSection(post, comments, loggedIn) {
  const [a, b] = debateOptions(post);
  return `
    <div class="comment-section comment-section--debate">
      <div class="comment-section__title">🗳️ 토론 참여 (${comments.length}명)</div>
      <div class="multi-module-hint" style="margin-bottom:10px">왼쪽/오른쪽 중 하나를 고르면, 등록한 토론 내용이 해당 칸에 표시됩니다.</div>
      <div class="comment-write-box" id="comment-write">
        ${!loggedIn ? '<input id="comment-guest-name" class="form-input" placeholder="닉네임 (선택, 최대 12자)" maxlength="12" style="margin-bottom:6px">' : ''}
        <div class="cbattle-ox" style="margin-bottom:10px">
          <button type="button" class="cbattle-ox-btn cbattle-ox-btn--a cbattle-side-btn" data-side="A"><span class="cbattle-ox-emoji">🔴</span><span class="cbattle-ox-label">왼쪽 · ${escHtml(a)}</span></button>
          <div class="cbattle-ox-vs">VS</div>
          <button type="button" class="cbattle-ox-btn cbattle-ox-btn--b cbattle-side-btn" data-side="B"><span class="cbattle-ox-emoji">🔵</span><span class="cbattle-ox-label">오른쪽 · ${escHtml(b)}</span></button>
        </div>
        <textarea id="comment-input" placeholder="선택한 쪽의 근거를 적어주세요. 예: 저는 왼쪽입니다. 왜냐면..."></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">선택한 쪽에 토론 등록</button>
      </div>
      <div class="debate-comment-board">${renderDebateCommentBoard(post, comments)}</div>
    </div>`;
}

function renderDebateColumn(label, option, list, side) {
  const colorDot = side === 'A' ? '🔴' : '🔵';
  return `
    <div class="cbattle-col cbattle-col--${side === 'A' ? 'a' : 'b'}">
      <div class="cbattle-col__title">
        <div style="font-size:11px;color:var(--color-text-muted);font-weight:950;margin-bottom:4px">${label}</div>
        <div>${colorDot} ${escHtml(option)} <span style="color:var(--color-text-muted);font-weight:900">${list.length}명</span></div>
      </div>
      ${list.length ? list.map(c => renderCbattleComment(c)).join('') : `<div class="cbattle-col__empty">${label} 첫 의견을 남겨보세요!</div>`}
    </div>`;
}

function renderDebateCommentBoard(post, comments) {
  const [a, b] = post.type === 'cbattle' ? ['A팀', 'B팀'] : debateOptions(post);
  const marked = markBestComment(comments);
  const aList = marked.filter(c => c.side === 'A');
  const bList = marked.filter(c => c.side === 'B');
  const neutral = marked.filter(c => c.side !== 'A' && c.side !== 'B');
  return `
    <div class="cbattle-columns">
      ${renderDebateColumn('왼쪽 의견', a, aList, 'A')}
      ${renderDebateColumn('오른쪽 의견', b, bList, 'B')}
    </div>
    ${neutral.length ? `<div id="comment-list" style="margin-top:12px"><div style="font-size:12px;font-weight:950;color:var(--color-text-muted);margin-bottom:8px">선택 없이 등록된 의견</div>${neutral.map(c => renderComment(c)).join('')}</div>` : '<div id="comment-list" style="display:none"></div>'}`;
}

function renderDripSection(comments, loggedIn) {
  return `
    <div class="comment-section comment-section--drip">
      <div class="comment-section__title">🤣 드립 댓글 (${comments.length}개)</div>
      <div class="multi-module-hint" style="margin-bottom:10px">글이나 이미지를 보고 짧고 강한 한 줄 드립을 남겨보세요.</div>
      <div class="comment-write-box" id="comment-write">
        ${!loggedIn ? '<input id="comment-guest-name" class="form-input" placeholder="닉네임 (선택, 최대 12자)" maxlength="12" style="margin-bottom:6px">' : ''}
        <textarea id="comment-input" placeholder="한 줄 드립을 입력하세요. 예: 이건 거의 ○○급 상황..."></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">드립 등록</button>
      </div>
      <div id="comment-list">
        ${comments.length
          ? markBestComment(comments).map(c => renderLikeableComment(c)).join('')
          : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 번째 드립을 남겨보세요!</div>'}
      </div>
    </div>`;
}

export function renderCommentListHTML(post, comments) {
  if (isDebatePost(post)) return renderDebateCommentBoard(post, comments);

  if (post.type === 'naming' || post.type === 'initial_game' || isDripPost(post)) {
    return comments.length
      ? markBestComment(comments).map(c => renderLikeableComment(c)).join('')
      : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 번째로 참여해보세요!</div>';
  }

  return comments.length
    ? markBestComment(comments).map(c => renderComment(c)).join('')
    : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 댓글을 남겨보세요!</div>';
}

export function refreshCommentListUI(post, comments) {
  if (post.type === 'relay') {
    const storyEl = document.querySelector('.relay-story');
    const newHtml = renderRelayStory(post.startSentence, comments);
    if (storyEl) storyEl.outerHTML = newHtml;
    else document.querySelector('.comment-section .comment-section__title')?.insertAdjacentHTML('afterend', newHtml);
    return;
  }

  if (isDebatePost(post)) {
    const board = document.querySelector('.debate-comment-board');
    if (board) board.innerHTML = renderDebateCommentBoard(post, comments);
    return;
  }

  const listEl = document.getElementById('comment-list');
  if (listEl) listEl.innerHTML = renderCommentListHTML(post, comments);
}
