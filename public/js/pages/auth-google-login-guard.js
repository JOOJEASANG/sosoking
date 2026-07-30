import { renderAuth as renderBaseAuth } from './auth2.js?v=20260729-brand-unified-1';
import { auth } from '../firebase.js?v=20260729-auth-session-1';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { showToast } from '../components/toast.js?v=20260728-ui-audit-2';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const REDIRECT_FLAG = 'sosoking:google-login-redirect';
const NOTICE_FLAG = 'sosoking:last-auth-notice';
const FALSE_FAILURE_TEXT = /Google 로그인에 실패했습니다|Google 로그인이 취소되었습니다|로그인 처리 중 문제가 발생했습니다|이미 로그인 창이 열려 있습니다/;

function currentSignedInUser() {
  const user = auth.currentUser;
  return user && !user.isAnonymous ? user : null;
}

function popupNeedsRedirect(error) {
  return ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error?.code);
}

function friendlyAuthMessage(error, fallback = 'Google 로그인에 실패했습니다.') {
  const messages = {
    'auth/popup-closed-by-user': 'Google 로그인이 취소되었습니다.',
    'auth/cancelled-popup-request': '이미 로그인 창이 열려 있습니다.',
    'auth/network-request-failed': '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
    'auth/too-many-requests': '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.',
    'auth/user-disabled': '사용이 제한된 계정입니다.',
    'auth/unauthorized-domain': '현재 사이트 주소가 Google 로그인 허용 목록에 없습니다. 관리자에게 문의해주세요.',
    'auth/operation-not-allowed': 'Firebase에서 Google 로그인이 활성화되지 않았습니다.',
    'auth/account-exists-with-different-credential': '같은 이메일로 가입한 다른 로그인 방식이 있습니다.',
    'auth/web-storage-unsupported': '브라우저 저장소가 차단되어 있습니다. 일반 Chrome 탭에서 다시 시도해주세요.'
  };
  return messages[error?.code] || fallback;
}

function showAuthNotice(message, type = 'success') {
  const now = Date.now();
  const key = `${type}:${message}`;
  let previous = null;
  try { previous = JSON.parse(sessionStorage.getItem(NOTICE_FLAG) || 'null'); } catch { previous = null; }
  if (previous?.key === key && now - Number(previous.at || 0) < 4000) return;
  try { sessionStorage.setItem(NOTICE_FLAG, JSON.stringify({ key, at: now })); } catch {}
  showToast(message, type);
}

function markRedirectStarted() {
  try {
    sessionStorage.setItem(REDIRECT_FLAG, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

async function waitForSettledAuth() {
  await auth.authStateReady().catch(() => {});
  return currentSignedInUser();
}

function patchGoogleButton(container) {
  const button = container.querySelector('#google-login');
  if (!button || button.dataset.loginStateGuard === 'true') return;
  button.dataset.loginStateGuard = 'true';

  button.onclick = async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Google 로그인 준비 중...';

    try {
      await signInWithPopup(auth, googleProvider);
      showAuthNotice('Google 로그인 완료', 'success');
      return;
    } catch (error) {
      console.warn('google login attempt reported an error', error?.code || error);

      if (popupNeedsRedirect(error)) {
        if (!markRedirectStarted()) {
          showAuthNotice(friendlyAuthMessage({ code: 'auth/web-storage-unsupported' }), 'error');
          button.disabled = false;
          button.textContent = 'Google로 계속하기';
          return;
        }
        button.textContent = 'Google 로그인 화면으로 이동...';
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          try { sessionStorage.removeItem(REDIRECT_FLAG); } catch {}
          error = redirectError;
        }
      }

      const signedInUser = await waitForSettledAuth();
      if (signedInUser) {
        console.warn('google login error ignored because authenticated state is active', error?.code || error);
        showAuthNotice('Google 로그인 완료', 'success');
        return;
      }

      showAuthNotice(friendlyAuthMessage(error), 'error');
      button.disabled = false;
      button.textContent = 'Google로 계속하기';
    }
  };
}

function installGoogleButtonGuard(container) {
  patchGoogleButton(container);
  const observer = new MutationObserver(() => patchGoogleButton(container));
  observer.observe(container, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function installFalseFailureToastGuard() {
  const host = document.getElementById('toast-container');
  if (!host) return () => {};

  const checkToast = toast => {
    if (!(toast instanceof HTMLElement)) return;
    if (!toast.classList.contains('toast') || !toast.classList.contains('error')) return;
    if (!FALSE_FAILURE_TEXT.test(toast.textContent || '')) return;

    for (const delay of [0, 120, 500]) {
      setTimeout(async () => {
        if (!toast.isConnected) return;
        const signedInUser = await waitForSettledAuth();
        if (signedInUser) toast.remove();
      }, delay);
    }
  };

  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(checkToast));
  });
  observer.observe(host, { childList: true });
  return () => observer.disconnect();
}

export async function renderAuth(container) {
  await renderBaseAuth(container);
  const baseCleanup = window._pageCleanup;
  const stopButtonGuard = installGoogleButtonGuard(container);
  const stopToastGuard = installFalseFailureToastGuard();

  window._pageCleanup = () => {
    stopButtonGuard();
    stopToastGuard();
    if (typeof baseCleanup === 'function') baseCleanup();
  };
}
