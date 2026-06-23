'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) failures.push(`${label}: ${needle}`);
};

const app = read('public', 'js', 'app-safe.js');
const playground = read('public', 'js', 'pages', 'playground.js');
const account = read('public', 'js', 'pages', 'account.js');
const loader = read('public', 'js', 'app-extensions-loader.js');
const index = read('public', 'index.html');
const mainFunctions = require(path.join(ROOT, 'functions', 'functions-main-v2.js'));

for (const route of ['/playground', '/playground/:mode']) {
  requireText(app, `registerRoute('${route}'`, 'missing playground route');
}

for (const functionName of [
  'aiJudge',
  'aiTranslateV2',
  'aiNameV2',
  'aiConsultV2',
  'saveKingPlaygroundResult',
  'getKingPlaygroundHistory',
  'deleteKingPlaygroundResult',
]) {
  if (!mainFunctions[functionName]) failures.push(`missing function export: ${functionName}`);
  requireText(playground, `'${functionName}'`, 'playground does not call function');
}

for (const functionName of ['getKingPlaygroundHistory', 'deleteKingPlaygroundResult', 'deleteMyAccount']) {
  requireText(account, `'${functionName}'`, 'account does not call function');
}

for (const stylesheet of [
  '/css/king-foundation.css',
  '/css/king-home.css',
  '/css/king-playground-layout.css',
  '/css/king-playground-form.css',
  '/css/king-account.css',
]) {
  requireText(index, stylesheet, 'missing playground stylesheet');
}

for (const removedExtension of [
  'core-nav-visibility-fix.js',
  'home-card-layout-fix.js',
  'points-removal-ui.js',
  'layout-id-repair.js',
]) {
  if (loader.includes(removedExtension)) failures.push(`obsolete extension still loaded: ${removedExtension}`);
}

for (const politicalMarker of ['getPoliticalRank', 'renderPartyTab', 'RANK_PERKS', '정치력', '대통령 선거']) {
  if (account.includes(politicalMarker)) failures.push(`political account code remains: ${politicalMarker}`);
}

if (failures.length) {
  console.error('AI playground contract check failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('AI playground contract check passed.');
