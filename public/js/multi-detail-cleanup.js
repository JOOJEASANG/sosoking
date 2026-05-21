// multi-detail-cleanup.js
//
// 최신 참여 기능 렌더링은 public/js/multi-detail.js와 public/js/multi-detail/render.js가 담당합니다.
// 이 레거시 cleanup 파일은 렌더링된 참여 모듈을 다시 제거하거나 제목을 덮어써
// 여러 기능이 들어간 글에서 UI가 사라질 수 있어 비활성화합니다.

console.info('[multi-detail-cleanup] disabled: multi-detail.js owns participation UI');
