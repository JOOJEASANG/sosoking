import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const mainIndex = read('public/index.html');
const nav = read('public/js/components/nav.js');
const accountGuard = read('public/js/game-entry-guard.js');
const gameHome = read('public/game/index.html');
const partyCss = read('public/game/party.css');
const vaultHome = read('public/game/vault/index.html');
const vaultCss = read('public/game/vault/vault.css');
const vaultScript = read('public/game/vault/vault.js');
const greedHome = read('public/game/greed/index.html');
const greedCss = read('public/game/greed/greed.css');
const greedScript = read('public/game/greed/greed.js');
const caughtHome = read('public/game/caught/index.html');
const caughtCss = read('public/game/caught/caught.css');
const caughtScript = read('public/game/caught/caught.js');
const chosungHome = read('public/game/chosung/index.html');
const chosungScript = read('public/game/chosung/chosung.js');
const restartCleanup = read('public/game/chosung/restart-cleanup.js');
const mindHome = read('public/game/mind/index.html');
const mindScript = read('public/game/mind/mind.js');
const alibiHome = read('public/game/alibi/index.html');
const alibiScript = read('public/game/alibi/alibi.js');
const serviceWorker = read('public/sw.js');
const legacyEntry = read('public/dripso/index.html');

assert.match(mainIndex, /game-entry\.css/);
assert.match(mainIndex, /game-entry-guard\.js/);
assert.doesNotMatch(mainIndex, /dripso-entry/);
assert.match(nav, /href="\/game\/"/);
assert.match(nav, />게임소</);
assert.doesNotMatch(nav, /\/dripso\//);
assert.match(accountGuard, /title: '게임소'/);

assert.match(gameHome, /금고런/);
assert.match(gameHome, /href="\/game\/vault\//);
assert.match(gameHome, /초성 폭탄/);
assert.match(gameHome, /href="\/game\/chosung\//);
assert.match(gameHome, /욕심계단/);
assert.match(gameHome, /href="\/game\/greed\//);
assert.match(gameHome, /딱걸렸어/);
assert.match(gameHome, /href="\/game\/caught\//);
assert.doesNotMatch(gameHome, /개발중|개발 예정|기획중|다음 개발|권력전쟁/);
assert.doesNotMatch(gameHome, /href="\/game\/mind\//);
assert.doesNotMatch(gameHome, /href="\/game\/alibi\//);
assert.match(partyCss, /choice-button/);

assert.match(vaultHome, /금고런/);
assert.match(vaultHome, /vault\.js/);
assert.match(vaultCss, /vault-card/);
assert.match(vaultScript, /type: 'vault-run'/);
assert.match(vaultScript, /MAX_ROUNDS = 9/);
assert.match(vaultScript, /ROUND_SECONDS = 12/);
assert.match(vaultScript, /SPECIALS = \['gold', 'mystery', 'thief', 'comeback'\]/);
assert.match(vaultScript, /MYSTERY_EFFECTS/);
assert.match(vaultScript, /comboBonus/);
assert.match(vaultScript, /roundMultiplier\(\)/);
assert.match(vaultScript, /uids\.length > 1/);
assert.match(vaultScript, /answersSnap\.docs\.forEach\(answer => batch\.delete\(answer\.ref\)\)/);
assert.match(vaultScript, /navigator\.share/);

assert.match(greedHome, /욕심계단/);
assert.match(greedCss, /stair-step/);
assert.match(greedScript, /type: 'greed-stairs'/);
assert.match(greedScript, /MAX_ROUNDS = 5/);
assert.match(greedScript, /MAX_STAGES = 5/);
assert.match(greedScript, /ROUND_SECONDS = 10/);
assert.match(greedScript, /text: choice/);
assert.match(greedScript, /effectiveRisk/);
assert.match(greedScript, /secureRandomPercent/);
assert.match(greedScript, /runState: 'busted'/);
assert.match(greedScript, /정상 정복/);
assert.match(greedScript, /answerSnap\.docs\.forEach\(answer => batch\.delete\(answer\.ref\)\)/);
assert.match(greedScript, /navigator\.share/);

assert.match(caughtHome, /딱걸렸어/);
assert.match(caughtCss, /number-grid/);
assert.match(caughtScript, /type: 'unique-low'/);
assert.match(caughtScript, /MAX_ROUNDS = 8/);
assert.match(caughtScript, /ROUND_SECONDS = 10/);
assert.match(caughtScript, /NUMBERS = Array\.from/);
assert.match(caughtScript, /kind: 'number'/);
assert.match(caughtScript, /uniqueNumbers/);
assert.match(caughtScript, /bannedNumber/);
assert.match(caughtScript, /bonusNumber/);
assert.match(caughtScript, /500 \* multiplier/);
assert.match(caughtScript, /answerSnap\.docs\.forEach\(answer => batch\.delete\(answer\.ref\)\)/);
assert.match(caughtScript, /navigator\.share/);

assert.match(serviceWorker, /\/game\/vault\/index\.html/);
assert.match(serviceWorker, /\/game\/greed\/index\.html/);
assert.match(serviceWorker, /\/game\/caught\/index\.html/);
assert.match(serviceWorker, /20260812-quick-games-1/);

assert.match(chosungHome, /초성 폭탄/);
assert.match(chosungHome, /restart-cleanup\.js/);
assert.match(chosungScript, /game_rooms/);
assert.match(chosungScript, /navigator\.share/);
assert.match(chosungScript, /MAX_PLAYERS = 8/);
assert.match(chosungScript, /TARGETS_BY_LENGTH/);
assert.match(chosungScript, /id: 'lightning'/);
assert.match(chosungScript, /id: 'double'/);
assert.match(chosungScript, /id: 'royal'/);
assert.match(chosungScript, /getInitials\(answer\) === target/);
assert.match(restartCleanup, /answersSnap\.docs\.forEach\(answer => batch\.delete\(answer\.ref\)\)/);
assert.match(restartCleanup, /score: 0/);

// 이전 실험 게임은 직접 URL 호환을 위해 보존하되 게임소 메인에서는 노출하지 않는다.
assert.match(mindHome, /관심법/);
assert.match(mindScript, /type: 'mind-reader'/);
assert.match(alibiHome, /변명거래소/);
assert.match(alibiScript, /type: 'alibi-market'/);

assert.match(legacyEntry, /\/game\//);
assert.doesNotMatch(legacyEntry, /미친작명소|오답제작소|드립 배틀/);

console.log('Game hub regression passed: four live quick games, one-tap or short-input multiplayer, PWA routes, clean restarts, hidden experiment compatibility, and legacy redirect are present.');
