import fs from 'node:fs';

const required = [
  'public/auth/index.html',
  'public/auth/auth.js',
  'public/auth/auth.css'
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing auth file: ${file}`);
}

const authPage = fs.readFileSync('public/auth/index.html', 'utf8');
const authJs = fs.readFileSync('public/auth/auth.js', 'utf8');
const firebaseJs = fs.readFileSync('public/js/firebase.js', 'utf8');
const home = fs.readFileSync('public/index.html', 'utf8');
const profile = fs.readFileSync('functions/game-profile.js', 'utf8');

const requiredAuthMarkers = [
  'createUserWithEmailAndPassword',
  'signInWithEmailAndPassword',
  'GoogleAuthProvider',
  'signInWithPopup',
  'saveMemberProfile',
  'checkNickname'
];
for (const marker of requiredAuthMarkers) {
  if (!authJs.includes(marker)) throw new Error(`Auth flow marker missing: ${marker}`);
}

if (!authPage.includes('id="nickname"') || !authPage.includes('id="check-nickname"')) {
  throw new Error('Nickname signup/check UI is missing');
}
if (!firebaseJs.includes('requireMemberAuth') || !firebaseJs.includes('create-room-form')) {
  throw new Error('Room member-auth gate is missing');
}
if (!home.includes('href="/auth/"')) throw new Error('Home auth entry point is missing');
if (!profile.includes('exports.checkNickname') || !profile.includes('exports.saveMemberProfile')) {
  throw new Error('Profile callable functions are missing');
}

console.log('Authentication and room gate checks passed.');
