import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const errors = [];
const root = process.cwd();
const script = path.join(root, 'tools/configure-app-check.mjs');
const validKey = '6Lc1234567890abcdefghijklmnopqrstuv';

function runCase({ key = '', enforce = 'false' }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sosoking-app-check-'));
  const configPath = path.join(directory, 'firebase-config.js');
  fs.writeFileSync(configPath, 'export const firebaseConfig = { appCheckSiteKey: "" };\n');
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_CHECK_CONFIG_PATH: configPath,
      FIREBASE_APP_CHECK_SITE_KEY: key,
      ENFORCE_APP_CHECK: enforce
    }
  });
  const content = fs.readFileSync(configPath, 'utf8');
  fs.rmSync(directory, { recursive: true, force: true });
  return { ...result, content };
}

const disabled = runCase({});
if (disabled.status !== 0 || !disabled.content.includes('appCheckSiteKey: ""')) {
  errors.push('configure-app-check.mjs: disabled mode does not preserve an empty site key');
}

const configured = runCase({ key: validKey, enforce: 'false' });
if (configured.status !== 0 || !configured.content.includes(`appCheckSiteKey: "${validKey}"`)) {
  errors.push('configure-app-check.mjs: valid site key is not injected');
}

const enforced = runCase({ key: validKey, enforce: 'true' });
if (enforced.status !== 0 || !enforced.stdout.includes('enforced=true')) {
  errors.push('configure-app-check.mjs: valid enforced mode failed');
}

const missingKey = runCase({ enforce: 'true' });
if (missingKey.status === 0 || !missingKey.stderr.includes('requires FIREBASE_APP_CHECK_SITE_KEY')) {
  errors.push('configure-app-check.mjs: enforcement without a site key is not rejected');
}

const invalidKey = runCase({ key: 'invalid key', enforce: 'false' });
if (invalidKey.status === 0 || !invalidKey.stderr.includes('invalid format')) {
  errors.push('configure-app-check.mjs: malformed site key is not rejected');
}

const workflow = fs.readFileSync('.github/workflows/firebase-deploy.yml', 'utf8');
const configStep = workflow.indexOf('Prepare App Check public configuration');
const validateStep = workflow.indexOf('Validate repository');
if (configStep < 0 || validateStep < 0 || configStep > validateStep) {
  errors.push('.github/workflows/firebase-deploy.yml: App Check configuration must run before repository validation');
}
if (!workflow.includes('FIREBASE_APP_CHECK_SITE_KEY: ${{ vars.FIREBASE_APP_CHECK_SITE_KEY')) {
  errors.push('.github/workflows/firebase-deploy.yml: App Check site key variable is not wired');
}
if (!workflow.includes('node tools/configure-app-check.mjs')) {
  errors.push('.github/workflows/firebase-deploy.yml: App Check configuration script is not executed');
}

const hosting = fs.readFileSync('firebase.json', 'utf8');
if (!hosting.includes('"source": "/js/firebase-config.js"')
  || !hosting.includes('"value": "no-cache, max-age=0, must-revalidate"')) {
  errors.push('firebase.json: Firebase public config is not protected from stale HTTP caching');
}

const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
if (!serviceWorker.includes("url.pathname === '/js/firebase-config.js'")) {
  errors.push('public/sw.js: Firebase public config does not use network-first loading');
}

if (errors.length) {
  console.error(`App Check deployment validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('App Check deployment validation passed: injection, enforcement guard, workflow ordering, and cache freshness.');
