const SERVICE_HUB_ID = 'sosoking-service-hub';

function isAccountRoute() {
  const hash = location.hash || '';
  const path = location.pathname.replace(/\/$/, '') || '/';
  return (path === '/' && hash.startsWith('#/auth')) || path === '/auth';
}

function serviceLink({ href, icon, title, description, label }) {
  const link = document.createElement('a');
  link.className = 'sosoking-service-hub-link';
  link.href = href;
  link.setAttribute('aria-label', label);

  const mark = document.createElement('span');
  mark.className = 'sosoking-service-hub-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = icon;

  const copy = document.createElement('span');
  copy.className = 'sosoking-service-hub-copy';

  const strong = document.createElement('strong');
  strong.textContent = title;

  const small = document.createElement('small');
  small.textContent = description;

  copy.append(strong, small);
  link.append(mark, copy);
  return link;
}

function buildServiceHub() {
  const section = document.createElement('section');
  section.id = SERVICE_HUB_ID;
  section.className = 'sosoking-service-hub';
  section.setAttribute('aria-label', '소소킹 서비스 활동');

  const heading = document.createElement('div');
  heading.className = 'sosoking-service-hub-heading';

  const eyebrow = document.createElement('span');
  eyebrow.textContent = 'SOSOKING ACCOUNT';

  const title = document.createElement('strong');
  title.textContent = '한 계정으로 판결소와 게임소를 이용합니다';

  const description = document.createElement('p');
  description.textContent = '판결 기록을 관리하고 게임소에서 친구·연인·지인과 함께 즐겨보세요.';

  heading.append(eyebrow, title, description);

  const links = document.createElement('div');
  links.className = 'sosoking-service-hub-links';
  links.append(
    serviceLink({
      href: '#/my-cases',
      icon: '⚖️',
      title: '판결소 활동',
      description: '내 사건과 판결 기록 보기',
      label: '판결소 내 사건으로 이동'
    }),
    serviceLink({
      href: '/game/',
      icon: '🎮',
      title: '게임소',
      description: '친구·연인·지인과 같이 놀기',
      label: '소소킹 게임소로 이동'
    })
  );

  section.append(heading, links);
  return section;
}

function normalizeAccountPage() {
  if (!isAccountRoute()) {
    document.getElementById(SERVICE_HUB_ID)?.remove();
    return;
  }

  const logo = document.querySelector('#page-content .page-header .logo');
  if (logo && logo.textContent.trim() !== '👤 내 정보') logo.textContent = '👤 내 정보';

  const box = document.getElementById('auth-box');
  if (!box || !box.querySelector('#change-nick')) {
    document.getElementById(SERVICE_HUB_ID)?.remove();
    return;
  }

  let hub = document.getElementById(SERVICE_HUB_ID);
  if (!hub) hub = buildServiceHub();
  const logout = box.querySelector('#logout');
  if (hub.parentElement !== box || (logout && hub.nextElementSibling !== logout)) {
    if (logout) box.insertBefore(hub, logout);
    else box.append(hub);
  }
}

let scheduled = false;
function scheduleNormalize() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    normalizeAccountPage();
  });
}

const observer = new MutationObserver(scheduleNormalize);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleNormalize);
window.addEventListener('pageshow', scheduleNormalize);
normalizeAccountPage();
