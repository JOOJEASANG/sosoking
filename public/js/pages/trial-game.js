import { renderTrial as renderBaseTrial } from './trial.js?v=20260727-simple-1';

function decorateTrial() {
  // 문서형 화면을 그대로 사용합니다.
}

export async function renderTrial(container, caseId) {
  await renderBaseTrial(container, caseId);
  decorateTrial();
}
