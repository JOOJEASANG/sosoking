import { registerRoute } from './router.js';

registerRoute('/constitutional-court', async () => {
  const module = await import('./pages/constitutional-court.js');
  return module.renderConstitutionalCourt();
});

const currentPath = (window.location.hash.slice(1) || '/').split('?')[0] || '/';
if (currentPath === '/constitutional-court') {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
