'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { isAdminAuth } = require('./admin-utils');
const { enforceActionRateLimit, requireAppCheck } = require('./security');
const { cleanCaseId, migrateLegacyCase, resolveAlias, scanLegacyCases } = require('./legacy-case-migration');

const REGION = 'asia-northeast3';

exports.resolveCaseAlias = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB'
}, async request => {
  requireAppCheck(request);
  const caseId = cleanCaseId(request.data?.caseId);
  if (!caseId) throw new HttpsError('invalid-argument', '사건 주소가 올바르지 않습니다.');
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  await enforceActionRateLimit(request.auth.uid, 'case-alias-resolve', {
    cooldownSeconds: 0,
    dailyLimit: 200
  });
  const targetCaseId = await resolveAlias(caseId);
  return { resolved: Boolean(targetCaseId), targetCaseId };
});

exports.migrateLegacyCaseIds = onCall({
  region: REGION,
  timeoutSeconds: 540,
  memory: '512MiB'
}, async request => {
  requireAppCheck(request);
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 기존 사건 주소를 이전할 수 있습니다.');
  }

  const dryRun = request.data?.dryRun !== false;
  const limit = Math.max(1, Math.min(10, Number(request.data?.limit) || 5));
  const cursor = cleanCaseId(request.data?.cursor) || '';
  if (!dryRun && request.data?.confirm !== 'MIGRATE_LEGACY_CASE_IDS') {
    throw new HttpsError('failed-precondition', '실행 확인 문자열이 올바르지 않습니다.');
  }

  const page = await scanLegacyCases({ limit, cursor });
  const results = [];
  for (const candidate of page.candidates) {
    results.push(await migrateLegacyCase(candidate.caseId, { dryRun }));
  }

  return {
    dryRun,
    scanned: page.scanned,
    matched: page.candidates.length,
    processed: results.length,
    results,
    nextCursor: page.nextCursor,
    done: page.done
  };
});
