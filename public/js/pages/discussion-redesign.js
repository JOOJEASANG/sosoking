import { renderDiscussion as renderBaseDiscussion } from './discussion.js?v=20260730-discussion-court-1';

export async function renderDiscussion(container, caseId) {
  container.classList.add('discussion-redesign-host');
  await renderBaseDiscussion(container, caseId);
}
