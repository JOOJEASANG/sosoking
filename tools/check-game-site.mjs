import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const mainIndex = read('public/index.html');
const nav = read('public/js/components/nav.js');
const accountGuard = read('public/js/game-entry-guard.js');
const gameHome = read('public/game/index.html');
const chosungHome = read('public/game/chosung/index.html');
const chosungScript = read('public/game/chosung/chosung.js');
const restartCleanup = read('public/game/chosung/restart-cleanup.js');
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
assert.match(chosungHome, /restart-cleanup\.js/);
assert.match(chosungScript, /game_rooms/);
assert.match(chosungScript, /navigator\.share/);
assert.match(chosungScript, /MAX_PLAYERS = 8/);
assert.match(restartCleanup, /answersSnap\.docs\.forEach\(answer => batch\.delete\(answer\.ref\)\)/);
assert.match(restartCleanup, /roundState: 'waiting'/);
assert.match(restartCleanup, /score: 0/);
assert.match(legacyEntry, /\/game\//);
assert.doesNotMatch(legacyEntry, /미친작명소|오답제작소|드립 배틀/);

console.log('Game hub regression passed: navigation, invite-room MVP, secure multiplayer rules, clean restarts, and legacy redirect are present.');
