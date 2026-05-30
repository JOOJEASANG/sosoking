import { auth } from '../firebase.js';
import { esc, timeText } from './utils.js';

function normalizeText(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDuplicateOfPostBody(post, value) {
  const text = normalizeText(value);
  if (!text) return false;
  return [post.desc, post.body, post.title]
    .map(normalizeText)
    .filter(Boolean)
    .some(source => source === text);
}

function compactQuestion(post, value, fallback) {
  const text = String(value || '').trim();
  if (!text || isDuplicateOfPostBody(post, text)) return fallback;
  return text;
}

export function renderVoteModule(post) {
  const vote = post.modules?.vote;
  if (!vote?.enabled) return '';
  const votedBy = Array.isArray(vote.votedBy) ? vote.votedBy : [];
  const uid = auth.currentUser?.uid || '';
  const hasVoted = uid && votedBy.includes(uid);
  const total = (vote.options || []).reduce((sum, option) => sum + Number(option.votes || 0), 0);
  const title = String(vote.question || post.desc || post.title || '토론 주제').trim();
  return `
    <div class="multi-detail-module" data-multi-module="vote">
      <div class="multi-detail-module__title">🗳️ 토론 주제</div>
      <div class="multi-module-hint">주제를 보고 원하는 옵션을 선택하세요.</div>
      <div class="multi-quiz-question" style="margin:10px 0">${esc(title).replace(/\n/g, '<br>')}</div>
      <div class="multi-vote-options">
        ${(vote.options || []).map((opt, i) => {
          const votes = Number(opt.votes || 0);
          const pct = total ? Math.round(votes / total * 100) : 0;
          return `<button class="multi-vote-option" data-multi-vote-idx="${i}" ${hasVoted ? 'disabled' : ''}>
            <span class="multi-vote-option__bar" style="width:${pct}%"></span>
            <span class="multi-vote-option__text">${esc(opt.text)}</span>
            <span class="multi-vote-option__pct">${hasVoted || total ? `${pct}%` : '투표'}</span>
          </button>`;
        }).join('')}
      </div>
      ${hasVoted ? '<div class="multi-module-hint">이미 투표했어요.</div>' : ''}
    </div>`;
}

export function renderNamingModule(post) {
  const naming = post.modules?.naming;
  if (!naming?.enabled) return '';
  return `
    <div class="multi-detail-module" data-multi-module="naming">
      <div class="multi-detail-module__title">😜 작명 참여</div>
      <div class="multi-module-hint">본문을 보고 웃긴 이름만 입력하세요.</div>
      <div class="multi-submit-row"><input id="multi-naming-free" class="form-input" maxlength="30" placeholder="웃긴 이름을 입력하세요"><button class="btn btn--primary btn--sm" id="multi-naming-submit">등록</button></div>
      <div class="multi-participation-list" id="multi-naming-list"></div>
    </div>`;
}

export function renderDripModule(post) {
  const drip = post.modules?.drip;
  if (!drip?.enabled) return '';
  const topic = String(drip.prompt || post.desc || post.title || '').trim();
  return `
    <div class="multi-detail-module" data-multi-module="drip">
      <div class="multi-detail-module__title">🤣 드립 주제</div>
      <div class="multi-module-hint">주제를 보고 50자 이내 한 줄 드립만 남겨보세요. 짧을수록 강합니다.</div>
      ${topic ? `<div class="multi-drip-prompt">${esc(topic).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="multi-submit-row"><input id="multi-drip-input" class="form-input" maxlength="50" placeholder="이 주제로 한 줄 드립 입력"><button class="btn btn--primary btn--sm" id="multi-drip-submit">드립 등록</button></div>
      <div class="multi-participation-list" id="multi-drip-list"></div>
    </div>`;
}

function fillCounts(fill) {
  if (Array.isArray(fill.blankCounts) && fill.blankCounts.length) return fill.blankCounts.map(v => Math.max(1, Math.min(12, Number(v) || 4))).slice(0, 12);
  if (Array.isArray(fill.blanks) && fill.blanks.length) return fill.blanks.map(b => Math.max(1, Math.min(12, Number(b.charCount) || 4))).slice(0, 12);
  return [Math.max(2, Math.min(12, Number(fill.charCount || fill.blankCount || 4)))];
}

function renderFillPrompt(fill, counts) {
  const parts = Array.isArray(fill.templateParts) ? fill.templateParts : [];
  if (parts.length) {
    return `<div class="multi-fill-prompt multi-fill-prompt--template">${parts.map(part => {
      if (part.type === 'blank') {
        const count = Math.max(1, Math.min(12, Number(part.charCount || counts[part.index] || 4)));
        return `<span class="multi-fill-inline-blank" data-fill-inline-blank="${Number(part.index) || 0}" aria-label="빈칸 ${Number(part.index || 0) + 1}">${Array.from({ length: count }, () => '<i></i>').join('')}</span>`;
      }
      return esc(part.text || '').replace(/\n/g, '<br>');
    }).join('')}</div>`;
  }

  const prompt = String(fill.prompt || '');
  if (!prompt) return '';
  let index = 0;
  const html = esc(prompt).replace(/_{2,}|□+|[ \t]{2,}/g, marker => {
    const count = counts[index] || marker.length || 4;
    const blankHtml = `<span class="multi-fill-inline-blank" data-fill-inline-blank="${index}" aria-label="빈칸 ${index + 1}">${Array.from({ length: count }, () => '<i></i>').join('')}</span>`;
    index += 1;
    return blankHtml;
  }).replace(/\n/g, '<br>');
  return `<div class="multi-fill-prompt multi-fill-prompt--template">${html}</div>`;
}

export function renderFillModule(post) {
  const fill = post.modules?.fill;
  if (!fill?.enabled) return '';
  const counts = fillCounts(fill);
  const fillPromptText = Array.isArray(fill.templateParts)
    ? fill.templateParts.map(part => part.type === 'blank' ? '' : part.text || '').join('')
    : fill.prompt || '';
  const showPrompt = fillPromptText && !isDuplicateOfPostBody(post, fillPromptText);
  return `
    <div class="multi-detail-module" data-multi-module="fill">
      <div class="multi-detail-module__title">🧩 빈칸 채우기 참여</div>
      <div class="multi-module-hint">본문 속 빈칸에 들어갈 말만 입력해보세요.</div>
      ${showPrompt ? renderFillPrompt(fill, counts) : ''}
      <div class="multi-submit-row multi-submit-row--fill-boxes">
        <div id="multi-fill-boxes">
          ${counts.map((count, groupIndex) => `
            <div class="multi-fill-blank-group" data-fill-group="${groupIndex}">
              <div class="multi-fill-blank-label">빈칸 ${groupIndex + 1}</div>
              <div class="multi-fill-boxes">
                ${Array.from({ length: count }, (_, i) => `<input class="multi-fill-char" maxlength="1" data-group="${groupIndex}" data-idx="${i}" inputmode="text" aria-label="빈칸 ${groupIndex + 1}-${i + 1}">`).join('')}
              </div>
            </div>`).join('')}
        </div>
        <input id="multi-fill-answer" type="hidden" maxlength="400">
        <button class="btn btn--primary btn--sm" id="multi-fill-submit">등록</button>
      </div>
      <div class="multi-participation-list" id="multi-fill-list"></div>
    </div>`;
}

function renderQuizMeta(quiz) {
  const hint = String(quiz.hint || '').trim();
  const correctCount = Number(quiz.correctCount || 0);
  const firstCorrect = quiz.firstCorrect || null;
  return `
    <div class="multi-quiz-meta" id="multi-quiz-meta">
      ${hint ? `<div class="multi-quiz-hint"><b>💡 힌트</b><span>${esc(hint)}</span></div>` : ''}
      <div class="multi-quiz-stats">
        <span id="multi-quiz-correct-count">${quiz.noAnswer ? '정답 없음' : `정답자 ${correctCount}명`}</span>
        <span id="multi-quiz-first-correct">${quiz.noAnswer ? '댓글로 의견을 남겨보세요' : (firstCorrect?.authorName ? `첫 정답자 ${esc(firstCorrect.authorName)}` : '첫 정답자 대기중')}</span>
      </div>
    </div>`;
}

export function renderQuizModule(post) {
  const quiz = post.modules?.quiz;
  if (!quiz?.enabled) return '';
  const isMultiple = quiz.mode === 'multiple' && Array.isArray(quiz.options) && quiz.options.length > 0;
  const question = String(quiz.question || post.desc || '').trim();
  if (quiz.noAnswer) {
    return `
      <div class="multi-detail-module" data-multi-module="quiz">
        <div class="multi-detail-module__title">🧠 퀴즈 문제</div>
        ${question ? `<div class="multi-quiz-question">${esc(question)}</div>` : '<div class="multi-module-hint">정답 없는 퀴즈입니다.</div>'}
        ${renderQuizMeta(quiz)}
        <div class="multi-quiz-result is-open is-no-answer" style="display:block"><b>정답 없는 퀴즈</b><span>${esc(quiz.explanation || '댓글로 자유롭게 이야기해보세요.')}</span></div>
      </div>`;
  }
  return `
    <div class="multi-detail-module" data-multi-module="quiz">
      <div class="multi-detail-module__title">🧠 퀴즈 문제</div>
      ${question ? `<div class="multi-quiz-question">${esc(question)}</div>` : '<div class="multi-module-hint">본문을 보고 정답만 선택하세요.</div>'}
      ${renderQuizMeta(quiz)}
      ${isMultiple ? `
        <div class="multi-quiz-options">
          ${quiz.options.map((opt, i) => `<button type="button" class="multi-quiz-option" data-quiz-option="${i}">${esc(opt.text || opt)}</button>`).join('')}
        </div>` : `
        <div class="multi-submit-row">
          <input id="multi-quiz-answer" class="form-input" placeholder="정답 입력">
          <button class="btn btn--primary btn--sm" id="multi-quiz-submit">확인</button>
        </div>`}
      <div id="multi-quiz-result" class="multi-quiz-result" style="display:none"></div>
    </div>`;
}

function deadlineDate(post) {
  const value = post.deadlineAt;
  return value?.toDate?.() || (value ? new Date(value) : null);
}

function renderDeadlineStatus(post) {
  if (!post.deadline?.enabled) return '';
  const mode = post.deadline.mode || 'manual';
  const date = deadlineDate(post);
  const now = new Date();
  const isClosed = date ? date.getTime() <= now.getTime() : post.deadline.status === 'closed';
  let label = post.deadline.label || '직접 마감';
  if (date && !isClosed) {
    const minutes = Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 60000));
    const left = minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 남음` : `${minutes}분 남음`;
    label = `${left}`;
  } else if (date && isClosed) {
    label = '마감됨';
  } else if (mode === 'manual') {
    label = '작성자 직접 마감 예정';
  }
  return `<div class="multi-deadline-status ${isClosed ? 'is-closed' : ''}"><b>${isClosed ? '🏁' : '⏰'} ${esc(label)}</b><span>${isClosed ? '베스트 참여작을 확인해보세요.' : '마감 후 베스트 참여작이 더 돋보입니다.'}</span></div>`;
}

export function renderModules(post) {
  return `
    <div class="multi-detail-root" data-multi-modules-root="${post.id}">
      <div class="multi-detail-root__head">
        <div class="multi-detail-root__title">🧩 참여 기능</div>
        <div class="multi-detail-root__desc">본문을 보고 아래 옵션만 선택하거나 입력하세요.</div>
      </div>
      ${renderDeadlineStatus(post)}
      ${renderVoteModule(post)}${renderNamingModule(post)}${renderDripModule(post)}${renderFillModule(post)}${renderQuizModule(post)}
    </div>`;
}

export function renderMultiReplyList(replies) {
  if (!replies.length) return `<div class="multi-empty">아직 답글이 없습니다.</div>`;
  return replies.map(reply => `<div class="multi-reply-item"><div class="multi-reply-item__avatar">${esc((reply.authorName || '?')[0])}</div><div class="multi-reply-item__body"><div class="multi-reply-item__meta"><b>${esc(reply.authorName || '익명')}</b><span>${timeText(reply.createdAt)}</span></div><div class="multi-reply-item__text">${esc(reply.text || '').replace(/\n/g, '<br>')}</div></div></div>`).join('');
}

function reactionScore(item = {}) {
  const reactions = item.reactions || {};
  return (Number(reactions.like || 0) || 0) + (Number(reactions.funny || 0) || 0) * 2 + (Number(reactions.fire || 0) || 0) * 3;
}

function bestTitle(kind) {
  return {
    naming: '🏆 베스트 작명',
    drip: '🏆 베스트 드립',
    fill: '🏆 베스트 빈칸 답',
  }[kind] || '🏆 베스트 참여작';
}

function renderItemBody(item, kind) {
  return `<div class="multi-item-text">${esc(item.text || '').replace(/\n/g, '<br>')}</div>`;
}

function renderBestParticipation(items, kind) {
  const ranked = [...items]
    .sort((a, b) => reactionScore(b) - reactionScore(a) || Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0))
    .slice(0, 3)
    .filter(item => reactionScore(item) > 0 || items.length <= 3);
  if (!ranked.length) return '';
  return `<div class="multi-best-box"><div class="multi-best-box__title">${bestTitle(kind)}</div>${ranked.map((item, index) => `<div class="multi-best-item"><span>${index + 1}</span>${renderItemBody(item, kind)}</div>`).join('')}</div>`;
}

export function renderItemList(items, kind) {
  if (!items.length) return `<div class="multi-empty">아직 참여글이 없습니다.</div>`;
  return `${renderBestParticipation(items, kind)}${items.map(item => {
    const reactions = item.reactions || {};
    const replyCount = Number(item.replyCount || 0);
    return `
      <div class="multi-participation-item" data-multi-kind="${kind}" data-multi-item-id="${item.id}">
        <div class="multi-participation-item__meta"><b>${esc(item.authorName || '익명')}</b><span>${timeText(item.createdAt)}</span></div>
        ${renderItemBody(item, kind)}
        <div class="multi-item-actions">
          <button type="button" data-multi-react="like">👍 ${Number(reactions.like || 0)}</button>
          <button type="button" data-multi-react="funny">ㅋㅋ ${Number(reactions.funny || 0)}</button>
          <button type="button" data-multi-react="fire">🔥 ${Number(reactions.fire || 0)}</button>
          <button type="button" data-multi-reply-toggle>답글 ${replyCount || ''}</button>
        </div>
        <div class="multi-replies"><div class="multi-replies__list"></div><div class="multi-replies__form"><input class="multi-replies__input" maxlength="200" placeholder="짧게 답글"><button class="multi-replies__submit" type="button">등록</button></div></div>
      </div>`;
  }).join('')}`;
}

export function markQuizResult(correct, message, data = {}) {
  const el = document.getElementById('multi-quiz-result');
  if (!el) return;
  el.style.display = 'block';
  el.className = `multi-quiz-result ${correct ? 'is-correct' : 'is-wrong'}`;
  el.innerHTML = `<b>${esc(message)}</b>${data.explanation ? `<span>${esc(data.explanation)}</span>` : ''}`;
  const countEl = document.getElementById('multi-quiz-correct-count');
  if (countEl && typeof data.correctCount === 'number') countEl.textContent = `정답자 ${data.correctCount}명`;
  const firstEl = document.getElementById('multi-quiz-first-correct');
  if (firstEl && data.firstCorrect?.authorName) firstEl.textContent = `첫 정답자 ${esc(data.firstCorrect.authorName)}`;
}
