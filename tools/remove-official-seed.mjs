import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));
const { initializeApp, applicationDefault, getApps } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'sosoking-481e6';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();
const collections = ['cases', 'results'];
const actualIds = Array.from({ length: 120 }, (_, index) => `seed_v1_${String(index + 1).padStart(3, '0')}`);
const legacyIds = Array.from({ length: 120 }, (_, index) => `creative-case-${String(index + 1).padStart(3, '0')}`);
const candidateIds = [...actualIds, ...legacyIds];
const targets = new Map();

function isOfficialSeed(data = {}) {
  return data.source === 'official_seed'
    || data.userId === 'system-official-seed'
    || data.aiSource === 'curated-creative-seed'
    || String(data.promptVersion || '').startsWith('creative-seed')
    || Boolean(data.seedVersion)
    || Boolean(data.seedSlug);
}

for (const collectionName of collections) {
  const sourceSnapshot = await db.collection(collectionName)
    .where('source', '==', 'official_seed')
    .get();

  for (const snapshot of sourceSnapshot.docs) {
    targets.set(snapshot.ref.path, snapshot);
  }

  const refs = candidateIds.map(id => db.doc(`${collectionName}/${id}`));
  for (let start = 0; start < refs.length; start += 100) {
    const snapshots = await db.getAll(...refs.slice(start, start + 100));
    for (const snapshot of snapshots) {
      if (snapshot.exists && isOfficialSeed(snapshot.data())) {
        targets.set(snapshot.ref.path, snapshot);
      }
    }
  }
}

let deleted = 0;
const targetList = [...targets.values()];
for (let start = 0; start < targetList.length; start += 10) {
  const chunk = targetList.slice(start, start + 10);
  await Promise.all(chunk.map(async snapshot => {
    await db.recursiveDelete(snapshot.ref);
    deleted += 1;
  }));
}

const settingRef = db.doc('site_settings/creative_seed');
const settingSnapshot = await settingRef.get();
if (settingSnapshot.exists) await settingRef.delete();

const remaining = [];
for (const collectionName of collections) {
  const snapshot = await db.collection(collectionName)
    .where('source', '==', 'official_seed')
    .get();
  remaining.push(...snapshot.docs.map(doc => doc.ref.path));
}

if (remaining.length > 0) {
  throw new Error(`official_seed cleanup incomplete: ${remaining.join(', ')}`);
}

console.log(JSON.stringify({
  actualIdPrefix: 'seed_v1_',
  queriedOfficialSeed: true,
  matched: targetList.length,
  deleted,
  remaining: remaining.length
}));
