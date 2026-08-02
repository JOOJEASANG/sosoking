const DRIPSO_PATH = '/dripso/';

function isHomeRoute() {
  const hash = location.hash || '';
  const path = location.pathname.replace(/\/$/, '') || '/';
  return path === '/' && (hash === '' || hash === '#' || hash === '#/');
}

function removeLegacyNavEntry() {
  const nav = document.getElementById('bottom-nav');
  nav?.querySelector('a[href="/dripso/"]')?.remove();
  nav?.classList.remove('has-dripso-entry');
}

function ensureHomeEntry() {
  if (!isHomeRoute()) {
    document.getElementById('dripso-home-entry')?.remove();
    return;
  }

  const page = document.getElementById('page-content');
  const hero = page?.querySelector('.hero-section');
  if (!page || !hero) return;

  const homeContent = hero.parentElement || page;
  let entry = document.getElementById('dripso-home-entry');

  if (!entry) {
    entry = document.createElement('nav');
    entry.id = 'dripso-home-entry';
    entry.className = 'dripso-home-entry';
    entry.setAttribute('aria-label', '소소킹 서비스 이동');
    entry.title = '주제를 올리고 댓글 드립을 달아 베스트 한마디를 뽑아보세요.';

    const court = document.createElement('a');
    court.className = 'dripso-home-entry-link active';
    court.href = '/';
    court.setAttribute('aria-current', 'page');
    court.textContent = '⚖️ 판결소';

    const dripso = document.createElement('a');
    dripso.className = 'dripso-home-entry-link';
    dripso.href = DRIPSO_PATH;
    dripso.setAttribute('aria-label', '드립소 바로가기');
    dripso.textContent = 'ㅋ 드립소';

    entry.append(court, dripso);
  }

  // 홈의 모든 안내·판결기록·이용안내 다음, 사이트 푸터 바로 위에 둔다.
  if (entry.parentElement !== homeContent || entry !== homeContent.lastElementChild) {
    homeContent.append(entry);
  }
}

function ensureEntry() {
  removeLegacyNavEntry();
  ensureHomeEntry();
}

let scheduled = false;
function scheduleEnsure() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    ensureEntry();
  });
}

const observer = new MutationObserver(scheduleEnsure);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleEnsure);
window.addEventListener('pageshow', scheduleEnsure);
ensureEntry();
