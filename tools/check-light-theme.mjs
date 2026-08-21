import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const patch = read('public/game/theme-v2.css');
const sw = read('public/sw.js');
const pages = [
  'public/index.html',
  'public/game/index.html',
  'public/game/grid/index.html',
  'public/game/vault/index.html',
  'public/game/chosung/index.html',
  'public/game/mind/index.html',
  'public/game/naming/index.html'
];
const themeHref = '/game/theme-v2.css?v=20260817-state-fix-1';

for (const file of pages) {
  assert.ok(read(file).includes(themeHref), `${file} must load the state-safe light theme`);
}

const cacheMatch = sw.match(/const CACHE_NAME = '([^']+)'/);
assert.ok(cacheMatch, 'service worker cache name must be declared');
assert.match(cacheMatch[1], /^sosoking-play-v\d{8}-.+-\d+$/, 'service worker cache name must use a dated version');
assert.ok(sw.includes(themeHref), 'service worker must precache the state-safe theme');
assert.match(patch, /@import url\('\/game\/theme\.css\?v=20260817-light-contrast-1'\)/);

for (const pattern of [
  /\.coming-label\.live-label/,
  /\.timer\.is-urgent/,
  /\.rank-item\.winner/,
  /\.round-mode\.lightning/,
  /\.round-mode\.double/,
  /\.round-mode\.royal/,
  /\.vault-result\.collision/,
  /\.grid-cell\.is-filled/,
  /\.grid-cell\.is-current/,
  /\.grid-racer\.is-me/,
  /:has\(\.game-master-control:not\(\[hidden\]\)\)/
]) {
  assert.match(patch, pattern, `theme state repair is missing ${pattern}`);
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map(value => Number.parseInt(value, 16));
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrast(a, b) {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dark + 0.05);
}

for (const surface of ['#f5f2ec', '#fffdfa']) {
  assert.ok(contrast('#626d7e', surface) >= 4.5, `light muted text must reach 4.5:1 on ${surface}`);
}

console.log('Light-theme regression validation passed: readable muted text, semantic game states, host controls, and cache-busted theme loading are protected.');
