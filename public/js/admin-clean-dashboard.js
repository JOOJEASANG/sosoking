// admin-clean-dashboard.js
//
// 현재 관리자 화면은 public/js/pages/admin-safe.js가 직접 정리된 UI로 렌더링합니다.
// 이 레거시 보정 파일은 예전 관리자 테이블 구조를 기준으로 DOM을 재배치했기 때문에,
// 최신 회원 테이블의 '상태' 컬럼을 이메일 칸으로 바꾸는 등 충돌을 만들 수 있어 비활성화합니다.

console.info('[admin-clean-dashboard] disabled: admin-safe.js owns current admin UI');
