const installButton = document.getElementById('install-app');
const installStatus = document.getElementById('install-status');
let deferredPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

function setStatus(message) {
  if (installStatus) installStatus.textContent = message;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.warn('service worker registration skipped:', error?.message || error);
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton && !isStandalone()) installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installButton) installButton.hidden = true;
  setStatus('소소킹 플레이가 설치되었습니다.');
});

installButton?.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
    setStatus(choice.outcome === 'accepted' ? '설치를 시작합니다.' : '설치를 취소했습니다.');
    return;
  }

  if (isIosSafari()) {
    setStatus('Safari 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.');
  }
});

if (isStandalone()) {
  if (installButton) installButton.hidden = true;
} else if (isIosSafari() && installButton) {
  installButton.hidden = false;
  installButton.textContent = '홈 화면에 추가';
}

void registerServiceWorker();
