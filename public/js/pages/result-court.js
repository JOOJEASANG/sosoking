import { renderResult as renderBaseResult } from './result.js?v=20260727-simple-1';

export async function renderResult(container, caseId) {
  await renderBaseResult(container, caseId);
}
