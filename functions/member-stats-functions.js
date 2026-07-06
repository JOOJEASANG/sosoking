'use strict';

const { onCall } = require('firebase-functions/v2/https');
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

const getRegisteredMemberCount = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async () => {
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
