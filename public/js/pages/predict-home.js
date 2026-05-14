// Compatibility style injector used by older page modules.
// The current Sosoking app is feed-first, but account/auth/feedback pages still import this helper.

export function injectPredictStyle() {
  if (document.getElementById('sosoking-predict-compat-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-predict-compat-style';
  style.textContent = `
    :root{
      --predict-bg:#f5f7fb;
      --predict-card:#ffffff;
      --predict-ink:#121724;
      --predict-muted:#697386;
      --predict-main:#4f7cff;
      --predict-hot:#ff5c8a;
      --predict-money:#10b981;
      --gold:#f59e0b;
      --red:#ef4444;
      --border:rgba(79,124,255,.14);
      --cream:#121724;
      --cream-dim:#697386;
    }
    [data-theme="dark"]{
      --predict-bg:#0f1726;
      --predict-card:#101722;
      --predict-ink:#f5f7fb;
      --predict-muted:#a8b3c7;
      --predict-main:#7ea2ff;
      --predict-hot:#ff7aa4;
      --predict-money:#34d399;
      --gold:#fbbf24;
      --red:#fb7185;
      --border:rgba(255,255,255,.12);
      --cream:#f5f7fb;
      --cream-dim:#a8b3c7;
    }
    .predict-app{min-height:100vh;background:var(--predict-bg);color:var(--predict-ink);font-family:'Noto Sans KR',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-sizing:border-box;}
    .predict-app *{box-sizing:border-box;}
    .back-link{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:16px;background:rgba(79,124,255,.09);color:var(--predict-main);text-decoration:none;font-size:28px;font-weight:900;}
    .card{background:var(--predict-card);border:1px solid var(--border);box-shadow:0 18px 54px rgba(55,90,170,.10);}
    [data-theme="dark"] .card{box-shadow:none;}
    button,input,textarea,select{font-family:inherit;}
    button{cursor:pointer;}
    button:disabled{opacity:.55;cursor:not-allowed;}
  `;
  document.head.appendChild(style);
}

export function renderPredictHome(container) {
  injectPredictStyle();
  container.innerHTML = `
    <main class="predict-app" style="display:flex;align-items:center;justify-content:center;padding:28px;">
      <section class="card" style="max-width:460px;width:100%;padding:28px;border-radius:28px;text-align:center;">
        <img src="/logo.svg" alt="소소킹" style="width:76px;height:76px;border-radius:24px;margin-bottom:14px;background:#fff;">
        <h1 style="margin:0 0 8px;font-size:26px;letter-spacing:-.05em;">소소킹</h1>
        <p style="margin:0 0 18px;color:var(--predict-muted);line-height:1.65;">사진, 글, 퀴즈, 밸런스게임이 모이는 소소피드입니다.</p>
        <a href="#/feed" style="display:inline-flex;padding:13px 16px;border-radius:18px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;text-decoration:none;font-weight:900;">피드 구경하기</a>
      </section>
    </main>
  `;
}
