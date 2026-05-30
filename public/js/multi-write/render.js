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
      <div class="mw-room-picker__label">어느 방에 올릴까요?</div>
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

function renderTournamentItemRows() {
  return Array.from({ length: 16 }, (_, i) => `
    <div class="t-item-row" data-t-item-idx="${i}" ${i >= 8 ? 'style="display:none"' : ''}>
      <span class="t-item-num">${i + 1}</span>
      <input class="form-input t-item-name" maxlength="30" placeholder="항목 ${i + 1}" autocomplete="off">
      <button type="button" class="t-item-img-btn" data-t-img-btn="${i}" title="사진 추가">📷</button>
      <input type="file" class="t-item-file" accept="image/*" data-item-idx="${i}" style="display:none">
    </div>`).join('');
}

function renderTournamentPanel(activeKey) {
  return moduleCard('tournament', activeKey, '⚔️', '이상형 월드컵 설정', '항목을 입력하고 1위를 가려보세요.', `
    <div class="form-group">
      <label class="form-label">대결 규모 <span class="required">*</span></label>
      <div class="t-size-picker">
        <button type="button" class="t-size-btn" data-t-size="4">4강</button>
        <button type="button" class="t-size-btn active" data-t-size="8">8강</button>
        <button type="button" class="t-size-btn" data-t-size="16">16강</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">대결 항목 <span class="required">*</span> <small style="font-weight:400;color:var(--color-text-muted)">이름 필수 · 사진 선택</small></label>
      <div class="t-items-list" id="t-items-list">${renderTournamentItemRows()}</div>
    </div>`);
}


function renderVoteModule(activeKey) {
  return `
    <div class="mw-vote-compact" data-module-card="vote" data-option-panel="vote" ${activeKey === 'vote' ? '' : 'style="display:none"'}>
      ${moduleToggleInput('vote', activeKey)}
      <input type="hidden" id="mw-vote-mode" value="general">
      <div class="form-group">
        <label class="form-label">선택 옵션 <span class="required">*</span></label>
        <div class="multi-option-list" id="mw-vote-options">
          <input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 1">
          <input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 2">
        </div>
        <button class="btn btn--ghost btn--sm" type="button" id="mw-add-vote-option" style="margin-top:6px">+ 선택지 추가</button>
      </div>
    </div>`;
}

function renderDripModule(activeKey) {
  return moduleCard('drip', activeKey, '🤣', '드립방 참여 방식', '주제를 던지고, 댓글처럼 한 줄 드립을 받습니다.', `
    <div class="multi-module-inline-note">아래에 드립칠 주제만 적으면, 상세 페이지에서 사람들이 50자 이내 한 줄 드립으로 참여합니다.</div>`);
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

function renderDripTopicField(activeKey) {
  return `
    <div class="form-group mw-drip-line-box" data-write-section="drip-line" ${activeKey === 'drip' ? '' : 'style="display:none"'}>
      <label class="form-label">드립 주제</label>
      <input id="mw-drip-line" class="form-input mw-drip-line-input" maxlength="80" autocomplete="off" placeholder="예: 퇴근 5분 전 회의 잡힌 내 표정은?">
      <div class="form-hint">사람들이 한 줄 드립을 칠 수 있는 상황이나 주제를 던져주세요. 주제 최대 80자.</div>
    </div>`;
}

export function renderMultiWriteHTML({ renderKey, presetKey }) {
  const activeKey = MULTI_PRESETS[presetKey] && !MULTI_PRESETS[presetKey].hiddenFromWriter ? presetKey : 'tournament';
  const preset = MULTI_PRESETS[activeKey] || MULTI_PRESETS.tournament;
  const isTournament = activeKey === 'tournament';
  const standardHidden = activeKey === 'drip' ? 'style="display:none"' : '';
  const contentHidden = isTournament ? 'style="display:none"' : '';
  const mediaHidden = (activeKey === 'drip' || isTournament) ? 'style="display:none"' : '';
  const titleLabel = activeKey === 'vote' ? '토론 주제' : '제목';
  const contentLabel = activeKey === 'vote' ? '추가 설명' : activeKey === 'collect' ? '한줄 설명' : '내용';
  const requiredMark = (activeKey === 'vote' || activeKey === 'collect') ? '' : '<span class="required">*</span>';

  return `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}" data-preset-key="${esc(activeKey)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="multi-back-type" type="button">←</button>
        <h1 class="write-step-title">소소킹 올리기</h1>
      </div>
      <div class="card">
        <div class="card__body--lg">
          ${renderOptionPicker(activeKey)}
          ${renderCollectHidden(activeKey)}
          ${renderDripTopicField(activeKey)}
          <div data-write-section="standard-fields" ${standardHidden}>
            <div class="form-group">
              <label class="form-label">${titleLabel} <span class="required">*</span></label>
              <input id="mw-title" class="form-input" maxlength="100" placeholder="${esc(preset.titlePlaceholder)}">
            </div>
            <div class="form-group" data-write-section="content-field" ${contentHidden}>
              <label class="form-label">${contentLabel} ${requiredMark}</label>
              <textarea id="mw-desc" class="form-textarea mw-desc-resizable" rows="4" maxlength="2000" placeholder="${esc(preset.descPlaceholder)}"></textarea>
            </div>
          </div>
          <div class="form-group" data-write-section="media-field" ${mediaHidden}>
            <label class="form-label">사진 첨부</label>
            <div id="mw-img-uploader"></div>
            <div class="form-hint">사진은 선택사항입니다. 유튜브 링크 없이 사진만 첨부하면 웃긴그림 모음으로 등록됩니다.</div>
          </div>
          <div data-write-section="vote-panel" ${activeKey === 'vote' ? '' : 'style="display:none"'}>${renderVoteModule(activeKey)}</div>
          <div data-write-section="quiz-panel" ${activeKey === 'quiz' ? '' : 'style="display:none"'}>${renderQuizModule(activeKey)}</div>
          <div data-write-section="drip-panel" ${activeKey === 'drip' ? '' : 'style="display:none"'}>${renderDripModule(activeKey)}</div>
          <div data-write-section="tournament-panel" ${activeKey === 'tournament' ? '' : 'style="display:none"'}>${renderTournamentPanel(activeKey)}</div>
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
