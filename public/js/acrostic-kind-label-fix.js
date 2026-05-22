import { getAcrosticLabel } from './multi-write/presets.js';

function keywordChars(value = '') {
  return [...String(value || '').trim()];
}

function labelForKeyword(value = '') {
  return getAcrosticLabel(String(value || '').trim());
}

function patchWriteAcrosticUI() {
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
    });
  });

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

function patch() {
  patchWriteAcrosticUI();
  patchDetailAcrosticUI();
  patchCardsAndLabels();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(patch, 80);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('input', event => {
  if (event.target?.id === 'mw-acrostic-keyword') schedule();
}, true);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(patch, 400);
