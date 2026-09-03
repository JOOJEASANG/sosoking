import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const need = (source, value, message) => {
  if (!source.includes(value)) errors.push(message);
};

const resultComments = read('public/js/pages/result-comments.js');
const ownerVerdict = read('functions/owner-verdict.js');
const rules = read('firestore.rules');
const index = read('public/index.html');
const sw = read('public/sw.js');

for (const value of [
  'const ownerVote = String(data.ownerVerdictVote || \'\')',
  'result_reactions/${caseId}/votes/${user.uid}',
  'const publicVote = publicVoteSnap.exists()',
  'vote: validOwnerVote(publicVote) ? publicVote : \'\'',
  'owner public vote verification failed',
  'verificationFailed: true'
]) need(resultComments, value, `result-comments.js: missing owner/public vote reconciliation guard: ${value}`);

for (const value of [
  'const publicVoteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`)',
  'tx.get(publicVoteRef)',
  'const publicPrevious = publicVoteSnap.exists',
  'OWNER_VERDICT_REACTIONS.includes(publicPrevious)',
  'ownerVerdictVote: publicPrevious'
]) need(ownerVerdict, value, `owner-verdict.js: missing public vote race guard: ${value}`);

need(rules, 'allow read: if signedIn() && (request.auth.uid == uid || isAdmin());',
  'firestore.rules: a voter must be able to read their own canonical vote document');

const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion) errors.push('public/index.html: versioned app entry is missing');
if (appVersion && !sw.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html/public/sw.js: app cache versions differ');
}
if (appVersion && !sw.includes(`sosoking-app-v${appVersion}`)) {
  errors.push('public/sw.js: cache name does not match the active app version');
}
need(sw, '/js/pages/result-comments.js?v=20260830-final-audit-1',
  'public/sw.js: verdict module must remain in the refreshed app shell');

if (errors.length) {
  console.error(`Owner/public vote state validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Owner/public vote state validation passed: an existing public jury vote unlocks the owner verdict, server races preserve the first valid choice, and the refreshed app shell serves the fix.');
