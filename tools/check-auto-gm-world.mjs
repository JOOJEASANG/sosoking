import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const home=read('public/game/index.html');
const gm=read('public/game/game-master.js');
const gmCss=read('public/game/game-master.css');
const worldHome=read('public/game/world/index.html');
const worldCss=read('public/game/world/world.css');
const worldV2Css=read('public/game/world/world-v2.css');
const world=read('public/game/world/world-v2.js');
const rules=read('firestore.rules');
const sw=read('public/sw.js');
const quickHomes=['vault','greed','caught','chosung'].map(name=>read(`public/game/${name}/index.html`));

for(const file of ['public/game/game-master.js','public/game/world/world-v2.js']){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,`${file} syntax failed: ${result.stderr}`);
}

assert.match(home,/href="\/game\/world\//);
assert.match(home,/소소킹 월드/);
assert.match(home,/자동 게임마스터/);
for(const page of quickHomes){
  assert.match(page,/game-master\.css\?v=20260812-auto-gm-world-1/);
  assert.match(page,/game-master\.js\?v=20260812-auto-gm-world-1/);
}
assert.match(gm,/REVEAL_SELECTORS/);
assert.match(gm,/NEXT_SELECTORS/);
assert.match(gm,/RESULT_DELAY=4200/);
assert.match(gm,/fallbackChoice/);
assert.match(gm,/data-choice="cash"/);
assert.match(gm,/data-vault/);
assert.match(gm,/data-number/);
assert.match(gm,/자동 ON/);
assert.match(gmCss,/game-master-control/);

assert.match(worldHome,/world-v2\.js\?v=20260812-world-v2-1/);
assert.match(worldHome,/world-v2\.css\?v=20260812-world-v2-1/);
assert.match(worldHome,/단계별 진행/);
assert.match(worldCss,/world-board/);
assert.match(worldV2Css,/world-phase-bar/);
assert.match(worldV2Css,/world-now-card/);
assert.match(worldV2Css,/roll-choice-grid/);
assert.match(world,/처음 하는 사람용 30초 설명/);
assert.match(world,/ROLL_SECONDS = 18/);
assert.match(world,/LANDING_SECONDS = 5/);
assert.match(world,/EVENT_SECONDS = 24/);
assert.match(world,/CHOSUNG_SECONDS = 32/);
assert.match(world,/RESULT_DELAY = 8000/);
assert.match(world,/MIN_EVENT_DWELL = 6000/);
assert.match(world,/ROOM_SCHEMA_ROUNDS = 24/);
assert.match(world,/MAX_TOTAL_TURNS = 48/);
assert.match(world,/maxRounds: ROOM_SCHEMA_ROUNDS/);
assert.match(world,/TILES = \[/);
assert.match(world,/kind: 'vault'/);
assert.match(world,/kind: 'caught'/);
assert.match(world,/kind: 'greed'/);
assert.match(world,/kind: 'chosung'/);
assert.match(world,/kind: 'property'/);
assert.match(world,/kind: 'crown'/);
assert.match(world,/kind: 'minority'/);
assert.match(world,/소수파 대결/);
assert.match(world,/data-roll-choice="normal"/);
assert.match(world,/data-roll-choice="risky"/);
assert.match(world,/worldPhase: 'landing'/);
assert.match(world,/phaseProgressMarkup/);
assert.match(world,/pace: 'standard'/);
assert.match(world,/players\.length \* 7/);
assert.match(world,/CROWN_TURN_BONUS = 60/);
assert.match(world,/CROWN_FINAL_BONUS = 600/);
assert.match(world,/FINAL CHAOS/);
assert.match(world,/autoMode: true/);
assert.match(world,/paused: false/);
assert.match(world,/world-roll/);
assert.match(world,/world-event/);
assert.match(world,/finishGame/);
assert.match(world,/answerSnapshot\.docs\.forEach\(answer => batch\.delete\(answer\.ref\)\)/);
assert.match(rules,/data\.type == 'sosoking-world' && data\.maxRounds == 24/);
assert.match(sw,/sosoking-app-v20260812-auto-gm-world-1/);
assert.match(sw,/\/game\/world\/index\.html/);
assert.match(sw,/\/game\/game-master\.js/);

console.log('Auto game master + Sosoking World v2 regression passed: slower four-step flow, readable timers, dynamic game length, safe/risky dice, minority battle, crown economy, four microgames, rules and PWA route are wired.');
