import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { firebaseConfig } from '../js/firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const functions = getFunctions(app, 'asia-northeast3');
const setAdminResultVisibility = httpsCallable(functions, 'setAdminResultVisibility');

let patchQueued = false;

function toast(message, type = 'info') {
  const host = document.getElementById('toast-container');
  if (!host) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  host.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function installSecureVisibilityAction() {
  if (!document.querySelector('.admin-shell')) return;

  window._recordPublic = async (caseId, isPublic) => {
    try {
      await setAdminResultVisibility({ caseId, isPublic: Boolean(isPublic) });
      toast('공개 상태를 안전하게 변경했습니다.', 'success');
      window._tab?.('records');
    } catch (error) {
      console.error('secure admin visibility update failed:', error);
      toast(String(error?.message || '공개 상태 변경에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
    }
  };
}

function schedulePatch() {
  if (patchQueued) return;
  patchQueued = true;
  requestAnimationFrame(() => {
    patchQueued = false;
    installSecureVisibilityAction();
  });
}

const observer = new MutationObserver(schedulePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('pageshow', schedulePatch);
schedulePatch();
