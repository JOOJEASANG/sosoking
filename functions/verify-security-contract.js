const fs = require('node:fs');
const path = require('node:path');

const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');

function section(name, nextName) {
  const start = rules.indexOf(`match /${name}`);
  if (start < 0) throw new Error(`Missing Firestore rule section: ${name}`);
  const end = nextName ? rules.indexOf(`match /${nextName}`, start) : rules.length;
  return rules.slice(start, end < 0 ? rules.length : end);
}

const checks = [
  [rules.includes('request.auth.token.email_verified == true'), 'Admin email access must require verified email'],
  [section('user_names/{key}', 'cases/{caseId}').includes('allow create, update, delete: if false;'), 'Nickname reservations must be server-only'],
  [section('users/{uid}', 'user_names/{key}').includes('allow create, update, delete: if false;'), 'User profile writes and deletes must be server-only'],
  [section('cases/{caseId}', 'results/{caseId}').includes('allow delete: if false;'), 'Case deletion must use cleanup Functions'],
  [section('results/{caseId}', 'result_reactions/{caseId}').includes('allow create, delete: if false;'), 'Result creation and deletion must be server-only'],
  [rules.includes('match /admin_settings/{docId}'), 'Private admin settings collection must exist'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Security contract failed: ${message}`));
  process.exit(1);
}

console.log('Verified Firestore security contract.');
