// admin-ai-type-patch.js
// 관리자 AI 데이터 수동 생성 선택지를 커뮤니티 데이터 기준으로 고정합니다.

const DESIRED_TYPES = [
  { value: 'judgment', label: '판결 — 사소한 사건 판정 커뮤니티 글' },
  { value: 'consult', label: '상담 — 웃기지만 은근 쓸모 있는 고민 상담 글' },
  { value: 'vote', label: '토론 — 찬성·반대 의견 커뮤니티 글' },
  { value: 'drip', label: '드립 — 한 줄 드립 배틀 커뮤니티 글' },
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

let timer = null;
function schedulePatch() {
  clearTimeout(timer);
  timer = setTimeout(patchAiTypeSelect, 80);
}

new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedulePatch);
window.addEventListener('sosoking:extensions-ready', schedulePatch);
setTimeout(schedulePatch, 300);
