import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));
const { initializeApp, applicationDefault, getApps } = requireFromFunctions('firebase-admin/app');
const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'sosoking-481e6';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();
const source = await db.doc('site_settings/config').get();
const data = source.exists ? source.data() : {};

function numberInRange(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function publicBusinessInfo(value) {
  const sourceValue = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    ['companyName', 'ceoName', 'businessNumber', 'contact', 'email', 'address']
      .map(key => [key, String(sourceValue[key] || '').trim().slice(0, 200)])
  );
}

const dailyLimit = 1;
await db.doc('site_settings/config').set({ dailyLimit }, { merge: true });
await db.doc('site_public/config').set({
  dailyLimit,
  cooldownSec: numberInRange(data.cooldownSec, 45, 0, 300),
  businessInfo: publicBusinessInfo(data.businessInfo),
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

console.log(JSON.stringify({
  synced: true,
  sourceExists: source.exists,
  fields: ['dailyLimit', 'cooldownSec', 'businessInfo'],
  dailyLimit
}));
