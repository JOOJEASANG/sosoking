import { renderTrial as renderBaseTrial } from './trial.js?v=20260810-current-judges-1';

export async function renderTrial(container, caseId) {
  await renderBaseTrial(container, caseId);
}
