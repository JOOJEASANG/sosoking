import { MULTI_PRESETS, BODY_LABELS, BODY_REQUIRED_PRESETS } from './presets.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function renderPresetButtons(activeKey) {
  return `
    <div class="multi-preset-box multi-preset-box--simple">
      <div class="multi-preset-box__title">글쓰기 형식</div>
      <div class="multi-preset-box__desc">익명은 일반글 안에서 선택할 수 있습니다.</div>
      <div class="multi-preset-list">
        ${Object.entries(MULTI_PRESETS).map(([key, preset]) => `
          <button type="button" class="multi-preset-btn ${activeKey === key ? 'active' : ''}" data-multi-preset="${key}" aria-pressed="${activeKey === key ? 'true' : 'false'}">
            ${preset.icon} ${preset.label}
          </button>`).join('')}
      </div>
    </div>`;
}

function moduleCard(key, icon, title, desc, body) {
  return `
    <div class="multi-module is-enabled multi-module--selected" data-module-card="${key}">
      <input type="hidden" data-module-toggle="${key}" value="1">
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

function renderGeneralExtras() {
  return `
    <div class="multi-general-note"><b>일반글</b><span>자유롭게 올리고, 필요하면 익명으로 숨길 수 있습니다.</span></div>
    ${renderAnonymousSwitch()}
    <div class="form-group multi-youtube-box">
      <label class="form-label">유튜브 링크</label>
      <input id="mw-youtube-url" class="form-input" maxlength="220" placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=...">
      <div class="form-hint">일반글에 유튜브 링크를 넣으면 상세페이지에서 16:9 영상 화면으로 자동 표시됩니다.</div>
    </div>`;
}

function renderSelectedModule(activeKey, preset) {
  if (activeKey === 'general') return renderGeneralExtras();

  if (activeKey === 'vote') {
    return moduleCard('vote', '🗳️', '투표/판정', '본문을 기준으로 사용자가 선택지에 투표하고 댓글로 토론합니다.', `
      <div class="multi-option-list" id="mw-vote-options">
        ${preset.voteOptionPlaceholders.map((value, i) => `<input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 ${i + 1} · 예: ${esc(value)}">`).join('')}
      </div>
      <button class="btn btn--ghost btn--sm" type="button" id="mw-add-vote-option">+ 선택지 추가</button>`);
  }

  if (activeKey === 'fill') {
    return moduleCard('fill', '🧩', '빈칸 채우기', '스페이스바 여러 칸, ___, □□□를 빈칸으로 인식하고 줄바꿈을 유지합니다.', `
      <div class="multi-module-inline-note">
        본문에 문제 문장을 쓰다가 <b>스페이스바를 2칸 이상 연속</b>으로 누르면 그 부분이 빈칸이 됩니다.<br>
        기존 방식처럼 <b>___</b> 또는 <b>□□□</b>를 넣어도 빈칸으로 인식합니다.<br>
        한 줄 띄우기와 문단 구분은 상세페이지에서 그대로 표시됩니다.
      </div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">빈칸별 칸 수 선택 입력</label>
        <input id="mw-fill-counts" class="form-input" maxlength="60" placeholder="비워두면 스페이스/밑줄/□ 개수로 자동 계산 · 예: 3, 4, 2">
        <input type="hidden" id="mw-fill-count" value="4">
        <div class="form-hint">예: “나는   을 좋아한다”처럼 스페이스 3칸을 넣으면 3글자 빈칸이 됩니다. 직접 칸 수를 지정하려면 쉼표로 입력하세요.</div>
      </div>`);
  }

  if (activeKey === 'naming') {
    return moduleCard('naming', '😜', '미친작명소', '다른 사용자가 웃긴 이름을 등록할 수 있습니다.', `
      <div class="form-group">
        <label class="form-label">글자수 제한</label>
        <input type="hidden" id="mw-naming-count" value="0">
        <div class="multi-choice-toggle" role="radiogroup" aria-label="글자수 제한 선택">
          <button type="button" class="multi-choice-toggle__btn active" data-naming-count="0" role="radio" aria-checked="true">자유</button>
          <button type="button" class="multi-choice-toggle__btn" data-naming-count="3" role="radio" aria-checked="false">3글자</button>
          <button type="button" class="multi-choice-toggle__btn" data-naming-count="5" role="radio" aria-checked="false">5글자</button>
        </div>
      </div>`);
  }

  if (activeKey === 'acrostic') {
    return moduleCard('acrostic', '✍️', '삼행시', '제시어를 입력하면 다른 사용자가 글자별로 한 줄씩 작성할 수 있습니다.', `
      <div class="form-group">
        <label class="form-label">제시어 <span class="required">*</span></label>
        <input id="mw-acrostic-keyword" class="form-input" maxlength="8" placeholder="${esc(preset.acrosticPlaceholder)}">
      </div>`);
  }

  if (activeKey === 'relay') {
    return moduleCard('relay', '🎭', '막장릴레이', '참여자가 시작 문장 뒤로 이야기를 이어갑니다.', `<div class="multi-module-inline-note">본문에 릴레이 시작 문장이나 상황을 적어주세요.</div>`);
  }

  if (activeKey === 'quiz') {
    return moduleCard('quiz', '🧠', '미친퀴즈', '본문에 적은 문제를 기준으로 정답 기능을 설정합니다.', `
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
      </div>`);
  }

  return '';
}

function renderGamePreview() {
  return `
    <div class="multi-game-preview" id="mw-game-preview">
      <div class="multi-game-preview__head">
        <span>🎮 참여 미리보기</span>
        <small>작성 중인 글이 어떻게 보일지 확인하세요.</small>
      </div>
      <div class="multi-game-preview__body" id="mw-preview-body"></div>
    </div>`;
}

function renderDeadlineSettings() {
  return `
    <div class="multi-deadline-box" id="mw-deadline-box" data-deadline-enabled="0">
      <div class="multi-deadline-box__head">
        <div><b>⏰ 마감/결과 공개</b><small>가입 회원 50명부터 활성화됩니다.</small></div>
        <span id="mw-member-gate-badge">확인 중</span>
      </div>
      <div id="mw-deadline-locked" class="multi-deadline-locked">회원 수를 확인하는 중입니다.</div>
      <div id="mw-deadline-options" class="multi-deadline-options" style="display:none">
        <input type="hidden" id="mw-deadline-mode" value="none">
        <button type="button" class="multi-deadline-option active" data-deadline-mode="none">마감 없음</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="1h">1시간</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="24h">24시간</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="manual">직접 마감</button>
      </div>
      <div class="form-hint" id="mw-deadline-hint">마감 기능은 회원이 50명 이상일 때 글쓰기에서 선택할 수 있습니다.</div>
    </div>`;
}

export function renderMultiWriteHTML({ renderKey, presetKey }) {
  const preset = MULTI_PRESETS[presetKey] || MULTI_PRESETS.general;
  const bodyRequired = BODY_REQUIRED_PRESETS.includes(presetKey);
  const bodyLabel = BODY_LABELS[presetKey] || '본문';

  return `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}" data-preset-key="${esc(presetKey)}">
      <div class="write-step-header">
        <button class="write-back-btn" id="multi-back-type" type="button">←</button>
        <h1 class="write-step-title">🧩 피드 글쓰기</h1>
      </div>
      ${renderPresetButtons(presetKey)}
      <div class="card">
        <div class="card__body--lg">
          <div class="form-group">
            <label class="form-label">제목 <span class="required">*</span></label>
            <input id="mw-title" class="form-input" maxlength="100" placeholder="${esc(preset.titlePlaceholder)}">
          </div>
          <div class="form-group">
            <label class="form-label">${bodyLabel}${bodyRequired ? ' <span class="required">*</span>' : ''}</label>
            <textarea id="mw-desc" class="form-textarea" rows="4" maxlength="2000" placeholder="${esc(preset.descPlaceholder)}"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">사진</label>
            <div id="mw-img-uploader"></div>
            <div class="form-hint">사진 개수 제한 없이 올릴 수 있어요.</div>
          </div>
          <div class="form-group">
            <div class="multi-tag-label-row">
              <label class="form-label" for="mw-tags">태그</label>
              <button class="btn btn--ghost btn--sm" type="button" id="mw-auto-tags">자동 생성</button>
            </div>
            <input id="mw-tags" class="form-input" maxlength="100" placeholder="${esc(preset.tagsPlaceholder)}">
            <div class="form-hint">비워두고 올려도 제목과 본문을 기준으로 태그가 자동 생성됩니다.</div>
          </div>
          <div class="multi-module-list multi-module-list--selected">${renderSelectedModule(presetKey, preset)}</div>
          ${renderGamePreview()}
          ${renderDeadlineSettings()}
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