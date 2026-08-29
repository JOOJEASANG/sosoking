const ROUTE_ICONS = [
  ['#/trial/', '🏛️'],
  ['#/result/', '⚖️'],
  ['#/verdict/', '⚖️'],
  ['#/discussion/', '💬'],
  ['#/board', '📜'],
  ['#/submit', '📝'],
  ['#/my-cases', '🗂️'],
  ['#/guide', '📖'],
  ['#/auth', '👤'],
  ['#/policy/privacy', '🔒'],
  ['#/policy/ai_disclaimer', '🤖'],
  ['#/policy/terms', '📄']
];

const TITLE_ICONS = [
  ['화면 오류', '⚠️'],
  ['사건 처리', '🏛️'],
  ['판결문', '⚖️'],
  ['판결기록', '📜'],
  ['토론', '💬'],
  ['사건 접수', '📝'],
  ['내 사건', '🗂️'],
  ['내 정보', '👤'],
  ['내 계정', '👤'],
  ['이용 안내', '📖'],
  ['로그인', '🔐'],
  ['회원가입', '✍️'],
  ['개인정보', '🔒'],
  ['AI 서비스', '🤖'],
  ['이용약관', '📄']
];

const LEADING_ICON_PATTERN = /^[\s\u200d\ufe0f\u20e3\u2190-\u2bff\u{1f000}-\u{1faff}]+/u;

function ensureSingleHeaderIconStyle() {
  if (document.getElementById('single-header-icon-style')) return;
  const style = document.createElement('style');
  style.id = 'single-header-icon-style';
  style.textContent = `
    .page-header .logo::before{display:none!important;content:none!important;}
    .page-header .logo{gap:0!important;}
  `;
  document.head.appendChild(style);
}

function stripLeadingIcons(value) {
  return String(value || '').replace(LEADING_ICON_PATTERN, '').trim();
}

function iconFor(route, title) {
  const routeMatch = ROUTE_ICONS.find(([prefix]) => String(route || '').startsWith(prefix));
  if (routeMatch) return routeMatch[1];
  const titleMatch = TITLE_ICONS.find(([keyword]) => title.includes(keyword));
  return titleMatch?.[1] || '⚖️';
}

export function normalizePageHeaderIcons(container, route = '') {
  ensureSingleHeaderIconStyle();
  container?.querySelectorAll('.page-header .logo').forEach(titleElement => {
    const cleanTitle = stripLeadingIcons(titleElement.textContent);
    if (!cleanTitle) return;
    const icon = iconFor(route, cleanTitle);
    titleElement.textContent = `${icon} ${cleanTitle}`;
    titleElement.dataset.singleHeaderIcon = 'true';
  });
}
