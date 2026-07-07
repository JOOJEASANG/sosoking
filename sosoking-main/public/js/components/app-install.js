let deferredPrompt = null;
let registered = false;

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}
function ensureStyle() {
  if (document.getElementById('app-install-style')) return;
  const style = document.createElement('style');
  style.id = 'app-install-style';
  style.textContent = `
    .app-install-pill{position:fixed;right:14px;bottom:calc(82px + env(safe-area-inset-bottom,0px));z-index:220;border:1px solid rgba(201,168,76,.5);background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(20,25,42,.94));color:var(--cream);box-shadow:0 10px 28px rgba(0,0,0,.35);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:999px;padding:11px 14px;font-size:12px;font-weight:900;display:flex;align-items:center;gap:7px;cursor:pointer;}
    .app-install-pill span{color:var(--gold);}
    .app-install-modal{position:fixed;inset:0;z-index:2300;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;}
    .app-install-card{width:100%;max-width:370px;border:1px solid rgba(201,168,76,.45);border-radius:18px;background:var(--navy-light);box-shadow:0 20px 60px rgba(0,0,0,.5);padding:22px;text-align:center;}
    .app-install-card h3{font-family:var(--font-serif);color:var(--gold);margin:8px 0 6px;font-size:20px;}
    .app-install-card p{font-size:13px;color:var(--cream-dim);line-height:1.75;margin:0 0 16px;}
  `;
  document.head.appendChild(style);
}
function toastIosGuide() {
  const old = document.getElementById('app-install-modal');
  old?.remove();
  const modal = document.createElement('div');
  modal.id = 'app-install-modal';
  modal.className = 'app-install-modal';
  modal.innerHTML = `
    <div class="app-install-card">
      <div style="font-size:46px;">📲</div>
      <h3>홈 화면에 설치</h3>
      <p>아이폰/iPad에서는 Safari 하단 공유 버튼을 누른 뒤<br><strong>홈 화면에 추가</strong>를 선택하면 앱처럼 사용할 수 있습니다.</p>
      <button class="btn btn-primary" id="install-close">확인</button>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.getElementById('install-close').onclick = () => modal.remove();
}
function showInstallButton() {
  if (isStandalone()) return;
  ensureStyle();
  let btn = document.getElementById('app-install-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'app-install-btn';
    btn.type = 'button';
    btn.className = 'app-install-pill';
    document.body.appendChild(btn);
  }
  btn.innerHTML = '<span>＋</span> 앱 설치';
  btn.onclick = async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      await prompt.userChoice.catch(() => null);
      btn.remove();
    } else if (isIos()) {
      toastIosGuide();
    } else {
      toastIosGuide();
    }
  };
}

export function initAppInstall() {
  if (registered) return;
  registered = true;
  ensureStyle();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=20260630-16').catch(err => console.warn('service worker register failed', err));
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('app-install-btn')?.remove();
  });

  if (isIos() && !isStandalone()) setTimeout(showInstallButton, 1200);
}
