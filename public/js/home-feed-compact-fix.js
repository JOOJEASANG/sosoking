// home-feed-compact-fix.js
//
// 예전 홈 화면의 큰 최근 피드 카드를 compact 리스트로 바꾸던 임시 보정 파일입니다.
// 현재는 public/js/pages/home.js가 홈 화면을 직접 compact 구조로 렌더링하므로,
// 이 파일이 다시 DOM을 교체하면 홈이 중복 렌더링될 수 있습니다.
// 기존 index.html 로드 경로 호환을 위해 빈 shim으로 유지합니다.

window.dispatchEvent(new CustomEvent('sosoking:home-compact-shim-ready'));
