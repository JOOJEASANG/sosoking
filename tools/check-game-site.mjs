import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const main = read('public/index.html');
const gameHome = read('public/game/index.html');
const firebase = JSON.parse(read('firebase.json'));
const rules = read('firestore.rules');
const functionMain = read('functions/main.js');
const gameProfile = read('functions/game-profile.js');
const sw = read('public/sw.js');

assert.match(main, /href="\/game\/world\//);
assert.match(main, /href="\/game\/vault\//);
assert.match(main, /href="\/game\/greed\//);
assert.match(main, /href="\/game\/caught\//);
assert.match(main, /href="\/game\/chosung\//);
assert.match(main, /소소킹 플레이/);
assert.doesNotMatch(main, /판결소|#\/board|#\/submit|#\/trial/);
assert.match(gameHome, /소소킹 플레이/);

for (const folder of ['world', 'vault', 'greed', 'caught', 'chosung', 'mind', 'alibi']) {
  assert.ok(fs.existsSync(`public/game/${folder}/index.html`), `${folder} page missing`);
}

for (const file of [
  'public/game/install.js',
  'public/game/fun-pack.js',
  'public/game/game-master.js',
  'public/game/member-profile.js',
  'functions/game-profile.js'
]) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || `${file} syntax failed`);
}

assert.match(rules, /match \/game_rooms\/\{roomId\}/);
assert.match(rules, /data\.type == 'sosoking-world'/);
assert.doesNotMatch(rules, /match \/cases|match \/results|court_comments|reports/);
assert.match(functionMain, /require\('\.\/game-profile'\)/);
assert.match(gameProfile, /exports\.getGamePlayerProfiles/);
assert.doesNotMatch(functionMain, /daily|social|reports|submit|trial|court/i);
assert.equal(firebase.hosting.public, 'public');
assert.ok(!firebase.hosting.rewrites, 'court rewrites must not remain');
assert.match(sw, /\/game\/world\/index\.html/);
assert.match(sw, /\/game\/chosung\/index\.html/);

for (const removed of ['public/admin', 'public/css', 'public/js/pages', 'docs']) {
  assert.ok(!fs.existsSync(removed), `${removed} should be removed`);
}

console.log('Game-first repository validation passed: root game hub, playable routes, game-only rules and function surface, and retired court code removal are present.');
