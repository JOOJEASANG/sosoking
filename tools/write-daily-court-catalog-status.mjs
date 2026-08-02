import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));
const { initializeApp, applicationDefault, getApps } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'sosoking-481e6';
const target = Math.max(3, Math.min(1000, Math.floor(Number(process.env.DAILY_COURT_TARGET_SIZE) || 1000)));
const requireTarget = process.env.DAILY_COURT_REQUIRE_TARGET === 'true';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const snapshot = await getFirestore().doc('daily_court_config/catalog').get();
if (!snapshot.exists) throw new Error('오늘의 재판 카탈로그 설정이 없습니다.');

const data = snapshot.data() || {};
const orderedCaseIds = Array.isArray(data.orderedCaseIds)
  ? data.orderedCaseIds.map(value => String(value || '').trim()).filter(Boolean)
  : [];
const uniqueIds = new Set(orderedCaseIds);
const configuredSize = Math.floor(Number(data.size) || 0);
const actualCount = Math.min(configuredSize || orderedCaseIds.length, orderedCaseIds.length, uniqueIds.size);

if (actualCount < 3) {
  throw new Error(`오늘의 재판 운영 최소 수량 미달: count=${actualCount}`);
}
if (requireTarget && actualCount < target) {
  throw new Error(`오늘의 재판 적재 검증 실패: size=${configuredSize}, ordered=${orderedCaseIds.length}, unique=${uniqueIds.size}, target=${target}`);
}

const ready = actualCount >= target;
const status = {
  status: ready ? 'ready' : 'partial',
  count: actualCount,
  target,
  dailyCaseCount: 3,
  repeatIntervalDaysApprox: Math.max(1, Math.floor(actualCount / 3)),
  source: String(data.source || '국가법령정보센터 공식 판례'),
  bootstrapVersion: String(data.bootstrapVersion || ''),
  aiUsed: false,
  targetRequired: requireTarget,
  verifiedAt: new Date().toISOString()
};

const outputDir = path.join(root, 'public', 'data');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'daily-court-catalog-status.json'), `${JSON.stringify(status, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(status));
