import { renderResult as renderStyledResult } from './result-court.js?v=20260729-dark-record-participation-1';

function stripJuryVote(container) {
  const reactionButton = container.querySelector('.reaction-btn');
  reactionButton?.closest('.card')?.remove();
  container.querySelector('.result-audience-title')?.remove();
}

function addEntertainmentNotice(container) {
  const cover = container.querySelector('.result-cover');
  if (!cover || container.querySelector('.result-comedy-notice')) return;

  const notice = document.createElement('div');
  notice.className = 'result-comedy-notice';
  notice.setAttribute('role', 'note');
  notice.innerHTML = '<strong>🎭 진지한 형식으로 즐기는 오락형 생활법정</strong><br>사건의 상황과 판결 내용을 읽는 AI 창작물이며, 실제 법률 판단이나 법적 효력은 없습니다.';
  cover.insertAdjacentElement('afterend', notice);
}

function addDiscussionLink(container, caseId) {
  if (!container.querySelector('#court-comment-input')) return;
  const actions = container.querySelector('.result-actions');
  if (!actions || actions.querySelector('[data-discussion-link]')) return;

  const link = document.createElement('a');
  link.href = `#/discussion/${encodeURIComponent(caseId)}`;
  link.className = 'btn btn-primary';
  link.dataset.discussionLink = 'true';
  link.textContent = '💬 이 판결로 토론하기';
  actions.prepend(link);
}

export async function renderResult(container, caseId) {
  container.classList.add('result-redesign-host');
  await renderStyledResult(container, caseId);
  stripJuryVote(container);
  addEntertainmentNotice(container);
  addDiscussionLink(container, caseId);
}
