export function injectSosoStyle() {
  if (document.getElementById('sosoking-predict-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-predict-style';
  style.textContent = `:root{--predict-bg:#f5f7fb;--predict-ink:#121724;--predict-muted:#697386;--predict-card:#fff;--predict-line:#e5eaf2;--predict-main:#4f7cff;--predict-hot:#ff5c7a;--predict-money:#16a36a}[data-theme="dark"]{--predict-bg:#070b13;--predict-ink:#eef4ff;--predict-muted:#8f9bb1;--predict-card:#101722;--predict-line:#243044;--predict-main:#72a2ff;--predict-hot:#ff6d88}.predict-app{min-height:100vh;background:var(--predict-bg);color:var(--predict-ink);padding-bottom:88px;font-family:var(--font-sans)}.section-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px}.section-head span{color:var(--predict-main);font-size:10px;font-weight:1000;letter-spacing:.08em}.section-head h2{margin:4px 0 0;font-size:24px;letter-spacing:-.05em}.section-head a{color:var(--predict-main);font-weight:900;text-decoration:none}`;
  document.head.appendChild(style);
}

export const injectPredictStyle = injectSosoStyle;
