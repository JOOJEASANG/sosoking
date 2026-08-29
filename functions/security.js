const { HttpsError } = require('firebase-functions/v2/https');
const { defineBoolean } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const enforceAppCheck = defineBoolean('ENFORCE_APP_CHECK', {
  default: false,
  description: '웹 App Check 사이트 키 설정 후 callable 요청에 App Check 토큰을 강제합니다.'
});
const DEFAULT_GLOBAL_AI_DAILY_LIMIT = 100;
const DEFAULT_USER_AI_DAILY_LIMIT = 12;

function clampLimit(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

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

function requireAppCheck(request) {
  if (enforceAppCheck.value() && !request.app) {
    throw new HttpsError('failed-precondition', '정상적인 앱에서 다시 시도해 주세요.');
  }
}

function requireAccountUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  requireAppCheck(request);

  const token = request.auth.token || {};
  const provider = token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') {
    throw new HttpsError('unauthenticated', '구글 또는 이메일 로그인 후 이용할 수 있습니다.');
  }
  return request.auth;
}

function requireVerifiedUser(request) {
  const authenticated = requireAccountUser(request);
  const token = authenticated.token || {};
  const provider = token.firebase?.sign_in_provider || '';
  if (provider === 'password' && token.email_verified !== true) {
    throw new HttpsError('failed-precondition', '이메일 인증을 완료한 뒤 이용해 주세요.');
  }
}

async function enforceActionRateLimit(uid, action, options = {}) {
  const safeUid = String(uid || '').trim();
  const safeAction = String(action || '').trim().toLowerCase();
  if (!safeUid || !/^[a-z0-9_-]{1,40}$/.test(safeAction)) {
    throw new HttpsError('invalid-argument', '요청 제한 키가 올바르지 않습니다.');
  }

  const cooldownSeconds = clampLimit(options.cooldownSeconds, 0, 0, 3600);
  const dailyLimit = clampLimit(options.dailyLimit, 100, 1, 10000);
  const date = kstDateKey();
  const ref = db.doc(`action_limits/${safeUid}_${safeAction}`);

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : {};
    const count = current.date === date ? Number(current.count || 0) : 0;
    const lastActionMs = current.date === date ? timestampMillis(current.lastActionAt) : 0;
    const elapsedSeconds = lastActionMs ? Math.floor((Date.now() - lastActionMs) / 1000) : Infinity;

    if (count >= dailyLimit) {
      throw new HttpsError('resource-exhausted', `오늘 이용 가능한 ${dailyLimit}회 한도에 도달했습니다.`);
    }
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

  return { date, dailyLimit, cooldownSeconds };
}

async function reserveAiRequest(uid, kind, settings = {}) {
  const globalLimit = clampLimit(
    settings.globalAiDailyLimit,
    DEFAULT_GLOBAL_AI_DAILY_LIMIT,
    1,
    10000
  );
  const userLimit = clampLimit(
    settings.userAiDailyLimit,
    DEFAULT_USER_AI_DAILY_LIMIT,
    1,
    100
  );
  const date = kstDateKey();
  const globalRef = db.doc(`ai_limits/daily_${date}`);
  const userRef = db.doc(`ai_limits/daily_${date}/users/${uid}`);

  await db.runTransaction(async tx => {
    const globalSnap = await tx.get(globalRef);
    const userSnap = await tx.get(userRef);
    const globalCount = globalSnap.exists ? Number(globalSnap.data().count || 0) : 0;
    const userCount = userSnap.exists ? Number(userSnap.data().count || 0) : 0;

    if (globalCount >= globalLimit) {
      throw new HttpsError('resource-exhausted', '오늘의 AI 전체 사용 한도에 도달했습니다.');
    }
    if (userCount >= userLimit) {
      throw new HttpsError('resource-exhausted', `계정당 하루 AI 요청 한도 ${userLimit}회에 도달했습니다.`);
    }

    tx.set(globalRef, {
      date,
      count: globalCount + 1,
      limit: globalLimit,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(userRef, {
      uid,
      date,
      count: userCount + 1,
      limit: userLimit,
      kinds: {
        [kind]: FieldValue.increment(1)
      },
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return { date, globalLimit, userLimit };
}

module.exports = {
  enforceActionRateLimit,
  requireAccountUser,
  requireAppCheck,
  requireVerifiedUser,
  reserveAiRequest
};