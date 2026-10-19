// 프로필 사진이 로드에 실패하면, 먼저 구글 기본 크기(=s96-c)로 한 번 되돌려
// 재시도하고, 그래도 실패하면 닉네임 기반 자동 생성 아이콘으로 바꿔준다.
//
// 구글 프로필 이미지(lh*.googleusercontent.com)는 원본 크기(=s96-c)는 잘 주면서도
// 즉석에서 리사이즈한 변형(=s176-c 등)에는 간헐적으로 403/429를 돌려준다. 그래서
// 실패 시 곧바로 자동 생성 아이콘으로 떨어뜨리지 않고, 기본 크기로 한 번 더
// 시도해 실제 프로필 사진을 최대한 보여준다.
//
// CSP에 script-src-attr 'none'이 걸려 있어 img 태그의 인라인 오류 핸들러 속성은
// 무시된다. 그래서 문서 전체에 위임 리스너를 건다. error 이벤트는 버블링하지
// 않으므로 캡처 단계에서 받아야 한다.

const FALLBACK_ATTRIBUTE = 'data-avatar-fallback';

// 구글 프로필 사진의 리사이즈 접미사(...=s{n}-c). 기본 크기로 되돌릴 때 쓴다.
const GOOGLE_RESIZE = /^(https:\/\/(?:lh[0-9]+\.googleusercontent\.com|[a-z0-9-]+\.ggpht\.com)\/\S*?=s)\d+(?:-c)?$/i;

function nextAvatarSrc(image) {
  const current = image.src || '';

  // 1) 리사이즈 변형이 실패했으면 구글 기본 크기(=s96-c)로 딱 한 번 되돌린다.
  const resized = current.match(GOOGLE_RESIZE);
  if (resized && image.dataset.avatarRetriedDefault !== '1') {
    image.dataset.avatarRetriedDefault = '1';
    const retry = `${resized[1]}96-c`;
    if (retry !== current) return retry;
  }

  // 2) 그래도 실패하면 닉네임 기반 자동 생성 아이콘으로 확정한다.
  return image.getAttribute(FALLBACK_ATTRIBUTE) || '';
}

function applyFallback(image) {
  if (!(image instanceof HTMLImageElement)) return;
  // 자동 생성 아이콘까지 적용된 뒤에는 더 손대지 않는다(무한 루프 방지).
  if (image.dataset.avatarFallbackApplied === '1') return;

  const next = nextAvatarSrc(image);
  if (!next || image.src === next) return;

  if (next === image.getAttribute(FALLBACK_ATTRIBUTE)) image.dataset.avatarFallbackApplied = '1';
  image.src = next;
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

// SPA라 라우트가 바뀔 때마다 새 이미지가 들어온다. 아직 로딩 중인 이미지를
// 성급히 교체하지 않도록, 이미 실패한 상태(complete && naturalWidth === 0)일 때만
// 복구한다. (브라우저 캐시에 실패가 남아 삽입되자마자 실패인 경우까지 포함.)
const observer = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.(`img[${FALLBACK_ATTRIBUTE}]`)) {
        if (node.complete && node.naturalWidth === 0) applyFallback(node);
      } else {
        recoverBrokenImages(node);
      }
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
