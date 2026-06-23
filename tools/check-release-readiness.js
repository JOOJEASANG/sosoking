'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const errors = [];

const hosting = read('.github', 'workflows', 'firebase-hosting.yml');
const backend = read('.github', 'workflows', 'firebase-deploy.yml');
const storageRules = read('storage.rules');
const firebaseConfig = read('firebase.json');
const coreAi = read('functions', 'core-ai-v2.js');
const playground = read('functions', 'king-playground-functions.js');
const functionsPackage = JSON.parse(read('functions', 'package.json'));

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
requireText(backend, '--only storage:rules', 'storage rules deployment missing');
requireText(backend, 'FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6', 'backend service account missing');
if (backend.includes('::warning::') || backend.includes('|| \\')) {
  errors.push('backend deploy contains a failure-suppression pattern');
}

requireText(storageRules, "image/(jpeg|png|webp|gif)", 'storage image allowlist missing');
requireText(storageRules, 'allow write: if false;', 'legacy storage writes are not denied');
requireText(storageRules, 'match /{allPaths=**}', 'storage default deny missing');
requireText(firebaseConfig, '"rules": "storage.rules"', 'Firebase storage rules config missing');

if (coreAi.includes("require('./index.js')") || coreAi.includes("require('./index')")) {
  errors.push('legacy function index is still loaded');
}
if (playground.includes('ai-king-functions')) {
  errors.push('playground still loads the legacy AI engine');
}
if (functionsPackage.main !== 'functions-main-v2.js') {
  errors.push(`unexpected Functions entrypoint: ${functionsPackage.main}`);
}

if (errors.length) {
  console.error('Release readiness check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Release readiness check passed.');
