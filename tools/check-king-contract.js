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
const home = read('public', 'js', 'pages', 'home.js');
const characterCatalog = read('functions', 'king-character-catalog.js');
const account = read('public', 'js', 'pages', 'account.js');
const loader = read('public', 'js', 'app-extensions-loader.js');
const index = read('public', 'index.html');
const previewWorkflow = read('.github', 'workflows', 'firebase-preview.yml');
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

for (const persona of [
  ['empathy', '감성형'],
  ['principle', '원칙형'],
  ['kkondae', '꼰대형'],
  ['coldblood', '냉혈형'],
  ['cider', '사이다형'],
  ['realist', '현실형'],
]) {
  requireText(characterCatalog, `${persona[0]}:`, 'server persona missing');
  requireText(characterCatalog, persona[1], 'server persona label missing');
  requireText(playground, `id: '${persona[0]}'`, 'client persona missing');
  requireText(home, persona[1], 'home persona missing');
}

for (const retiredPersona of ['jungding', 'saibi', 'prophet', 'joojeob', 'chamgyeon']) {
  if (characterCatalog.includes(`${retiredPersona}:`) || playground.includes(`id: '${retiredPersona}'`)) {
    failures.push(`retired persona remains: ${retiredPersona}`);
  }
}

requireText(playground, 'AI 놀이터 메뉴', 'AI playground side menu missing');
if (playground.includes('다른 공간 둘러보기')) failures.push('old side panel title remains');
for (const modePath of ['/playground/judge', '/playground/create', '/playground/consult', '/playground/lounge']) {
  requireText(playground, modePath, 'side menu mode path missing');
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

for (const retiredFunction of [
  'playAiLadderBonus', 'getPoliticsOverview', 'joinParty', 'leaveParty',
  'getElection', 'voteForPresident', 'getCongressStatus', 'proposeBill',
  'getConstitutionalCourtStatus', 'getDailyNews', 'getWeeklyCrisis',
]) {
  if (retiredFunction in mainFunctions) failures.push(`retired function remains in deployment surface: ${retiredFunction}`);
}

requireText(previewWorkflow, 'check-preview-ui.cjs', 'preview browser check is not wired');
requireText(previewWorkflow, 'preview-ui-screenshots', 'preview screenshot artifact is not wired');
if (!fs.existsSync(path.join(ROOT, 'tools', 'check-preview-ui.cjs'))) failures.push('preview browser check file is missing');

if (failures.length) {
  console.error('AI playground contract check failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('AI playground contract check passed.');
