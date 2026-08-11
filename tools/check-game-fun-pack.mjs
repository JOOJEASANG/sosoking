import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const fun = read('public/game/fun-pack.js');
const css = read('public/game/fun-pack.css');
const home = read('public/game/index.html');
const pages = [
  read('public/game/vault/index.html'),
  read('public/game/greed/index.html'),
  read('public/game/caught/index.html'),
  read('public/game/chosung/index.html')
];

const syntax = spawnSync(process.execPath, ['--check', 'public/game/fun-pack.js'], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || 'fun-pack.js syntax check failed');

for (const page of [home, ...pages]) {
  assert.match(page, /fun-pack\.css\?v=20260812-fun-pack-1/);
  assert.match(page, /fun-pack\.js\?v=20260812-fun-pack-1/);
}

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

assert.match(home, /보험권·레이더·현상금/);
assert.match(home, /랜덤 계단 이벤트와 탈락 후 생존자 베팅/);
assert.match(home, /가짜 보너스·잭팟·유령카드/);
assert.match(home, /초고속·스나이퍼·금지모음·잭팟 폭탄/);

console.log('Game fun pack validation passed: audio, haptics, missions, powers, random events, betting, awards, and four-game series are wired to all live games.');
