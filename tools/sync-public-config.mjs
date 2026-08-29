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

// 기존 운영 설정에는 이 필드가 없으므로 최초 배포 시 제한이 자동으로 해제된다.
const dailyLimitEnabled = data.dailyLimitEnabled === true;
const dailyLimit = numberInRange(data.dailyLimit, 3, 1, 1000);
await db.doc('site_settings/config').set({ dailyLimitEnabled, dailyLimit }, { merge: true });
await db.doc('site_public/config').set({
  dailyLimitEnabled,
  dailyLimit,
  cooldownSec: numberInRange(data.cooldownSec, 45, 0, 300),
  businessInfo: publicBusinessInfo(data.businessInfo),
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

console.log(JSON.stringify({
  synced: true,
  sourceExists: source.exists,
  fields: ['dailyLimitEnabled', 'dailyLimit', 'cooldownSec', 'businessInfo'],
  dailyLimitEnabled,
  dailyLimit
}));