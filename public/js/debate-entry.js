// 홈 화면에 '오늘의 토론' 진입 배너를 주입하는 가드.
// home.js를 수정하지 않고(캐시 버전 연쇄를 피하려고) 기존 *-guard.js 패턴을 따른다.
const ENTRY_ID = 'sosoking-debate-entry';

function isHomeRoute() {
  const hash = location.hash || '';
  if (hash && hash !== '#' && hash !== '#/') return false;
  const path = location.pathname.replace(/\/$/, '') || '/';
  return path === '/';
}

function buildBanner() {
  const link = document.createElement('a');
  link.id = ENTRY_ID;
  link.href = '#/debate';
  link.setAttribute('aria-label', '오늘의 토론 참여하기');
  link.style.cssText = 'display:flex;align-items:center;gap:14px;padding:18px 20px;margin:22px 16px 0;border-radius:16px;text-decoration:none;color:inherit;background:linear-gradient(135deg,rgba(201,168,76,.16),rgba(201,168,76,.05));border:1px solid var(--border);box-shadow:var(--shadow);';

  const mark = document.createElement('span');
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '🗳️';
  mark.style.cssText = 'flex-shrink:0;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:rgba(0,0,0,.18);border:1px solid var(--border);';

  const copy = document.createElement('div');
  copy.style.cssText = 'flex:1;min-width:0;';

  const eyebrow = document.createElement('div');
  eyebrow.textContent = "TODAY'S DEBATE · 매일 새 사건";
  eyebrow.style.cssText = 'font-size:10px;letter-spacing:.14em;color:var(--gold);font-weight:800;';

  const title = document.createElement('div');
  title.textContent = '오늘의 토론 — 당신의 판단은?';
  title.style.cssText = 'font-family:var(--font-serif);font-size:18px;font-weight:900;margin-top:2px;';

  const desc = document.createElement('div');
  desc.textContent = '하나의 생활 딜레마에 투표하고 여론과 붙어보세요.';
  desc.style.cssText = 'font-size:12.5px;color:var(--cream-dim);margin-top:3px;line-height:1.5;';

  copy.append(eyebrow, title, desc);

  const go = document.createElement('span');
  go.setAttribute('aria-hidden', 'true');
  go.textContent = '참여 →';
  go.style.cssText = 'flex-shrink:0;font-size:12px;font-weight:800;color:var(--gold);';

  link.append(mark, copy, go);
  return link;
}

function normalizeHome() {
  if (!isHomeRoute()) {
    document.getElementById(ENTRY_ID)?.remove();
    return;
  }
  const content = document.getElementById('page-content');
  if (!content) return;
  // 홈이 렌더된 뒤에만 삽입 (히어로 섹션 존재로 판별).
  const hero = content.querySelector('.hero-section');
  if (!hero) {
    document.getElementById(ENTRY_ID)?.remove();
    return;
  }
  if (document.getElementById(ENTRY_ID)) return;

  const banner = buildBanner();
  const anchor = content.querySelector('#court-entrance');
  if (anchor && anchor.parentElement) {
    anchor.parentElement.insertBefore(banner, anchor);
  } else {
    hero.insertAdjacentElement('afterend', banner);
  }
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; normalizeHome(); });
}

const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedule);
window.addEventListener('pageshow', schedule);
normalizeHome();
