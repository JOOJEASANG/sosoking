import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));
const { initializeApp, applicationDefault, getApps } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'sosoking-481e6';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();
const ids = Array.from({ length: 120 }, (_, index) => `creative-case-${String(index + 1).padStart(3, '0')}`);
const refs = ids.flatMap(id => [db.doc(`cases/${id}`), db.doc(`results/${id}`)]);
const snapshots = await db.getAll(...refs);
const targets = snapshots.filter(snapshot => snapshot.exists && snapshot.data()?.source === 'official_seed');

let deleted = 0;
for (let start = 0; start < targets.length; start += 10) {
  const chunk = targets.slice(start, start + 10);
  await Promise.all(chunk.map(async snapshot => {
    await db.recursiveDelete(snapshot.ref);
    deleted += 1;
  }));
}

const settingRef = db.doc('site_settings/creative_seed');
const settingSnapshot = await settingRef.get();
if (settingSnapshot.exists) await settingRef.delete();

console.log(JSON.stringify({ checked: refs.length, matchedOfficialSeed: targets.length, deleted }));
