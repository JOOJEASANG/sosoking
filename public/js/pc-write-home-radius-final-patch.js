const PC_WRITE_HOME_RADIUS_STYLE_ID = 'sosoking-pc-write-home-radius-final-patch';

function injectPcWriteHomeRadiusStyle() {
  if (document.getElementById(PC_WRITE_HOME_RADIUS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PC_WRITE_HOME_RADIUS_STYLE_ID;
  style.textContent = `
    :root {
      --soso-final-radius-xs: 6px;
      --soso-final-radius-sm: 8px;
      --soso-final-radius-md: 10px;
      --soso-final-radius-lg: 12px;
      --soso-final-radius-xl: 14px;
    }

    /* 전체 버튼/입력/박스 라운드 좁게 통일 */
    html body.soso-modern-design button,
    html body.soso-modern-design input,
    html body.soso-modern-design textarea,
    html body.soso-modern-design select,
    html body.soso-modern-design .dash-hero-actions a,
    html body.soso-modern-design .dash-more,
    html body.soso-modern-design .side-cta,
    html body.soso-modern-design .write-submit,
    html body.soso-modern-design .mission-primary,
    html body.soso-modern-design .footer-install-btn,
    html body.soso-modern-design .google-btn-v2,
    html body.soso-modern-design .guest-btn-v2,
    html body.soso-modern-design .auth-form-v2 > button,
    html body.soso-modern-design .account-summary-card a,
    html body.soso-modern-design .account-premium-shortcuts a {
      border-radius: var(--soso-final-radius-md) !important;
    }

    html body.soso-modern-design .dash-hero,
    html body.soso-modern-design .dash-feed-panel,
    html body.soso-modern-design .dash-side-card,
    html body.soso-modern-design .dash-bottom-banners article,
    html body.soso-modern-design .feed-hero,
    html body.soso-modern-design .feed-dashboard,
    html body.soso-modern-design .feed-search-panel,
    html body.soso-modern-design .feed-card,
    html body.soso-modern-design .write-card,
    html body.soso-modern-design .write-preview,
    html body.soso-modern-design .side-card,
    html body.soso-modern-design .account-hero-copy,
    html body.soso-modern-design .account-summary-card,
    html body.soso-modern-design .account-card,
    html body.soso-modern-design .mission-copy,
    html body.soso-modern-design .mission-card-live,
    html body.soso-modern-design .mission-mini-card,
    html body.soso-modern-design .mission-note,
    html body.soso-modern-design .guide-card-clean,
    html body.soso-modern-design .simple-auth-page .auth-simple-card,
    html body.soso-modern-design .home-empty-feed,
    html body.soso-modern-design .write-option-board,
    html body.soso-modern-design .soso-img-card,
    html body.soso-modern-design .crop-box {
      border-radius: var(--soso-final-radius-xl) !important;
    }

    html body.soso-modern-design .dash-group,
    html body.soso-modern-design .dash-category,
    html body.soso-modern-design .category-grid button,
    html body.soso-modern-design #type-grid button,
    html body.soso-modern-design .write-option-item,
    html body.soso-modern-design .feed-option,
    html body.soso-modern-design .preview-link-card,
    html body.soso-modern-design .preview-extra-card,
    html body.soso-modern-design .link-panel,
    html body.soso-modern-design .extra-panel,
    html body.soso-modern-design .upload-box,
    html body.soso-modern-design .top-item img,
    html body.soso-modern-design .top-item i,
    html body.soso-modern-design .dash-feed-card img,
    html body.soso-modern-design .feed-thumb,
    html body.soso-modern-design .feed-vote-preview,
    html body.soso-modern-design .feed-link-preview {
      border-radius: var(--soso-final-radius-lg) !important;
    }

    html body.soso-modern-design .feed-badge,
    html body.soso-modern-design .group-chips span,
    html body.soso-modern-design .tag,
    html body.soso-modern-design .feed-chip,
    html body.soso-modern-design .account-card-head span,
    html body.soso-modern-design .mission-copy > span,
    html body.soso-modern-design .guide-title-row span {
      border-radius: 999px !important;
    }

    /* PC 홈: 카테고리 5개가 칸에 딱 맞게 보이도록 재정렬 */
    @media (min-width: 901px) {
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-category-row {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        gap: 10px !important;
        width: 100% !important;
        max-width: 100% !important;
        overflow: visible !important;
        align-items: stretch !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group,
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-category {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        min-height: 126px !important;
        height: 126px !important;
        padding: 14px !important;
        border-radius: var(--soso-final-radius-lg) !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group .group-head {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin: 0 0 6px !important;
        min-width: 0 !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group .group-head i {
        flex: 0 0 28px !important;
        width: 28px !important;
        height: 28px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 20px !important;
        line-height: 1 !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group .group-head b {
        min-width: 0 !important;
        font-size: clamp(14px, .92vw, 17px) !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group p {
        margin: 0 0 8px !important;
        font-size: clamp(10px, .72vw, 12px) !important;
        line-height: 1.38 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group .group-chips {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 4px !important;
        max-height: 45px !important;
        overflow: hidden !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group .group-chips span {
        max-width: 100% !important;
        padding: 3px 7px !important;
        font-size: clamp(9px, .62vw, 10px) !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group::before,
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-category::before {
        border-radius: var(--soso-final-radius-md) !important;
      }

      /* PC 만들기: 카테고리 5개 한 줄 고정 */
      body.soso-mode-pc.soso-route-write .soso-feed-page .write-layout,
      body.soso-mode-pc .soso-feed-page .write-layout {
        max-width: 1680px !important;
      }

      body.soso-mode-pc.soso-route-write .category-grid,
      body.soso-mode-pc.soso-route-write .write-card .category-grid,
      body.soso-mode-pc .write-card .category-grid {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        gap: 9px !important;
        width: 100% !important;
        overflow: visible !important;
        align-items: stretch !important;
      }

      body.soso-mode-pc.soso-route-write .category-grid button,
      body.soso-mode-pc.soso-route-write .write-card .category-grid button,
      body.soso-mode-pc .write-card .category-grid button {
        width: 100% !important;
        min-width: 0 !important;
        height: 86px !important;
        min-height: 86px !important;
        padding: 12px 8px !important;
        border-radius: var(--soso-final-radius-lg) !important;
        display: grid !important;
        grid-template-rows: auto auto auto !important;
        align-content: center !important;
        justify-items: center !important;
        gap: 4px !important;
        text-align: center !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }

      body.soso-mode-pc.soso-route-write .category-grid button b,
      body.soso-mode-pc.soso-route-write .write-card .category-grid button b,
      body.soso-mode-pc .write-card .category-grid button b {
        display: block !important;
        font-size: 22px !important;
        line-height: 1 !important;
        margin: 0 !important;
      }

      body.soso-mode-pc.soso-route-write .category-grid button span,
      body.soso-mode-pc.soso-route-write .write-card .category-grid button span,
      body.soso-mode-pc .write-card .category-grid button span {
        display: block !important;
        max-width: 100% !important;
        font-size: 13px !important;
        line-height: 1.2 !important;
        font-weight: 950 !important;
        letter-spacing: -.04em !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.soso-mode-pc.soso-route-write .category-grid button small,
      body.soso-mode-pc.soso-route-write .write-card .category-grid button small,
      body.soso-mode-pc .write-card .category-grid button small {
        display: block !important;
        max-width: 100% !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        color: #667085 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.soso-mode-pc.soso-route-write #type-grid,
      body.soso-mode-pc .write-card #type-grid {
        gap: 7px !important;
      }

      body.soso-mode-pc.soso-route-write #type-grid button,
      body.soso-mode-pc .write-card #type-grid button {
        min-height: 40px !important;
        padding: 0 12px !important;
        border-radius: var(--soso-final-radius-md) !important;
        white-space: nowrap !important;
      }
    }

    @media (min-width: 901px) and (max-width: 1180px) {
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group,
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-category {
        height: 118px !important;
        min-height: 118px !important;
        padding: 12px !important;
      }

      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-group .group-chips span:nth-child(n+3) {
        display: none !important;
      }

      body.soso-mode-pc.soso-route-write .category-grid button,
      body.soso-mode-pc .write-card .category-grid button {
        height: 78px !important;
        min-height: 78px !important;
        padding: 10px 6px !important;
      }

      body.soso-mode-pc.soso-route-write .category-grid button small,
      body.soso-mode-pc .write-card .category-grid button small {
        display: none !important;
      }
    }

    @media (max-width: 900px) {
      html body.soso-modern-design button,
      html body.soso-modern-design input,
      html body.soso-modern-design textarea,
      html body.soso-modern-design select,
      html body.soso-modern-design .dash-hero-actions a,
      html body.soso-modern-design .dash-more,
      html body.soso-modern-design .write-submit,
      html body.soso-modern-design .account-summary-card a,
      html body.soso-modern-design .side-cta {
        border-radius: var(--soso-final-radius-md) !important;
      }

      html body.soso-modern-design .dash-hero,
      html body.soso-modern-design .dash-feed-panel,
      html body.soso-modern-design .dash-side-card,
      html body.soso-modern-design .dash-bottom-banners article,
      html body.soso-modern-design .feed-card,
      html body.soso-modern-design .write-card,
      html body.soso-modern-design .account-card,
      html body.soso-modern-design .account-summary-card,
      html body.soso-modern-design .home-empty-feed {
        border-radius: var(--soso-final-radius-xl) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function applyPcWriteHomeRadiusFinal() {
  injectPcWriteHomeRadiusStyle();
  document.body.classList.add('soso-final-radius-polish');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyPcWriteHomeRadiusFinal);
else applyPcWriteHomeRadiusFinal();
window.addEventListener('hashchange', () => setTimeout(applyPcWriteHomeRadiusFinal, 40));
window.addEventListener('resize', () => setTimeout(applyPcWriteHomeRadiusFinal, 80));
setTimeout(applyPcWriteHomeRadiusFinal, 0);
setTimeout(applyPcWriteHomeRadiusFinal, 400);
