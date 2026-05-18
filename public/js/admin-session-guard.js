import { auth, signOut } from './firebase.js';
import { appState } from './state.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

function currentPath() {
  return (window.location.hash || '#/').slice(1).split('?')[0] || '/';
}

function isAdminUser() {
  return !!appState.user && !!appState.isAdmin;
}

function enforceAdminOnly() {
  if (!isAdminUser()) return;
  const path = currentPath();
  if (path !== '/admin' && path !== '/login') {
    navigate('/admin');
  }
}

function injectAdminLogout() {
  if (!isAdminUser()) return;
  if (currentPath() !== '/admin') return;
  const adminSidebar = document.querySelector('.admin-sidebar');
  if (!adminSidebar || document.getElementById('admin-logout-btn')) return;

  adminSidebar.insertAdjacentHTML('beforeend', `
    <div style="margin-top:auto;padding:14px 12px;border-top:1px solid var(--color-border-light)">
      <button class="btn btn--ghost btn--full" id="admin-logout-btn" style="justify-content:center">
        로그아웃
      </button>
    </div>
  `);

  document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      appState.user = null;
      appState.isAdmin = false;
      toast.success('로그아웃했어요');
      navigate('/login');
    } catch (error) {
      console.error(error);
      toast.error('로그아웃에 실패했어요');
    }
  });
}

function run() {
  enforceAdminOnly();
  setTimeout(injectAdminLogout, 80);
}

const observer = new MutationObserver(() => setTimeout(injectAdminLogout, 60));
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(run, 50));
window.addEventListener('popstate', () => setTimeout(run, 50));
setTimeout(run, 300);
