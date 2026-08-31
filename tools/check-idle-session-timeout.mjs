import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const timeout = read('public/js/session-timeout.js');
for (const required of [
  'export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;',
  "const ACTIVITY_STORAGE_KEY = 'sosoking:auth-activity:v1';",
  "const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll'];",
  'if (!user || user.isAnonymous',
  'localStorage.setItem(ACTIVITY_STORAGE_KEY',
  "window.addEventListener('storage', handleStorage);",
  "document.addEventListener('visibilitychange', handleVisibility);",
  'export function startIdleSessionTimeout({',
  'await onTimeout(user);'
]) {
  if (!timeout.includes(required)) errors.push(`public/js/session-timeout.js: idle timeout guard missing ${required}`);
}

const app = read('public/js/app.js');
for (const required of [
  "import { startIdleSessionTimeout } from './session-timeout.js?v=20260831-idle-timeout-1';",
  'async function autoLogoutInactiveUser()',
  'await signOut(auth);',
  'await signInAnonymously(auth)',
  "showToast('30분 동안 활동이 없어 자동 로그아웃되었습니다.'",
  'startIdleSessionTimeout({ auth, onTimeout: autoLogoutInactiveUser });'
]) {
  if (!app.includes(required)) errors.push(`public/js/app.js: member idle logout path missing ${required}`);
}

const admin = read('public/admin/admin-bootstrap.js');
for (const required of [
  "import { startIdleSessionTimeout } from '../js/session-timeout.js?v=20260831-idle-timeout-1';",
  'async function signOutForIdleTimeout()',
  'await signOut(auth);',
  "toast('30분 동안 활동이 없어 자동 로그아웃되었습니다.'",
  'startIdleSessionTimeout({ auth, onTimeout: signOutForIdleTimeout });'
]) {
  if (!admin.includes(required)) errors.push(`public/admin/admin-bootstrap.js: administrator idle logout path missing ${required}`);
}
if (admin.includes('signInAnonymously')) {
  errors.push('public/admin/admin-bootstrap.js: administrators must not be converted to anonymous users after idle logout');
}

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (appVersion !== '20260831-idle-timeout-1') errors.push('public/index.html: idle timeout app release is not active');
if (!worker.includes(`/js/app.js?v=${appVersion}`)) errors.push('public/sw.js: idle timeout app version is not cached');
if (!worker.includes('/js/session-timeout.js?v=20260831-idle-timeout-1')) errors.push('public/sw.js: idle session module is not in the app shell');
if (!worker.includes(`const CACHE_NAME = 'sosoking-app-v${appVersion}';`)) errors.push('public/sw.js: cache version does not match idle timeout app version');

const adminIndex = read('public/admin/index.html');
if (!adminIndex.includes('&idle=20260831-idle-timeout-1')) errors.push('public/admin/index.html: administrator bootstrap cache is not busted for idle timeout');

if (errors.length) {
  console.error(`Idle session timeout validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Idle session timeout validation passed: verified members and administrators auto logout after 30 minutes of inactivity, anonymous sessions are excluded, and activity is shared across tabs.');
