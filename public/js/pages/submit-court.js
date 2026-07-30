import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260730-configurable-limit-1';

const FLOW_LABELS = [
  '📝\n사건접수',
  '🔍\n수사보고',
  '💼\n원고측',
  '🛡️\n피고측',
  '⚖️\n재판부'
];

function applySubmitRedesign(container) {
  const shell = container.firstElementChild;
  const page = container.querySelector('.page-header + .container');
  const intro = page?.querySelector('.court-document');
  const form = page?.querySelector('#submit-form');
  if (!shell || !page || !intro || !form) return;

  shell.classList.add('submit-redesign-shell');
  page.classList.add('submit-page');
  intro.classList.add('submit-intro');

  const [kicker, title, description] = Array.from(intro.children);
  kicker?.classList.add('submit-intro-kicker');
  title?.classList.add('submit-intro-title');
  description?.classList.add('submit-intro-description');
  if (title) title.textContent = '내 억울함, 한 줄로 접수';
  if (description) description.textContent = '핵심 내용만 적으면 사건명과 담당 판사가 자동으로 정해지고 다섯 단계 판결문이 시작됩니다.';

  const flow = form.querySelector('.submit-document-flow');
  const flowCard = flow?.closest('.card');
  flowCard?.classList.add('submit-flow-card');
  flow?.querySelectorAll('span').forEach((step, index) => {
    step.textContent = FLOW_LABELS[index] || step.textContent;
  });

  form.querySelector('#is-public')?.closest('.card')?.classList.add('submit-public-card');
  form.querySelector('.disclaimer')?.classList.add('submit-notice');
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  applySubmitRedesign(container);
}
