// core-nav-visibility-fix.js — 세력/역사 메뉴 표시 보장
import { navigate } from './router.js';

function injectStyle() {
  if (document.getElementById('core-nav-visibility-style')) return;
  const style = document.createElement('style');
  style.id = 'core-nav-visibility-style';
  style.textContent = `
    .bottom-nav__inner.bottom-nav__inner--six,
    .bottom-nav__inner:has([data-nav-path="/forces"]):has([data-nav-path="/history"]) {
      grid-template-columns: repeat(6, 1fr) !important;
      max-width: 640px !important;
      gap: 2px !important;
      padding-left: 6px !important;
      padding-right: 6px !important;
    }
    .bottom-nav__inner:has([data-nav-path="/forces"]):has([data-nav-path="/history"]) .bottom-nav__item {
      min-height: 48px !important;
      border-radius: 14px !important;
      padding-left: 2px !important;
      padding-right: 2px !important;
    }
    .bottom-nav__inner:has([data-nav-path="/forces"]):has([data-nav-path="/history"]) .bottom-nav__label {
      font-size: 9.6px !important;
      letter-spacing: -.06em !important;
    }
    .forces-home-shortcut {
      border: 1px solid rgba(124,58,237,.18);
      border-radius: 22px;
      background: linear-gradient(135deg,rgba(124,58,237,.10),rgba(248,250,252,.92));
      box-shadow: 0 10px 26px rgba(15,23,42,.055);
      padding: 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .forces-home-shortcut b { display:block;font-size:16px;color:var(--color-text-primary); }
    .forces-home-shortcut span { display:block;font-size:12px;line-height:1.45;color:var(--color-text-secondary);margin-top:3px; }
    @media(max-width:720px){ .forces-home-shortcut{align-items:flex-start;flex-direction:column} }
  `;
  document.head.appendChild(style);
}

function makeBottomItem(path, label, icon) {
  const btn = document.createElement('button');
  btn.className = 'bottom-nav__item';
  btn.dataset.navPath = path;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = `<span class="bottom-nav__icon-wrap"><span style="font-size:19px;line-height:1">${icon}</span></span><span class="bottom-nav__label">${label}</span>`;
  btn.addEventListener('click', () => navigate(path));
  return btn;
}

function ensureBottomLinks() {
  const inner = document.querySelector('#bottom-nav .bottom-nav__inner');
  if (!inner) return;
  inner.classList.add('bottom-nav__inner--six');
  if (!inner.querySelector('[data-nav-path="/forces"]')) {
    inner.appendChild(makeBottomItem('/forces', '세력', '⚡'));
  }
  if (!inner.querySelector('[data-nav-path="/history"]')) {
    const election = inner.querySelector('[data-nav-path="/election"]');
    const item = makeBottomItem('/history', '역사', '📚');
    if (election) inner.insertBefore(item, election);
    else inner.appendChild(item);
  }
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  inner.querySelectorAll('[data-nav-path]').forEach(btn => {
    const active = btn.dataset.navPath === path;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function ensureHomeShortcut() {
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  if (path !== '/') return;
  const root = document.querySelector('#page-content .home-core');
  if (!root || root.querySelector('.forces-home-shortcut')) return;
  const hero = root.querySelector('.home-core-hero');
  const card = document.createElement('section');
  card.className = 'forces-home-shortcut';
  card.innerHTML = `<div><b>⚡ 외부세력 선택</b><span>정당 말고 특별수사청·재계연합·언론연합 같은 외부세력으로 영향력을 키울 수 있습니다.</span></div><button class="btn btn--primary btn--sm" type="button">세력 선택</button>`;
  card.querySelector('button')?.addEventListener('click', () => navigate('/forces'));
  if (hero?.nextSibling) root.insertBefore(card, hero.nextSibling);
  else root.prepend(card);
}

function run() {
  injectStyle();
  ensureBottomLinks();
  ensureHomeShortcut();
}

run();
window.addEventListener('hashchange', () => setTimeout(run, 0));
window.addEventListener('sosoking:extensions-ready', run);
new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
