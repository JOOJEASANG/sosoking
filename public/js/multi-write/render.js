import { MULTI_PRESETS, WRITER_PRESET_KEYS } from './presets.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function moduleToggleInput(key, activeKey) {
  return `<input type="hidden" data-module-input="${key}" ${activeKey === key ? `data-module-toggle="${key}"` : ''} value="1">`;
}

function renderOptionPicker(activeKey) {
  return `
    <div class="multi-preset-box multi-preset-box--simple multi-preset-box--after-write">
      <div class="multi-preset-box__title">옵션 선택</div>
      <div class="multi-preset-box__desc">글과 사진을 먼저 작성한 뒤 필요한 참여 옵션을 붙이세요. 선택하지 않으면 일반글로 올라갑니다.</div>
      <input type="hidden" id="mw-selected-preset" value="${esc(activeKey)}">
      <div class="multi-preset-list">
        ${WRITER_PRESET_KEYS.map(key => {
          const preset = MULTI_PRESETS[key];
          return `
          <button type="button" class="multi-preset-btn ${activeKey === key ? 'active' : ''}" data-multi-preset="${key}" aria-pressed="${activeKey === key ? 'true' : 'false'}">
            <span class="multi-preset-btn__label">${preset.icon} ${preset.label}</span>
            ${preset.shortDesc ? `<span class="multi-preset-btn__desc">${esc(preset.shortDesc)}</span>` : ''}
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

function renderAnonymousSwitch() {
  return `
    <label class="multi-anonymous-switch">
      <input type="checkbox" id="mw-anonymous-toggle">
      <span class="multi-anonymous-switch__track"><i></i></span>
      <span class="multi-anonymous-switch__text"><b>익명으로 올리기</b><small>피드에는 작성자가 ‘익명’으로 표시됩니다.</small></span>
    </label>`;
}

function renderGeneralExtras(activeKey) {
  return `
    <div class="multi-general-note" data-option-panel="general" ${activeKey === 'general' ? '' : 'style="display:none"'}>
      <b>일반글</b><span>자유롭게 올리고, 필요하면 익명으로 숨길 수 있습니다.</span>
      ${renderAnonymousSwitch()}
    </div>`;
}

function renderYoutubeInput() {
  return `
    <div class="form-group multi-youtube-box">
      <label class="form-label">유튜브 링크 <span style="font-weight:500;color:var(--color-text-muted)">(선택)</span></label>
      <input id="mw-youtube-url" class="form-input" maxlength="220" placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=...">
      <div class="form-hint">입력하면 상세페이지 본문 아래에 16:9 영상으로 자동 표시됩니다.</div>
    </div>`;
}

function renderVoteModule(activeKey) {
  const preset = MULTI_PRESETS.vote;
  return `
    <div class="mw-vote-compact" data-module-card="vote" data-option-panel="vote" ${activeKey === 'vote' ? '' : 'style="display:none"'}>
      ${moduleToggleInput('vote', activeKey)}
      <input type="hidden" id="mw-vote-mode" value="debate">
      <div class="mw-vote-chips" role="radiogroup" aria-label="투표 형식">
        <button type="button" class="mw-vote-chip active" data-vote-mode="debate" role="radio" aria-checked="true">찬성/반대</button>
        <button type="button" class="mw-vote-chip" data-vote-mode="general" role="radio" aria-checked="false">일반 선택지</button>
        <button type="button" class="mw-vote-chip" data-vote-mode="balance" role="radio" aria-checked="false">밸런스</button>
      </div>
      <div id="mw-vote-mode-note" class="form-hint" style="margin:6px 0 10px">찬성/반대가 기본으로 들어갑니다. 일반 선택지로 바꾸면 선택지를 직접 추가할 수 있어요.</div>
      <div class="multi-option-list" id="mw-vote-options">
        ${preset.voteOptionPlaceholders.map((value) => `<input class="form-input mw-vote-option" maxlength="80" value="${esc(value)}" placeholder="${esc(value)}" readonly>`).join('')}
      </div>
      <button class="btn btn--ghost btn--sm" type="button" id="mw-add-vote-option" style="margin-top:6px;display:none">+ 선택지 추가</button>
    </div>`;
}

function renderDripModule(activeKey) {
  return moduleCard('drip', activeKey, '🤣', '한줄드립', '참여자는 댓글처럼 짧은 한 줄 드립을 남깁니다.', `
    <div class="multi-module-inline-note">본문에 사진이나 상황 설명을 적어주세요. 참여자는 80자 이내 한 줄 드립을 남깁니다.</div>`);
}

function renderQuizModule(activeKey) {
  const preset = MULTI_PRESETS.quiz;
  return moduleCard('quiz', activeKey, '🧠', '퀴즈', '주관식 또는 객관식 문제를 붙일 수 있습니다.', `
    <div class="form-group">
      <label class="form-label">퀴즈 방식 <span class="required">*</span></label>
      <input type="hidden" id="mw-quiz-mode" value="subjective">
      <div class="multi-quiz-mode-toggle" role="radiogroup" aria-label="퀴즈 방식 선택">
        <button type="button" class="multi-quiz-mode-btn active" data-quiz-mode="subjective" role="radio" aria-checked="true">주관식</button>
        <button type="button" class="multi-quiz-mode-btn" data-quiz-mode="multiple" role="radio" aria-checked="false">객관식</button>
      </div>
    </div>
    <div id="mw-quiz-subjective-box" class="form-group">
      <label class="form-label">정답 <span class="required">*</span></label>
      <input id="mw-quiz-answer" class="form-input" maxlength="80" placeholder="${esc(preset.quizAnswerPlaceholder)}">
    </div>
    <div id="mw-quiz-multiple-box" style="display:none">
      <div class="form-group">
        <label class="form-label">객관식 선택지와 정답 <span class="required">*</span></label>
        <div class="multi-option-list" id="mw-quiz-options">${renderQuizOptionRows(2)}</div>
        <button class="btn btn--ghost btn--sm" type="button" id="mw-add-quiz-option">+ 선택지 추가</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">힌트</label>
      <input id="mw-quiz-hint" class="form-input" maxlength="120" placeholder="정답을 바로 알려주지 않는 짧은 힌트">
      <div class="form-hint">상세페이지에서 누구나 볼 수 있습니다.</div>
    </div>
    <div class="form-group">
      <label class="form-label">정답 해설</label>
      <textarea id="mw-quiz-explanation" class="form-textarea" rows="3" maxlength="500" placeholder="정답 확인 후 보여줄 해설을 입력하세요"></textarea>
      <div class="form-hint">정답을 맞힌 사용자에게 결과와 함께 표시됩니다.</div>
    </div>`);
}

function renderOptionPanels(activeKey) {
  return `
    <div class="multi-module-list multi-module-list--selected">
      ${renderGeneralExtras(activeKey)}
      ${renderVoteModule(activeKey)}
      ${renderDripModule(activeKey)}
      ${renderQuizModule(activeKey)}
    </div>`;
}

export function renderMultiWriteHTML({ renderKey, presetKey }) {
  const activeKey = MULTI_PRESETS[presetKey] && !MULTI_PRESETS[presetKey].hiddenFromWriter ? presetKey : 'general';
  const preset = MULTI_PRESETS[activeKey] || MULTI_PRESETS.general;

  return `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}" data-preset-key="${esc(activeKey)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="multi-back-type" type="button">←</button>
        <h1 class="write-step-title">피드 글쓰기</h1>
      </div>
      <div class="card">
        <div class="card__body--lg">
          <div class="form-group">
            <label class="form-label">제목 <span class="required">*</span></label>
            <input id="mw-title" class="form-input" maxlength="100" placeholder="${esc(preset.titlePlaceholder || MULTI_PRESETS.general.titlePlaceholder)}">
          </div>
          <div class="form-group">
            <label class="form-label">본문</label>
            <textarea id="mw-desc" class="form-textarea mw-desc-resizable" rows="4" maxlength="2000" placeholder="${esc(preset.descPlaceholder || MULTI_PRESETS.general.descPlaceholder)}"></textarea>
          </div>
          ${renderYoutubeInput()}
          <div class="form-group">
            <label class="form-label">사진</label>
            <div id="mw-img-uploader"></div>
            <div class="form-hint">사진은 최대 20장까지 올릴 수 있어요.</div>
          </div>
          <div class="form-group">
            <div class="multi-tag-label-row">
              <label class="form-label" for="mw-tags">태그</label>
              <button class="btn btn--ghost btn--sm" type="button" id="mw-auto-tags">자동 생성</button>
            </div>
            <input id="mw-tags" class="form-input" maxlength="100" placeholder="${esc(preset.tagsPlaceholder || MULTI_PRESETS.general.tagsPlaceholder)}">
            <div class="form-hint">비워두고 올려도 제목과 본문을 기준으로 태그가 자동 생성됩니다.</div>
          </div>
          ${renderOptionPicker(activeKey)}
          ${renderOptionPanels(activeKey)}
          <div class="multi-comment-note">💬 댓글과 답글은 항상 켜져 있습니다.</div>
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
