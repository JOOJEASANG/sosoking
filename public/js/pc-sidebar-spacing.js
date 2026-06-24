import './crazy-consult-random.js';

const STYLE_ID = 'pc-sidebar-user-spacing-style';

function injectPcSidebarSpacing() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @media (min-width: 1024px) {
      .sidebar__bottom {
        gap: 15px !important;
        padding-bottom: 18px !important;
      }

      .sidebar__user-wrap {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        padding: 3px 0 1px !important;
      }

      .sidebar__user {
        min-height: 44px !important;
        padding: 4px 2px 6px !important;
        gap: 9px !important;
        align-items: center !important;
      }

      .sidebar__user-avatar {
        width: 36px !important;
        height: 36px !important;
      }

      .sidebar__user-name {
        line-height: 1.4 !important;
        font-size: 13px !important;
        font-weight: 800 !important;
      }

      .account-feedback-btn--sidebar,
      .sidebar__logout-btn {
        min-height: 35px !important;
        padding: 9px 10px !important;
        border-radius: 10px !important;
        line-height: 1.35 !important;
        gap: 8px !important;
      }

      .account-feedback-btn--sidebar {
        margin-top: 2px !important;
        margin-bottom: 0 !important;
        font-size: 12.5px !important;
        font-weight: 800 !important;
      }

      .sidebar__logout-btn {
        margin-top: 1px !important;
        font-size: 12.5px !important;
        font-weight: 800 !important;
      }

      .sidebar__logout-btn svg,
      .account-feedback-btn--sidebar svg {
        width: 17px !important;
        height: 17px !important;
        flex: 0 0 17px !important;
      }

      .sidebar__footer-utils {
        gap: 7px !important;
        padding-top: 2px !important;
      }

      .sidebar__util-btn {
        min-height: 34px !important;
        padding: 9px 10px !important;
        border-radius: 10px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

injectPcSidebarSpacing();
window.addEventListener('hashchange', injectPcSidebarSpacing);
window.addEventListener('sosoking:extensions-ready', injectPcSidebarSpacing);
