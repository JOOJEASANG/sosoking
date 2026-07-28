import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';

const root = process.cwd();
const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));
const { initializeApp, applicationDefault, getApps } = requireFromFunctions('firebase-admin/app');
const { getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'sosoking-481e6';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();
const compressed = Buffer.from(fs.readFileSync(path.join(root, 'data', 'creative-cases-v1.b64'), 'utf8').trim(), 'base64');
const source = JSON.parse(gunzipSync(compressed).toString('utf8'));
const cases = Array.isArray(source.cases) ? source.cases : [];
const version = String(source.version || 'creative-v1');

function publishedTimestamp(dateText) {
  const date = new Date(`${dateText}T09:00:00+09:00`);
  return Timestamp.fromDate(Number.isNaN(date.getTime()) ? new Date() : date);
}

function caseDocument(item, createdAt) {
  return {
    userId: 'system-official-seed',
    source: 'official_seed',
    seedVersion: version,
    seedSlug: item.slug,
    category: item.category,
    keywords: item.keywords,
    docketNumber: `소소-SEED-${item.id.replace(/\D/g, '').padStart(4, '0')}`,
    courtName: '소소킹 판결소',
    courtroom: '제404호 생활법정',
    division: '제3생활부',
    courtStage: 'sentenced',
    caseTitle: item.caseTitle,
    caseDescription: item.caseDescription,
    grievanceIndex: item.grievanceIndex,
    nickname: item.nickname,
    judgeType: item.judgeType,
    judgeIcon: item.judgeIcon,
    judgeStyle: item.judgeStyle,
    status: 'completed',
    isPublic: true,
    reportCount: 0,
    createdAt,
    completedAt: createdAt,
    updatedAt: Timestamp.now()
  };
}

function resultDocument(item, createdAt, previous = {}) {
  return {
    source: 'official_seed',
    seedVersion: version,
    seedSlug: item.slug,
    category: item.category,
    keywords: item.keywords,
    docketNumber: `소소-SEED-${item.id.replace(/\D/g, '').padStart(4, '0')}`,
    courtName: '소소킹 판결소',
    courtroom: '제404호 생활법정',
    division: '제3생활부',
    isPublic: previous.isPublic ?? true,
    caseTitle: item.caseTitle,
    caseDescription: item.caseDescription,
    grievanceIndex: item.grievanceIndex,
    nickname: item.nickname,
    judgeType: item.judgeType,
    judgeIcon: item.judgeIcon,
    judgeStyle: item.judgeStyle,
    reception: item.reception,
    investigation: item.investigation,
    plaintiffArg: item.plaintiffArg,
    defendantArg: item.defendantArg,
    verdict: item.verdict,
    sentence: item.sentence,
    aiSource: 'curated-creative-seed',
    aiModel: '',
    aiFallbackReason: '',
    promptVersion: 'creative-seed-v1',
    reactionTotal: Number(previous.reactionTotal || 0),
    commentCount: Number(previous.commentCount || 0),
    courtStage: 'sentenced',
    createdAt: previous.createdAt || createdAt,
    updatedAt: Timestamp.now()
  };
}

async function main() {
  if (!cases.length) throw new Error('Creative seed data is empty.');

  const resultRefs = cases.map(item => db.doc(`results/${item.id}`));
  const existingResults = await db.getAll(...resultRefs);
  const existingById = new Map(existingResults.map(snapshot => [snapshot.id, snapshot]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const chunkSize = 180;

  for (let start = 0; start < cases.length; start += chunkSize) {
    const batch = db.batch();
    const chunk = cases.slice(start, start + chunkSize);

    for (const item of chunk) {
      const existing = existingById.get(item.id);
      const previous = existing?.exists ? existing.data() : {};
      if (existing?.exists && previous.source !== 'official_seed') {
        skipped += 1;
        continue;
      }
      if (existing?.exists && previous.seedVersion === version) {
        skipped += 1;
        continue;
      }

      const createdAt = publishedTimestamp(item.publishedDate);
      batch.set(db.doc(`cases/${item.id}`), caseDocument(item, createdAt), { merge: true });
      batch.set(db.doc(`results/${item.id}`), resultDocument(item, createdAt, previous), { merge: true });
      if (existing?.exists) updated += 1;
      else inserted += 1;
    }

    await batch.commit();
  }

  await db.doc('site_settings/creative_seed').set({
    version,
    caseCount: cases.length,
    inserted,
    updated,
    skipped,
    lastSeededAt: Timestamp.now()
  }, { merge: true });

  console.log(JSON.stringify({ version, total: cases.length, inserted, updated, skipped }));
}

main().catch(error => {
  console.error('Creative seed failed:', error);
  process.exit(1);
});
