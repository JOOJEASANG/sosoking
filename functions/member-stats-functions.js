'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');

const REGION = 'asia-northeast3';
const MAX_SCAN = 5000;

function providerIds(user) {
  return (user.providerData || []).map(p => p.providerId).filter(Boolean);
}

function isRegisteredAuthUser(user) {
  if (!user || !user.uid) return false;
  const providers = providerIds(user).filter(id => id !== 'anonymous');
  return providers.length > 0 || !!user.email || !!user.phoneNumber;
}

const getRegisteredMemberCount = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  // 전체 Auth 사용자 스캔 비용이 있으므로 로그인 사용자만 호출 가능.
  if (!(request.auth && request.auth.uid)) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  let pageToken;
  let registeredCount = 0;
  let scanned = 0;

  do {
    const result = await getAuth().listUsers(1000, pageToken);
    for (const user of result.users || []) {
      scanned += 1;
      if (isRegisteredAuthUser(user)) registeredCount += 1;
    }
    pageToken = result.pageToken;
  } while (pageToken && scanned < MAX_SCAN);

  return {
    ok: true,
    registeredCount,
    threshold: 50,
    enabled: registeredCount >= 50,
    scanned,
    scannedAll: !pageToken,
  };
});

module.exports = { getRegisteredMemberCount };
