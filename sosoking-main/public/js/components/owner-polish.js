export function initOwnerPolish() {
  if (document.getElementById('owner-polish-style')) return;
  const style = document.createElement('style');
  style.id = 'owner-polish-style';
  style.textContent = `
    html, body { min-height: 100%; overflow-x: hidden; }
    body { word-break: keep-all; text-rendering: optimizeLegibility; }
    #page-content { padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px)); }
    .container { width: 100%; max-width: 640px; }

    .page-header {
      min-height: 56px;
      box-shadow: 0 8px 24px rgba(0,0,0,.08);
    }
    .page-header .logo { letter-spacing: -.02em; }

    .court-shell {
      isolation: isolate;
      padding: 20px !important;
    }
    .court-shell::before { z-index: -1; }
    .court-shell .court-title { letter-spacing: -.04em; }
    .court-shell .court-desc { margin-top: 4px; }
    .court-seal { flex-shrink: 0; }
    .court-ledger div { min-height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .court-ledger strong { font-size: clamp(15px, 4vw, 18px); letter-spacing: -.04em; }
    .court-ledger span { font-weight: 700; opacity: .9; }

    .card, .court-shell, .court-document {
      -webkit-font-smoothing: antialiased;
      transform: translateZ(0);
    }

    .example-card, #board-list .card, .court-board-row {
      border-radius: 18px !important;
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
    }
    .example-card:active, #board-list .card:active, .court-board-row:active { transform: scale(.992); }

    .form-input, .form-textarea {
      min-height: 48px;
      line-height: 1.55;
    }
    .form-textarea { min-height: 138px; }

    .btn {
      min-height: 48px;
      font-weight: 900;
    }
    .btn-primary { box-shadow: 0 8px 24px rgba(201,168,76,.22); }

    #bottom-nav {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      z-index: 180;
      height: calc(72px + env(safe-area-inset-bottom, 0px));
      padding-bottom: env(safe-area-inset-bottom, 0px);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      box-shadow: 0 -12px 32px rgba(0,0,0,.18);
    }
    .nav-item {
      min-height: 58px;
      font-weight: 900;
      opacity: .86;
    }
    .nav-item.active { opacity: 1; }
    .nav-icon { filter: drop-shadow(0 2px 4px rgba(0,0,0,.18)); }

    .pwa-pill, .app-install-pill {
      bottom: calc(92px + env(safe-area-inset-bottom, 0px)) !important;
      right: 16px !important;
    }

    .toast {
      max-width: calc(100vw - 32px);
      white-space: normal !important;
      text-align: center;
      line-height: 1.55;
      font-weight: 800;
    }

    .loading-dots { min-height: 68px; }

    .court-document, .verdict-card, .sentence-card {
      overflow: hidden;
    }
    .verdict-card .court-title, .sentence-card .sentence-text { letter-spacing: -.03em; }

    .reaction-btn {
      border-radius: 14px !important;
      min-height: 54px;
    }

    .theme-preference-card { margin-bottom: 18px; }

    @media (max-width: 420px) {
      .container { padding-left: 16px; padding-right: 16px; }
      .court-shell { padding: 18px !important; }
      .court-shell > div[style*="display:flex"] { align-items: flex-start !important; }
      .court-title { font-size: 19px !important; }
      .court-desc { font-size: 12.5px !important; }
      .court-seal { width: 54px !important; height: 54px !important; font-size: 25px !important; }
      .court-ledger { grid-template-columns: 1fr 1fr 1fr !important; gap: 7px !important; }
      .court-ledger div { min-height: 64px; padding: 9px 5px !important; }
      .court-ledger strong { font-size: 14px !important; }
      .court-ledger span { font-size: 9px !important; }
      h1, h2, h3 { letter-spacing: -.05em; }
      .btn { font-size: 14px; }
    }

    @media (max-width: 360px) {
      .court-ledger { grid-template-columns: 1fr !important; }
      .court-ledger div { min-height: 58px; }
    }

    [data-theme="light"] body, :root:not([data-theme="dark"]) body {
      background: linear-gradient(180deg,#fff8ed 0%,#f4eadc 100%) !important;
    }
    [data-theme="dark"] body, :root[data-theme="dark"] body {
      background: #0d1117 !important;
    }
  `;
  document.head.appendChild(style);
}
