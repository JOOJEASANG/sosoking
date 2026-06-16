// forces-route-extension.js — 외부세력 라우트 등록
import { registerRoute } from './router.js';

registerRoute('/forces', async () => {
  const module = await import('./pages/forces.js');
  return module.renderForcesPage();
});
