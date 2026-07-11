const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPublicResult, shouldPublish } = require('./public-result-projection');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const rules = read('firestore.rules');
const community = read('public/js/community-ui.js');
const judgment = read('public/js/judgment-ui.js');
const adminUi = read('public/js/admin-ui.js');
const sync = read('functions/public-result-sync.js');
const bootstrap = read('functions/bootstrap.js');

const source = {
  caseId: 'case_12345678', isPublic: true, caseTitle: '테스트', caseDescription: '설명',
  judgment: { headline: '판결' }, caseAnalysis: {}, generationMode: 'gemini',
  moderationStatus: 'clear', reactionCount: 2, commentCount: 1,
};
const projected = buildPublicResult(source);
assert.equal(shouldPublish(source), true);
assert.equal(shouldPublish({ ...source, isPublic: false }), false);
assert.equal(projected.caseTitle, '테스트');
assert.deepEqual(Object.keys(projected).sort(), [
  'caseAnalysis','caseDescription','caseId','caseTitle','category','commentCount','createdAt',
  'defendantName','desiredVerdict','generationMode','grievanceIndex','isPublic','judgeType',
  'judgment','moderationStatus','reactionCount','schemaVersion','updatedAt',
].sort());

const checks = [
  rules.includes('match /public_results/{caseId}'),
  rules.includes('documents/public_results/$(caseId)'),
  community.includes("collection(db, 'public_results')"),
  community.includes("doc(db, 'public_results', caseId)"),
  judgment.indexOf("doc(db, 'public_results', caseId)") < judgment.indexOf("doc(db, 'results', caseId)"),
  sync.includes('onDocumentWritten'),
  sync.includes('exports.backfillPublicResults'),
  adminUi.includes('공개 데이터 동기화'),
  bootstrap.includes("require('./public-result-sync')"),
];

if (checks.some(ok => !ok)) {
  console.error('Stage 7 verification failed.');
  process.exit(1);
}
console.log('Verified Stage 7 safe public result projection and access isolation.');
