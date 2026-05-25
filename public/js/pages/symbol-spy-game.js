function ensureSymbolSpyStyles() {
  if (document.querySelector('link[href="/css/symbol-spy-game.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/symbol-spy-game.css';
  document.head.appendChild(link);
}

ensureSymbolSpyStyles();

export async function renderSymbolSpyGame(params = {}) {
  if (params.id) {
    const module = await import('../games/symbol-spy/room.js');
    return module.renderSymbolSpyRoom(params.id);
  }
  const module = await import('../games/symbol-spy/index.js');
  return module.renderSymbolSpyGame();
}
