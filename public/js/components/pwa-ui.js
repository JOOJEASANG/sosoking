let savedPrompt = null;
let started = false;

function standalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function iosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}
function androidDevice() {
  return /android/i.test(navigator.userAgent || '');
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
function help() {
  document.getElementById('pwa-help')?.remove();
  const isIOS = iosDevice();
  const isAndroid = androidDevice();
  const guide = isIOS
    ? 'Safari 공유 버튼을 누른 뒤 홈 화면에 추가를 선택하세요.'
    : isAndroid
      ? '브라우저 메뉴의 앱 설치 또는 홈 화면에 추가를 선택하세요. Chrome에서는 조건이 맞으면 설치창이 바로 열립니다.'
      : '브라우저 주소창 또는 메뉴에서 앱 설치를 선택하세요.';
  const modal = document.createElement('div');
  modal.id = 'pwa-help';
  modal.className = 'pwa-help';
  modal.innerHTML = `<div class="pwa-card"><div style="font-size:46px;">📲</div><h3>앱처럼 설치하기</h3><p>${guide}</p><button class="btn btn-primary" id="pwa-close">확인</button><div class="pwa-small">이미 설치했거나 브라우저가 설치 조건을 아직 판단 중이면 설치창이 바로 안 뜰 수 있습니다.</div></div>`;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.getElementById('pwa-close').onclick = () => modal.remove();
}
function button() {
  if (standalone()) return;
  styleOnce();
  let btn = document.getElementById('pwa-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'pwa-btn';
    btn.type = 'button';
    btn.className = 'pwa-pill';
    document.body.appendChild(btn);
  }
  btn.innerHTML = '<span>＋</span> 앱 설치';
  btn.onclick = async () => {
    if (savedPrompt) {
      const p = savedPrompt;
      savedPrompt = null;
      p.prompt();
      await p.userChoice.catch(() => null);
      btn.remove();
    } else {
      help();
    }
  };
}

export function initPwa() {
  if (started) return;
  started = true;
  styleOnce();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js?v=20260630-22').catch(() => null));
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    savedPrompt = e;
    button();
  });
  window.addEventListener('appinstalled', () => {
    savedPrompt = null;
    document.getElementById('pwa-btn')?.remove();
  });
  setTimeout(button, 1000);
  setTimeout(button, 3500);
}
