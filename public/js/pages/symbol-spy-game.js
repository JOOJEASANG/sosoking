function loadStyleOnce(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensureSymbolSpyStyles() {
  loadStyleOnce('/css/symbol-spy-game.css');
  loadStyleOnce('/css/symbol-spy-theme-polish.css');
  loadStyleOnce('/css/touch-king-polish.css');
}

ensureSymbolSpyStyles();
import('../games/symbol-spy/home-room-actions.js').catch(error => console.warn('[touch-king home actions]', error));

export async function renderSymbolSpyGame(params = {}) {
  if (params.id) {
    const module = await import('../games/symbol-spy/touch-room.js');
    return module.renderSymbolSpyRoom(params.id);
  }
  const module = await import('../games/symbol-spy/index.js');
  return module.renderSymbolSpyGame();
}
