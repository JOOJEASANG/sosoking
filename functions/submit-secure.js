const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
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
const CATEGORIES = [['라면','라면'], ['푸딩','간식'], ['과자','간식'], ['커피','카페'], ['치킨','간식'], ['냉장고','냉장고'], ['빵','간식'], ['강아지','동물'], ['고양이','동물'], ['리모컨','리모컨'], ['카톡','읽씹'], ['지각','지각'], ['청소','집안일'], ['설거지','집안일']];
const SERIOUS_KEYWORDS = ['폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금','성범죄','성폭력','성추행','성희롱','강간','강제추행','가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따','이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원','응급','정신과','우울증','공황','자해','자살','의료','진단','치료'];
const PRIVATE_PATTERNS = [/\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}/, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, /\d{6}[-\s]?\d{7}/, /(주민번호|주민등록번호|계좌번호|카톡아이디|카카오톡ID|인스타그램|텔레그램|전화번호|휴대폰번호)/i];

function requireRealLogin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') throw new HttpsError('unauthenticated', '사건 접수는 구글 또는 이메일 로그인 후 이용할 수 있습니다.');
}
function textValue(value, maxLen) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen); }
function clampNumber(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }
function boolValue(value, fallback = false) { if (typeof value === 'boolean') return value; if (value === 'true') return true; if (value === 'false') return false; return fallback; }
function firstDefined(...values) { return values.find(v => v !== undefined && v !== null); }
function kstDateKey(date = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNickname() { return NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)] + NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)]; }
function selectedJudgeOrBlank(value) { return JUDGES.includes(value) ? value : ''; }
function inferCategory(title, desc) { const text = `${title} ${desc}`; const found = CATEGORIES.find(([kw]) => text.includes(kw)); return found ? found[1] : '황당'; }
function makeDocket(today, category) { return `${today.slice(0, 4)}황당-${category}-${Math.floor(1000 + Math.random() * 9000)}`; }
function containsBannedWord(text, bannedWords = []) { const source = String(text || '').toLowerCase(); return bannedWords.some(word => { const w = String(word || '').trim().toLowerCase(); return w && source.includes(w); }); }
function containsSeriousKeyword(text) { const source = String(text || '').replace(/\s+/g, ''); return SERIOUS_KEYWORDS.some(word => source.includes(word)); }
function containsPrivatePattern(text) { return PRIVATE_PATTERNS.some(re => re.test(String(text || ''))); }
function compact(value) { return String(value || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').replace(/["“”'‘’]/g, '').trim(); }
function clipTitle(title) { const clean = compact(title).replace(/사건\s*사건$/g, '사건'); return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trim()}…` : clean; }
function makeSmartTitle(desc) {
  const cleaned = textValue(desc, MAX_DESC).replace(/^(제가|내가|나는|저는|나|저)\s*/g, '').replace(/(하고 있었는데|하고 있었는 데|했는데|하던 중|한눈판사이|한눈 판 사이|잠깐 사이|사이에)/g, ' ').replace(/[.!?。！？].*$/g, '').trim();
  return clipTitle(`${cleaned.slice(0, 28).trim() || '소소한 일상'} 사건`);
}
function normalizeAiTitle(raw, fallbackTitle) {
  let title = String(raw || '').replace(/```json|```/g, '').trim();
  try { const start = title.indexOf('{'); const end = title.lastIndexOf('}'); if (start >= 0 && end > start) { const parsed = JSON.parse(title.slice(start, end + 1)); title = parsed.caseTitle || parsed.title || title; } } catch (_) {}
  title = textValue(title, MAX_TITLE).replace(/^사건명\s*[:：]\s*/g, '').replace(/["“”'‘’]/g, '').replace(/[.!?。！？]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!title) return fallbackTitle || '';
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return clipTitle(title);
}
async function makeAiTitle(desc, fallbackTitle, modelName) {
  const key = geminiKey.value().trim();
  if (!key || !desc) return fallbackTitle || '';
  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: modelName || 'gemini-2.5-flash', generationConfig: { temperature: 0.78, topP: 0.92, topK: 40, responseMimeType: 'application/json' } });
    const prompt = `너는 소소킹 황당재판소의 사건명 작성관이다.

사용자의 접수 내용을 바로 제목으로 만들지 말고, 내부적으로 정리한 뒤 최종 사건명 1개를 만든다. 내부 정리 과정은 출력하지 않는다.

규칙:
- 18~35자 권장, 최대 40자.
- 사건 내용 안에 실제로 등장하는 핵심 대상(누가/무엇을)과 핵심 행동(무슨 일을 했는지)을 반드시 포함한다. 내용에 없는 소재나 사물을 지어내지 않는다.
- 사건 내용의 앞부분 문장을 그대로 잘라 쓰지 말고, 전체 내용을 읽고 핵심을 요약해서 새로 구성한다.
- 반드시 '사건'으로 끝낸다.
- 실제 범죄처럼 보이게 과격하게 쓰지 않는다.
- 웃기려고 드립을 치지 말고, 너무 진지한 사건명처럼 쓴다.

사건 내용:
${desc}

JSON만 출력하라.
{"draftTitle":"1차 사건명 초안","titleBasis":["핵심 대상","핵심 행동"],"caseTitle":"최종 사건명"}`;
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return normalizeAiTitle(result.response.text(), fallbackTitle);
  } catch (err) { console.error('AI title generation failed:', err); return fallbackTitle || ''; }
}
function normalizeImageAttachment(value) {
  if (!value || typeof value !== 'object') return null;
  const mimeType = textValue(value.mimeType, 30);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new HttpsError('invalid-argument', '이미지는 JPG, PNG, WEBP 형식만 첨부할 수 있습니다.');
  const data = String(value.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!data) return null;
  if (data.length > MAX_IMAGE_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(data)) throw new HttpsError('invalid-argument', '이미지 데이터 형식 또는 용량이 올바르지 않습니다.');
  return { mimeType, data, width: clampNumber(value.width, 0, 0, 4000), height: clampNumber(value.height, 0, 0, 4000), originalName: textValue(value.originalName, 80), originalSize: clampNumber(value.originalSize, 0, 0, 25 * 1024 * 1024), resizedSize: clampNumber(value.resizedSize, 0, 0, 1024 * 1024), resized: true };
}
async function uploadCaseImage(uid, caseId, image) {
  if (!image) return null;
  const ext = image.mimeType === 'image/png' ? 'png' : image.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `case-images/${uid}/${caseId}/evidence.${ext}`;
  const buffer = Buffer.from(image.data, 'base64');
  if (buffer.length > 650 * 1024) throw new HttpsError('invalid-argument', '첨부 이미지 용량이 큽니다. 더 작은 이미지를 첨부해주세요.');
  await getStorage().bucket().file(storagePath).save(buffer, { contentType: image.mimeType, metadata: { cacheControl: 'private,max-age=3600', metadata: { ownerId: uid, caseId } } });
  return { storagePath, mimeType: image.mimeType, width: image.width, height: image.height, originalName: image.originalName, originalSize: image.originalSize, resizedSize: image.resizedSize, resized: true };
}
async function loadSettings() { const snap = await db.doc('site_settings/config').get(); return snap.exists ? snap.data() : {}; }
async function loadUserNickname(uid) { try { const snap = await db.doc(`users/${uid}`).get(); return snap.exists ? textValue(snap.data().nickname, 30) : ''; } catch { return ''; } }
async function reserveSubmitSlot(uid, today, dailyLimit, cooldownSec) {
  const limitRef = db.doc(`rate_limits/${uid}`);
  await db.runTransaction(async tx => {
    const limitSnap = await tx.get(limitRef);
    const current = limitSnap.exists ? limitSnap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= dailyLimit) throw new HttpsError('resource-exhausted', `오늘 접수 한도 ${dailyLimit}건을 초과했습니다. 황당재판부도 하루에 너무 많은 황당함은 감당하기 어렵습니다.`);
    if (current.lastSubmittedAt && current.date === today) {
      const lastMs = current.lastSubmittedAt.toMillis ? current.lastSubmittedAt.toMillis() : new Date(current.lastSubmittedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (cooldownSec > 0 && diffSec < cooldownSec) throw new HttpsError('resource-exhausted', `${cooldownSec - diffSec}초 후에 다시 접수할 수 있습니다. 재판부가 방금 전 사건의 황당함을 아직 정리 중입니다.`);
    }
    tx.set(limitRef, { date: today, count: count + 1, lastSubmittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

exports.submitCase = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 60, memory: '256MiB' }, async request => {
  requireRealLogin(request);
  const uid = request.auth.uid;
  const data = request.data || {};
  const submittedTitle = textValue(firstDefined(data.caseTitle, data.title), MAX_TITLE);
  const desc = textValue(firstDefined(data.caseDescription, data.description), MAX_DESC);
  if (!desc) throw new HttpsError('invalid-argument', '황당사건 경위를 입력해주세요.');
  const desired = textValue(data.desiredVerdict, MAX_DESIRED);
  const grievance = clampNumber(firstDefined(data.grievanceIndex, data.grievance), 5, 1, 10);
  const selectedJudge = selectedJudgeOrBlank(firstDefined(data.selectedJudge, data.judgeType));
  const imageInput = normalizeImageAttachment(data.imageAttachment);
  const contentForChecks = `${submittedTitle} ${desc} ${desired}`;
  const settings = await loadSettings();
  const dailyLimit = clampNumber(settings.dailyLimit, HARD_DAILY_LIMIT, 1, 20);
  const cooldownSec = clampNumber(settings.cooldownSec, DEFAULT_COOLDOWN_SEC, 0, 300);
  const bannedWords = Array.isArray(settings.bannedWords) ? settings.bannedWords : [];

  if (containsBannedWord(contentForChecks, bannedWords)) throw new HttpsError('failed-precondition', '관리자가 제한한 단어가 포함되어 있습니다.');
  if (containsPrivatePattern(contentForChecks)) throw new HttpsError('failed-precondition', '실명·연락처·이메일·주민번호·계좌번호 등 개인정보나 특정 가능한 정보는 접수할 수 없습니다.');
  if (containsSeriousKeyword(contentForChecks)) throw new HttpsError('failed-precondition', '실제 범죄·소송·학교폭력·가정폭력·의료·정신건강 등 중대한 사안은 소소킹에서 접수할 수 없습니다. 사소한 일상 소재만 오락용으로 접수해주세요.');

  const isAdminSubmitter = await isAdminAuth(request.auth).catch(() => false);
  const today = kstDateKey();
  if (!isAdminSubmitter) await reserveSubmitSlot(uid, today, dailyLimit, cooldownSec);

  const smartTitle = makeSmartTitle(desc);
  const titleIsManual = boolValue(data.caseTitleManual, false) && !!submittedTitle;
  const geminiModel = textValue(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const aiTitle = titleIsManual ? '' : await makeAiTitle(desc, smartTitle, geminiModel);
  const autoTitle = aiTitle || smartTitle;
  const title = titleIsManual ? submittedTitle : (autoTitle || submittedTitle || smartTitle);
  if (!title) throw new HttpsError('invalid-argument', '황당사건명을 입력해주세요.');

  const isPublic = boolValue(data.isPublic, false);
  const category = inferCategory(title, desc);
  const docketNumber = makeDocket(today, category);
  const caseId = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const profileNickname = await loadUserNickname(uid);
  const imageAttachment = await uploadCaseImage(uid, caseId, imageInput);

  await db.doc(`cases/${caseId}`).set({
    userId: uid,
    submittedByAdmin: isAdminSubmitter,
    docketNumber,
    courtName: '소소킹 황당재판소',
    courtroom: pickFrom(COURTROOMS),
    division: '제3황당재판부',
    recordClerk: pickFrom(CLERKS),
    analystName: pickFrom(ANALYSTS),
    caseCategory: category,
    courtStage: 'filed',
    caseTitle: title,
    originalCaseTitle: submittedTitle || '',
    autoCaseTitle: autoTitle || '',
    smartCaseTitle: smartTitle || '',
    aiCaseTitle: aiTitle || '',
    caseTitleManual: titleIsManual,
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

  return { caseId, docketNumber, dailyLimit, adminBypass: isAdminSubmitter, hasImageAttachment: !!imageAttachment, caseTitle: title, aiCaseTitle: aiTitle || '' };
});
