// admin-ai-type-patch.js
// 관리자 AI 게시글 생성 선택지를 현재 AI 수동 생성 패널 기준으로 고정합니다.

const DESIRED_TYPES = [
  { value: 'collect', label: '모음방 — 유튜브·웃긴그림·링크 모음' },
  { value: 'vote', label: '토론방 — 선택지 토론 글' },
  { value: 'quiz', label: '퀴즈방 — 주관식·객관식 퀴즈' },
  { value: 'drip', label: '드립방 — 오늘의 한줄' },
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
