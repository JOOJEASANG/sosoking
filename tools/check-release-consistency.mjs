import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const release = read('public/deploy-version.txt').trim();
const home = read('public/index.html');
const gameHome = read('public/game/index.html');
const liveVerify = read('.github/workflows/verify-live-hosting.yml');
const firebase = JSON.parse(read('firebase.json'));
const sw = read('public/sw.js');

assert.ok(/^sosoking-play-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/.test(release), `Invalid deploy version: ${release}`);
for (const [name, html] of [['home', home], ['game home', gameHome]]) {
  assert.ok(html.includes(`name="sosoking-deploy-version" content="${release}"`), `${name} deploy marker does not match deploy-version.txt`);
}

assert.match(home, /account-login-icon account-static-login/);
assert.match(home, /href="\/auth\/"/);
assert.match(home, /id="quick-join-form"/);
assert.match(liveVerify, /public\/deploy-version\.txt/);
assert.match(liveVerify, /github\.event\.workflow_run\.head_sha/);
assert.match(liveVerify, /account-login-icon account-static-login/);
assert.match(liveVerify, /id=\"quick-join-form\"/);
assert.doesNotMatch(liveVerify, /EXPECTED_VERSION:\s*sosoking-play-/);
assert.doesNotMatch(liveVerify, /로그인 \/ 회원가입<\/a>/);

const redirects = firebase.hosting?.redirects || [];
assert.ok(redirects.some(item => item.source === '/game' && item.destination === '/'), 'Missing /game canonical redirect');
assert.ok(redirects.some(item => item.source === '/game/' && item.destination === '/'), 'Missing /game/ canonical redirect');
assert.match(sw, /\['\/game', '\/index\.html'\]/, 'PWA /game fallback must use the upgraded home');

const forbidden = /판결소|court_comments|#\/trial|#\/submit|#\/board|match \/cases|match \/results/iu;
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
for (const root of ['public', 'functions']) {
  for (const file of walk(root)) {
    if (!/\.(?:html|js|css|json|md|txt)$/i.test(file)) continue;
    assert.doesNotMatch(read(file), forbidden, `Legacy court residue found in runtime file: ${file}`);
  }
}

for (const route of ['grid', 'vault', 'chosung', 'mind', 'naming']) {
  const page = read(`public/game/${route}/index.html`);
  assert.match(page, /\/game\/lobby-tools\.css\?v=20260822-lobby-polish-1/);
  assert.match(page, /\/game\/lobby-tools\.js\?v=20260822-lobby-polish-1/);
}

console.log(`Release consistency passed for ${release}: runtime is game-only, the canonical hub is unified, and live verification follows the deployed commit.`);
