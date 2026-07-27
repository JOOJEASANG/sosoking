import { renderTrial as renderBaseTrial } from './trial.js?v=20260728-audit-1';

export async function renderTrial(container, caseId) {
  await renderBaseTrial(container, caseId);
}
