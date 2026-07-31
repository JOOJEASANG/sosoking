import { renderTrial as renderBaseTrial } from './trial.js?v=20260731-judge-trial-progress-1';

export async function renderTrial(container, caseId) {
  await renderBaseTrial(container, caseId);
}
