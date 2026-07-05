/* community-mobile-center-fix.js
   커뮤니티 모바일 좌우 여백 동일 보정
*/

const STYLE_ID = 'sosoking-community-mobile-center-fix-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #page-content .soso-feed-page.feed-page-list-only,
    #page-content .feed-page-list-only {
      box-sizing: border-box !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }

    @media (min-width: 1024px) {
      #page-content .soso-feed-page.feed-page-list-only,
      #page-content .feed-page-list-only {
        width: min(100%, 920px) !important;
        max-width: 920px !important;
      }
    }

    @media (max-width: 1023px) {
      #page-content {
        overflow-x: hidden !important;
      }

      #page-content .soso-feed-page.feed-page-list-only,
      #page-content .feed-page-list-only {
        width: calc(100vw - 32px) !important;
        max-width: calc(100vw - 32px) !important;
        margin-left: calc(50% - 50vw + 16px) !important;
        margin-right: calc(50% - 50vw + 16px) !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        transform: none !important;
        left: auto !important;
        right: auto !important;
      }

      #page-content .feed-page-list-only > *,
      #page-content .soso-feed-modern-head,
      #page-content .soso-feed-summary,
      #page-content .soso-feed-list,
      #page-content .feed-pagination,
      #page-content #feed-loader {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        box-sizing: border-box !important;
      }

      #page-content .soso-feed-modern-head {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }

      #page-content .feed-card,
      #page-content .soso-feed-summary,
      #page-content .empty-state {
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
    }

    @media (max-width: 374px) {
      #page-content .soso-feed-page.feed-page-list-only,
      #page-content .feed-page-list-only {
        width: calc(100vw - 24px) !important;
        max-width: calc(100vw - 24px) !important;
        margin-left: calc(50% - 50vw + 12px) !important;
        margin-right: calc(50% - 50vw + 12px) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function fixCommunityWidth() {
  injectStyle();
  const page = document.querySelector('#page-content .feed-page-list-only');
  if (!page) return;
  if (window.innerWidth <= 1023) {
    const side = window.innerWidth <= 374 ? 12 : 16;
    page.style.width = `calc(100vw - ${side * 2}px)`;
    page.style.maxWidth = `calc(100vw - ${side * 2}px)`;
    page.style.marginLeft = `calc(50% - 50vw + ${side}px)`;
    page.style.marginRight = `calc(50% - 50vw + ${side}px)`;
    page.style.paddingLeft = '0';
    page.style.paddingRight = '0';
  } else {
    page.style.width = 'min(100%, 920px)';
    page.style.maxWidth = '920px';
    page.style.marginLeft = 'auto';
    page.style.marginRight = 'auto';
  }
  page.style.boxSizing = 'border-box';
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(fixCommunityWidth, 60);
}

document.addEventListener('DOMContentLoaded', schedule);
window.addEventListener('hashchange', schedule);
window.addEventListener('resize', schedule);
window.addEventListener('orientationchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

schedule();
