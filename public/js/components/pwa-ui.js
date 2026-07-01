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
    .pwa-pill{position:fixed;right:14px;bottom:calc(82px + env(safe-area-inset-bottom,0px));z-index:220;border:1px solid rgba(201,168,76,.5);background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(20,25,42,.94));color:var(--cream);box-shadow:0 10px 28px rgba(0,0,0,.35);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:999px;padding:11px 14px;font-size:12px;font-weight:900;display:flex;align-items:center;gap:7px;cursor:pointer;}
    .pwa-pill span{color:var(--gold);}
    .pwa-help{position:fixed;inset:0;z-index:2300;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;}
    .pwa-card{width:100%;max-width:370px;border:1px solid rgba(201,168,76,.45);border-radius:18px;background:var(--navy-light);box-shadow:0 20px 60px rgba(0,0,0,.5);padding:22px;text-align:center;}
    .pwa-card h3{font-family:var(--font-serif);color:var(--gold);margin:8px 0 6px;font-size:20px;}
    .pwa-card p{font-size:13px;color:var(--cream-dim);line-height:1.75;margin:0 0 16px;}
  `;
  document.head.appendChild(style);
}
function help() {
  document.getElementById('pwa-help')?.remove();
  const modal = document.createElement('div');
  modal.id = 'pwa-help';
  modal.className = 'pwa-help';
  modal.innerHTML = `<div class="pwa-card"><div style="font-size:46px;">📲</div><h3>홈 화면에 추가</h3><p>아이폰/iPad는 Safari 공유 버튼을 누른 뒤<br><strong>홈 화면에 추가</strong>를 선택하세요.<br>Android/Chrome은 버튼을 누르면 설치 창이 표시됩니다.</p><button class="btn btn-primary" id="pwa-close">확인</button></div>`;
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
  btn.innerHTML = '<span>＋</span> 앱으로 보기';
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
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js?v=20260630-16').catch(() => null));
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
  if (iosDevice() && !standalone()) setTimeout(button, 1200);
}
