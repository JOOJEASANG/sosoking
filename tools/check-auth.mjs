import fs from 'node:fs';

const required = [
  'public/auth/index.html',
  'public/auth/auth.js',
  'public/auth/auth.css',
  'public/js/account-ui.js'
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing auth file: ${file}`);
}

const authPage = fs.readFileSync('public/auth/index.html', 'utf8');
const authJs = fs.readFileSync('public/auth/auth.js', 'utf8');
const firebaseJs = fs.readFileSync('public/js/firebase.js', 'utf8');
const accountUi = fs.readFileSync('public/js/account-ui.js', 'utf8');
const themeJs = fs.readFileSync('public/game/theme.js', 'utf8');
const home = fs.readFileSync('public/index.html', 'utf8');
const profile = fs.readFileSync('functions/game-profile.js', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');

const requiredAuthMarkers = [
  'createUserWithEmailAndPassword',
  'signInWithEmailAndPassword',
  'GoogleAuthProvider',
  'signInWithPopup',
  'saveMemberProfile',
  'checkNickname',
  'getIdToken(true)'
];
for (const marker of requiredAuthMarkers) {
  if (!authJs.includes(marker)) throw new Error(`Auth flow marker missing: ${marker}`);
}

if (!authPage.includes('id="nickname"') || !authPage.includes('id="check-nickname"')) {
  throw new Error('Nickname signup/check UI is missing');
}
for (const marker of ['requireMemberAuth', 'requireMemberProfile', 'create-room-form', 'form.requestSubmit()', 'getMemberProfile']) {
  if (!firebaseJs.includes(marker)) throw new Error(`Room member flow marker missing: ${marker}`);
}
for (const marker of ['signOut', 'account-login-icon', 'account-avatar', 'photoURL', 'account-logout']) {
  if (!accountUi.includes(marker)) throw new Error(`Account header marker missing: ${marker}`);
}
if (!themeJs.includes('mountAccountUI')) throw new Error('Account header is not mounted from the shared theme module');
if (!home.includes('href="/auth/"')) throw new Error('Home auth entry point is missing');
for (const marker of ['exports.checkNickname', 'exports.saveMemberProfile', 'photoURL: cleanUrl(userRecord.photoURL']) {
  if (!profile.includes(marker)) throw new Error(`Profile callable marker missing: ${marker}`);
}
for (const marker of ['/js/account-ui.js?v=20260821-account-room-1', '/js/firebase.js?v=20260821-account-room-1', 'sosoking-play-v20260821-account-room-1']) {
  if (!sw.includes(marker)) throw new Error(`Service worker account/room asset missing: ${marker}`);
}

console.log('Authentication, account header, Google avatar, logout, and room member gate checks passed.');
