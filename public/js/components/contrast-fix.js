export function initContrastFix() {
  if (document.getElementById('contrast-fix-style')) return;
  const style = document.createElement('style');
  style.id = 'contrast-fix-style';
  style.textContent = `
    :root,
    [data-theme="dark"]{
      color-scheme:dark;
      --navy:#0b0f16;
      --navy-light:#141a27;
      --navy-card:#1a2130;
      --gold:#d1ad50;
      --gold-light:#f0cf78;
      --gold-dim:rgba(209,173,80,.14);
      --cream:#fff9ef;
      --cream-dim:rgba(255,249,239,.76);
      --red:#f06a5d;
      --green:#43c878;
      --border:rgba(209,173,80,.28);
      --border-soft:rgba(255,255,255,.09);
      --surface-soft:rgba(255,255,255,.055);
      --surface-hover:rgba(255,255,255,.095);
      --field-bg:rgba(255,255,255,.065);
      --field-border:rgba(209,173,80,.34);
      --shadow:0 10px 30px rgba(0,0,0,.34);
      --shadow-soft:0 4px 18px rgba(0,0,0,.20);
    }

    [data-theme="light"]{
      color-scheme:light;
      --navy:#f4eee4;
      --navy-light:#fffaf2;
      --navy-card:#fffdf9;
      --gold:#79530b;
      --gold-light:#b78319;
      --gold-dim:rgba(121,83,11,.11);
      --cream:#20170d;
      --cream-dim:rgba(32,23,13,.72);
      --red:#a52c22;
      --green:#176c3b;
      --border:rgba(121,83,11,.27);
      --border-soft:rgba(32,23,13,.11);
      --surface-soft:rgba(32,23,13,.045);
      --surface-hover:rgba(32,23,13,.075);
      --field-bg:#fffefb;
      --field-border:rgba(121,83,11,.34);
      --shadow:0 10px 28px rgba(77,52,12,.12);
      --shadow-soft:0 4px 16px rgba(77,52,12,.08);
    }

    html,body{background:var(--navy)!important;color:var(--cream)!important;}
    body::before{opacity:1;}
    .card,.judge-option,.theme-preference-card{background:var(--navy-card)!important;color:var(--cream)!important;border-color:var(--border)!important;box-shadow:var(--shadow-soft)!important;}
    .page-header{background:color-mix(in srgb,var(--navy-light) 95%,transparent)!important;border-bottom-color:var(--border)!important;color:var(--cream)!important;}
    .page-header .logo{color:var(--gold)!important;}
    .back-btn{color:var(--cream-dim)!important;}
    .back-btn:hover{color:var(--cream)!important;}
    #site-footer{background:var(--navy-light)!important;border-top-color:var(--border)!important;}
    .footer-links a,.footer-biz{color:var(--cream-dim)!important;}

    .form-input,.form-textarea,input,textarea,select{
      background:var(--field-bg)!important;
      color:var(--cream)!important;
      border-color:var(--field-border)!important;
      caret-color:var(--gold)!important;
    }
    .form-input::placeholder,.form-textarea::placeholder,input::placeholder,textarea::placeholder{color:color-mix(in srgb,var(--cream) 42%,transparent)!important;opacity:1!important;}
    .form-input:focus,.form-textarea:focus,input:focus,textarea:focus,select:focus{background:var(--field-bg)!important;border-color:var(--gold)!important;box-shadow:0 0 0 3px var(--gold-dim)!important;}
    .form-label,.step-role,.admin-table th,.admin-tab.active{color:var(--gold)!important;}

    .btn-primary,.hero-cta{color:#171008!important;}
    .btn-secondary{background:transparent!important;color:var(--gold)!important;border-color:color-mix(in srgb,var(--gold) 60%,transparent)!important;}
    .btn-secondary:hover{background:var(--gold-dim)!important;}
    .btn-ghost,.admin-btn,.reaction-btn{background:var(--surface-soft)!important;color:var(--cream-dim)!important;border-color:var(--border-soft)!important;}
    .btn-ghost:hover,.admin-btn:hover,.reaction-btn:hover{background:var(--surface-hover)!important;color:var(--cream)!important;}
    .btn:disabled{opacity:.48!important;}

    .toast{max-width:min(92vw,430px);white-space:normal!important;background:var(--navy-card)!important;color:var(--cream)!important;border-color:var(--border)!important;box-shadow:var(--shadow)!important;}
    .toast.success{border-color:var(--green)!important;}
    .toast.error{border-color:var(--red)!important;}
    .disclaimer{background:color-mix(in srgb,var(--red) 8%,transparent)!important;color:var(--cream-dim)!important;border-color:color-mix(in srgb,var(--red) 28%,transparent)!important;}
    .disclaimer strong{color:var(--red)!important;}

    #bottom-nav{background:color-mix(in srgb,var(--navy-light) 97%,transparent)!important;border-top-color:var(--border)!important;}
    .nav-item{color:color-mix(in srgb,var(--cream) 55%,transparent)!important;}
    .nav-item.active,.nav-item.nav-cta.active{color:var(--gold)!important;}

    .example-card:hover,.admin-table tr:hover td{background:var(--surface-hover)!important;}
    .case-title,.step-content,.judge-option-name,.admin-table td{color:var(--cream)!important;}
    .case-meta,.judge-option-desc,.slider-labels,.char-counter,.theme-preference-desc,.auth-help,.auth-profile-grid{color:var(--cream-dim)!important;}
    .admin-table td,.admin-table th{border-bottom-color:var(--border-soft)!important;}
    .tag{background:var(--surface-soft)!important;color:var(--cream-dim)!important;}

    .hero-section,.cta-section{
      background:radial-gradient(circle at 50% 4%,rgba(201,168,76,.13),transparent 32%),linear-gradient(180deg,#211706 0%,#0d0c09 72%)!important;
      color:#fff9ef!important;
    }
    .hero-section .hero-h1,.hero-section h1,.hero-section h2,.hero-section h3,.cta-section h1,.cta-section h2,.cta-section h3{color:#fff9ef!important;text-shadow:none!important;}
    .hero-section .hero-sub,.hero-section .hero-disclaimer,.hero-section p,.hero-section small,.hero-section .stat-label,.cta-section p,.cta-section small{color:rgba(255,249,239,.76)!important;}
    .hero-section .hero-badge{color:#e9c96d!important;background:rgba(201,168,76,.13)!important;border-color:rgba(232,201,122,.34)!important;}
    .hero-section .hero-tw{color:rgba(255,249,239,.76)!important;background:rgba(255,255,255,.045)!important;border-color:rgba(232,201,122,.25)!important;}
    .hero-section .hero-tw strong,.hero-section .stat-num{color:#f0cf78!important;}
    .hero-section .stats-row{border-color:rgba(232,201,122,.18)!important;}

    .court-shell{background:linear-gradient(145deg,#1a2130,#0b0f16)!important;color:#fff9ef!important;border-color:rgba(209,173,80,.4)!important;}
    .court-shell .court-title,.court-shell .court-step-title,.court-shell strong,.court-shell h1,.court-shell h2,.court-shell h3{color:#fff9ef!important;}
    .court-shell .court-kicker,.court-shell .court-ledger strong,.court-shell .court-step-num{color:#f0cf78!important;}
    .court-shell .court-desc,.court-shell .court-step-text,.court-shell .court-ledger span,.court-shell p,.court-shell small{color:rgba(255,249,239,.79)!important;}
    .court-shell .court-ledger div,.court-shell .court-step{background:rgba(255,255,255,.055)!important;border-color:rgba(209,173,80,.28)!important;}

    .result-document-page .result-cover.card,
    .result-document-page .result-paper.card,
    .result-document-page .result-paper.verdict-card,
    .result-document-page .court-document{background:#fffdf7!important;color:#2b251f!important;border-color:#d8cfbf!important;color-scheme:light!important;}
    .result-document-page .result-cover h1,.result-document-page .result-cover h2,.result-document-page .result-paper-title,.result-document-page .doc-subheading{color:#251a0d!important;}
    .result-document-page .result-paper-body,.result-document-page .doc-paragraph,.result-document-page .doc-order-item,.result-document-page .doc-order-item p{color:#302b25!important;}

    .auth-divider{display:flex;align-items:center;gap:10px;margin:20px 0;color:var(--cream-dim);font-size:12px;}
    .auth-divider span{height:1px;background:var(--border-soft);flex:1;}
    .auth-divider b{font-weight:500;color:var(--cream-dim);}
    .auth-status{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:color-mix(in srgb,var(--green) 13%,transparent);border:1px solid color-mix(in srgb,var(--green) 36%,transparent);color:var(--green);font-size:12px;font-weight:800;margin-bottom:10px;}
    .auth-inline-field{display:grid;grid-template-columns:minmax(0,1fr) 108px;gap:8px;}
    .auth-inline-field .form-input{min-width:0;}
    .auth-inline-field .btn{width:108px;padding-left:8px;padding-right:8px;}
    .auth-help{font-size:12px;margin-top:8px;}
    .auth-profile-state{padding:15px!important;margin-bottom:14px!important;background:var(--surface-soft)!important;}
    .auth-profile-grid{display:grid;grid-template-columns:92px minmax(0,1fr);gap:8px;font-size:13px;line-height:1.7;}
    .auth-online{color:var(--green)!important;font-weight:800;}

    [data-theme="light"] body::before{background:radial-gradient(circle at 50% -10%,rgba(121,83,11,.09),transparent 34%),linear-gradient(180deg,rgba(124,84,12,.035),transparent 38%)!important;}
    [data-theme="light"] .court-document:not(.result-paper){background:#fffaf3!important;color:#20170d!important;}
    [data-theme="light"] .sentence-text{color:#79530b!important;}
    [data-theme="light"] .verdict-card{background:linear-gradient(135deg,#fffdf9,rgba(121,83,11,.045))!important;}

    @media(max-width:420px){
      #toast-container{left:14px;right:14px;transform:none;align-items:stretch;}
      .toast{text-align:center;padding:12px 15px;}
      .auth-inline-field{grid-template-columns:1fr;}
      .auth-inline-field .btn{width:100%;}
    }
  `;
  document.head.appendChild(style);
}
