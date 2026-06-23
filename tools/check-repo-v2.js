'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const errors = [];
const root = (...parts) => path.join(ROOT, ...parts);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else files.push(target);
  }
  return files;
}

function resolveLocal(fromFile, value) {
  const clean = value.split('?')[0].split('#')[0];
  if (!clean.startsWith('.')) return null;
  const target = path.resolve(path.dirname(fromFile), clean);
  if (path.extname(target)) return target;
  return fs.existsSync(`${target}.js`) ? `${target}.js` : target;
}

function checkImports() {
  const files = [...walk(root('public', 'js')), ...walk(root('functions'))].filter(file => file.endsWith('.js'));
  const patterns = [
    /import\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)/g,
    /(?:import|export)\s+(?:[^;]*?\s+from\s+)?(["'])(\.\.?\/[^"']+)\1/g,
    /require\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)/g,
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source))) {
        const target = resolveLocal(file, match[2]);
        if (target && !fs.existsSync(target)) errors.push(`${path.relative(ROOT, file)} imports ${match[2]}`);
      }
    }
  }
}

function checkIndexAssets() {
  const html = fs.readFileSync(root('public', 'index.html'), 'utf8');
  const pattern = /\b(?:href|src)=["']([^"']+)["']/g;
  let match;
  while ((match = pattern.exec(html))) {
    const value = match[1].split('?')[0].split('#')[0];
    if (value.startsWith('/') && !fs.existsSync(root('public', value.slice(1)))) errors.push(`Missing asset ${value}`);
  }
}

function checkRewrites() {
  const config = JSON.parse(fs.readFileSync(root('firebase.json'), 'utf8'));
  const exported = require(root('functions', 'functions-main-v2.js'));
  for (const item of config.hosting?.rewrites || []) {
    if (item.function && !exported[item.function]) errors.push(`Missing function ${item.function}`);
  }
}

function checkWorkflows() {
  const backend = fs.readFileSync(root('.github', 'workflows', 'firebase-deploy.yml'), 'utf8');
  const hosting = fs.readFileSync(root('.github', 'workflows', 'firebase-hosting.yml'), 'utf8');
  if (backend.includes("'claude/**'") || backend.includes("'revamp/**'")) errors.push('Feature branch backend deploy enabled');
  if (backend.includes("- 'public/**'")) errors.push('Backend workflow includes public changes');
  if (!hosting.includes('npm run check')) errors.push('Hosting workflow skips checks');
}

checkImports();
checkIndexAssets();
checkRewrites();
checkWorkflows();

if (errors.length) {
  console.error('Repository check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Repository check passed.');
