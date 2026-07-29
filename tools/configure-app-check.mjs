import fs from 'node:fs';

const configPath = process.env.APP_CHECK_CONFIG_PATH || 'public/js/firebase-config.js';
const siteKey = String(process.env.FIREBASE_APP_CHECK_SITE_KEY || '').trim();
const enforce = String(process.env.ENFORCE_APP_CHECK || 'false').trim().toLowerCase();

if (!['true', 'false'].includes(enforce)) {
  throw new Error('ENFORCE_APP_CHECK must be either true or false.');
}
if (siteKey && !/^[A-Za-z0-9_-]{20,200}$/.test(siteKey)) {
  throw new Error('FIREBASE_APP_CHECK_SITE_KEY has an invalid format.');
}
if (enforce === 'true' && !siteKey) {
  throw new Error('App Check enforcement requires FIREBASE_APP_CHECK_SITE_KEY.');
}

const source = fs.readFileSync(configPath, 'utf8');
if (!/appCheckSiteKey:\s*"[^"]*"/.test(source)) {
  throw new Error(`${configPath}: appCheckSiteKey property is missing.`);
}

const next = source.replace(
  /appCheckSiteKey:\s*"[^"]*"/,
  `appCheckSiteKey: ${JSON.stringify(siteKey)}`
);
fs.writeFileSync(configPath, next);

console.log(`App Check public configuration prepared: configured=${Boolean(siteKey)}, enforced=${enforce === 'true'}`);
