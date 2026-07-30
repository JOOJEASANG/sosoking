import { renderPolicy as renderBasePolicy } from './policy-configurable-limit.js?v=20260730-redesign-stage-6';

export async function renderPolicy(container, type) {
  container.classList.add('policy-redesign-host');
  await renderBasePolicy(container, type);
}
