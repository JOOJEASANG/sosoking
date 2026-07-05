/* community-mobile-center-fix.js
   커뮤니티 모바일 좌측 쏠림 최종 보정
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
        width: 100% !important;
        max-width: 100% !important;
        padding-left: 14px !important;
        padding-right: 14px !important;
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
        margin-left: auto !important;
        margin-right: auto !important;
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
        padding-left: 12px !important;
        padding-right: 12px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function fixCommunityWidth() {
  injectStyle();
  const page = document.querySelector('#page-content .feed-page-list-only');
  if (!page) return;
  page.style.marginLeft = 'auto';
  page.style.marginRight = 'auto';
  page.style.boxSizing = 'border-box';
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(fixCommunityWidth, 60);
}

document.addEventListener('DOMContentLoaded', schedule);
window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

schedule();
