import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const reports = read('functions/reports.js');
for (const exportName of ['submitReport', 'moderateReport']) {
  if (!reports.includes(`exports.${exportName}`)) {
    errors.push(`functions/reports.js: ${exportName} callable is missing`);
  }
}
if (!reports.includes('requireVerifiedUser(request)')) {
  errors.push('functions/reports.js: verified login is not required for report submission');
}
if (!reports.includes('caseSnap.data().userId === uid')) {
  errors.push('functions/reports.js: users can report their own verdicts');
}
if (!reports.includes('resultSnap.data().isPublic !== true')) {
  errors.push('functions/reports.js: non-public verdicts can be reported');
}
if (!reports.includes('report_keys/') || !reports.includes('already-exists')) {
  errors.push('functions/reports.js: duplicate report protection is missing');
}
if (!reports.includes('reportCount: FieldValue.increment(1)')) {
  errors.push('functions/reports.js: verdict report count is not synchronized');
}
for (const mutation of [
  "isPublic: false",
  "moderationStatus: 'hidden-by-report'",
  "status = action === 'hide' ? 'resolved' : 'dismissed'",
  "isAdminAuth(request.auth)"
]) {
  if (!reports.includes(mutation)) {
    errors.push(`functions/reports.js: moderation safeguard is missing: ${mutation}`);
  }
}
if (!reports.includes('Object.defineProperties(module.exports')
  || !reports.includes('submitReportData: { value: submitReportData, enumerable: false }')
  || !reports.includes('moderateReportData: { value: moderateReportData, enumerable: false }')) {
  errors.push('functions/reports.js: emulator-testable report transaction cores are missing');
}

const dialog = read('public/js/components/report-dialog.js');
if (!dialog.includes("httpsCallable(functions, 'submitReport')")) {
  errors.push('public/js/components/report-dialog.js: submitReport callable is not used');
}
if (!dialog.includes('auth.currentUser.isAnonymous') || !dialog.includes("location.hash = '#/auth'")) {
  errors.push('public/js/components/report-dialog.js: anonymous users are not directed to login');
}
if (!dialog.includes("setAttribute('aria-modal', 'true')") || !dialog.includes("event.key === 'Escape'")) {
  errors.push('public/js/components/report-dialog.js: accessible modal behavior is incomplete');
}
if (!dialog.includes("actions.querySelector('#btn-share')")) {
  errors.push('public/js/components/report-dialog.js: owners can see the report button on their own verdict');
}

const resultCourt = read('public/js/pages/result-court.js');
if (!resultCourt.includes('attachReportButton(container, caseId)')
  || !resultCourt.includes('report-dialog.js?v=20260729-report-moderation-1')) {
  errors.push('public/js/pages/result-court.js: public report dialog is not attached');
}

const admin = read('public/admin/admin.js');
if (!admin.includes("httpsCallable(functions, 'moderateReport')")) {
  errors.push('public/admin/admin.js: administrator report moderation callable is missing');
}
if (!admin.includes("['reports', '신고']") || !admin.includes('async function tabReports(target)')) {
  errors.push('public/admin/admin.js: administrator report queue is missing');
}
if (!admin.includes('data-report-action="hide"') || !admin.includes('data-report-action="dismiss"')) {
  errors.push('public/admin/admin.js: report hide or dismiss actions are missing');
}

const bootstrap = read('public/admin/admin-bootstrap.js');
if (!bootstrap.includes('./admin.js?v=20260729-report-moderation-1')) {
  errors.push('public/admin/admin-bootstrap.js: report moderation dashboard cache version is missing');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
if (!deploy.includes('functions:moderateReport')) {
  errors.push('.github/workflows/firebase-deploy.yml: moderateReport is not deployed');
}

const packageJson = read('package.json');
if (!packageJson.includes('node functions/check-report-moderation.js')) {
  errors.push('package.json: report moderation integration test is not in the test chain');
}

if (errors.length) {
  console.error(`Report moderation validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Report moderation validation passed: ownership, public UI, admin queue, atomic hiding, and deployment.');
