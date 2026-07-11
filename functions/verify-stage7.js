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
  resultVersion: 'role-based-trial-v10',
  caseId: 'case_12345678',
  isPublic: true,
  docketNumber: '2026황당123456',
  caseTitle: '테스트 사건',
  caseDescription: '공개 접수 설명',
  judgment: { engineVersion: 4, headline: '테스트 판결' },
  caseAnalysis: {},
  trialRecord: {
    resultVersion: 'role-based-trial-v10',
    docketNumber: '2026황당123456',
    courtName: '소소킹 황당재판소',
    courtroom: '제404호 황당법정',
    division: '제3황당재판부',
    recordClerk: '정기록 서기관',
    analystName: '소소경찰 박소소 경위',
    prosecutorName: '황당검사 강엄숙',
    defenderName: '국선변호인 안대수롭',
    judgeType: '과몰입형',
    refinedCaseTitle: '테스트 사건',
    expandedCase: '접수 기록',
    caseTimeline: '수사 기록',
    forensicReport: '예능용 가상 감식보고서',
    plaintiffArg: '원고 주장',
    defendantArg: '피고 변론',
    courtOpinion: '재판부 판단',
    sentence: '주문 1. 사과\n주문 2. 배상\n주문 3. 황당 처분',
    closingComment: '재판장 한마디',
    evidenceBits: ['증거 1'],
  },
  generationMode: 'gemini-role-based-trial-v10',
  moderationStatus: 'clear',
  reactionCount: 2,
  commentCount: 1,
};

const projected = buildPublicResult(source);
assert.equal(shouldPublish(source), true);
assert.equal(shouldPublish({ ...source, isPublic: false }), false);
assert.equal(projected.caseTitle, '테스트 사건');
assert.equal(projected.docketNumber, '2026황당123456');
assert.equal(projected.trialRecord.forensicReport, '예능용 가상 감식보고서');
assert.equal(projected.trialRecord.analystName, '소소경찰 박소소 경위');
assert.equal(Object.hasOwn(projected, 'userId'), false);
assert.equal(Object.hasOwn(projected, 'usage'), false);
assert.equal(Object.hasOwn(projected, 'quality'), false);
assert.equal(Object.hasOwn(projected, 'model'), false);

const checks = [
  rules.includes('match /public_results/{caseId}') && rules.includes('allow read: if true'),
  rules.includes('documents/public_results/$(caseId)'),
  community.includes("collection(db, 'public_results')"),
  community.includes("doc(db, 'public_results', caseId)"),
  judgment.indexOf("doc(db, 'public_results', caseId)") < judgment.indexOf("doc(db, 'results', caseId)"),
  judgment.includes('result?.trialRecord') && judgment.includes('CCTV·증거 감식보고서'),
  sync.includes('onDocumentWritten'),
  sync.includes('exports.backfillPublicResults'),
  sync.includes('while (true)') && sync.includes('startAfter(cursor)') && sync.includes('FieldPath.documentId()'),
  adminUi.includes('공개 데이터 동기화'),
  bootstrap.includes("require('./public-result-sync')"),
];

if (checks.some(ok => !ok)) {
  console.error('Stage 7 verification failed.');
  process.exit(1);
}
console.log('Verified Stage 7 safe public role-trial projection, no internal metadata leakage and paginated backfill.');
