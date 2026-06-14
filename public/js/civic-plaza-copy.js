// civic-plaza-copy.js
// 기존 /feed 경로는 유지하되, 사용자에게는 '시민광장'으로 보이게 정리합니다.

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function ensureStyle() {
  if (document.getElementById('civic-plaza-copy-style')) return;
  const style = document.createElement('style');
  style.id = 'civic-plaza-copy-style';
  style.textContent = `
    .civic-plaza-hero{margin:0 0 14px;padding:15px 16px;border-radius:22px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(67,56,202,.86));color:#fff;box-shadow:0 14px 32px rgba(15,23,42,.16)}
    .civic-plaza-hero__eyebrow{font-size:11px;font-weight:1000;letter-spacing:.08em;color:rgba(255,255,255,.62);margin-bottom:4px}
    .civic-plaza-hero__title{font-size:22px;font-weight:1000;line-height:1.2}
    .civic-plaza-hero__desc{font-size:13px;line-height:1.55;color:rgba(255,255,255,.74);margin-top:6px}
    .civic-plaza-hero__chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}
    .civic-plaza-hero__chip{border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);padding:6px 8px;font-size:11px;font-weight:900;color:#fff}
    @media(max-width:420px){.civic-plaza-hero{border-radius:18px;padding:13px}.civic-plaza-hero__title{font-size:19px}}
  `;
  document.head.appendChild(style);
}

function updateMeta() {
  if (currentPath() !== '/feed') return;
  document.title = '소소킹 시민광장 - 공화국 게시판';
  const desc = '소소킹 시민광장은 자유글, 댓글, 헌재 기록, 정치력 활동을 모아보는 공화국 커뮤니티 게시판입니다.';
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', '소소킹 시민광장');
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', '소소킹 시민광장');
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc);
}

function addCivicPlazaHero() {
  if (currentPath() !== '/feed') return;
  if (document.getElementById('civic-plaza-hero')) return;
  const page = document.querySelector('.soso-feed-page');
  if (!page) return;

  ensureStyle();
  const hero = document.createElement('div');
  hero.id = 'civic-plaza-hero';
  hero.className = 'civic-plaza-hero';
  hero.innerHTML = `
    <div class="civic-plaza-hero__eyebrow">CIVIC PLAZA</div>
    <div class="civic-plaza-hero__title">🏛️ 시민광장</div>
    <div class="civic-plaza-hero__desc">자유글, 댓글, 헌재 기록을 한곳에서 보는 공화국 게시판입니다. 배틀·정당·대선 밖의 이야기는 시민광장에서 이어집니다.</div>
    <div class="civic-plaza-hero__chips">
      <span class="civic-plaza-hero__chip">글 작성 +20P</span>
      <span class="civic-plaza-hero__chip">댓글 +10P</span>
      <span class="civic-plaza-hero__chip">재판기록 보관</span>
    </div>`;
  page.insertBefore(hero, page.firstElementChild);
}

function normalizeFeedCopy() {
  if (currentPath() !== '/feed') return;
  document.querySelectorAll('.feed-result-summary, .soso-feed-summary').forEach(el => {
    if (el.textContent.includes('피드')) el.textContent = el.textContent.replace(/피드/g, '시민광장');
  });
}

function run() {
  updateMeta();
  addCivicPlazaHero();
  normalizeFeedCopy();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);

function observeBody() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', observeBody, { once: true });
    return;
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}

observeBody();
