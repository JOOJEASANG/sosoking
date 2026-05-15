const DESKTOP_PAGES_STYLE_ID = 'sosoking-desktop-pages-final-patch';

function injectDesktopPagesStyle() {
  if (document.getElementById(DESKTOP_PAGES_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DESKTOP_PAGES_STYLE_ID;
  style.textContent = `
    @media (min-width: 901px) {
      html body.soso-desktop-page-active {
        background: #f7f9ff !important;
        overflow-x: hidden !important;
      }

      html body.soso-desktop-page-active #app,
      html body.soso-desktop-page-active #page-content {
        width: 100% !important;
        max-width: none !important;
        overflow: visible !important;
      }

      html body.soso-desktop-page-active main.predict-app:not(.pc-home-like-shot),
      html body.soso-desktop-page-active .soso-feed-page,
      html body.soso-desktop-page-active .account-page,
      html body.soso-desktop-page-active .mission-page,
      html body.soso-desktop-page-active .guide-page,
      html body.soso-desktop-page-active .feedback-page {
        width: 100vw !important;
        max-width: none !important;
        margin-left: calc(50% - 50vw) !important;
        margin-right: calc(50% - 50vw) !important;
        padding: 24px clamp(28px, 3vw, 56px) 64px !important;
        box-sizing: border-box !important;
        background:
          radial-gradient(circle at 12% 0%, rgba(255,232,92,.16), transparent 24%),
          radial-gradient(circle at 78% 0%, rgba(124,92,255,.12), transparent 30%),
          linear-gradient(180deg, #fbfcff 0%, #f5f7ff 100%) !important;
        color: #10172f !important;
      }

      /* Shared page headers */
      html body.soso-desktop-page-active .simple-header,
      html body.soso-desktop-page-active .feed-write-header,
      html body.soso-desktop-page-active .account-hero,
      html body.soso-desktop-page-active .feed-hero,
      html body.soso-desktop-page-active .mission-hero,
      html body.soso-desktop-page-active .guide-hero,
      html body.soso-desktop-page-active .feedback-hero {
        width: min(1680px, calc(100vw - clamp(56px, 6vw, 112px))) !important;
        max-width: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
        box-sizing: border-box !important;
      }

      html body.soso-desktop-page-active .simple-header,
      html body.soso-desktop-page-active .feed-write-header {
        display: grid !important;
        grid-template-columns: 52px minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 16px !important;
        min-height: 92px !important;
        padding: 20px 24px !important;
        border-radius: 30px !important;
        background: rgba(255,255,255,.94) !important;
        border: 1px solid rgba(104,121,255,.13) !important;
        box-shadow: 0 16px 50px rgba(43,61,130,.09) !important;
      }

      html body.soso-desktop-page-active .simple-header h1,
      html body.soso-desktop-page-active .feed-write-header h1 {
        font-size: clamp(30px, 2.3vw, 44px) !important;
        line-height: 1.12 !important;
        letter-spacing: -.065em !important;
      }

      /* Feed list page */
      html body.soso-desktop-page-active .soso-feed-page.feed-polish {
        padding-top: 24px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-hero,
      html body.soso-desktop-page-active .soso-feed-page .feed-dashboard,
      html body.soso-desktop-page-active .soso-feed-page .feed-search-panel,
      html body.soso-desktop-page-active .soso-feed-page .feed-layout,
      html body.soso-desktop-page-active .soso-feed-page .feed-detail-layout,
      html body.soso-desktop-page-active .soso-feed-page .comments-section {
        width: min(1680px, calc(100vw - clamp(56px, 6vw, 112px))) !important;
        max-width: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
        box-sizing: border-box !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-hero-fixed,
      html body.soso-desktop-page-active .soso-feed-page .feed-hero {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) clamp(290px, 22vw, 380px) !important;
        gap: 18px !important;
        min-height: 260px !important;
        border-radius: 32px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-dashboard {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 16px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-search-panel {
        margin-top: 16px !important;
        margin-bottom: 16px !important;
        padding: 18px !important;
        border-radius: 28px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-layout {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) clamp(300px, 21vw, 360px) !important;
        gap: 20px !important;
        align-items: start !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-main {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-list {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 18px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-card {
        width: auto !important;
        max-width: none !important;
        min-width: 0 !important;
        border-radius: 26px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-side,
      html body.soso-desktop-page-active .soso-feed-page .detail-side {
        position: sticky !important;
        top: 96px !important;
        display: grid !important;
        gap: 14px !important;
        width: 100% !important;
        min-width: 0 !important;
      }

      /* Feed detail */
      html body.soso-desktop-page-active .soso-feed-page .feed-detail-layout {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) clamp(300px, 22vw, 380px) !important;
        gap: 20px !important;
        align-items: start !important;
        margin-top: 18px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .detail-main-card {
        max-width: none !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .comments-section {
        margin-top: 20px !important;
        padding: 22px !important;
        border-radius: 28px !important;
        background: rgba(255,255,255,.94) !important;
        border: 1px solid rgba(104,121,255,.13) !important;
        box-shadow: 0 15px 46px rgba(43,61,130,.08) !important;
      }

      /* Feed write page */
      html body.soso-desktop-page-active .soso-feed-page .write-layout {
        width: min(1680px, calc(100vw - clamp(56px, 6vw, 112px))) !important;
        max-width: none !important;
        margin: 18px auto 0 !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) clamp(360px, 28vw, 500px) !important;
        gap: 22px !important;
        align-items: start !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .write-card,
      html body.soso-desktop-page-active .soso-feed-page .write-preview {
        max-width: none !important;
        width: 100% !important;
        border-radius: 30px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .write-preview {
        position: sticky !important;
        top: 96px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .category-grid {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .fun-type-tabs,
      html body.soso-desktop-page-active .soso-feed-page .write-tabs {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .option-editor {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 10px !important;
      }

      /* Mission page */
      html body.soso-desktop-page-active .mission-page .mission-hero,
      html body.soso-desktop-page-active .mission-page .mission-layout,
      html body.soso-desktop-page-active .mission-page .mission-grid,
      html body.soso-desktop-page-active .mission-page .mission-section {
        width: min(1680px, calc(100vw - clamp(56px, 6vw, 112px))) !important;
        max-width: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html body.soso-desktop-page-active .mission-page .mission-layout,
      html body.soso-desktop-page-active .mission-page .mission-grid {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 18px !important;
      }

      /* Account page */
      html body.soso-desktop-page-active .account-page .account-hero,
      html body.soso-desktop-page-active .account-page .account-layout {
        width: min(1500px, calc(100vw - clamp(56px, 7vw, 130px))) !important;
        max-width: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html body.soso-desktop-page-active .account-page .account-layout {
        display: grid !important;
        grid-template-columns: clamp(280px, 22vw, 340px) minmax(0, 1fr) !important;
        gap: 20px !important;
      }

      html body.soso-desktop-page-active .account-page .account-panels {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 16px !important;
      }

      html body.soso-desktop-page-active .account-page .account-card {
        max-width: none !important;
        width: 100% !important;
      }

      html body.soso-desktop-page-active .account-page .delete-zone,
      html body.soso-desktop-page-active .account-page .install {
        grid-column: span 1 !important;
      }

      /* Guide / Feedback / Policy pages */
      html body.soso-desktop-page-active .guide-page > section,
      html body.soso-desktop-page-active .feedback-page > section,
      html body.soso-desktop-page-active .policy-page > section,
      html body.soso-desktop-page-active .doc-page > section,
      html body.soso-desktop-page-active .predict-policy-page > section {
        width: min(1320px, calc(100vw - clamp(56px, 8vw, 150px))) !important;
        max-width: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
    }

    @media (min-width: 901px) and (max-width: 1280px) {
      html body.soso-desktop-page-active .soso-feed-page .feed-list {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-layout,
      html body.soso-desktop-page-active .soso-feed-page .feed-detail-layout,
      html body.soso-desktop-page-active .soso-feed-page .write-layout {
        grid-template-columns: minmax(0, 1fr) 320px !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .category-grid,
      html body.soso-desktop-page-active .mission-page .mission-layout,
      html body.soso-desktop-page-active .mission-page .mission-grid,
      html body.soso-desktop-page-active .account-page .account-panels {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
    }

    @media (max-width: 900px) {
      html body.soso-desktop-page-active main.predict-app:not(.pc-home-like-shot),
      html body.soso-desktop-page-active .soso-feed-page,
      html body.soso-desktop-page-active .account-page,
      html body.soso-desktop-page-active .mission-page,
      html body.soso-desktop-page-active .guide-page,
      html body.soso-desktop-page-active .feedback-page {
        width: 100% !important;
        max-width: 560px !important;
        margin: 0 auto !important;
        padding: 14px 14px 108px !important;
        box-sizing: border-box !important;
      }

      html body.soso-desktop-page-active .soso-feed-page .feed-layout,
      html body.soso-desktop-page-active .soso-feed-page .feed-detail-layout,
      html body.soso-desktop-page-active .soso-feed-page .write-layout,
      html body.soso-desktop-page-active .account-page .account-layout {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 14px !important;
        width: 100% !important;
        max-width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function updateDesktopPageClass() {
  const hash = location.hash || '#/';
  const isHome = hash === '#/' || hash === '' || hash === '#';
  const hasPage = Boolean(document.querySelector('main.predict-app'));
  document.body.classList.toggle('soso-desktop-page-active', hasPage && !isHome);
  if (hasPage) injectDesktopPagesStyle();
}

const observer = new MutationObserver(updateDesktopPageClass);
observer.observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateDesktopPageClass);
} else {
  updateDesktopPageClass();
}

setTimeout(updateDesktopPageClass, 0);
setTimeout(updateDesktopPageClass, 250);
setTimeout(updateDesktopPageClass, 1000);
window.addEventListener('hashchange', () => setTimeout(updateDesktopPageClass, 0));
