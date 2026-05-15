import { auth } from './firebase.js';

const NAV_PATCH_STYLE_ID = 'sosoking-pc-mobile-navigation-patch';
let scheduled = false;
let lastAvatarState = '';
let lastDeviceState = '';

function injectNavPatchStyle() {
  if (document.getElementById(NAV_PATCH_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = NAV_PATCH_STYLE_ID;
  style.textContent = `
    @media (min-width: 901px) {
      html body #bottom-nav,
      html body .bottom-nav,
      html body nav.bottom-nav {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      html body #site-footer {
        padding-bottom: 32px !important;
      }

      html body .predict-app,
      html body .soso-feed-page,
      html body .soso-home-dashboard,
      html body .account-page,
      html body .mission-page,
      html body .guide-page,
      html body .feedback-page {
        padding-bottom: 56px !important;
      }

      html body .soso-dashboard-header .soso-top-links a[href="#/account"] {
        display: none !important;
      }

      html body .soso-dashboard-header .soso-top-tools {
        min-width: 360px !important;
      }

      html body .soso-dashboard-header .soso-top-avatar {
        min-width: 112px !important;
        height: 48px !important;
        padding: 0 10px 0 4px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.72) !important;
        border: 1px solid rgba(79,124,255,.12) !important;
        box-shadow: 0 10px 24px rgba(55,90,170,.08) !important;
      }

      html body .soso-dashboard-header .soso-top-avatar small {
        display: inline-flex !important;
        color: #151a33 !important;
        font-size: 13px !important;
        font-weight: 1000 !important;
        letter-spacing: -.04em !important;
        white-space: nowrap !important;
      }

      html body .soso-dashboard-header .soso-top-avatar:hover {
        background: #fff !important;
        transform: translateY(-1px) !important;
      }

      html body .soso-dashboard-header .soso-top-avatar.is-active {
        background: linear-gradient(135deg, rgba(255,232,92,.45), rgba(124,92,255,.13)) !important;
        border-color: rgba(124,92,255,.28) !important;
      }

      html body .soso-dashboard-header .soso-top-avatar i {
        width: 42px !important;
        height: 42px !important;
        font-size: 20px !important;
      }

      html body .soso-dashboard-header .soso-top-avatar span {
        font-size: 15px !important;
      }
    }

    @media (max-width: 900px) {
      html body .soso-dashboard-header {
        display: none !important;
      }

      html body #bottom-nav {
        display: flex !important;
      }

      html body #site-footer {
        padding-bottom: 72px !important;
      }
    }

    [data-theme="dark"] body .soso-dashboard-header .soso-top-avatar {
      background: rgba(255,255,255,.08) !important;
      border-color: rgba(255,255,255,.12) !important;
    }

    [data-theme="dark"] body .soso-dashboard-header .soso-top-avatar small {
      color: #f5f7fb !important;
    }
  `;
  document.head.appendChild(style);
}

function isRealSignedIn() {
  const user = auth.currentUser;
  return Boolean(user && !user.isAnonymous);
}

function patchDesktopHeader() {
  document.querySelectorAll('.soso-dashboard-header .soso-top-links a[href="#/account"]').forEach(link => link.remove());

  const avatar = document.querySelector('.soso-dashboard-header .soso-top-avatar');
  if (!avatar) return;

  const signedIn = isRealSignedIn();
  const isAccount = (location.hash || '#/') === '#/account';
  const state = `${signedIn ? 'in' : 'out'}:${isAccount ? 'account' : 'other'}`;

  if (lastAvatarState !== state || avatar.dataset.navPatchState !== state) {
    lastAvatarState = state;
    avatar.dataset.navPatchState = state;
    avatar.classList.toggle('is-active', isAccount);
    avatar.setAttribute('aria-label', signedIn ? '내 정보로 이동' : '로그인으로 이동');
    avatar.innerHTML = `<i>${signedIn ? '🧑' : '🔐'}</i><small>${signedIn ? '내정보' : '로그인'}</small><span>⌄</span>`;
  } else {
    avatar.classList.toggle('is-active', isAccount);
  }

  if (avatar.dataset.navPatchClick !== '1') {
    avatar.dataset.navPatchClick = '1';
    avatar.addEventListener('click', () => {
      location.hash = isRealSignedIn() ? '#/account' : '#/login';
    });
  }
}

function patchDeviceMode() {
  injectNavPatchStyle();
  const isDesktop = window.matchMedia('(min-width: 901px)').matches;
  const state = isDesktop ? 'pc' : 'mobile';

  if (lastDeviceState !== state) {
    lastDeviceState = state;
    document.body.classList.toggle('soso-pc-mode', isDesktop);
    document.body.classList.toggle('soso-mobile-mode', !isDesktop);
  }

  if (isDesktop) patchDesktopHeader();
}

function schedulePatch() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    patchDeviceMode();
  });
}

const observer = new MutationObserver(schedulePatch);
observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedulePatch);
else schedulePatch();

window.addEventListener('hashchange', schedulePatch);
window.addEventListener('resize', () => setTimeout(schedulePatch, 80));
auth.onAuthStateChanged?.(() => setTimeout(schedulePatch, 0));
setTimeout(schedulePatch, 0);
setTimeout(schedulePatch, 300);
setTimeout(schedulePatch, 1000);
