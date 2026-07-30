import { renderTrial as renderBaseTrial } from './trial.js?v=20260729-dark-record-participation-1';

export async function renderTrial(container, caseId) {
  container.classList.add('trial-redesign-host');
  await renderBaseTrial(container, caseId);
}
