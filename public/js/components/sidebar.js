/* sidebar.js — PC 좌측 사이드바 (≥1024px) */
import { auth, signOut } from '../firebase.js';
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}
function iconHome(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-6h5v6"/>');}
function iconFeed(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M4 6.5h16M4 12h16M4 17.5h16"/>');}
function iconStats(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-9"/>');}
function iconScraps(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/>');}
function iconAdmin(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a8 8 0 0 0 .1-1 8 8 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.7-1L15 5.5h-4L10.7 8a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0-.1 1 8 8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"/>');}
function iconAccount(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>');}
function iconWrite(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15M4.5 12h15"/>','2');}
function iconSun(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>');}
function iconMoon(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M21 15.5A8.5 8.5 0 0 1 8.5 3 8.5 8.5 0 1 0 21 15.5Z"/>');}
function iconInstall(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/>');}
function isDark(){return document.documentElement.getAttribute('data-theme')==='dark';}
function isIOS(){return /iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.MSStream;}
function isAndroid(){return /Android/i.test(navigator.userAgent)&&!isIOS();}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||!!navigator.standalone;}
function isNavActive(navPath, currentPath){
  return currentPath===navPath;
}

function showIOSInstallGuide(){const prev=document.getElementById('ios-install-tip');if(prev){prev.remove();return;}const tip=document.createElement('div');tip.id='ios-install-tip';tip.style.cssText='position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:10000;width:min(320px,calc(100vw - 32px));background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.2);text-align:center;font-size:13px;line-height:1.65';tip.innerHTML='<div style="font-size:24px;margin-bottom:8px">📲</div><div style="font-weight:800;color:var(--color-text-primary);margin-bottom:6px">홈 화면에 추가하기</div><div style="color:var(--color-text-secondary)">Safari 하단 <b>공유 버튼 ⬆</b> 탭 후<br><b>"홈 화면에 추가"</b>를 선택하세요</div><button id="ios-tip-close" style="margin-top:14px;padding:7px 24px;background:var(--color-primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer">확인</button>';document.body.appendChild(tip);document.getElementById('ios-tip-close')?.addEventListener('click',()=>tip.remove());setTimeout(()=>tip.remove(),10000);}

function showAndroidInstallGuide(){const prev=document.getElementById('android-install-tip');if(prev){prev.remove();return;}const ua=navigator.userAgent;const isInApp=/KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NaverApp|Twitter|Snapchat/i.test(ua);const tip=document.createElement('div');tip.id='android-install-tip';tip.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10000;width:min(340px,calc(100vw - 32px));background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.2);text-align:center;font-size:13px;line-height:1.7';if(isInApp){tip.innerHTML='<div style="font-size:24px;margin-bottom:8px">⚠️</div><div style="font-weight:800;color:var(--color-text-primary);margin-bottom:8px">인앱 브라우저에서는 설치 불가</div><div style="color:var(--color-text-secondary);margin-bottom:14px">카카오톡·인스타그램 등 앱 내 브라우저는<br>PWA 설치를 지원하지 않아요.<br><b>Chrome 브라우저</b>로 직접 열어주세요.</div><button id="android-tip-close" style="padding:9px 32px;background:var(--color-primary);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">확인</button>';}else{tip.innerHTML='<div style="font-size:24px;margin-bottom:8px">📲</div><div style="font-weight:800;color:var(--color-text-primary);margin-bottom:10px">Chrome에서 앱 설치하기</div><div style="color:var(--color-text-secondary);text-align:left;margin-bottom:14px"><div style="margin-bottom:6px">① Chrome 주소창 오른쪽 <b>⋮ 메뉴</b> 탭</div><div style="margin-bottom:6px">② <b>"앱 설치"</b> 또는 <b>"홈 화면에 추가"</b> 선택</div><div style="font-size:12px;color:var(--color-text-muted);margin-top:8px">주소창에 설치 아이콘(⊕)이 보이면 그것을 탭해도 됩니다.</div></div><button id="android-tip-close" style="width:100%;padding:10px 0;background:var(--color-primary);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">확인</button>';}document.body.appendChild(tip);document.getElementById('android-tip-close')?.addEventListener('click',()=>tip.remove());setTimeout(()=>tip.remove(),20000);}

function renderNavItem(item, currentPath) {
  const active = isNavActive(item.path, currentPath);
  const badgeHTML = (item.badge > 0)
    ? `<span class="sidebar__nav-badge">${item.badge > 99 ? '99+' : item.badge}</span>`
    : '';
  const cls = [
    'sidebar__nav-item',
    active ? 'active' : '',
    item.isAdmin ? 'sidebar__nav-item--admin' : '',
  ].filter(Boolean).join(' ');
  return `<a href="#${item.path}" class="${cls}" aria-current="${active ? 'page' : 'false'}" data-nav="${item.path}">
    ${item.icon}<span>${item.label}</span>${badgeHTML}
  </a>`;
}

export function renderSidebar() {
  const el = document.getElementById('site-sidebar');
  if (!el) return;
  const user    = appState.user;
  const isAdmin = appState.isAdmin;
  const path    = window.location.hash.slice(1).split('?')[0] || '/';
  const dark    = isDark();
  const unread  = appState.unreadNotifications || 0;

  const MAIN_NAV = [
    { label: '홈',     path: '/',        icon: iconHome() },
    { label: '피드',   path: '/feed',    icon: iconFeed() },
    { label: '🏛️ 정당', path: '/parties', icon: '' },
    { label: '🏛️ 헌법재판소', path: '/constitutional-court', icon: '' },
    { label: '통계',   path: '/hall',    icon: iconStats() },
  ];

  const PERSONAL_NAV = user ? [
    { label: '내정보', path: '/account', icon: iconAccount(), badge: unread },
    { label: '스크랩', path: '/scraps',  icon: iconScraps() },
  ] : [];

  const ADMIN_NAV = isAdmin ? [
    { label: '관리 패널', path: '/admin', icon: iconAdmin(), isAdmin: true },
  ] : [];

  const mainHTML     = MAIN_NAV.map(i => renderNavItem(i, path)).join('');
  const personalHTML = PERSONAL_NAV.map(i => renderNavItem(i, path)).join('');
  const adminHTML    = ADMIN_NAV.map(i => renderNavItem(i, path)).join('');

  const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '사용자';
  const avatarLetter = escHtml((nickname || '나')[0]);
  const avatarInner = user?.photoURL
    ? `<img src="${escHtml(user.photoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : avatarLetter;

  const userSection = user ? `
    <div class="sidebar__user-wrap">
      <div class="sidebar__user">
        <div class="sidebar__user-avatar" id="sb-avatar" role="button" tabindex="0" aria-label="내 정보">
          ${avatarInner}
        </div>
        <div class="sidebar__user-info">
          <div class="sidebar__user-name" id="sb-username">${escHtml(nickname)}</div>
          ${isAdmin ? '<div class="sidebar__user-role">🔑 관리자</div>' : ''}
        </div>
      </div>
      <button class="sidebar__logout-btn" id="sb-logout-btn" aria-label="로그아웃">
        ${svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M15 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3M10 12h10m0 0-3-3m3 3-3 3"/>')}
        <span>로그아웃</span>
      </button>
    </div>` : `<a href="#/login" class="sidebar__login-btn">로그인 / 가입</a>`;

  const showInstall = (appState.installPrompt || isIOS() || isAndroid()) && !isStandalone();

  el.innerHTML = `
    <div class="sidebar__logo">
      <a href="#/" class="sidebar__brand" aria-label="소소킹 홈" data-nav="/">
        <img src="/logo.svg" alt="" width="28" height="28">
        <span class="sidebar__brand-name">소소킹</span>
      </a>
    </div>

    <nav class="sidebar__nav" aria-label="주 내비게이션">
      ${mainHTML}

      ${PERSONAL_NAV.length > 0 ? `
        <div class="sidebar__nav-divider"></div>
        ${personalHTML}
      ` : ''}

      ${ADMIN_NAV.length > 0 ? `
        <div class="sidebar__nav-divider"></div>
        <div class="sidebar__nav-section-label">사이트 관리</div>
        ${adminHTML}
      ` : ''}
    </nav>

    <div class="sidebar__write">
      <button class="sidebar__write-btn" id="sb-write-btn" aria-label="AI킹">
        <span style="font-size:18px">🤖</span><span>AI킹 정치소</span>
      </button>
    </div>

    <div class="sidebar__bottom">
      ${userSection}
      <div class="sidebar__footer-utils">
        <button class="sidebar__util-btn" id="sb-theme-btn" aria-label="${dark ? '라이트 모드로 전환' : '다크 모드로 전환'}">
          ${dark ? iconSun() : iconMoon()}
          <span>${dark ? '라이트 모드' : '다크 모드'}</span>
        </button>
        ${showInstall ? `
          <button class="sidebar__util-btn" id="sb-pwa-btn" aria-label="앱 설치">
            ${iconInstall()}<span>앱 설치</span>
          </button>` : ''}
      </div>
    </div>`;

  el.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); navigate(link.dataset.nav); });
  });

  document.getElementById('sb-write-btn')?.addEventListener('click', () => {
    navigate('/constitutional-court');
  });

  document.getElementById('sb-avatar')?.addEventListener('click', () => navigate('/account'));
  document.getElementById('sb-username')?.addEventListener('click', () => navigate('/account'));

  document.getElementById('sb-logout-btn')?.addEventListener('click', async () => {
    await signOut(auth);
    navigate('/');
  });

  document.getElementById('sb-theme-btn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    renderSidebar();
  });

  document.getElementById('sb-pwa-btn')?.addEventListener('click', async () => {
    const prompt = appState.installPrompt || window.__pwaInstallPrompt;
    if (prompt) {
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          window.__pwaInstallPrompt = null;
          appState.installPrompt = null;
          renderSidebar();
        } else {
          if (isIOS()) showIOSInstallGuide();
          else showAndroidInstallGuide();
        }
      } catch {
        if (isIOS()) showIOSInstallGuide();
        else showAndroidInstallGuide();
      }
    } else if (isIOS()) {
      showIOSInstallGuide();
    } else {
      showAndroidInstallGuide();
    }
  });
}

window.addEventListener('hashchange', () => {
  const el = document.getElementById('site-sidebar');
  if (!el) return;
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  el.querySelectorAll('[data-nav]').forEach(link => {
    const active = isNavActive(link.dataset.nav, path);
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
});
