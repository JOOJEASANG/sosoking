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

async function removeDocumentTree(ref) {
  try {
    await db.recursiveDelete(ref);
    return true;
  } catch (error) {
    if (error?.code === 5 || /not found/i.test(String(error?.message || ''))) return false;
    throw error;
  }
}

async function main() {
  let removedCases = 0;
  let removedResults = 0;
  const concurrency = 8;

  for (let start = 0; start < ids.length; start += concurrency) {
    const chunk = ids.slice(start, start + concurrency);
    const outcomes = await Promise.all(chunk.map(async id => {
      const [caseSnap, resultSnap] = await Promise.all([
        db.doc(`cases/${id}`).get(),
        db.doc(`results/${id}`).get()
      ]);

      const tasks = [];
      if (caseSnap.exists && caseSnap.data()?.source === 'official_seed') {
        tasks.push(removeDocumentTree(caseSnap.ref).then(() => { removedCases += 1; }));
      }
      if (resultSnap.exists && resultSnap.data()?.source === 'official_seed') {
        tasks.push(removeDocumentTree(resultSnap.ref).then(() => { removedResults += 1; }));
      }
      await Promise.all(tasks);
      return tasks.length;
    }));
    void outcomes;
  }

  await removeDocumentTree(db.doc('site_settings/creative_seed'));
  console.log(JSON.stringify({ removedCases, removedResults, requestedIds: ids.length }));
}

main().catch(error => {
  console.error('Creative seed cleanup failed:', error);
  process.exit(1);
});
