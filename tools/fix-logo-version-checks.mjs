import fs from 'node:fs';

const path = 'tools/check-own-case-deletion.mjs';
let source = fs.readFileSync(path, 'utf8');

function replaceAll(from, to, expected) {
  const count = source.split(from).length - 1;
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} occurrence(s) of ${from}, found ${count}`);
  }
  source = source.split(from).join(to);
}

replaceAll('/js/app.js?v=20260729-own-case-delete-1', '/js/app.js?v=20260729-brand-unified-1', 2);
replaceAll('sosoking-app-v20260729-own-case-delete-1', 'sosoking-app-v20260729-brand-unified-1', 1);

fs.writeFileSync(path, source);
console.log('Updated cross-feature cache validation for unified branding.');
