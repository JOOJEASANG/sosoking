import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2];
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('Usage: node tools/check-deployed-functions.mjs <firebase-functions-list.json>');
  process.exit(1);
}

function sourceExports() {
  const mainPath = path.resolve('functions/main.js');
  const main = fs.readFileSync(mainPath, 'utf8');
  const modules = [...main.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)].map(match => match[1]);
  const names = new Set();
  for (const moduleName of modules) {
    const file = path.resolve(path.dirname(mainPath), `${moduleName}.js`);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(match[1]);
  }
  return names;
}

function cloudFunctionName(item) {
  const raw = String(
    item?.id
    || item?.name
    || item?.function
    || item?.entryPoint
    || item?.entry_point
    || ''
  );
  if (!raw) return '';
  const tail = raw.split('/').filter(Boolean).at(-1) || raw;
  return tail.replace(/-[a-z0-9]+$/i, match => /^-[a-f0-9]{8,}$/.test(match) ? '' : match);
}

const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const records = Array.isArray(payload)
  ? payload
  : Array.isArray(payload.result)
    ? payload.result
    : Array.isArray(payload.functions)
      ? payload.functions
      : [];

if (!records.length && payload.status !== 'success') {
  console.error('Firebase Functions 목록 JSON을 해석하지 못했습니다.');
  process.exit(1);
}

const expected = sourceExports();
const deployed = new Set(records.map(cloudFunctionName).filter(Boolean));
const missing = [...expected].filter(name => !deployed.has(name)).sort();
const unexpected = [...deployed].filter(name => !expected.has(name)).sort();

if (missing.length || unexpected.length) {
  console.error('Deployed Functions drift detected.');
  if (missing.length) console.error(`- Missing in Firebase: ${missing.join(', ')}`);
  if (unexpected.length) console.error(`- Unexpected in Firebase: ${unexpected.join(', ')}`);
  process.exit(1);
}

console.log(`Deployed Functions validation passed: ${deployed.size} cloud functions match source exports.`);
