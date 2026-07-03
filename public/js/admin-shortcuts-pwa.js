function removeInstallButtons() {
  document.querySelectorAll('[data-pwa-install-shortcut]').forEach(el => el.remove());
}

function removeAdminWriteShortcuts() {
  document.querySelectorAll('[data-admin-write-shortcut], .admin-menu-item--write-shortcut').forEach(el => el.remove());
}

let enhanceTimer = null;
function scheduleEnhancements() {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(installEnhancements, 80);
}

function installEnhancements() {
  // 모바일 상단 앱 설치 버튼은 components/header.js의 빨간 "앱 설치" 버튼 하나만 사용합니다.
  // 관리자 모바일 메뉴에서는 홈 버튼으로 일반 화면에 돌아간 뒤 글쓰기 메뉴를 사용합니다.
  removeInstallButtons();
  removeAdminWriteShortcuts();
}

window.addEventListener('beforeinstallprompt', () => setTimeout(installEnhancements, 0));
window.addEventListener('appinstalled', removeInstallButtons);
window.addEventListener('hashchange', scheduleEnhancements);
window.addEventListener('themechange', scheduleEnhancements);

new MutationObserver(scheduleEnhancements).observe(document.documentElement, { childList: true, subtree: true });

setTimeout(installEnhancements, 0);
