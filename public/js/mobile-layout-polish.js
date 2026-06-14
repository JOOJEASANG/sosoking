// mobile-layout-polish.js
// 모바일에서 관리자 표·신고 처리·공화국 카드가 화면 밖으로 터지지 않도록 보강합니다.

function ensureMobileLayoutStyle() {
  if (document.getElementById('mobile-layout-polish-style')) return;
  const style = document.createElement('style');
  style.id = 'mobile-layout-polish-style';
  style.textContent = `
    @media (max-width: 760px) {
      .admin-layout {
        display: block !important;
      }

      .admin-sidebar {
        position: sticky !important;
        top: 0 !important;
        z-index: 20 !important;
        width: 100% !important;
        max-width: none !important;
        border-radius: 0 0 18px 18px !important;
        padding: 10px !important;
      }

      .admin-brand,
      .admin-sidebar__footer {
        display: none !important;
      }

      .admin-nav {
        display: flex !important;
        gap: 8px !important;
        overflow-x: auto !important;
        padding: 2px 2px 6px !important;
        -webkit-overflow-scrolling: touch !important;
      }

      .admin-nav-divider {
        display: none !important;
      }

      .admin-menu-item {
        flex: 0 0 auto !important;
        min-width: 74px !important;
        justify-content: center !important;
        border-radius: 999px !important;
        padding: 9px 11px !important;
        white-space: nowrap !important;
      }

      .admin-label-full {
        display: none !important;
      }

      .admin-label-short {
        display: inline !important;
      }

      #admin-content {
        padding: 12px !important;
        min-width: 0 !important;
      }

      .admin-section,
      .admin-dashboard,
      .admin-posts-panel,
      .card,
      .legal-card,
      .guide-section,
      .guide-toc {
        max-width: 100% !important;
        min-width: 0 !important;
      }

      .admin-stat-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
      }

      .admin-stat-card {
        min-width: 0 !important;
        padding: 12px 10px !important;
      }

      .admin-stat-card__num {
        font-size: 18px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .admin-table-wrap,
      .legal-table-wrap {
        width: 100% !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }

      .admin-table,
      .legal-table {
        min-width: 720px !important;
      }

      .admin-table th,
      .admin-table td,
      .legal-table th,
      .legal-table td {
        font-size: 12px !important;
        padding: 9px 8px !important;
      }

      .admin-section-head {
        align-items: flex-start !important;
        gap: 8px !important;
      }

      .admin-section-head .btn,
      .admin-section-head button {
        flex: 0 0 auto !important;
      }

      .guide-feature-list,
      .guide-rank-list,
      .guide-step-list {
        grid-template-columns: 1fr !important;
      }

      .guide-hero {
        padding: 24px 16px !important;
        border-radius: 22px !important;
      }

      .guide-hero__title {
        font-size: 26px !important;
      }

      .guide-toc__list {
        display: flex !important;
        overflow-x: auto !important;
        gap: 8px !important;
        -webkit-overflow-scrolling: touch !important;
      }

      .guide-toc__item {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
      }

      .rep-content,
      .rep-section,
      .congress-page,
      .court-page,
      .elec-page,
      .battle-page {
        max-width: 100% !important;
        min-width: 0 !important;
      }

      .congress-main-grid,
      .congress-seats-grid,
      .court-stats,
      .elec-candidates,
      .battle-main-grid {
        grid-template-columns: 1fr !important;
      }

      .congress-bill__actions,
      .elec-pledge-actions,
      .prez-decree-form__actions {
        flex-direction: column !important;
        align-items: stretch !important;
      }

      .congress-bill__actions .btn,
      .elec-pledge-actions .btn,
      .prez-decree-form__actions .btn {
        width: 100% !important;
      }
    }

    @media (max-width: 420px) {
      .admin-stat-grid {
        grid-template-columns: 1fr !important;
      }

      .admin-menu-item {
        min-width: 66px !important;
        padding: 8px 9px !important;
      }

      .admin-menu-item__icon {
        font-size: 15px !important;
      }

      .admin-menu-item__label {
        font-size: 12px !important;
      }

      #admin-content {
        padding: 10px !important;
      }

      .admin-table,
      .legal-table {
        min-width: 640px !important;
      }

      .card__body,
      .card__body--lg {
        padding: 14px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureMobileLayoutStyle();
window.addEventListener('sosoking:extensions-ready', ensureMobileLayoutStyle);
