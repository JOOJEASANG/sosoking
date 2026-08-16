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
const liveGames = ['dna', 'vault', 'chosung', 'mind', 'alibi'];

const syntax = spawnSync(process.execPath, ['--check', 'public/game/game-night.js'], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || 'game-night.js syntax failed');

for (const page of [home, gameHome]) {
  for (const route of liveGames) assert.match(page, new RegExp(`href="/game/${route}/"`), `${route} choice missing from game hub`);
  assert.match(page, /원하는 게임 골라 하기/);
  assert.match(page, /data-game-night-home/);
  assert.match(page, /플레이 DNA/);
  assert.doesNotMatch(page, /\/game\/(?:world|greed|caught)\//);
}

for (const folder of liveGames) {
  const page = read(`public/game/${folder}/index.html`);
  assert.match(page, /game-night\.css\?v=20260816-dna-1/);
  assert.match(page, /game-night\.js\?v=20260816-dna-1/);
}

for (const required of [
  "type: 'dna-boss'", "type: 'vault-run'", "type: 'chosung-bomb'", "type: 'mind-reader'", "type: 'alibi-market'",
  "status: 'lobby'", "roundState: 'waiting'", 'gameNightRound:', 'previousGameType:',
  "collection(db, 'game_rooms', roomId, 'answers')", 'answersSnap.docs.forEach(item => batch.delete(item.ref))',
  'dna: normalizeDna(player.dna)', 'score: 0', 'location.replace(targetUrl(selected))',
  '현재 게임 한 판 더', 'GAMES.filter(game => game.type !== currentGame.type)', '방 코드와 멤버는 그대로', '모두 자동으로 이동'
]) assert.ok(gameNight.includes(required), `same-room game night missing: ${required}`);

for (const removed of ['sosoking-world', 'greed-stairs', 'unique-low', "collection(db, 'game_rooms', roomId, 'reactions')"]) {
  assert.ok(!gameNight.includes(removed), `retired game-night feature remains: ${removed}`);
}

for (const required of [
  '.game-night-picker', '.game-night-grid', '.game-night-choice.is-dna', '.game-night-replay',
  '.game-night-waiting-dots', '.game-night-carry-banner', '@media(prefers-reduced-motion:reduce)'
]) assert.ok(gameNightCss.includes(required), `game night style missing: ${required}`);

assert.match(rules, /data\.type == 'dna-boss'/);
assert.doesNotMatch(rules, /sosoking-world|greed-stairs|unique-low|match \/reactions/);
for (const asset of [
  '/game/game-night.css?v=20260816-dna-1',
  '/game/game-night.js?v=20260816-dna-1',
  '/game/dna-profile.js?v=20260816-dna-1',
  '/game/dna/index.html'
]) assert.ok(sw.includes(asset), `service worker missing ${asset}`);
assert.match(sw, /sosoking-play-v20260816-dna-1/);
assert.doesNotMatch(sw, /\/game\/(?:world|greed|caught)\//);

console.log('Game night validation passed: five games support replay or same-room switching while cumulative DNA survives score resets.');
