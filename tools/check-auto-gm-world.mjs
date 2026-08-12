import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const home=read('public/game/index.html');
const gm=read('public/game/game-master.js');
const gmCss=read('public/game/game-master.css');
const worldHome=read('public/game/world/index.html');
const worldCss=read('public/game/world/world.css');
const world=read('public/game/world/world.js');
const rules=read('firestore.rules');
const sw=read('public/sw.js');
const quickHomes=['vault','greed','caught','chosung'].map(name=>read(`public/game/${name}/index.html`));

for(const file of ['public/game/game-master.js','public/game/world/world.js']){
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

assert.match(worldHome,/world\.js\?v=20260812-world-1/);
assert.match(worldCss,/world-board/);
assert.match(world,/게임 이용설명/);
assert.match(world,/MAX_TURNS=24/);
assert.match(world,/TILES=\[/);
assert.match(world,/kind:'vault'/);
assert.match(world,/kind:'caught'/);
assert.match(world,/kind:'greed'/);
assert.match(world,/kind:'chosung'/);
assert.match(world,/kind:'property'/);
assert.match(world,/kind:'crown'/);
assert.match(world,/FINAL CHAOS/);
assert.match(world,/autoMode:true/);
assert.match(world,/paused:false/);
assert.match(world,/ROLL_SECONDS=8/);
assert.match(world,/RESULT_DELAY=3800/);
assert.match(world,/world-roll/);
assert.match(world,/world-event/);
assert.match(world,/finishGame/);
assert.match(world,/score:Number\(crowned\.score\|\|0\)\+600/);
assert.match(world,/answers.*batch\.delete/s);
assert.match(rules,/data\.type == 'sosoking-world' && data\.maxRounds == 24/);
assert.match(sw,/sosoking-app-v20260812-auto-gm-world-1/);
assert.match(sw,/\/game\/world\/index\.html/);
assert.match(sw,/\/game\/game-master\.js/);

console.log('Auto game master + Sosoking World regression passed: one-start auto flow, idle fallbacks, 24-tile board, crown/property economy, four microgames, final chaos, rules and PWA routes are wired.');
