import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const access = read('public/js/admin-access.js');
for (const required of [
  "const ADMIN_PATH = '/admin/'",
  'function isAccountRoute()',
  "getDoc(doc(db, 'admins', user.uid))",
  "getDoc(doc(db, 'admins', email))",
  'export async function isAdminUser',
  'export async function redirectAdminAccountRoute()',
  'export function initAdminLoginRedirect()',
  'onAuthStateChanged(auth',
  'location.replace(ADMIN_PATH)'
]) {
  if (!access.includes(required)) errors.push(`public/js/admin-access.js: missing ${required}`);
}

const app = read('public/js/app.js');
const accessImport = "./admin-access.js?v=20260730-admin-redirect-1";
if (!app.includes(accessImport)) errors.push('public/js/app.js: administrator redirect module is not imported');
if (!app.includes("if (hash === '#/auth' && await redirectAdminAccountRoute()) return;")) {
  errors.push('public/js/app.js: account route does not redirect an existing administrator session');
}
const initAuthIndex = app.indexOf('await initAuth()');
const redirectListenerIndex = app.indexOf('initAdminLoginRedirect()');
const routeIndex = app.lastIndexOf('await route()');
if (initAuthIndex < 0 || redirectListenerIndex <= initAuthIndex || routeIndex <= redirectListenerIndex) {
  errors.push('public/js/app.js: administrator redirect listener must start after auth initialization and before routing');
}

const rules = read('firestore.rules');
for (const required of [
  'request.auth.uid == adminId',
  'adminEmail() == adminId',
  'allow read: if signedIn()'
]) {
  if (!rules.includes(required)) errors.push(`firestore.rules: administrator self-lookup permission missing ${required}`);
}

const bootstrap = read('public/admin/admin-bootstrap.js');
for (const required of [
  "getDoc(doc(db, 'admins', user.uid))",
  "getDoc(doc(db, 'admins', email))",
  'await mountDashboard(user)'
]) {
  if (!bootstrap.includes(required)) errors.push(`public/admin/admin-bootstrap.js: administrator dashboard authorization missing ${required}`);
}

const index = read('public/index.html');
const worker = read('public/sw.js');
for (const required of [
  '/js/app.js?v=20260730-admin-redirect-1',
  '/js/admin-access.js?v=20260730-admin-redirect-1'
]) {
  if (!worker.includes(required)) errors.push(`public/sw.js: missing ${required}`);
}
if (!index.includes('/js/app.js?v=20260730-admin-redirect-1')) {
  errors.push('public/index.html: administrator redirect app cache version is stale');
}
if (!worker.includes("sosoking-app-v20260730-admin-redirect-1")) {
  errors.push('public/sw.js: administrator redirect cache name is stale');
}

if (errors.length) {
  console.error(`Administrator login routing validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Administrator login routing validation passed: normal-site admin sign-in redirects to the shared authenticated dashboard and cache versions are synchronized.');
