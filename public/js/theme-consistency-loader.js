// theme-consistency-loader.js
// index.html을 건드리지 않고 마지막 단계에서 전역 테마 보정 CSS를 로드합니다.

const HREF = '/css/theme-consistency-fix.css?v=20260703';

if (!document.querySelector('link[data-soso-theme-consistency="1"]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = HREF;
  link.dataset.sosoThemeConsistency = '1';
  document.head.appendChild(link);
}
