import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const fun = read('public/game/fun-pack.js');
const reset = read('public/game/fun-reset.js');
const reconnect = read('public/game/fun-room-reload.js');
const memberProfile = read('public/game/member-profile.js');
const memberCss = read('public/game/member-profile.css');
const css = read('public/game/fun-pack.css');
const home = read('public/game/index.html');
const vaultPage = read('public/game/vault/index.html');
const greedPage = read('public/game/greed/index.html');
const caughtPage = read('public/game/caught/index.html');
const chosungPage = read('public/game/chosung/index.html');
const pages = [vaultPage, greedPage, caughtPage, chosungPage];

for (const file of ['public/game/fun-pack.js', 'public/game/fun-reset.js', 'public/game/fun-room-reload.js', 'public/game/member-profile.js']) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${file} syntax check failed`);
}

for (const page of [home, ...pages]) {
  assert.match(page, /fun-pack\.css\?v=20260812-fun-pack-1/);
  assert.match(page, /fun-pack\.js\?v=20260812-fun-pack-1/);
}
for (const page of pages) {
  assert.match(page, /fun-room-reload\.js\?v=20260812-fun-pack-1/);
  assert.match(page, /member-profile\.css\?v=20260812-game-guide-polish-1/);
  assert.match(page, /member-profile\.js\?v=20260812-game-guide-polish-1/);
}
for (const page of [vaultPage, caughtPage, chosungPage]) {
  assert.match(page, /fun-reset\.js\?v=20260812-fun-pack-1/);
}
assert.match(reconnect, /history\.replaceState/);
assert.match(reconnect, /!beforeRoom && afterRoom/);
assert.match(reconnect, /location\.reload\(\)/);
assert.match(reset, /data\.status === 'lobby'/);
assert.match(reset, /sosoking-fun-power:/);
assert.match(reset, /localStorage\.removeItem/);
assert.match(reset, /sessionStorage\.removeItem/);

for (const required of [
  "const GAME_ORDER = ['vault', 'greed', 'caught', 'chosung']",
  '오늘의 소소킹',
  '4게임 통합전',
  'rankPoints = [5, 3, 2, 1, 1, 1, 1, 1]',
  "power === 'insurance'",
  "power === 'ghost'",
  "power === 'shield'",
  "kind: 'fun-bet'",
  "['gold', 'crack', 'safe', 'thief']",
  "['odd', 'even', 'decoy', 'jackpot']",
  "['sniper', 'novowel', 'ultra', 'jackpot']",
  'funBonusAppliedKey',
  'navigator.vibrate',
  'AudioContext',
  '비밀미션',
  '오늘 내 칭호',
  'seriesInviteUrl'
]) {
  assert.ok(fun.includes(required), `fun pack missing: ${required}`);
}

for (const required of [
  'classic: 25',
  'lightning: 15',
  'double: 22',
  'royal: 20',
  "data.funRule === 'ultra'",
  'return 12',
  'timeBalanceKey',
  '번개 15초',
  '제한시간이 12초로 줄어듭니다.',
  'const GAME_GUIDES',
  '게임 이용설명',
  '이렇게 하면 됩니다',
  '점수 / 승리',
  '특수 기능',
  '이기기 팁',
  'sosoking-game-guide-seen:',
  'maybeAutoOpenGuide',
  'game-pressure-card',
  'game-round-story',
  'ROUND HIGHLIGHT',
  'sosoking-round-streak:'
]) {
  assert.ok(memberProfile.includes(required), `game guide/polish missing: ${required}`);
}

for (const title of ['금고런', '욕심계단', '딱걸렸어', '초성 폭탄']) {
  assert.ok(memberProfile.includes(title), `game guide missing title: ${title}`);
}

for (const required of [
  '.game-guide-fab',
  '.game-guide-inline',
  '.game-guide-backdrop',
  '.game-guide-modal',
  '.game-guide-steps',
  '.game-pressure-card',
  '.game-round-story'
]) {
  assert.ok(memberCss.includes(required), `game guide css missing: ${required}`);
}

for (const required of [
  '.fun-sound-toggle',
  '.fun-card.mission',
  '.fun-power-row',
  '.fun-series-card',
  '.fun-series-board',
  '.fun-particle',
  '@media(prefers-reduced-motion:reduce)'
]) {
  assert.ok(css.includes(required), `fun pack css missing: ${required}`);
}

assert.match(home, /보험권·레이더·특수금고/);
assert.match(home, /랜덤 계단과 붕괴 위험/);
assert.match(home, /보너스와 유령카드/);
assert.match(home, /특수폭탄과 자동 채점/);

console.log('Game fun pack validation passed: audio, haptics, missions, powers, relaxed Chosung timers, first-visit game guides, round highlights, close-score pressure, streaks, betting, awards, and four-game series are wired to all live games.');
