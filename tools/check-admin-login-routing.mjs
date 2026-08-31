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
const timeoutIndex = app.indexOf('startIdleSessionTimeout({ auth, onTimeout: autoLogoutInactiveUser });');
const redirectListenerIndex = app.indexOf('initAdminLoginRedirect()');
const routeIndex = app.lastIndexOf('await route()');
if (initAuthIndex < 0 || timeoutIndex <= initAuthIndex || redirectListenerIndex <= timeoutIndex || routeIndex <= redirectListenerIndex) {
  errors.push('public/js/app.js: idle timeout and administrator redirect listener must start after auth initialization and before routing');
}

const rules = read('firestore.rules');
for (const required of [
  'request.auth.uid == adminId',
  'adminEmail() == adminId',
  'allow read: if signedIn()',
  'allow list: if isAdmin() || isPublicResultListData(resource.data);'
]) {
  if (!rules.includes(required)) errors.push(`firestore.rules: administrator access requirement missing ${required}`);
}

const bootstrap = read('public/admin/admin-bootstrap.js');
for (const required of [
  "getDoc(doc(db, 'admins', user.uid))",
  "getDoc(doc(db, 'admins', email))",
  'await mountDashboard(user)',
  "const HOME_PATH = '/#/';",
  'async function signOutToHome()',
  'async function signOutForIdleTimeout()',
  'startIdleSessionTimeout({ auth, onTimeout: signOutForIdleTimeout });',
  'await signOut(auth)',
  'location.replace(HOME_PATH)',
  "actions.querySelector('#admin-logout')?.addEventListener('click', () => void signOutToHome())",
  "document.getElementById('strict-noaccess-logout')?.addEventListener('click', () => void signOutToHome())",
  'if (!logoutRedirectStarted) renderLogin()'
]) {
  if (!bootstrap.includes(required)) errors.push(`public/admin/admin-bootstrap.js: administrator routing missing ${required}`);
}

const adminPolicy = read('public/admin/admin-policy-defaults.js');
for (const required of [
  "import { renderPolicy } from '../js/pages/policy.js?v=20260830-final-audit-1'",
  'async function currentSitePolicy(type)',
  "root.querySelector('#policy-content')",
  'textarea.value = content',
  '수정 후 저장하면 공개 정책 페이지에 바로 적용됩니다.',
  'new MutationObserver'
]) {
  if (!adminPolicy.includes(required)) errors.push(`public/admin/admin-policy-defaults.js: policy editor bridge missing ${required}`);
}

const adminLimit = read('public/admin/admin-daily-limit.js');
for (const required of [
  'settings.dailyLimitEnabled === true',
  "form.querySelector('#daily-limit-enabled')",
  '회원별 일일 사건 접수 제한 사용',
  '끄면 제한 없이 계속 테스트할 수 있습니다.',
  "setDoc(doc(db, 'site_settings', 'config')",
  "setDoc(doc(db, 'site_public', 'config')",
  'dailyLimitEnabled,',
  'dailyLimit,',
  'new MutationObserver'
]) {
  if (!adminLimit.includes(required)) errors.push(`public/admin/admin-daily-limit.js: configurable case limit control missing ${required}`);
}

const manualAi = read('public/admin/admin-manual-ai-mode.js');
for (const required of [
  '자동 예약 없음',
  'AI 샘플 사건 수동 생성',
  'dailyToggle.checked = false',
  'dailyToggle.disabled = true',
  "toggleLabel.style.display = 'none';",
  'AI 모델 선택',
  "value: 'gemini-2.5-flash'",
  "value: 'gemini-2.5-flash-lite'",
  "value: 'gemini-2.5-pro'"
]) {
  if (!manualAi.includes(required)) errors.push(`public/admin/admin-manual-ai-mode.js: manual-only AI/model/save control missing ${required}`);
}
if (manualAi.includes('toggleLabel?.remove()')) {
  errors.push('public/admin/admin-manual-ai-mode.js: canonical AI settings save control must remain in the DOM');
}

const adminDashboard = read('public/admin/admin.js');
for (const required of [
  "setDoc(doc(db, 'policy_docs', active)",
  'content,',
  "toast('정책 문서를 저장했습니다.'",
  "dailyAiEnabled: target.querySelector('#dailyOn').checked",
  "geminiModel: target.querySelector('#model').value.trim() || 'gemini-2.5-flash'"
]) {
  if (!adminDashboard.includes(required)) errors.push(`public/admin/admin.js: managed policy/AI save path missing ${required}`);
}

const publicPolicy = read('public/js/pages/policy.js');
if (!publicPolicy.includes("getDoc(doc(db, 'policy_docs', safeType))")) {
  errors.push('public/js/pages/policy.js: public policy page is not connected to managed policy documents');
}

const adminIndex = read('public/admin/index.html');
for (const required of [
  '/admin/admin-bootstrap.js?v=20260729-report-moderation-1&ui=20260729-admin-brand-actions-1&logout=20260730-home-1&idle=20260831-idle-timeout-1',
  '/admin/admin-policy-defaults.js?v=20260730-admin-data-policy-1',
  '/admin/admin-daily-limit.js?v=20260730-configurable-limit-1',
  '/admin/admin-manual-ai-mode.js?v=20260831-admin-ai-settings-save-fix-1'
]) {
  if (!adminIndex.includes(required)) errors.push(`public/admin/index.html: administrator helper is not loaded: ${required}`);
}

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html/public/sw.js: active application version is not synchronized');
}
if (!worker.includes('/js/admin-access.js?v=20260730-admin-redirect-1')) {
  errors.push('public/sw.js: administrator access module is missing');
}
if (!worker.includes(`const CACHE_NAME = 'sosoking-app-v${appVersion}';`)) {
  errors.push('public/sw.js: cache name is not synchronized with the active app version');
}

if (errors.length) {
  console.error(`Administrator routing validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Administrator validation passed: login/logout routing, idle session expiry, canonical policy editing, configurable case limits, selectable manual AI models with a working settings save path, and synchronized app cache remain connected.');
