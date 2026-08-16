import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const fun = read('public/game/fun-pack.js');
const reconnect = read('public/game/fun-room-reload.js');
const memberProfile = read('public/game/member-profile.js');
const memberCss = read('public/game/member-profile.css');
const css = read('public/game/fun-pack.css');
const vaultPage = read('public/game/vault/index.html');
const chosungPage = read('public/game/chosung/index.html');
const chosung = read('public/game/chosung/chosung.js');

for (const file of ['public/game/fun-pack.js', 'public/game/fun-room-reload.js', 'public/game/member-profile.js']) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${file} syntax check failed`);
}

for (const page of [vaultPage, chosungPage]) {
  assert.match(page, /fun-pack\.css\?v=20260816-dna-1/);
  assert.match(page, /fun-pack\.js\?v=20260816-dna-1/);
  assert.match(page, /fun-room-reload\.js\?v=20260812-fun-pack-1/);
  assert.match(page, /member-profile\.css\?v=20260812-game-guide-polish-1/);
  assert.match(page, /member-profile\.js\?v=20260816-dna-1/);
}

assert.match(reconnect, /history\.replaceState/);
assert.match(reconnect, /!beforeRoom && afterRoom/);
assert.match(reconnect, /location\.reload\(\)/);
for (const required of [
  "const SUPPORTED = ['/game/vault/', '/game/chosung/']", 'navigator.vibrate', 'AudioContext',
  'fun-sound-toggle', "particles('👑'", "playSound('good')"
]) assert.ok(fun.includes(required), `fun pack missing: ${required}`);
assert.doesNotMatch(fun, /greed|caught|world|seriesInviteUrl|fun-bet/);

for (const required of [
  'const GAME_GUIDES', '게임 이용설명',
  '이렇게 하면 됩니다', '점수 / 승리', '특수 기능', '이기기 팁', 'sosoking-game-guide-seen:',
  'maybeAutoOpenGuide', 'game-pressure-card', 'game-round-story', 'ROUND HIGHLIGHT', 'sosoking-round-streak:'
]) assert.ok(memberProfile.includes(required), `game guide/polish missing: ${required}`);
for (const required of [
  'DEFAULT_SECONDS = 25', "id: 'classic'", 'seconds: 25', "id: 'lightning'", 'seconds: 15',
  "id: 'double'", 'seconds: 22', "id: 'royal'", 'seconds: 20'
]) assert.ok(chosung.includes(required), `Chosung timing missing: ${required}`);
for (const title of ['금고런', '초성 폭탄']) assert.ok(memberProfile.includes(title), `game guide missing title: ${title}`);
assert.doesNotMatch(memberProfile, /greed|caught|욕심계단|딱걸렸어/);

for (const required of [
  '.game-guide-fab', '.game-guide-inline', '.game-guide-backdrop', '.game-guide-modal',
  '.game-guide-steps', '.game-pressure-card', '.game-round-story'
]) assert.ok(memberCss.includes(required), `game guide css missing: ${required}`);
for (const required of ['.fun-sound-toggle', '.fun-particle', '@media(prefers-reduced-motion: reduce)']) {
  assert.ok(css.includes(required), `fun pack css missing: ${required}`);
}

console.log('Game polish validation passed: the retained quick games keep sound, haptics, reconnect, guides, balanced timers, and round highlights without retired-game logic.');
