import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function sourceExports() {
  const mainPath = path.resolve('functions/main.js');
  const main = fs.readFileSync(mainPath, 'utf8');
  const modules = [...main.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)].map(match => match[1]);
  const names = new Set();

  for (const moduleName of modules) {
    const file = path.resolve(path.dirname(mainPath), `${moduleName}.js`);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    // Firebase가 실제 배포 표면으로 읽는 직접 exports.foo 할당만 수집한다.
    for (const match of source.matchAll(/(^|[^\w$.])exports\.([A-Za-z_$][\w$]*)\s*=/g)) {
      const name = match[2];
      if (!name.startsWith('_')) names.add(name);
    }
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

function payloadRecords(payload) {
  return Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.result)
      ? payload.result
      : Array.isArray(payload?.functions)
        ? payload.functions
        : [];
}

function validateDeployedFunctions(records, expected = sourceExports()) {
  const deployed = new Set(records.map(cloudFunctionName).filter(Boolean));
  return {
    expected,
    deployed,
    missing: [...expected].filter(name => !deployed.has(name)).sort(),
    unexpected: [...deployed].filter(name => !expected.has(name)).sort()
  };
}

function run(inputPath) {
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Usage: node tools/check-deployed-functions.mjs <firebase-functions-list.json>');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const records = payloadRecords(payload);
  if (!records.length && payload.status !== 'success') {
    console.error('Firebase Functions 목록 JSON을 해석하지 못했습니다.');
    process.exit(1);
  }

  const result = validateDeployedFunctions(records);
  if (result.missing.length || result.unexpected.length) {
    console.error('Deployed Functions drift detected.');
    if (result.missing.length) {
      console.error(`- Missing in Firebase: ${result.missing.join(', ')}`);
    }
    if (result.unexpected.length) {
      console.error(`- Unexpected in Firebase: ${result.unexpected.join(', ')}`);
    }
    console.error('Remove unmanaged legacy Functions or add the intended export to source before continuing deployment.');
    process.exit(1);
  }

  console.log(
    `Deployed Functions validation passed: Firebase exactly matches all ${result.expected.size} current source exports.`
  );
}

const invokedAsScript = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) run(process.argv[2]);

export {
  cloudFunctionName,
  payloadRecords,
  sourceExports,
  validateDeployedFunctions
};
