const FINAL_HOME_STYLE_ID = 'sosoking-home-final-pc-mobile-patch';

function injectFinalHomeStyle() {
  if (document.getElementById(FINAL_HOME_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FINAL_HOME_STYLE_ID;
  style.textContent = `
    @media (min-width: 901px) {
      html body.soso-pc-home-active {
        overflow-x: hidden !important;
        background: #f7f9ff !important;
      }

      html body.soso-pc-home-active #app,
      html body.soso-pc-home-active #page-content {
        width: 100% !important;
        max-width: none !important;
        overflow: visible !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot,
      html body.soso-pc-home-active main.soso-home-dashboard,
      html body.soso-pc-home-active #page-content > main {
        width: 100vw !important;
        max-width: none !important;
        min-width: 0 !important;
        margin-left: calc(50% - 50vw) !important;
        margin-right: calc(50% - 50vw) !important;
        padding: 18px clamp(24px, 2.35vw, 48px) 48px !important;
        box-sizing: border-box !important;
        background:
          radial-gradient(circle at 8% 0%, rgba(255,232,92,.22), transparent 25%),
          radial-gradient(circle at 66% 2%, rgba(124,92,255,.16), transparent 28%),
          linear-gradient(180deg, #fbfcff 0%, #f5f7ff 100%) !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-shell {
        width: min(1780px, calc(100vw - clamp(48px, 4.7vw, 96px))) !important;
        max-width: none !important;
        min-width: 0 !important;
        margin: 0 auto !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) clamp(320px, 22vw, 380px) !important;
        gap: clamp(16px, 1.4vw, 24px) !important;
        align-items: start !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-main {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 16px !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-hero {
        width: 100% !important;
        max-width: none !important;
        min-height: clamp(340px, 25vw, 430px) !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1.1fr) minmax(360px, .62fr) !important;
        border-radius: 34px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-hero-copy {
        padding: clamp(38px, 3.2vw, 58px) clamp(36px, 3.3vw, 64px) !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-hero-copy h1 {
        font-size: clamp(58px, 4.95vw, 90px) !important;
        line-height: 1.04 !important;
        letter-spacing: -.095em !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-mascot-stage {
        min-height: clamp(340px, 25vw, 430px) !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-category-row {
        width: 100% !important;
        max-width: none !important;
        display: grid !important;
        grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
        gap: 14px !important;
        overflow: visible !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-category {
        width: auto !important;
        min-width: 0 !important;
        height: 112px !important;
        min-height: 112px !important;
        display: flex !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-feed-panel {
        width: 100% !important;
        max-width: none !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-feed-grid {
        width: 100% !important;
        max-width: none !important;
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 16px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-feed-card {
        width: auto !important;
        min-width: 0 !important;
        min-height: 312px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-sidebar {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 16px !important;
        position: sticky !important;
        top: 96px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-side-card {
        width: 100% !important;
        max-width: none !important;
        box-sizing: border-box !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-bottom-banners {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: 1fr 1fr 1.1fr !important;
        gap: 16px !important;
      }
    }

    @media (min-width: 901px) and (max-width: 1280px) {
      html body.soso-pc-home-active .pc-home-like-shot .dash-shell {
        width: calc(100vw - 40px) !important;
        grid-template-columns: minmax(0, 1fr) 320px !important;
        gap: 14px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-hero {
        grid-template-columns: minmax(0, 1fr) 330px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-feed-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-category-row {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }
    }

    @media (max-width: 900px) {
      html body.soso-pc-home-active {
        overflow-x: hidden !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot,
      html body.soso-pc-home-active main.soso-home-dashboard,
      html body.soso-pc-home-active #page-content > main {
        width: 100% !important;
        max-width: 520px !important;
        margin: 0 auto !important;
        padding: 12px 14px 110px !important;
        box-sizing: border-box !important;
        background: linear-gradient(180deg, #fffaf0 0%, #f5f7ff 100%) !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-shell {
        width: 100% !important;
        max-width: 100% !important;
        display: block !important;
        margin: 0 auto !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-main {
        display: grid !important;
        gap: 13px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-hero {
        display: grid !important;
        grid-template-columns: 1fr !important;
        min-height: auto !important;
        border-radius: 30px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-hero-copy {
        padding: 26px 20px 18px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-hero-copy h1 {
        font-size: clamp(38px, 11vw, 48px) !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-mascot-stage {
        min-height: 230px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-category-row {
        display: flex !important;
        gap: 10px !important;
        overflow-x: auto !important;
        scroll-snap-type: x mandatory !important;
        padding-bottom: 4px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-category {
        flex: 0 0 210px !important;
        min-width: 210px !important;
        height: 108px !important;
        scroll-snap-align: start !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-feed-grid,
      html body.soso-pc-home-active .pc-home-like-shot .dash-bottom-banners,
      html body.soso-pc-home-active .pc-home-like-shot .dash-sidebar {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 13px !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-sidebar {
        margin-top: 13px !important;
        position: static !important;
      }

      html body.soso-pc-home-active .pc-home-like-shot .dash-tabs {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function updateHomeClass() {
  const isHome = Boolean(document.querySelector('.pc-home-like-shot'));
  document.body.classList.toggle('soso-pc-home-active', isHome);
  if (isHome) injectFinalHomeStyle();
}

const observer = new MutationObserver(updateHomeClass);
observer.observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateHomeClass);
} else {
  updateHomeClass();
}

setTimeout(updateHomeClass, 0);
setTimeout(updateHomeClass, 250);
setTimeout(updateHomeClass, 1000);
window.addEventListener('hashchange', () => setTimeout(updateHomeClass, 0));
