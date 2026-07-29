import { renderTrial as renderBaseTrial } from './trial.js?v=20260729-dark-record-participation-1';

export async function renderTrial(container, caseId) {
  await renderBaseTrial(container, caseId);
}
