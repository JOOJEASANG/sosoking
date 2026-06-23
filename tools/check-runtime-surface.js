'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FUNCTIONS = path.join(ROOT, 'functions');
const errors = [];

for (const retiredFile of [
  'index.js',
  'ai-king-functions.js',
  'core-ai-v2.js',
  'legacy-disabled-functions.js',
]) {
  if (fs.existsSync(path.join(FUNCTIONS, retiredFile))) {
    errors.push(`retired runtime file returned: ${retiredFile}`);
  }
}

for (const entry of fs.readdirSync(FUNCTIONS, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const source = fs.readFileSync(path.join(FUNCTIONS, entry.name), 'utf8');
  for (const retiredImport of [
    "require('./index.js')",
    "require('./index')",
    "require('./ai-king-functions')",
    "require('./ai-king-functions.js')",
    "require('./core-ai-v2.js')",
    "require('./legacy-disabled-functions.js')",
  ]) {
    if (source.includes(retiredImport)) errors.push(`${entry.name} loads ${retiredImport}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(FUNCTIONS, 'package.json'), 'utf8'));
if (packageJson.main !== 'functions-main-v2.js') {
  errors.push(`unexpected Functions entrypoint: ${packageJson.main}`);
}

const deployed = require(path.join(FUNCTIONS, 'functions-main-v2.js'));
const playground = require(path.join(FUNCTIONS, 'king-playground-functions.js'));
const moderation = require(path.join(FUNCTIONS, 'moderation-functions.js'));

if (deployed.aiJudge !== playground.aiJudge) errors.push('new private aiJudge is not deployed');
if (deployed.getAiKingUsage !== playground.getAiKingUsage) errors.push('usage compatibility alias is not deployed');
if (deployed.onFeedPostCreate !== moderation.onFeedPostCreate) errors.push('managed moderation trigger is not deployed');
if (deployed.onReportCreate !== moderation.onReportCreate) errors.push('managed report review trigger is not deployed');

for (const retired of ['playAiLadderBonus', 'joinParty', 'voteForPresident', 'proposeBill']) {
  if (retired in deployed) errors.push(`retired export remains: ${retired}`);
}

if (errors.length) {
  console.error('Runtime surface check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Runtime surface check passed.');
