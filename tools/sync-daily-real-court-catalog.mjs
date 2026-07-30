import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));
const { initializeApp, applicationDefault, getApps } = requireFromFunctions('firebase-admin/app');
const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'sosoking-481e6';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const sourcePath = path.join(root, 'content', 'daily-real-court-cases.json');
const cases = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(cases) || cases.length < 3) throw new Error('오늘의 재판 판례는 하루 3건 출제를 위해 최소 3건이 필요합니다.');
if (cases.length > 500) throw new Error('오늘의 재판 판례는 최대 500건까지 동기화할 수 있습니다.');

const ids = new Set();
for (const [index, item] of cases.entries()) {
  const id = String(item?.id || '').trim();
  if (!/^[a-z0-9-]{3,80}$/.test(id)) throw new Error(`판례 ${index + 1}: id 형식이 올바르지 않습니다.`);
  if (ids.has(id)) throw new Error(`중복 판례 id: ${id}`);
  ids.add(id);
  if (!String(item.title || '').trim()) throw new Error(`${id}: title이 없습니다.`);
  if (!Array.isArray(item.choices) || item.choices.length < 2) throw new Error(`${id}: 선택지가 부족합니다.`);
  if (!item.choices.some(choice => choice.id === item.correctChoiceId)) throw new Error(`${id}: 정답 선택지가 없습니다.`);
  if (!String(item.sourceUrl || '').startsWith('https://www.law.go.kr/')) throw new Error(`${id}: 공식 국가법령정보센터 출처가 아닙니다.`);
}

const db = getFirestore();
for (let offset = 0; offset < cases.length; offset += 400) {
  const batch = db.batch();
  cases.slice(offset, offset + 400).forEach((item, localIndex) => {
    const order = offset + localIndex;
    batch.set(db.doc(`daily_court_catalog/${item.id}`), {
      ...item,
      order,
      active: true,
      syncedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
}

await db.doc('daily_court_config/catalog').set({
  orderedCaseIds: cases.map(item => item.id),
  size: cases.length,
  dailyCaseCount: 3,
  targetSize: 500,
  source: '국가법령정보센터 판례를 바탕으로 재구성',
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

console.log(JSON.stringify({ synced: true, count: cases.length, dailyCaseCount: 3, targetSize: 500, first: cases[0].id, last: cases.at(-1).id }));
