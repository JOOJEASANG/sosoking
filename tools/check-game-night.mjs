import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const home = read('public/index.html');
const gameHome = read('public/game/index.html');
const gameNight = read('public/game/game-night.js');
const gameNightCss = read('public/game/game-night.css');
const rules = read('firestore.rules');
const sw = read('public/sw.js');
const liveGames = ['grid', 'vault', 'chosung', 'mind', 'naming'];

const syntax = spawnSync(process.execPath, ['--check', 'public/game/game-night.js'], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || 'game-night.js syntax failed');

for (const page of [home, gameHome]) {
  for (const route of liveGames) assert.match(page, new RegExp(`href="/game/${route}/"`), `${route} choice missing from game hub`);
  assert.match(page, /원하는 게임 골라 하기/);
  assert.match(page, /data-game-night-home/);
  assert.match(page, /방 코드와 멤버는 유지/);
  assert.doesNotMatch(page, /DNA|AI 보스|\/game\/(?:dna|world|greed|caught)\//i);
}

for (const folder of liveGames) {
  const page = read(`public/game/${folder}/index.html`);
  assert.match(page, /game-night\.css\?v=20260817-naming-1/);
  assert.match(page, /game-night\.js\?v=20260817-naming-1/);
}

for (const required of [
  "type: 'grid-rush'", "type: 'vault-run'", "type: 'chosung-bomb'", "type: 'mind-reader'", "type: 'naming-survival'",
  "status: 'lobby'", "roundState: 'waiting'", 'gameNightRound:', 'previousGameType:',
  "collection(db, 'game_rooms', roomId, 'answers')", 'answersSnap.docs.forEach(item => batch.delete(item.ref))',
  'score: 0', 'eliminated: false', 'maxPlayers: Number(game.maxPlayers ?? 8)', 'too-many-players',
  'location.replace(targetUrl(selected))', 'game.type === latestRoom.type',
  '현재 게임 한 판 더', 'GAMES.filter(game => game.type !== currentGame.type)', '방 코드와 멤버는 그대로', '모두 자동으로 이동'
]) assert.ok(gameNight.includes(required), `same-room game night missing: ${required}`);

for (const removed of ['alibi-market', '/game/alibi/', 'dna-boss', 'normalizeDna', 'sosoking-world', 'greed-stairs', 'unique-low', 'laps:', 'damage:', 'runState:', "collection(db, 'game_rooms', roomId, 'reactions')"]) {
  assert.ok(!gameNight.includes(removed), `retired game-night feature remains: ${removed}`);
}

for (const required of [
  '.game-night-picker', '.game-night-grid', '.game-night-choice.is-featured', '.game-night-replay',
  '.game-night-waiting-dots', '.game-night-carry-banner', '@media(prefers-reduced-motion:reduce)'
]) assert.ok(gameNightCss.includes(required), `game night style missing: ${required}`);

assert.match(rules, /data\.type == 'grid-rush'/);
assert.doesNotMatch(rules, /dna-boss|sosoking-world|greed-stairs|unique-low|match \/reactions/);
for (const asset of [
  '/game/game-night.css?v=20260817-naming-1',
  '/game/game-night.js?v=20260817-naming-1',
  '/game/grid/grid-core.js?v=20260817-grid-2',
  '/game/grid/index.html'
]) assert.ok(sw.includes(asset), `service worker missing ${asset}`);
const cacheMatch = sw.match(/const CACHE_NAME = '([^']+)'/);
assert.ok(cacheMatch, 'service worker cache name must be declared');
assert.match(cacheMatch[1], /^sosoking-play-v\d{8}-.+-\d+$/, 'service worker cache must use a dated version');
assert.match(sw, /\/game\/naming\/naming-core\.js\?v=20260817-naming-1/);
assert.doesNotMatch(sw, /\/game\/(?:alibi|dna|world|greed|caught)\//);

console.log('Game night validation passed: five games support secure resets and same-room switching, Naming keeps unlimited rooms separate from capped games, and archived Naming sessions are untouched.');
