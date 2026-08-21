import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const main = read('public/index.html');
const gameHome = read('public/game/index.html');
const manifest = JSON.parse(read('public/site.webmanifest'));
const logoSvg = read('assets/brand/play-logo.svg');
const maskableSvg = read('assets/brand/play-logo-maskable.svg');
const sw = read('public/sw.js');
const forbidden = /판결소|생활법정|공개 판결|재판|법적 효력/;

function pngSize(file) {
  const image = fs.readFileSync(file);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(image.subarray(0, 8).equals(signature), `${file} must be a PNG`);
  assert.equal(image.subarray(12, 16).toString('ascii'), 'IHDR', `${file} must have an IHDR chunk`);
  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20)
  };
}

for (const html of [main, gameHome]) {
  assert.match(html, /소소킹 플레이/);
  assert.match(html, /링크 하나로 모여,<br>바로 한판/);
  assert.match(html, /\/logo\.png\?v=20260816-play-brand-1/);
  assert.match(html, /\/site\.webmanifest\?v=20260816-play-brand-1/);
  assert.match(html, /id="install-app"/);
  assert.doesNotMatch(html, forbidden);
}

assert.equal(manifest.name, '소소킹 플레이');
assert.equal(manifest.short_name, '소소킹');
assert.equal(manifest.start_url, '/?source=pwa');
assert.deepEqual(manifest.categories, ['games', 'entertainment', 'social']);
assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
assert.match(logoSvg, /왕관 게임패드 로고/);
assert.match(maskableSvg, /마스커블 앱 아이콘/);
assert.match(sw, /sosoking-play-v\d{8}-(?:state-fix|auth)-\d+/);
assert.match(sw, /\/game\/install\.js/);
assert.match(sw, /\/auth\/auth\.js\?v=/);

for (const [file, size] of [
  ['public/logo.png', 512],
  ['public/icons/sosoking-192.png', 192],
  ['public/icons/sosoking-512.png', 512],
  ['public/icons/sosoking-maskable-512.png', 512],
  ['public/icons/favicon-32.png', 32],
  ['public/icons/favicon-48.png', 48]
]) {
  const dimensions = pngSize(file);
  assert.equal(dimensions.width, size, `${file} width`);
  assert.equal(dimensions.height, size, `${file} height`);
}

const ogDimensions = pngSize('public/og-image.png');
assert.equal(ogDimensions.width, 1200);
assert.equal(ogDimensions.height, 630);

const deployVersion = read('public/deploy-version.txt').trim();
assert.match(deployVersion, /^sosoking-play-\d{8}-[a-z0-9-]+$/);
assert.ok(
  main.includes(`<meta name="sosoking-deploy-version" content="${deployVersion}">`),
  'index.html deploy marker must match deploy-version.txt'
);

console.log('Sosoking Play brand validation passed: game-first copy, crown gamepad logo, PWA install metadata, maskable icon, and social image are synchronized.');
