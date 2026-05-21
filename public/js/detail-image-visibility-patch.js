// detail-image-visibility-patch.js
//
// 상세 이미지 갤러리는 현재 public/js/pages/detail-safe.js에서 직접 렌더링하고,
// public/js/detail-actions-bootstrap.js의 갤러리 핸들러가 확대를 담당합니다.
// 이 레거시 패치는 이미지를 한 번 더 삽입하고 기존 갤러리를 숨겨 중복/누락을 만들 수 있어 비활성화합니다.

console.info('[detail-image-visibility-patch] disabled: detail-safe.js owns image gallery UI');
