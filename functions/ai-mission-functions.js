'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const AI_MISSION_DAILY_LIMIT = 10;

async function checkUserMissionLimit(uid) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const ref = db.doc(`ai_usage_users/${uid}/mission/${today}`);
  let allowed = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const used = snap.exists ? (snap.data().count || 0) : 0;
    if (used < AI_MISSION_DAILY_LIMIT) {
      tx.set(ref, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      allowed = true;
    }
  });
  return allowed;
}

// 미션 기능은 서비스에서 제거되었습니다.
// 기존 함수 이름은 배포 호환성을 위해 유지하되, 더 이상 missions 컬렉션을 생성/수정하지 않습니다.
const generateAiMissionNow = onCall({ region: REGION, timeoutSeconds: 10 }, async (request) => {
  if (request.auth?.uid) {
    const allowed = await checkUserMissionLimit(request.auth.uid);
    if (!allowed) {
      throw new HttpsError('resource-exhausted', '오늘의 AI 미션 한도(10회)를 모두 사용했습니다. 내일 다시 도전해보세요!');
    }
  }
  return {
    ok: false,
    disabled: true,
    reason: 'mission-feature-removed',
    message: 'AI 미션 자동생성 기능은 제거되었습니다.',
  };
});

module.exports = { generateAiMissionNow };
