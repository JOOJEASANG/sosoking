export function initContrastFix() {
  if (document.getElementById('contrast-fix-style')) return;
  const style = document.createElement('style');
  style.id = 'contrast-fix-style';
  style.textContent = `
    :root{
      --cream:#fff8ec;
      --cream-dim:rgba(255,248,236,.78);
      --text-strong:#fff8ec;
      --text-muted:rgba(255,248,236,.78);
      --surface-soft:rgba(255,255,255,.055);
      --surface-hover:rgba(255,255,255,.09);
    }
    [data-theme="light"]{
      --navy:#f4eadc;
      --navy-light:#fff8ed;
      --navy-card:#fffdf8;
      --gold:#7a5206;
      --gold-light:#a77611;
      --gold-dim:rgba(122,82,6,.12);
      --cream:#17120a;
      --cream-dim:rgba(23,18,10,.78);
      --text-strong:#17120a;
      --text-muted:rgba(23,18,10,.76);
      --border:rgba(122,82,6,.32);
      --shadow:0 8px 24px rgba(78,52,12,.12);
      --surface-soft:rgba(0,0,0,.045);
      --surface-hover:rgba(0,0,0,.075);
    }
    @media (prefers-color-scheme: light){
      :root:not([data-theme="dark"]){
        --navy:#f4eadc;
        --navy-light:#fff8ed;
        --navy-card:#fffdf8;
        --gold:#7a5206;
        --gold-light:#a77611;
        --gold-dim:rgba(122,82,6,.12);
        --cream:#17120a;
        --cream-dim:rgba(23,18,10,.78);
        --text-strong:#17120a;
        --text-muted:rgba(23,18,10,.76);
        --border:rgba(122,82,6,.32);
        --shadow:0 8px 24px rgba(78,52,12,.12);
        --surface-soft:rgba(0,0,0,.045);
        --surface-hover:rgba(0,0,0,.075);
      }
    }

    body,.card,.court-shell,.court-document,.admin-table td{color:var(--text-strong)!important;}
    p,small,.court-desc,.court-step-text,.judge-option-desc,.slider-labels,.char-counter,.footer-biz,.footer-links a,.case-meta,.step-content div{color:var(--text-muted)!important;}
    .step-content{color:var(--text-strong)!important;}
    .page-header .logo,.court-title,h1,h2,h3,.judge-option-name,.step-role,.form-label{color:var(--gold)!important;}
    .back-btn{color:var(--text-muted)!important;}
    .back-btn:hover{color:var(--text-strong)!important;}

    .card{background:var(--navy-card)!important;border-color:var(--border)!important;}
    .form-input,.form-textarea{
      background:var(--surface-soft)!important;
      color:var(--text-strong)!important;
      border-color:var(--border)!important;
    }
    .form-input::placeholder,.form-textarea::placeholder{color:var(--text-muted)!important;opacity:.58!important;}
    .form-input:focus,.form-textarea:focus{background:var(--surface-hover)!important;border-color:var(--gold)!important;}

    .btn-ghost{background:var(--surface-soft)!important;color:var(--text-muted)!important;border-color:var(--border)!important;}
    .btn-ghost:hover{background:var(--surface-hover)!important;color:var(--text-strong)!important;}
    .btn-secondary{color:var(--gold)!important;border-color:rgba(201,168,76,.58)!important;}
    [data-theme="light"] .btn-secondary{border-color:rgba(122,82,6,.48)!important;}
    .btn-primary{color:#120d05!important;}

    .badge-gold{color:var(--gold)!important;background:var(--gold-dim)!important;border-color:var(--border)!important;}
    .disclaimer{color:var(--text-muted)!important;background:rgba(231,76,60,.075)!important;border-color:rgba(231,76,60,.25)!important;}
    .disclaimer strong{color:#ff9b92!important;}
    [data-theme="light"] .disclaimer strong{color:#9f241b!important;}

    #bottom-nav{background:rgba(13,17,23,.98)!important;}
    .nav-item{color:rgba(255,248,236,.62)!important;}
    .nav-item.active,.nav-item.nav-cta.active{color:var(--gold)!important;}
    [data-theme="light"] #bottom-nav{background:rgba(255,248,237,.98)!important;}
    [data-theme="light"] .nav-item{color:rgba(23,18,10,.62)!important;}

    .toast{color:var(--text-strong)!important;background:var(--navy-card)!important;}
    .admin-table th{color:var(--gold)!important;}
    .admin-table td{color:var(--text-strong)!important;}
    .admin-table tr:hover td{background:var(--surface-soft)!important;}
    .admin-tab{color:var(--text-muted)!important;}
    .admin-tab.active{color:var(--gold)!important;}

    [data-theme="light"] .court-shell{background:linear-gradient(145deg,#fffdf8,#f4eadc)!important;}
    [data-theme="light"] .court-document{background:#fffdf8!important;}
    [data-theme="light"] .court-step,
    [data-theme="light"] .court-ledger div{background:rgba(122,82,6,.045)!important;border-color:rgba(122,82,6,.26)!important;}
    [data-theme="light"] .court-stamp,
    [data-theme="light"] .verdict-stamp{color:#9f241b!important;border-color:#9f241b!important;}
    [data-theme="light"] .sentence-text{color:#7a5206!important;}
    [data-theme="light"] .hero-h1,
    [data-theme="light"] .cta-section h2,
    [data-theme="light"] .cta-section p{color:#fff8ec!important;}
    [data-theme="light"] .hero-section,
    [data-theme="light"] .cta-section{color:#fff8ec!important;}

    :root:not([data-theme="light"]) .court-shell{background:linear-gradient(145deg,rgba(26,32,53,.98),rgba(13,17,23,.96))!important;}
    :root:not([data-theme="light"]) .court-document{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.028))!important;}
  `;
  document.head.appendChild(style);
}
