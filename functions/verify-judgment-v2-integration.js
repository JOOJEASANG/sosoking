const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

const daily = read('./daily.js');
const trial = read('../public/js/pages/trial.js');
const home = read('../public/js/pages/home.js');
const index = read('../public/index.html');

const checks = [
  [daily.includes('function isCompleteDailyPayload'), 'Daily AI full-payload validator is missing'],
  [daily.includes('isCompleteDailyPayload(parsed)'), 'Daily AI raw JSON is not validated before acceptance'],
  [daily.includes('cleanText(value.caseTitle') && daily.includes('JUDGES.includes(value.judgeType)'), 'Daily AI top-level metadata validation is incomplete'],
  [daily.includes('await db.runTransaction'), 'Daily regeneration must use a transaction'],
  [daily.includes('transaction.get(reactionRef)') && daily.includes('transaction.get(commentRef)'), 'Daily regeneration must read live reaction and comment counters'],
  [daily.includes('LEGACY_RESULT_FIELDS') && daily.includes('FieldValue.delete()'), 'Daily V2 repair must remove legacy narrative fields'],
  [trial.includes('Number(data.schemaVersion) === 2') && trial.includes('judgment.orders'), 'Trial page must recognize completed V2 judgments'],
  [trial.includes('if (isCompleteResult(data))'), 'Trial page must redirect when a V2 judgment completes'],
  [home.includes('result.judgment?.headline') && home.includes('result.judgment?.summary'), 'Home feed must display V2 judgment metadata'],
  [home.includes('result.judgment?.facts') && home.includes('resultSearchText'), 'Home search must include V2 judgment content'],
  [index.includes('/js/app.js?v=20260710-v2judgment1'), 'Index must bust the cached app entry for judgment V2'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Judgment V2 integration failed: ${message}`));
  process.exit(1);
}

console.log('Verified judgment V2 daily validation, concurrency safety, trial completion, home feed and app cache integration.');
