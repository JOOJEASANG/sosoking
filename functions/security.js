const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function enforceActionRateLimit(uid, action, options = {}) {
  const safeUid = String(uid || '').trim();
  const safeAction = String(action || '').trim().toLowerCase();
  if (!safeUid || !/^[a-z0-9_-]{1,40}$/.test(safeAction)) {
    throw new HttpsError('invalid-argument', '요청 제한 키가 올바르지 않습니다.');
  }

  const cooldownSeconds = Math.max(0, Math.min(3600, Number(options.cooldownSeconds || 0)));
  const dailyLimit = Math.max(1, Math.min(10000, Number(options.dailyLimit || 100)));
  const date = kstDateKey();
  const ref = db.doc(`action_limits/${safeUid}_${safeAction}`);

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : {};
    const count = current.date === date ? Number(current.count || 0) : 0;
    const lastActionMs = current.date === date ? timestampMillis(current.lastActionAt) : 0;
    const elapsedSeconds = lastActionMs ? Math.floor((Date.now() - lastActionMs) / 1000) : Infinity;

    if (count >= dailyLimit) throw new HttpsError('resource-exhausted', '오늘 이용 한도에 도달했습니다.');
    if (cooldownSeconds > 0 && elapsedSeconds < cooldownSeconds) {
      throw new HttpsError('resource-exhausted', `${cooldownSeconds - elapsedSeconds}초 후에 다시 시도해 주세요.`);
    }

    tx.set(ref, {
      uid: safeUid,
      action: safeAction,
      date,
      count: count + 1,
      dailyLimit,
      cooldownSeconds,
      lastActionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

module.exports = { enforceActionRateLimit };
