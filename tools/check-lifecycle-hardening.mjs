import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const social = read('functions/social.js');
for (const required of [
  'function isDeletionLocked(...records)',
  'function isModerationHidden(...records)',
  'assertVisibilityChangeAllowed(caseData, resultData, isPublic);',
  "운영 검토로 숨김 처리된 판결문은 다시 공개할 수 없습니다.",
  'const [latestResultSnap, voteSnap] = await Promise.all([',
  'const latestResultSnap = await tx.get(resultRef);',
  'assertParticipablePublicResult(latestResultSnap.data());',
  "tx.update(resultRef, {\n        reactionTotal: FieldValue.increment(1)",
  "tx.update(resultRef, {\n      commentCount: FieldValue.increment(1)",
  "삭제 중인 사건은 항소할 수 없습니다.",
  'const [latestResult, latestCase] = await Promise.all([',
  "tx.update(caseRef, {\n        hasAppeal: true"
]) {
  if (!social.includes(required)) errors.push(`functions/social.js: missing lifecycle guard ${required}`);
}
if (social.includes("tx.set(resultRef, {\n        reactionTotal: FieldValue.increment(1)")) {
  errors.push('functions/social.js: vote path may recreate a deleted result document');
}
if (social.includes("batch.set(resultRef, {\n    commentCount: FieldValue.increment(1)")) {
  errors.push('functions/social.js: comment path still uses a non-transactional result write');
}

const adminVisibility = read('functions/admin-visibility.js');
for (const required of [
  'function isDeletionLocked(...records)',
  "삭제 중인 사건은 공개 상태를 변경할 수 없습니다.",
  'moderationStatus: isPublic ? FieldValue.delete()'
]) {
  if (!adminVisibility.includes(required)) errors.push(`functions/admin-visibility.js: missing ${required}`);
}

const publicOriginal = read('functions/public-original.js');
for (const required of [
  "const { enforceActionRateLimit, requireAppCheck } = require('./security');",
  'maxInstances: 20',
  'requireAppCheck(request);',
  "enforceActionRateLimit(requesterUid, 'public-original'",
  'function isSanitizedPublicResult(data = {})',
  'data.isPublic === true',
  'Number(data.publicDataVersion || 0) === 1',
  "!Object.prototype.hasOwnProperty.call(data, 'caseDescription')",
  'function isDeletionLocked(...records)'
]) {
  if (!publicOriginal.includes(required)) errors.push(`functions/public-original.js: missing ${required}`);
}

const reports = read('functions/reports.js');
if (!reports.includes("moderationStatus: 'hidden-by-report'")) {
  errors.push('functions/reports.js: report hide marker is missing');
}

const deployedCheck = read('tools/check-deployed-functions.mjs');
for (const required of [
  'if (result.missing.length || result.unexpected.length)',
  '- Unexpected in Firebase:',
  'process.exit(1);'
]) {
  if (!deployedCheck.includes(required)) errors.push(`tools/check-deployed-functions.mjs: missing strict drift guard ${required}`);
}
if (deployedCheck.includes('reported without blocking deployment')) {
  errors.push('tools/check-deployed-functions.mjs: unmanaged Functions are still non-blocking');
}

const prValidation = read('.github/workflows/pull-request-validation.yml');
for (const required of [
  'pull_request:',
  'branches: [main]',
  'node-version: 22',
  "java-version: '21'",
  'firebase-tools@15.24.0',
  'run: npm test'
]) {
  if (!prValidation.includes(required)) errors.push(`pull-request-validation.yml: missing ${required}`);
}

const gitignore = read('.gitignore');
for (const required of ['*service-account*.json', 'firebase-adminsdk-*.json', '*.local']) {
  if (!gitignore.includes(required)) errors.push(`.gitignore: missing sensitive/local pattern ${required}`);
}

if (errors.length) {
  console.error(`Lifecycle and operational hardening validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Lifecycle and operational hardening validation passed: moderation, deletion races, public originals, PR validation, secret-file ignores, and strict deployed-function drift checks are intact.');
