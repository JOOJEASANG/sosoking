import { renderMyCases as renderBaseMyCases } from './my-cases-game.js?v=20260729-dark-record-participation-1';

export async function renderMyCases(container) {
  container.classList.add('my-cases-redesign-host');
  await renderBaseMyCases(container);
}
