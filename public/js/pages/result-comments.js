import { renderResult as renderStyledResult } from './result-court.js?v=20260729-dark-record-participation-1';

const STAGE_COMEDY = [
  ['사건접수', '사소한 일이 정식 사건번호를 받는 순간입니다. 이제 리모컨도 참고인 신분을 피하기 어렵습니다.'],
  ['수사보고', '물건·시간·표정·빈자리가 모두 증거석에 앉았습니다. 사물에게 묵비권은 아직 없습니다.'],
  ['원고측 변론', '억울함이 확대 재생되는 구간입니다. 간식권과 소파 점유권도 엄숙하게 심리합니다.'],
  ['피고측 변론', '변명이 법정에 도착했습니다. 논리가 신발끈을 묶는 동안 재판부가 잠시 기다립니다.'],
  ['재판부 판결', '진지한 표정으로 황당하지만 실행 가능한 생활형 처분을 선고합니다. 웃음은 집행유예가 없습니다.']
];

function stripJuryVote(container) {
  const reactionButton = container.querySelector('.reaction-btn');
  reactionButton?.closest('.card')?.remove();
  container.querySelector('.result-audience-title')?.remove();
}

function addComedyTone(container) {
  const cover = container.querySelector('.result-cover');
  if (cover && !container.querySelector('.result-comedy-notice')) {
    const notice = document.createElement('div');
    notice.className = 'result-comedy-notice';
    notice.setAttribute('role', 'note');
    notice.style.cssText = 'margin:0 0 16px;padding:15px 17px;border:1px dashed rgba(201,168,76,.65);border-radius:14px;background:rgba(201,168,76,.1);font-size:13px;line-height:1.75;color:var(--cream);text-align:center;';
    notice.innerHTML = '<strong style="color:var(--gold);">🎭 진지한 척 웃기는 오락형 생활법정</strong><br>사건접수부터 판결까지 읽으면서 웃기 위한 AI 창작물입니다. 실제 법률 판단이나 법적 효력은 없습니다.';
    cover.insertAdjacentElement('afterend', notice);
  }

  container.querySelectorAll('.result-paper').forEach((paper, index) => {
    const body = paper.querySelector('.result-paper-body');
    const stage = STAGE_COMEDY[index];
    if (!body || !stage || body.querySelector('.result-stage-comedy')) return;

    const callout = document.createElement('div');
    callout.className = 'result-stage-comedy';
    callout.style.cssText = 'margin:0 0 18px;padding:10px 12px;border-radius:10px;background:rgba(201,168,76,.09);border-left:3px solid var(--gold);font-size:12px;line-height:1.65;color:inherit;';
    const title = document.createElement('strong');
    title.style.color = 'var(--gold)';
    title.textContent = `😄 ${stage[0]} 웃음 포인트`;
    const description = document.createElement('div');
    description.style.marginTop = '3px';
    description.textContent = stage[1];
    callout.append(title, description);
    body.prepend(callout);
  });
}

export async function renderResult(container, caseId) {
  await renderStyledResult(container, caseId);
  stripJuryVote(container);
  addComedyTone(container);
}
