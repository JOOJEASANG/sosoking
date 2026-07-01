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
    .pwa-pill{position:fixed;right:14px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:420;border:1px solid rgba(212,181,92,.62);background:linear-gradient(135deg,rgba(212,181,92,.22),rgba(20,25,42,.97));color:#fff8ec;box-shadow:0 12px 32px rgba(0,0,0,.38);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:999px;padding:11px 14px;font-size:12px;font-weight:900;display:flex;align-items:center;gap:8px;cursor:pointer;min-height:44px;}
    .pwa-pill-icon{width:24px;height:24px;border-radius:8px;background:url('/app-icon.svg?v=20260702-4') center/cover no-repeat;box-shadow:0 0 0 1px rgba(255,255,255,.16);}
    .pwa-help{position:fixed;inset:0;z-index:2300;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;}
    .pwa-card{width:100%;max-width:370px;border:1px solid var(--border);border-radius:22px;background:var(--surface-1,var(--navy-light));box-shadow:0 20px 60px rgba(0,0,0,.5);padding:22px;text-align:center;color:var(--text-strong,var(--cream));}
    .pwa-card-icon{width:82px;height:82px;border-radius:24px;background:url('/app-icon.svg?v=20260702-4') center/cover no-repeat;margin:0 auto 12px;box-shadow:0 12px 28px rgba(0,0,0,.28),0 0 0 1px rgba(212,181,92,.28);}
    .pwa-card h3{font-family:var(--font-serif);color:var(--gold);margin:8px 0 6px;font-size:20px;}
    .pwa-card p{font-size:13px;color:var(--text-muted,var(--cream-dim));line-height:1.75;margin:0 0 16px;}
    .pwa-small{font-size:11px;color:var(--text-muted,var(--cream-dim));line-height:1.65;margin-top:10px;}
    [data-theme="light"] .pwa-pill{background:linear-gradient(135deg,rgba(255,253,248,.96),rgba(244,234,220,.96));color:#17120a;box-shadow:0 10px 26px rgba(78,52,12,.16);}
    @media (prefers-color-scheme: light){:root:not([data-theme]) .pwa-pill{background:linear-gradient(135deg,rgba(255,253,248,.96),rgba(244,234,220,.96));color:#17120a;box-shadow:0 10px 26px rgba(78,52,12,.16);}}
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
      ? 'Chrome 또는 삼성인터넷 메뉴에서 앱 설치를 선택하세요. 조건이 맞으면 이 버튼으로 설치창이 바로 열립니다.'
      : '브라우저 주소창 또는 메뉴에서 앱 설치를 선택하세요.';
  const modal = document.createElement('div');
  modal.id = 'pwa-help';
  modal.className = 'pwa-help';
  modal.innerHTML = `<div class="pwa-card"><div class="pwa-card-icon"></div><h3>소소킹 앱 설치</h3><p>${guide}</p><button class="btn btn-primary" id="pwa-close">확인</button><div class="pwa-small">이미 설치했거나 브라우저가 설치 조건을 아직 판단 중이면 설치창이 바로 안 뜰 수 있습니다.</div></div>`;
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
  btn.innerHTML = '<span class="pwa-pill-icon" aria-hidden="true"></span><span>앱 설치</span>';
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
