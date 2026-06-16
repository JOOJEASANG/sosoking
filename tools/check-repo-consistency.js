'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function rel(...parts) {
  return path.join(ROOT, ...parts);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(rel(file), 'utf8'));
}

function existsPublicUrl(urlPath) {
  const clean = String(urlPath || '').split('?')[0].split('#')[0];
  if (!clean || !clean.startsWith('/')) return true;
  return fs.existsSync(rel('public', clean.slice(1)));
}

function fail(message) {
  failures.push(message);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function checkHostingFunctionRewrites() {
  const firebaseConfig = readJson('firebase.json');
  const exported = require(rel('functions', 'functions-main-v2.js'));
  const rewrites = firebaseConfig.hosting?.rewrites || [];

  for (const rewrite of rewrites) {
    if (!rewrite.function) continue;
    if (!exported[rewrite.function]) {
      fail(`firebase.json rewrite references missing function export: ${rewrite.function}`);
    }
  }
}

function checkIndexLocalAssets() {
  const indexPath = rel('public', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const re = /\b(?:href|src)=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    const value = m[1];
    if (!value.startsWith('/')) continue;
    if (!existsPublicUrl(value)) fail(`index.html references missing public asset: ${value}`);
  }
}

function resolveImport(fromFile, specifier) {
  const clean = specifier.split('?')[0].split('#')[0];
  if (!clean.startsWith('.')) return null;
  return path.resolve(path.dirname(fromFile), clean);
}

function checkStaticDynamicImports() {
  const files = walk(rel('public', 'js')).filter(file => file.endsWith('.js'));
  const importRe = /import\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)/g;
  const moduleStringRe = /["'](\.\/?[^"']+\.js)["']/g;

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = importRe.exec(text))) {
      const target = resolveImport(file, m[2]);
      if (target && !fs.existsSync(target)) {
        fail(`${path.relative(ROOT, file)} imports missing module: ${m[2]}`);
      }
    }

    if (text.includes('MODULES') || text.includes('OPTIONAL_MODULES')) {
      while ((m = moduleStringRe.exec(text))) {
        const target = resolveImport(file, m[1]);
        if (target && !fs.existsSync(target)) {
          fail(`${path.relative(ROOT, file)} module list references missing module: ${m[1]}`);
        }
      }
    }
  }
}

function checkStaleGameSeoReferences() {
  const firebaseText = fs.readFileSync(rel('firebase.json'), 'utf8');
  const sitemapText = fs.readFileSync(rel('functions', 'sitemap-functions.js'), 'utf8');
  for (const pattern of ['/game/liar', '/game/mafia']) {
    if (firebaseText.includes(pattern)) fail(`firebase.json still contains removed game route: ${pattern}`);
    if (sitemapText.includes(pattern)) fail(`sitemap still contains removed game route: ${pattern}`);
  }
}

checkHostingFunctionRewrites();
checkIndexLocalAssets();
checkStaticDynamicImports();
checkStaleGameSeoReferences();

if (failures.length) {
  console.error('Repository consistency check failed:');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Repository consistency check passed.');
