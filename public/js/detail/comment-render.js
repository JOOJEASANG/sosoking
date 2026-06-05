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

  if (post.type === 'cbattle') return renderCbattleSection(comments, loggedIn);
  if (post.type === 'ai_debate') return renderAiDebateCommentSection(post, comments, loggedIn);
  if (post.type === 'drip' || post.feedType === 'drip' || post.modules?.drip?.enabled) return '';

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

function renderCbattleSection(comments, loggedIn) {
  const aList = comments.filter(c => c.side === 'A');
  const bList = comments.filter(c => c.side === 'B');
  return `
    <div class="comment-section">
      <div class="comment-section__title">⚔️ 토론 의견 (${comments.length}명)</div>
      <div class="comment-write-box" id="comment-write">
        ${!loggedIn ? '<input id="comment-guest-name" class="form-input" placeholder="닉네임 (선택, 최대 12자)" maxlength="12" style="margin-bottom:6px">' : ''}
        <textarea id="comment-input" placeholder="위에서 팀을 선택하고 의견을 입력해주세요"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">참여하기</button>
      </div>
      <div class="cbattle-columns">
        <div class="cbattle-col cbattle-col--a"><div class="cbattle-col__title">🔴 A팀 ${aList.length}</div>${aList.length ? aList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}</div>
        <div class="cbattle-col cbattle-col--b"><div class="cbattle-col__title">🔵 B팀 ${bList.length}</div>${bList.length ? bList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}</div>
      </div>
    </div>`;
}

function renderDebateCommentForm(side, loggedIn) {
  return `
    <div class="debate-comment-side-badge debate-comment-side-badge--${side.toLowerCase()}" id="debate-side-badge">
      ${side === 'A' ? '🔴 A편' : '🔵 B편'} 으로 댓글 남기기
    </div>
    ${!loggedIn ? '<input id="comment-guest-name" class="form-input" placeholder="닉네임 (선택, 최대 12자)" maxlength="12" style="margin-bottom:6px">' : ''}
    <textarea id="comment-input" placeholder="한 마디 남겨봐요!"></textarea>
    <input type="hidden" id="debate-side-input" value="${side}">
    <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">등록</button>`;
}

export { renderDebateCommentForm };

function renderAiDebateCommentSection(post, comments, loggedIn) {
  const myVotedSide = localStorage.getItem(`debate_vote_${post.id}`) || '';
  const revealTime = post.createdAt?.toDate?.()?.getTime?.() + 24 * 3600 * 1000;
  const now = Date.now();
  const aList = comments.filter(c => c.side === 'A');
  const bList = comments.filter(c => c.side === 'B');
  const total = (post.voteA || 0) + (post.voteB || 0);

  const commentForm = myVotedSide
    ? renderDebateCommentForm(myVotedSide, loggedIn)
    : `<div class="debate-vote-prompt">👆 위에서 편을 고르고 투표하면 댓글을 남길 수 있어요!</div>`;

  return `
    <div class="comment-section">
      <div class="comment-section__title">💬 의견 ${total > 0 ? `· A ${post.voteA || 0}표 vs B ${post.voteB || 0}표` : ''} (${comments.length})</div>
      <div class="comment-write-box" id="comment-write">
        ${commentForm}
      </div>
      <div class="debate-comment-cols" id="debate-comment-cols">
        <div class="debate-col debate-col--a">
          <div class="debate-col__title">🔴 A편 ${aList.length}명</div>
          ${aList.length ? aList.map(c => renderDebateComment(c, revealTime, now)).join('') : '<div class="debate-col__empty">첫 번째로 참여!</div>'}
        </div>
        <div class="debate-col debate-col--b">
          <div class="debate-col__title">🔵 B편 ${bList.length}명</div>
          ${bList.length ? bList.map(c => renderDebateComment(c, revealTime, now)).join('') : '<div class="debate-col__empty">첫 번째로 참여!</div>'}
        </div>
      </div>
    </div>`;
}

function renderDebateComment(c, revealTime, now) {
  const timeStr = timeText(c.createdAt?.toDate?.() || c.createdAt);
  const isOwn = auth.currentUser?.uid === c.authorId && c.authorId !== 'ai-decoy';
  const isRevealed = revealTime && now > revealTime;
  const isAi = !!c.isAiDecoy;
  const userFlagged = !!localStorage.getItem(`decoy_flag_${c.id}`);

  let flagEl = '';
  if (isRevealed) {
    if (isAi) {
      flagEl = userFlagged
        ? '<span class="debate-decoy-result debate-decoy-result--correct">🤖✅ AI 맞췄어요!</span>'
        : '<span class="debate-decoy-result debate-decoy-result--ai">🤖 AI였어요!</span>';
    } else if (userFlagged) {
      flagEl = '<span class="debate-decoy-result debate-decoy-result--wrong">🤖❌ AI 아님</span>';
    }
  } else {
    flagEl = `<button class="debate-decoy-btn${userFlagged ? ' active' : ''}" data-comment-id="${escHtml(c.id)}" title="AI 댓글 의심">🤖?</button>`;
  }

  return `
    <div class="debate-comment${isAi && isRevealed ? ' debate-comment--ai' : ''}" data-comment-id="${escHtml(c.id)}">
      <div class="debate-comment__text">${escHtml(c.text || '').replace(/\n/g, '<br>')}</div>
      <div class="debate-comment__meta">
        <span class="debate-comment__name">${escHtml(c.authorName || '익명')}</span>
        <span>${timeStr}</span>
        ${flagEl}
        ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${escHtml(c.id)}">삭제</button>` : ''}
      </div>
    </div>`;
}

function renderDripSection(comments, loggedIn) {
  const cfg = { title: '🎤 드립 올리기', placeholder: '한 줄 드립을 올려보세요!', btn: '올리기', empty: '첫 번째로 드립을 올려보세요!' };
  return `
    <div class="comment-section">
      <div class="comment-section__title">${cfg.title} (${comments.length}개)</div>
      <div class="comment-write-box" id="comment-write">
        ${!loggedIn ? '<input id="comment-guest-name" class="form-input" placeholder="닉네임 (선택, 최대 12자)" maxlength="12" style="margin-bottom:6px">' : ''}
        <textarea id="comment-input" placeholder="${cfg.placeholder}"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">${cfg.btn}</button>
      </div>
      <div id="comment-list">
        ${comments.length
          ? comments.map(c => renderLikeableComment(c)).join('')
          : `<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">${cfg.empty}</div>`}
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

  if (post.type === 'ai_debate') {
    const aList = comments.filter(c => c.side === 'A');
    const bList = comments.filter(c => c.side === 'B');
    const revealTime = post.createdAt?.toDate?.()?.getTime?.() + 24 * 3600 * 1000;
    const now = Date.now();
    return {
      a: `<div class="debate-col__title">🔴 A편 ${aList.length}명</div>${aList.length ? aList.map(c => renderDebateComment(c, revealTime, now)).join('') : '<div class="debate-col__empty">첫 번째로 참여!</div>'}`,
      b: `<div class="debate-col__title">🔵 B편 ${bList.length}명</div>${bList.length ? bList.map(c => renderDebateComment(c, revealTime, now)).join('') : '<div class="debate-col__empty">첫 번째로 참여!</div>'}`,
    };
  }

  if (post.type === 'naming' || post.type === 'initial_game' || post.type === 'drip') {
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

  if (post.type === 'cbattle') {
    const html = renderCommentListHTML(post, comments);
    const aCol = document.querySelector('.cbattle-col--a');
    const bCol = document.querySelector('.cbattle-col--b');
    if (aCol) aCol.innerHTML = html.a;
    if (bCol) bCol.innerHTML = html.b;
    return;
  }

  if (post.type === 'ai_debate') {
    const html = renderCommentListHTML(post, comments);
    const aCol = document.querySelector('.debate-col--a');
    const bCol = document.querySelector('.debate-col--b');
    if (aCol) aCol.innerHTML = html.a;
    if (bCol) bCol.innerHTML = html.b;
    return;
  }

  const listEl = document.getElementById('comment-list');
  if (listEl) listEl.innerHTML = renderCommentListHTML(post, comments);
}
