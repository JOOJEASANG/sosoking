import { MULTI_PRESETS, BODY_LABELS, BODY_REQUIRED_PRESETS } from './presets.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function renderPresetButtons(activeKey) {
  return `
    <div class="multi-preset-box multi-preset-box--simple">
      <div class="multi-preset-box__title">글쓰기 형식</div>
      <div class="multi-preset-box__desc">형식을 선택하면 아래 입력 항목이 바뀝니다.</div>
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

function renderSelectedModule(activeKey, preset) {
  if (activeKey === 'general') {
    return `<div class="multi-general-note"><b>일반글</b><span>제목, 본문, 사진, 태그만 저장됩니다. 댓글과 답글만 사용할 수 있습니다.</span></div>`;
  }

  if (activeKey === 'vote') {
    return moduleCard('vote', '🗳️', '투표/판정', '본문을 기준으로 사용자가 선택지에 투표합니다.', `
      <div class="multi-option-list" id="mw-vote-options">
        ${preset.voteOptionPlaceholders.map((value, i) => `<input class="form-input mw-vote-option" maxlength="80" placeholder="선택지 ${i + 1} · 예: ${esc(value)}">`).join('')}
      </div>
      <button class="btn btn--ghost btn--sm" type="button" id="mw-add-vote-option">+ 선택지 추가</button>`);
  }

  if (activeKey === 'ox') {
    return moduleCard('ox', '⭕', 'OX판정', '본문 상황을 O 또는 X로 바로 판정받습니다.', `<div class="multi-fixed-options"><span>⭕ O</span><span>❌ X</span></div>`);
  }

  if (activeKey === 'fill') {
    return moduleCard('fill', '🧩', '빈줄 채우기', '작성자가 칸 수를 정하고 참여자가 칸에 맞춰 답을 채웁니다.', `
      <div class="multi-module-inline-note">본문에는 <b>___</b>를 넣어 빈칸 문장을 적어주세요. 예: 오늘 내 기분은 ___다.</div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">참여 답변 칸 수</label>
        <input type="hidden" id="mw-fill-count" value="4">
        <div class="multi-choice-toggle" role="radiogroup" aria-label="빈줄 채우기 칸 수 선택">
          <button type="button" class="multi-choice-toggle__btn" data-fill-count="2" role="radio" aria-checked="false">2칸</button>
          <button type="button" class="multi-choice-toggle__btn" data-fill-count="3" role="radio" aria-checked="false">3칸</button>
          <button type="button" class="multi-choice-toggle__btn active" data-fill-count="4" role="radio" aria-checked="true">4칸</button>
          <button type="button" class="multi-choice-toggle__btn" data-fill-count="5" role="radio" aria-checked="false">5칸</button>
          <button type="button" class="multi-choice-toggle__btn" data-fill-count="6" role="radio" aria-checked="false">6칸</button>
        </div>
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
    return moduleCard('quiz', '🧠', '미친퀴즈', '본문에 적은 문제를 기준으로 정답 기능만 설정합니다.', `
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

  if (activeKey === 'anonymous') {
    return moduleCard('anonymous', '🕶️', '익명', '작성자 닉네임을 숨기고 글이 올라갑니다.', `<div class="multi-anonymous-note">고민, 고백, 폭로 등 진지한 고민도 가능합니다.</div>`);
  }

  return '';
}

export function renderMultiWriteHTML({ renderKey, presetKey }) {
  const preset = MULTI_PRESETS[presetKey] || MULTI_PRESETS.general;
  const bodyRequired = BODY_REQUIRED_PRESETS.includes(presetKey);
  const bodyLabel = BODY_LABELS[presetKey] || '본문';

  return `
    <div class="write-page multi-write-page" data-render-key="${esc(renderKey)}">
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
            <label class="form-label">태그</label>
            <input id="mw-tags" class="form-input" maxlength="100" placeholder="${esc(preset.tagsPlaceholder)}">
          </div>
          <div class="multi-module-list multi-module-list--selected">${renderSelectedModule(presetKey, preset)}</div>
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
