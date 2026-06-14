// republic-polish.js
// 가상현실 정치게임 몰입을 깨는 일반 AI 도구식 문구를 공화국 세계관 문구로 보정합니다.

import { navigate } from './router.js';

function replaceTextNode(root, from, to) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    if (node.nodeValue && node.nodeValue.includes(from)) {
      node.nodeValue = node.nodeValue.split(from).join(to);
    }
  });
}

function polishGlobalCopy() {
  replaceTextNode(document.body, '⚖️ 판결소', '📮 국민신문고');
  replaceTextNode(document.body, '판결소', '국민신문고');
  replaceTextNode(document.body, 'AI킹', '대통령실');
  replaceTextNode(document.body, '7인 AI 정치인의 가상 정치 드라마', '소소공화국 가상 정치 시뮬레이션');
}

function enhanceImpeachmentCopy() {
  const text = document.body.innerText || '';
  if (!text.includes('탄핵') && !text.includes('불신임')) return;

  replaceTextNode(document.body, '불신임 투표', '국회 탄핵소추 표결');
  replaceTextNode(document.body, '불신임', '탄핵소추');
  replaceTextNode(document.body, '청원', '탄핵 청원');

  document.querySelectorAll('button, a, .btn').forEach(el => {
    const label = (el.textContent || '').trim();
    if (label.includes('탄핵') || label.includes('소추')) {
      el.setAttribute('title', '국회 탄핵소추가 가결되면 헌법재판소 심판 단계로 넘어갑니다');
    }
  });
}

function addConstitutionalCourtNotice() {
  const path = (window.location.hash.slice(1).split('?')[0] || '/');
  if (path !== '/constitutional-court' && path !== '/congress') return;

  const page = document.getElementById('page-content');
  if (!page || document.getElementById('constitutional-court-notice')) return;

  const target = page.querySelector('section, .card');
  if (!target) return;

  const notice = document.createElement('div');
  notice.id = 'constitutional-court-notice';
  notice.style.cssText = 'margin:12px 0;padding:14px;border-radius:16px;border:1px solid rgba(100,116,139,.25);background:rgba(15,23,42,.04);font-size:13px;line-height:1.55;color:var(--color-text-secondary)';
  notice.innerHTML = '<b style="color:var(--color-text-primary)">🏛️ 헌법재판소는 탄핵 전용 기관입니다.</b><br>국회 탄핵소추 표결이 통과되면 헌법재판소 심판으로 넘어가고, 인용 시 대통령은 파면되며 조기 대선 국면으로 전환됩니다.';
  target.parentNode.insertBefore(notice, target.nextSibling);
}

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function addHomeRepublicEntry() {
  if (currentPath() !== '/') return;
  if (document.getElementById('home-republic-entry')) return;
  const root = document.querySelector('.home-dash--v2');
  if (!root) return;
  const anchor = root.querySelector('.home-id-card') || root.querySelector('.home-guest-hero') || root.firstElementChild;
  if (!anchor) return;

  if (!document.getElementById('home-republic-entry-style')) {
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
  anchor.insertAdjacentElement('afterend', btn);
}

function runPolish() {
  polishGlobalCopy();
  enhanceImpeachmentCopy();
  addConstitutionalCourtNotice();
  addHomeRepublicEntry();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runPolish, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
