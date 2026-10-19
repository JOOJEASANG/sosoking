import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

const trial = read('public/js/pages/trial.js');
for (const value of [
  "['filed', '사건접수'",
  "['investigation', '수사보고'",
  "['plaintiff', '원고측 변론'",
  "['defendant', '피고측 변론'",
  "['sentenced', '재판부 판결'",
  'trial-stage-page',
  'trial-progress-bar',
  'trial-court-scene',
  "data-side=\"plaintiff\"",
  "data-side=\"defendant\"",
  "data-stage='filed'",
  "data-stage='investigation'",
  "data-stage='plaintiff'",
  "data-stage='defendant'",
  "data-stage='sentenced'",
  'trial-gavel',
  'trial-magnifier',
  'trial-document',
  'prefers-reduced-motion:reduce',
  "aria-label=\"AI 재판 진행률\"",
  "location.hash = `#/verdict/${encodeURIComponent(caseId)}`",
  'generateTrial({ caseId })',
  'window._pageCleanup = stop'
]) need(trial, value, 'trial animation');

if (!trial.includes("filed: 12") || !trial.includes("sentenced: 94")) {
  errors.push('trial animation: staged progress values are missing');
}
if (!trial.includes("progressBar.style.width = '100%'") || !trial.includes('탕! 판결문 작성 완료')) {
  errors.push('trial animation: completion transition is missing');
}
if (!trial.includes('@media(max-width:390px)') || !trial.includes('@media(prefers-reduced-motion:reduce)')) {
  errors.push('trial animation: mobile or reduced-motion handling is missing');
}

const app = read('public/js/app.js');
const worker = read('public/sw.js');
const index = read('public/index.html');
const trialVersion = app.match(/\.\/pages\/trial\.js\?v=([^"']+)/)?.[1] || '';
if (!trialVersion || !worker.includes(`/js/pages/trial.js?v=${trialVersion}`)) {
  errors.push('trial animation: app and service worker trial versions differ');
}
const appVersion = index.match(/\/js\/app\.js\?v=([^"']+)/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`) || !worker.includes(`sosoking-app-v${appVersion}`)) {
  errors.push('trial animation: active app cache versions differ');
}

if (errors.length) {
  console.error(`Trial animation validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Trial animation validation passed: five-stage courtroom scene, responsive/reduced-motion handling, completion flow, and cache wiring are intact.');
