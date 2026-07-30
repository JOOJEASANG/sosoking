import { renderAuth as renderBaseAuth } from './auth2.js?v=20260729-brand-unified-1';

export async function renderAuth(container) {
  container.classList.add('auth-redesign-host');
  await renderBaseAuth(container);
}
