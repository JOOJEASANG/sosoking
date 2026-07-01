export function initContrastFix() {
  if (document.getElementById('contrast-fix-style')) return;
  const style = document.createElement('style');
  style.id = 'contrast-fix-style';
  style.textContent = `
    :root,
    [data-theme="dark"]{
      color-scheme:dark;
      --navy:#0d1117;
      --navy-light:#161b2e;
      --navy-card:#1a2035;
      --gold:#d4b55c;
      --gold-light:#f0d483;
      --gold-dim:rgba(212,181,92,.16);
      --cream:#fff8ec;
      --cream-dim:rgba(255,248,236,.82);
      --red:#ff7166;
      --green:#45d17c;
      --border:rgba(212,181,92,.32);
      --shadow:0 10px 30px rgba(0,0,0,.38);
      --text-strong:#fff8ec;
      --text-muted:rgba(255,248,236,.82);
      --text-soft:rgba(255,248,236,.66);
      --surface-1:#1a2035;
      --surface-2:rgba(255,255,255,.065);
      --surface-3:rgba(255,255,255,.105);
      --field-bg:rgba(255,255,255,.075);
      --field-border:rgba(212,181,92,.42);
      --header-bg:rgba(22,27,46,.96);
      --nav-bg:rgba(13,17,23,.98);
      --hero-text:#fff8ec;
      --danger-text:#ff9b92;
    }

    [data-theme="light"]{
      color-scheme:light;
      --navy:#f4eadc;
      --navy-light:#fff8ed;
      --navy-card:#fffdf8;
      --gold:#714a04;
      --gold-light:#9a6508;
      --gold-dim:rgba(113,74,4,.13);
      --cream:#17120a;
      --cream-dim:rgba(23,18,10,.78);
      --red:#9f241b;
      --green:#0f6b34;
      --border:rgba(113,74,4,.34);
      --shadow:0 10px 26px rgba(78,52,12,.13);
      --text-strong:#17120a;
      --text-muted:rgba(23,18,10,.78);
      --text-soft:rgba(23,18,10,.58);
      --surface-1:#fffdf8;
      --surface-2:rgba(0,0,0,.050);
      --surface-3:rgba(0,0,0,.085);
      --field-bg:rgba(255,255,255,.94);
      --field-border:rgba(113,74,4,.38);
      --header-bg:rgba(255,248,237,.96);
      --nav-bg:rgba(255,248,237,.98);
      --hero-text:#fff8ec;
      --danger-text:#9f241b;
    }

    @media (prefers-color-scheme: light){
      :root:not([data-theme]){
        color-scheme:light;
        --navy:#f4eadc;
        --navy-light:#fff8ed;
        --navy-card:#fffdf8;
        --gold:#714a04;
        --gold-light:#9a6508;
        --gold-dim:rgba(113,74,4,.13);
        --cream:#17120a;
        --cream-dim:rgba(23,18,10,.78);
        --red:#9f241b;
        --green:#0f6b34;
        --border:rgba(113,74,4,.34);
        --shadow:0 10px 26px rgba(78,52,12,.13);
        --text-strong:#17120a;
        --text-muted:rgba(23,18,10,.78);
        --text-soft:rgba(23,18,10,.58);
        --surface-1:#fffdf8;
        --surface-2:rgba(0,0,0,.050);
        --surface-3:rgba(0,0,0,.085);
        --field-bg:rgba(255,255,255,.94);
        --field-border:rgba(113,74,4,.38);
        --header-bg:rgba(255,248,237,.96);
        --nav-bg:rgba(255,248,237,.98);
        --hero-text:#fff8ec;
        --danger-text:#9f241b;
      }
    }

    body{background:var(--navy)!important;color:var(--text-strong)!important;}
    body,.card,.court-document,.admin-table,.admin-table td,.admin-table th{color:var(--text-strong)!important;}
    p,small,.judge-option-desc,.slider-labels,.char-counter,.footer-biz,.footer-links a,.case-meta,.theme-preference-desc,.section-sub,.court-desc{color:var(--text-muted)!important;}
    .step-content,.sentence-text,.case-title,.judge-option-name,.court-title,.court-step-title{color:var(--text-strong)!important;}
    .page-header .logo,h1,h2,h3,.step-role,.form-label,.court-kicker{color:var(--gold)!important;}
    .back-btn{color:var(--text-muted)!important;}
    .back-btn:hover{color:var(--text-strong)!important;}

    .card{background:var(--surface-1)!important;border-color:var(--border)!important;box-shadow:var(--shadow),inset 0 1px 0 rgba(255,255,255,.06)!important;}
    .page-header{background:var(--header-bg)!important;border-bottom-color:var(--border)!important;}
    #site-footer{background:var(--navy-light)!important;border-top-color:var(--border)!important;}

    .form-input,.form-textarea,input,textarea,select{
      background:var(--field-bg)!important;
      color:var(--text-strong)!important;
      border-color:var(--field-border)!important;
      caret-color:var(--gold)!important;
    }
    .form-input::placeholder,.form-textarea::placeholder,input::placeholder,textarea::placeholder{color:var(--text-soft)!important;opacity:1!important;}
    .form-input:focus,.form-textarea:focus,input:focus,textarea:focus,select:focus{background:var(--field-bg)!important;border-color:var(--gold)!important;box-shadow:0 0 0 3px var(--gold-dim)!important;}

    .btn,.hero-cta,.reaction-btn,.judge-card,.judge-option,.nav-item,.theme-toggle{min-height:42px;}
    .btn-ghost{background:var(--surface-2)!important;color:var(--text-muted)!important;border-color:var(--border)!important;}
    .btn-ghost:hover{background:var(--surface-3)!important;color:var(--text-strong)!important;}
    .btn-secondary{color:var(--gold)!important;border-color:var(--border)!important;background:transparent!important;}
    .btn-secondary:hover{background:var(--gold-dim)!important;}
    .btn-primary,.hero-cta{color:#120d05!important;}

    .badge-gold{color:var(--gold)!important;background:var(--gold-dim)!important;border-color:var(--border)!important;}
    .badge-red{color:var(--red)!important;}
    .disclaimer{color:var(--text-muted)!important;background:rgba(231,76,60,.075)!important;border-color:rgba(231,76,60,.25)!important;}
    .disclaimer strong{color:var(--danger-text)!important;}

    #bottom-nav{background:var(--nav-bg)!important;border-top-color:var(--border)!important;box-shadow:0 -6px 20px rgba(0,0,0,.10)!important;}
    .nav-item{color:var(--text-soft)!important;}
    .nav-item.active,.nav-item.nav-cta.active{color:var(--gold)!important;}
    .nav-label{font-size:10.5px!important;}

    .toast{color:var(--text-strong)!important;background:var(--surface-1)!important;border-color:var(--border)!important;}
    .admin-table th{color:var(--gold)!important;}
    .admin-table td{color:var(--text-strong)!important;}
    .admin-table tr:hover td{background:var(--surface-2)!important;}
    .admin-tab{color:var(--text-muted)!important;}
    .admin-tab.active{color:var(--gold)!important;}
    .admin-btn{color:var(--text-muted)!important;background:var(--surface-2)!important;border-color:var(--border)!important;}
    .admin-btn.gold{color:var(--gold)!important;}
    .admin-btn.red{color:var(--red)!important;}

    .reaction-btn{color:var(--text-strong)!important;background:var(--surface-2)!important;border-color:var(--border)!important;}
    .reaction-btn span,.reaction-btn div{color:inherit!important;}
    .theme-choice:not(.active){color:var(--text-muted)!important;}
    .theme-preference-card{color:var(--text-strong)!important;}

    .hero-section,.cta-section{color:var(--hero-text)!important;}
    .hero-section .hero-h1,.hero-section h1,.hero-section h2,.hero-section strong,.cta-section h2{color:#fff8ec!important;}
    .hero-sub,.hero-tw,.hero-disclaimer,.stat-label,.cta-section p{color:rgba(255,248,236,.78)!important;}
    .hero-tw strong,.stat-num{color:#f0d483!important;}

    .court-shell{
      background:linear-gradient(145deg,rgba(26,32,53,.98),rgba(13,17,23,.96))!important;
      color:#fff8ec!important;
      border-color:rgba(212,181,92,.44)!important;
      box-shadow:0 12px 34px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.06)!important;
    }
    .court-shell .court-title,.court-shell .court-step-title,.court-shell strong,.court-shell h1,.court-shell h2,.court-shell h3{color:#fff8ec!important;}
    .court-shell .court-kicker,.court-shell .court-ledger strong,.court-shell .court-step-num{color:#f0d483!important;}
    .court-shell .court-desc,.court-shell .court-step-text,.court-shell .court-ledger span,.court-shell p,.court-shell small{color:rgba(255,248,236,.84)!important;}
    .court-shell .court-ledger div,.court-shell .court-step{background:rgba(255,255,255,.060)!important;border-color:rgba(212,181,92,.34)!important;}

    [data-theme="light"] .court-shell{
      background:linear-gradient(145deg,#fffdf8,#f7efe3)!important;
      color:var(--text-strong)!important;
      border-color:var(--border)!important;
      box-shadow:0 10px 24px rgba(78,52,12,.12),inset 0 1px 0 rgba(255,255,255,.92)!important;
    }
    [data-theme="light"] .court-shell .court-title,
    [data-theme="light"] .court-shell .court-step-title,
    [data-theme="light"] .court-shell strong,
    [data-theme="light"] .court-shell h1,
    [data-theme="light"] .court-shell h2,
    [data-theme="light"] .court-shell h3{color:var(--text-strong)!important;}
    [data-theme="light"] .court-shell .court-kicker,
    [data-theme="light"] .court-shell .court-ledger strong,
    [data-theme="light"] .court-shell .court-step-num{color:var(--gold)!important;}
    [data-theme="light"] .court-shell .court-desc,
    [data-theme="light"] .court-shell .court-step-text,
    [data-theme="light"] .court-shell .court-ledger span,
    [data-theme="light"] .court-shell p,
    [data-theme="light"] .court-shell small{color:var(--text-muted)!important;}
    [data-theme="light"] .court-shell .court-ledger div,
    [data-theme="light"] .court-shell .court-step{background:var(--surface-2)!important;border-color:var(--border)!important;}

    @media (prefers-color-scheme: light){
      :root:not([data-theme]) .court-shell{background:linear-gradient(145deg,#fffdf8,#f7efe3)!important;color:var(--text-strong)!important;border-color:var(--border)!important;box-shadow:0 10px 24px rgba(78,52,12,.12),inset 0 1px 0 rgba(255,255,255,.92)!important;}
      :root:not([data-theme]) .court-shell .court-title,
      :root:not([data-theme]) .court-shell .court-step-title,
      :root:not([data-theme]) .court-shell strong,
      :root:not([data-theme]) .court-shell h1,
      :root:not([data-theme]) .court-shell h2,
      :root:not([data-theme]) .court-shell h3{color:var(--text-strong)!important;}
      :root:not([data-theme]) .court-shell .court-kicker,
      :root:not([data-theme]) .court-shell .court-ledger strong,
      :root:not([data-theme]) .court-shell .court-step-num{color:var(--gold)!important;}
      :root:not([data-theme]) .court-shell .court-desc,
      :root:not([data-theme]) .court-shell .court-step-text,
      :root:not([data-theme]) .court-shell .court-ledger span,
      :root:not([data-theme]) .court-shell p,
      :root:not([data-theme]) .court-shell small{color:var(--text-muted)!important;}
      :root:not([data-theme]) .court-shell .court-ledger div,
      :root:not([data-theme]) .court-shell .court-step{background:var(--surface-2)!important;border-color:var(--border)!important;}
    }

    .court-document{background:linear-gradient(180deg,var(--surface-1),rgba(255,255,255,.03))!important;border-color:var(--border)!important;color:var(--text-strong)!important;}
    .court-stamp,.verdict-stamp{color:var(--red)!important;border-color:var(--red)!important;}
    .sentence-card{background:linear-gradient(135deg,var(--gold-dim),rgba(255,255,255,.025))!important;border-color:var(--border)!important;}
    .sentence-text{color:var(--gold-light)!important;}

    .example-card:hover,.judge-card:hover,.judge-option:hover{background:var(--surface-3)!important;}
    .judge-card,.judge-option{background:var(--surface-1)!important;border-color:var(--border)!important;color:var(--text-strong)!important;}
    .judge-option.active{background:var(--gold-dim)!important;border-color:var(--gold)!important;box-shadow:0 0 0 2px rgba(212,181,92,.28)!important;}

    @media(max-width:420px){
      .container{padding-left:16px!important;padding-right:16px!important;}
      .hero-h1{font-size:42px!important;}
      .card{padding:18px!important;}
      .btn,.hero-cta{font-size:15px!important;}
    }
  `;
  document.head.appendChild(style);
}
