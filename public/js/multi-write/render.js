import { MULTI_PRESETS, WRITER_PRESET_KEYS } from './presets.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function moduleToggleInput(key, activeKey) {
  return `<input type="hidden" data-module-input="${key}" ${activeKey === key ? `data-module-toggle="${key}"` : ''} value="1">`;
}

function renderOptionPicker(activeKey) {
  return `
    <div class="mw-room-picker">
      <div class="mw-room-picker__label">글 유형 선택 <small style="font-weight:500;color:var(--color-text-muted)">선택하지 않으면 일반글입니다</small></div>
      <input type="hidden" id="mw-selected-preset" value="${esc(activeKey)}">
      <div class="mw-room-nav">
        ${WRITER_PRESET_KEYS.map(key => {
          const preset = MULTI_PRESETS[key];
          return `<button type="button" class="mw-room-btn mw-room-btn--${esc(key)} ${activeKey === key ? 'active' : ''}" data-multi-preset="${key}" aria-pressed="${activeKey === key ? 'true' : 'false'}">
            <span class="mw-room-btn__icon">${esc(preset.icon)}</span>
            <span class="mw-room-btn__label">${esc(preset.label)}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function moduleCard(key, activeKey, icon, title, desc, body) {
  const hidden = activeKey === key ? '' : 'style="display:none"';
  return `
    <div class="multi-module is-enabled multi-module--selected" data-module-card="${key}" data-option-panel="${key}" ${hidden}>
      ${moduleToggleInput(key, activeKey)}
      <div class="multi-module__head multi-module__head--static">
        <span class="multi-module__icon">${icon}</span>
        <span class="multi-module__text"><b>${title}</b><small>${desc}</small></span>
      </div>
      <div class="multi-module__body">${body}</div>
    </div>`;
}

export function renderQuizOptionRow(index, checked = false) {
  return `
    <div class="multi-quiz-option-row">
      <label class="multi-quiz-answer-pick"><input type="radio" name="mw-quiz-correct" value="${index}" ${checked ? 'checked' : ''}> 정답</label>
      <input class="form-input mw-quiz-option" maxlength="80" placeholder="선택지 ${index + 1}">
    </div>`;
}

export function renderQuizOptionRows(count = 2) {
  return Array.from({ length: count }, (_, i) => renderQuizOptionRow(i, i === 0)).join('');
}

function renderCollectHidden(activeKey) {
  return `<div data-option-panel="collect" style="display:none">${moduleToggleInput('collect', activeKey)}<input type="hidden" id="mw-collect-kind" value="auto"></div>`;
}

function renderVoteModule(activeKey) {
  return `
    <div class="mw-vote-compact" data-module-card="vote" data-option-panel="vote" ${activeKey === 'vote' ? '' : 'style="display:none"'}>
      ${moduleToggleInput('vote', activeKey)}
      <input type="hidden" id="mw-vote-mode" value="pros_cons">
      <div class="form-group">
        <label class="form-label">찬반 선택지 <span class="required">*</span></label>
        <div class="multi-option-list" id="mw-vote-options">
          <input class="form-input mw-vote-option" maxlength="80" value="찬성" readonly>
          <input class="form-input mw-vote-option" maxlength="80" value="반대" readonly>
        </div>
        <div class="form-hint">찬성과 반대가 고정으로 생성되고, 댓글에서 토론할 수 있습니다.</div>
      </div>
    </div>`;
}

function renderQuizModule(activeKey) {
  const preset = MULTI_PRESETS.quiz;
  return moduleCard('quiz', activeKey, '🧠', '퀴즈 옵션', '주관식 · 객관식 · 정답 없는 퀴즈를 올립니다.', `
    <div class="form-group">
      <label class="form-label">퀴즈 방식 <span class="required">*</span></label>
      <input type="hidden" id="mw-quiz-mode" value="subjective">
      <label style="display:flex;align-items:center;gap:7px;margin:0 0 8px;font-size:12px;font-weight:850;color:var(--color-text-secondary)">
        <input type="checkbox" id="mw-quiz-no-answer" style="width:16px;height:16px"> 정답 없는 퀴즈로 등록
      </label>
      <div class="multi-quiz-mode-toggle" role="radiogroup" aria-label="퀴즈 방식 선택">
        <button type="button" class="multi-quiz-mode-btn active" data-quiz-mode="subjective" role="radio" aria-checked="true">주관식</button>
        <button type="button" class="multi-quiz-mode-btn" data-quiz-mode="multiple" role="radio" aria-checked="false">객관식</button>
      </div>
    </div>
    <div id="mw-quiz-subjective-box" class="form-group">
      <label class="form-label">정답</label>
      <input id="mw-quiz-answer" class="form-input" maxlength="80" placeholder="${esc(preset.quizAnswerPlaceholder)}">
      <div class="form-hint">정답 없는 퀴즈로 등록하면 비워도 됩니다.</div>
    </div>
    <div id="mw-quiz-multiple-box" style="display:none">
      <div class="form-group">
        <label class="form-label">객관식 선택지와 정답</label>
        <div class="multi-option-list" id="mw-quiz-options">${renderQuizOptionRows(2)}</div>
        <button class="btn btn--ghost btn--sm" type="button" id="mw-add-quiz-option">+ 선택지 추가</button>
        <div class="form-hint">정답 없는 퀴즈로 등록하면 정답 선택은 참고용으로만 사용됩니다.</div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">힌트</label>
      <input id="mw-quiz-hint" class="form-input" maxlength="120" placeholder="정답을 바로 알려주지 않는 짧은 힌트">
    </div>
    <div class="form-group">
      <label class="form-label">정답 해설</label>
      <textarea id="mw-quiz-explanation" class="form-textarea" rows="3" maxlength="500" placeholder="정답 확인 후 보여줄 해설을 입력하세요"></textarea>
    </div>`);
}

export function renderMultiWriteHTML({ renderKey, presetKey }) {
  const activeKey = MULTI_PRESETS[presetKey] ? presetKey : 'collect';
  const preset = MULTI_PRESETS[activeKey] || MULTI_PRESETS.collect;
  const titleLabel = activeKey === 'vote' ? '찬반 토론 주제' : '제목';
  const contentLabel = activeKey === 'vote' ? '토론 설명' : activeKey === 'quiz' ? '퀴즈 문제' : '내용';
  const requiredMark = activeKey === 'quiz' ? '<span class="required">*</span>' : '';

  return `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}" data-preset-key="${esc(activeKey)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="multi-back-type" type="button">←</button>
        <h1 class="write-step-title">일반게시판 글쓰기</h1>
      </div>
      <div class="card">
        <div class="card__body--lg">
          ${renderOptionPicker(activeKey)}
          ${renderCollectHidden(activeKey)}
          <div data-write-section="standard-fields">
            <div class="form-group">
              <label class="form-label">${titleLabel} <span class="required">*</span></label>
              <input id="mw-title" class="form-input" maxlength="100" placeholder="${esc(preset.titlePlaceholder)}">
            </div>
            <div class="form-group" data-write-section="content-field">
              <label class="form-label">${contentLabel} ${requiredMark}</label>
              <textarea id="mw-desc" class="form-textarea mw-desc-resizable" rows="4" maxlength="2000" placeholder="${esc(preset.descPlaceholder)}"></textarea>
            </div>
          </div>
          <div class="form-group" data-write-section="media-field">
            <label class="form-label">사진 첨부 <small style="font-weight:400;color:var(--color-text-muted)">선택사항</small></label>
            <div id="mw-img-uploader"></div>
            <div class="form-hint">사진은 선택사항입니다.</div>
          </div>
          <div data-write-section="vote-panel" ${activeKey === 'vote' ? '' : 'style="display:none"'}>${renderVoteModule(activeKey)}</div>
          <div data-write-section="quiz-panel" ${activeKey === 'quiz' ? '' : 'style="display:none"'}>${renderQuizModule(activeKey)}</div>
          <div class="form-group">
            <label class="form-label" for="mw-tags">태그</label>
            <div class="mw-tags-row">
              <input id="mw-tags" class="form-input" maxlength="100" placeholder="${esc(preset.tagsPlaceholder)}">
              <button class="btn btn--ghost btn--sm" type="button" id="mw-auto-tags" style="white-space:nowrap;flex-shrink:0">자동 생성</button>
            </div>
          </div>
          <div class="multi-comment-note">💬 댓글과 반응은 항상 켜져 있습니다.</div>
        </div>
        <div class="card__footer">
          <div class="write-submit">
            <button class="btn btn--ghost" type="button" id="multi-cancel">취소</button>
            <button class="btn btn--primary" type="button" id="multi-submit">올리기</button>
          </div>
        </div>
      </div>
    </div>`;
}
