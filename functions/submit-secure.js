const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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
const CATEGORIES = [
  ['라면','라면'], ['국물','라면'], ['푸딩','간식'], ['과자','간식'], ['커피','카페'], ['치킨','간식'], ['냉장고','냉장고'],
  ['빵','간식'], ['리트리버','동물'], ['강아지','동물'], ['고양이','동물'],
  ['리모컨','리모컨'], ['카톡','읽씹'], ['읽씹','읽씹'], ['약속','지각'], ['지각','지각'], ['청소','집안일'], ['설거지','집안일']
];
const SERIOUS_KEYWORDS = [
  '폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금',
  '성범죄','성폭력','성추행','성희롱','강간','강제추행',
  '가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따',
  '이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원',
  '응급','정신과','우울증','공황','자해','자살','의료','진단','치료'
];
const FOOD_WORDS = ['빵','푸딩','과자','커피','치킨','라면','음료','케이크','간식','도시락','아이스크림','샌드위치','김밥','초콜릿','떡볶이','피자','햄버거','사탕','젤리','쿠키','우유','아메리카노','탕후루','붕어빵'];
const OBJECT_WORDS = [...FOOD_WORDS, '충전기','리모컨','우산','의자','자리','컵','수건','칫솔','마우스','키보드','이어폰','휴지','담요','베개','신발','가방','펜','볼펜','노트'];
const ANIMAL_WORDS = ['리트리버','강아지','개','고양이','반려견','댕댕이','멍멍이','비둘기','새','까치','까마귀'];
const PERSON_WORDS = ['친구','동생','언니','오빠','형','누나','엄마','아빠','남편','아내','직장동료','상사','후배','선배','손님','아이','누군가','사장님','알바생','동료'];

function requireRealLogin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') throw new HttpsError('unauthenticated', '사건 접수는 구글 또는 이메일 로그인 후 이용할 수 있습니다.');
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
function firstDefined(...values) { return values.find(v => v !== undefined && v !== null); }
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
function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNickname() { return NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)] + NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)]; }
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
function compact(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .replace(/^(그|저|이)\s+/g, '')
    .replace(/\s*(한\s*마리|한마리)$/g, '')
    .trim();
}
function hasFinalConsonant(word) {
  const ch = compact(word).slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return ((code - 0xac00) % 28) !== 0;
}
function subjectParticle(word) { return hasFinalConsonant(word) ? '이' : '가'; }
function objectParticle(word) { return hasFinalConsonant(word) ? '을' : '를'; }
function clipTitle(title) {
  const clean = compact(title).replace(/사건\s*사건$/g, '사건').replace(/\s+/g, ' ');
  return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trim()}…` : clean;
}
function normalizeDesc(desc) {
  return String(desc || '').replace(/한눈판사이/g, '한눈 판 사이').replace(/산책\s*중이던/g, '산책중이던').replace(/한\s*마리/g, '한마리').replace(/\s+/g, ' ').trim();
}
function lastActionIndex(text) {
  const verbs = /(먹었|먹엇|먹었다|먹은|먹어|먹음|먹고|가져갔|가져간|가져가|들고갔|물고갔|훔쳐갔|사라졌|없어졌|없어짐|독점했|차지했|망가뜨렸|깨뜨렸)/g;
  let last = null;
  let m;
  while ((m = verbs.exec(text)) !== null) last = { index: m.index, verb: m[0] };
  return last || { index: text.length, verb: '' };
}
function extractLocation(text) {
  const matches = [...text.matchAll(/([가-힣A-Za-z0-9]{1,14}(?:에서|에))(?=\s|$)/g)].map(m => m[1]);
  const bad = ['사이에','중에','때에','사이에서','중에서'];
  return matches.find(x => !bad.some(b => x.includes(b))) || '';
}
function extractObject(text) {
  const { index } = lastActionIndex(text);
  const beforeAction = text.slice(0, Math.max(index, 0));
  const words = OBJECT_WORDS.join('|');
  const ownedPattern = new RegExp(`((?:내|제|원고의|내가|제가|남겨둔|마지막|아껴둔|사둔|먹던|보관하던)\\s*(?:[가-힣A-Za-z0-9]{0,8}\\s*)?(?:${words}))(?=\\s*(?:을|를|이|가|은|는|도|만|$))`, 'g');
  const anyPattern = new RegExp(`((?:[가-힣A-Za-z0-9]{0,8}\\s*)?(?:${words}))(?=\\s*(?:을|를|이|가|은|는|도|만|$))`, 'g');
  const owned = [...beforeAction.matchAll(ownedPattern)].map(m => compact(m[1])).filter(Boolean);
  if (owned.length) return owned[owned.length - 1];
  const any = [...beforeAction.matchAll(anyPattern)].map(m => compact(m[1])).filter(Boolean);
  if (any.length) return any[any.length - 1].replace(/^(공원에서|집에서|회사에서|학교에서|카페에서)\s+/, '');
  const generic = [...beforeAction.matchAll(/([가-힣A-Za-z0-9\s]{1,16})\s*(?:을|를)(?=\s*$)/g)].map(m => compact(m[1])).filter(Boolean);
  return generic.length ? generic[generic.length - 1] : '';
}
function extractActor(text) {
  const { index } = lastActionIndex(text);
  const beforeAction = text.slice(0, Math.max(index, 0));
  const animal = ANIMAL_WORDS.join('|');
  const person = PERSON_WORDS.join('|');
  const actorPattern = new RegExp(`((?:산책중이던|지나가던|옆에 있던|근처에 있던|같이 있던|맞은편에 있던)?\\s*(?:${animal}|${person}))(?:\\s*한마리)?\\s*(?:이|가|은|는)?`, 'g');
  const matches = [...beforeAction.matchAll(actorPattern)].map(m => compact(m[1])).filter(x => x && !['내','제'].includes(x));
  return matches.length ? matches[matches.length - 1].replace(/^\s+/, '') : '';
}
function actionTitle(text, actor, object, location) {
  const prefix = location ? `${location} ` : '';
  if (/먹|물고/.test(text) && object) {
    if (actor) return `${prefix}${actor}${subjectParticle(actor)} ${object}${objectParticle(object)} 먹은 사건`;
    return `${prefix}${object}${objectParticle(object)} 누군가 먹은 사건`;
  }
  if (/가져|들고|훔쳐|물고/.test(text) && object) {
    if (actor) return `${prefix}${actor}${subjectParticle(actor)} ${object}${objectParticle(object)} 가져간 사건`;
    return `${prefix}${object}${subjectParticle(object)} 사라진 사건`;
  }
  if (/사라|없어/.test(text) && object) return `${prefix}${object}${subjectParticle(object)} 사라진 사건`;
  if (/독점|차지/.test(text) && object) return `${prefix}${actor ? actor + subjectParticle(actor) + ' ' : ''}${object}${objectParticle(object)} 독점한 사건`;
  if (/망가|깨뜨/.test(text) && object) return `${prefix}${actor ? actor + subjectParticle(actor) + ' ' : ''}${object}${objectParticle(object)} 훼손한 사건`;
  return '';
}
function makeSmartTitle(desc) {
  const text = normalizeDesc(desc);
  if (!text) return '';
  const location = extractLocation(text);
  const object = extractObject(text);
  const actor = extractActor(text);
  const structured = actionTitle(text, actor, object, location);
  if (structured) return clipTitle(structured);
  const cleaned = text.replace(/^(제가|내가|나는|저는|나|저)\s*/g, '').replace(/(하고 있었는데|하고 있었는 데|했는데|하던 중|한눈 판 사이|잠깐 사이|사이에)/g, ' ').replace(/[.!?。！？].*$/g, '').trim();
  return clipTitle(`${cleaned.slice(0, 28).trim() || '소소한 일상'} 사건`);
}
function shouldUseSmartTitle(rawTitle, desc, smartTitle) {
  const title = compact(rawTitle);
  if (!title) return true;
  if (!smartTitle || smartTitle.length < 3) return false;
  if (/하고 있었는데|한눈판|한눈 판|잠깐 사이|사이에|하던 중/.test(title)) return true;
  if (title.length >= MAX_TITLE - 2 && !/(먹은|가져간|사라진|독점한|훼손한|실종)/.test(title)) return true;
  const normalized = normalizeDesc(desc);
  const object = extractObject(normalized);
  const actor = extractActor(normalized);
  if (object && actor && smartTitle.includes(object) && smartTitle.includes(actor.replace(/\s+/g, ' '))) {
    if (!title.includes(object) || !title.includes(actor.split(' ').pop())) return true;
  }
  return false;
}
function normalizeAiTitle(raw, fallbackTitle) {
  let title = String(raw || '').replace(/```json|```/g, '').trim();
  try {
    const start = title.indexOf('{');
    const end = title.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(title.slice(start, end + 1));
      title = parsed.caseTitle || parsed.title || title;
    }
  } catch (_) {}
  title = textValue(title, MAX_TITLE)
    .replace(/^사건명\s*[:：]\s*/g, '')
    .replace(/["“”'‘’]/g, '')
    .replace(/[.!?。！？]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) return fallbackTitle || '';
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return clipTitle(title);
}
async function makeAiTitle(desc, fallbackTitle, modelName) {
  const key = geminiKey.value().trim();
  if (!key || !desc) return fallbackTitle || '';
  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: modelName || 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.78,
        topP: 0.92,
        topK: 40,
        responseMimeType: 'application/json'
      }
    });
    const prompt = `너는 소소킹 황당재판소의 사건명 작성관이다.

사용자의 사건 내용을 전부 읽고 핵심을 가장 잘 드러내는 사건명 1개만 작성하라.

규칙:
- 18~35자 권장, 최대 40자.
- 반드시 사건의 핵심 대상과 핵심 행동을 포함한다.
- 문장 앞부분을 그대로 자르지 않는다.
- 너무 설명식으로 길게 쓰지 않는다.
- 반드시 '사건'으로 끝낸다.
- 실제 범죄처럼 보이게 과격하게 쓰지 않는다.
- 웃기려고 드립을 치지 말고, 너무 진지한 사건명처럼 쓴다.
- 장소, 행위자, 피해 대상, 핵심 행동이 명확하면 포함한다.
- 사용자가 직접 쓴 말 중 중요한 단어는 살리되, 어색한 조사와 배경문장은 정리한다.

좋은 예:
- 공원에서 리트리버가 내 빵을 먹은 사건
- 탕비실 마지막 카누 봉지 방치 사건
- 동생의 방문 미닫힘 반복 사건
- 침대 밑 이어폰 한쪽 실종 사건
- 리모컨 장기 점유 및 채널권 박탈 사건

나쁜 예:
- 공원에서 빵을 먹고 있었는데 사건
- 너무 억울한 사건
- 진짜 열받는 사건
- 카누 사건
- 이걸로 재판까지 간 사건

사건 내용:
${desc}

JSON만 출력하라.
{"caseTitle":"사건명"}`;
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    return normalizeAiTitle(result.response.text(), fallbackTitle);
  } catch (err) {
    console.error('AI title generation failed:', err);
    return fallbackTitle || '';
  }
}
function normalizeImageAttachment(value) {
  if (!value || typeof value !== 'object') return null;
  const mimeType = textValue(value.mimeType, 30);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new HttpsError('invalid-argument', '이미지는 JPG, PNG, WEBP 형식만 첨부할 수 있습니다.');
  const data = String(value.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!data) return null;
  if (data.length > MAX_IMAGE_BASE64_LENGTH) throw new HttpsError('invalid-argument', '첨부 이미지 용량이 큽니다. 자동 리사이즈 후 다시 시도해주세요.');
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) throw new HttpsError('invalid-argument', '이미지 데이터 형식이 올바르지 않습니다.');
  const width = clampNumber(value.width, 0, 0, 4000);
  const height = clampNumber(value.height, 0, 0, 4000);
  return { mimeType, data, width, height, originalName: textValue(value.originalName, 80), originalSize: clampNumber(value.originalSize, 0, 0, 25 * 1024 * 1024), resizedSize: clampNumber(value.resizedSize, 0, 0, 1024 * 1024), resized: true };
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

exports.submitCase = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 60, memory: '256MiB' }, async (request) => {
  requireRealLogin(request);

  const uid = request.auth.uid;
  const data = request.data || {};
  const submittedTitle = textValue(firstDefined(data.caseTitle, data.title), MAX_TITLE);
  const desc = textValue(firstDefined(data.caseDescription, data.description), MAX_DESC);
  if (!desc) throw new HttpsError('invalid-argument', '황당사건 경위를 입력해주세요.');

  const settings = await loadSettings();
  const smartTitle = makeSmartTitle(desc);
  const titleIsManual = boolValue(data.caseTitleManual, false) && !!submittedTitle;
  const geminiModel = textValue(settings.geminiModel, 60) || 'gemini-2.5-flash';
  const aiTitle = titleIsManual ? '' : await makeAiTitle(desc, smartTitle, geminiModel);
  const autoTitle = aiTitle || smartTitle;
  const title = titleIsManual ? submittedTitle : (autoTitle || (shouldUseSmartTitle(submittedTitle, desc, smartTitle) ? smartTitle : submittedTitle));
  const desired = textValue(data.desiredVerdict, MAX_DESIRED);
  const grievance = clampNumber(firstDefined(data.grievanceIndex, data.grievance), 5, 1, 10);
  const selectedJudge = selectedJudgeOrBlank(firstDefined(data.selectedJudge, data.judgeType));
  const isPublic = boolValue(data.isPublic, true);
  const imageAttachment = normalizeImageAttachment(data.imageAttachment);
  const isAdminSubmitter = await isAdminAuth(request.auth).catch(() => false);
  const profileNickname = await loadUserNickname(uid);

  if (!title) throw new HttpsError('invalid-argument', '황당사건명을 입력해주세요.');

  const dailyLimit = clampNumber(settings.dailyLimit, HARD_DAILY_LIMIT, 1, 20);
  const cooldownSec = clampNumber(settings.cooldownSec, DEFAULT_COOLDOWN_SEC, 0, 300);
  const bannedWords = Array.isArray(settings.bannedWords) ? settings.bannedWords : [];
  const contentForChecks = `${title} ${desc} ${desired}`;
  if (containsBannedWord(contentForChecks, bannedWords)) throw new HttpsError('failed-precondition', '관리자가 제한한 단어가 포함되어 있습니다.');
  if (containsSeriousKeyword(contentForChecks)) throw new HttpsError('failed-precondition', '실제 범죄·소송·학교폭력·가정폭력·의료·정신건강 등 중대한 사안은 소소킹에서 접수할 수 없습니다. 사소한 일상 소재만 오락용으로 접수해주세요.');

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
      if (count >= dailyLimit) throw new HttpsError('resource-exhausted', `오늘 접수 한도 ${dailyLimit}건을 초과했습니다. 황당재판부도 하루에 너무 많은 황당함은 감당하기 어렵습니다.`);
      if (current.lastSubmittedAt && current.date === today) {
        const lastMs = current.lastSubmittedAt.toMillis ? current.lastSubmittedAt.toMillis() : new Date(current.lastSubmittedAt).getTime();
        const diffSec = Math.floor((Date.now() - lastMs) / 1000);
        if (cooldownSec > 0 && diffSec < cooldownSec) throw new HttpsError('resource-exhausted', `${cooldownSec - diffSec}초 후에 다시 접수할 수 있습니다. 재판부가 방금 전 사건의 황당함을 아직 정리 중입니다.`);
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
    if (!isAdminSubmitter) tx.set(limitRef, { date: today, count: nextCount, lastSubmittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { caseId, docketNumber, dailyLimit, adminBypass: isAdminSubmitter, hasImageAttachment: !!imageAttachment, caseTitle: title, aiCaseTitle: aiTitle || '' };
});
