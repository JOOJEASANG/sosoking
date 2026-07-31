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
  if (!page || document.getElementById('dripso-home-entry')) return;

  const entry = document.createElement('a');
  entry.id = 'dripso-home-entry';
  entry.className = 'dripso-home-entry';
  entry.href = DRIPSO_PATH;
  entry.setAttribute('aria-label', '별도 커뮤니티 드립소로 이동');

  const icon = document.createElement('span');
  icon.className = 'dripso-home-entry-icon';
  icon.textContent = '🤣';

  const copy = document.createElement('span');
  copy.className = 'dripso-home-entry-copy';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'dripso-home-entry-eyebrow';
  eyebrow.textContent = '판결소와 별도로 운영되는 유머 커뮤니티';

  const title = document.createElement('strong');
  title.textContent = '드립소 바로가기';

  const description = document.createElement('span');
  description.className = 'dripso-home-entry-description';
  description.textContent = '주제를 올리고 댓글 드립을 달아 베스트 한마디를 뽑아보세요.';

  copy.append(eyebrow, title, description);

  const arrow = document.createElement('span');
  arrow.className = 'dripso-home-entry-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';

  entry.append(icon, copy, arrow);
  const hero = page.querySelector('.hero-section');
  if (hero) hero.insertAdjacentElement('afterend', entry);
  else page.prepend(entry);
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
