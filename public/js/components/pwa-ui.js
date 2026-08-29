let savedPrompt = null;
let started = false;

function standalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function iosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function styleOnce() {
  if (document.getElementById('pwa-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'pwa-ui-style';
  style.textContent = `
    .pwa-pill{position:fixed;right:14px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:420;border:1px solid rgba(201,168,76,.55);background:linear-gradient(135deg,rgba(201,168,76,.25),rgba(20,25,42,.96));color:#fff8ec;box-shadow:0 12px 32px rgba(0,0,0,.38);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:999px;padding:12px 15px;font-size:12px;font-weight:900;display:flex;align-items:center;gap:7px;cursor:pointer;}
    .pwa-pill span{color:#ffdf7a;font-size:15px;}
    .pwa-help{position:fixed;inset:0;z-index:2300;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;}
    .pwa-card{width:100%;max-width:370px;border:1px solid rgba(201,168,76,.45);border-radius:18px;background:var(--navy-light);box-shadow:0 20px 60px rgba(0,0,0,.5);padding:22px;text-align:center;}
    .pwa-card h3{font-family:var(--font-serif);color:var(--gold);margin:8px 0 6px;font-size:20px;}
    .pwa-card p{font-size:13px;color:var(--cream-dim);line-height:1.75;margin:0 0 16px;}
    .pwa-small{font-size:11px;color:var(--cream-dim);line-height:1.65;margin-top:10px;}
  `;
  document.head.appendChild(style);
}

function iosHelp() {
  document.getElementById('pwa-help')?.remove();
  const modal = document.createElement('div');
  modal.id = 'pwa-help';
  modal.className = 'pwa-help';
  modal.innerHTML = `<div class="pwa-card"><div style="font-size:46px;">📲</div><h3>홈 화면에 추가</h3><p>Safari의 공유 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를 선택하세요.</p><button class="btn btn-primary" id="pwa-close">확인</button><div class="pwa-small">Android에서는 사이트의 ‘앱 설치’ 버튼으로 설치해야 Chrome 표시 없는 정식 앱 아이콘이 만들어집니다.</div></div>`;
  document.body.appendChild(modal);
  modal.onclick = event => { if (event.target === modal) modal.remove(); };
  document.getElementById('pwa-close').onclick = () => modal.remove();
}

function removeButton() {
  document.getElementById('pwa-btn')?.remove();
}

function showInstallButton() {
  if (standalone() || !savedPrompt) {
    removeButton();
    return;
  }

  styleOnce();
  let button = document.getElementById('pwa-btn');
  if (!button) {
    button = document.createElement('button');
    button.id = 'pwa-btn';
    button.type = 'button';
    button.className = 'pwa-pill';
    document.body.appendChild(button);
  }

  button.innerHTML = '<span>＋</span> 앱 설치';
  button.onclick = async () => {
    const promptEvent = savedPrompt;
    if (!promptEvent) {
      removeButton();
      return;
    }

    button.disabled = true;
    button.innerHTML = '<span>…</span> 설치 확인 중';
    promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    savedPrompt = null;

    if (choice?.outcome === 'accepted') {
      removeButton();
      return;
    }

    button.disabled = false;
    removeButton();
  };
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    await registration.update().catch(() => null);
  } catch (error) {
    console.warn('service worker registration failed:', error);
  }
}

export function initPwa() {
  if (started) return;
  started = true;
  styleOnce();

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    savedPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    savedPrompt = null;
    removeButton();
  });

  if (iosDevice() && !standalone()) {
    setTimeout(() => {
      if (document.getElementById('pwa-btn')) return;
      const button = document.createElement('button');
      button.id = 'pwa-btn';
      button.type = 'button';
      button.className = 'pwa-pill';
      button.innerHTML = '<span>＋</span> 홈 화면 추가';
      button.onclick = iosHelp;
      document.body.appendChild(button);
    }, 1800);
  }
}