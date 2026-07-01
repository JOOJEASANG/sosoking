export function initCourtDesign() {
  if (document.getElementById('court-design-style')) return;
  const style = document.createElement('style');
  style.id = 'court-design-style';
  style.textContent = `
    body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:-1;background:radial-gradient(circle at 50% -10%,rgba(201,168,76,.16),transparent 34%),linear-gradient(180deg,rgba(80,18,18,.08),transparent 38%);} 
    .court-shell{position:relative;overflow:hidden;border:1px solid rgba(201,168,76,.38);border-radius:18px;background:linear-gradient(145deg,rgba(26,32,53,.96),rgba(13,17,23,.94));box-shadow:0 12px 38px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.06);} 
    .court-shell::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(201,168,76,.08),transparent);opacity:.45;pointer-events:none;} 
    .court-kicker{font-size:10px;color:var(--gold);font-weight:900;letter-spacing:.18em;text-transform:uppercase;} 
    .court-title{font-family:var(--font-serif);font-size:22px;font-weight:900;line-height:1.42;color:var(--cream);} 
    .court-desc{font-size:13px;color:var(--cream-dim);line-height:1.75;} 
    .court-seal{display:inline-flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:50%;border:2px solid rgba(201,168,76,.7);color:var(--gold);background:radial-gradient(circle,rgba(201,168,76,.16),rgba(201,168,76,.03));font-size:30px;box-shadow:inset 0 0 0 5px rgba(201,168,76,.05);} 
    .court-ledger{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;} 
    .court-ledger div{border:1px solid rgba(201,168,76,.22);border-radius:12px;padding:10px 8px;background:rgba(255,255,255,.035);text-align:center;} 
    .court-ledger strong{display:block;color:var(--gold);font-family:var(--font-serif);font-size:16px;} 
    .court-ledger span{display:block;color:var(--cream-dim);font-size:10px;margin-top:2px;} 
    .court-timeline{display:flex;flex-direction:column;gap:10px;margin:14px 0;} 
    .court-step{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid rgba(201,168,76,.2);border-radius:13px;background:rgba(255,255,255,.028);} 
    .court-step-num{min-width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--gold-dim);border:1px solid rgba(201,168,76,.45);color:var(--gold);font-size:11px;font-weight:900;} 
    .court-step-title{font-size:13px;font-weight:900;color:var(--cream);} 
    .court-step-text{font-size:12px;color:var(--cream-dim);line-height:1.6;margin-top:2px;} 
    .court-document{background:linear-gradient(180deg,rgba(255,255,255,.048),rgba(255,255,255,.022));border:1.5px solid rgba(201,168,76,.45);border-radius:18px;box-shadow:0 10px 34px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.08);} 
    .court-stamp{display:inline-block;border:2px solid var(--red);color:var(--red);font-family:var(--font-serif);font-weight:900;letter-spacing:.12em;border-radius:4px;padding:4px 12px;transform:rotate(-3deg);opacity:.9;} 
    .court-bench{height:10px;border-radius:99px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.55),transparent);margin:8px auto 14px;max-width:280px;opacity:.5;} 
    .reaction-btn[data-picked="true"]{box-shadow:0 0 0 2px rgba(201,168,76,.35),0 8px 22px rgba(201,168,76,.12);} 
    @media(max-width:420px){.court-ledger{grid-template-columns:1fr}.court-title{font-size:20px}}
    [data-theme="light"] .court-shell{background:linear-gradient(145deg,#fffaf1,#f4eadb);box-shadow:0 10px 24px rgba(60,42,10,.1),inset 0 1px 0 rgba(255,255,255,.9);} 
    [data-theme="light"] .court-document{background:#fffaf1;}
  `;
  document.head.appendChild(style);
  import('./contrast-fix.js?v=20260630-19').then(m => m.initContrastFix()).catch(() => {});
  import('./pwa-ui.js?v=20260630-16').then(m => m.initPwa()).catch(() => {});
  import('./admin-redirect.js?v=20260630-18').then(m => m.initAdminRedirect()).catch(() => {});
}
