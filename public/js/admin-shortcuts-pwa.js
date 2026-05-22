import { navigate } from './router.js';

function removeInstallButtons() {
  document.querySelectorAll('[data-pwa-install-shortcut]').forEach(el => el.remove());
}

function ensureAdminWriteShortcut() {
  const nav = document.querySelector('.admin-layout .admin-nav');
  if (!nav) return;

  let btn = nav.querySelector('[data-admin-write-shortcut]');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-menu-item admin-menu-item--write-shortcut';
    btn.dataset.adminWriteShortcut = 'true';
    btn.innerHTML = `
      <span class="admin-menu-item__icon">➕</span>
      <span class="admin-menu-item__label">글쓰기</span>`;
    btn.addEventListener('click', () => navigate('/write'));
  }

  const dataTab = nav.querySelector('[data-admin-data-tab]');
  if (dataTab) {
    if (dataTab.nextElementSibling !== btn) nav.insertBefore(btn, dataTab.nextElementSibling);
    return;
  }

  if (btn.parentNode !== nav) nav.appendChild(btn);
}

let enhanceTimer = null;
function scheduleEnhancements() {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(installEnhancements, 80);
}

function installEnhancements() {
  // 모바일 상단 앱 설치 버튼은 components/header.js의 빨간 "앱 설치" 버튼 하나만 사용합니다.
  // 이전 보조 아이콘 버튼이 남아 있으면 즉시 제거해 중복 노출을 막습니다.
  removeInstallButtons();
  ensureAdminWriteShortcut();
}

window.addEventListener('beforeinstallprompt', () => setTimeout(installEnhancements, 0));
window.addEventListener('appinstalled', removeInstallButtons);
window.addEventListener('hashchange', scheduleEnhancements);
window.addEventListener('themechange', scheduleEnhancements);

new MutationObserver(scheduleEnhancements).observe(document.documentElement, { childList: true, subtree: true });

setTimeout(installEnhancements, 0);