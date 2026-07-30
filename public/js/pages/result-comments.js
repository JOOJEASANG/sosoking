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
  notice.style.cssText = 'margin:0 0 16px;padding:15px 17px;border:1px dashed rgba(201,168,76,.65);border-radius:14px;background:rgba(201,168,76,.1);font-size:13px;line-height:1.75;color:var(--cream);text-align:center;';
  notice.innerHTML = '<strong style="color:var(--gold);">🎭 진지한 형식으로 즐기는 오락형 생활법정</strong><br>사건의 상황과 판결 내용을 읽는 AI 창작물이며, 실제 법률 판단이나 법적 효력은 없습니다.';
  cover.insertAdjacentElement('afterend', notice);
}

export async function renderResult(container, caseId) {
  await renderStyledResult(container, caseId);
  stripJuryVote(container);
  addEntertainmentNotice(container);
}
