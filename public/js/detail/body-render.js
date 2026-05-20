import { escHtml } from '../utils/helpers.js';
import { renderLegacyVoteOptions, renderLegacyBattleVs } from './vote-actions.js';

export function renderImageSection(images) {
  if (!images?.length) return '';
  const dataAttr = encodeURIComponent(JSON.stringify(images));
  const visible = images.slice(0, 4);
  const extra = images.length > 4 ? images.length - 4 : 0;
  const cols = Math.min(images.length, 4);
  return `
    <div class="detail-gallery detail-gallery--${cols}" data-images="${dataAttr}">
      ${visible.map((src, i) => `
        <div class="detail-gallery__thumb" data-gallery-idx="${i}">
          <img src="${src}" alt="" loading="lazy">
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

    case 'story':
      return post.feeling
        ? `<div style="padding:12px 16px;background:var(--color-malhe-bg);border-left:3px solid var(--color-malhe);border-radius:8px;font-size:13px;margin-top:8px"><strong>💚 느낀 점</strong><br>${escHtml(post.feeling).replace(/\n/g, '<br>')}</div>`
        : '';

    case 'laugh': {
      const diffMap = { easy: '😌 쉬움', normal: '😬 보통', hard: '😤 어려움', extreme: '💀 극한' };
      return post.difficulty
        ? `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:var(--color-warning-bg);border-radius:var(--radius-pill);font-size:13px;font-weight:700;margin-top:8px">웃참 난이도: ${diffMap[post.difficulty] || post.difficulty}</div>`
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

    case 'relay':
      return post.startSentence
        ? `<div style="padding:16px;background:var(--color-primary-bg);border-left:4px solid var(--color-primary);border-radius:4px;font-weight:600;margin-top:8px">"${escHtml(post.startSentence)}"</div>`
        : '';

    case 'acrostic':
      return renderAcrosticPrompt(post);

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

function renderAcrosticPrompt(post) {
  return post.keyword
    ? `<div style="padding:16px;background:var(--color-surface-2);border-radius:10px;margin-top:8px">
        <div style="font-size:12px;font-weight:700;color:var(--color-text-muted);margin-bottom:8px">제시어: ${escHtml(post.keyword)}</div>
        ${[...post.keyword].map(ch => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="width:28px;height:28px;background:var(--color-primary);color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0">${escHtml(ch)}</span>
            <span style="font-size:13px;color:var(--color-text-muted)">: 삼행시로 참여해보세요</span>
          </div>`).join('')}
      </div>`
    : '';
}

export function renderLegacyInteractive(post) {
  if (post.type === 'acrostic' && post.keyword) {
    const chars = [...post.keyword];
    return `
      <div style="padding:20px">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px">✍️ 삼행시 참여하기</div>
        <div id="acrostic-submit-lines">
          ${chars.map((ch, i) => `
            <div class="acrostic-line" style="margin-bottom:8px">
              <span class="acrostic-char">${escHtml(ch)}</span>
              <input class="form-input acrostic-submit-input" placeholder="${escHtml(ch)}(으)로 시작하는 한 줄" data-idx="${i}">
            </div>`).join('')}
        </div>
        <button class="btn btn--primary btn--sm" id="btn-acrostic-submit" style="margin-top:8px">삼행시 올리기</button>
      </div>`;
  }
  return '';
}
