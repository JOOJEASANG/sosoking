import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

const guard = read('public/js/auth-google-login-state-guard.js');
for (const value of [
  'function currentSignedInUser()',
  'await auth.authStateReady().catch(() => {})',
  'google login error ignored because authenticated state is active',
  "showAuthNotice('Google 로그인 완료', 'success')",
  "showAuthNotice(friendlyAuthMessage(error), 'error')",
  'button.dataset.loginStateGuard',
  'FALSE_FAILURE_TEXT',
  'suppressFalseFailureToast'
]) need(guard, value, 'Google login state guard');

const stateGuard = guard.indexOf('const signedInUser = await waitForSettledAuth()');
const failureNotice = guard.indexOf("showAuthNotice(friendlyAuthMessage(error), 'error')");
if (stateGuard < 0 || failureNotice < 0 || stateGuard > failureNotice) {
  errors.push('Google login handler: failure notice can run before authenticated-state recovery');
}

const index = read('public/index.html');
const guardScript = '<script type="module" src="/js/auth-google-login-state-guard.js?v=20260731-google-login-message-1"></script>';
const appScript = '<script type="module" src="/js/app.js?v=20260730-final-audit-1"></script>';
need(index, guardScript, 'application entry');
const guardPosition = index.indexOf(guardScript);
const appPosition = index.indexOf(appScript);
if (guardPosition < 0 || appPosition < 0 || guardPosition > appPosition) {
  errors.push('application entry: Google login guard must load before the application');
}

if (errors.length) {
  console.error(`Google login message validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Google login message validation passed: authenticated state takes priority over stale popup errors and the guard loads before the account page.');
