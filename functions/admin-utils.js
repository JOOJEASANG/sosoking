const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const SERIOUS_KEYWORDS = ['폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금','성범죄','성폭력','성추행','성희롱','강간','강제추행','가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따','이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원','응급','정신과','우울증','공황','자해','자살','의료','진단','치료'];
const PRIVATE_PATTERNS = [/\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}/, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, /\d{6}[-\s]?\d{7}/, /(주민번호|주민등록번호|계좌번호|카톡아이디|카카오톡ID|인스타그램|텔레그램|전화번호|휴대폰번호|주소)/i];

function textValue(value, maxLen = 1000) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function cleanEmail(value) { return String(value || '').trim().toLowerCase(); }
function cleanId(value, maxLen = 180) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen); }
function cleanNickname(value) { return String(value || '').replace(/\s+/g, '').trim().slice(0, 20); }
function nicknameKey(value) { return cleanNickname(value).toLocaleLowerCase('ko-KR'); }
function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
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
function containsBannedWord(text, bannedWords = []) {
  const source = String(text || '').toLowerCase();
  return bannedWords.some(word => {
    const w = String(word || '').trim().toLowerCase();
    return w && source.includes(w);
  });
}
function containsSeriousKeyword(text) {
  const source = String(text || '').replace(/\s+/g, '');
  return SERIOUS_KEYWORDS.some(word => source.includes(word));
}
function containsPrivatePattern(text) { return PRIVATE_PATTERNS.some(re => re.test(String(text || ''))); }
async function isAdminAuth(auth) {
  if (!auth?.uid) return false;
  const uidSnap = await db.doc(`admins/${auth.uid}`).get();
  if (uidSnap.exists) return true;
  const email = cleanEmail(auth.token?.email);
  const emailVerified = auth.token?.email_verified === true;
  if (!email || !emailVerified) return false;
  const emailSnap = await db.doc(`admins/${email}`).get();
  return emailSnap.exists;
}
async function assertAdmin(request) {
  if (!request.auth || !(await isAdminAuth(request.auth))) throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
}
function requireRealLogin(request, message = '구글 또는 이메일 로그인 후 이용할 수 있습니다.') {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') throw new HttpsError('unauthenticated', message);
}
async function loadSettings() {
  const [publicSnap, privateSnap] = await Promise.all([
    db.doc('site_settings/config').get().catch(() => null),
    db.doc('admin_settings/config').get().catch(() => null),
  ]);
  return {
    ...(publicSnap?.exists ? publicSnap.data() : {}),
    ...(privateSnap?.exists ? privateSnap.data() : {}),
  };
}
async function writeAdminLog(uid, action, targetId, detail = {}) {
  await db.collection('admin_logs').add({ uid, action, targetId, detail, createdAt: FieldValue.serverTimestamp() }).catch(() => null);
}

module.exports = {
  db, REGION, FieldValue, HttpsError,
  textValue, cleanEmail, cleanId, cleanNickname, nicknameKey, clampNumber, boolValue, kstDateKey,
  containsBannedWord, containsSeriousKeyword, containsPrivatePattern,
  isAdminAuth, assertAdmin, requireRealLogin, loadSettings, writeAdminLog,
};
