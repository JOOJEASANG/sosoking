const MOBILE_HOME_FINAL_STYLE_ID = 'sosoking-mobile-home-final-polish-patch';

function injectMobileHomeFinalStyle() {
  if (document.getElementById(MOBILE_HOME_FINAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MOBILE_HOME_FINAL_STYLE_ID;
  style.textContent = `
    @media (max-width: 900px) {
      html,
      body.soso-mode-mobile.soso-route-home {
        width: 100% !important;
        overflow-x: hidden !important;
        background: #f6f8fb !important;
      }

      body.soso-mode-mobile.soso-route-home #app,
      body.soso-mode-mobile.soso-route-home #page-content {
        width: 100% !important;
        max-width: none !important;
        overflow-x: hidden !important;
        background: #f6f8fb !important;
      }

      body.soso-mode-mobile.soso-route-home .soso-dashboard-header {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot,
      body.soso-mode-mobile.soso-route-home main.pc-home-like-shot,
      body.soso-mode-mobile.soso-route-home .soso-home-dashboard {
        display: block !important;
        width: 100% !important;
        max-width: 480px !important;
        min-width: 0 !important;
        margin: 0 auto !important;
        padding: 10px 10px 106px !important;
        box-sizing: border-box !important;
        background: #f6f8fb !important;
        overflow-x: hidden !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot * {
        box-sizing: border-box !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-shell,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-main,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-sidebar {
        display: grid !important;
        grid-template-columns: 1fr !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        gap: 10px !important;
        position: static !important;
        top: auto !important;
        transform: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-sidebar {
        margin-top: 0 !important;
      }

      /* 상단 메인 배너 */
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero {
        display: block !important;
        width: 100% !important;
        min-height: 0 !important;
        height: auto !important;
        overflow: hidden !important;
        border-radius: 16px !important;
        border: 1px solid rgba(17, 24, 39, .08) !important;
        background: #ffffff !important;
        box-shadow: 0 8px 22px rgba(17, 24, 39, .06) !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero::before,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero::after {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        padding: 20px 17px 17px !important;
        position: relative !important;
        z-index: 1 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy span {
        display: inline-flex !important;
        align-items: center !important;
        width: auto !important;
        height: 26px !important;
        margin: 0 0 10px !important;
        padding: 0 9px !important;
        border-radius: 999px !important;
        background: #eef2ff !important;
        color: #4f46e5 !important;
        font-size: 10px !important;
        line-height: 1 !important;
        letter-spacing: .06em !important;
        font-weight: 900 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy span::before {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy h1 {
        margin: 0 !important;
        color: #111827 !important;
        font-size: clamp(29px, 8.6vw, 38px) !important;
        line-height: 1.1 !important;
        letter-spacing: -.065em !important;
        word-break: keep-all !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy h1 em {
        color: #4f46e5 !important;
        background: none !important;
        -webkit-background-clip: initial !important;
        background-clip: initial !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-copy p {
        margin: 10px 0 0 !important;
        max-width: none !important;
        color: #667085 !important;
        font-size: 13px !important;
        line-height: 1.62 !important;
        font-weight: 700 !important;
        word-break: keep-all !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        margin: 15px 0 0 !important;
        width: 100% !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        min-width: 0 !important;
        height: 43px !important;
        padding: 0 10px !important;
        border-radius: 12px !important;
        border: 0 !important;
        box-shadow: none !important;
        font-size: 13px !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        text-decoration: none !important;
        white-space: nowrap !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a.primary,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a:first-child {
        background: #111827 !important;
        color: #fff !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a:not(.primary):not(:first-child),
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-actions a:nth-child(2) {
        background: #eef2ff !important;
        color: #4f46e5 !important;
      }

      /* 깨짐 원인이던 PC용 비주얼 영역은 모바일에서 제거 */
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-hero-visual,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .hv-cats,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .hv-nums,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .hv-brand,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-mascot-stage,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-orbit,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-spark,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-pedestal,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-floating,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-decoration {
        display: none !important;
      }

      /* 참여 유형 카드: 현재 홈 원본 dash-group 기준 */
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category-row {
        display: flex !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        gap: 8px !important;
        margin: 0 !important;
        padding: 0 0 6px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        scroll-snap-type: x mandatory !important;
        -webkit-overflow-scrolling: touch !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category-row::-webkit-scrollbar {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-group,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category {
        flex: 0 0 152px !important;
        width: 152px !important;
        min-width: 152px !important;
        max-width: 152px !important;
        min-height: 112px !important;
        height: 112px !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        gap: 5px !important;
        padding: 12px !important;
        border-radius: 14px !important;
        border: 1px solid rgba(17, 24, 39, .08) !important;
        background: #ffffff !important;
        color: #111827 !important;
        text-decoration: none !important;
        box-shadow: 0 7px 18px rgba(17, 24, 39, .055) !important;
        overflow: hidden !important;
        scroll-snap-align: start !important;
        transform: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-group::before,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category::before {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .group-head {
        display: flex !important;
        align-items: center !important;
        gap: 7px !important;
        margin: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .group-head i,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category i {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 28px !important;
        height: 28px !important;
        flex: 0 0 28px !important;
        border-radius: 10px !important;
        background: #f1f5f9 !important;
        font-size: 17px !important;
        line-height: 1 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .group-head b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category strong {
        min-width: 0 !important;
        color: #111827 !important;
        font-size: 14px !important;
        line-height: 1.2 !important;
        font-weight: 900 !important;
        letter-spacing: -.035em !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-group p,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category p {
        margin: 5px 0 0 !important;
        color: #667085 !important;
        font-size: 11px !important;
        line-height: 1.35 !important;
        font-weight: 800 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .group-chips {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 4px !important;
        overflow: hidden !important;
        margin: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .group-chips span {
        flex: 0 0 auto !important;
        max-width: 70px !important;
        padding: 3px 6px !important;
        border-radius: 999px !important;
        background: #f1f5f9 !important;
        color: #475467 !important;
        font-size: 9px !important;
        line-height: 1.1 !important;
        font-weight: 900 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      /* 콘텐츠 카드 공통 */
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-panel,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners article,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .home-empty-feed {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 14px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(17, 24, 39, .08) !important;
        background: #ffffff !important;
        box-shadow: 0 7px 20px rgba(17, 24, 39, .055) !important;
        color: #111827 !important;
        overflow: hidden !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .side-title {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 10px !important;
        width: 100% !important;
        margin: 0 0 10px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head > div,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .side-title > div {
        min-width: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head span,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .side-title b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card > b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners b {
        display: block !important;
        color: #111827 !important;
        font-size: 16px !important;
        line-height: 1.28 !important;
        font-weight: 950 !important;
        letter-spacing: -.04em !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-section-head h2,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-tabs,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-side-card.rules,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .features-banner,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .stats {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .side-title a {
        flex: 0 0 auto !important;
        color: #667085 !important;
        font-size: 12px !important;
        font-weight: 850 !important;
        text-decoration: none !important;
      }

      /* 피드 */
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-grid {
        display: grid !important;
        grid-template-columns: 1fr !important;
        width: 100% !important;
        gap: 9px !important;
        margin: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card {
        display: grid !important;
        grid-template-columns: 82px minmax(0, 1fr) !important;
        grid-template-rows: auto auto auto !important;
        gap: 7px 10px !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        padding: 10px !important;
        border-radius: 14px !important;
        border: 1px solid rgba(17, 24, 39, .07) !important;
        background: #ffffff !important;
        color: #111827 !important;
        box-shadow: none !important;
        text-decoration: none !important;
        overflow: hidden !important;
        position: relative !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-badge {
        position: static !important;
        grid-column: 2 !important;
        grid-row: 1 !important;
        justify-self: start !important;
        display: inline-flex !important;
        align-items: center !important;
        max-width: 100% !important;
        height: 22px !important;
        padding: 0 7px !important;
        border-radius: 999px !important;
        background: #eef2ff !important;
        color: #4f46e5 !important;
        font-size: 10px !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card img,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-thumb,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-vote-preview,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-link-preview {
        grid-column: 1 !important;
        grid-row: 1 / span 3 !important;
        width: 82px !important;
        height: 82px !important;
        min-width: 82px !important;
        max-width: 82px !important;
        border-radius: 12px !important;
        object-fit: cover !important;
        background: #f1f5f9 !important;
        margin: 0 !important;
        overflow: hidden !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-thumb {
        display: grid !important;
        place-items: center !important;
        font-size: 28px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-vote-preview {
        padding: 6px !important;
        align-content: center !important;
        gap: 3px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-vote-preview span {
        height: 14px !important;
        padding: 0 4px !important;
        border-radius: 5px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-vote-preview b,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-vote-preview em,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-vote-preview small {
        font-size: 7px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card h3 {
        grid-column: 2 !important;
        grid-row: 2 !important;
        margin: 0 !important;
        color: #111827 !important;
        font-size: 15px !important;
        line-height: 1.32 !important;
        font-weight: 950 !important;
        letter-spacing: -.045em !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card p {
        display: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card footer {
        grid-column: 2 !important;
        grid-row: 3 !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 0 !important;
        padding: 0 !important;
        min-width: 0 !important;
        color: #98a2b3 !important;
        font-size: 10px !important;
        font-weight: 850 !important;
        overflow: hidden !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card footer span {
        min-width: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-more {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 42px !important;
        margin: 11px 0 0 !important;
        padding: 0 !important;
        border-radius: 12px !important;
        border: 0 !important;
        background: #f1f5f9 !important;
        color: #111827 !important;
        box-shadow: none !important;
        font-size: 13px !important;
        font-weight: 900 !important;
        text-decoration: none !important;
      }

      /* 인기글 */
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item {
        display: grid !important;
        grid-template-columns: 24px 44px minmax(0, 1fr) !important;
        align-items: center !important;
        gap: 9px !important;
        width: 100% !important;
        min-width: 0 !important;
        padding: 9px 0 !important;
        border-top: 1px solid rgba(17, 24, 39, .07) !important;
        color: #111827 !important;
        text-decoration: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item:first-of-type {
        border-top: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item strong {
        color: #4f46e5 !important;
        font-size: 16px !important;
        font-weight: 950 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item img,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item i {
        width: 44px !important;
        height: 38px !important;
        border-radius: 10px !important;
        background: #f1f5f9 !important;
        object-fit: cover !important;
        display: grid !important;
        place-items: center !important;
        font-style: normal !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item div {
        min-width: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item b {
        display: block !important;
        width: 100% !important;
        color: #111827 !important;
        font-size: 13px !important;
        line-height: 1.28 !important;
        font-weight: 900 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .top-item small {
        display: block !important;
        margin-top: 3px !important;
        color: #98a2b3 !important;
        font-size: 10px !important;
        font-weight: 850 !important;
      }

      /* 미션, 설치, 하단 배너 */
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .mission p,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .install p,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners p {
        margin: 7px 0 !important;
        color: #667085 !important;
        font-size: 12px !important;
        line-height: 1.5 !important;
        font-weight: 750 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .mission-bar {
        height: 7px !important;
        margin: 8px 44px 8px 0 !important;
        border-radius: 999px !important;
        background: #eef2ff !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .mission-bar i {
        border-radius: 999px !important;
        background: #4f46e5 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .mission-bar span {
        right: -44px !important;
        color: #667085 !important;
        font-size: 11px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .side-cta,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .install button,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners button,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners a {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 0 !important;
        height: 36px !important;
        padding: 0 12px !important;
        border-radius: 11px !important;
        border: 0 !important;
        background: #111827 !important;
        color: #fff !important;
        box-shadow: none !important;
        font-size: 12px !important;
        font-weight: 900 !important;
        text-decoration: none !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .install {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 48px !important;
        gap: 10px !important;
        align-items: center !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .install img {
        width: 48px !important;
        height: 48px !important;
        border-radius: 12px !important;
        background: #fff !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .install button + button {
        margin-left: 4px !important;
        background: #eef2ff !important;
        color: #4f46e5 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners {
        display: grid !important;
        grid-template-columns: 1fr !important;
        width: 100% !important;
        gap: 10px !important;
        margin: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners article {
        display: grid !important;
        grid-template-columns: minmax(0,1fr) 38px !important;
        align-items: center !important;
        gap: 10px !important;
        min-height: 0 !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-bottom-banners article i {
        display: grid !important;
        place-items: center !important;
        width: 38px !important;
        height: 38px !important;
        border-radius: 12px !important;
        background: #f1f5f9 !important;
        font-size: 22px !important;
        font-style: normal !important;
      }

      body.soso-mode-mobile.soso-route-home .home-empty-feed {
        min-height: 154px !important;
        text-align: center !important;
      }

      body.soso-mode-mobile.soso-route-home .home-empty-feed i {
        width: 48px !important;
        height: 48px !important;
        border-radius: 14px !important;
        font-size: 24px !important;
        margin-bottom: 10px !important;
      }

      body.soso-mode-mobile.soso-route-home .home-empty-feed b {
        font-size: 17px !important;
      }

      body.soso-mode-mobile.soso-route-home .home-empty-feed p {
        font-size: 12px !important;
        line-height: 1.5 !important;
      }

      body.soso-mode-mobile.soso-route-home .home-empty-feed a {
        height: 38px !important;
        border-radius: 11px !important;
        font-size: 12px !important;
        background: #111827 !important;
      }

      body.soso-mode-mobile #bottom-nav,
      body.soso-mode-mobile .bottom-nav,
      body.soso-mode-mobile nav.bottom-nav {
        display: flex !important;
        border-radius: 16px 16px 0 0 !important;
        box-shadow: 0 -8px 26px rgba(17, 24, 39, .10) !important;
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

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-group,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-category {
        flex-basis: 144px !important;
        width: 144px !important;
        min-width: 144px !important;
        max-width: 144px !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card {
        grid-template-columns: 74px minmax(0, 1fr) !important;
      }

      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card img,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-thumb,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-vote-preview,
      body.soso-mode-mobile.soso-route-home .pc-home-like-shot .dash-feed-card .feed-link-preview {
        width: 74px !important;
        height: 74px !important;
        min-width: 74px !important;
        max-width: 74px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function applyMobileHomeFinalPolish() {
  injectMobileHomeFinalStyle();
  const isMobileHome = window.matchMedia('(max-width: 900px)').matches && (location.hash === '' || location.hash === '#' || location.hash === '#/');
  document.body.classList.toggle('soso-mobile-home-final-polish', Boolean(isMobileHome && document.querySelector('.pc-home-like-shot')));
}

let scheduled = false;
function scheduleMobileHomeFinalPolish() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyMobileHomeFinalPolish();
  });
}

new MutationObserver(scheduleMobileHomeFinalPolish).observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleMobileHomeFinalPolish);
else scheduleMobileHomeFinalPolish();
window.addEventListener('hashchange', () => setTimeout(scheduleMobileHomeFinalPolish, 40));
window.addEventListener('resize', () => setTimeout(scheduleMobileHomeFinalPolish, 80));
setTimeout(scheduleMobileHomeFinalPolish, 0);
setTimeout(scheduleMobileHomeFinalPolish, 300);
setTimeout(scheduleMobileHomeFinalPolish, 1000);
