function ensureSymbolSpyStyles() {
  if (document.querySelector('link[href="/css/symbol-spy-game.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/symbol-spy-game.css';
  document.head.appendChild(link);
}

ensureSymbolSpyStyles();

export { renderSymbolSpyGame } from '../games/symbol-spy/index.js';
