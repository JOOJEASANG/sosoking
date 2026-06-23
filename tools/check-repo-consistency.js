'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function rel(...parts) { return path.join(ROOT, ...parts); }
function read(file) { return fs.readFileSync(rel(file), 'utf8'); }
function readJson(file) { return JSON.parse(read(file)); }
function fail(message) { failures.push(message); }

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target, out);
    else out.push(target);
  }
  return out;
}

function existsPublicUrl(urlPath) {
  const clean = String(urlPath || '').split('?')[0].split('#')[0];
  if (!clean || !clean.startsWith('/')) return true;
  return fs.existsSync(rel('public', clean.slice(1)));
}

function resolveImport(fromFile, specifier) {
  const clean = String(specifier || '').split('?')[0].split('#')[0];
  if (!clean.startsWith('.')) return null;
  const target = path.resolve(path.dirname(fromFile), clean);
  if (path.extname(target)) return target;
  if (fs.existsSync(`${target}.js`)) return `${target}.js`;
  return target;
}

function checkHostingFunctionRewrites() {
  const firebaseConfig = readJson('firebase.json');
  const exported = require(rel('functions', 'functions-main-v2.js'));
  for (const rewrite of firebaseConfig.hosting?.rewrites || []) {
    if (rewrite.function && !exported[rewrite.function]) {
      fail(`firebase.json rewrite references missing function export: ${rewrite.function}`);
    }
  }
}

function checkIndexLocalAssets() {
  const html = read('public/index.html');
  const attribute = /\b(?:href|src)=["']([^"']+)["']/g;
  let match;
  while ((match = attribute.exec(html))) {
    const value = match[1];
    if (value.startsWith('/') && !existsPublicUrl(value)) {
      fail(`index.html references missing public asset: ${value}`);
    }
  }
}

function checkJavascriptImports() {
  const files = [
    ...walk(rel('public', 'js')).filter(file => file.endsWith('.js')),
    ...walk(rel('functions')).filter(file => file.endsWith('.js')),
  ];
  const dynamicImport = /import\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)/g;
  const staticImport = /(?:import|export)\s+(?:[^;]*?\s+from\s+)?(["'])(\.\.?\/[^"']+)\1/g;
  const requireCall = /require\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)/g;

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const regex of [dynamicImport, staticImport, requireCall]) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text))) {
        const target = resolveImport(file, match[2]);
        if (target && !fs.existsSync(target)) {
          fail(`${path.relative(ROOT, file)} imports missing module: ${match[2]}`);
        }
      }
    }
  }
}

function checkStaleRoutes() {
  const firebaseText = read('firebase.json');
  const sitemapText = read('functions/sitemap-functions.js');
  for (const removedRoute of ['/game/liar', '/game/mafia']) {
    if (firebaseText.includes(removedRoute)) fail(`firebase.json still contains removed route: ${removedRoute}`);
    if (sitemapText.includes(removedRoute)) fail(`sitemap still contains removed route: ${removedRoute}`);
  }
}

function checkDeploymentSafety() {
  const backend = read('.github/workflows/firebase-deploy.yml');
  const hosting = read('.github/workflows/firebase-hosting.yml');
  if (backend.includes("'claude/**'") || backend.includes("'revamp/**'")) {
    fail('backend deploy workflow must never deploy feature branches');
  }
  if (backend.includes("- 'public/**'")) {
    fail('backend deploy workflow must not deploy for public-only changes');
  }
  if (!hosting.includes('npm run check')) {
    fail('hosting deploy workflow must run repository checks before deployment');
  }
  if (!hosting.includes('branches:\n      - main')) {
    fail('hosting deploy workflow must target main only');
  }
}

checkHostingFunctionRewrites();
checkIndexLocalAssets();
checkJavascriptImports();
checkStaleRoutes();
checkDeploymentSafety();

if (failures.length) {
  console.error('Repository consistency check failed:');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Repository consistency check passed.');
