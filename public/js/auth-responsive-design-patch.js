const AUTH_RESPONSIVE_STYLE_ID = 'sosoking-auth-responsive-design-patch';

function injectAuthResponsiveStyle() {
  if (document.getElementById(AUTH_RESPONSIVE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = AUTH_RESPONSIVE_STYLE_ID;
  style.textContent = `
    @media (min-width: 901px) {
      html body .simple-auth-page {
        width: 100vw !important;
        max-width: none !important;
        min-height: calc(100vh - 78px) !important;
        margin-left: calc(50% - 50vw) !important;
        margin-right: calc(50% - 50vw) !important;
        padding: 34px max(clamp(28px, 3vw, 56px), calc((100vw - 1500px) / 2)) 70px !important;
        box-sizing: border-box !important;
        background:
          radial-gradient(circle at 8% 4%, rgba(255,232,92,.28), transparent 24%),
          radial-gradient(circle at 80% 2%, rgba(124,92,255,.16), transparent 30%),
          linear-gradient(180deg, #fbfcff 0%, #f5f7ff 100%) !important;
      }

      html body .simple-auth-page .auth-simple-shell {
        width: 100% !important;
        max-width: 1500px !important;
        min-height: min(720px, calc(100vh - 160px)) !important;
        margin: 0 auto !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) clamp(410px, 32vw, 520px) !important;
        gap: clamp(26px, 3vw, 56px) !important;
        align-items: stretch !important;
        position: relative !important;
      }

      html body .simple-auth-page .auth-simple-shell::before {
        content: '';
        display: block;
        border-radius: 38px;
        background:
          linear-gradient(135deg, rgba(255,255,255,.90), rgba(255,255,255,.60)),
          radial-gradient(circle at 28% 25%, rgba(255,232,92,.42), transparent 28%),
          radial-gradient(circle at 72% 65%, rgba(124,92,255,.20), transparent 30%);
        border: 1px solid rgba(104,121,255,.13);
        box-shadow: 0 22px 70px rgba(43,61,130,.10);
        grid-column: 1;
        grid-row: 1;
      }

      html body .simple-auth-page .auth-simple-shell::after {
        content: '소소한 재미를\A함께 만드는 공간';
        white-space: pre-line;
        position: absolute;
        left: clamp(38px, 4vw, 70px);
        top: clamp(44px, 5vw, 84px);
        width: min(520px, 42vw);
        color: #0b1240;
        font-size: clamp(46px, 4.4vw, 76px);
        line-height: 1.04;
        letter-spacing: -.09em;
        font-weight: 1000;
        pointer-events: none;
      }

      html body .simple-auth-page .auth-back {
        position: absolute !important;
        left: 20px !important;
        top: 20px !important;
        z-index: 5 !important;
        width: 46px !important;
        height: 46px !important;
        display: grid !important;
        place-items: center !important;
        border-radius: 16px !important;
        background: rgba(255,255,255,.86) !important;
        border: 1px solid rgba(104,121,255,.13) !important;
        box-shadow: 0 10px 26px rgba(43,61,130,.08) !important;
      }

      html body .simple-auth-page .auth-simple-card {
        grid-column: 2 !important;
        grid-row: 1 !important;
        align-self: center !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: clamp(24px, 2.2vw, 34px) !important;
        border-radius: 34px !important;
        background: rgba(255,255,255,.96) !important;
        border: 1px solid rgba(104,121,255,.13) !important;
        box-shadow: 0 24px 78px rgba(43,61,130,.14) !important;
        backdrop-filter: blur(22px) saturate(1.15) !important;
        box-sizing: border-box !important;
      }

      html body .simple-auth-page .auth-simple-brand {
        text-align: left !important;
        margin-bottom: 20px !important;
      }

      html body .simple-auth-page .auth-simple-brand img {
        width: 72px !important;
        height: 72px !important;
        border-radius: 24px !important;
      }

      html body .simple-auth-page .auth-simple-brand span {
        margin-left: 10px !important;
        vertical-align: middle !important;
      }

      html body .simple-auth-page .auth-simple-brand h1 {
        margin-top: 16px !important;
        font-size: clamp(34px, 2.7vw, 46px) !important;
        line-height: 1.08 !important;
        letter-spacing: -.085em !important;
      }

      html body .simple-auth-page .auth-simple-brand p {
        font-size: 15px !important;
        line-height: 1.65 !important;
        max-width: 380px !important;
      }

      html body .simple-auth-page .auth-panel-v2 {
        gap: 12px !important;
      }

      html body .simple-auth-page .google-btn-v2,
      html body .simple-auth-page .guest-btn-v2,
      html body .simple-auth-page .auth-form-v2 > button,
      html body .simple-auth-page .modal-save-btn {
        min-height: 52px !important;
        font-size: 15px !important;
      }

      html body .simple-auth-page .auth-form-v2 {
        gap: 10px !important;
      }

      html body .simple-auth-page .auth-form-v2 input {
        min-height: 52px !important;
        border-radius: 18px !important;
        font-size: 15px !important;
        padding: 0 16px !important;
      }

      html body .simple-auth-page .auth-simple-links {
        justify-content: flex-start !important;
        gap: 12px !important;
        margin-top: 4px !important;
      }

      html body .simple-auth-page .auth-simple-links button {
        font-size: 13px !important;
      }

      html body .simple-auth-page .auth-sub-panel {
        margin-top: 8px !important;
        padding-top: 18px !important;
      }

      html body .simple-auth-page .auth-sub-head b {
        font-size: 24px !important;
      }

      html body .simple-auth-page .password-box {
        padding: 16px !important;
        border-radius: 22px !important;
      }
    }

    @media (min-width: 901px) and (max-width: 1180px) {
      html body .simple-auth-page .auth-simple-shell {
        grid-template-columns: minmax(0, .9fr) 430px !important;
        gap: 24px !important;
      }
      html body .simple-auth-page .auth-simple-shell::after {
        font-size: clamp(38px, 4.1vw, 56px) !important;
        width: 40vw !important;
      }
    }

    @media (max-width: 900px) {
      html body .simple-auth-page {
        width: 100% !important;
        max-width: 560px !important;
        margin: 0 auto !important;
        padding: 10px 12px 104px !important;
        box-sizing: border-box !important;
      }
      html body .simple-auth-page .auth-simple-shell {
        width: min(398px, 100%) !important;
        margin: 0 auto !important;
        display: block !important;
      }
      html body .simple-auth-page .auth-simple-card {
        margin-top: 12px !important;
      }
    }

    [data-theme="dark"] body .simple-auth-page .auth-simple-shell::before {
      background:
        linear-gradient(135deg, rgba(16,23,34,.96), rgba(16,23,34,.70)),
        radial-gradient(circle at 28% 25%, rgba(124,92,255,.24), transparent 28%),
        radial-gradient(circle at 72% 65%, rgba(255,92,138,.16), transparent 30%) !important;
      border-color: rgba(255,255,255,.10) !important;
      box-shadow: none !important;
    }
    [data-theme="dark"] body .simple-auth-page .auth-simple-shell::after {
      color: #f5f7fb !important;
    }
  `;
  document.head.appendChild(style);
}

function patchAuthPage() {
  injectAuthResponsiveStyle();
  const authPage = document.querySelector('.simple-auth-page');
  document.body.classList.toggle('soso-auth-page-active', Boolean(authPage));
}

const observer = new MutationObserver(patchAuthPage);
observer.observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchAuthPage);
else patchAuthPage();

setTimeout(patchAuthPage, 0);
setTimeout(patchAuthPage, 250);
setTimeout(patchAuthPage, 1000);
window.addEventListener('hashchange', () => setTimeout(patchAuthPage, 50));
window.addEventListener('resize', () => setTimeout(patchAuthPage, 80));
