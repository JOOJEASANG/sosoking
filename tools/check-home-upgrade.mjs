import fs from 'node:fs';

const home = fs.readFileSync('public/index.html', 'utf8');
const script = fs.readFileSync('public/js/home-upgrade.js', 'utf8');
const css = fs.readFileSync('public/game/home-upgrade.css', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');

for (const marker of ['quick-join-form', 'quick-room-code', 'random-game-button', 'browse-games-button']) {
  if (!home.includes(marker)) throw new Error(`Home upgrade UI marker missing: ${marker}`);
}
for (const marker of ["'grid-rush': '/game/grid/'", "'vault-run': '/game/vault/'", "'chosung-bomb': '/game/chosung/'", "'mind-reader': '/game/mind/'", "'naming-survival': '/game/naming/'", "getDoc(doc(db, 'game_rooms', code))"]) {
  if (!script.includes(marker)) throw new Error(`Quick join logic marker missing: ${marker}`);
}
for (const marker of ['.quick-start', '.quick-code-row', '.hero-actions', "html[data-theme='light']"]) {
  if (!css.includes(marker)) throw new Error(`Home upgrade style marker missing: ${marker}`);
}
for (const marker of ['/game/home-upgrade.css?v=20260822-home-upgrade-1', '/js/home-upgrade.js?v=20260822-home-upgrade-1']) {
  if (!sw.includes(marker)) throw new Error(`Home upgrade service worker asset missing: ${marker}`);
}

console.log('Home upgrade validation passed: quick room join, random game, responsive styles, and PWA assets are present.');
