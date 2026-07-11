const ICONS = {
  '#/': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z"/></svg>',
  '#/board': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v14H4zM8 9h8M8 13h8M8 17h5"/></svg>',
  '#/submit': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/></svg>',
  '#/my-cases': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h6l1.5 2H20v10H4z"/></svg>',
  '#/login': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v14h-5M10 8l4 4-4 4M14 12H4"/></svg>',
  '#/admin': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6zM9 12l2 2 4-4"/></svg>',
};

const LABELS = {
  '#/': '홈',
  '#/board': '공개재판',
  '#/submit': '접수',
  '#/my-cases': '내 사건',
  '#/login': '로그인',
  '#/admin': '운영',
};

let scheduled = false;

function currentPath() {
  return (location.hash || '#/').split('?')[0].replace(/^#/, '') || '/';
}

function normalizedHref(link) {
  return link.getAttribute('href') || '';
}

function isActive(href, path) {
  if (href === '#/') return path === '/';
  if (href === '#/submit') return path === '/submit' || path.startsWith('/trial/') || path.startsWith('/result/');
  return path === href.replace(/^#/, '');
}

function decorateLink(link) {
  const href = normalizedHref(link);
  if (!ICONS[href]) return;
  link.classList.add('bottom-nav-item');
  if (href === '#/submit') link.classList.add('bottom-nav-primary');
  if (link.dataset.bottomNavDecorated !== 'true') {
    const label = LABELS[href] || link.textContent.trim();
    link.innerHTML = `<span class="bottom-nav-icon">${ICONS[href]}</span><span class="bottom-nav-label">${label}</span>`;
    link.dataset.bottomNavDecorated = 'true';
  }
  link.classList.toggle('active', isActive(href, currentPath()));
  link.setAttribute('aria-current', isActive(href, currentPath()) ? 'page' : 'false');
}

function syncHeaderAccount(nav) {
  const header = document.querySelector('.header-inner');
  if (!header) return;

  let account = header.querySelector('.header-account');
  if (!account) {
    account = document.createElement('div');
    account.className = 'header-account';
    header.appendChild(account);
  }
  account.replaceChildren();

  const admin = nav.querySelector('[data-admin-nav]');
  if (admin) {
    admin.classList.add('bottom-nav-hidden-control');
    const adminLink = document.createElement('a');
    adminLink.className = 'header-admin-link';
    adminLink.href = '#/admin';
    adminLink.textContent = '운영';
    account.appendChild(adminLink);
  }

  const chip = nav.querySelector('.user-chip');
  if (chip) {
    chip.classList.add('bottom-nav-hidden-control');
    const copy = chip.cloneNode(true);
    copy.removeAttribute('id');
    account.appendChild(copy);
  }

  const logout = nav.querySelector('#logout-button');
  if (logout) {
    logout.classList.add('bottom-nav-hidden-control');
    const proxy = document.createElement('button');
    proxy.className = 'header-logout';
    proxy.type = 'button';
    proxy.textContent = '로그아웃';
    proxy.addEventListener('click', () => logout.click());
    account.appendChild(proxy);
  }
}

function reorderLinks(nav) {
  const order = ['#/','#/board','#/submit','#/my-cases','#/login'];
  const links = [...nav.querySelectorAll('a.nav-link')];
  order.forEach(href => {
    const link = links.find(item => normalizedHref(item) === href);
    if (link) nav.appendChild(link);
  });
  const controls = [...nav.querySelectorAll('.user-chip, .nav-button, [data-admin-nav]')];
  controls.forEach(item => nav.appendChild(item));
}

function enhanceNavigation() {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;

  nav.classList.add('bottom-nav');
  nav.setAttribute('aria-label', '하단 주요 메뉴');
  reorderLinks(nav);
  nav.querySelectorAll('a.nav-link').forEach(decorateLink);
  syncHeaderAccount(nav);
  document.body.classList.add('has-bottom-nav');
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    enhanceNavigation();
  });
}

window.addEventListener('hashchange', scheduleEnhance);
new MutationObserver(scheduleEnhance).observe(document.getElementById('app'), { childList: true, subtree: true });
scheduleEnhance();
