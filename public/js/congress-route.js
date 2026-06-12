import { registerRoute } from './router.js';

registerRoute('/congress', async () => {
  const module = await import('./pages/congress.js');
  return module.renderCongress();
});

const currentPath = (window.location.hash.slice(1) || '/').split('?')[0] || '/';
if (currentPath === '/congress') {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
