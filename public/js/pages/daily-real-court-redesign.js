import { renderDailyRealCourt as renderBaseDailyRealCourt } from './daily-real-court-layout.js?v=20260730-home-layout-route-1';

export async function renderDailyRealCourt(container) {
  container.classList.add('daily-redesign-host');
  await renderBaseDailyRealCourt(container);
}
