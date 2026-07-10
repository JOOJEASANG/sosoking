export function initCourtDesign() {
  if (document.getElementById('court-design-style')) return;
  const style = document.createElement('style');
  style.id = 'court-design-style';
  style.textContent = `
    body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:-1;background:radial-gradient(circle at 50% -10%,color-mix(in srgb,var(--ui-gold,var(--gold)) 15%,transparent),transparent 34%),linear-gradient(180deg,color-mix(in srgb,var(--ui-danger,var(--red)) 6%,transparent),transparent 38%);} 
    .court-shell{position:relative;overflow:hidden;border:1px solid var(--ui-line-strong,var(--border));border-radius:18px;background:var(--ui-hero-card,var(--navy-card));box-shadow:var(--ui-shadow,var(--shadow));color:var(--ui-text-main,var(--cream));} 
    .court-shell::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--ui-gold,var(--gold)) 8%,transparent),transparent);opacity:.45;pointer-events:none;} 
    .court-kicker{font-size:10px;color:var(--ui-gold,var(--gold));font-weight:900;letter-spacing:.18em;text-transform:uppercase;} 
    .court-title{font-family:var(--font-serif);font-size:22px;font-weight:900;line-height:1.42;color:var(--ui-text,var(--cream));} 
    .court-desc{font-size:13px;color:var(--ui-text-muted,var(--cream-dim));line-height:1.75;} 
    .court-seal{display:inline-flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:50%;border:2px solid var(--ui-line-strong,var(--border));color:var(--ui-gold,var(--gold));background:radial-gradient(circle,color-mix(in srgb,var(--ui-gold,var(--gold)) 17%,transparent),color-mix(in srgb,var(--ui-gold,var(--gold)) 3%,transparent));font-size:30px;box-shadow:inset 0 0 0 5px color-mix(in srgb,var(--ui-gold,var(--gold)) 5%,transparent);} 
    .court-ledger{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;} 
    .court-ledger div{border:1px solid var(--ui-line,var(--border));border-radius:12px;padding:10px 8px;background:color-mix(in srgb,var(--ui-surface-raised,var(--navy-card)) 80%,transparent);text-align:center;} 
    .court-ledger strong{display:block;color:var(--ui-gold,var(--gold));font-family:var(--font-serif);font-size:16px;} 
    .court-ledger span{display:block;color:var(--ui-text-muted,var(--cream-dim));font-size:10px;margin-top:2px;} 
    .court-timeline{display:flex;flex-direction:column;gap:10px;margin:14px 0;} 
    .court-step{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid var(--ui-line,var(--border));border-radius:13px;background:color-mix(in srgb,var(--ui-surface-raised,var(--navy-card)) 80%,transparent);} 
    .court-step-num{min-width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--ui-gold,var(--gold)) 14%,transparent);border:1px solid var(--ui-line-strong,var(--border));color:var(--ui-gold,var(--gold));font-size:11px;font-weight:900;} 
    .court-step-title{font-size:13px;font-weight:900;color:var(--ui-text,var(--cream));} 
    .court-step-text{font-size:12px;color:var(--ui-text-muted,var(--cream-dim));line-height:1.6;margin-top:2px;} 
    .court-document{background:linear-gradient(180deg,color-mix(in srgb,var(--ui-surface-raised,var(--navy-card)) 92%,transparent),var(--ui-surface,var(--navy-card)));border:1.5px solid var(--ui-line-strong,var(--border));border-radius:18px;box-shadow:var(--ui-shadow,var(--shadow));color:var(--ui-text-main,var(--cream));} 
    .court-stamp{display:inline-block;border:2px solid var(--ui-danger,var(--red));color:var(--ui-danger,var(--red));font-family:var(--font-serif);font-weight:900;letter-spacing:.12em;border-radius:4px;padding:4px 12px;transform:rotate(-3deg);opacity:.9;} 
    .court-bench{height:10px;border-radius:99px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--ui-gold,var(--gold)) 55%,transparent),transparent);margin:8px auto 14px;max-width:280px;opacity:.5;} 
    .reaction-btn[data-picked="true"]{box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-gold,var(--gold)) 35%,transparent),0 8px 22px color-mix(in srgb,var(--ui-gold,var(--gold)) 12%,transparent);} 
    @media(max-width:420px){.court-ledger{grid-template-columns:1fr}.court-title{font-size:20px}}
  `;
  document.head.appendChild(style);
  import('./owner-polish.js?v=20260630-21').then(m => m.initOwnerPolish()).catch(() => {});
  import('./pwa-ui.js?v=20260630-23').then(m => m.initPwa()).catch(() => {});
  import('./admin-redirect.js?v=20260630-18').then(m => m.initAdminRedirect()).catch(() => {});
}
