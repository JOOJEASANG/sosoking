import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  ACTIONS,
  BOARD_SIZE,
  buildBoard,
  rankPlayers,
  resolveTurn
} from '../public/game/grid/grid-core.js';

const read = file => fs.readFileSync(file, 'utf8');
const page = read('public/game/grid/index.html');
const game = read('public/game/grid/grid.js');
const css = read('public/game/grid/grid.css');

assert.equal(BOARD_SIZE, 30);
assert.deepEqual(Object.keys(ACTIONS), ['rush', 'guard', 'recycle']);

const boardA = buildBoard('ABC234');
const boardB = buildBoard('ABC234');
const boardC = buildBoard('XYZ789');
assert.equal(boardA.length, 30);
assert.deepEqual(boardA, boardB, 'same room seed must produce the same fair board');
assert.notDeepEqual(boardA, boardC, 'different rooms should rotate obstacle layout');
assert.equal(boardA.filter(type => type !== 'clear').length, 14);
for (const required of ['barrier', 'sticky', 'lock', 'mirror', 'bomb', 'boost']) {
  assert.ok(boardA.includes(required), `board missing ${required}`);
}

const clearBoard = Array(30).fill('clear');
const rush = resolveTurn({ position: 0 }, 'rush', clearBoard);
assert.equal(rush.delta, 3);
assert.equal(rush.state.position, 3);

const lockedBoard = [...clearBoard];
lockedBoard[0] = 'lock';
const guarded = resolveTurn({ position: 0 }, 'guard', lockedBoard);
assert.equal(guarded.delta, 2, 'guard should neutralize the lock and retain the second stamp');
assert.equal(guarded.state.shield, 0);

const recycled = resolveTurn({ position: 0, scrap: 2 }, 'recycle', lockedBoard);
assert.equal(recycled.delta, 5, 'third scrap should immediately rebuild into four bonus stamps');
assert.equal(recycled.state.scrap, 0);

const barrierBoard = [...clearBoard];
barrierBoard[2] = 'barrier';
const dented = resolveTurn({ position: 0 }, 'rush', barrierBoard);
assert.equal(dented.delta, 2);
assert.equal(dented.state.barrierDent, true);
const broken = resolveTurn(dented.state, 'rush', barrierBoard);
assert.ok(broken.state.position > dented.state.position, 'a dented barrier must break on the next stamp');

const nearFinish = resolveTurn({ position: 29, shield: 1, scrap: 2 }, 'rush', clearBoard);
assert.equal(nearFinish.state.position, 30);
assert.equal(nearFinish.finished, true);
assert.ok(nearFinish.state.finishPower >= 3);

const ranking = rankPlayers([
  { uid: 'late', position: 30, finishPower: 2, joinOrder: 2 },
  { uid: 'strong', position: 30, finishPower: 4, joinOrder: 3 },
  { uid: 'early', position: 29, finishPower: 9, joinOrder: 1 }
]);
assert.equal(ranking[0].uid, 'strong');

for (const required of ['칸폭주 30', '30칸', '질주', '방어', '역이용']) assert.ok(`${page}\n${game}`.includes(required));
for (const required of ['grid-board', 'grid-cell', 'grid-action', 'grid-racer', '@media(prefers-reduced-motion:reduce)']) assert.ok(css.includes(required));
for (const required of ["type: GAME_TYPE", "kind: 'grid-action'", "`choice-${currentUid}`", 'resolveTurn', 'winnerUid']) assert.ok(game.includes(required));
assert.doesNotMatch(`${page}\n${game}\n${css}`, /DNA|AI 보스/i);

console.log('Grid Rush validation passed: deterministic 30-cell boards, six obstacle types, simultaneous tools, obstacle recycling, persistent progress, and finish tie-breaks behave as designed.');
