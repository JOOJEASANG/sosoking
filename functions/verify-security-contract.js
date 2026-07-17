const fs = require('node:fs');
const path = require('node:path');
const {
  validDocumentId,
  sensitiveContentReasons,
  publicAuthorId,
  validatedProfilePhotoUrl,
} = require('./security-utils');

const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');
const storageRules = fs.readFileSync(path.resolve(__dirname, '../storage.rules'), 'utf8');
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../firebase.json'), 'utf8'));
const main = fs.readFileSync(path.resolve(__dirname, './main.js'), 'utf8');
const social = fs.readFileSync(path.resolve(__dirname, './social.js'), 'utf8');
const reporting = fs.readFileSync(path.resolve(__dirname, './reporting.js'), 'utf8');
const submit = fs.readFileSync(path.resolve(__dirname, './submit-secure.js'), 'utf8');
const generator = fs.readFileSync(path.resolve(__dirname, './generate-trial-v2.js'), 'utf8');
const visibility = fs.readFileSync(path.resolve(__dirname, './visibility.js'), 'utf8');
const profile = fs.readFileSync(path.resolve(__dirname, './profile.js'), 'utf8');
const titleSuggestion = fs.readFileSync(path.resolve(__dirname, './title-suggestion.js'), 'utf8');
const repair = fs.readFileSync(path.resolve(__dirname, './repair.js'), 'utf8');
const resultWrapper = fs.readFileSync(path.resolve(__dirname, '../public/js/pages/result-case-story.js'), 'utf8');

function section(name, nextName) {
  const start = rules.indexOf(`match /${name}`);
  if (start < 0) throw new Error(`Missing Firestore rule section: ${name}`);
  const end = nextName ? rules.indexOf(`match /${nextName}`, start) : rules.length;
  return rules.slice(start, end < 0 ? rules.length : end);
}

function throws(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

const siteSettings = section('site_settings/{docId}', 'public_settings/{docId}');
const publicSettings = section('public_settings/{docId}', 'admin_settings/{docId}');
const cases = section('cases/{caseId}', 'results/{caseId}');
const results = section('results/{caseId}', 'result_reactions/{caseId}');
const userNames = section('user_names/{key}', 'cases/{caseId}');
const reports = section('reports/{reportId}', 'absurd_cases/{caseId}');
const headers = firebaseConfig.hosting?.headers || [];
const globalHeaderValues = Object.fromEntries(
  (headers.find(item => item.source === '**')?.headers || []).map(item => [item.key, item.value]),
);

const expectedPhotoUrl = 'https://firebasestorage.googleapis.com/v0/b/sosoking-481e6.firebasestorage.app/o/profile-photos%2Fuser_123%2Favatar.jpg?alt=media&token=test';
const checks = [
  [rules.includes('request.auth.token.email_verified == true'), 'Admin email access must require verified email'],
  [userNames.includes('allow read, create, update, delete: if false;'), 'Nickname index must not expose UIDs to clients'],
  [section('users/{uid}', 'user_names/{key}').includes('allow create, update, delete: if false;'), 'User profile writes and deletes must be server-only'],
  [cases.includes('allow create, update, delete: if false;'), 'All case mutations must use server Functions'],
  [results.includes('allow create, update, delete: if false;'), 'All result mutations must use server Functions'],
  [siteSettings.includes('allow read, write: if isAdmin();'), 'Operating settings must be admin-only'],
  [publicSettings.includes('allow read: if true;'), 'Public settings must remain readable'],
  [publicSettings.includes("'dailyLimit', 'cooldownSec', 'businessInfo', 'publicNotice', 'updatedAt'"), 'Public settings writes must use the field whitelist'],
  [rules.includes('match /vote_limits/{userId}') && rules.includes('match /appeal_limits/{userId}'), 'Vote and appeal limit collection rules are missing'],
  [rules.includes('match /submit_reservations/{reservationId}') && rules.includes('match /appeal_reservations/{reservationId}'), 'Failure-recovery reservations must be client-inaccessible'],
  [rules.includes('match /report_limits/{userId}') && reports.includes('allow create, update, delete: if false;'), 'Reports must use server-side limits and deny direct client writes'],
  [main.includes("require('./visibility')"), 'Visibility Function must be exported'],
  [main.includes("require('./reporting')"), 'Reporting Function must be exported'],
  [visibility.includes('db.runTransaction') && visibility.includes('assertNoSensitiveContent'), 'Publishing must be atomic and privacy-checked'],
  [visibility.includes('resultUpdate.userId = FieldValue.delete()') && visibility.includes('resultUpdate.imageAttachmentMeta = FieldValue.delete()'), 'Publishing must remove owner identifiers and private attachment paths'],
  [visibility.includes('appeal.reason') && visibility.includes('appeal.verdict'), 'Publishing privacy checks must include appeal records'],
  [reporting.includes('REPORT_DAILY_LIMIT') && reporting.includes('REPORT_COOLDOWN_SEC') && reporting.includes('db.runTransaction'), 'Reports must use daily limits, cooldown and a transaction'],
  [reporting.includes('ownerId === uid') && reporting.includes('publicAuthorId(uid, caseId)'), 'Reports must block self-reporting and deduplicate per case'],
  [resultWrapper.includes("httpsCallable(functions, 'reportResult')") && resultWrapper.includes("location.hash = '#/auth'"), 'Public result reporting must use the server Function and verified login flow'],
  [submit.includes('requireVerifiedUser') && submit.includes('assertNoSensitiveContent'), 'Case submission must require verified users and privacy checks'],
  [submit.includes('hasValidImageSignature') && submit.includes('finishSubmitReservation'), 'Case image and quota failure recovery are incomplete'],
  [submit.includes('isPublic: false') && !submit.includes('const isPublic = boolValue(data.isPublic'), 'New cases must always be server-forced private'],
  [generator.includes('isPublic: false') && !generator.includes('ownerId: caseData.userId'), 'Generated user results must start private and omit owner UIDs'],
  [generator.includes('hasImageAttachment(caseData)') && !generator.includes('imageAttachmentMeta: attachmentMeta'), 'Public-capable result documents must not copy private attachment metadata'],
  [repair.includes('caseSnap?.exists') && repair.includes('deleteOrphanCaseImages'), 'Stale reservations must preserve completed cases and clean orphan images'],
  [repair.includes("['appeal_reservations', 'appeal_limits']") && repair.includes('scrubPublicResultIdentifiers'), 'Appeal reservations and existing public identifiers must be recoverable'],
  [generator.includes('const batch = db.batch()') && generator.includes('await batch.commit()'), 'Judgment result and case completion must be atomic'],
  [social.includes('VOTE_DAILY_LIMIT') && social.includes("db.doc(`vote_limits/${uid}`)"), 'Reaction changes must have server-side usage limits'],
  [social.includes('publicAuthorId(uid, caseId)') && !social.includes("transaction.set(commentRef, { uid,"), 'Public comments must use case-scoped pseudonyms without raw Firebase UIDs'],
  [social.includes("status: 'processing'") && social.includes('APPEAL_DAILY_LIMIT') && social.includes('failAppealReservation'), 'Appeals must use a lock, daily limit and failure refund'],
  [titleSuggestion.includes('finishReservation') && titleSuggestion.includes('assertNoSensitiveContent'), 'Title suggestions must refund failures and filter sensitive input'],
  [profile.includes('validatedProfilePhotoUrl') && profile.includes('requireVerifiedUser'), 'Profile updates must validate ownership and verified login'],
  [storageRules.includes("fileName == 'avatar.jpg'") && storageRules.includes("request.resource.contentType == 'image/jpeg'"), 'Profile Storage path and MIME restrictions are missing'],
  [globalHeaderValues['X-Content-Type-Options'] === 'nosniff', 'nosniff Hosting header is missing'],
  [globalHeaderValues['X-Frame-Options'] === 'DENY', 'Clickjacking protection header is missing'],
  [throws(() => validDocumentId('cases/user/evil')), 'Document IDs containing path separators must be rejected'],
  [validDocumentId('case_123-safe') === 'case_123-safe', 'Safe document IDs must remain valid'],
  [sensitiveContentReasons('연락처는 010-1234-5678입니다').includes('전화번호'), 'Phone-number detection failed'],
  [sensitiveContentReasons('서울시 강남구 테헤란로 123').includes('상세 주소'), 'Address detection failed'],
  [sensitiveContentReasons('OO초등학교 학생 이야기').includes('학교·병원·아파트 등 특정 장소'), 'Named-place detection failed'],
  [publicAuthorId('raw-user-id', 'case-a') !== 'raw-user-id' && publicAuthorId('raw-user-id', 'case-a') === publicAuthorId('raw-user-id', 'case-a'), 'Public author IDs must be stable and pseudonymous'],
  [publicAuthorId('raw-user-id', 'case-a') !== publicAuthorId('raw-user-id', 'case-b'), 'Public author IDs must not correlate users across cases'],
  [validatedProfilePhotoUrl(expectedPhotoUrl, 'user_123') === expectedPhotoUrl, 'Owned Firebase profile URL must be accepted'],
  [throws(() => validatedProfilePhotoUrl('https://example.com/tracker.png', 'user_123')), 'External profile image URLs must be rejected'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Security contract failed: ${message}`));
  process.exit(1);
}

console.log('Verified Firestore, Storage, Hosting and application security contracts.');