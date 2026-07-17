const fs = require('node:fs');
const path = require('node:path');
const {
  validDocumentId,
  sensitiveContentReasons,
  publicAuthorId,
  validatedProfilePhotoUrl,
} = require('./security-utils');

const read = relative => fs.readFileSync(path.resolve(__dirname, relative), 'utf8');
const rules = read('../firestore.rules');
const storageRules = read('../storage.rules');
const firebaseConfig = JSON.parse(read('../firebase.json'));
const main = read('./main.js');
const social = read('./social.js');
const reporting = read('./reporting.js');
const submit = read('./submit-secure.js');
const generator = read('./generate-trial-v2.js');
const visibility = read('./visibility.js');
const profile = read('./profile.js');
const titleSuggestion = read('./title-suggestion.js');
const repair = read('./repair.js');
const resultWrapper = read('../public/js/pages/result-case-story.js');
const adminTools = read('../public/admin/admin-ai-tools.js');

function section(name, nextName) {
  const start = rules.indexOf(`match /${name}`);
  if (start < 0) throw new Error(`Missing Firestore rule section: ${name}`);
  const end = nextName ? rules.indexOf(`match /${nextName}`, start) : rules.length;
  return rules.slice(start, end < 0 ? rules.length : end);
}

function throws(fn) {
  try { fn(); return false; } catch { return true; }
}

const siteSettings = section('site_settings/{docId}', 'public_settings/{docId}');
const publicSettings = section('public_settings/{docId}', 'admin_settings/{docId}');
const cases = section('cases/{caseId}', 'results/{caseId}');
const results = section('results/{caseId}', 'result_reactions/{caseId}');
const reports = section('reports/{reportId}', 'absurd_cases/{caseId}');
const headers = Object.fromEntries((firebaseConfig.hosting?.headers?.find(item => item.source === '**')?.headers || []).map(item => [item.key, item.value]));
const expectedPhotoUrl = 'https://firebasestorage.googleapis.com/v0/b/sosoking-481e6.firebasestorage.app/o/profile-photos%2Fuser_123%2Favatar.jpg?alt=media&token=test';

const checks = [
  [rules.includes('request.auth.token.email_verified == true'), 'Admin email access must require verified email'],
  [section('user_names/{key}', 'cases/{caseId}').includes('allow read, create, update, delete: if false;'), 'Nickname index must remain server-only'],
  [section('users/{uid}', 'user_names/{key}').includes('allow create, update, delete: if false;'), 'Profiles must remain server-written'],
  [cases.includes('allow create, update, delete: if false;') && results.includes('allow create, update, delete: if false;'), 'Case and result mutations must use Functions'],
  [siteSettings.includes('allow read, write: if isAdmin();') && publicSettings.includes('allow read: if true;'), 'Private and public settings separation is invalid'],
  [rules.includes('match /vote_limits/{userId}') && rules.includes('match /appeal_limits/{userId}') && rules.includes('match /report_limits/{userId}'), 'Social usage limit rules are missing'],
  [rules.includes('match /submit_reservations/{reservationId}') && rules.includes('match /appeal_reservations/{reservationId}'), 'Recovery reservations must be client-inaccessible'],
  [reports.includes('allow create, update, delete: if false;'), 'Reports must deny direct client writes'],
  [main.includes("require('./visibility')") && main.includes("require('./reporting')"), 'Secured publishing or reporting export is missing'],
  [visibility.includes('db.runTransaction') && visibility.includes('assertNoSensitiveContent'), 'Publishing must be atomic and privacy-checked'],
  [visibility.includes('resultUpdate.userId = FieldValue.delete()') && visibility.includes('resultUpdate.imageAttachmentMeta = FieldValue.delete()'), 'Publishing must remove owner and attachment identifiers'],
  [visibility.includes('appeal.reason') && visibility.includes('appeal.verdict'), 'Publishing checks must include appeal records'],
  [reporting.includes('REPORT_DAILY_LIMIT') && reporting.includes('REPORT_COOLDOWN_SEC') && reporting.includes('publicAuthorId(uid, caseId)'), 'Reports must be rate-limited and case-deduplicated'],
  [resultWrapper.includes("httpsCallable(functions, 'reportResult')") && resultWrapper.includes("location.hash = '#/auth'"), 'Reporting UI must use the secured callable'],
  [submit.includes('requireVerifiedUser') && submit.includes('assertNoSensitiveContent') && submit.includes('hasValidImageSignature'), 'Submission validation is incomplete'],
  [submit.includes('isPublic: false') && !submit.includes('const isPublic = boolValue(data.isPublic'), 'New cases must be forced private'],
  [generator.includes('isPublic: false') && !generator.includes('ownerId: caseData.userId') && !generator.includes('imageAttachmentMeta: attachmentMeta'), 'Generated result privacy is incomplete'],
  [repair.includes('deleteOrphanCaseImages') && repair.includes('appeal_reservations'), 'Stale processing recovery is incomplete'],
  [repair.includes('scrubPublicResultIdentifiers') && repair.includes('scrubPublicCommentIdentifiers'), 'Existing public identifiers must be scrubbed'],
  [repair.includes('auditLegacyPublicCaseIds') && adminTools.includes('auditLegacyPublicCaseIdsNow'), 'Legacy public ID audit is missing'],
  [adminTools.includes('scrubPublicResultIdentifiersNow') && adminTools.includes('res.data?.trials') && adminTools.includes('res.data?.reservations'), 'Admin recovery or scrub UI is incomplete'],
  [social.includes('VOTE_DAILY_LIMIT') && social.includes("db.doc(`vote_limits/${uid}`)"), 'Vote changes must be rate-limited'],
  [!social.includes('authorId:') && !social.includes('transaction.set(commentRef, { uid'), 'Public comments must not store user identifiers'],
  [social.includes('APPEAL_DAILY_LIMIT') && social.includes('failAppealReservation'), 'Appeals must use limits and failure refunds'],
  [titleSuggestion.includes('finishReservation') && titleSuggestion.includes('assertNoSensitiveContent'), 'Title suggestions must refund failed calls'],
  [profile.includes('validatedProfilePhotoUrl') && profile.includes('requireVerifiedUser'), 'Profile validation is incomplete'],
  [storageRules.includes("fileName == 'avatar.jpg'") && storageRules.includes("request.resource.contentType == 'image/jpeg'"), 'Profile Storage restrictions are missing'],
  [headers['X-Content-Type-Options'] === 'nosniff' && headers['X-Frame-Options'] === 'DENY', 'Hosting security headers are missing'],
  [throws(() => validDocumentId('cases/user/evil')) && validDocumentId('case_123-safe') === 'case_123-safe', 'Document ID validation failed'],
  [sensitiveContentReasons('연락처는 010-1234-5678입니다').includes('전화번호'), 'Phone detection failed'],
  [sensitiveContentReasons('서울시 강남구 테헤란로 123').includes('상세 주소'), 'Address detection failed'],
  [sensitiveContentReasons('OO초등학교 학생 이야기').includes('학교·병원·아파트 등 특정 장소'), 'Named-place detection failed'],
  [publicAuthorId('raw-user-id', 'case-a') === publicAuthorId('raw-user-id', 'case-a') && publicAuthorId('raw-user-id', 'case-a') !== publicAuthorId('raw-user-id', 'case-b'), 'Case-scoped report pseudonyms failed'],
  [validatedProfilePhotoUrl(expectedPhotoUrl, 'user_123') === expectedPhotoUrl, 'Owned profile URL must be accepted'],
  [throws(() => validatedProfilePhotoUrl('https://example.com/tracker.png', 'user_123')), 'External profile URLs must be rejected'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Security contract failed: ${message}`));
  process.exit(1);
}
console.log('Verified Firestore, Storage, Hosting and application security contracts.');