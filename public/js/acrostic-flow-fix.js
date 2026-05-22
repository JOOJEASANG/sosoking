import { toast } from './components/toast.js';
import { getAcrosticLabel } from './multi-write/presets.js';

function isAcrosticWritePage() {
  return !!document.getElementById('f-keyword') && !!document.querySelector('.write-step-title')?.textContent?.includes('행시');
}

function esc(value) {
  return String(value || '').replace(/[&<>\"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[m] || m));
}

function removeOptionalAcrosticFields() {
  const desc = document.getElementById('f-desc')?.closest('.form-group');
  const tags = document.getElementById('f-tags')?.closest('.form-group');
  const uploader = document.getElementById('img-uploader')?.closest('.form-group');
  desc?.remove();
  tags?.remove();
  uploader?.remove();
}

function renderKeywordPreview(keyword) {
  const clean = String(keyword || '').trim();
  if (!clean) {
    return `
      <div class="acrostic-write-preview__empty">
        2~5글자 제시어를 입력하면 참여자가 작성할 줄이 자동으로 만들어져요.
      </div>`;
  }
  return [...clean].map(ch => `
    <div class="acrostic-write-preview__row">
      <span class="acrostic-write-preview__char">${esc(ch)}</span>
      <span class="acrostic-write-preview__line">${esc(ch)}(으)로 시작하는 한 줄</span>
    </div>`).join('');
}

function ensureAcrosticWriteFlow() {
  if (!isAcrosticWritePage()) return;
  const keyword = document.getElementById('f-keyword');
  if (!keyword || keyword.dataset.acrosticOnlyReady === '1') return;

  removeOptionalAcrosticFields();
  keyword.dataset.acrosticOnlyReady = '1';
  keyword.placeholder = '예: 소소킹 / 관리자 / 대한민국';
  keyword.maxLength = 5;

  const hint = keyword.closest('.form-group')?.querySelector('.form-hint');
  const updateHint = () => {
    const len = [...keyword.value.trim()].length;
    if (hint) hint.textContent = len >= 2 && len <= 5 ? `${len}글자라서 ${getAcrosticLabel(keyword.value)}로 자동 적용됩니다.` : '제시어는 2~5글자로 입력해주세요. 글자 수에 따라 이행시·삼행시·사행시·오행시로 자동 적용됩니다.';
  };
  updateHint();

  const guide = document.createElement('div');
  guide.className = 'acrostic-write-guide';
  guide.innerHTML = `
    <div class="acrostic-write-guide__title">✍️ 행시 참여 구조</div>
    <div class="acrostic-write-guide__desc">작성자는 제시어만 올리고, 참여자들이 글자별 한 줄을 채워 행시를 완성합니다.</div>
    <div class="acrostic-write-preview" id="acrostic-write-preview">${renderKeywordPreview(keyword.value)}</div>`;
  keyword.closest('.form-group')?.insertAdjacentElement('afterend', guide);

  const update = () => {
    updateHint();
    const preview = document.getElementById('acrostic-write-preview');
    if (preview) preview.innerHTML = renderKeywordPreview(keyword.value);
  };
  keyword.addEventListener('input', update);

  const submit = document.getElementById('btn-submit');
  if (submit && !submit.dataset.acrosticOnlySubmitGuard) {
    submit.dataset.acrosticOnlySubmitGuard = '1';
    submit.addEventListener('click', () => {
      const len = [...keyword.value.trim()].length;
      if (len > 0 && (len < 2 || len > 5)) toast.warn('제시어는 2~5글자로 입력해주세요');
    }, true);
  }
}

function enhanceAcrosticDetail() {
  const submitArea = document.getElementById('acrostic-submit-lines');
  if (!submitArea || submitArea.dataset.enhanced === '1') return;
  submitArea.dataset.enhanced = '1';
  submitArea.closest('[style*="padding:20px"]')?.classList.add('acrostic-submit-card');
  submitArea.querySelectorAll('.acrostic-submit-input').forEach(input => {
    const ch = input.closest('.acrostic-line')?.querySelector('.acrostic-char')?.textContent?.trim() || '';
    input.placeholder = ch ? `${ch}(으)로 시작하는 재밌는 한 줄` : '한 줄을 입력하세요';
    input.maxLength = 80;
  });
}

function run() {
  ensureAcrosticWriteFlow();
  enhanceAcrosticDetail();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, 120);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);