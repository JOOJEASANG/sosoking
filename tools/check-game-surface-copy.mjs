import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const gameHome = read('public/game/index.html');
const gameThemeCss = read('public/game/theme.css');
const gameThemeScript = read('public/game/theme.js');
const accountGuard = read('public/js/game-entry-guard.js');
const chosungHome = read('public/game/chosung/index.html');
const serviceWorker = read('public/sw.js');

assert.match(gameThemeCss, /#bottom-nav\{display:none!important\}/);
assert.match(gameThemeCss, /body\{padding-bottom:0!important\}/);
assert.match(gameThemeScript, /function removeCourtBottomNav\(\)/);
assert.match(gameThemeScript, /SOSOKING PARTY GAME/);
assert.match(gameThemeScript, /예: 초성왕/);
assert.match(gameThemeScript, /예: 폭탄맨/);

assert.doesNotMatch(gameHome, /가족/);
assert.doesNotMatch(chosungHome, /가족/);
assert.doesNotMatch(accountGuard, /가족/);
assert.match(chosungHome, /친한 사람들과/);
assert.match(accountGuard, /친구·연인·지인/);
assert.match(serviceWorker, /sosoking-app-v20260812-game-surface-cleanup-1/);

console.log('Game surface copy validation passed: court bottom navigation stays out of game pages and family-only wording is removed from visible game entry copy.');
