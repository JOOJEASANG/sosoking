import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const gm = read('public/game/game-master.js');
const css = read('public/game/game-master.css');
const vault = read('public/game/vault/index.html');
const chosung = read('public/game/chosung/index.html');
const syntax = spawnSync(process.execPath, ['--check', 'public/game/game-master.js'], { encoding: 'utf8' });

assert.equal(syntax.status, 0, syntax.stderr || 'game-master.js syntax failed');
for (const page of [vault, chosung]) {
  assert.match(page, /game-master\.css\?v=20260816-auto-gm-1/);
  assert.match(page, /game-master\.js\?v=20260816-auto-gm-1/);
}
for (const required of ['게임마스터', '자동 ON', '잠시멈춤', 'REVEAL_SELECTORS', 'NEXT_SELECTORS', 'data-vault', 'RESULT_DELAY']) {
  assert.ok(gm.includes(required), `auto game master missing: ${required}`);
}
assert.doesNotMatch(gm, /data-choice="cash"|data-number|greed|caught|world/);
for (const required of ['.game-master-control', '.game-master-actions', '.game-master-badge', '@media(prefers-reduced-motion:reduce)']) {
  assert.ok(css.includes(required), `auto game master style missing: ${required}`);
}

console.log('Auto game-master validation passed for the retained Vault and Chosung games.');
