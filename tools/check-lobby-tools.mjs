import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const js = fs.readFileSync('public/game/lobby-tools.js', 'utf8');
const css = fs.readFileSync('public/game/lobby-tools.css', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const games = ['grid', 'vault', 'chosung', 'mind', 'naming'];

const syntax = spawnSync(process.execPath, ['--check', 'public/game/lobby-tools.js'], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || 'lobby-tools.js syntax failed');

for (const marker of ['navigator.share', 'navigator.clipboard', 'deleteDoc', 'data-lobby-copy-code', 'data-lobby-copy-link', 'data-lobby-leave', 'roomData.status !== \'lobby\'', 'is-lobby-host', 'is-lobby-me']) {
  assert.ok(js.includes(marker), `Lobby tool marker missing: ${marker}`);
}
for (const marker of ['game-lobby-tools', 'game-lobby-actions', 'is-primary', 'is-danger', 'html[data-theme="light"]', '@media(max-width:560px)']) {
  assert.ok(css.includes(marker), `Lobby CSS marker missing: ${marker}`);
}
for (const game of games) {
  const html = fs.readFileSync(`public/game/${game}/index.html`, 'utf8');
  assert.ok(html.includes('/game/lobby-tools.css?v=20260822-lobby-polish-1'), `${game} lobby CSS missing`);
  assert.ok(html.includes('/game/lobby-tools.js?v=20260822-lobby-polish-1'), `${game} lobby JS missing`);
}
for (const marker of ['/game/lobby-tools.css?v=20260822-lobby-polish-1', '/game/lobby-tools.js?v=20260822-lobby-polish-1']) {
  assert.ok(sw.includes(marker), `Service worker lobby marker missing: ${marker}`);
}
const cacheName = sw.match(/const CACHE_NAME = ['"]([^'"]+)['"]/u)?.[1] || '';
assert.match(cacheName, /^sosoking-play-v\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/, `Invalid service worker cache name: ${cacheName}`);

console.log('Lobby tools validation passed: share/copy, participant state, safe guest leave, mobile/light styling, and PWA caching are wired across all live games.');
