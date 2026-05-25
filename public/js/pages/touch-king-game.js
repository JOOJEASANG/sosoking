function loadStyleOnce(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensureTouchKingStyles() {
  loadStyleOnce('/css/symbol-spy-game.css');
  loadStyleOnce('/css/symbol-spy-theme-polish.css');
  loadStyleOnce('/css/touch-king-polish.css');
}

ensureTouchKingStyles();
import('../games/touch-king/home-actions.js').catch(error => console.warn('[touch-king home actions]', error));

export async function renderTouchKingGame(params = {}) {
  if (params.id) {
    const module = await import('../games/touch-king/room.js');
    return module.renderTouchKingRoom(params.id);
  }
  const module = await import('../games/touch-king/index.js');
  return module.renderTouchKingSolo();
}

export function redirectOldSymbolSpy(params = {}) {
  location.hash = params.id ? `/game/touch-king/${params.id}` : '/game/touch-king';
}
