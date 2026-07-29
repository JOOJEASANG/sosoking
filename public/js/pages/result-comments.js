import { renderResult as renderStyledResult } from './result-court.js?v=20260729-dark-record-participation-1';

function stripJuryVote(container) {
  const reactionButton = container.querySelector('.reaction-btn');
  reactionButton?.closest('.card')?.remove();
  container.querySelector('.result-audience-title')?.remove();
}

export async function renderResult(container, caseId) {
  await renderStyledResult(container, caseId);
  stripJuryVote(container);
}
