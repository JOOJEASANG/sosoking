import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const main = read('public/index.html');
const gameHome = read('public/game/index.html');
const themeCss = read('public/game/theme.css');
const themeScript = read('public/game/theme.js');

function gameSources(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return gameSources(target);
    return /\.(?:html|js|css)$/.test(entry.name) ? [read(target)] : [];
  });
}

const allGameText = gameSources('public/game').join('\n');

assert.match(main, /링크 하나로 모여,<br>바로 한판/);
assert.match(main, /원하는 게임 골라 하기/);
assert.match(gameHome, /SOSOKING PLAY/);
assert.doesNotMatch(allGameText, /판결소|생활법정|소소킹 게임소|게임소로 돌아가기/);
assert.match(themeCss, /html\[data-theme="light"\]/);
assert.match(themeScript, /SOSOKING PARTY GAME/);
assert.match(themeScript, /prefers-color-scheme: light/);

console.log('Game copy validation passed: Sosoking Play naming, short party-game promise, and court-free game surfaces are consistent.');
