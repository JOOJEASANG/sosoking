// admin-ai-type-patch.js
// 관리자 AI 데이터 수동 생성 선택지를 토론/드립 2개로 고정합니다.

const DESIRED_TYPES = [
  { value: 'vote', label: '토론 - VS 토론 글' },
  { value: 'drip', label: '드립 - 드립 글' },
];

function patchAiTypeSelect() {
  const select = document.getElementById('ai-content-preset');
  if (!select) return;
  const expected = DESIRED_TYPES.map(type => type.value).join('|');
  if (select.dataset.communityTypes === expected) return;
  select.innerHTML = DESIRED_TYPES
    .map(type => `<option value="${type.value}">${type.label}</option>`)
    .join('');
  select.dataset.communityTypes = expected;
}

function patchAllButtonText() {
  const button = document.getElementById('btn-ai-content-all');
  if (!button) return;
  if (/4종|모두/.test(button.textContent || '')) button.textContent = '토론+드립 생성';
}

let timer = null;
function schedulePatch() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    patchAiTypeSelect();
    patchAllButtonText();
  }, 80);
}

new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedulePatch);
window.addEventListener('sosoking:extensions-ready', schedulePatch);
setTimeout(schedulePatch, 300);
