const MOBILE_HOME_STYLE_ID = 'sosoking-mobile-home-layout-fix';

function injectMobileHomeStyle() {
  if (document.getElementById(MOBILE_HOME_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MOBILE_HOME_STYLE_ID;
  style.textContent = `
    @media (max-width: 900px) {
      html body.soso-mode-mobile.soso-route-home {
        background: linear-gradient(180deg, #fffaf0 0%, #f5f7ff 100%) !important;
        overflow-x: hidden !important;
        padding-top: 0 !important;
      }

      html body.soso-mode-mobile.soso-route-home #app,
      html body.soso-mode-mobile.soso-route-home #page-content {
        width: 100% !important;
        max-width: none !important;
        overflow-x: hidden !important;
      }

      html body.soso-mode-mobile.soso-route-home .soso-dashboard-header {
        display: none !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot,
      html body.soso-mode-mobile.soso-route-home main.pc-home-like-shot,
      html body.soso-mode-mobile.soso-route-home .soso-home-dashboard {
        width: 100% !important;
        max-width: 520px !important;
        min-width: 0 !important;
        margin: 0 auto !important;
        padding: 12px 12px 112px !important;
        box-sizing: border-box !important;
        background: transparent !important;
        overflow-x: hidden !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-shell {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        margin: 0 !important;
        display: block !important;
        overflow: visible !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-main,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-sidebar {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
        position: static !important;
        top: auto !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-sidebar {
        margin-top: 12px !important;
      }

      /* 모바일 홈 히어로 */
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero {
        width: 100% !important;
        min-height: auto !important;
        display: block !important;
        grid-template-columns: 1fr !important;
        border-radius: 30px !important;
        overflow: hidden !important;
        background: linear-gradient(135deg, #ffffff 0%, #fff7df 45%, #f2edff 100%) !important;
        box-shadow: 0 16px 46px rgba(55,90,170,.12) !important;
        border: 1px solid rgba(79,124,255,.12) !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy {
        width: 100% !important;
        padding: 26px 20px 22px !important;
        box-sizing: border-box !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy span {
        font-size: 12px !important;
        margin-bottom: 8px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy h1 {
        margin: 0 !important;
        font-size: clamp(36px, 10.6vw, 46px) !important;
        line-height: 1.05 !important;
        letter-spacing: -.085em !important;
        word-break: keep-all !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy p {
        margin-top: 13px !important;
        max-width: none !important;
        font-size: 14px !important;
        line-height: 1.68 !important;
        word-break: keep-all !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 9px !important;
        margin-top: 18px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a {
        width: 100% !important;
        height: 48px !important;
        padding: 0 14px !important;
        border-radius: 18px !important;
        box-sizing: border-box !important;
        font-size: 14px !important;
      }

      /* PC용 마스코트 장식은 모바일에서 숨김 */
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-mascot-stage,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-orbit,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-spark,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-pedestal {
        display: none !important;
      }

      /* 카테고리 */
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category-row {
        width: 100% !important;
        max-width: 100% !important;
        display: flex !important;
        grid-template-columns: none !important;
        gap: 10px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding: 2px 2px 8px !important;
        scroll-snap-type: x mandatory !important;
        -webkit-overflow-scrolling: touch !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category-row::-webkit-scrollbar {
        display: none !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category {
        flex: 0 0 190px !important;
        width: 190px !important;
        min-width: 190px !important;
        height: 98px !important;
        min-height: 98px !important;
        padding: 15px !important;
        border-radius: 22px !important;
        scroll-snap-align: start !important;
        box-sizing: border-box !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category b {
        font-size: 15px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category span {
        font-size: 11px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category i {
        font-size: 32px !important;
      }

      /* 실시간 피드 */
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-panel,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners article {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 26px !important;
        box-sizing: border-box !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-panel {
        padding: 16px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head {
        display: block !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head span {
        font-size: 16px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-tabs {
        display: none !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-grid {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
        margin-top: 14px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card {
        width: 100% !important;
        min-width: 0 !important;
        min-height: auto !important;
        padding: 12px !important;
        border-radius: 22px !important;
        box-sizing: border-box !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card img,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .feed-thumb,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .feed-vote-preview,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .feed-link-preview {
        height: 142px !important;
        border-radius: 17px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card h3 {
        font-size: 17px !important;
        line-height: 1.35 !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card footer {
        flex-wrap: wrap !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-more {
        width: 100% !important;
        margin-top: 12px !important;
        box-sizing: border-box !important;
      }

      /* 사이드바와 하단 배너 */
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners article {
        min-height: auto !important;
        padding: 18px !important;
        display: flex !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners b {
        font-size: 18px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners i {
        font-size: 42px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .stats > div {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item {
        grid-template-columns: 22px 52px 1fr !important;
      }

      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item img,
      html body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item i {
        width: 52px !important;
        height: 42px !important;
      }

      html body.soso-mode-mobile.soso-route-home .home-empty-feed {
        min-height: 180px !important;
        padding: 24px 14px !important;
        border-radius: 22px !important;
      }

      html body.soso-mode-mobile.soso-route-home .home-empty-feed b {
        font-size: 19px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function patchMobileHome() {
  injectMobileHomeStyle();
  const isMobileHome = window.matchMedia('(max-width: 900px)').matches && (location.hash === '' || location.hash === '#' || location.hash === '#/');
  document.body.classList.toggle('soso-mobile-home-fixed', Boolean(isMobileHome && document.querySelector('.pc-home-like-shot')));
}

let scheduled = false;
function schedulePatch() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    patchMobileHome();
  });
}

new MutationObserver(schedulePatch).observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedulePatch);
else schedulePatch();
window.addEventListener('hashchange', () => setTimeout(schedulePatch, 40));
window.addEventListener('resize', () => setTimeout(schedulePatch, 80));
setTimeout(schedulePatch, 0);
setTimeout(schedulePatch, 300);
setTimeout(schedulePatch, 1000);
