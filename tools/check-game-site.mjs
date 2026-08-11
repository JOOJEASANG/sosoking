import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const mainIndex = read('public/index.html');
const nav = read('public/js/components/nav.js');
const accountGuard = read('public/js/game-entry-guard.js');
const gameHome = read('public/game/index.html');
const chosungHome = read('public/game/chosung/index.html');
const chosungScript = read('public/game/chosung/chosung.js');
const legacyEntry = read('public/dripso/index.html');

assert.match(mainIndex, /game-entry\.css/);
assert.match(mainIndex, /game-entry-guard\.js/);
assert.doesNotMatch(mainIndex, /dripso-entry/);
assert.match(nav, /href="\/game\/"/);
assert.match(nav, />게임소</);
assert.doesNotMatch(nav, /\/dripso\//);
assert.match(accountGuard, /title: '게임소'/);
assert.match(gameHome, /초성 폭탄/);
assert.match(gameHome, /거짓말 탐정/);
assert.match(gameHome, /권력전쟁/);
assert.match(chosungHome, /초성 폭탄/);
assert.match(chosungScript, /game_rooms/);
assert.match(chosungScript, /navigator\.share/);
assert.match(chosungScript, /MAX_PLAYERS = 8/);
assert.match(legacyEntry, /\/game\//);
assert.doesNotMatch(legacyEntry, /미친작명소|오답제작소|드립 배틀/);

console.log('Game hub regression passed: 판결소→게임소 navigation, game hub, 초성 폭탄 room/share MVP, and legacy entry redirect are present.');
