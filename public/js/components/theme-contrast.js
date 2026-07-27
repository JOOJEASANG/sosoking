export function initThemeContrast() {
  if (document.getElementById('theme-contrast-style')) return;
  const style = document.createElement('style');
  style.id = 'theme-contrast-style';
  style.textContent = `
    :root {
      color-scheme: dark;
      --text-main: #f7f1e8;
      --text-muted: rgba(247,241,232,.78);
      --text-soft: rgba(247,241,232,.62);
      --surface-1: #0d1117;
      --surface-2: #161b2e;
      --surface-3: #1a2035;
      --field-bg: rgba(255,255,255,.055);
      --field-border: rgba(201,168,76,.32);
    }

    [data-theme="dark"] {
      color-scheme: dark;
      --navy: #0d1117;
      --navy-light: #161b2e;
      --navy-card: #1a2035;
      --cream: #f7f1e8;
      --cream-dim: rgba(247,241,232,.78);
      --border: rgba(201,168,76,.28);
      --gold-dim: rgba(201,168,76,.15);
      --text-main: #f7f1e8;
      --text-muted: rgba(247,241,232,.78);
      --text-soft: rgba(247,241,232,.62);
      --surface-1: #0d1117;
      --surface-2: #161b2e;
      --surface-3: #1a2035;
      --field-bg: rgba(255,255,255,.06);
      --field-border: rgba(201,168,76,.34);
    }

    [data-theme="light"] {
      color-scheme: light;
      --navy: #f4eadb;
      --navy-light: #fff7e9;
      --navy-card: #fffaf1;
      --gold: #8a6416;
      --gold-light: #b48125;
      --gold-dim: rgba(138,100,22,.12);
      --cream: #211a10;
      --cream-dim: rgba(33,26,16,.76);
      --red: #b83024;
      --green: #167a3a;
      --border: rgba(93,65,14,.22);
      --shadow: 0 6px 22px rgba(71,45,8,.13);
      --text-main: #211a10;
      --text-muted: rgba(33,26,16,.76);
      --text-soft: rgba(33,26,16,.58);
      --surface-1: #f4eadb;
      --surface-2: #fff7e9;
      --surface-3: #fffaf1;
      --field-bg: rgba(255,255,255,.84);
      --field-border: rgba(93,65,14,.28);
    }

    body { background: var(--navy); color: var(--cream); }
    .card, .court-shell, .court-document { color: var(--cream); }
    .court-desc, .court-step-text, .court-ledger span, .char-counter, .slider-labels, .footer-links a, .footer-biz, .case-meta { color: var(--cream-dim) !important; }
    .step-content, .case-title, .sentence-text, h1, h2, h3, p, td, th, label, .form-label, .admin-table, .admin-table td { color: inherit; }

    .form-input, .form-textarea, input, textarea, select {
      background: var(--field-bg) !important;
      border-color: var(--field-border) !important;
      color: var(--cream) !important;
      caret-color: var(--gold);
    }
    .form-input::placeholder, .form-textarea::placeholder, input::placeholder, textarea::placeholder { color: var(--text-soft) !important; opacity: 1; }

    .btn-ghost {
      background: rgba(255,255,255,.07);
      color: var(--cream-dim) !important;
      border-color: var(--border);
    }
    .btn-secondary { color: var(--gold) !important; border-color: rgba(201,168,76,.55); }
    .btn-primary { color: #111827 !important; }
    .badge-gold { color: var(--gold) !important; }
    .page-header { background: color-mix(in srgb, var(--navy-light) 92%, transparent); }
    .back-btn { color: var(--cream-dim) !important; }
    .back-btn:hover { color: var(--cream) !important; }
    #site-footer { background: var(--navy-light); }

    [data-theme="light"] .card {
      background: var(--navy-card) !important;
      box-shadow: 0 6px 22px rgba(71,45,8,.10), inset 0 1px 0 rgba(255,255,255,.8);
    }
    [data-theme="light"] .page-header {
      background: rgba(255,247,233,.94) !important;
      border-bottom-color: rgba(93,65,14,.16) !important;
    }
    [data-theme="light"] .toast {
      background: rgba(255,250,241,.98) !important;
      color: #211a10 !important;
    }
    [data-theme="light"] .disclaimer {
      background: rgba(184,48,36,.075) !important;
      color: rgba(33,26,16,.76) !important;
      border-color: rgba(184,48,36,.20) !important;
    }
    [data-theme="light"] .disclaimer strong { color: #9b261d !important; }
    [data-theme="light"] .sentence-text { color: #7a5612 !important; }
    [data-theme="light"] .verdict-card,
    [data-theme="light"] .sentence-card,
    [data-theme="light"] .judge-reveal {
      background: linear-gradient(135deg,#fffaf1,rgba(138,100,22,.08)) !important;
    }
    [data-theme="light"] .example-card:hover { background: #fff4e0 !important; }
    [data-theme="light"] .admin-tab { color: rgba(33,26,16,.7) !important; }
    [data-theme="light"] .admin-tab.active { color: var(--gold) !important; }
    [data-theme="light"] .admin-btn { color: rgba(33,26,16,.75) !important; background: rgba(255,255,255,.72) !important; }
    [data-theme="light"] .admin-btn.gold { color: var(--gold) !important; }
    [data-theme="light"] .admin-btn.red { color: var(--red) !important; }

    [data-theme="dark"] .card { background: var(--navy-card); }
    [data-theme="dark"] .toast { background: rgba(26,32,53,.97); color: var(--cream); }
  `;
  document.head.appendChild(style);
}
