const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MAX_TITLE = 40;
const MAX_DESC = 320;
const MAX_DESIRED = 160;
const HARD_DAILY_LIMIT = 3;
const DEFAULT_COOLDOWN_SEC = 45;
const MAX_IMAGE_BASE64_LENGTH = 820000;
const JUDGES = ['엄벌주의형','감성형','현실주의형','과몰입형','피곤형','논리집착형','드립형'];
const NICK_ADJ = ['억울한','분노한','황당한','지친','당황한','슬픈','안타까운','기막힌'];
const NICK_NOUN = ['직장인','집사','아무개','라면러버','과자지킴이','충전기수호자','리모컨분실자','냉장고파수꾼'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보', '한과몰입 법정주사'];
const ANALYSTS = ['억울함 분석관', '황당성 감정관', '사소함 확대관', '황당질서 검토관', '한입만 감별관'];
const CATEGORIES = [
  ['라면','라면'], ['국물','라면'], ['푸딩','간식'], ['과자','간식'], ['커피','카페'], ['치킨','간식'], ['냉장고','냉장고'],
  ['리모컨','리모컨'], ['카톡','읽씹'], ['읽씹','읽씹'], ['약속','지각'], ['지각','지각'], ['청소','집안일'], ['설거지','집안일']
];
const SERIOUS_KEYWORDS = [
  '폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금',
  '성범죄','성폭력','성추행','성희롱','강간','강제추행',
  '가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따',
  '이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원',
  '응급','정신과','우울증','공황','자해','자살','의료','진단','치료'
];

function requireRealLogin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') {
    throw new HttpsError('unauthenticated', '사건 접수는 구글 또는 이메일 로그인 후 이용할 수 있습니다.');
  }
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
function firstDefined(...values) {
  return values.find(v => v !== undefined && v !== null);
}
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function inferCategory(title, desc) {
  const text = `${title} ${desc}`;
  const found = CATEGORIES.find(([kw]) => text.includes(kw));
  return found ? found[1] : '황당';
}
function makeDocket(today, category) {
  const year = today.slice(0, 4);
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `${year}황당-${category}-${seq}`;
}
function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomNickname() {
  return NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)] + NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
}
function selectedJudgeOrBlank(value) { return JUDGES.includes(value) ? value : ''; }
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
function normalizeImageAttachment(value) {
  if (!value || typeof value !== 'object') return null;
  const mimeType = textValue(value.mimeType, 30);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new HttpsError('invalid-argument', '이미지는 JPG, PNG, WEBP 형식만 첨부할 수 있습니다.');
  }
  const data = String(value.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!data) return null;
  if (data.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new HttpsError('invalid-argument', '첨부 이미지 용량이 큽니다. 자동 리사이즈 후 다시 시도해주세요.');
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
    throw new HttpsError('invalid-argument', '이미지 데이터 형식이 올바르지 않습니다.');
  }
  const width = clampNumber(value.width, 0, 0, 4000);
  const height = clampNumber(value.height, 0, 0, 4000);
  return {
    mimeType,
    data,
    width,
    height,
    originalName: textValue(value.originalName, 80),
    originalSize: clampNumber(value.originalSize, 0, 0, 25 * 1024 * 1024),
    resizedSize: clampNumber(value.resizedSize, 0, 0, 1024 * 1024),
    resized: true
  };
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
  } catch (e) {
    console.error('profile load failed:', e);
    return '';
  }
}

exports.submitCase = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  requireRealLogin(request);

  const uid = request.auth.uid;
  const data = request.data || {};
  const title = textValue(firstDefined(data.caseTitle, data.title), MAX_TITLE);
  const desc = textValue(firstDefined(data.caseDescription, data.description), MAX_DESC);
  const desired = textValue(data.desiredVerdict, MAX_DESIRED);
  const grievance = clampNumber(firstDefined(data.grievanceIndex, data.grievance), 5, 1, 10);
  const selectedJudge = selectedJudgeOrBlank(firstDefined(data.selectedJudge, data.judgeType));
  const isPublic = boolValue(data.isPublic, true);
  const imageAttachment = normalizeImageAttachment(data.imageAttachment);
  const isAdminSubmitter = await isAdminAuth(request.auth).catch(() => false);
  const profileNickname = await loadUserNickname(uid);

  if (!title) throw new HttpsError('invalid-argument', '황당사건명을 입력해주세요.');
  if (!desc) throw new HttpsError('invalid-argument', '황당사건 경위를 입력해주세요.');

  const settings = await loadSettings();
  const dailyLimit = clampNumber(settings.dailyLimit, HARD_DAILY_LIMIT, 1, 20);
  const cooldownSec = clampNumber(settings.cooldownSec, DEFAULT_COOLDOWN_SEC, 0, 300);
  const bannedWords = Array.isArray(settings.bannedWords) ? settings.bannedWords : [];
  const contentForChecks = `${title} ${desc} ${desired}`;
  if (containsBannedWord(contentForChecks, bannedWords)) {
    throw new HttpsError('failed-precondition', '관리자가 제한한 단어가 포함되어 있습니다.');
  }
  if (containsSeriousKeyword(contentForChecks)) {
    throw new HttpsError('failed-precondition', '실제 범죄·소송·학교폭력·가정폭력·의료·정신건강 등 중대한 사안은 소소킹에서 접수할 수 없습니다. 사소한 일상 소재만 오락용으로 접수해주세요.');
  }

  const today = kstDateKey();
  const category = inferCategory(title, desc);
  const docketNumber = makeDocket(today, category);
  const caseId = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const caseRef = db.doc(`cases/${caseId}`);
  const limitRef = db.doc(`rate_limits/${uid}`);
  const courtroom = pickFrom(COURTROOMS);
  const recordClerk = pickFrom(CLERKS);
  const analystName = pickFrom(ANALYSTS);

  await db.runTransaction(async tx => {
    let nextCount = 0;
    if (!isAdminSubmitter) {
      const limitSnap = await tx.get(limitRef);
      const current = limitSnap.exists ? limitSnap.data() : {};
      const count = current.date === today ? Number(current.count || 0) : 0;
      nextCount = count + 1;
      if (count >= dailyLimit) {
        throw new HttpsError('resource-exhausted', `오늘 접수 한도 ${dailyLimit}건을 초과했습니다. 황당재판부도 하루에 너무 많은 황당함은 감당하기 어렵습니다.`);
      }
      if (current.lastSubmittedAt && current.date === today) {
        const lastMs = current.lastSubmittedAt.toMillis ? current.lastSubmittedAt.toMillis() : new Date(current.lastSubmittedAt).getTime();
        const diffSec = Math.floor((Date.now() - lastMs) / 1000);
        if (cooldownSec > 0 && diffSec < cooldownSec) {
          throw new HttpsError('resource-exhausted', `${cooldownSec - diffSec}초 후에 다시 접수할 수 있습니다. 재판부가 방금 전 사건의 황당함을 아직 정리 중입니다.`);
        }
      }
    }

    tx.set(caseRef, {
      userId: uid,
      submittedByAdmin: isAdminSubmitter,
      docketNumber,
      courtName: '소소킹 황당재판소',
      courtroom,
      division: '제3황당재판부',
      recordClerk,
      analystName,
      caseCategory: category,
      courtStage: 'filed',
      caseTitle: title,
      caseDescription: desc,
      grievanceIndex: grievance,
      nickname: isAdminSubmitter ? (profileNickname || '관리자') : (profileNickname || randomNickname()),
      desiredVerdict: desired,
      selectedJudge,
      imageAttachment,
      hasImageAttachment: !!imageAttachment,
      status: 'pending',
      isPublic,
      reportCount: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (!isAdminSubmitter) {
      tx.set(limitRef, { date: today, count: nextCount, lastSubmittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  });

  return { caseId, docketNumber, dailyLimit, adminBypass: isAdminSubmitter, hasImageAttachment: !!imageAttachment };
});
