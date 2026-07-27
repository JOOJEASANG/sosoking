import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const errors = [];
const ignoredDirectories = new Set(['.git', 'node_modules', '.firebase', 'coverage', 'dist']);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : entry.isFile() ? [fullPath] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function resolvesLocally(fromFile, specifier) {
  const clean = specifier.split('?')[0].split('#')[0];
  if (!clean.startsWith('.') && !clean.startsWith('/')) return true;

  const base = clean.startsWith('/')
    ? path.join(root, 'public', clean.slice(1))
    : path.resolve(path.dirname(fromFile), clean);

  return [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')]
    .some(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

const jsFiles = [
  ...walk(path.join(root, 'functions')).filter(file => file.endsWith('.js')),
  ...walk(path.join(root, 'public')).filter(file => /\.(?:js|mjs)$/.test(file)),
];

for (const file of jsFiles) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    errors.push(`${relative(file)}: ${syntax.stderr.trim() || 'syntax error'}`);
  }

  const source = fs.readFileSync(file, 'utf8');
  const importPatterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      if (!resolvesLocally(file, match[1])) {
        errors.push(`${relative(file)}: missing local module ${match[1]}`);
      }
    }
  }
}

for (const htmlFile of walk(path.join(root, 'public')).filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const assets = html.matchAll(/(?:src|href)=["'](\/[^"'#?]+\.(?:js|mjs|css|svg|png|webp|jpg|jpeg|json|webmanifest))["']/g);
  for (const match of assets) {
    const target = path.join(root, 'public', match[1].slice(1));
    if (!fs.existsSync(target)) errors.push(`${relative(htmlFile)}: missing asset ${match[1]}`);
  }
}

const jsonFiles = [
  'package.json',
  'firebase.json',
  'firestore.indexes.json',
  'functions/package.json',
  'functions/package-lock.json',
  'public/site.webmanifest',
  'public/version.json',
];
for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    errors.push(`${file}: invalid JSON: ${error.message}`);
  }
}

const obsoleteFiles = [
  'functions/index.js',
  'public/admin/admin-email-guard.js',
  'public/css/theme-toggle.css',
  'public/js/components/app-install.js',
  'public/js/components/theme-contrast.js',
  'public/js/pages/auth.js',
  'public/js/pwa-init.js',
];
for (const file of obsoleteFiles) {
  if (fs.existsSync(path.join(root, file))) errors.push(`${file}: obsolete file remains`);
}

const authorizationFiles = [
  'functions/admin-utils.js',
  'public/js/components/admin-redirect.js',
  'public/js/pages/auth2.js',
];
for (const file of authorizationFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (source.includes('FALLBACK_ADMIN_EMAILS') || source.includes('OWNER_EMAIL') || source.includes('ADMIN_EMAIL')) {
    errors.push(`${file}: hard-coded administrator identity remains`);
  }
}

const functionsMainPath = path.join(root, 'functions/main.js');
const functionsMain = fs.readFileSync(functionsMainPath, 'utf8');
const loadedModules = [...functionsMain.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)]
  .map(match => match[1]);
const exportsByName = new Map();

for (const moduleName of loadedModules) {
  const file = path.resolve(path.dirname(functionsMainPath), `${moduleName}.js`);
  if (!fs.existsSync(file)) {
    errors.push(`functions/main.js: missing module ${moduleName}`);
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g)) {
    if (exportsByName.has(match[1])) {
      errors.push(`duplicate Functions export ${match[1]}: ${exportsByName.get(match[1])}, ${relative(file)}`);
    } else {
      exportsByName.set(match[1], relative(file));
    }
  }
}

const deployWorkflow = fs.readFileSync(path.join(root, '.github/workflows/firebase-deploy.yml'), 'utf8');
const deployedFunctions = deployWorkflow.match(/firebase deploy --only functions:([^\s]+)/)?.[1]?.split(',functions:') || [];
for (const name of deployedFunctions) {
  if (!exportsByName.has(name)) errors.push(`firebase-deploy.yml: function ${name} is not exported`);
}

if (errors.length) {
  console.error(`Repository validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Repository validation passed: ${jsFiles.length} JS files, ${exportsByName.size} deployed Functions exports.`);
