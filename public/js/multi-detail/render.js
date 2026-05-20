import { auth } from '../firebase.js';
import { esc, timeText } from './utils.js';

export function renderVoteModule(post) {
  const vote = post.modules?.vote;
  if (!vote?.enabled) return '';
  const votedBy = Array.isArray(vote.votedBy) ? vote.votedBy : [];
  const uid = auth.currentUser?.uid || '';
  const hasVoted = uid && votedBy.includes(uid);
  const total = (vote.options || []).reduce((sum, option) => sum + Number(option.votes || 0), 0);
  return `
    <div class="multi-detail-module" data-multi-module="vote">
      <div class="multi-detail-module__title">🗳️ ${esc(vote.question || '투표/판정')}</div>
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
      <div class="multi-module-hint">댓글로 의견과 토론을 이어갈 수 있어요.</div>
      ${hasVoted ? '<div class="multi-module-hint">이미 투표했어요.</div>' : ''}
    </div>`;
}

export function renderNamingModule(post) {
  const naming = post.modules?.naming;
  if (!naming?.enabled) return '';
  const count = Number(naming.charCount || 0);
  const input = count > 0
    ? `<div class="multi-char-boxes">${Array.from({ length: count }, (_, i) => `<input class="multi-name-char" maxlength="2" data-idx="${i}">`).join('')}</div>`
    : `<input id="multi-naming-free" class="form-input" maxlength="30" placeholder="웃긴 이름을 입력하세요">`;

  return `
    <div class="multi-detail-module" data-multi-module="naming">
      <div class="multi-detail-module__title">😜 작명 참여</div>
      <div class="multi-module-hint">${count ? `${count}글자로 이름을 지어보세요.` : '자유롭게 이름을 지어보세요.'}</div>
      <div class="multi-submit-row">${input}<button class="btn btn--primary btn--sm" id="multi-naming-submit">등록</button></div>
      <div class="multi-participation-list" id="multi-naming-list"></div>
    </div>`;
}

export function renderAcrosticModule(post) {
  const acrostic = post.modules?.acrostic;
  if (!acrostic?.enabled) return '';
  const keyword = String(acrostic.keyword || '');
  return `
    <div class="multi-detail-module" data-multi-module="acrostic">
      <div class="multi-detail-module__title">✍️ '${esc(keyword)}' 삼행시</div>
      <div id="multi-acrostic-lines">
        ${[...keyword].map((ch, i) => `
          <div class="multi-acrostic-line">
            <span>${esc(ch)}</span>
            <input class="form-input multi-acrostic-input" data-idx="${i}" maxlength="80" placeholder="${esc(ch)}(으)로 시작하는 한 줄">
          </div>`).join('')}
      </div>
      <button class="btn btn--primary btn--sm" id="multi-acrostic-submit">삼행시 올리기</button>
      <div class="multi-participation-list" id="multi-acrostic-list"></div>
    </div>`;
}

function fillCounts(fill) {
  if (Array.isArray(fill.blankCounts) && fill.blankCounts.length) return fill.blankCounts.map(v => Math.max(1, Math.min(12, Number(v) || 4))).slice(0, 6);
  if (Array.isArray(fill.blanks) && fill.blanks.length) return fill.blanks.map(b => Math.max(1, Math.min(12, Number(b.charCount) || 4))).slice(0, 6);
  return [Math.max(2, Math.min(12, Number(fill.charCount || fill.blankCount || 4)))];
}

export function renderFillModule(post) {
  const fill = post.modules?.fill;
  if (!fill?.enabled) return '';
  const counts = fillCounts(fill);
  return `
    <div class="multi-detail-module" data-multi-module="fill">
      <div class="multi-detail-module__title">🧩 빈칸 채우기 참여</div>
      <div class="multi-module-hint">문장 속 빈칸마다 칸에 한 글자씩 입력해보세요.</div>
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
        <input id="multi-fill-answer" type="hidden" maxlength="200">
        <button class="btn btn--primary btn--sm" id="multi-fill-submit">등록</button>
      </div>
      <div class="multi-participation-list" id="multi-fill-list"></div>
    </div>`;
}

export function renderRelayModule(post) {
  const relay = post.modules?.relay;
  if (!relay?.enabled) return '';
  return `
    <div class="multi-detail-module" data-multi-module="relay">
      <div class="multi-detail-module__title">🎭 릴레이 이어쓰기</div>
      <div class="multi-relay-start">${esc(relay.startSentence || '').replace(/\n/g, '<br>')}</div>
      <textarea id="multi-relay-input" class="form-textarea" rows="3" maxlength="150" placeholder="다음 이야기를 이어주세요"></textarea>
      <button class="btn btn--primary btn--sm" id="multi-relay-submit">이어쓰기</button>
      <div class="multi-participation-list" id="multi-relay-list"></div>
    </div>`;
}

export function renderQuizModule(post) {
  const quiz = post.modules?.quiz;
  if (!quiz?.enabled) return '';
  const isMultiple = quiz.mode === 'multiple' && Array.isArray(quiz.options) && quiz.options.length > 0;
  return `
    <div class="multi-detail-module" data-multi-module="quiz">
      <div class="multi-detail-module__title">🧠 미친퀴즈</div>
      <div class="multi-quiz-question">${esc(quiz.question || '')}</div>
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

export function renderModules(post) {
  return `
    <div class="multi-detail-root" data-multi-modules-root="${post.id}">
      <div class="multi-detail-root__head">
        <div class="multi-detail-root__title">🧩 참여 기능</div>
        <div class="multi-detail-root__desc">이 글 형식에 맞는 참여 기능입니다.</div>
      </div>
      ${renderVoteModule(post)}${renderNamingModule(post)}${renderAcrosticModule(post)}${renderFillModule(post)}${renderRelayModule(post)}${renderQuizModule(post)}
    </div>`;
}

export function renderMultiReplyList(replies) {
  if (!replies.length) return `<div class="multi-empty">아직 답글이 없습니다.</div>`;
  return replies.map(reply => `<div class="multi-reply-item"><div class="multi-reply-item__avatar">${esc((reply.authorName || '?')[0])}</div><div class="multi-reply-item__body"><div class="multi-reply-item__meta"><b>${esc(reply.authorName || '익명')}</b><span>${timeText(reply.createdAt)}</span></div><div class="multi-reply-item__text">${esc(reply.text || '').replace(/\n/g, '<br>')}</div></div></div>`).join('');
}

export function renderItemList(items, kind) {
  if (!items.length) return `<div class="multi-empty">아직 참여글이 없습니다.</div>`;
  return items.map(item => {
    const reactions = item.reactions || {};
    const body = kind === 'acrostic' && Array.isArray(item.lines)
      ? item.lines.map(line => `<div class="multi-item-line"><b>${esc(line.char)}</b><span>${esc(line.line)}</span></div>`).join('')
      : `<div class="multi-item-text">${esc(item.text || '').replace(/\n/g, '<br>')}</div>`;
    return `<div class="multi-participation-item" data-multi-kind="${kind}" data-multi-item-id="${item.id}">${body}<div class="multi-item-meta">${esc(item.authorName || '익명')} · ${timeText(item.createdAt)}</div><div class="multi-item-actions"><button type="button" data-multi-react="like">👍 <b>${Number(reactions.like || 0) || ''}</b></button><button type="button" data-multi-react="funny">😂 <b>${Number(reactions.funny || 0) || ''}</b></button><button type="button" data-multi-react="fire">🔥 <b>${Number(reactions.fire || 0) || ''}</b></button><button type="button" data-multi-reply-toggle>답글 <b>${Number(item.replyCount || 0) || ''}</b></button></div><div class="multi-replies"><div class="multi-replies__list"></div><div class="multi-replies__form"><input class="multi-replies__input" maxlength="300" placeholder="답글을 입력하세요"><button type="button" class="multi-replies__submit">등록</button></div></div></div>`;
  }).join('');
}

export function markQuizResult(ok, message) {
  const result = document.getElementById('multi-quiz-result');
  if (!result) return;
  result.style.display = '';
  result.className = `multi-quiz-result ${ok ? 'is-correct' : 'is-wrong'}`;
  result.textContent = message || (ok ? '⭕ 정답이에요!' : '❌ 아쉽지만 오답이에요!');
}
