export function initContrastFix() {
  if (document.getElementById('contrast-fix-style')) return;
  const style = document.createElement('style');
  style.id = 'contrast-fix-style';
  style.textContent = `
    :root{
      color-scheme:dark;
      --cream:#fff8ec;
      --cream-dim:rgba(255,248,236,.80);
      --text-strong:#fff8ec;
      --text-muted:rgba(255,248,236,.80);
      --text-soft:rgba(255,248,236,.64);
      --surface-soft:rgba(255,255,255,.060);
      --surface-hover:rgba(255,255,255,.095);
      --field-bg:rgba(255,255,255,.065);
      --field-border:rgba(201,168,76,.36);
    }
    [data-theme="dark"]{
      color-scheme:dark;
      --navy:#0d1117;
      --navy-light:#161b2e;
      --navy-card:#1a2035;
      --gold:#c9a84c;
      --gold-light:#e8c97a;
      --gold-dim:rgba(201,168,76,.15);
      --cream:#fff8ec;
      --cream-dim:rgba(255,248,236,.80);
      --border:rgba(201,168,76,.30);
      --text-strong:#fff8ec;
      --text-muted:rgba(255,248,236,.80);
      --text-soft:rgba(255,248,236,.64);
      --surface-soft:rgba(255,255,255,.060);
      --surface-hover:rgba(255,255,255,.095);
      --field-bg:rgba(255,255,255,.065);
      --field-border:rgba(201,168,76,.36);
    }
    [data-theme="light"]{
      color-scheme:light;
      --navy:#f4eadc;
      --navy-light:#fff8ed;
      --navy-card:#fffdf8;
      --gold:#7a5206;
      --gold-light:#a77611;
      --gold-dim:rgba(122,82,6,.12);
      --cream:#17120a;
      --cream-dim:rgba(23,18,10,.80);
      --red:#9f241b;
      --green:#14703a;
      --border:rgba(122,82,6,.32);
      --shadow:0 8px 24px rgba(78,52,12,.12);
      --text-strong:#17120a;
      --text-muted:rgba(23,18,10,.80);
      --text-soft:rgba(23,18,10,.62);
      --surface-soft:rgba(0,0,0,.048);
      --surface-hover:rgba(0,0,0,.078);
      --field-bg:rgba(255,255,255,.90);
      --field-border:rgba(122,82,6,.34);
    }
    @media (prefers-color-scheme: light){
      :root:not([data-theme="dark"]){
        color-scheme:light;
        --navy:#f4eadc;
        --navy-light:#fff8ed;
        --navy-card:#fffdf8;
        --gold:#7a5206;
        --gold-light:#a77611;
        --gold-dim:rgba(122,82,6,.12);
        --cream:#17120a;
        --cream-dim:rgba(23,18,10,.80);
        --red:#9f241b;
        --green:#14703a;
        --border:rgba(122,82,6,.32);
        --shadow:0 8px 24px rgba(78,52,12,.12);
        --text-strong:#17120a;
        --text-muted:rgba(23,18,10,.80);
        --text-soft:rgba(23,18,10,.62);
        --surface-soft:rgba(0,0,0,.048);
        --surface-hover:rgba(0,0,0,.078);
        --field-bg:rgba(255,255,255,.90);
        --field-border:rgba(122,82,6,.34);
      }
    }

    body,.card,.court-shell,.court-document,.admin-table,.admin-table td,.admin-table th{color:var(--text-strong)!important;}
    p,small,.court-desc,.court-step-text,.judge-option-desc,.slider-labels,.char-counter,.footer-biz,.footer-links a,.case-meta,.step-content div,.theme-preference-desc{color:var(--text-muted)!important;}
    .step-content,.sentence-text,.case-title,.court-step-title,.judge-option-name{color:var(--text-strong)!important;}
    .page-header .logo,.court-title,h1,h2,h3,.step-role,.form-label,.court-kicker{color:var(--gold)!important;}
    .back-btn{color:var(--text-muted)!important;}
    .back-btn:hover{color:var(--text-strong)!important;}

    .card{background:var(--navy-card)!important;border-color:var(--border)!important;}
    .page-header{background:color-mix(in srgb,var(--navy-light) 94%,transparent)!important;border-bottom-color:var(--border)!important;}
    #site-footer{background:var(--navy-light)!important;border-top-color:var(--border)!important;}

    .form-input,.form-textarea,input,textarea,select{
      background:var(--field-bg)!important;
      color:var(--text-strong)!important;
      border-color:var(--field-border)!important;
      caret-color:var(--gold)!important;
    }
    .form-input::placeholder,.form-textarea::placeholder,input::placeholder,textarea::placeholder{color:var(--text-soft)!important;opacity:1!important;}
    .form-input:focus,.form-textarea:focus,input:focus,textarea:focus,select:focus{background:var(--surface-hover)!important;border-color:var(--gold)!important;box-shadow:0 0 0 3px var(--gold-dim)!important;}

    .btn-ghost{background:var(--surface-soft)!important;color:var(--text-muted)!important;border-color:var(--border)!important;}
    .btn-ghost:hover{background:var(--surface-hover)!important;color:var(--text-strong)!important;}
    .btn-secondary{color:var(--gold)!important;border-color:rgba(201,168,76,.58)!important;background:transparent!important;}
    [data-theme="light"] .btn-secondary,:root:not([data-theme="dark"]) .btn-secondary{border-color:rgba(122,82,6,.50)!important;}
    .btn-primary{color:#120d05!important;}

    .badge-gold{color:var(--gold)!important;background:var(--gold-dim)!important;border-color:var(--border)!important;}
    .badge-red{color:var(--red)!important;}
    .disclaimer{color:var(--text-muted)!important;background:rgba(231,76,60,.075)!important;border-color:rgba(231,76,60,.25)!important;}
    .disclaimer strong{color:#ff9b92!important;}
    [data-theme="light"] .disclaimer strong,:root:not([data-theme="dark"]) .disclaimer strong{color:#9f241b!important;}

    #bottom-nav{background:rgba(13,17,23,.98)!important;border-top-color:var(--border)!important;}
    .nav-item{color:rgba(255,248,236,.66)!important;}
    .nav-item.active,.nav-item.nav-cta.active{color:var(--gold)!important;}
    [data-theme="light"] #bottom-nav,:root:not([data-theme="dark"]) #bottom-nav{background:rgba(255,248,237,.98)!important;}
    [data-theme="light"] .nav-item,:root:not([data-theme="dark"]) .nav-item{color:rgba(23,18,10,.66)!important;}

    .toast{color:var(--text-strong)!important;background:var(--navy-card)!important;border-color:var(--border)!important;}
    .admin-table th{color:var(--gold)!important;}
    .admin-table td{color:var(--text-strong)!important;}
    .admin-table tr:hover td{background:var(--surface-soft)!important;}
    .admin-tab{color:var(--text-muted)!important;}
    .admin-tab.active{color:var(--gold)!important;}
    .admin-btn{color:var(--text-muted)!important;background:var(--surface-soft)!important;border-color:var(--border)!important;}
    .admin-btn.gold{color:var(--gold)!important;}
    .admin-btn.red{color:var(--red)!important;}

    .reaction-btn{color:var(--text-strong)!important;background:var(--surface-soft)!important;border-color:var(--border)!important;}
    .reaction-btn span,.reaction-btn div{color:inherit!important;}
    .theme-choice:not(.active){color:var(--text-muted)!important;}
    .theme-preference-card{color:var(--text-strong)!important;}

    [data-theme="light"] .court-shell,:root:not([data-theme="dark"]) .court-shell{background:linear-gradient(145deg,#fffdf8,#f4eadc)!important;}
    [data-theme="light"] .court-document,:root:not([data-theme="dark"]) .court-document{background:#fffdf8!important;}
    [data-theme="light"] .court-step,
    [data-theme="light"] .court-ledger div,
    :root:not([data-theme="dark"]) .court-step,
    :root:not([data-theme="dark"]) .court-ledger div{background:rgba(122,82,6,.048)!important;border-color:rgba(122,82,6,.28)!important;}
    [data-theme="light"] .court-stamp,
    [data-theme="light"] .verdict-stamp,
    :root:not([data-theme="dark"]) .court-stamp,
    :root:not([data-theme="dark"]) .verdict-stamp{color:#9f241b!important;border-color:#9f241b!important;}
    [data-theme="light"] .sentence-text,:root:not([data-theme="dark"]) .sentence-text{color:#7a5206!important;}
    [data-theme="light"] .hero-h1,
    [data-theme="light"] .cta-section h2,
    [data-theme="light"] .cta-section p,
    [data-theme="light"] .hero-section,
    [data-theme="light"] .cta-section,
    :root:not([data-theme="dark"]) .hero-h1,
    :root:not([data-theme="dark"]) .cta-section h2,
    :root:not([data-theme="dark"]) .cta-section p,
    :root:not([data-theme="dark"]) .hero-section,
    :root:not([data-theme="dark"]) .cta-section{color:#fff8ec!important;}

    :root:not([data-theme="light"]) .court-shell{background:linear-gradient(145deg,rgba(26,32,53,.98),rgba(13,17,23,.96))!important;}
    :root:not([data-theme="light"]) .court-document{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.028))!important;}
  `;
  document.head.appendChild(style);
}
