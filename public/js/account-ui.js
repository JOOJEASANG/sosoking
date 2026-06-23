import { appState } from './state.js';
import { auth, onAuthStateChanged } from './firebase.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isAccountPage() {
  return (window.location.hash.slice(1).split('?')[0] || '/') === '/account';
}

function removeAccountInstallButtons() {
  document.querySelectorAll('[data-account-install-button]').forEach(element => element.remove());
}

function showInstallGuide() {
  const previous = document.getElementById('account-install-tip');
  if (previous) { previous.remove(); return; }

  const inAppBrowser = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NaverApp|Twitter|Snapchat/i.test(navigator.userAgent);
  const tip = document.createElement('div');
  tip.id = 'account-install-tip';
  tip.className = 'account-install-tip';

  if (isIOS()) {
    tip.innerHTML = `<div class="account-install-tip__icon">📲</div><b>홈 화면에 추가하기</b><p>Safari 하단 공유 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를 선택하세요.</p><button type="button" id="account-install-tip-close">확인</button>`;
  } else if (inAppBrowser) {
    tip.innerHTML = `<div class="account-install-tip__icon">⚠️</div><b>Chrome에서 열어주세요</b><p>카카오톡·인스타그램 앱 안에서는 설치할 수 없습니다. Chrome 브라우저로 직접 열어주세요.</p><button type="button" id="account-install-tip-close">확인</button>`;
  } else {
    tip.innerHTML = `<div class="account-install-tip__icon">📲</div><b>소소킹 앱 설치하기</b><p>Chrome 메뉴에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택하세요.</p><button type="button" id="account-install-tip-close">확인</button>`;
  }

  document.body.appendChild(tip);
  document.getElementById('account-install-tip-close')?.addEventListener('click', () => tip.remove());
  setTimeout(() => tip.remove(), 15000);
}

async function openInstallPrompt() {
  const prompt = appState.installPrompt || window.__pwaInstallPrompt;
  if (!prompt) {
    showInstallGuide();
    return;
  }

  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      window.__pwaInstallPrompt = null;
      appState.installPrompt = null;
      removeAccountInstallButtons();
    } else {
      showInstallGuide();
    }
  } catch {
    showInstallGuide();
  }
}

function ensureAccountInstallButton() {
  if (!isAccountPage()) return;
  const logoutButton = document.getElementById('btn-logout');
  if (!logoutButton) return;
  const footer = logoutButton.closest('.card__footer');
  if (!footer) return;

  footer.classList.add('account-action-footer');
  if (isStandalone()) {
    removeAccountInstallButtons();
    return;
  }
  if (footer.querySelector('[data-account-install-button]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--primary btn--sm account-install-btn';
  button.dataset.accountInstallButton = 'true';
  button.textContent = '📲 앱 설치';
  button.addEventListener('click', openInstallPrompt);
  logoutButton.insertAdjacentElement('afterend', button);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureAccountInstallButton, 120);
}

onAuthStateChanged(auth, user => {
  const shouldRefreshAccount = appState.loading && isAccountPage();
  appState.user = user;
  appState.loading = false;
  if (shouldRefreshAccount) {
    queueMicrotask(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  }
  schedule();
});

window.addEventListener('beforeinstallprompt', schedule);
window.addEventListener('appinstalled', () => {
  removeAccountInstallButtons();
  schedule();
});
window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(ensureAccountInstallButton, 350);
