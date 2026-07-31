const DRIPSO_PATH = '/dripso/';

function makeNavLink() {
  const link = document.createElement('a');
  link.href = DRIPSO_PATH;
  link.className = 'nav-item dripso-nav-item';
  link.setAttribute('aria-label', '별도 유머 사이트 드립소로 이동');

  const icon = document.createElement('span');
  icon.className = 'nav-icon';
  icon.textContent = '🤣';

  const label = document.createElement('span');
  label.className = 'nav-label';
  label.textContent = '드립소';

  link.append(icon, label);
  return link;
}

function ensureDripsoNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  if (!nav.querySelector(`a[href="${DRIPSO_PATH}"]`)) {
    const account = nav.querySelector('#nav-account-item');
    nav.insertBefore(makeNavLink(), account || null);
  }
  nav.classList.add('has-dripso-entry');
}

function isHomeRoute() {
  const hash = location.hash || '';
  const path = location.pathname.replace(/\/$/, '') || '/';
  return path === '/' && (hash === '' || hash === '#' || hash === '#/');
}

function ensureHomeEntry() {
  if (!isHomeRoute()) return;
  const page = document.getElementById('page-content');
  if (!page || document.getElementById('dripso-home-entry')) return;

  const entry = document.createElement('a');
  entry.id = 'dripso-home-entry';
  entry.className = 'dripso-home-entry';
  entry.href = DRIPSO_PATH;
  entry.setAttribute('aria-label', '드립소 유머 페이지로 이동');

  const icon = document.createElement('span');
  icon.className = 'dripso-home-entry-icon';
  icon.textContent = '🤣';

  const copy = document.createElement('span');
  copy.className = 'dripso-home-entry-copy';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'dripso-home-entry-eyebrow';
  eyebrow.textContent = '새로 문 연 웃음 휴게소';

  const title = document.createElement('strong');
  title.textContent = '드립소에서 잠깐 웃고 가기';

  const description = document.createElement('span');
  description.className = 'dripso-home-entry-description';
  description.textContent = '생활 드립을 랜덤으로 뽑고 저장하고 공유합니다.';

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

function ensureEntries() {
  ensureDripsoNav();
  ensureHomeEntry();
}

let scheduled = false;
function scheduleEnsure() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    ensureEntries();
  });
}

const observer = new MutationObserver(scheduleEnsure);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleEnsure);
window.addEventListener('pageshow', scheduleEnsure);
ensureEntries();
