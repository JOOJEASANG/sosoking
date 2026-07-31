import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const displayGuard = read('public/js/document-display-guard.js');
for (const required of [
  'normalizeCourtText',
  'structuredFragment',
  '.result-paper-body,.step-content',
  'doc-order-item',
  'court-formatted-body',
  "replace(/([.!?。)])\\s*(?=(?:\\d{1,2})\\.\\s+)/g, '$1\\n')",
  'new MutationObserver'
]) {
  if (!displayGuard.includes(required)) {
    errors.push(`public/js/document-display-guard.js: formatting guard missing: ${required}`);
  }
}

const index = read('public/index.html');
if (!index.includes('/js/document-display-guard.js?v=20260731-document-format-1')) {
  errors.push('public/index.html: document display guard is not loaded with a versioned URL');
}

const main = read('functions/main.js');
const humorIndex = main.indexOf("require('./humor-prompt')");
const qualityIndex = main.indexOf("require('./document-output-quality')");
const trialIndex = main.indexOf("require('./generate-trial-lite')");
if (humorIndex < 0 || qualityIndex < 0 || trialIndex < 0 || qualityIndex < humorIndex || qualityIndex > trialIndex) {
  errors.push('functions/main.js: document output quality patch must load after humor rules and before trial functions');
}

const quality = require('../functions/document-output-quality.js');
const payload = {
  contents: [{
    role: 'user',
    parts: [{
      text: "소소킹 판결소 reception investigation plaintiffArg defendantArg verdict"
    }]
  }],
  generationConfig: {
    temperature: 0.9,
    maxOutputTokens: 4096,
    responseSchema: { type: 'object' }
  }
};

if (!quality.applyDocumentQuality(payload)) {
  errors.push('functions/document-output-quality.js: matching court prompt was not patched');
}
if (!payload.contents[0].parts[0].text.includes(quality.QUALITY_MARKER)) {
  errors.push('functions/document-output-quality.js: quality instructions were not appended');
}
if (payload.generationConfig.maxOutputTokens !== 6144) {
  errors.push('functions/document-output-quality.js: output token allowance was not raised to 6144');
}
if (payload.generationConfig.responseSchema?.type !== 'object') {
  errors.push('functions/document-output-quality.js: existing response schema was changed');
}
if (quality.applyDocumentQuality(payload)) {
  errors.push('functions/document-output-quality.js: quality instructions were appended more than once');
}

for (const required of [
  '어떤 필드도 조사, 연결어, 따옴표 또는 미완성 문장으로 끝내지 않는다',
  '번호 목록은 항목마다 반드시 새 줄에서 시작한다',
  '소수점, 날짜, K/D 수치는 목록 번호로 취급하지 않는다',
  '기존 여섯 키만 출력'
]) {
  if (!quality.QUALITY_RULES.includes(required)) {
    errors.push(`functions/document-output-quality.js: completeness rule missing: ${required}`);
  }
}

if (errors.length) {
  console.error(`Document formatting validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Document formatting validation passed: numbered items are separated in the UI and AI documents receive completeness rules without changing the response schema.');
