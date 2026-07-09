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
const TITLE_DAILY_LIMIT = 30;
const TITLE_COOLDOWN_SEC = 10;
const COMMENT_DAILY_LIMIT = 30;
const COMMENT_COOLDOWN_SEC = 20;
const MAX_IMAGE_BASE64_LENGTH = 820000;
const MAX_IMAGE_BYTES = 620 * 1024;
const REACTIONS = ['plaintiff', 'defendant', 'both', 'tooMuch', 'funny'];
const JUDGES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];
const COURTROOMS = ['제404호 황당법정', '제101호 사소분쟁법정', '제777호 과몰입법정', '제3호 억울함전담법정'];
const CLERKS = ['정기록 서기관', '나과장 기록관', '박진지 참여관', '오억울 서기보', '한과몰입 법정주사'];
const ANALYSTS = ['소소경찰 박소소 경위', '황당성 감식반 오억울 조사관', '사소범죄전담 나과몰입 형사', '생활증거추적팀 정침묵 수사관'];
const PROSECUTORS = ['황당검사 강엄숙', '생활질서전담 오진지 검사', '한입권 담당 나과장 검사', '소소공소부 박과몰입 검사'];
const DEFENDERS = ['피고측 변호인 최그정도', '국선변호인 안대수롭', '생활변호센터 조그럴수도 변호사', '피고방어전담 임몰랐다 변호인'];
const NICK_ADJ = ['억울한', '분노한', '황당한', '지친', '당황한', '슬픈', '안타까운', '기막힌'];
const NICK_NOUN = ['직장인', '집사', '아무개', '라면러버', '과자지킴이', '충전기수호자', '리모컨분실자', '냉장고파수꾼'];
const CATEGORIES = [
  ['라면', '라면'], ['국물', '라면'], ['푸딩', '간식'], ['과자', '간식'], ['커피', '카페'], ['치킨', '간식'], ['냉장고', '냉장고'],
  ['빵', '간식'], ['리트리버', '동물'], ['강아지', '동물'], ['고양이', '동물'], ['리모컨', '리모컨'], ['카톡', '읽씹'], ['읽씹', '읽씹'],
  ['약속', '지각'], ['지각', '지각'], ['청소', '집안일'], ['설거지', '집안일']
];
const SERIOUS_KEYWORDS = [
  '폭행', '폭력', '상해', '살인', '강도', '절도', '사기', '협박', '스토킹', '납치', '감금',
  '성범죄', '성폭력', '성추행', '성희롱', '강간', '강제추행',
  '가정폭력', '학교폭력', '직장내괴롭힘', '갑질', '따돌림', '왕따',
  '이혼', '위자료', '손해배상', '형사고소', '고발', '소송', '민사', '형사', '법원',
  '응급', '정신과', '우울증', '공황', '자해', '자살', '의료', '진단', '치료'
];
const PRIVACY_PATTERNS = [
  /\b\d{2,3}-\d{3,4}-\d{4}\b/,
  /\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{6}[-\s]?\d{7}\b/,
  /\b\d{2,6}[-\s]?\d{2,6}[-\s]?\d{2,8}\b/,
  /(카톡|카카오톡|인스타|instagram|텔레그램|telegram)\s*[:：]?\s*[A-Za-z0-9_.-]{4,}/i
];
const COMMENT_BLOCK_PATTERNS = [
  /(시발|씨발|병신|개새끼|죽어|자살|꺼져|염병|좆|ㅅㅂ|ㅂㅅ)/i,
  /(실명|전화번호|주민번호|계좌번호|주소)/i,
  /https?:\/\//i,
  ...PRIVACY_PATTERNS
];
const DEFAULT_DETAILS = ['너무 평온했던 시작 장면', '원고가 잠깐 방심한 3초', '피고가 자연스럽게 접근한 순간', '현장에 남은 애매한 침묵', '원고 표정에 남은 납득 불가', '주변 공기의 수상한 정적', '작지만 오래 남은 허전함', '피고 측의 태연한 태도', '사건 후 더 크게 느껴진 억울함', '마지막 한입권의 상징적 상실', '생활평온이 접힌 순간', '방청석도 잠시 조용해진 장면'];
const DEFAULT_EVIDENCE = ['현장 주변의 미세한 흔적', '원고 진술 속 반복된 억울함', '사건 직후 남은 정적', '피고의 애매한 표정', '원래 있어야 할 자리의 공백', '주변 사물의 침묵', '원고가 멈춰 선 위치', '재판부가 과몰입한 기록'];
const DEFAULT_EXCUSES = ['피고 측은 고의가 없었다고 주장한다.', '피고 측은 당시 상황이 너무 일상적이었다고 항변한다.', '피고 측은 원고가 지나치게 엄숙하게 받아들였다고 말한다.', '피고 측은 기억이 희미하다고 주장한다.', '피고 측은 그럴 수도 있는 일이라고 말한다.'];
const DEFAULT_PENALTIES = ['피고는 같은 상황에서 3초간 멈춰 확인한다.', '피고는 원고에게 작은 간식 또는 음료로 평화조치를 제안한다.', '피고는 그럴 수도 있지라는 말을 1회 보류한다.', '피고는 사건 현장을 원상회복에 준해 정리한다.', '피고는 원고의 억울함을 10초간 진지하게 청취한다.', '피고는 재발 방지를 위해 다음부터 먼저 확인한다.'];

function cleanText(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function cleanLong(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLen);
}
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
function firstDefined(...values) { return values.find(v => v !== undefined && v !== null); }
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function requireRealLogin(request, message = '로그인 후 이용할 수 있습니다.') {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') throw new HttpsError('unauthenticated', message);
}
function containsSeriousKeyword(text) {
  const source = String(text || '').replace(/\s+/g, '');
  return SERIOUS_KEYWORDS.some(word => source.includes(word));
}
function containsPrivacyPattern(text) {
  const source = String(text || '');
  return PRIVACY_PATTERNS.some(re => re.test(source));
}
function containsBannedWord(text, bannedWords = []) {
  const source = String(text || '').toLowerCase();
  return bannedWords.some(word => {
    const w = String(word || '').trim().toLowerCase();
    return w && source.includes(w);
  });
}
function assertSafeCaseContent(text, bannedWords = []) {
  if (containsBannedWord(text, bannedWords)) throw new HttpsError('failed-precondition', '관리자가 제한한 단어가 포함되어 있습니다.');
  if (containsPrivacyPattern(text)) throw new HttpsError('failed-precondition', '실명, 연락처, 이메일, 주민번호, 계좌번호 등 개인정보로 보이는 내용은 접수할 수 없습니다.');
  if (containsSeriousKeyword(text)) throw new HttpsError('failed-precondition', '실제 범죄·소송·학교폭력·가정폭력·의료·정신건강 등 중대한 사안은 소소킹에서 접수할 수 없습니다. 사소한 일상 소재만 오락용으로 접수해주세요.');
}
function inferCategory(title, desc) {
  const text = `${title} ${desc}`;
  const found = CATEGORIES.find(([kw]) => text.includes(kw));
  return found ? found[1] : '황당';
}
function makeDocket(today, category) {
  return `${today.slice(0, 4)}황당-${category}-${Math.floor(1000 + Math.random() * 9000)}`;
}
function randomNickname() {
  return NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)] + NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
}
function selectedJudgeOrBlank(value) { return JUDGES.includes(value) ? value : ''; }
function pickFrom(arr, seedText = '') {
  const s = String(seedText || Date.now());
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 9973;
  return arr[n % arr.length];
}
function pickJudge(value, seed = '') {
  return JUDGES.includes(value) ? value : pickFrom(JUDGES, seed || Date.now());
}
function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim();
}
function clipTitle(title) {
  const clean = compact(title).replace(/사건\s*사건$/g, '사건');
  return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trim()}…` : clean;
}
function fallbackTitle(desc) {
  const text = cleanText(desc, MAX_DESC)
    .replace(/^(제가|내가|나는|저는|나|저)\s*/g, '')
    .replace(/(하고 있었는데|하고 있었는 데|했는데|하던 중|한눈판사이|한눈 판 사이|잠깐 사이|사이에)/g, ' ')
    .replace(/[.!?。！？].*$/g, '')
    .trim();
  const title = `${text.slice(0, 28).trim() || '소소한 일상'} 사건`;
  return clipTitle(title);
}
function normalizeAiTitle(raw, fallback) {
  let title = String(raw || '').replace(/```json|```/g, '').trim();
  try {
    const start = title.indexOf('{');
    const end = title.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(title.slice(start, end + 1));
      title = parsed.caseTitle || parsed.refinedTitle || parsed.draftTitle || parsed.title || title;
    }
  } catch (_) {}
  title = cleanText(title, MAX_TITLE).replace(/^사건명\s*[:：]\s*/g, '').replace(/["“”'‘’]/g, '').replace(/[.!?。！？]+$/g, '').trim();
  if (!title) return fallback || '';
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return clipTitle(title);
}
function safeJson(text) {
  const raw = String(text || '').replace(/```json|```/g, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('JSON parse failed');
  return JSON.parse(raw.slice(start, end + 1));
}
function safeArray(value, fallback, min, max, maxLen = 160) {
  const rows = Array.isArray(value) ? value.map(v => cleanText(v, maxLen)).filter(Boolean) : [];
  const merged = [...rows, ...fallback].filter(Boolean);
  return merged.slice(0, Math.max(min, max));
}
async function loadSettings() {
  try {
    const snap = await db.doc('site_settings/config').get();
    return snap.exists ? snap.data() : {};
  } catch {
    return {};
  }
}
async function loadUserNickname(uid) {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    return snap.exists ? cleanText(snap.data().nickname, 30) : '';
  } catch {
    return '';
  }
}
async function reserveDailyLimit(uid, settings, isAdmin) {
  if (isAdmin) return { nextCount: 0 };
  const today = kstDateKey();
  const dailyLimit = clampNumber(settings.dailyLimit, HARD_DAILY_LIMIT, 1, 20);
  const cooldownSec = clampNumber(settings.cooldownSec, DEFAULT_COOLDOWN_SEC, 0, 300);
  const limitRef = db.doc(`rate_limits/${uid}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(limitRef);
    const current = snap.exists ? snap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= dailyLimit) throw new HttpsError('resource-exhausted', `오늘 접수 한도 ${dailyLimit}건을 초과했습니다. 황당재판부도 하루에 너무 많은 황당함은 감당하기 어렵습니다.`);
    if (current.lastSubmittedAt && current.date === today) {
      const lastMs = current.lastSubmittedAt.toMillis ? current.lastSubmittedAt.toMillis() : new Date(current.lastSubmittedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (cooldownSec > 0 && diffSec < cooldownSec) throw new HttpsError('resource-exhausted', `${cooldownSec - diffSec}초 후에 다시 접수할 수 있습니다. 재판부가 방금 전 사건의 황당함을 아직 정리 중입니다.`);
    }
    tx.set(limitRef, { date: today, count: count + 1, lastSubmittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { dailyLimit, cooldownSec };
}
async function reserveTitleLimit(uid) {
  const today = kstDateKey();
  const ref = db.doc(`title_suggestion_limits/${uid}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? snap.data() : {};
    const count = cur.date === today ? Number(cur.count || 0) : 0;
    if (count >= TITLE_DAILY_LIMIT) throw new HttpsError('resource-exhausted', `오늘 AI 사건명 분석 한도 ${TITLE_DAILY_LIMIT}회를 모두 사용했습니다.`);
    if (cur.lastSuggestedAt && cur.date === today) {
      const lastMs = cur.lastSuggestedAt.toMillis ? cur.lastSuggestedAt.toMillis() : new Date(cur.lastSuggestedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (diffSec < TITLE_COOLDOWN_SEC) throw new HttpsError('resource-exhausted', `${TITLE_COOLDOWN_SEC - diffSec}초 후에 다시 분석할 수 있습니다.`);
    }
    tx.set(ref, { date: today, count: count + 1, lastSuggestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}
async function makeAiTitle(desc, fallback, modelName) {
  const key = geminiKey.value().trim();
  if (!key || !desc) return fallback;
  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: modelName || 'gemini-2.5-flash',
      generationConfig: { temperature: 0.78, topP: 0.92, topK: 40, responseMimeType: 'application/json' }
    });
    const prompt = `너는 소소킹 황당재판소의 사건명 작성관이다. 사용자의 사건 내용을 읽고 핵심 대상과 행동이 드러나는 사건명 1개를 만든다. 18~35자 권장, 최대 40자, 반드시 '사건'으로 끝낸다. 실제 범죄처럼 보이게 쓰지 않는다. JSON만 출력한다.\n사건 내용:\n${desc}\n{"caseTitle":"사건명"}`;
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return normalizeAiTitle(result.response.text(), fallback);
  } catch (err) {
    console.error('AI title generation failed:', err);
    return fallback;
  }
}
function normalizeImageAttachment(value) {
  if (!value || typeof value !== 'object') return null;
  const mimeType = cleanText(value.mimeType, 30);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new HttpsError('invalid-argument', '이미지는 JPG, PNG, WEBP 형식만 첨부할 수 있습니다.');
  const data = String(value.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!data) return null;
  if (data.length > MAX_IMAGE_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(data)) throw new HttpsError('invalid-argument', '이미지 데이터 형식이 올바르지 않거나 용량이 큽니다.');
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new HttpsError('invalid-argument', '첨부 이미지 용량이 큽니다. 자동 리사이즈 후 다시 시도해주세요.');
  return {
    mimeType,
    buffer,
    width: clampNumber(value.width, 0, 0, 4000),
    height: clampNumber(value.height, 0, 0, 4000),
    originalName: cleanText(value.originalName, 80) || 'attached-image',
    originalSize: clampNumber(value.originalSize, buffer.length, 0, 25 * 1024 * 1024),
    resizedSize: clampNumber(value.resizedSize, buffer.length, 0, 1024 * 1024)
  };
}
async function uploadCaseImage(uid, caseId, image) {
  if (!image) return { imageStoragePath: '', imageAttachmentMeta: null };
  const ext = image.mimeType === 'image/png' ? 'png' : image.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `case-images/${uid}/${caseId}/attachment.${ext}`;
  await getStorage().bucket().file(path).save(image.buffer, {
    resumable: false,
    metadata: { contentType: image.mimeType, cacheControl: 'private,max-age=0,no-transform' }
  });
  return {
    imageStoragePath: path,
    imageAttachmentMeta: {
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      originalName: image.originalName,
      originalSize: image.originalSize,
      resizedSize: image.resizedSize,
      storagePath: path
    }
  };
}
async function imageForGeminiFromStorage(path, meta = {}) {
  if (!path) return null;
  try {
    const [buffer] = await getStorage().bucket().file(path).download();
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
    const mimeType = cleanText(meta.mimeType, 30) || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
    return { mimeType, data: buffer.toString('base64') };
  } catch (err) {
    console.warn('case image load skipped:', err.message || err);
    return null;
  }
}
async function deleteCaseImages(caseId, c = {}, r = {}) {
  const bucket = getStorage().bucket();
  const paths = new Set([c.imageStoragePath, r.imageStoragePath, c.imageAttachmentMeta?.storagePath, r.imageAttachmentMeta?.storagePath].filter(Boolean));
  await Promise.all([...paths].map(path => bucket.file(path).delete({ ignoreNotFound: true }).catch(() => null)));
  const owner = c.userId || r.userId || r.ownerId || c.ownerId || '';
  if (owner) await bucket.deleteFiles({ prefix: `case-images/${owner}/${caseId}/` }).catch(() => null);
}
function localDocs(c, judgeType, people) {
  const title = c.caseTitle || '황당사건';
  const desc = c.caseDescription || title;
  return {
    refinedCaseTitle: title,
    absurdityTitle: `${title} 기록철`,
    expandedCase: `문서명: 사건 배경 및 발단 기록\n원고는 다음과 같이 진술하였다. ${desc}\n재판부는 이 사소한 문장 안에 하루의 평온이 흔들린 정황이 숨어 있다고 보았다. 별일 아닐 수 있는 일이지만, 원고에게는 그냥 넘기기 어려운 생활형 황당사건으로 기록된다.`,
    caseTimeline: `문서명: 분초 단위 사건일지\n00분 00초, 원고는 평온한 일상을 유지하고 있었다.\n00분 03초, 문제의 상황이 발생하였다.\n00분 07초, 원고는 이 일을 그냥 넘기기 어렵다고 판단하였다.\n00분 20초, 사건은 소소킹 황당재판소에 정식 접수될 정도로 과장되었다.`,
    forensicReport: `문서명: 소소국과수 감정서\n감정대상은 원고의 진술, 현장 분위기, 피고 측의 애매한 태도이다. 감정 결과, 물리적 피해는 작을 수 있으나 원고의 억울함 밀도는 상당한 것으로 보인다.`,
    plaintiffArg: `문서명: ${people.prosecutorName} 공소장\n검사는 본 사건을 단순한 해프닝으로만 볼 수 없다고 주장한다. 원고의 기대와 생활평온이 작지만 분명하게 흔들렸다는 점에서 황당처분이 필요하다고 본다.`,
    defendantArg: `문서명: ${people.defenderName} 답변서\n피고 측은 고의가 없었고 상황이 과장되었다고 항변한다. 다만 재판부는 피고 측의 태연함이 오히려 원고의 억울함을 키웠을 가능성을 배제하지 않는다.`,
    courtOpinion: `${judgeType} 재판부는 이 사건이 실제 법정에 갈 일은 아니지만 마음속 방청석에서는 충분히 다툴 만한 사안이라고 본다. 원고의 청구는 대체로 웃음 회복의 범위 안에서 이유 있다.`,
    verdict: `본 황당재판부는 원고의 억울함을 일부 인정한다. 본 판결은 오락 목적의 AI 생성 콘텐츠이며 실제 법적 효력은 없다.`,
    sentence: `문서명: 주문 및 소소형량\n1. 피고는 원고의 억울함을 10초간 진지하게 청취한다.\n2. 피고는 같은 상황에서 3초간 먼저 확인한다.\n3. 피고는 작은 간식 또는 음료로 평화회복을 제안한다.\n4. 원고는 본 판결문을 읽고 마음속으로 사건을 종결한다.`,
    closingComment: '작은 사건이었지만, 재판부의 과몰입은 작지 않았다.'
  };
}
async function generateDocs(model, c, judgeType, people, geminiImage) {
  const prompt = `너는 소소킹 황당재판소의 AI 재판부다. 실제 법률문서가 아닌 오락용 황당판결문을 만든다. 실명·연락처·정치·혐오·성적 내용·실제 범죄·의료·정신건강 조언은 피한다. 입력 사건을 구체적 장면 중심으로 과하게 진지하게 다룬다. JSON만 출력한다.\n사건명: ${cleanText(c.caseTitle, 90)}\n사건내용: ${cleanText(c.caseDescription, 700)}\n원하는 처분: ${cleanText(c.desiredVerdict, 180)}\n재판부: ${judgeType}\n필드: refinedCaseTitle, absurdityTitle, expandedCase, caseTimeline, forensicReport, plaintiffArg, defendantArg, courtOpinion, verdict, sentence, closingComment, absurdDetails, evidenceBits, defendantExcuses, penaltyIdeas, keyIssues, absurdityReview, investigation, executionOrder, appealNotice. 배열 필드는 각각 4개 이상. sentence는 3개 이상의 번호 처분.`;
  const parts = [{ text: prompt }];
  if (geminiImage) parts.push({ inlineData: geminiImage });
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const meta = result.response.usageMetadata || {};
  const p = safeJson(result.response.text());
  return { data: p, usage: { requests: 1, inputTokens: meta.promptTokenCount || 0, outputTokens: meta.candidatesTokenCount || 0 } };
}
function normalizeResultData(ai, fallback) {
  return {
    refinedCaseTitle: cleanText(ai.refinedCaseTitle, 80) || fallback.refinedCaseTitle,
    absurdityTitle: cleanText(ai.absurdityTitle, 120) || fallback.absurdityTitle,
    expandedCase: cleanLong(ai.expandedCase, 4400) || fallback.expandedCase,
    caseTimeline: cleanLong(ai.caseTimeline, 3200) || fallback.caseTimeline,
    forensicReport: cleanLong(ai.forensicReport, 3600) || fallback.forensicReport,
    plaintiffArg: cleanLong(ai.plaintiffArg, 3000) || fallback.plaintiffArg,
    defendantArg: cleanLong(ai.defendantArg, 2800) || fallback.defendantArg,
    courtOpinion: cleanLong(ai.courtOpinion, 3200) || fallback.courtOpinion,
    verdict: cleanLong(ai.verdict, 1800) || fallback.verdict,
    sentence: cleanLong(ai.sentence, 2600) || fallback.sentence,
    closingComment: cleanText(ai.closingComment, 260) || fallback.closingComment,
    absurdDetails: safeArray(ai.absurdDetails, DEFAULT_DETAILS, 6, 12),
    evidenceBits: safeArray(ai.evidenceBits, DEFAULT_EVIDENCE, 5, 8),
    defendantExcuses: safeArray(ai.defendantExcuses, DEFAULT_EXCUSES, 3, 5),
    penaltyIdeas: safeArray(ai.penaltyIdeas, DEFAULT_PENALTIES, 6, 6),
    keyIssues: safeArray(ai.keyIssues, DEFAULT_DETAILS.slice(0, 4), 4, 6),
    absurdityReview: cleanLong(ai.absurdityReview, 1200) || '재판부는 이 사건이 실제 법정 사안은 아니지만 소소킹 황당재판소의 오락형 심리 대상으로는 충분하다고 본다.',
    investigation: cleanLong(ai.investigation, 1400) || fallback.forensicReport,
    executionOrder: cleanLong(ai.executionOrder, 800) || '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.',
    appealNotice: cleanLong(ai.appealNotice, 700) || '본 판결에 불복하는 자는 마음속으로 3분 이내 항소할 수 있다.'
  };
}
async function assertPublicResult(caseId) {
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await resultRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
  const data = snap.data();
  if (!data.isPublic) throw new HttpsError('permission-denied', '공개 판결문만 참여할 수 있습니다.');
  return { resultRef, data };
}
async function loadNickname(uid, fallback = '익명 방청객') {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists ? cleanText(snap.data().nickname, 20) || fallback : fallback;
}
function assertSafeComment(text) {
  if (text.length < 2) throw new HttpsError('invalid-argument', '방청석 한마디는 2자 이상 입력해주세요.');
  if (COMMENT_BLOCK_PATTERNS.some(re => re.test(text))) throw new HttpsError('failed-precondition', '부적절하거나 개인정보로 보이는 표현이 포함되어 있습니다.');
}
async function deleteQuerySnapshot(query, counter) {
  while (true) {
    const snap = await query.limit(450).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    counter.deleted += snap.size;
    if (snap.size < 450) break;
  }
}
async function deleteCourtData(caseId, counter) {
  const [caseSnap, resultSnap] = await Promise.all([db.doc(`cases/${caseId}`).get().catch(() => null), db.doc(`results/${caseId}`).get().catch(() => null)]);
  const c = caseSnap?.exists ? caseSnap.data() : {};
  const r = resultSnap?.exists ? resultSnap.data() : {};
  await deleteCaseImages(caseId, c, r);
  await deleteQuerySnapshot(db.collection(`result_reactions/${caseId}/votes`), counter);
  await deleteQuerySnapshot(db.collection(`court_comments/${caseId}/items`), counter);
  await deleteQuerySnapshot(db.collection('reports').where('caseId', '==', caseId), counter);
  const refs = [db.doc(`result_reactions/${caseId}`), db.doc(`court_comment_stats/${caseId}`), db.doc(`court_comments/${caseId}`), db.doc(`results/${caseId}`), db.doc(`cases/${caseId}`)];
  const batch = db.batch();
  refs.forEach(ref => batch.delete(ref));
  await batch.commit();
  counter.deleted += refs.length;
}
async function writeAdminLog(uid, action, caseId, detail = {}) {
  await db.collection('admin_logs').add({ uid, action, caseId, detail, createdAt: FieldValue.serverTimestamp() }).catch(() => null);
}

exports.submitCase = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 90, memory: '512MiB' }, async request => {
  requireRealLogin(request, '사건 접수는 구글 또는 이메일 로그인 후 이용할 수 있습니다.');
  const uid = request.auth.uid;
  const raw = request.data || {};
  const submittedTitle = cleanText(firstDefined(raw.caseTitle, raw.title), MAX_TITLE);
  const desc = cleanText(firstDefined(raw.caseDescription, raw.description), MAX_DESC);
  if (desc.length < 10) throw new HttpsError('invalid-argument', '황당사건 경위를 10자 이상 입력해주세요.');
  const desired = cleanText(raw.desiredVerdict, MAX_DESIRED);
  const contentForChecks = `${submittedTitle} ${desc} ${desired}`;
  const settings = await loadSettings();
  const bannedWords = Array.isArray(settings.bannedWords) ? settings.bannedWords : [];
  assertSafeCaseContent(contentForChecks, bannedWords);

  const isAdminSubmitter = await isAdminAuth(request.auth).catch(() => false);
  const rateInfo = await reserveDailyLimit(uid, settings, isAdminSubmitter);
  const today = kstDateKey();
  const caseId = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const smartTitle = fallbackTitle(desc);
  const titleIsManual = boolValue(raw.caseTitleManual, false) && !!submittedTitle;
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const aiTitle = titleIsManual ? '' : await makeAiTitle(desc, smartTitle, modelName);
  const title = titleIsManual ? submittedTitle : (aiTitle || smartTitle || submittedTitle);
  if (!title) throw new HttpsError('invalid-argument', '황당사건명을 입력해주세요.');
  assertSafeCaseContent(`${title} ${desc} ${desired}`, bannedWords);

  const image = normalizeImageAttachment(raw.imageAttachment);
  const imageInfo = await uploadCaseImage(uid, caseId, image);
  const category = inferCategory(title, desc);
  const docketNumber = makeDocket(today, category);
  const profileNickname = await loadUserNickname(uid);
  const courtroom = pickFrom(COURTROOMS, title);
  const recordClerk = pickFrom(CLERKS, title);
  const analystName = pickFrom(ANALYSTS, title);

  await db.doc(`cases/${caseId}`).set({
    userId: uid,
    ownerId: uid,
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
    originalCaseTitle: submittedTitle || '',
    autoCaseTitle: aiTitle || smartTitle || '',
    smartCaseTitle: smartTitle || '',
    aiCaseTitle: aiTitle || '',
    caseTitleManual: titleIsManual,
    caseDescription: desc,
    grievanceIndex: clampNumber(firstDefined(raw.grievanceIndex, raw.grievance), 5, 1, 10),
    nickname: isAdminSubmitter ? (profileNickname || '관리자') : (profileNickname || randomNickname()),
    desiredVerdict: desired,
    selectedJudge: selectedJudgeOrBlank(firstDefined(raw.selectedJudge, raw.judgeType)),
    imageStoragePath: imageInfo.imageStoragePath,
    imageAttachmentMeta: imageInfo.imageAttachmentMeta,
    hasImageAttachment: !!imageInfo.imageStoragePath,
    status: 'pending',
    isPublic: boolValue(raw.isPublic, false),
    reportCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { caseId, docketNumber, dailyLimit: rateInfo.dailyLimit || HARD_DAILY_LIMIT, adminBypass: isAdminSubmitter, hasImageAttachment: !!imageInfo.imageStoragePath, caseTitle: title, aiCaseTitle: aiTitle || '' };
});

exports.suggestCaseTitle = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireRealLogin(request, '사건명 AI 분석은 로그인 후 이용할 수 있습니다.');
  const desc = cleanText(request.data?.caseDescription || request.data?.description, MAX_DESC);
  if (desc.length < 10) throw new HttpsError('invalid-argument', '사건 내용을 10자 이상 입력해주세요.');
  assertSafeCaseContent(desc, []);
  await reserveTitleLimit(request.auth.uid);
  const settings = await loadSettings();
  const fallback = fallbackTitle(desc);
  const caseTitle = await makeAiTitle(desc, fallback, cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash');
  return { caseTitle, aiCaseTitle: caseTitle === fallback ? '' : caseTitle, fallbackCaseTitle: fallback, fallback: caseTitle === fallback };
});

exports.generateTrial = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 300, memory: '512MiB' }, async request => {
  requireRealLogin(request, '로그인 후 재판을 진행할 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const initial = await caseRef.get();
  if (!initial.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  let c = initial.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
  if (c.status === 'completed') return { success: true, skipped: 'completed' };
  if (c.status === 'processing') return { success: true, skipped: 'processing' };
  if (!['pending', 'error'].includes(c.status)) throw new HttpsError('failed-precondition', '처리할 수 없는 사건 상태입니다.');

  const judgeType = pickJudge(c.selectedJudge, c.caseTitle);
  const people = {
    courtroom: c.courtroom || pickFrom(COURTROOMS, c.caseTitle),
    recordClerk: c.recordClerk || pickFrom(CLERKS, c.caseTitle),
    analystName: c.analystName || pickFrom(ANALYSTS, c.caseTitle),
    prosecutorName: c.prosecutorName || pickFrom(PROSECUTORS, c.caseTitle),
    defenderName: c.defenderName || pickFrom(DEFENDERS, c.caseTitle)
  };
  await db.runTransaction(async tx => {
    const fresh = await tx.get(caseRef);
    if (!fresh.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    const current = fresh.data();
    if (current.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 재판할 수 있습니다.');
    if (!['pending', 'error'].includes(current.status)) return;
    c = current;
    tx.update(caseRef, { status: 'processing', courtStage: 'hearing', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, judgeType, processingStartedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  });

  const fallback = localDocs(c, judgeType, people);
  let data = fallback;
  let totals = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let aiGenerated = false;
  const settings = await loadSettings();
  const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const geminiImage = await imageForGeminiFromStorage(c.imageStoragePath, c.imageAttachmentMeta);
  try {
    const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.98, topP: 0.96, topK: 40, responseMimeType: 'application/json' } });
    const generated = await generateDocs(model, c, judgeType, people, geminiImage);
    totals = generated.usage;
    data = normalizeResultData(generated.data, fallback);
    aiGenerated = true;
  } catch (err) {
    console.error('patched generateTrial AI fallback:', err);
    data = normalizeResultData({}, fallback);
  }

  try {
    await resultRef.set({
      userId: c.userId,
      ownerId: c.userId,
      isPublic: c.isPublic === true,
      docketNumber: c.docketNumber || '',
      courtName: '소소킹 황당재판소',
      courtroom: people.courtroom,
      division: '제3황당재판부',
      recordClerk: people.recordClerk,
      analystName: people.analystName,
      prosecutorName: people.prosecutorName,
      defenderName: people.defenderName,
      caseTitle: data.refinedCaseTitle || c.caseTitle || '황당재판 결과',
      originalCaseTitle: c.caseTitle || '',
      refinedCaseTitle: data.refinedCaseTitle || c.caseTitle || '',
      absurdityTitle: data.absurdityTitle,
      imageAnalysis: '',
      hasImageAttachment: !!c.imageStoragePath,
      imageStoragePath: c.imageStoragePath || '',
      imageAttachmentMeta: c.imageAttachmentMeta || null,
      caseDescription: c.caseDescription || '',
      expandedCase: data.expandedCase,
      absurdDetails: data.absurdDetails,
      evidenceBits: data.evidenceBits,
      defendantExcuses: data.defendantExcuses,
      penaltyIdeas: data.penaltyIdeas,
      grievanceIndex: c.grievanceIndex || 5,
      nickname: c.nickname || '익명 원고',
      desiredVerdict: c.desiredVerdict || '',
      judgeType,
      reception: data.expandedCase,
      caseTimeline: data.caseTimeline,
      forensicReport: data.forensicReport,
      plaintiffArg: data.plaintiffArg,
      defendantArg: data.defendantArg,
      courtOpinion: data.courtOpinion,
      sentence: data.sentence,
      closingComment: data.closingComment,
      aiGenerated,
      generationMode: aiGenerated ? 'patched-ai-storage-safe' : 'patched-local-safe',
      resultVersion: 'operational-hardening-v1',
      analysisDigest: data.absurdDetails.slice(0, 4),
      absurdityReview: data.absurdityReview,
      keyIssues: data.keyIssues,
      evidenceList: data.evidenceBits,
      investigation: data.investigation,
      verdict: data.verdict,
      executionOrder: data.executionOrder,
      appealNotice: data.appealNotice,
      reactionTotal: 0,
      totalVotes: 0,
      commentCount: 0,
      courtStage: 'sentenced',
      createdAt: c.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await caseRef.update({ status: 'completed', courtStage: 'sentenced', courtName: '소소킹 황당재판소', courtroom: people.courtroom, division: '제3황당재판부', recordClerk: people.recordClerk, analystName: people.analystName, prosecutorName: people.prosecutorName, defenderName: people.defenderName, judgeType, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), errorMessage: FieldValue.delete() });
  } catch (err) {
    await caseRef.update({ status: 'pending', courtStage: 'filed', errorMessage: err.message || '저장 오류', updatedAt: FieldValue.serverTimestamp() }).catch(() => null);
    throw new HttpsError('internal', '판결문 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    const today = kstDateKey();
    await db.doc(`usage_stats/daily_${today}`).set({ date: today, geminiRequests: FieldValue.increment(totals.requests), geminiInputTokens: FieldValue.increment(totals.inputTokens), geminiOutputTokens: FieldValue.increment(totals.outputTokens), caseCount: FieldValue.increment(1), imageCaseCount: FieldValue.increment(geminiImage ? 1 : 0), firestoreReads: FieldValue.increment(4), firestoreWrites: FieldValue.increment(4), functionInvocations: FieldValue.increment(1), patchedHardeningCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
  }
  return { success: true, judgeType, isPublic: c.isPublic === true, hasImageAttachment: !!c.imageStoragePath, resultVersion: 'operational-hardening-v1', generationMode: aiGenerated ? 'patched-ai-storage-safe' : 'patched-local-safe' };
});

exports.voteResult = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireRealLogin(request, '투표는 구글 또는 이메일 로그인 후 이용할 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reaction = cleanText(request.data?.reaction, 20);
  if (!caseId || !REACTIONS.includes(reaction)) throw new HttpsError('invalid-argument', '잘못된 반응입니다.');
  const { resultRef } = await assertPublicResult(caseId);
  const summaryRef = db.doc(`result_reactions/${caseId}`);
  const voteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`);
  await db.runTransaction(async tx => {
    const voteSnap = await tx.get(voteRef);
    const prev = voteSnap.exists ? voteSnap.data().reaction : '';
    const totalDelta = prev === reaction ? 0 : (prev ? 0 : 1);
    const updates = { updatedAt: FieldValue.serverTimestamp(), total: FieldValue.increment(totalDelta) };
    if (prev && prev !== reaction) updates[`counts.${prev}`] = FieldValue.increment(-1);
    if (prev !== reaction) updates[`counts.${reaction}`] = FieldValue.increment(1);
    tx.set(summaryRef, updates, { merge: true });
    tx.set(voteRef, { uid, reaction, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (totalDelta) tx.set(resultRef, { reactionTotal: FieldValue.increment(totalDelta), totalVotes: FieldValue.increment(totalDelta), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true };
});

exports.addCourtComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  requireRealLogin(request, '방청석 한마디는 구글 또는 이메일 로그인 후 남길 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const text = cleanText(request.data?.text, 120);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  assertSafeComment(text);
  const { resultRef } = await assertPublicResult(caseId);
  const nickname = await loadNickname(uid);
  const today = kstDateKey();
  const limitRef = db.doc(`comment_limits/${uid}`);
  const commentRef = db.collection(`court_comments/${caseId}/items`).doc();
  await db.runTransaction(async tx => {
    const limitSnap = await tx.get(limitRef);
    const current = limitSnap.exists ? limitSnap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= COMMENT_DAILY_LIMIT) throw new HttpsError('resource-exhausted', `오늘 방청석 한마디 한도 ${COMMENT_DAILY_LIMIT}개를 모두 사용했습니다.`);
    if (current.lastCommentedAt && current.date === today) {
      const lastMs = current.lastCommentedAt.toMillis ? current.lastCommentedAt.toMillis() : new Date(current.lastCommentedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (diffSec < COMMENT_COOLDOWN_SEC) throw new HttpsError('resource-exhausted', `${COMMENT_COOLDOWN_SEC - diffSec}초 후에 다시 남길 수 있습니다.`);
    }
    tx.set(commentRef, { uid, nickname, text, status: 'visible', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`court_comment_stats/${caseId}`), { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(resultRef, { commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(limitRef, { date: today, count: count + 1, lastCommentedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true };
});

exports.requestAppeal = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 180, memory: '512MiB' }, async request => {
  requireRealLogin(request, '항소심은 로그인 후 이용할 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reason = cleanText(request.data?.reason, 160) || '1심 판결이 지나치게 엄숙하여 다시 판단을 구합니다.';
  assertSafeCaseContent(reason, []);
  const caseRef = db.doc(`cases/${caseId}`);
  const caseSnap = await caseRef.get();
  if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
  const c = caseSnap.data();
  if (c.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 항소할 수 있습니다.');
  const resultRef = db.doc(`results/${caseId}`);
  const resultSnap = await resultRef.get();
  if (!resultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
  const r = resultSnap.data();
  if (r.appeal?.verdict) return { success: true, alreadyExists: true, verdict: r.appeal.verdict };
  const model = new GoogleGenerativeAI(geminiKey.value().trim()).getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `소소킹 황당재판소 항소심 판결문을 작성하세요. 실제 법적 효력은 없고 오락 목적임을 포함하세요.\n사건명: ${c.caseTitle || r.caseTitle}\n1심 주문: ${r.sentence || ''}\n1심 판단: ${r.verdict || r.courtOpinion || ''}\n항소이유: ${reason}\n형식: 1. 항소심 주문 2. 항소이유 요지 3. 항소심 판단 4. 최종 소소형량. 3문단 이내.`;
  const ai = await model.generateContent(prompt);
  const appealVerdict = cleanLong(ai.response.text(), 1800);
  await resultRef.set({ appeal: { reason, verdict: appealVerdict, createdAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await caseRef.set({ hasAppeal: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { success: true, verdict: appealVerdict };
});

exports.deleteMyCase = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  requireRealLogin(request, '로그인 후 삭제할 수 있습니다.');
  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const [caseSnap, resultSnap] = await Promise.all([db.doc(`cases/${caseId}`).get().catch(() => null), db.doc(`results/${caseId}`).get().catch(() => null)]);
  if (!caseSnap?.exists && !resultSnap?.exists) return { success: true, caseId, alreadyDeleted: true, deleted: 0 };
  const c = caseSnap?.exists ? caseSnap.data() : {};
  const r = resultSnap?.exists ? resultSnap.data() : {};
  const ownerId = c.userId || c.ownerId || r.userId || r.ownerId || '';
  if (!ownerId || ownerId !== uid) throw new HttpsError('permission-denied', '본인 사건만 삭제할 수 있습니다.');
  await db.doc(`cases/${caseId}`).set({ status: 'deleting', isPublic: false, deleteRequestedBy: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
  await db.doc(`results/${caseId}`).set({ isPublic: false, deleteRequestedBy: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => null);
  const counter = { deleted: 0 };
  await deleteCourtData(caseId, counter);
  return { success: true, caseId, deleted: counter.deleted };
});

exports.deleteCourtPost = onCall({ region: REGION, timeoutSeconds: 120, memory: '256MiB' }, async request => {
  if (!request.auth || !(await isAdminAuth(request.auth))) throw new HttpsError('permission-denied', '관리자만 삭제할 수 있습니다.');
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const counter = { deleted: 0 };
  await deleteCourtData(caseId, counter);
  await writeAdminLog(request.auth.uid, 'deleteCourtPost', caseId, counter);
  return { success: true, caseId, deleted: counter.deleted };
});
