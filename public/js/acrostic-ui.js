import { toast } from './components/toast.js';
import { getAcrosticLabel } from './multi-write/presets.js';

function esc(value) {
  return String(value || '').replace(/[&<>\"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[m] || m));
}

function keywordChars(value = '') {
  return [...String(value || '').trim()];
}

function labelForKeyword(value = '') {
  return getAcrosticLabel(String(value || '').trim());
}

function isLegacyAcrosticWritePage() {
  return !!document.getElementById('f-keyword') && !!document.querySelector('.write-step-title')?.textContent?.includes('행시');
}

function removeOptionalLegacyAcrosticFields() {
  document.getElementById('f-desc')?.closest('.form-group')?.remove();
  document.getElementById('f-tags')?.closest('.form-group')?.remove();
  document.getElementById('img-uploader')?.closest('.form-group')?.remove();
}

function renderLegacyKeywordPreview(keyword) {
  const clean = String(keyword || '').trim();
  if (!clean) {
    return `<div class="acrostic-write-preview__empty">2~5글자 제시어를 입력하면 참여자가 작성할 줄이 자동으로 만들어져요.</div>`;
  }
  return [...clean].map(ch => `
    <div class="acrostic-write-preview__row">
      <span class="acrostic-write-preview__char">${esc(ch)}</span>
      <span class="acrostic-write-preview__line">${esc(ch)}(으)로 시작하는 한 줄</span>
    </div>`).join('');
}

function ensureLegacyAcrosticWriteFlow() {
  if (!isLegacyAcrosticWritePage()) return;
  const keyword = document.getElementById('f-keyword');
  if (!keyword || keyword.dataset.acrosticOnlyReady === '1') return;

  removeOptionalLegacyAcrosticFields();
  keyword.dataset.acrosticOnlyReady = '1';
  keyword.placeholder = '예: 소소킹 / 관리자 / 대한민국';
  keyword.maxLength = 5;

  const hint = keyword.closest('.form-group')?.querySelector('.form-hint');
  const updateHint = () => {
    const len = keywordChars(keyword.value).length;
    if (hint) {
      hint.textContent = len >= 2 && len <= 5
        ? `${len}글자라서 ${labelForKeyword(keyword.value)}로 자동 적용됩니다.`
        : '제시어는 2~5글자로 입력해주세요. 글자 수에 따라 이행시·삼행시·사행시·오행시로 자동 적용됩니다.';
    }
  };
  updateHint();

  const guide = document.createElement('div');
  guide.className = 'acrostic-write-guide';
  guide.innerHTML = `
    <div class="acrostic-write-guide__title">✍️ 행시 참여 구조</div>
    <div class="acrostic-write-guide__desc">작성자는 제시어만 올리고, 참여자들이 글자별 한 줄을 채워 행시를 완성합니다.</div>
    <div class="acrostic-write-preview" id="acrostic-write-preview">${renderLegacyKeywordPreview(keyword.value)}</div>`;
  keyword.closest('.form-group')?.insertAdjacentElement('afterend', guide);

  keyword.addEventListener('input', () => {
    updateHint();
    const preview = document.getElementById('acrostic-write-preview');
    if (preview) preview.innerHTML = renderLegacyKeywordPreview(keyword.value);
  });

  const submit = document.getElementById('btn-submit');
  if (submit && !submit.dataset.acrosticOnlySubmitGuard) {
    submit.dataset.acrosticOnlySubmitGuard = '1';
    submit.addEventListener('click', () => {
      const len = keywordChars(keyword.value).length;
      if (len > 0 && (len < 2 || len > 5)) toast.warn('제시어는 2~5글자로 입력해주세요');
    }, true);
  }
}

function patchModernWriteAcrosticUI() {
  const input = document.getElementById('mw-acrostic-keyword');
  if (!input) return;
  input.maxLength = 5;

  let hint = document.getElementById('mw-acrostic-kind-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'mw-acrostic-kind-hint';
    hint.className = 'form-hint';
    input.insertAdjacentElement('afterend', hint);
  }

  const chars = keywordChars(input.value);
  if (!chars.length) hint.textContent = '2~5글자까지 입력 가능해요. 글자 수에 따라 이행시·삼행시·사행시·오행시로 자동 적용됩니다.';
  else if (chars.length < 2) hint.textContent = '한 글자 더 입력하면 이행시부터 만들 수 있어요.';
  else hint.textContent = `${chars.length}글자 제시어라서 ${labelForKeyword(input.value)}로 자동 적용됩니다.`;

  const moduleTitle = document.querySelector('[data-module-card="acrostic"] .multi-module__text b');
  if (moduleTitle) moduleTitle.textContent = chars.length >= 2 ? labelForKeyword(input.value) : '이행시·삼행시·사행시·오행시';

  const preview = document.getElementById('mw-preview-body');
  const previewAcrostic = preview?.querySelector('.multi-preview-acrostic');
  if (preview && previewAcrostic) {
    let rule = preview.querySelector('[data-acrostic-auto-label]');
    if (!rule) {
      rule = document.createElement('div');
      rule.className = 'multi-preview-rule';
      rule.dataset.acrosticAutoLabel = '1';
      previewAcrostic.insertAdjacentElement('beforebegin', rule);
    }
    rule.textContent = chars.length >= 2 ? `자동 형식: ${labelForKeyword(input.value)}` : '자동 형식: 제시어 입력 대기';
  }
}

function patchDetailAcrosticUI() {
  document.querySelectorAll('[data-multi-module="acrostic"]').forEach(module => {
    const chars = [...module.querySelectorAll('.multi-acrostic-line > span')].map(el => el.textContent || '').filter(Boolean);
    if (!chars.length) return;
    const keyword = chars.join('');
    const label = labelForKeyword(keyword);

    const title = module.querySelector('.multi-detail-module__title');
    if (title) title.textContent = `✍️ '${keyword}' ${label}`;

    const submit = module.querySelector('#multi-acrostic-submit');
    if (submit) submit.textContent = `${label} 올리기`;

    module.querySelectorAll('.multi-acrostic-input').forEach((input, index) => {
      const ch = chars[index] || '';
      input.placeholder = `${ch}(으)로 시작하는 한 줄`;
      input.maxLength = 80;
    });
  });

  const legacySubmitArea = document.getElementById('acrostic-submit-lines');
  if (legacySubmitArea && legacySubmitArea.dataset.enhanced !== '1') {
    legacySubmitArea.dataset.enhanced = '1';
    legacySubmitArea.closest('[style*="padding:20px"]')?.classList.add('acrostic-submit-card');
    legacySubmitArea.querySelectorAll('.acrostic-submit-input').forEach(input => {
      const ch = input.closest('.acrostic-line')?.querySelector('.acrostic-char')?.textContent?.trim() || '';
      input.placeholder = ch ? `${ch}(으)로 시작하는 재밌는 한 줄` : '한 줄을 입력하세요';
      input.maxLength = 80;
    });
  }

  document.querySelectorAll('.multi-best-card__head span').forEach(el => {
    if (el.textContent && el.textContent.includes('베스트 삼행시')) el.textContent = '🏆 베스트 행시';
  });
}

function patchCardsAndLabels() {
  document.querySelectorAll('.feed-card, .admin-table tr, .admin-recent-post').forEach(root => {
    root.querySelectorAll('*').forEach(el => {
      if (el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE && el.textContent.trim() === '삼행시') {
        el.textContent = '행시';
      }
    });
  });
}

function patchAcrosticUI() {
  ensureLegacyAcrosticWriteFlow();
  patchModernWriteAcrosticUI();
  patchDetailAcrosticUI();
  patchCardsAndLabels();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(patchAcrosticUI, 80);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('input', event => {
  if (event.target?.id === 'mw-acrostic-keyword' || event.target?.id === 'f-keyword') schedule();
}, true);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(patchAcrosticUI, 400);
