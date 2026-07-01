const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MAX_TITLE = 30;
const MAX_DESC = 200;
const MAX_DESIRED = 100;
const HARD_DAILY_LIMIT = 3;
const DEFAULT_COOLDOWN_SEC = 45;
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const NICK_NOUN = ['제보자','라면러버','과자지킴이','충전기수호자','리모컨분실자','냉장고파수꾼','양말감시관','만두목격자'];

function requireRealLogin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') throw new HttpsError('unauthenticated', '한 줄 소소사건 접수는 로그인 후 이용할 수 있습니다.');
}
function textValue(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
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
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function makeDocket(today) {
  const compact = today.replace(/-/g, '').slice(2);
  return `소소${compact}-긴급처리-${Math.floor(1000 + Math.random() * 9000)}`;
}
function randomNickname() {
  return NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
}
function selectedJudgeOrBlank(value) { return JUDGES.includes(value) ? value : ''; }
function containsBannedWord(text, bannedWords = []) {
  const source = String(text || '').toLowerCase();
  return bannedWords.some(word => {
    const w = String(word || '').trim().toLowerCase();
    return w && source.includes(w);
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
  } catch {
    return '';
  }
}

exports.submitCase = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  requireRealLogin(request);

  const uid = request.auth.uid;
  const data = request.data || {};
  const title = textValue(data.caseTitle, MAX_TITLE);
  const desc = textValue(data.caseDescription, MAX_DESC);
  const desired = textValue(data.desiredVerdict, MAX_DESIRED);
  const grievance = clampNumber(data.grievanceIndex, 5, 1, 10);
  const selectedJudge = selectedJudgeOrBlank(data.selectedJudge);
  const isPublic = boolValue(data.isPublic, true);
  const profileNickname = await loadUserNickname(uid);

  if (!title) throw new HttpsError('invalid-argument', '소소사건 제목을 입력해주세요.');
  if (!desc) throw new HttpsError('invalid-argument', '한 줄 소소사건 내용을 입력해주세요.');

  const settings = await loadSettings();
  const cooldownSec = clampNumber(settings.cooldownSec, DEFAULT_COOLDOWN_SEC, 0, 300);
  const bannedWords = Array.isArray(settings.bannedWords) ? settings.bannedWords : [];
  if (containsBannedWord(`${title} ${desc} ${desired}`, bannedWords)) {
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
    if (count >= HARD_DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘 접수 한도 3건을 초과했습니다.');
    if (current.lastSubmittedAt) {
      const lastMs = current.lastSubmittedAt.toMillis ? current.lastSubmittedAt.toMillis() : new Date(current.lastSubmittedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (cooldownSec > 0 && diffSec < cooldownSec) throw new HttpsError('resource-exhausted', `${cooldownSec - diffSec}초 후에 다시 접수할 수 있습니다.`);
    }

    tx.set(caseRef, {
      userId: uid,
      docketNumber,
      courtName: '소소긴급위원회',
      courtroom: '긴급소소상황실',
      division: '한줄소소처리부',
      courtStage: 'filed',
      caseTitle: title,
      caseDescription: desc,
      grievanceIndex: grievance,
      nickname: profileNickname || randomNickname(),
      desiredVerdict: desired,
      selectedJudge,
      status: 'pending',
      isPublic,
      reportCount: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(limitRef, { date: today, count: count + 1, lastSubmittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { caseId, docketNumber, dailyLimit: HARD_DAILY_LIMIT };
});