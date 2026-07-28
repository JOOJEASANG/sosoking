const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireVerifiedUser } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MAX_DESC = 600;
const DEFAULT_DAILY_LIMIT = 3;
const DEFAULT_COOLDOWN_SEC = 45;
const NICK_ADJ = ['억울한','분노한','황당한','지친','당황한','슬픈','안타까운','기막힌'];
const NICK_NOUN = ['직장인','집사','아무개','라면러버','과자지킴이','충전기수호자','리모컨분실자','냉장고파수꾼'];

function textValue(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function makeDocket(today) {
  const compact = today.replace(/-/g, '').slice(2);
  return `소소${compact}-생활판결-${Math.floor(1000 + Math.random() * 9000)}`;
}

function randomNickname() {
  return NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)]
    + NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
}

function containsBannedWord(text, bannedWords = []) {
  const source = String(text || '').toLowerCase();
  return bannedWords.some(word => {
    const normalized = String(word || '').trim().toLowerCase();
    return normalized && source.includes(normalized);
  });
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get();
  return snap.exists ? snap.data() : {};
}

async function loadUserNickname(uid) {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) return '';
    return textValue(snap.data().nickname, 30);
  } catch (err) {
    console.error('profile load failed:', err);
    return '';
  }
}

exports.submitCase = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  const data = request.data || {};
  const desc = textValue(data.caseDescription, MAX_DESC);
  const isPublic = boolValue(data.isPublic, false);
  const profileNickname = await loadUserNickname(uid);

  if (desc.length < 10) {
    throw new HttpsError('invalid-argument', '사건 내용을 10자 이상 적어주세요.');
  }
  const safety = inspectContent(desc);
  if (!safety.safe) {
    throw new HttpsError('failed-precondition', safety.message);
  }

  const settings = await loadSettings();
  const dailyLimit = clampNumber(settings.dailyLimit, DEFAULT_DAILY_LIMIT, 1, 20);
  const cooldownSec = clampNumber(settings.cooldownSec, DEFAULT_COOLDOWN_SEC, 0, 300);
  const bannedWords = Array.isArray(settings.bannedWords) ? settings.bannedWords : [];

  if (containsBannedWord(desc, bannedWords)) {
    throw new HttpsError('failed-precondition', '관리자가 제한한 단어가 포함되어 있습니다.');
  }

  const today = kstDateKey();
  const docketNumber = makeDocket(today);
  const caseId = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const caseRef = db.doc(`cases/${caseId}`);
  const limitRef = db.doc(`rate_limits/${uid}`);

  await db.runTransaction(async tx => {
    const limitSnap = await tx.get(limitRef);
    const current = limitSnap.exists ? limitSnap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;

    if (count >= dailyLimit) {
      throw new HttpsError('resource-exhausted', `오늘 접수 한도 ${dailyLimit}건을 초과했습니다.`);
    }

    if (current.lastSubmittedAt) {
      const lastMs = current.lastSubmittedAt.toMillis
        ? current.lastSubmittedAt.toMillis()
        : new Date(current.lastSubmittedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);

      if (cooldownSec > 0 && diffSec < cooldownSec) {
        throw new HttpsError('resource-exhausted', `${cooldownSec - diffSec}초 후에 다시 접수할 수 있습니다.`);
      }
    }

    tx.set(caseRef, {
      userId: uid,
      docketNumber,
      courtName: '소소킹 판결소',
      courtroom: '제404호 생활법정',
      division: '제3생활부',
      courtStage: 'filed',
      caseTitle: 'AI 사건명 작성 중',
      caseDescription: desc,
      nickname: profileNickname || randomNickname(),
      status: 'pending',
      isPublic,
      reportCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.set(limitRef, {
      date: today,
      count: count + 1,
      dailyLimit,
      lastSubmittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return { caseId, docketNumber, dailyLimit, cooldownSec };
});
