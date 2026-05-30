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

export function renderTypeBody(post) {
  switch (post.type) {
    case 'balance':
    case 'vote':
    case 'concern':
      if (!post.options?.length) return '';
      return `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderLegacyVoteOptions(post)}</div>`;

    case 'battle':
      return renderLegacyBattleVs(post);

    case 'cbattle': {
      const topic = (post.desc || post.title || '').trim();
      return `
        <div class="multi-detail-module" style="margin-bottom:14px">
          <div class="multi-detail-module__title">⚔️ 토론 주제</div>
          ${topic ? `<div class="multi-quiz-question">${escHtml(topic).replace(/\n/g, '<br>')}</div>` : ''}
          <div class="cbattle-ox">
            <button type="button" class="cbattle-ox-btn cbattle-ox-btn--a cbattle-side-btn" data-side="A">
              <span class="cbattle-ox-emoji">🔴</span>
              <span class="cbattle-ox-label">A팀</span>
            </button>
            <div class="cbattle-ox-vs">VS</div>
            <button type="button" class="cbattle-ox-btn cbattle-ox-btn--b cbattle-side-btn" data-side="B">
              <span class="cbattle-ox-emoji">🔵</span>
              <span class="cbattle-ox-label">B팀</span>
            </button>
          </div>
          <p class="cbattle-select-hint">팀을 선택하고 아래에 의견을 남겨보세요</p>
        </div>`;
    }

    case 'story':
      return post.feeling
        ? `<div style="padding:12px 16px;background:var(--color-malhe-bg);border-left:3px solid var(--color-malhe);border-radius:8px;font-size:13px;margin-top:8px"><strong>💚 느낀 점</strong><br>${escHtml(post.feeling).replace(/\n/g, '<br>')}</div>`
        : '';

    case 'laugh': {
      const diffMap = { easy: '😌 쉬움', normal: '😬 보통', hard: '😤 어려움', extreme: '💀 극한' };
      return post.difficulty
        ? `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:var(--color-warning-bg);border-radius:var(--radius-pill);font-size:13px;font-weight:700;margin-top:8px">웃참 난이도: ${escHtml(diffMap[post.difficulty] || post.difficulty)}</div>`
        : '';
    }

    case 'ox':
      return `
        <div class="quiz-box" id="quiz-area">
          <div class="quiz-ox">
            <button class="quiz-ox-btn quiz-ox-btn--o" data-answer="O">⭕ O</button>
            <button class="quiz-ox-btn quiz-ox-btn--x" data-answer="X">❌ X</button>
          </div>
          <div id="quiz-result" style="display:none" class="quiz-result">
            <div class="quiz-result__icon"></div>
            <div class="quiz-result__text"></div>
            <div class="quiz-result__explanation" style="margin-top:8px;font-size:13px;color:var(--color-text-secondary)"></div>
          </div>
        </div>`;

    case 'quiz':
      return renderLegacyQuizBody(post);

    case 'howto':
      return renderHowtoBody(post);

    case 'fail':
      return `
        ${post.lesson ? `<div style="padding:12px 16px;background:var(--color-malhe-bg);border-radius:10px;font-size:13px;margin-top:8px"><strong>알게 된 점:</strong> ${escHtml(post.lesson)}</div>` : ''}
        ${post.redo ? `<div style="padding:12px 16px;background:var(--color-golra-bg);border-radius:10px;font-size:13px;margin-top:8px"><strong>다시 한다면:</strong> ${escHtml(post.redo)}</div>` : ''}`;

    default:
      return '';
  }
}

function renderLegacyQuizBody(post) {
  if (post.quizMode === 'short') {
    return `
      <div class="quiz-box" id="quiz-area">
        <div style="display:flex;gap:8px">
          <input id="quiz-short-input" class="form-input" placeholder="답을 입력하세요" style="flex:1">
          <button class="btn btn--primary" id="btn-quiz-submit">확인</button>
        </div>
        <div id="quiz-result" style="display:none" class="quiz-result">
          <div class="quiz-result__icon"></div>
          <div class="quiz-result__text"></div>
          <div class="quiz-result__explanation" style="margin-top:8px;font-size:13px;color:var(--color-text-secondary)"></div>
        </div>
      </div>`;
  }

  if (!post.options?.length) return '';
  return `
    <div class="quiz-box quiz-options" id="quiz-area">
      ${post.options.map((opt, i) => `
        <button class="vote-option" data-quiz-idx="${i}" style="text-align:left">
          <div class="vote-option__content"><span>${i + 1}. ${escHtml(opt)}</span></div>
        </button>`).join('')}
      <div id="quiz-result" style="display:none" class="quiz-result">
        <div class="quiz-result__icon"></div>
        <div class="quiz-result__text"></div>
        <div class="quiz-result__explanation" style="margin-top:8px;font-size:13px;color:var(--color-text-secondary)"></div>
      </div>
    </div>`;
}

function renderHowtoBody(post) {
  return `
    ${post.summary ? `<div style="padding:12px 16px;background:var(--color-primary-bg);border-radius:10px;font-weight:700;color:var(--color-primary);margin-bottom:12px">💡 ${escHtml(post.summary)}</div>` : ''}
    ${post.materials ? `<div style="font-size:13px;margin-bottom:8px"><strong>준비물:</strong> ${escHtml(post.materials)}</div>` : ''}
    ${post.steps?.length ? `
      <div class="howto-steps-display">
        <div class="howto-steps-display__title">단계별 순서</div>
        ${post.steps.map((step, i) => `
          <div class="howto-step-display">
            <div class="howto-step-display__num">${i + 1}</div>
            <div class="howto-step-display__text">${escHtml(step).replace(/\n/g, '<br>')}</div>
          </div>`).join('')}
      </div>` : ''}
    ${post.caution ? `<div style="font-size:13px;color:var(--color-warning);padding:10px 12px;background:var(--color-warning-bg);border-radius:8px;margin-top:8px">⚠️ ${escHtml(post.caution)}</div>` : ''}`;
}

export function renderLegacyInteractive() {
  return '';
}
