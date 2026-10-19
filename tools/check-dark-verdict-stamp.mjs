import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const css = read('public/css/result-dark-contrast.css');
for (const required of [
  "[data-theme='dark'] .result-document-page .result-paper .verdict-stamp",
  'color: #ff9f96 !important;',
  'border-color: rgba(255, 159, 150, 0.82) !important;',
  'background: rgba(126, 34, 31, 0.18) !important;',
  'opacity: 0.88 !important;'
]) {
  if (!css.includes(required)) {
    errors.push(`public/css/result-dark-contrast.css: dark verdict stamp rule missing ${required}`);
  }
}

const index = read('public/index.html');
if (!index.includes('/css/result-dark-contrast.css?v=20260731-dark-verdict-stamp-1')) {
  errors.push('public/index.html: dark verdict stamp stylesheet is not loaded');
}

const trialGenerator = read('functions/generate-trial-lite.js') + read('functions/verdict-prompt.js');
for (const required of [
  'function buildPrompt(description, judge, grievanceIndex, retry = false)',
  'reception:',
  'investigation:',
  'plaintiffArg:',
  'defendantArg:',
  'verdict:'
]) {
  if (!trialGenerator.includes(required)) {
    errors.push(`functions/generate-trial-lite.js: AI result contract changed unexpectedly ${required}`);
  }
}

if (errors.length) {
  console.error(`Dark verdict stamp validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Dark verdict stamp validation passed: the decorative stamp is readable without changing AI result generation.');
