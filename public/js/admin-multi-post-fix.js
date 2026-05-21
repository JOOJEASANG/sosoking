// admin-multi-post-fix.js
//
// 최신 관리자 게시물 관리는 public/js/pages/admin-safe.js가 담당합니다.
// 이 레거시 보정은 예전 테이블 열 번호를 기준으로 유형/카테고리/삭제 동작을 덮어써
// 최신 관리자 UI와 충돌할 수 있어 비활성화합니다.

console.info('[admin-multi-post-fix] disabled: admin-safe.js owns current post management UI');
