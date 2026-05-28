import { MULTI_PRESETS, WRITER_PRESET_KEYS } from './presets.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function moduleToggleInput(key, activeKey) {
  return `<input type="hidden" data-module-input="${key}" ${activeKey === key ? `data-module-toggle="${key}"` : ''} value="1">`;
}

function renderOptionPicker(activeKey) {
  return `
    <div class="multi-preset-box multi-preset-box--simple multi-preset-box--top multi-write-option-category">
      <div class="multi-write-option-category__head">
        <div>
          <div class="multi-preset-box__title">방 선택</div>
          <div class="multi-preset-box__desc">짧고 웃긴 콘텐츠를 방별로 올립니다. 일반글은 숨기고 모음·토론·퀴즈·드립만 사용합니다.</div>
        </div>
      </div>
      <input type="hidden" id="mw-selected-preset" value="${esc(activeKey)}">
      <div class="multi-preset-list multi-preset-list--top">
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

function renderCollectModule(activeKey) {
  return moduleCard('collect', activeKey, '📌', '모음방', '유튜브 쇼츠, 웃긴 그림, 링크를 짧게 모읍니다.', `
    <div class="form-group">
      <label class="form-label">모음 유형 <span class="required">*</span></label>
      <input type="hidden" id="mw-collect-kind" value="youtube">
      <div class="mw-vote-chips" role="radiogroup" aria-label="모음 유형">
        <button type="button" class="mw-vote-chip active" data-collect-kind="youtube" role="radio" aria-checked="true">유튜브</button>
        <button type="button" class="mw-vote-chip" data-collect-kind="image" role="radio" aria-checked="false">웃긴그림</button>
        <button type="button" class="mw-vote-chip" data-collect-kind="link" role="radio" aria-checked="false">링크</button>
      </div>
    </div>
    <div class="form-group" data-collect-url-box>
      <label class="form-label">링크</label>
      <input id="mw-collect-url" class="form-input" maxlength="300" placeholder="유튜브 쇼츠/영상 링크 또는 이미지/웹 링크">
      <div class="form-hint">그림은 아래 사진 첨부를 쓰거나 이미지 URL을 입력해도 됩니다.</div>
    </div>
    <div class="form-group">
      <label class="form-label">짧은 설명</label>
      <input id="mw-collect-caption" class="form-input" maxlength="120" placeholder="예: 출근길에 보면 안 되는 웃긴 쇼츠">
    </div>`);
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
  return moduleCard('drip', activeKey, '🤣', '드립방', '제목과 본문 없이 오늘의 한줄만 등록합니다.', `
    <div class="multi-module-inline-note">아래 입력칸에 짧은 한 줄만 적으면 드립방 리스트에 올라갑니다.</div>`);
}

function renderQuizModule(activeKey) {
  const preset = MULTI_PRESETS.quiz;
  return moduleCard('quiz', activeKey, '🧠', '퀴즈방', '주관식 또는 객관식 문제를 올립니다.', `
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
    </div>
    <div class="form-group">
      <label class="form-label">정답 해설</label>
      <textarea id="mw-quiz-explanation" class="form-textarea" rows="3" maxlength="500" placeholder="정답 확인 후 보여줄 해설을 입력하세요"></textarea>
    </div>`);
}

function renderOptionPanels(activeKey) {
  return `
    <div class="multi-module-list multi-module-list--selected multi-module-list--top">
      ${renderCollectModule(activeKey)}
      ${renderVoteModule(activeKey)}
      ${renderQuizModule(activeKey)}
      ${renderDripModule(activeKey)}
    </div>`;
}

function renderDripLineField(activeKey) {
  return `
    <div class="form-group mw-drip-line-box" data-write-section="drip-line" ${activeKey === 'drip' ? '' : 'style="display:none"'}>
      <label class="form-label">오늘의 한줄 <span class="required">*</span></label>
      <input id="mw-drip-line" class="form-input mw-drip-line-input" maxlength="80" autocomplete="off" placeholder="짧고 웃긴 한 줄만 입력하세요">
      <div class="form-hint">엔터 없이 딱 한 줄만 등록됩니다. 최대 80자.</div>
    </div>`;
}

export function renderMultiWriteHTML({ renderKey, presetKey }) {
  const activeKey = MULTI_PRESETS[presetKey] && !MULTI_PRESETS[presetKey].hiddenFromWriter ? presetKey : 'collect';
  const preset = MULTI_PRESETS[activeKey] || MULTI_PRESETS.collect;
  const standardHidden = activeKey === 'drip' ? 'style="display:none"' : '';

  return `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}" data-preset-key="${esc(activeKey)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="multi-back-type" type="button">←</button>
        <h1 class="write-step-title">소소킹 올리기</h1>
      </div>
      <div class="card">
        <div class="card__body--lg">
          ${renderOptionPicker(activeKey)}
          ${renderOptionPanels(activeKey)}
          ${renderDripLineField(activeKey)}
          <div data-write-section="standard-fields" ${standardHidden}>
            <div class="form-group">
              <label class="form-label">제목 <span class="required">*</span></label>
              <input id="mw-title" class="form-input" maxlength="100" placeholder="${esc(preset.titlePlaceholder)}">
            </div>
            <div class="form-group">
              <label class="form-label">내용</label>
              <textarea id="mw-desc" class="form-textarea mw-desc-resizable" rows="4" maxlength="2000" placeholder="${esc(preset.descPlaceholder)}"></textarea>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">사진 첨부</label>
            <div id="mw-img-uploader"></div>
            <div class="form-hint">웃긴 그림 모음은 사진 첨부 또는 이미지 URL 중 하나만 있어도 됩니다.</div>
          </div>
          <div class="form-group">
            <div class="multi-tag-label-row">
              <label class="form-label" for="mw-tags">태그</label>
              <button class="btn btn--ghost btn--sm" type="button" id="mw-auto-tags">자동 생성</button>
            </div>
            <input id="mw-tags" class="form-input" maxlength="100" placeholder="${esc(preset.tagsPlaceholder)}">
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
