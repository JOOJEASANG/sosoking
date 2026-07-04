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
      <div class="mw-room-picker__label">콘텐츠 선택 <small style="font-weight:500;color:var(--color-text-muted)">토론 · 드립</small></div>
      <input type="hidden" id="mw-selected-preset" value="${esc(activeKey)}">
      <div class="mw-room-nav">
        ${WRITER_PRESET_KEYS.map(key => {
          const preset = MULTI_PRESETS[key];
          const label = preset.buttonLabel || preset.label;
          return `<button type="button" class="mw-room-btn mw-room-btn--${esc(key)} ${activeKey === key ? 'active' : ''}" data-multi-preset="${key}" aria-pressed="${activeKey === key ? 'true' : 'false'}">
            <span class="mw-room-btn__icon">${esc(preset.icon)}</span>
            <span class="mw-room-btn__label">${esc(label)}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function renderVoteModule(activeKey) {
  return `
    <div class="mw-vote-compact" data-module-card="vote" data-option-panel="vote" ${activeKey === 'vote' ? '' : 'style="display:none"'}>
      ${moduleToggleInput('vote', activeKey)}
      <div class="form-group">
        <label class="form-label">VS 선택지 <span class="required">*</span></label>
        <div class="multi-option-list" id="mw-vote-options">
          <input class="form-input mw-vote-option" maxlength="80" placeholder="왼쪽 선택지 입력">
          <input class="form-input mw-vote-option" maxlength="80" placeholder="오른쪽 선택지 입력">
        </div>
        <div class="form-hint">두 선택지를 직접 적으면 유저들이 VS 투표로 참여합니다.</div>
      </div>
    </div>`;
}

function renderDripModule(activeKey) {
  return `
    <div class="mw-vote-compact" data-module-card="drip" data-option-panel="drip" ${activeKey === 'drip' ? '' : 'style="display:none"'}>
      ${moduleToggleInput('drip', activeKey)}
      <div class="form-group">
        <label class="form-label">드립 안내</label>
        <div class="form-hint">작명, 번역, 말투 변환, 근황, 한 줄 드립처럼 웃긴 말로 바꿀 소재를 올려주세요.</div>
      </div>
    </div>`;
}

function labelsFor(activeKey) {
  const preset = MULTI_PRESETS[activeKey] || MULTI_PRESETS.drip;
  return {
    title: preset.titleLabel || '제목',
    content: preset.descLabel || '내용',
    required: '',
  };
}

export function renderMultiWriteHTML({ renderKey, presetKey }) {
  const activeKey = MULTI_PRESETS[presetKey] ? presetKey : 'drip';
  const preset = MULTI_PRESETS[activeKey] || MULTI_PRESETS.drip;
  const fieldLabels = labelsFor(activeKey);

  return `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}" data-preset-key="${esc(activeKey)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="multi-back-type" type="button">←</button>
        <h1 class="write-step-title">소소킹 글쓰기</h1>
      </div>
      <div class="card">
        <div class="card__body--lg">
          ${renderOptionPicker(activeKey)}
          <div data-write-section="standard-fields">
            <div class="form-group">
              <label class="form-label" data-field-label="title">${esc(fieldLabels.title)} <span class="required">*</span></label>
              <input id="mw-title" class="form-input" maxlength="100" placeholder="${esc(preset.titlePlaceholder)}">
            </div>
            <div class="form-group" data-write-section="content-field">
              <label class="form-label" data-field-label="desc">${esc(fieldLabels.content)} ${fieldLabels.required}</label>
              <textarea id="mw-desc" class="form-textarea mw-desc-resizable" rows="4" maxlength="2000" placeholder="${esc(preset.descPlaceholder)}"></textarea>
            </div>
          </div>
          <div class="form-group" data-write-section="media-field">
            <label class="form-label">사진 첨부 <small style="font-weight:400;color:var(--color-text-muted)">선택사항</small></label>
            <div id="mw-img-uploader"></div>
            <div class="form-hint">사진은 선택사항입니다. 첨부하면 AI 캐릭터가 이미지까지 보고 토론/드립을 만듭니다.</div>
          </div>
          <div data-write-section="vote-panel" ${activeKey === 'vote' ? '' : 'style="display:none"'}>${renderVoteModule(activeKey)}</div>
          <div data-write-section="drip-panel" ${activeKey === 'drip' ? '' : 'style="display:none"'}>${renderDripModule(activeKey)}</div>
          <div class="form-group">
            <label class="form-label" for="mw-tags">태그</label>
            <div class="mw-tags-row">
              <input id="mw-tags" class="form-input" maxlength="100" placeholder="${esc(preset.tagsPlaceholder)}">
              <button class="btn btn--ghost btn--sm" type="button" id="mw-auto-tags" style="white-space:nowrap;flex-shrink:0">자동 생성</button>
            </div>
          </div>
        </div>
        <div class="card__footer">
          <div class="write-submit">
            <button class="btn btn--ghost" type="button" id="multi-cancel">취소</button>
            <button class="btn btn--primary" type="button" id="multi-submit">등록하기</button>
          </div>
        </div>
      </div>
    </div>`;
}
