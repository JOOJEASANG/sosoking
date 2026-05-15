const MODERN_DESIGN_STYLE_ID = 'sosoking-modern-design-polish-patch';

function injectModernDesignStyle() {
  if (document.getElementById(MODERN_DESIGN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MODERN_DESIGN_STYLE_ID;
  style.textContent = `
    :root {
      --soso-radius-xs: 8px;
      --soso-radius-sm: 10px;
      --soso-radius-md: 14px;
      --soso-radius-lg: 18px;
      --soso-radius-xl: 22px;
      --soso-modern-bg: #f6f8fc;
      --soso-modern-card: rgba(255,255,255,.92);
      --soso-modern-line: rgba(32,46,90,.10);
      --soso-modern-ink: #111827;
      --soso-modern-muted: #667085;
      --soso-modern-shadow: 0 12px 32px rgba(32,46,90,.08);
      --soso-modern-shadow-soft: 0 8px 22px rgba(32,46,90,.06);
      --soso-modern-primary: #4f46e5;
      --soso-modern-accent: #f97316;
    }

    html body {
      background: var(--soso-modern-bg) !important;
      color: var(--soso-modern-ink) !important;
    }

    /* 전체 라운드/그림자 톤 정리 */
    html body .dash-hero,
    html body .dash-feed-panel,
    html body .dash-side-card,
    html body .dash-bottom-banners article,
    html body .feed-hero,
    html body .feed-dashboard,
    html body .feed-search-panel,
    html body .feed-card,
    html body .feed-detail-card,
    html body .detail-main-card,
    html body .comments-section,
    html body .write-card,
    html body .write-preview,
    html body .side-card,
    html body .account-hero-copy,
    html body .account-summary-card,
    html body .account-card,
    html body .mission-copy,
    html body .mission-card-live,
    html body .mission-mini-card,
    html body .mission-note,
    html body .guide-card-clean,
    html body .simple-auth-page .auth-simple-card,
    html body .home-empty-feed,
    html body .write-option-board,
    html body .soso-img-card,
    html body .crop-box {
      border-radius: var(--soso-radius-lg) !important;
      border-color: var(--soso-modern-line) !important;
      box-shadow: var(--soso-modern-shadow-soft) !important;
    }

    html body .dash-category,
    html body .top-item,
    html body .feed-option,
    html body .account-card input,
    html body .account-card button,
    html body .account-summary-card a,
    html body .write-submit,
    html body .mission-primary,
    html body .google-btn-v2,
    html body .guest-btn-v2,
    html body .auth-form-v2 input,
    html body .auth-form-v2 button,
    html body .write-option-item,
    html body .preview-link-card,
    html body .preview-extra-card,
    html body .link-panel,
    html body .extra-panel,
    html body .upload-box,
    html body .soso-img-card img,
    html body .crop-stage {
      border-radius: var(--soso-radius-md) !important;
    }

    html body .soso-dashboard-header .soso-top-avatar,
    html body .soso-dashboard-header .soso-top-link,
    html body .soso-dashboard-header .soso-top-search,
    html body .dash-hero-actions a,
    html body .dash-more,
    html body .footer-install-btn,
    html body .category-grid button,
    html body #type-grid button,
    html body .write-tabs button,
    html body .feed-chip,
    html body .tag,
    html body .mission-copy > span,
    html body .account-card-head span,
    html body .guide-title-row span {
      border-radius: 999px !important;
    }

    html body .dash-hero,
    html body .feed-hero,
    html body .account-hero-copy,
    html body .mission-copy,
    html body .simple-auth-page .auth-simple-card {
      background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.88)) !important;
      border: 1px solid var(--soso-modern-line) !important;
    }

    html body .dash-feed-panel,
    html body .dash-side-card,
    html body .dash-bottom-banners article,
    html body .feed-card,
    html body .write-card,
    html body .write-preview,
    html body .account-card,
    html body .account-summary-card,
    html body .mission-mini-card,
    html body .guide-card-clean {
      background: var(--soso-modern-card) !important;
      backdrop-filter: blur(14px) saturate(1.05) !important;
    }

    html body h1,
    html body h2,
    html body h3,
    html body b,
    html body strong {
      letter-spacing: -.045em !important;
    }

    html body p,
    html body small,
    html body span {
      word-break: keep-all;
    }

    html body input,
    html body textarea,
    html body select,
    html body button,
    html body a {
      -webkit-tap-highlight-color: transparent;
    }

    html body .dash-hero-actions a,
    html body .write-submit,
    html body .mission-primary,
    html body .account-summary-card a,
    html body .account-card button,
    html body .google-btn-v2,
    html body .auth-form-v2 > button {
      box-shadow: 0 10px 24px rgba(79,70,229,.16) !important;
    }

    html body .dash-category,
    html body .mission-mini-card,
    html body .feed-card,
    html body .account-card {
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease !important;
    }

    @media (hover:hover) {
      html body .dash-category:hover,
      html body .mission-mini-card:hover,
      html body .feed-card:hover,
      html body .account-card:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 14px 34px rgba(32,46,90,.10) !important;
      }
    }

    /* PC 모드: 과한 라운드와 간격 정리 */
    @media (min-width: 901px) {
      body.soso-mode-pc .soso-dashboard-header {
        backdrop-filter: blur(18px) saturate(1.1) !important;
      }

      body.soso-mode-pc .pc-home-like-shot .dash-hero,
      body.soso-mode-pc .pc-home-like-shot .dash-side-card,
      body.soso-mode-pc .pc-home-like-shot .dash-feed-panel,
      body.soso-mode-pc .pc-home-like-shot .dash-bottom-banners article {
        border-radius: var(--soso-radius-xl) !important;
      }

      body.soso-mode-pc .pc-home-like-shot .dash-hero {
        min-height: clamp(300px, 22vw, 390px) !important;
      }

      body.soso-mode-pc .pc-home-like-shot .dash-hero-copy {
        padding: clamp(28px, 3vw, 48px) !important;
      }

      body.soso-mode-pc .pc-home-like-shot .dash-hero-copy h1 {
        font-size: clamp(44px, 4vw, 72px) !important;
        line-height: .98 !important;
      }

      body.soso-mode-pc .pc-home-like-shot .dash-feed-grid {
        gap: 14px !important;
      }

      body.soso-mode-pc .pc-home-like-shot .dash-category-row {
        gap: 12px !important;
      }

      body.soso-mode-pc .pc-home-like-shot .dash-category {
        min-height: 112px !important;
        padding: 16px !important;
        border-radius: var(--soso-radius-lg) !important;
      }
    }

    /* 모바일 홈: 과한 게임 장식 줄이고 앱 메인처럼 정리 */
    @media (max-width: 900px) {
      body.soso-mode-mobile {
        background: #f6f8fc !important;
      }

      body.soso-mode-mobile.soso-route-home #page-content {
        background: #f6f8fc !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot,
      body.soso-mode-mobile.soso-route-home main.pc-home-like-shot,
      body.soso-mode-mobile.soso-route-home .soso-home-dashboard {
        max-width: 480px !important;
        padding: 10px 10px 104px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-shell,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-main,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-sidebar {
        gap: 10px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-sidebar {
        margin-top: 10px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero {
        border-radius: var(--soso-radius-lg) !important;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
        border: 1px solid rgba(32,46,90,.09) !important;
        box-shadow: 0 10px 26px rgba(32,46,90,.07) !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy {
        padding: 22px 18px 18px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy span {
        display: inline-flex !important;
        height: 26px !important;
        align-items: center !important;
        padding: 0 9px !important;
        border-radius: 999px !important;
        background: #eef2ff !important;
        color: #4f46e5 !important;
        font-size: 10px !important;
        letter-spacing: .08em !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy h1 {
        font-size: clamp(30px, 8.8vw, 38px) !important;
        line-height: 1.08 !important;
        letter-spacing: -.07em !important;
        color: #111827 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy p {
        margin-top: 10px !important;
        font-size: 13px !important;
        line-height: 1.62 !important;
        color: #667085 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        margin-top: 15px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a {
        height: 44px !important;
        border-radius: var(--soso-radius-md) !important;
        font-size: 13px !important;
        font-weight: 900 !important;
        box-shadow: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a:first-child {
        background: #111827 !important;
        color: #fff !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a:not(:first-child) {
        background: #eef2ff !important;
        color: #4f46e5 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-mascot-stage,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-orbit,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-spark,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-pedestal,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-floating,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-decoration {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category-row {
        gap: 8px !important;
        padding: 0 0 8px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category {
        flex: 0 0 148px !important;
        width: 148px !important;
        min-width: 148px !important;
        height: 82px !important;
        min-height: 82px !important;
        padding: 12px !important;
        border-radius: var(--soso-radius-md) !important;
        background: #fff !important;
        border: 1px solid rgba(32,46,90,.08) !important;
        box-shadow: 0 8px 20px rgba(32,46,90,.055) !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category i {
        font-size: 24px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category strong {
        font-size: 14px !important;
        color: #111827 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category span,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category small {
        font-size: 10px !important;
        color: #667085 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-panel,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners article,
      body.soso-mode-mobile.soso-route-home .home-empty-feed {
        border-radius: var(--soso-radius-lg) !important;
        background: #fff !important;
        border: 1px solid rgba(32,46,90,.08) !important;
        box-shadow: 0 8px 22px rgba(32,46,90,.055) !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-panel,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card {
        padding: 14px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 10px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head span,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card > b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners b {
        font-size: 16px !important;
        line-height: 1.25 !important;
        color: #111827 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-tabs,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card.rules,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners .stats {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-grid {
        gap: 10px !important;
        margin-top: 12px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card {
        padding: 12px !important;
        border-radius: var(--soso-radius-md) !important;
        background: #fff !important;
        border: 1px solid rgba(32,46,90,.08) !important;
        box-shadow: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card img,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .feed-thumb,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .feed-vote-preview,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .feed-link-preview {
        height: 132px !important;
        border-radius: var(--soso-radius-sm) !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card h3 {
        font-size: 16px !important;
        line-height: 1.34 !important;
        color: #111827 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card p,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card small,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item small,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card p {
        color: #667085 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item {
        grid-template-columns: 22px 44px minmax(0,1fr) !important;
        gap: 9px !important;
        padding: 10px 0 !important;
        border-bottom: 1px solid rgba(32,46,90,.07) !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item:last-child {
        border-bottom: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item img,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item i {
        width: 44px !important;
        height: 36px !important;
        border-radius: var(--soso-radius-sm) !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners {
        gap: 10px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners article {
        padding: 14px !important;
        min-height: 92px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners i {
        font-size: 30px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-more {
        height: 42px !important;
        border-radius: var(--soso-radius-md) !important;
        background: #f1f5f9 !important;
        color: #111827 !important;
        box-shadow: none !important;
      }

      body.soso-mode-mobile #bottom-nav {
        border-radius: 18px 18px 0 0 !important;
        box-shadow: 0 -10px 28px rgba(32,46,90,.10) !important;
      }

      body.soso-mode-mobile #bottom-nav a,
      body.soso-mode-mobile .bottom-nav a {
        border-radius: var(--soso-radius-md) !important;
      }
    }

    @media (max-width: 380px) {
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot,
      body.soso-mode-mobile.soso-route-home main.pc-home-like-shot,
      body.soso-mode-mobile.soso-route-home .soso-home-dashboard {
        padding-left: 8px !important;
        padding-right: 8px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions {
        grid-template-columns: 1fr !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category {
        flex-basis: 138px !important;
        min-width: 138px !important;
        width: 138px !important;
      }
    }

    [data-theme="dark"] body {
      background: #0b1220 !important;
      color: #f8fafc !important;
    }

    [data-theme="dark"] body .dash-hero,
    [data-theme="dark"] body .dash-feed-panel,
    [data-theme="dark"] body .dash-side-card,
    [data-theme="dark"] body .dash-bottom-banners article,
    [data-theme="dark"] body .feed-card,
    [data-theme="dark"] body .write-card,
    [data-theme="dark"] body .write-preview,
    [data-theme="dark"] body .account-card,
    [data-theme="dark"] body .account-summary-card,
    [data-theme="dark"] body .mission-mini-card,
    [data-theme="dark"] body .guide-card-clean {
      background: rgba(15,23,42,.92) !important;
      border-color: rgba(255,255,255,.10) !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
}

function markModernDesign() {
  injectModernDesignStyle();
  document.body.classList.add('soso-modern-design');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markModernDesign);
else markModernDesign();
window.addEventListener('hashchange', () => setTimeout(markModernDesign, 30));
window.addEventListener('resize', () => setTimeout(markModernDesign, 80));
setTimeout(markModernDesign, 0);
setTimeout(markModernDesign, 400);
