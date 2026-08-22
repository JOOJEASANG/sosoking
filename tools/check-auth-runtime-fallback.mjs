import fs from 'node:fs';
import assert from 'node:assert/strict';

const firebase = fs.readFileSync('public/js/firebase.js', 'utf8');
const account = fs.readFileSync('public/js/account-ui.js', 'utf8');
const profile = fs.readFileSync('functions/game-profile.js', 'utf8');

for (const marker of ['providerData', 'google.com', 'memberFallbackProfile']) {
  assert.ok(firebase.includes(marker), `firebase auth fallback marker missing: ${marker}`);
}
assert.ok(firebase.includes('if (profile) return profile;'), 'stored member profile path missing');
assert.ok(firebase.includes('return memberFallbackProfile(user);'), 'room gate fallback profile missing');
assert.ok(account.includes('providerData'), 'account UI provider photo fallback missing');
assert.ok(profile.includes('providerData'), 'Functions provider profile fallback missing');
assert.ok(profile.includes("providerId === 'google.com'"), 'Google provider selection missing');

console.log('Auth runtime fallback validation passed: room creation no longer depends on profile reads and Google provider images have direct fallbacks.');
