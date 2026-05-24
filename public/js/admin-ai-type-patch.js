// admin-ai-type-patch.js
// 관리자 AI 게시글 생성 선택지를 현재 공개 글쓰기 유형과 맞춥니다.

const DESIRED_TYPES = [
  { value: 'general', label: '일반' },
  { value: 'vote', label: '투표' },
  { value: 'naming', label: '작명' },
  { value: 'drip', label: '드립' },
  { value: 'quiz', label: '퀴즈' },
];

function patchAiTypeSelect() {
  const select = document.getElementById('ai-content-preset');
  if (!select || select.dataset.dripPatchReady === '1') return;
  select.innerHTML = DESIRED_TYPES
    .map(type => `<option value="${type.value}">${type.label}</option>`)
    .join('');
  select.dataset.dripPatchReady = '1';
}

let timer = null;
function schedulePatch() {
  clearTimeout(timer);
  timer = setTimeout(patchAiTypeSelect, 80);
}

new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedulePatch);
setTimeout(schedulePatch, 500);