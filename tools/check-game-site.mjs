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
const memberProfile = read('public/game/member-profile.js');
const deployWorkflow = read('.github/workflows/firebase-deploy.yml');
const sw = read('public/sw.js');
const liveGames = ['grid', 'vault', 'chosung', 'mind', 'alibi'];
const removedGames = ['dna', 'world', 'greed', 'caught'];

for (const page of [main, gameHome]) {
  for (const folder of liveGames) assert.match(page, new RegExp(`href="/game/${folder}/"`), `${folder} choice missing`);
  for (const folder of removedGames) assert.doesNotMatch(page, new RegExp(`/game/${folder}/`), `${folder} must not remain in hub`);
  assert.match(page, /소소킹 플레이/);
  assert.match(page, /칸폭주 30/);
  assert.doesNotMatch(page, /습관파괴|플레이 DNA|AI 보스|판결소|#\/board|#\/submit|#\/trial/i);
}

for (const folder of liveGames) assert.ok(fs.existsSync(`public/game/${folder}/index.html`), `${folder} page missing`);
for (const folder of removedGames) assert.ok(!fs.existsSync(`public/game/${folder}/index.html`), `${folder} page should be deleted`);

for (const file of [
  'public/game/install.js',
  'public/game/fun-pack.js',
  'public/game/game-master.js',
  'public/game/member-profile.js',
  'public/game/game-night.js',
  'public/game/grid/grid-core.js',
  'public/game/grid/grid.js',
  'public/game/vault/vault.js',
  'public/game/chosung/chosung.js',
  'public/game/mind/mind.js',
  'public/game/alibi/alibi.js',
  'functions/game-profile.js'
]) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || `${file} syntax failed`);
}

for (const deleted of [
  'public/game/dna-profile.js',
  'public/game/dna/index.html',
  'public/game/dna/dna.js',
  'public/game/dna/dna.css',
  'functions/dna-director.js',
  'functions/dna-director-core.js',
  'tools/check-dna-game.mjs',
  'tools/check-dna-rules.mjs'
]) assert.ok(!fs.existsSync(deleted), `${deleted} must be deleted`);

assert.match(rules, /data\.type == 'grid-rush'/);
assert.match(rules, /data\.maxRounds >= 3 && data\.maxRounds <= 8/);
assert.match(rules, /resource\.data\.uid == request\.auth\.uid/);
assert.doesNotMatch(rules, /dna-boss|sosoking-world|greed-stairs|unique-low|match \/reactions/);
assert.doesNotMatch(rules, /match \/cases|match \/results|court_comments|reports/);
assert.match(functionMain, /require\('\.\/game-profile'\)/);
assert.doesNotMatch(functionMain, /dna|daily|social|reports|submit|trial|court/i);
assert.match(rules, /isValidNewPlayer/);
assert.match(rules, /data\.keys\(\)\.hasOnly/);
assert.match(memberProfile, /query\(base, where\('uid', '==', uid\)\)/);
assert.match(memberProfile, /item\.kind === 'chosung'/);
assert.match(gameProfile, /exports\.getGamePlayerProfiles/);
assert.match(gameProfile, /enforceAppCheck: ENFORCE_APP_CHECK/);
assert.match(deployWorkflow, /functions\/\.env\.sosoking-481e6/);
assert.match(deployWorkflow, /vars\.ENFORCE_APP_CHECK/);
assert.equal(firebase.hosting.public, 'public');
assert.ok(!firebase.hosting.rewrites, 'court rewrites must not remain');
assert.match(sw, /\/game\/grid\/index\.html/);
assert.match(sw, /\/game\/chosung\/index\.html/);
assert.doesNotMatch(sw, /\/game\/(?:dna|world|greed|caught)\//);

const appShell = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] || '';
const cachedPaths = [...appShell.matchAll(/'([^']+)'/g)].map(match => match[1]);
const cachedSet = new Set(cachedPaths);
for (const asset of cachedPaths) {
  let pathname = asset.split('?')[0];
  if (pathname === '/') pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';
  assert.ok(fs.existsSync(`public${pathname}`), `service worker asset missing: ${asset}`);
}
for (const folder of liveGames) {
  const page = read(`public/game/${folder}/index.html`);
  const localAssets = [...page.matchAll(/(?:src|href)="(\/[^"#]+)"/g)]
    .map(match => match[1])
    .filter(asset => /\.(?:js|css|png|webmanifest)(?:\?|$)/.test(asset));
  for (const asset of localAssets) assert.ok(cachedSet.has(asset), `${folder} offline asset not cached: ${asset}`);
}

for (const removed of ['public/admin', 'public/css', 'public/js/pages', 'docs']) {
  assert.ok(!fs.existsSync(removed), `${removed} should be removed`);
}

console.log('Game-first repository validation passed: five live routes, Grid Rush, private round answers, one profile Function, and deleted DNA/legacy routes are consistent.');
