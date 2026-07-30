import { renderDailyRealCourt as renderBaseDailyRealCourt } from './daily-real-court.js?v=20260730-daily-three-ranking-1';

function ensureDailyCourtLayoutStyle() {
  if (document.getElementById('daily-real-court-layout-style')) return;
  const style = document.createElement('style');
  style.id = 'daily-real-court-layout-style';
  style.textContent = `
    .container.daily-court-page {
      padding-top: 22px;
      padding-right: 20px;
      padding-bottom: 34px;
      padding-left: 20px;
    }
  `;
  document.head.appendChild(style);
}

export async function renderDailyRealCourt(container) {
  ensureDailyCourtLayoutStyle();
  await renderBaseDailyRealCourt(container);
}
