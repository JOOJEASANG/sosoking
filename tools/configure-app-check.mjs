import fs from 'node:fs';

const file = 'public/js/firebase-config.js';
const rawKey = String(process.env.APP_CHECK_SITE_KEY || '').trim();
const enforce = String(process.env.ENFORCE_APP_CHECK || 'false').trim().toLowerCase();

if (!['true', 'false'].includes(enforce)) {
  throw new Error('ENFORCE_APP_CHECK must be true or false.');
}

if (rawKey && (!/^[A-Za-z0-9_-]{20,200}$/.test(rawKey) || /\s/.test(rawKey))) {
  throw new Error('APP_CHECK_SITE_KEY has an unexpected format.');
}

if (enforce === 'true' && !rawKey) {
  throw new Error('ENFORCE_APP_CHECK=true requires APP_CHECK_SITE_KEY.');
}

let source = fs.readFileSync(file, 'utf8');
if (!/appCheckSiteKey:\s*"[^"]*"/.test(source)) {
  throw new Error('firebase-config.js appCheckSiteKey field was not found.');
}

source = source.replace(
  /appCheckSiteKey:\s*"[^"]*"/,
  `appCheckSiteKey: ${JSON.stringify(rawKey)}`
);
fs.writeFileSync(file, source);

console.log(rawKey
  ? `App Check site key injected for deployment (enforcement=${enforce}).`
  : 'App Check site key is not configured; deployment remains in compatibility mode.');
