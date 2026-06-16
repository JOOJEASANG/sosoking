// forces-route-extension.js — 외부세력 라우트 등록
import { registerRoute, getCurrentPath } from './router.js';

async function renderForces() {
  const module = await import('./pages/forces.js');
  return module.renderForcesPage();
}

registerRoute('/forces', renderForces);

// 확장 모듈은 앱 초기 라우터보다 늦게 로드될 수 있으므로,
// 현재 주소가 이미 /forces이면 등록 직후 직접 렌더링합니다.
if (getCurrentPath() === '/forces') {
  renderForces().catch(error => {
    console.error('[forces route extension] render failed', error);
  });
}
