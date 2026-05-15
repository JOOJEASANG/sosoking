const ACCOUNT_PREMIUM_STYLE_ID = 'sosoking-account-premium-ui-patch';
let scheduled = false;

function injectAccountPremiumStyle() {
  if (document.getElementById(ACCOUNT_PREMIUM_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ACCOUNT_PREMIUM_STYLE_ID;
  style.textContent = `
    @media (min-width: 901px) {
      body.soso-mode-pc.soso-route-account .account-page {
        --acc-ink: #11172f;
        --acc-muted: #6b7280;
        --acc-line: rgba(104,121,255,.14);
        --acc-card: rgba(255,255,255,.86);
        --acc-shadow: 0 22px 70px rgba(43,61,130,.11);
        padding-top: 24px !important;
        background:
          radial-gradient(circle at 9% 0%, rgba(255,232,92,.22), transparent 28%),
          radial-gradient(circle at 88% 4%, rgba(124,92,255,.16), transparent 32%),
          linear-gradient(180deg, #fbfcff 0%, #f4f7ff 100%) !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero,
      body.soso-mode-pc.soso-route-account .account-layout {
        max-width: 1500px !important;
        width: 100% !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero {
        min-height: 190px !important;
        display: grid !important;
        grid-template-columns: 56px minmax(0, 1fr) 180px !important;
        gap: 16px !important;
        align-items: stretch !important;
        margin-bottom: 18px !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero .back-link {
        width: 56px !important;
        height: 56px !important;
        border-radius: 20px !important;
        align-self: start !important;
        margin-top: 10px !important;
        background: rgba(255,255,255,.82) !important;
        border: 1px solid var(--acc-line) !important;
        box-shadow: 0 12px 30px rgba(43,61,130,.08) !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero-copy {
        position: relative !important;
        min-height: 190px !important;
        align-items: center !important;
        padding: 30px 34px !important;
        border-radius: 36px !important;
        border: 1px solid var(--acc-line) !important;
        background:
          linear-gradient(135deg, rgba(255,255,255,.94), rgba(255,255,255,.72)),
          radial-gradient(circle at 12% 10%, rgba(255,232,92,.35), transparent 28%),
          radial-gradient(circle at 92% 72%, rgba(255,92,138,.13), transparent 32%) !important;
        box-shadow: var(--acc-shadow) !important;
        overflow: hidden !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero-copy:after {
        content: 'MY SOSOKING';
        position: absolute;
        right: 30px;
        bottom: 20px;
        color: rgba(79,124,255,.08);
        font-size: 58px;
        font-weight: 1000;
        letter-spacing: -.08em;
        pointer-events: none;
      }

      body.soso-mode-pc.soso-route-account .account-hero-copy img {
        width: 82px !important;
        height: 82px !important;
        border-radius: 28px !important;
        box-shadow: 0 18px 44px rgba(79,124,255,.18) !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero-copy span {
        display: inline-flex !important;
        padding: 8px 11px !important;
        border-radius: 999px !important;
        background: rgba(124,92,255,.09) !important;
        color: #6d38ff !important;
        font-size: 11px !important;
        font-weight: 1000 !important;
        letter-spacing: .14em !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero-copy h1 {
        margin: 12px 0 8px !important;
        font-size: clamp(42px, 3.7vw, 64px) !important;
        line-height: .98 !important;
        letter-spacing: -.085em !important;
        color: var(--acc-ink) !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero-copy p {
        max-width: 620px !important;
        font-size: 15px !important;
        line-height: 1.7 !important;
        color: var(--acc-muted) !important;
      }

      body.soso-mode-pc.soso-route-account .account-hero > b {
        min-width: 0 !important;
        border-radius: 36px !important;
        background:
          linear-gradient(135deg, #151a33, #263c8f 55%, #7c5cff) !important;
        color: #fff !important;
        box-shadow: 0 22px 70px rgba(43,61,130,.14) !important;
        font-size: 48px !important;
      }

      body.soso-mode-pc.soso-route-account .account-layout {
        display: grid !important;
        grid-template-columns: 360px minmax(0, 1fr) !important;
        gap: 18px !important;
        align-items: start !important;
      }

      body.soso-mode-pc.soso-route-account .account-summary-card {
        position: sticky !important;
        top: 96px !important;
        min-height: 580px !important;
        padding: 24px !important;
        border-radius: 36px !important;
        border: 1px solid var(--acc-line) !important;
        background:
          linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.78)),
          radial-gradient(circle at 50% 0%, rgba(255,232,92,.34), transparent 32%) !important;
        box-shadow: var(--acc-shadow) !important;
        text-align: left !important;
        overflow: hidden !important;
      }

      body.soso-mode-pc.soso-route-account .account-summary-card:before {
        content: '' !important;
        position: absolute !important;
        left: 22px !important;
        right: 22px !important;
        top: 22px !important;
        height: 150px !important;
        border-radius: 30px !important;
        background: linear-gradient(135deg, #ffe85c, #ff9f43 38%, #ff5c8a 68%, #7c5cff) !important;
        opacity: .92 !important;
        z-index: 0 !important;
      }

      body.soso-mode-pc.soso-route-account .account-summary-card > * {
        position: relative !important;
        z-index: 1 !important;
      }

      body.soso-mode-pc.soso-route-account .account-summary-card img {
        width: 94px !important;
        height: 94px !important;
        margin-top: 72px !important;
        border-radius: 32px !important;
        border: 6px solid #fff !important;
        background: #fff !important;
        box-shadow: 0 18px 44px rgba(43,61,130,.16) !important;
      }

      body.soso-mode-pc.soso-route-account .account-summary-card b {
        margin-top: 18px !important;
        font-size: 28px !important;
        line-height: 1.18 !important;
        letter-spacing: -.06em !important;
        color: var(--acc-ink) !important;
      }

      body.soso-mode-pc.soso-route-account .account-summary-card span {
        margin-top: 10px !important;
        padding: 8px 11px !important;
        border-radius: 999px !important;
        background: rgba(124,92,255,.09) !important;
        color: #6d38ff !important;
      }

      body.soso-mode-pc.soso-route-account .account-summary-card p {
        min-height: 40px !important;
        color: var(--acc-muted) !important;
        font-weight: 800 !important;
      }

      body.soso-mode-pc.soso-route-account .account-premium-stats {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 10px !important;
        margin: 18px 0 !important;
      }

      body.soso-mode-pc.soso-route-account .account-premium-stats div {
        padding: 14px !important;
        border-radius: 20px !important;
        background: rgba(79,124,255,.06) !important;
        border: 1px solid rgba(79,124,255,.10) !important;
      }

      body.soso-mode-pc.soso-route-account .account-premium-stats strong {
        display: block !important;
        font-size: 20px !important;
        color: var(--acc-ink) !important;
        letter-spacing: -.04em !important;
      }

      body.soso-mode-pc.soso-route-account .account-premium-stats small {
        display: block !important;
        margin-top: 4px !important;
        color: var(--acc-muted) !important;
        font-size: 11px !important;
        font-weight: 900 !important;
      }

      body.soso-mode-pc.soso-route-account .account-summary-card a {
        width: 100% !important;
        height: 52px !important;
        margin-top: 8px !important;
        border-radius: 18px !important;
        background: linear-gradient(135deg, #ff7a59, #ff5c8a, #7c5cff) !important;
        box-shadow: 0 18px 44px rgba(255,92,138,.22) !important;
      }

      body.soso-mode-pc.soso-route-account .account-panels {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 16px !important;
      }

      body.soso-mode-pc.soso-route-account .account-card {
        min-height: 245px !important;
        padding: 24px !important;
        border-radius: 30px !important;
        border: 1px solid var(--acc-line) !important;
        background: var(--acc-card) !important;
        box-shadow: 0 18px 54px rgba(43,61,130,.08) !important;
        backdrop-filter: blur(18px) saturate(1.15) !important;
      }

      body.soso-mode-pc.soso-route-account .account-card:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 24px 70px rgba(43,61,130,.12) !important;
      }

      body.soso-mode-pc.soso-route-account .account-card-head span {
        display: inline-flex !important;
        padding: 7px 9px !important;
        border-radius: 999px !important;
        background: rgba(79,124,255,.08) !important;
      }

      body.soso-mode-pc.soso-route-account .account-card-head h2 {
        margin: 10px 0 7px !important;
        font-size: 25px !important;
        line-height: 1.18 !important;
        letter-spacing: -.06em !important;
      }

      body.soso-mode-pc.soso-route-account .account-card-head p {
        font-size: 13px !important;
        line-height: 1.65 !important;
      }

      body.soso-mode-pc.soso-route-account .account-card input,
      body.soso-mode-pc.soso-route-account .account-card .delete-confirm-row {
        min-height: 48px !important;
        border-radius: 17px !important;
        background: rgba(255,255,255,.72) !important;
      }

      body.soso-mode-pc.soso-route-account .account-card button {
        min-height: 48px !important;
        border-radius: 17px !important;
      }

      body.soso-mode-pc.soso-route-account .delete-zone {
        grid-column: 1 / -1 !important;
        min-height: 210px !important;
        background: linear-gradient(135deg, rgba(255,255,255,.9), rgba(255,92,138,.055)) !important;
      }
    }

    @media (max-width: 900px) {
      body.soso-mode-mobile.soso-route-account .account-page {
        padding: 12px 12px 112px !important;
        max-width: 540px !important;
        background: linear-gradient(180deg, #fffaf0 0%, #f5f7ff 100%) !important;
      }

      body.soso-mode-mobile.soso-route-account .account-hero {
        display: block !important;
        margin-bottom: 12px !important;
      }

      body.soso-mode-mobile.soso-route-account .account-hero .back-link {
        width: 44px !important;
        height: 44px !important;
        margin-bottom: 10px !important;
        border-radius: 16px !important;
        background: #fff !important;
        box-shadow: 0 10px 24px rgba(43,61,130,.08) !important;
      }

      body.soso-mode-mobile.soso-route-account .account-hero-copy {
        display: block !important;
        padding: 22px !important;
        border-radius: 30px !important;
        background:
          linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,248,224,.86)),
          radial-gradient(circle at 80% 0%, rgba(124,92,255,.16), transparent 34%) !important;
        box-shadow: 0 16px 46px rgba(55,90,170,.12) !important;
      }

      body.soso-mode-mobile.soso-route-account .account-hero-copy img {
        width: 66px !important;
        height: 66px !important;
        border-radius: 24px !important;
        margin-bottom: 12px !important;
      }

      body.soso-mode-mobile.soso-route-account .account-hero-copy h1 {
        margin: 8px 0 6px !important;
        font-size: 34px !important;
        line-height: 1.05 !important;
        letter-spacing: -.075em !important;
      }

      body.soso-mode-mobile.soso-route-account .account-hero-copy p {
        font-size: 13px !important;
        line-height: 1.65 !important;
      }

      body.soso-mode-mobile.soso-route-account .account-layout {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
      }

      body.soso-mode-mobile.soso-route-account .account-summary-card {
        position: relative !important;
        top: auto !important;
        display: grid !important;
        grid-template-columns: 72px minmax(0, 1fr) !important;
        gap: 14px !important;
        align-items: center !important;
        padding: 18px !important;
        border-radius: 28px !important;
        text-align: left !important;
        background: rgba(255,255,255,.92) !important;
        box-shadow: 0 14px 40px rgba(55,90,170,.10) !important;
      }

      body.soso-mode-mobile.soso-route-account .account-summary-card img {
        width: 72px !important;
        height: 72px !important;
        margin: 0 !important;
        border-radius: 24px !important;
        grid-row: span 4 !important;
      }

      body.soso-mode-mobile.soso-route-account .account-summary-card b {
        margin: 0 !important;
        font-size: 21px !important;
        line-height: 1.2 !important;
      }

      body.soso-mode-mobile.soso-route-account .account-summary-card span {
        width: max-content !important;
        margin-top: 4px !important;
        font-size: 11px !important;
      }

      body.soso-mode-mobile.soso-route-account .account-summary-card p {
        margin: 3px 0 0 !important;
        font-size: 12px !important;
      }

      body.soso-mode-mobile.soso-route-account .account-premium-stats {
        grid-column: 1 / -1 !important;
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
        margin: 8px 0 0 !important;
      }

      body.soso-mode-mobile.soso-route-account .account-premium-stats div {
        padding: 12px !important;
        border-radius: 18px !important;
        background: rgba(79,124,255,.06) !important;
      }

      body.soso-mode-mobile.soso-route-account .account-premium-stats strong {
        display: block !important;
        font-size: 17px !important;
      }

      body.soso-mode-mobile.soso-route-account .account-premium-stats small {
        display: block !important;
        font-size: 10px !important;
        color: #667085 !important;
        font-weight: 900 !important;
      }

      body.soso-mode-mobile.soso-route-account .account-summary-card a {
        grid-column: 1 / -1 !important;
        height: 48px !important;
        margin-top: 8px !important;
        border-radius: 17px !important;
        background: linear-gradient(135deg, #ff7a59, #ff5c8a, #7c5cff) !important;
      }

      body.soso-mode-mobile.soso-route-account .account-panels {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
      }

      body.soso-mode-mobile.soso-route-account .account-card {
        min-height: 0 !important;
        padding: 18px !important;
        border-radius: 26px !important;
        background: rgba(255,255,255,.92) !important;
        box-shadow: 0 13px 36px rgba(55,90,170,.09) !important;
      }

      body.soso-mode-mobile.soso-route-account .account-card-head h2 {
        font-size: 21px !important;
      }

      body.soso-mode-mobile.soso-route-account .account-row {
        grid-template-columns: 1fr !important;
      }

      body.soso-mode-mobile.soso-route-account .account-card button,
      body.soso-mode-mobile.soso-route-account .account-card input {
        min-height: 48px !important;
      }
    }

    .account-premium-shortcuts {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 12px;
    }

    .account-premium-shortcuts a {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      height: 48px !important;
      padding: 0 14px !important;
      border-radius: 17px !important;
      background: rgba(79,124,255,.07) !important;
      color: #11172f !important;
      box-shadow: none !important;
      font-size: 13px !important;
      text-decoration: none !important;
    }

    .account-premium-shortcuts a:after { content: '›'; font-size: 20px; color: #7c5cff; }

    [data-theme="dark"] body.soso-route-account .account-page {
      background: #080d17 !important;
    }
    [data-theme="dark"] body.soso-route-account .account-hero-copy,
    [data-theme="dark"] body.soso-route-account .account-summary-card,
    [data-theme="dark"] body.soso-route-account .account-card {
      background: rgba(16,23,34,.88) !important;
      border-color: rgba(255,255,255,.10) !important;
      box-shadow: none !important;
    }
    [data-theme="dark"] body.soso-route-account .account-hero-copy h1,
    [data-theme="dark"] body.soso-route-account .account-summary-card b,
    [data-theme="dark"] body.soso-route-account .account-card-head h2,
    [data-theme="dark"] .account-premium-shortcuts a {
      color: #f5f7fb !important;
    }
    [data-theme="dark"] body.soso-route-account .account-summary-card p,
    [data-theme="dark"] body.soso-route-account .account-hero-copy p,
    [data-theme="dark"] body.soso-route-account .account-card-head p {
      color: #a8b3c7 !important;
    }
  `;
  document.head.appendChild(style);
}

function enhanceAccountPage() {
  injectAccountPremiumStyle();
  const page = document.querySelector('.account-page');
  if (!page) return;
  const summary = page.querySelector('.account-summary-card');
  if (summary && summary.dataset.premiumUi !== '1') {
    summary.dataset.premiumUi = '1';
    const makeLink = summary.querySelector('a[href="#/feed/new"]');
    const stats = document.createElement('div');
    stats.className = 'account-premium-stats';
    stats.innerHTML = `
      <div><strong>Lv.1</strong><small>새싹 소소러</small></div>
      <div><strong>0 P</strong><small>소소포인트 준비중</small></div>
      <div><strong>0</strong><small>내가 만든 피드</small></div>
      <div><strong>0</strong><small>미션 완료</small></div>`;
    if (makeLink) summary.insertBefore(stats, makeLink);
    else summary.appendChild(stats);

    const shortcuts = document.createElement('div');
    shortcuts.className = 'account-premium-shortcuts';
    shortcuts.innerHTML = `
      <a href="#/feed">내 활동 피드 보기</a>
      <a href="#/mission">오늘의 미션 확인</a>`;
    summary.appendChild(shortcuts);
  }

  page.querySelectorAll('.account-card-head h2').forEach(h2 => {
    const map = {
      '닉네임 변경': '닉네임 관리',
      '비밀번호 변경': '보안 설정',
      '비밀번호 재설정 메일': '비밀번호 재설정',
      '소소킹 앱 설치': '앱 설치',
      '회원 탈퇴': '계정 삭제'
    };
    if (map[h2.textContent.trim()]) h2.textContent = map[h2.textContent.trim()];
  });

  const heroTitle = page.querySelector('.account-hero-copy h1');
  if (heroTitle && heroTitle.textContent.includes('내정보 수정')) heroTitle.textContent = '마이 소소킹';
  const heroDesc = page.querySelector('.account-hero-copy p');
  if (heroDesc && heroDesc.textContent.includes('닉네임')) heroDesc.textContent = '내 프로필, 보안, 앱 설치, 계정 설정을 한곳에서 관리합니다.';
}

function scheduleAccountPatch() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhanceAccountPage();
  });
}

new MutationObserver(scheduleAccountPatch).observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleAccountPatch);
else scheduleAccountPatch();
window.addEventListener('hashchange', () => setTimeout(scheduleAccountPatch, 40));
window.addEventListener('resize', () => setTimeout(scheduleAccountPatch, 80));
setTimeout(scheduleAccountPatch, 0);
setTimeout(scheduleAccountPatch, 400);
setTimeout(scheduleAccountPatch, 1200);
