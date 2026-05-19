import { navigate } from './router.js';

function removeInstallButtons() {
  document.querySelectorAll('[data-pwa-install-shortcut]').forEach(el => el.remove());
}

function ensureAdminWriteShortcut() {
  const nav = document.querySelector('.admin-layout .admin-nav');
  if (!nav || nav.querySelector('[data-admin-write-shortcut]')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-menu-item admin-menu-item--write-shortcut';
  btn.dataset.adminWriteShortcut = 'true';
  btn.innerHTML = `
    <span class="admin-menu-item__icon">➕</span>
    <span class="admin-menu-item__label">글쓰기</span>`;
  btn.addEventListener('click', () => navigate('/write'));
  nav.appendChild(btn);
}

function installEnhancements() {
  // 모바일 상단 앱 설치 버튼은 components/header.js의 빨간 "앱 설치" 버튼 하나만 사용합니다.
  // 이전 보조 아이콘 버튼이 남아 있으면 즉시 제거해 중복 노출을 막습니다.
  removeInstallButtons();
  ensureAdminWriteShortcut();
}

window.addEventListener('beforeinstallprompt', () => setTimeout(installEnhancements, 0));
window.addEventListener('appinstalled', removeInstallButtons);
window.addEventListener('hashchange', () => setTimeout(installEnhancements, 60));
window.addEventListener('themechange', () => setTimeout(installEnhancements, 60));

new MutationObserver(() => installEnhancements()).observe(document.documentElement, { childList: true, subtree: true });

setTimeout(installEnhancements, 0);
