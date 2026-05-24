// admin-ai-type-patch.js
// 관리자 AI 게시글 생성 선택지를 현재 공개 글쓰기 유형과 맞춥니다.

const DESIRED_TYPES = [
  { value: 'general', label: '일반글 — 댓글 반응을 유도하는 일반 피드 글' },
  { value: 'vote', label: '투표/판정 — 선택지 투표가 가능한 게시글' },
  { value: 'naming', label: '미친작명소 — 댓글로 이름을 붙이는 게시글' },
  { value: 'drip', label: '미친드립 — 한 줄 드립을 남기는 게시글' },
  { value: 'quiz', label: '미친퀴즈 — 객관식 정답/해설이 있는 퀴즈 게시글' },
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
