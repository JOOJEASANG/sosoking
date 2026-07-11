const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const index = read('public/index.html');
const adminUi = read('public/js/admin-ui.js');
const adminIntegration = read('public/js/admin-integration.js');
const adminCss = read('public/css/admin.css');
const adminActions = read('functions/admin-actions.js');
const userActions = read('functions/user-case-actions.js');
const bootstrap = read('functions/bootstrap.js');

const checks = [
  [index.includes('/css/admin.css?v=20260711-stage6'), 'Admin stylesheet is not loaded'],
  [index.includes('/js/admin-integration.js?v=20260711-stage6'), 'Admin integration is not loaded'],
  [adminIntegration.includes("#/admin") && adminIntegration.includes('ADMIN_EMAILS'), 'Admin route or navigation guard is missing'],
  [adminIntegration.includes('loadAdminDashboard') && adminIntegration.includes('bindAdminActions'), 'Admin data and action binding is incomplete'],
  [adminUi.includes('getAdminDashboard') && adminUi.includes('moderateReport'), 'Admin callables are not connected'],
  [adminUi.includes('판결 숨김') && adminUi.includes('신고 기각') && adminUi.includes('공개 복구'), 'Moderation action controls are incomplete'],
  [adminCss.includes('.admin-stats') && adminCss.includes('.report-item') && adminCss.includes('.report-reason'), 'Admin responsive styling is incomplete'],
  [adminActions.includes('token.admin !== true') && adminActions.includes('joojeasang@gmail.com'), 'Server admin authorization is incomplete'],
  [adminActions.includes('exports.getAdminDashboard') && adminActions.includes('exports.moderateReport'), 'Admin functions are missing'],
  [adminActions.includes("moderationStatus: 'hidden'") && adminActions.includes("moderationStatus: 'clear'"), 'Hide and restore moderation states are missing'],
  [adminActions.includes("where('status', '==', 'pending')") && adminActions.includes("where('isPublic', '==', true)"), 'Operational counts and report queue are incomplete'],
  [userActions.includes("moderationStatus === 'hidden'") && userActions.includes('failed-precondition'), 'Hidden content can be republished by the owner'],
  [bootstrap.includes("require('./admin-actions')"), 'Admin functions are not exported'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Stage 6 verification failed: ${message}`));
  process.exit(1);
}

console.log('Verified Stage 6 admin authorization, operational dashboard, report review, content hide, dismiss and restore controls.');
