// 프로필 사진이 로드에 실패하면 닉네임 기반 자동 생성 아이콘으로 바꿔준다.
//
// 구글 프로필 이미지(lh*.googleusercontent.com)는 간헐적으로 403/429를 돌려주고,
// 그때 브라우저 기본 '깨진 이미지' 아이콘이 그대로 노출된다.
//
// CSP에 script-src-attr 'none'이 걸려 있어 img 태그의 인라인 오류 핸들러 속성은
// 무시된다. 그래서 문서 전체에 위임 리스너를 건다. error 이벤트는 버블링하지
// 않으므로 캡처 단계에서 받아야 한다.

const FALLBACK_ATTRIBUTE = 'data-avatar-fallback';

function applyFallback(image) {
  if (!(image instanceof HTMLImageElement)) return;

  const fallback = image.getAttribute(FALLBACK_ATTRIBUTE);
  if (!fallback) return;

  // 대체 이미지마저 실패하는 경우 무한 루프를 막는다.
  if (image.dataset.avatarFallbackApplied === '1') return;
  image.dataset.avatarFallbackApplied = '1';

  if (image.src !== fallback) image.src = fallback;
}

document.addEventListener('error', event => applyFallback(event.target), true);

// 리스너가 붙기 전에 이미 실패한 이미지도 복구한다.
// (complete이면서 naturalWidth가 0이면 로드에 실패한 상태다.)
function recoverBrokenImages(root = document) {
  for (const image of root.querySelectorAll?.(`img[${FALLBACK_ATTRIBUTE}]`) || []) {
    if (image.complete && image.naturalWidth === 0) applyFallback(image);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => recoverBrokenImages(), { once: true });
} else {
  recoverBrokenImages();
}

// SPA라 라우트가 바뀔 때마다 새 이미지가 들어온다. 이미 실패한 채로
// 삽입되는 경우(브라우저 캐시에 실패가 남은 경우)까지 훑는다.
const observer = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.(`img[${FALLBACK_ATTRIBUTE}]`)) applyFallback(node);
      else recoverBrokenImages(node);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
