import { MULTI_PRESETS, WRITER_PRESET_KEYS, BODY_LABELS, BODY_REQUIRED_PRESETS } from './presets.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function renderPresetButtons(activeKey) {
  return `
    <div class="multi-preset-box multi-preset-box--simple">
      <div class="multi-preset-box__title">글쓰기 형식</div>
      <div class="multi-preset-box__desc">짧게 올리고, 댓글로 바로 놀 수 있는 형식만 남겼습니다.</div>
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
    ${renderAnonymousSwitch()}`;
}

function renderYoutubeInput() {
  return `
    <div class="form-group multi-youtube-box">
      <label class="form-label">유튜브 링크 <span style="font-weight:500;color:var(--color-text-muted)">(선택)</span></label>
      <input id="mw-youtube-url" class="form-input" maxlength="220" placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=...">
      <div class="form-hint">입력하면 상세페이지 본문 아래에 16:9 영상으로 자동 표시됩니다.</div>
    </div>`;
}

function renderSelectedModule(activeKey, preset) {
  if (activeKey === 'general') return renderGeneralExtras();

  if (activeKey === 'vote') {
    return `
      <div class="mw-vote-compact" data-module-card="vote">
        <input type="hidden" data-module-toggle="vote" value="1">
        <input type="hidden" id="mw-vote-mode" value="general">
        <div class="mw-vote-chips" role="radiogroup" aria-label="투표 형식">
          <button type="button" class="mw-vote-chip active" data-vote-mode="general" role="radio" aria-checked="true">🗳️ 일반</button>
          <button type="button" class="mw-vote-chip" data-vote-mode="balance" role="radio" aria-checked="false">⚖️ 밸런스</button>
          <button type="button" class="mw-vote-chip" data-vote-mode="judgment" role="radio" aria-checked="false">🔨 판정</button>
          <button type="button" class="mw-vote-chip" data-vote-mode="debate" role="radio" aria-checked="false">💬 토론</button>
        </div>
        <div id="mw-vote-mode-note" class="form-hint" style="display:none;margin:6px 0 10px"></div>
        <div class="multi-option-list" id="mw-vote-options">
          ${preset.voteOptionPlaceholders.map((value) => `<input class="form-input mw-vote-option" maxlength="80" placeholder="${esc(value)}">`).join('')}
        </div>
        <button class="btn btn--ghost btn--sm" type="button" id="mw-add-vote-option" style="margin-top:6px">+ 선택지 추가</button>
      </div>`;
  }

  if (activeKey === 'naming') {
    return moduleCard('naming', '😜', '작명', '다른 사용자가 웃긴 이름을 댓글로 올립니다.', `
      <div class="multi-module-inline-note">글자수 제한 없이 자유롭게 작명합니다.</div>`);
  }

  if (activeKey === 'drip') {
    return moduleCard('drip', '🤣', '드립', '주제에 맞는 한 줄 드립을 댓글처럼 남기는 참여형 글입니다.', `
      <div class="multi-module-inline-note">본문에 드립 주제를 적어주세요. 참여자는 80자 이내 한 줄 드립을 남깁니다.</div>`);
  }

  if (activeKey === 'quiz') {
    return moduleCard('quiz', '🧠', '퀴즈', '힌트와 해설을 넣어 더 게임답게 만들 수 있습니다.', `
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
    <div class="multi-deadline-box" id="mw-deadline-box" data-deadline-enabled="1">
      <div class="multi-deadline-box__head">
        <div><b>⏰ 마감/결과 공개</b><small>회원 50명 이상부터 사용할 수 있습니다.</small></div>
        <span id="mw-member-gate-badge">활성화</span>
      </div>
      <div id="mw-deadline-options" class="multi-deadline-options">
        <input type="hidden" id="mw-deadline-mode" value="none">
        <button type="button" class="multi-deadline-option active" data-deadline-mode="none">마감 없음</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="1h">1시간</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="24h">24시간</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="manual">직접 마감</button>
      </div>
      <div class="form-hint" id="mw-deadline-hint">마감 시간이 지나면 상세페이지에서 마감 상태로 표시됩니다.</div>
    </div>`;
}

export function renderMultiWriteHTML({ renderKey, presetKey, showDeadline = false }) {
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
            <textarea id="mw-desc" class="form-textarea mw-desc-resizable" rows="4" maxlength="2000" placeholder="${esc(preset.descPlaceholder)}"></textarea>
          </div>
          ${presetKey === 'general' ? renderYoutubeInput() : ''}
          <div class="form-group">
            <label class="form-label">사진</label>
            <div id="mw-img-uploader"></div>
            <div class="form-hint">사진은 최대 20장까지 올릴 수 있어요.</div>
          </div>
          <div class="form-group mw-imgurl-box">
            <label class="form-label">이미지 링크 <span style="font-weight:500;color:var(--color-text-muted)">(선택)</span></label>
            <div class="mw-imgurl-row">
              <input id="mw-imgurl-input" class="form-input" type="url" maxlength="512" placeholder="https://example.com/image.jpg">
              <button class="btn btn--secondary btn--sm" type="button" id="mw-imgurl-add">추가</button>
            </div>
            <div id="mw-imgurl-list" class="mw-imgurl-list"></div>
            <div class="form-hint">외부 이미지 URL을 직접 첨부할 수 있어요. 파일 업로드와 함께 사용 가능합니다.</div>
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
          ${showDeadline ? renderDeadlineSettings() : ''}
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