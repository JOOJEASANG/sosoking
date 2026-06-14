import { navigate } from './router.js';

let timer = null;
let observer = null;

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function ensureStyle() {
  if (document.getElementById('home-republic-entry-style')) return;
  const style = document.createElement('style');
  style.id = 'home-republic-entry-style';
  style.textContent = `
    .home-republic-entry{margin:0 0 14px;padding:14px 15px;border-radius:20px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(51,65,85,.92));color:#fff;border:0;box-shadow:0 12px 28px rgba(15,23,42,.16);cursor:pointer;text-align:left;width:100%;font-family:inherit;display:block}
    .home-republic-entry__top{display:flex;justify-content:space-between;gap:10px;align-items:center}
    .home-republic-entry__eyebrow{font-size:10px;font-weight:1000;letter-spacing:.08em;color:rgba(255,255,255,.58);margin-bottom:3px}
    .home-republic-entry__title{font-size:18px;font-weight:1000;color:#fff}
    .home-republic-entry__desc{font-size:12px;line-height:1.45;color:rgba(255,255,255,.72);margin-top:5px}
    .home-republic-entry__cta{flex:0 0 auto;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);padding:8px 10px;font-size:12px;font-weight:900;color:#fff}
    .home-republic-entry__steps{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}
    .home-republic-entry__step{border-radius:12px;background:rgba(255,255,255,.09);padding:8px 7px;font-size:11px;font-weight:900;color:#fff;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @media(max-width:480px){.home-republic-entry__steps{grid-template-columns:repeat(2,1fr)}.home-republic-entry__cta{display:none}}
  `;
  document.head.appendChild(style);
}

function buildCard() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'home-republic-entry';
  btn.className = 'home-republic-entry';
  btn.innerHTML = `
    <div class="home-republic-entry__top">
      <div>
        <div class="home-republic-entry__eyebrow">SOSO REPUBLIC</div>
        <div class="home-republic-entry__title">👑 정치 인생 진행도</div>
        <div class="home-republic-entry__desc">정당에 입당하고 정치력을 쌓아 당대표, 대통령, 국회·헌재까지 도전하세요.</div>
      </div>
      <span class="home-republic-entry__cta">공화국 보기 →</span>
    </div>
    <div class="home-republic-entry__steps">
      <span class="home-republic-entry__step">1 입당</span>
      <span class="home-republic-entry__step">2 당대표</span>
      <span class="home-republic-entry__step">3 대통령</span>
      <span class="home-republic-entry__step">4 국회·헌재</span>
    </div>`;
  btn.addEventListener('click', () => navigate('/republic'));
  return btn;
}

function inject() {
  if (currentPath() !== '/') return;
  if (document.getElementById('home-republic-entry')) return;
  const root = document.querySelector('.home-dash--v2');
  if (!root) return;
  const anchor = root.querySelector('.home-id-card') || root.querySelector('.home-guest-hero') || root.firstElementChild;
  if (!anchor) return;
  ensureStyle();
  anchor.insertAdjacentElement('afterend', buildCard());
}

function schedule(delay = 120) {
  clearTimeout(timer);
  timer = setTimeout(inject, delay);
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => schedule(80));
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('hashchange', () => schedule(150));
window.addEventListener('sosoking:extensions-ready', () => schedule(150));
startObserver();
schedule(150);
