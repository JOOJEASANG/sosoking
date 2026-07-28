import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');

const submit = read('functions/submit-secure.js');
if (!submit.includes("db.collection('cases').doc()")) {
  errors.push('functions/submit-secure.js: opaque Firestore-generated case ID is missing');
}
if (/caseId\s*=\s*`\$\{uid\}_/.test(submit)) {
  errors.push('functions/submit-secure.js: Firebase UID is embedded in the public case ID');
}

const authoritativeAdminFiles = [
  'functions/admin-utils.js',
  'firestore.rules',
  'public/js/components/admin-redirect.js',
  'public/admin/admin-bootstrap.js'
];
for (const file of authoritativeAdminFiles) {
  const source = read(file);
  if (source.includes('BOOTSTRAP_OWNER') || source.includes('sosoday1976@gmail.com')) {
    errors.push(`${file}: hard-coded administrator identity remains`);
  }
}

const main = read('functions/main.js');
if (!main.includes("require('./admin-visibility')")) {
  errors.push('functions/main.js: secure admin visibility module is not exported');
}

const adminVisibility = read('functions/admin-visibility.js');
if (!adminVisibility.includes('userId: FieldValue.delete()')) {
  errors.push('functions/admin-visibility.js: legacy UID cleanup is missing');
}
if (!adminVisibility.includes('isAdminAuth(request.auth)')) {
  errors.push('functions/admin-visibility.js: server-side admin authorization is missing');
}

const adminIndex = read('public/admin/index.html');
if (!adminIndex.includes('/admin/admin-bootstrap.js')) {
  errors.push('public/admin/index.html: strict admin bootstrap is not loaded');
}
if (adminIndex.includes('src="/admin/admin.js')) {
  errors.push('public/admin/index.html: legacy admin module bypasses the strict bootstrap');
}

const adminOverrides = read('public/admin/admin-security-overrides.js');
if (!adminOverrides.includes("httpsCallable(functions, 'setAdminResultVisibility')")) {
  errors.push('public/admin/admin-security-overrides.js: admin visibility still bypasses the server callable');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
if (!deploy.includes('functions:setAdminResultVisibility')) {
  errors.push('.github/workflows/firebase-deploy.yml: secure admin visibility function is not deployed');
}

if (errors.length) {
  console.error(`Security regression validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Security regression validation passed: opaque case IDs and Firestore-backed admin authorization.');
