'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const errors = [];

const hosting = read('.github', 'workflows', 'firebase-hosting.yml');
const backend = read('.github', 'workflows', 'firebase-deploy.yml');
const deployHelper = read('tools', 'deploy-firebase-stage.sh');
const storageRules = read('storage.rules');
const firebaseConfig = read('firebase.json');
const functionMain = read('functions', 'functions-main-v2.js');
const playground = read('functions', 'king-playground-functions.js');
const functionsPackage = JSON.parse(read('functions', 'package.json'));
const rootPackage = JSON.parse(read('package.json'));
const readme = read('README.md');
const releaseGuidePath = path.join(ROOT, 'docs', 'PRODUCTION_RELEASE.md');

function requireText(source, text, label) {
  if (!source.includes(text)) errors.push(`${label}: ${text}`);
}

for (const workflow of [hosting, backend]) {
  if (/claude\/\*\*/.test(workflow)) errors.push('production workflow still accepts claude branches');
}

requireText(hosting, "github.ref == 'refs/heads/main'", 'hosting main gate missing');
requireText(hosting, 'FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6', 'hosting service account missing');
if (hosting.includes('FIREBASE_TOKEN')) errors.push('hosting still uses a long-lived Firebase token');

requireText(backend, "if: github.ref == 'refs/heads/main'", 'backend main gate missing');
requireText(backend, "- 'storage.rules'", 'storage rules path trigger missing');
if (!backend.includes('--only storage --non-interactive') && !backend.includes('deploy-firebase-stage.sh storage')) {
  errors.push('official Storage rules deployment target missing: storage');
}
requireText(backend, 'FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6', 'backend service account missing');
requireText(backend, 'deploy-firebase-stage.sh functions', 'independent Functions deployment missing');
requireText(deployHelper, '--only "$TARGET"', 'Firebase deployment helper target missing');
requireText(deployHelper, 'FIREBASE_DEPLOY_ATTEMPTS', 'Firebase deployment retry configuration missing');
if (backend.includes('storage:rules')) errors.push('deprecated Storage deployment target remains');
if (backend.includes('::warning::')) errors.push('backend deploy suppresses a deployment failure');

if (!String(rootPackage.scripts?.['deploy:rules'] || '').includes('storage')) {
  errors.push('local rules deployment does not include Storage');
}
if (String(rootPackage.scripts?.['deploy:rules'] || '').includes('storage:rules')) {
  errors.push('local rules deployment uses the old Storage target');
}

requireText(storageRules, 'image/(jpeg|png|webp|gif)', 'storage image allowlist missing');
requireText(storageRules, 'allow write: if false;', 'legacy storage writes are not denied');
requireText(storageRules, 'match /{allPaths=**}', 'storage default deny missing');
requireText(firebaseConfig, '"rules": "storage.rules"', 'Firebase storage rules config missing');

requireText(functionMain, "require('./moderation-functions.js')", 'managed moderation module is not loaded directly');
if (functionMain.includes('core-ai-v2') || functionMain.includes('legacy-disabled-functions')) {
  errors.push('Functions entrypoint still loads a compatibility wrapper');
}
if (playground.includes('ai-king-functions')) errors.push('playground still loads the legacy AI engine');

for (const retiredPath of [
  ['functions', 'index.js'],
  ['functions', 'ai-king-functions.js'],
  ['functions', 'core-ai-v2.js'],
  ['functions', 'legacy-disabled-functions.js'],
]) {
  if (fs.existsSync(path.join(ROOT, ...retiredPath))) {
    errors.push(`retired file remains: ${retiredPath.join('/')}`);
  }
}

if (functionsPackage.main !== 'functions-main-v2.js') {
  errors.push(`unexpected Functions entrypoint: ${functionsPackage.main}`);
}

if (!fs.existsSync(releaseGuidePath)) errors.push('production release guide is missing');
requireText(readme, 'docs/PRODUCTION_RELEASE.md', 'README does not reference the release guide');
if (fs.existsSync(releaseGuidePath)) {
  const releaseGuide = fs.readFileSync(releaseGuidePath, 'utf8');
  for (const section of ['병합 전 필수 확인', '배포 직후 점검', '장애 발생 시 복구', '운영 승인 원칙']) {
    requireText(releaseGuide, section, 'release guide section missing');
  }
}

if (errors.length) {
  console.error('Release readiness check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Release readiness check passed.');
