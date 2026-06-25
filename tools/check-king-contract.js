'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const failures = [];
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const need = (text, value, label) => { if (!text.includes(value)) failures.push(`${label}: ${value}`); };

const app = read('public', 'js', 'app-safe.js');
const playground = read('public', 'js', 'pages', 'playground.js');
const home = read('public', 'js', 'pages', 'home.js');
const history = read('public', 'js', 'pages', 'history.js');
const ranking = read('public', 'js', 'pages', 'ranking.js');
const admin = read('public', 'js', 'pages', 'admin.js');
const account = read('public', 'js', 'pages', 'account.js');
const loader = read('public', 'js', 'app-extensions-loader.js');
const characterCatalog = read('functions', 'king-character-catalog.js');
const mainFunctions = require(path.join(ROOT, 'functions', 'functions-main-v2.js'));

for (const route of ['/playground', '/playground/:mode', '/materials', '/material/:id', '/debates', '/debate/:id']) need(app, `registerRoute('${route}'`, 'missing route');
for (const name of ['aiJudge','aiTranslateV2','aiNameV2','aiConsultV2','saveKingPlaygroundResult','getKingPlaygroundHistory','deleteKingPlaygroundResult']) {
  if (!mainFunctions[name]) failures.push(`missing function export: ${name}`);
  need(playground, `'${name}'`, 'playground call missing');
}
for (const name of ['getMaterials','getMaterial','createUserMaterial','getMaterialComments','addMaterialComment','getDebates','getDebate','voteDebate','getDebateComments','addDebateComment','createUserDebate']) {
  if (!mainFunctions[name]) failures.push(`missing content export: ${name}`);
}
for (const name of ['getMaterials','getMaterial','createUserMaterial','getMaterialComments','addMaterialComment']) need(history, `'${name}'`, 'material page call missing');
for (const marker of ['+ 자료 등록','댓글 등록','사용자 등록']) need(history, marker, 'material community UI missing');
for (const name of ['getDebates','getDebate','voteDebate','getDebateComments','addDebateComment','createUserDebate']) need(ranking, `'${name}'`, 'debate page call missing');
for (const marker of ['내 선택은 여기에','debate-vote__letter">A','debate-vote__letter">B','+ 토론 등록']) need(ranking, marker, 'A/B debate UI missing');
for (const name of ['adminCreateMaterial','adminCreateDebate','triggerDailyMaterial','triggerDailyDebate']) need(admin, `'${name}'`, 'admin call missing');
for (const name of ['getKingPlaygroundHistory','deleteKingPlaygroundResult','deleteMyAccount']) need(account, `'${name}'`, 'account call missing');
need(loader, 'debate-route-redirect.js', 'debate redirect missing');
need(home, "call('getTodayDebate')", 'home debate missing');
need(home, "call('getTodayMaterials')", 'home material missing');
for (const [id, label] of [['empathy','감성형'],['principle','원칙형'],['kkondae','꼰대형'],['coldblood','냉혈형'],['cider','사이다형'],['realist','현실형']]) {
  need(characterCatalog, `${id}:`, 'server persona missing');
  need(characterCatalog, label, 'server persona label missing');
  need(playground, `id: '${id}'`, 'client persona missing');
}
if (history.includes('voteMaterial') || mainFunctions.voteMaterial) failures.push('retired material voting remains');
if (failures.length) { console.error('AI playground contract check failed:'); failures.forEach(item => console.error(`- ${item}`)); process.exit(1); }
console.log('AI playground contract check passed.');
