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
        <div class="form-hint">판정, 선택, A/B 결정은 이 토론방에서 받으면 됩니다.</div>
      </div>
    </div>`;
}

function renderConsultModule(activeKey) {
  const hidden = activeKey === 'consult' ? '' : 'style="display:none"';
  return `
    <div class="mw-vote-compact" data-module-card="consult" data-option-panel="consult" ${hidden}>
      ${moduleToggleInput('consult', activeKey)}
      <div class="form-group">
        <label class="form-label">분야</label>
        <select id="mw-consult-topic" class="form-input">
          <option value="daily">일상</option>
          <option value="people">관계</option>
          <option value="work">직장/학교</option>
          <option value="money">소비/선택</option>
          <option value="vent">하소연</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">답변 스타일</label>
        <select id="mw-consult-style" class="form-input">
          <option value="empathy">공감</option>
          <option value="realistic">현실조언</option>
          <option value="choice">선택도움</option>
          <option value="soft">순한맛</option>
          <option value="funny">웃긴해결</option>
        </select>
      </div>
    </div>`;
}

export function renderMultiWriteHTML({ renderKey, presetKey }) {
  const activeKey = MULTI_PRESETS[presetKey] ? presetKey : 'collect';
  const preset = MULTI_PRESETS[activeKey] || MULTI_PRESETS.collect;
  const titleLabel = activeKey === 'vote' ? '찬반 토론 주제' : activeKey === 'consult' ? '고민 제목' : '제목';
  const contentLabel = activeKey === 'vote' ? '토론 설명' : activeKey === 'consult' ? '고민 설명' : '내용';
  const requiredMark = activeKey === 'consult' ? '<span class="required">*</span>' : '';

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
          <div data-write-section="consult-panel" ${activeKey === 'consult' ? '' : 'style="display:none"'}>${renderConsultModule(activeKey)}</div>
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
