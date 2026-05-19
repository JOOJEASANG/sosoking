import { toast } from './components/toast.js';

function isAcrosticWritePage() {
  return !!document.getElementById('f-keyword') && !!document.querySelector('.write-step-title')?.textContent?.includes('삼행시');
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
        제시어를 입력하면 참여자가 작성할 줄이 자동으로 만들어져요.
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
  keyword.placeholder = '예: 소소킹';
  keyword.maxLength = 8;

  const hint = keyword.closest('.form-group')?.querySelector('.form-hint');
  if (hint) hint.textContent = '제시어만 입력하면 됩니다. 참여자가 각 글자 옆에 한 줄씩 삼행시를 작성합니다.';

  const guide = document.createElement('div');
  guide.className = 'acrostic-write-guide';
  guide.innerHTML = `
    <div class="acrostic-write-guide__title">✍️ 삼행시 참여 구조</div>
    <div class="acrostic-write-guide__desc">작성자는 제시어만 올리고, 참여자들이 아래처럼 글자별 한 줄을 채워 삼행시를 완성합니다.</div>
    <div class="acrostic-write-preview" id="acrostic-write-preview">${renderKeywordPreview(keyword.value)}</div>`;
  keyword.closest('.form-group')?.insertAdjacentElement('afterend', guide);

  const update = () => {
    const preview = document.getElementById('acrostic-write-preview');
    if (preview) preview.innerHTML = renderKeywordPreview(keyword.value);
  };
  keyword.addEventListener('input', update);

  const submit = document.getElementById('btn-submit');
  if (submit && !submit.dataset.acrosticOnlySubmitGuard) {
    submit.dataset.acrosticOnlySubmitGuard = '1';
    submit.addEventListener('click', () => {
      const len = [...keyword.value.trim()].length;
      if (len > 0 && len < 2) toast.warn('제시어는 2글자 이상이 좋아요');
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
