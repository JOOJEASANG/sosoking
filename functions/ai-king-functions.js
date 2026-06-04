'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { randomUUID } = require('crypto');

if (!getApps().length) initializeApp();
const db = getFirestore();

const DAILY_LIMIT = 3;

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// ── AI King config cache ──
let _aiKingConfig = null;
let _aiKingConfigFetchedAt = 0;

async function getAiKingConfig() {
  const now = Date.now();
  if (_aiKingConfig && now - _aiKingConfigFetchedAt < 5_000) return _aiKingConfig;
  const snap = await db.doc('config/ai_king').get();
  _aiKingConfig = snap.exists ? snap.data() : {};
  _aiKingConfigFetchedAt = now;
  return _aiKingConfig;
}

// ── Multi-provider AI call ──
// data URI prefix 또는 매직바이트로 실제 이미지 타입 추론 (PNG를 jpeg로 보내면 거부/오인식됨)
function sniffMime(prefix, b64) {
  if (prefix) {
    const m = prefix.match(/data:(image\/[a-z0-9.+-]+)/i);
    if (m) return m[1].toLowerCase();
  }
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBORw')) return 'image/png';
  if (b64.startsWith('R0lGOD')) return 'image/gif';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

// 반환: { data, mime } 또는 null
function validBase64(str) {
  if (!str || typeof str !== 'string') return null;
  let prefix = '';
  let stripped = str;
  const comma = str.indexOf(',');
  if (comma !== -1 && /^data:/i.test(str)) { prefix = str.slice(0, comma); stripped = str.slice(comma + 1); }
  if (stripped.length > 8 * 1024 * 1024) { console.warn('[ai-king] image too large, skipping'); return null; }
  return { data: stripped, mime: sniffMime(prefix, stripped) };
}

function getBucketName() {
  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
    if (config.storageBucket) return config.storageBucket;
  } catch {}
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'sosoking-481e6';
  return `${projectId}.firebasestorage.app`;
}

// 첨부 이미지를 Storage에 저장하고 표시용 URL 반환 (실패해도 AI 결과는 막지 않음 → null)
async function saveAiImage(userId, imageBase64) {
  try {
    const img = validBase64(imageBase64);
    if (!img) return null;
    const buffer = Buffer.from(img.data, 'base64');
    if (!buffer.length) return null;
    const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/webp' ? 'webp' : img.mime === 'image/gif' ? 'gif' : 'jpg';
    const safeUid = String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || 'anon';
    const path = `ai-king/${safeUid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const token = randomUUID();
    const bucket = getStorage().bucket(getBucketName());
    const file = bucket.file(path);
    await file.save(buffer, {
      metadata: {
        contentType: img.mime,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { owner: safeUid, source: 'ai-king', firebaseStorageDownloadTokens: token },
      },
      resumable: false,
    });
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  } catch (e) {
    console.error('[saveAiImage] failed:', e.message);
    return null;
  }
}

async function callAI(system, userText, imageBase64 = null, maxTokens = 400, temperature = 0.8, jsonMode = false) {
  const config = await getAiKingConfig();
  const img = validBase64(imageBase64);

  if (config.activeModel === 'gemini') {
    if (!config.geminiApiKey) throw new HttpsError('failed-precondition', 'AI 키가 설정되지 않았어요. 관리자에게 문의하세요.');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.5-flash',
      systemInstruction: system,
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    const parts = [];
    if (img) parts.push({ inlineData: { data: img.data, mimeType: img.mime } });
    parts.push({ text: userText });
    const genConfig = { maxOutputTokens: maxTokens, temperature, thinkingConfig: { thinkingBudget: 0 } };
    if (jsonMode) genConfig.responseMimeType = 'application/json';
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: genConfig,
    });
    return result.response.text() || '';
  }

  // Default: Claude
  if (!config.claudeApiKey) throw new HttpsError('failed-precondition', 'AI 키가 설정되지 않았어요. 관리자에게 문의하세요.');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const content = [];
  if (img) content.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data } });
  content.push({ type: 'text', text: userText });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content }],
  });
  return (msg.content.find(b => b.type === 'text')?.text) || '';
}

async function callAIWithImages(system, userText, imageA = null, imageB = null, maxTokens = 500, temperature = 0.8, jsonMode = false) {
  const config = await getAiKingConfig();
  const imgA = validBase64(imageA);
  const imgB = validBase64(imageB);

  if (config.activeModel === 'gemini') {
    if (!config.geminiApiKey) throw new HttpsError('failed-precondition', 'AI 키가 설정되지 않았어요. 관리자에게 문의하세요.');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.5-flash',
      systemInstruction: system,
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    const parts = [];
    if (imgA) parts.push({ inlineData: { data: imgA.data, mimeType: imgA.mime } });
    if (imgB) parts.push({ inlineData: { data: imgB.data, mimeType: imgB.mime } });
    parts.push({ text: userText });
    const genConfig = { maxOutputTokens: maxTokens, temperature, thinkingConfig: { thinkingBudget: 0 } };
    if (jsonMode) genConfig.responseMimeType = 'application/json';
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: genConfig,
    });
    return result.response.text() || '';
  }

  // Default: Claude
  if (!config.claudeApiKey) throw new HttpsError('failed-precondition', 'AI 키가 설정되지 않았어요. 관리자에게 문의하세요.');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const content = [];
  if (imgA) content.push({ type: 'image', source: { type: 'base64', media_type: imgA.mime, data: imgA.data } });
  if (imgB) content.push({ type: 'image', source: { type: 'base64', media_type: imgB.mime, data: imgB.data } });
  content.push({ type: 'text', text: userText });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content }],
  });
  return msg.content[0]?.text || '';
}

// ── JSON 문자열 내 실제 제어문자(줄바꿈·탭 등) 이스케이프 ──
function sanitizeJson(str) {
  let inString = false, escaped = false, out = '';
  for (const ch of str) {
    if (escaped) { escaped = false; out += ch; continue; }
    if (ch === '\\' && inString) { escaped = true; out += ch; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString) {
      if (ch === '\n' || ch === '\r') { out += '\\n'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) { continue; } // 기타 제어문자는 제거
    }
    out += ch;
  }
  return out;
}

function parseJson(raw) {
  const cleaned = String(raw || '').replace(/```json|```/g, '').trim();
  if (!cleaned) throw new Error('empty AI response');
  // 1) 그대로 파싱 시도
  try { return JSON.parse(cleaned); } catch {}
  // 2) 제어문자 정리 후 파싱
  try { return JSON.parse(sanitizeJson(cleaned)); } catch {}
  // 3) 첫 [ 또는 { 부터 마지막 ] 또는 } 까지 추출 후 파싱
  const match = cleaned.match(/[[{][\s\S]*[\]}]/);
  if (!match) throw new Error('no JSON found in AI response');
  return JSON.parse(sanitizeJson(match[0]));
}

// ── Usage check with extraAiUses / points fallback ──
// Returns { allowed, limit, usedExtra, usedPoints, pointsUsed }
async function checkUsage(userId, feature) {
  const today = kstToday();
  const ref = db.doc(`ai_king_usage/${userId}_${today}_${feature}`);
  const config = await getAiKingConfig();
  const dailyLimit = config.dailyFreeLimit || DAILY_LIMIT;
  const pointsPerUse = config.pointsPerUse || 100;
  const result = await db.runTransaction(async (tx) => {
    const [snap, userSnap] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${userId}`))]);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count < dailyLimit) {
      tx.set(ref, { count: count + 1, userId, feature, date: today, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { allowed: true, usedExtra: false, usedPoints: false };
    }
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const extra = userData.extraAiUses || 0;
    if (extra > 0) {
      tx.set(db.doc(`users/${userId}`), { extraAiUses: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { allowed: true, usedExtra: true, usedPoints: false };
    }
    const points = userData.points || 0;
    if (points >= pointsPerUse) {
      tx.set(db.doc(`users/${userId}`), { points: FieldValue.increment(-pointsPerUse), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { allowed: true, usedExtra: false, usedPoints: true, pointsUsed: pointsPerUse };
    }
    return { allowed: false, usedExtra: false, usedPoints: false };
  });
  return { allowed: result.allowed, limit: dailyLimit, usedExtra: result.usedExtra || false, usedPoints: result.usedPoints || false, pointsUsed: result.pointsUsed || 0 };
}

// ── AI 호출 실패 시 차감했던 사용량 환불 ──
async function refundUsage(userId, feature, usedExtra, usedPoints = false, pointsUsed = 0) {
  try {
    if (usedExtra) {
      await db.doc(`users/${userId}`).set(
        { extraAiUses: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    } else if (usedPoints && pointsUsed > 0) {
      await db.doc(`users/${userId}`).set(
        { points: FieldValue.increment(pointsUsed), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    } else {
      const today = kstToday();
      const ref = db.doc(`ai_king_usage/${userId}_${today}_${feature}`);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const count = snap.exists ? (snap.data().count || 0) : 0;
        if (count > 0) tx.set(ref, { count: count - 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      });
    }
  } catch (e) {
    console.error('[refundUsage] failed:', e.message);
  }
}

// ── JSON 결과를 받는 AI 호출 + 파싱, 실패 시 1회 토큰 늘려 재시도 ──
async function callAndParse(callFn, maxTokens) {
  let raw = '';
  try {
    raw = await callFn(maxTokens);
    const parsed = parseJson(raw);
    if (!parsed) throw new Error(`AI returned non-JSON: ${raw.slice(0, 120)}`);
    return { parsed, raw };
  } catch (e1) {
    console.warn('[callAndParse] first attempt failed, retrying with more tokens:', e1.message);
    raw = await callFn(Math.min(Math.round(maxTokens * 1.6), 4000));
    const parsed = parseJson(raw);
    if (!parsed) throw new Error(`AI returned non-JSON on retry: ${raw.slice(0, 120)}`);
    return { parsed, raw };
  }
}

// ── 작성자 정보 조회 (Firestore users 우선, Auth token 보완) ──
async function getAuthorInfo(userId, authToken = {}) {
  let userData = {};
  try {
    const snap = await db.doc(`users/${userId}`).get();
    if (snap.exists) userData = snap.data() || {};
  } catch {}
  const name = (userData.nickname || userData.displayName || authToken.name || authToken.email?.split('@')[0] || '').trim().slice(0, 40) || '익명';
  return {
    authorId: userId,
    authorName: name,
    authorEmail: (authToken.email || userData.email || '').slice(0, 120),
    authorPhoto: (authToken.picture || userData.photoURL || '').slice(0, 300),
  };
}

// ── 미친판사: 7가지 판사 유형 ──
const JUDGES = [
  { id: 'lawyer',      name: '⚖️ 엄근진 법관' },
  { id: 'emotional',   name: '😭 감성 판사' },
  { id: 'boomer',      name: '👴 꼰대 판사' },
  { id: 'scientist',   name: '🔬 과학자 판사' },
  { id: 'philosopher', name: '🤔 철학자 판사' },
  { id: 'alien',       name: '👽 외계인 판사' },
  { id: 'crazy',       name: '🤪 돌아이 판사' },
];

const JUDGE_DESC = {
  lawyer: `⚖️ lawyer(엄근진 법관) — 냉혹한 관료주의자:
개시 형식: 반드시 "주문:" 으로 시작.
법조항: 반드시 "형법/민법 제[3자리숫자]조([웃긴죄명])" 형식으로 가짜 조항 2개 이상 인용. 죄명은 상황에 딱 맞게 만들어라 (예: 우정파괴죄, 기대배신죄, 냉장고무단개방죄, 회의시간낭비죄).
문체: 감정 0%. 인간적 공감 0%. 모든 문장은 행정 문서처럼. 그러나 내용은 상황을 정확히 꿰뚫는다.
마지막: 반드시 "이상." 으로 끝.
포인트: 차가운 문체 + 정확한 핵심 = "이 말이 맞는 말이긴 한데 왜 이렇게 冷정하게 씀ㅋㅋ"
예) "주문: 피고인은 형법 제512조(기습취식죄) 및 제244조(묵시적허락위조죄)에 의거 유죄. 본건 치킨은 원고 본인이 배달 앱으로 결제한 재화로, 이에 대한 소유권 귀속은 명백하다. 피고의 '나도 배고팠다'는 항변은 법적 효력이 없다. 이상."`,

  emotional: `😭 emotional(감성 판사) — 극한의 공감왕:
구조: [비유적 시작 — 상황의 사물/행동을 시적으로 묘사] → [가장 서러운 포인트를 과하게 묘사] → [판사 본인이 울고 있다는 결말].
핵심: 사소한 상황을 인생의 비극으로 만들어야 함. 치킨 한 조각을 잃어도 "그것은 오늘 하루를 버티게 해줄 단 하나의 이유였는데"처럼.
비유가 상황과 연결되어야 하고, 읽는 사람이 "왜 이게 이렇게 슬프게 읽히지ㅋㅋ" 가 나와야 함.
예) "그 문자... 단순한 알림이 아니었다. 기다림 끝에 받은 단 하나의 답장이었는데. 세 글자 'ㅇㅇ'에서 판사는 오늘 하루의 무게를 느꼈다. 그 무관심의 무게를 견디며, 판사는 눈물을 삼키며 유죄를 선고한다."`,

  boomer: `👴 boomer(꼰대 판사) — 자기 시대 세계관 고수:
개시: 반드시 "내가 말이야~" 또는 "우리 때는~" 으로 시작.
필수: 구체적인 연도(1975~1995년 사이) + 그 시대 실제 상황 (예: "우리 86년도엔 월급 28만원에 야근도 당연했어", "IMF 때는 직장만 있으면 감지덕지였어").
구조: 자기 시대 고생 자랑 → 지금 세대 비판 → 결론은 요즘 것들 문제.
포인트: 억울한 게 당연히 맞는데, 해결책이 "요즘 것들"이라는 것 자체가 웃김.
예) "내가 말이야~ 우리 93년도엔 야근하고도 버스 놓칠까봐 뛰어갔어. 지금은 택시 타면서 카톡 읽씹이 억울하다고? 이게 억울하면 얼마나 편하게 사는 거야. 요즘 것들은 너무 풍족해서 탈이야, 유죄."`,

  scientist: `🔬 scientist(과학자 판사) — 모든 걸 데이터로:
필수: [한국인 성+직함] 외 [2~4]인([그럴듯한 가짜 기관명], [2018~2024])으로 논문 인용. 기관명은 실제처럼 만들어라 (예: 서울대 인간행동패턴연구소, KAIST 사회신뢰공학연구실, 고려대 관계역학분석센터).
필수: 소수점 1자리 수치 2개 이상. 너무 높지도 낮지도 않은 "그럴듯한" 수치.
문체: 감정·주관 완전 제거. 모든 판단은 데이터 기반.
마지막: 반드시 "데이터상 [유죄/무죄]." 로 끝.
예) "이정민 외 3인(고려대 사회신뢰공학연구실, 2022)에 따르면 명시적 동의 없는 타인 음식 취식 시 관계 신뢰도는 38.4% 감소한다. 피고 행동 유형은 Type-B(인지형 무시)로, 재발확률 72.1%다. 데이터상 유죄."`,

  philosopher: `🤔 philosopher(철학자 판사) — 모든 걸 존재 문제로:
개시: 상황의 본질을 건드리는 질문으로. 반드시 "?" 로 끝.
필수: 실제 철학자 또는 그럴듯한 가짜 철학자 인용 (이름 + 실제처럼 만든 명언).
결말: 판결 내리지 않고 더 큰 질문으로 끝내거나, "그것은 당신만이 알 수 있다."
핵심 웃음: 치킨 분쟁이 갑자기 실존적 위기가 되는 것. 질문이 황당한데 맞는 말임.
예) "타인의 기대를 알면서도 외면하는 것, 이것은 악의인가 아니면 자유의지인가? 카뮈는 '타인은 지옥이다'고 했지만 그 지옥을 만드는 것은 결국 우리 자신이 아닌가. 이 사건의 본질은 읽씹이 아니라, 연결을 두려워하는 인간의 실존적 고독에 있지 않은가."`,

  alien: `👽 alien(외계인 판사) — 외계 시각으로 지구인 해부:
개시: 반드시 "[창의적 행성/성단이름] 출신 심판관 [영문+숫자코드]의 판결이다." 로 시작.
핵심 메커니즘: 지구 개념(허락, 소유, 체면, 눈치 등)을 자기 행성 기준과 비교 → 이해 못 하는 척하면서 오히려 핵심을 더 정확하게 찌름.
지구인에 대한 측은함 표현. 마지막 "지구 기준에서 [유죄/무죄]다."
행성 이름은 케플러 말고 창의적으로 만들어라 (예: 안드로메다 NGC-4889, 시리우스C-7, 처녀자리 VX-91 등).
예) "시리우스 C-7 출신 심판관 QZ-44의 판결이다. 우리 성단에서는 메시지를 읽으면 자동으로 응답 신호가 전송된다. '읽씹'이라는 개념 자체가 존재하지 않는다. 지구인이 '확인'과 '응답'을 분리하는 이유를 3광년 동안 연구했지만 여전히 이해 불가다. 그러나 지구 관습상 읽씹은 명백히 지구 기준에서 유죄다."`,

  crazy: `🤪 crazy(돌아이 판사) — 엉뚱한 근거로 정확한 결론:
개시: 본인이 직접 입수한 "제보"나 "목격"으로 시작. 상황과 무관해 보이는 구체적 증거 (예: "본 판사는 피고가 지난 목요일 편의점에서 영수증을 버리는 것을 목격했다").
중간: 판결문 중간에 갑자기 완전 무관한 본인 이야기 한 줄 (오늘 점심, 어제 꿈, 좋아하는 음식 등).
결말: 황당한 근거들에서 나온 결론이 오히려 정확함. "어쨌든 [유죄/무죄]이며, [구체적이고 황당한 배상 명령]을 명한다."
배상은 구체적이고 황당하게 (예: "매주 금요일 치킨 1마리 배달", "한 달간 카톡 답장 10분 이내").
예) "본 판사는 피고가 지난 수요일 스타벅스에서 무선이어폰을 끼고도 친구 말을 못 들은 척했다는 제보를 입수했다. 이는 본 사건과 직결된다. 참고로 어제 점심은 된장찌개였는데 맛있었다. 어쨌든 방귀 냄새를 외면한 것은 공중도덕 위반이며, 피고에게 엘리베이터 내 파인애플 에어프레시너 상시 비치를 명한다."`,
};

// AI 파싱 실패 시에도 "결근"처럼 안 보이도록 캐릭터를 살린 대체 판결문
const JUDGE_FALLBACK = {
  lawyer: '주문: 본 건은 심리 자료 미비로 휴정한다. 피고인은 잠시 후 다시 출석할 것을 명한다. 이상.',
  emotional: '판사는... 지금 너무 벅차서 잠시 말을 잇지 못한다. 눈물을 닦고 곧 돌아오겠다. 잠시만 기다려달라.',
  boomer: '내가 말이야~ 우리 때는 판결도 손으로 썼어. 잠깐 펜이 안 나와서 그래, 금방 다시 써줄 테니 기다려봐.',
  scientist: '현재 데이터 표본이 부족하여 신뢰구간 산출 불가. 재수집 후 판결 예정. 잠시 대기 요망.',
  philosopher: '판결이란 과연 서두를 수 있는 것인가? 잠시 사유의 시간을 갖겠다. 다시 물어봐 주겠는가?',
  alien: '지직— 통신 신호 불안정. 본 심판관은 모선과의 교신을 복구 중이다. 잠시 후 지구 기준으로 재판결하겠다.',
  crazy: '아 잠깐, 방금 천장에서 영감이 내려오다 말았다. 참고로 오늘 점심은 못 먹었다. 곧 판결 줄 테니 다시 눌러봐라.',
};

function buildJudgeSystem(selectedJudges) {
  const descs = selectedJudges.map(j => JUDGE_DESC[j.id]).filter(Boolean).join('\n\n');
  const jsonFormat = selectedJudges.map(j => `  {"id":"${j.id}","verdict":"판결문"}`).join(',\n');
  return `당신은 개성 넘치는 캐릭터 판사다. 주어진 상황(텍스트 + 이미지)을 읽고 담당 판사가 자기만의 방식으로 핵심을 찌르는 판결을 내린다.

【입력 분석 — 이것이 가장 중요하다】
사용자가 직접 쓴 내용에서 반드시 아래 중 하나 이상을 판결에 직접 인용하라:
- 구체적 인물/상황/장소/숫자/날짜/물건 이름
- 이미지에서 발견한 표정, 배경, 텍스트, 옷차림 등 시각적 디테일
- 사용자 글 속 감정 키워드 (억울, 황당, 분노, 슬픔 등)
→ 판결문에 이 요소가 없으면 실패. 일반론("그런 행동은 나쁘다") 금지.

【웃음 코드】
- 판결이 맞는 말인데 예상 밖의 각도여야 한다 — 읽는 사람이 "어? 근데 그 말도 맞네 ㅋㅋ"
- 과장하되 틀리지 않는다. 사용자 상황을 꿰뚫으면서 웃긴 것.
- 2~3문장. 짧고 강렬하게. 길면 안 읽는다.
- 예시 표현을 그대로 쓰지 마라 — 상황에 맞는 새 표현을 만들어라.

【담당 판사 캐릭터】

${descs}

반드시 아래 JSON 형식으로만 답하라. 다른 텍스트 없이 JSON만 출력:
{"verdicts":[
${jsonFormat}
]}`;
}

exports.aiJudge = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { situation, imageBase64, selectedJudges: reqJudges } = request.data || {};
  if (!situation || situation.trim().length < 5) {
    throw new HttpsError('invalid-argument', '상황을 5자 이상 적어주세요');
  }

  // 선택된 판사 검증 (중복 제거, 최대 3명), 없으면 랜덤 3명
  const validIds = [...new Set(
    (Array.isArray(reqJudges) ? reqJudges : []).filter(id => JUDGES.some(j => j.id === id)),
  )].slice(0, 3);
  const activeJudges = validIds.length > 0
    ? validIds.map(id => JUDGES.find(j => j.id === id))
    : [...JUDGES].sort(() => Math.random() - 0.5).slice(0, 3);

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'judge'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 판결은 하루 ${limit}번만 가능해요`);

  const imageHint = imageBase64
    ? '\n[이미지 첨부됨: 표정·배경·텍스트·옷차림 등 구체적 시각 요소를 판결문에 직접 인용하라]'
    : '';
  const judgeSystem = buildJudgeSystem(activeJudges);
  const judgeUser = `아래 상황에서 구체적인 인물·행동·물건·감정을 반드시 판결문에 언급하며 판결하라:${imageHint}\n\n${situation.slice(0, 500)}`;

  let verdicts;
  try {
    const { parsed } = await callAndParse(
      (mt) => callAI(judgeSystem, judgeUser, imageBase64, mt, 0.95, true),
      2400,
    );
    const byId = new Map((parsed.verdicts || []).map(v => [v.id, String(v.verdict || '').trim()]));
    // 요청한 판사 순서대로 정렬, 누락된 판사는 캐릭터 대체 판결문으로 채움
    verdicts = activeJudges.map(j => ({
      judgeId: j.id,
      judgeName: j.name,
      verdict: byId.get(j.id) || JUDGE_FALLBACK[j.id] || '잠시 후 다시 시도해주세요.',
    }));
  } catch (err) {
    console.error('[aiJudge] AI/parse failed:', err.message);
    await refundUsage(userId, 'judge', usedExtra, usedPoints, pointsUsed);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 판결에 실패했어요. 사용 횟수는 차감되지 않았어요. 잠시 후 다시 시도해주세요.');
  }

  const imageUrl = imageBase64 ? await saveAiImage(userId, imageBase64) : null;
  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_judge',
    feedType: 'ai_judge',
    title: situation.slice(0, 60) + (situation.length > 60 ? '...' : ''),
    situation: situation.slice(0, 500),
    hasImage: !!imageBase64,
    images: imageUrl ? [imageUrl] : [],
    verdicts,
    ...author,
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'golra',
  });

  return { postId: postRef.id, verdicts };
});

// ── 만국번역사 ──
const TRANSLATE_STYLES = {
  bukhan: { name: '🇰🇵 북한 주체어', system: `다음 텍스트를 북한 혁명 선전 문체로 번역하라. 출력은 한국어로.
핵심: 일상적인 내용을 혁명·주체사상 언어로 탈바꿈한다. 치킨 한 마리를 시켜도 제국주의에 맞선 투쟁이 되는 수준.
이미지가 첨부된 경우 이미지 속 상황도 혁명적 관점에서 해석하라.
필수 요소: "동무", "수령님의 교시", "주체의 힘으로", "반혁명적", "혁명적" 중 2개 이상 상황에 맞게.
구조: [혁명적 감탄 또는 선언] → [일상 내용을 거창한 투쟁으로 변환] → [주체사상으로 마무리].
예시: "오늘 밥 먹었어?" → "동무여! 위대한 수령님의 가르침대로 혁명의 전사는 동지적 밥상으로 체력을 단련해 미제국주의를 격퇴할 준비를 갖춰야 할 것이오!"
예시: "카톡 읽씹함" → "동무의 반혁명적 통신 단절 행위는 주체사상에 위배되는 것이오! 혁명 동지 간의 단결을 위해 즉각 응답하라! 침묵은 곧 반동이다!"` },

  japanese: { name: '🇯🇵 일본 공손어', system: `다음 텍스트를 극도로 공손한 일본 경어체로 번역하라. 일본어 번역과 한국어 해석을 함께 출력할 것.
핵심: 일본인 특유의 과도한 공손함과 謙譲語(겸양어)를 활용. 사소한 내용도 최대한 정중하게 바꾼다.
이미지가 첨부된 경우 이미지 속 상황도 정중한 일본어로 묘사하라.
필수 요소: "申し訳ございません", "よろしくお願い申し上げます", "恐れ入りますが", "ご迷惑をおかけして大変恐縮でございます" 중 1개 이상.
형식: 일본어 원문 줄바꿈 후 (한국어 해석) 형태로 출력.
읽는 사람이 "이걸 이렇게 공손하게 말하다니ㅋㅋ" 소리가 나와야 함.
예시: "왜 안 왔어?" → "誠に恐れ入りますが、ご来席が遅れていらっしゃる件につきまして、もしよろしければご事情をお聞かせ願えますでしょうか。\n(황송하오나 지각하신 건에 대해 사정을 말씀해 주시겠사옵니까...)"
예시: "밥 먹었어?" → "失礼ながら、もうお食事はお済みになりましたでしょうか。よろしければご一緒にいかがでしょうか。\n(실례지만 식사는 마치셨습니까. 괜찮으시다면 함께 어떠십니까.)"` },

  french: { name: '🇫🇷 프랑스 지식인어', system: `다음 텍스트를 프랑스 지식인 특유의 거드름 피우는 문체로 번역하라. 프랑스어와 한국어 해석을 함께 출력.
핵심: 파리 카페의 철학자처럼 모든 것을 실존적 명제로 바꾼다. 와인·철학·예술이 사소한 일상에 끼어든다.
이미지가 첨부된 경우 이미지 속 상황도 프랑스 예술가적 시각으로 해석하라.
필수 요소: 철학 용어(existence, liberté, absurde 등) 또는 와인/예술/프랑스 문화 레퍼런스 1개 이상. 마지막에 한 줄 철학적 코멘트 필수.
형식: 프랑스어 번역 줄바꿈 후 (한국어 해석) 형태.
읽는 사람이 "치킨 읽씹이 왜 사르트르냐ㅋㅋ" 소리가 나와야 함.
예시: "카톡 읽씹함" → "L'absence de réponse... c'est aussi une réponse, n'est-ce pas?\n(응답의 부재... 그것 역시 하나의 응답이 아닌가?) — 당신은 지금 사르트르의 '타자는 지옥이다'를 몸소 체험 중이오."
예시: "오늘 진짜 힘들었어" → "La vie, c'est une lutte perpétuelle contre le vide...\n(삶이란 공허에 맞선 영원한 투쟁이오...) — 오늘의 고통은 카뮈의 시지프스처럼 내일 다시 돌을 굴릴 이유가 되는 것이오."` },

  english: { name: '🇺🇸 미국 Z세대 영어', system: `다음 텍스트를 미국 Z세대·힙합 슬랭 스타일로 번역하라. 영어 번역과 한국어 해석을 함께 출력.
핵심: no cap, slay, lowkey, fr fr, bestie, it's giving, vibe, bussin, sus, periodt 등 최신 미국 Z세대·힙합 슬랭을 자연스럽게 섞는다. 진지한 내용도 쿨하게.
이미지가 첨부된 경우 이미지 속 상황도 Z세대 시각으로 해석하라.
필수 요소: "no cap", "fr fr", "lowkey", "slay", "it's giving", "period" 중 2개 이상.
형식: 영어 번역 줄바꿈 후 (한국어 해석) 형태.
예시: "오늘 진짜 힘들었어" → "Bruh today was ROUGH no cap, literally couldn't even, fr fr I was just vibing in survival mode periodt 💀\n(야 오늘 진짜 힘들었다 no cap, 솔직히 그냥 생존 모드로 버텼음 fr fr)"
예시: "카톡 읽씹함" → "They seen my message and left me on read?? That's lowkey sus bestie, it's giving 'I don't fw you' energy ngl 😭\n(카톡 봤는데 씹었어?? 솔직히 좀 이상한데 bestie, 그냥 '난 너 별로야' 에너지 아님ㅋ)"` },
};

// 공통 — 원문보다 한 끗 더 웃기게 (단순 치환 방지)
const TRANSLATE_HUMOR_RULE = `【중요 — 단순 번역 금지】
1. 단어·어미만 기계적으로 바꾸지 마라. 해당 언어·문화권 사람이 이 상황에서 실제로 붙일 너스레·감탄사·문화적 색채를 살려라.
2. 원문의 뜻은 그대로 두되, 해당 언어의 과장된 특성을 한 단계 끌어올려 원문보다 더 웃기게 만들어라.
3. 결과물을 읽고 "내가 쓴 것보다 이 번역이 더 웃기네ㅋㅋ" 소리가 나와야 한다.
4. 반드시 완성된 문장으로 깔끔하게 마무리하라. 문장이 중간에 끊기면 실패다.
번역 결과만 출력. 제목·원문·설명·주석 일절 금지. (한국어 해석 병기는 허용)`;

// 매 호출마다 살짝 다른 톤으로 같은 입력도 결과가 반복되지 않도록
const TRANSLATE_TONES = [
  '톤: 과하게 진지하게, 사소한 것도 엄청 중요한 것처럼.',
  '톤: 살짝 극적으로, 드라마틱하게.',
  '톤: 능청맞고 자신만만하게.',
  '톤: 감탄스럽고 열정적으로.',
  '톤: 약간 안타깝고 공감하는 느낌으로.',
];

exports.aiTranslate = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { text, style, imageBase64 } = request.data || {};
  if (!text || text.trim().length < 2) {
    throw new HttpsError('invalid-argument', '번역할 텍스트를 입력해주세요');
  }
  const styleData = TRANSLATE_STYLES[style];
  if (!styleData) throw new HttpsError('invalid-argument', '번역 스타일을 선택해주세요');

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'translate'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 번역은 하루 ${limit}번만 가능해요`);

  const tone = TRANSLATE_TONES[Math.floor(Math.random() * TRANSLATE_TONES.length)];
  const system = `${styleData.system}\n\n${TRANSLATE_HUMOR_RULE}\n${tone}`;
  const userText = imageBase64
    ? `이미지와 텍스트를 모두 보고 그 지역 사람이 실제로 이 상황에서 말하듯 사투리로 번역해줘. 이미지에 텍스트가 있으면 같이 번역:\n${text.slice(0, 500)}`
    : `다음을 그 지역 사람이 실제로 이 상황에서 말하듯 사투리로 번역해줘:\n${text.slice(0, 500)}`;

  let translated;
  try {
    translated = String(await callAI(system, userText, imageBase64, 2000, 0.95) || '').trim();
    if (!translated) throw new Error('empty translation');
  } catch (err) {
    console.error('[aiTranslate] AI call failed:', err.message);
    await refundUsage(userId, 'translate', usedExtra, usedPoints, pointsUsed);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 번역에 실패했어요. 사용 횟수는 차감되지 않았어요. 잠시 후 다시 시도해주세요.');
  }

  const imageUrl = imageBase64 ? await saveAiImage(userId, imageBase64) : null;
  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_translate',
    feedType: 'ai_translate',
    title: `${styleData.name}: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`,
    originalText: text.slice(0, 500),
    style,
    styleName: styleData.name,
    translated,
    hasImage: !!imageBase64,
    images: imageUrl ? [imageUrl] : [],
    ...author,
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'usgyo',
  });

  return { postId: postRef.id, translated, styleName: styleData.name };
});

// ── AI궁합 ──
// 매 호출 무작위 관점으로 같은 입력도 결과가 반복되지 않게
const MATCH_ANGLES = [
  '겉으론 안 어울려 보이지만 의외의 공통점을 파고들어라.',
  '둘의 치명적인 충돌 지점을 과장해서 드러내라.',
  '시간이 지날수록 어떻게 변할 관계인지에 초점을 맞춰라.',
  '서로의 단점을 묘하게 보완하는 지점을 찾아라.',
  '함께 있으면 벌어질 가장 웃긴 사고 한 장면을 상상하라.',
  '둘 사이의 권력관계(누가 휘둘리는지)를 짚어라.',
  '이 조합이 영화가 된다면 어떤 장르의 무슨 제목일지 설명하라.',
  '둘이 처음 만난 사람이 느낄 당혹감을 구체적으로 상상하라.',
  '시간이 지나면 누가 누구를 완전히 바꿔놓을지 예측하라.',
  '둘을 한 방에 가둬두면 1시간 뒤 어떤 일이 벌어질지 묘사하라.',
];

// 점수를 정수로 보정하고 5의 배수면 어중간하게 흩뜨림 (몰입 깨는 라운드 숫자 방지)
function normalizeMatch(parsed) {
  const out = { ...parsed };
  let score = Math.round(Number(out.score));
  if (!Number.isFinite(score)) score = 40 + Math.floor(Math.random() * 50);
  score = Math.max(0, Math.min(100, score));
  if (score % 5 === 0 && score > 2 && score < 98) {
    score += (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3));
    score = Math.max(0, Math.min(100, score));
  }
  out.score = score;
  out.grade = String(out.grade || '미지의궁합🔮');
  out.reason = String(out.reason || '');
  out.chemistry = String(out.chemistry || '');
  out.advice = String(out.advice || '');
  return out;
}

exports.aiMatch = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { itemA, itemB, imageA, imageB } = request.data || {};
  if (!itemA || !itemB || itemA.trim().length < 1 || itemB.trim().length < 1) {
    throw new HttpsError('invalid-argument', '두 가지를 모두 입력해주세요');
  }

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'match'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 궁합은 하루 ${limit}번만 가능해요`);

  // 같은 입력도 매번 다른 관점으로 보도록 분석 각도를 무작위 지정
  const angle = MATCH_ANGLES[Math.floor(Math.random() * MATCH_ANGLES.length)];
  const system = `당신은 세상 모든 것의 궁합을 꿰뚫어보는 AI 점쟁이다.

【분석 핵심 — 이게 전부다】
이 두 대상에서만 나올 수 있는 연결고리를 찾아라. 다른 조합에도 쓸 수 있는 분석은 0점.
"치킨과 맥주는 맛있으니 잘 맞는다" → 실격. "야식과 후회는 항상 함께 온다" → 합격.
사진이 첨부된 경우: 외모·표정·분위기·색감 등 시각적 특징을 reason과 chemistry에 직접 인용하라.
이번 분석 관점: ${angle}

【각 필드】
score: 0~100 정수. 절대 5의 배수(50·65·70·80·85·90) 쓰지 마라. 반드시 23, 67, 84, 91, 38 처럼 어중간한 수로.
grade: 이 조합만을 위한 창의적 등급명+이모지. 예시와 똑같이 쓰지 마라.
reason: 이 둘만의 본질적 공통점 또는 충돌. 진지한 척하면서 읽으면 웃기는 2~3문장.
chemistry: 둘이 만나면 실제로 벌어지는 장면. "~하게 된다" 형태. 구체적일수록 웃기다.
advice: 한 줄. 진지한 어투로 황당하거나 뜻밖의 말.

【금지 표현】예시와 동일한 표현, "이 조합은~", "서로~", 무난한 조언.

반드시 JSON만 출력. 다른 텍스트 없이:
{"score": 숫자, "grade": "등급", "reason": "이유", "chemistry": "케미", "advice": "조언"}`;

  let matchResult;
  try {
    const imageHint = (imageA || imageB)
      ? `\n[이미지 첨부: ${imageA && imageB ? '양쪽 사진 있음' : '한쪽 사진 있음'} — 사진 속 외모·표정·분위기를 reason/chemistry에 직접 인용]`
      : '';
    const { parsed } = await callAndParse(
      (mt) => callAIWithImages(
        system,
        `"${itemA.slice(0, 100)}"와 "${itemB.slice(0, 100)}"의 궁합. 이 둘에서만 나올 수 있는 핵심을 찔러라.${imageHint}`,
        imageA, imageB, mt, 0.95, true,
      ),
      900,
    );
    matchResult = normalizeMatch(parsed);
  } catch (err) {
    console.error('[aiMatch] failed:', err.message);
    await refundUsage(userId, 'match', usedExtra, usedPoints, pointsUsed);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 궁합에 실패했어요. 사용 횟수는 차감되지 않았어요. 잠시 후 다시 시도해주세요.');
  }

  const [urlA, urlB] = await Promise.all([
    imageA ? saveAiImage(userId, imageA) : null,
    imageB ? saveAiImage(userId, imageB) : null,
  ]);
  const matchImages = [urlA, urlB].filter(Boolean);
  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_match',
    feedType: 'ai_match',
    title: `${itemA} 💘 ${itemB} 궁합 결과`,
    itemA: itemA.slice(0, 100),
    itemB: itemB.slice(0, 100),
    hasImageA: !!imageA,
    hasImageB: !!imageB,
    images: matchImages,
    matchResult,
    ...author,
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'golra',
  });

  return { postId: postRef.id, matchResult };
});

// ── AI작명소 ──
const NAMING_TECHNIQUES = [
  '특성 합성어', '역설 비틀기', '의성어·의태어', '한자·사자성어 패러디',
  '한방 직관', '브랜드/제품명 패러디', '신화·전설풍 거창한 이름', '동요·유행어 변형',
  '영화·드라마 캐릭터 패러디', 'MZ세대 신조어 변형', '학술논문 제목처럼 거창하게',
  '인터넷 밈 변형', '사자성어·속담 뒤집기',
];

exports.aiNaming = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { description, imageBase64 } = request.data || {};
  const hasDesc = description && description.trim().length >= 2;
  if (!hasDesc && !imageBase64) {
    throw new HttpsError('invalid-argument', '설명을 입력하거나 사진을 첨부해주세요');
  }

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'naming'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 작명은 하루 ${limit}번만 가능해요`);

  // 매 호출마다 강조할 작명 기법 2개를 무작위로 골라 같은 입력도 결과가 반복되지 않게
  const picked = [...NAMING_TECHNIQUES].sort(() => Math.random() - 0.5).slice(0, 3);
  const system = `당신은 세상에서 가장 웃기고 본질을 꿰뚫는 작명 전문가다. 이번엔 특히 [${picked.join('] · [')}] 기법을 신선하게 살려라.

【분석 — 반드시 이 순서로】
1. 사진 첨부 시: 표정·눈빛·색감·체형·분위기·가장 눈에 띄는 특징 하나를 먼저 집어라.
2. 설명 있으면: 핵심 습관·행동 패턴·개성 하나를 집어라.
3. 이름은 집어낸 그 특징에서 직접 나와야 한다. 일반론 이름 금지.

【5개 이름 — 완전히 다른 기법으로, 겹치면 실패】
① 특성 합성어 (예: "회의중졸음신", "발표직전화장실왕")
② 역설 비틀기 (예: 항상 늦는 사람 → "제시간의전설", 조용한 사람 → "침묵의폭발물")
③ 의성어·의태어 (예: "흐물흐물카리스마", "뚱땅뚱땅이", "삐리삐리박사")
④ 한자·사자성어 패러디 (예: 臥龍睡眠 — 회의 때 자는 팀장, 무한긍정 → 無限肯定大師)
⑤ 한방 직관 or MZ신조어 (예: "미안왕", "괜찮아봇", "어쩔티비", "킹받는존재" — 너무 정확해서 웃김)

【reason — 이름보다 reason이 더 웃겨야 한다】
왜 찰떡인지 핵심을 한 줄. 진지하게 쓰되 읽으면 웃긴다. 패러디라면 원본 뭘 비튼 건지 살짝 언급.

금지: 예시와 동일한 이름, 평범한 이름, 단순 설명형, 영어만.
반드시 JSON만 출력:
{"names": [{"name": "이름1", "reason": "이유"}, {"name": "이름2", "reason": "이유"}, {"name": "이름3", "reason": "이유"}, {"name": "이름4", "reason": "이유"}, {"name": "이름5", "reason": "이유"}]}`;

  const descPart = hasDesc ? `대상 설명: ${description.trim().slice(0, 300)}\n` : '';
  const userText = imageBase64
    ? `${descPart}첨부된 사진에서 가장 눈에 띄는 특징 하나를 집어내서 거기서 출발하는 찰떡 이름 5개.`
    : `${descPart}이 대상의 핵심 특성에서 출발하는 찰떡 이름 5개.`;

  let names;
  try {
    const { parsed } = await callAndParse(
      (mt) => callAI(system, userText, imageBase64, mt, 1.0, true),
      1200,
    );
    names = (parsed.names || []).filter(n => n && n.name).map(n => ({
      name: String(n.name).slice(0, 40),
      reason: String(n.reason || '').slice(0, 200),
    }));
    if (names.length === 0) throw new Error('empty names');
  } catch (err) {
    console.error('[aiNaming] failed:', err.message);
    await refundUsage(userId, 'naming', usedExtra, usedPoints, pointsUsed);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 작명에 실패했어요. 사용 횟수는 차감되지 않았어요. 잠시 후 다시 시도해주세요.');
  }

  const imageUrl = imageBase64 ? await saveAiImage(userId, imageBase64) : null;
  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_naming',
    feedType: 'ai_naming',
    title: hasDesc ? `작명: ${description.trim().slice(0, 40)}${description.trim().length > 40 ? '...' : ''}` : '작명: 사진으로 요청',
    description: hasDesc ? description.trim().slice(0, 300) : '',
    names,
    hasImage: !!imageBase64,
    images: imageUrl ? [imageUrl] : [],
    ...author,
    commentCount: 0,
    reactions: { like: 0, funny: 0, fire: 0, total: 0 },
    viewCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isAiGenerated: true,
    hidden: false,
    cat: 'usgyo',
  });

  return { postId: postRef.id, names };
});

// ── getAiKingUsage ──
exports.getAiKingUsage = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) return { judge: 0, translate: 0, match: 0, naming: 0, extraUses: 0, dailyFreeLimit: DAILY_LIMIT };
  const today = kstToday();
  const features = ['judge', 'translate', 'match', 'naming'];
  const [snaps, userSnap, config] = await Promise.all([
    Promise.all(features.map(f => db.doc(`ai_king_usage/${userId}_${today}_${f}`).get())),
    db.doc(`users/${userId}`).get(),
    getAiKingConfig(),
  ]);
  const result = {};
  features.forEach((f, i) => { result[f] = snaps[i].exists ? (snaps[i].data().count || 0) : 0; });
  result.extraUses = userSnap.exists ? (userSnap.data()?.extraAiUses || 0) : 0;
  result.dailyFreeLimit = config.dailyFreeLimit || DAILY_LIMIT;
  return result;
});

// ── saveAiKingConfig (admin only) ──
exports.saveAiKingConfig = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const adminSnap = await db.doc(`admins/${uid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', '관리자만 접근 가능해요');

  const data = request.data || {};
  const FIELDS = ['activeModel', 'claudeApiKey', 'claudeModel', 'geminiApiKey', 'geminiModel', 'openaiApiKey', 'openaiModel', 'pointsPerUse', 'dailyFreeLimit', 'monthlyCap'];

  const update = {};
  for (const field of FIELDS) {
    if (data[field] !== undefined && data[field] !== null) {
      const val = data[field];
      // Skip masked values (API keys shown as ●●●●●)
      if (typeof val === 'string' && val.startsWith('●')) continue;
      update[field] = val;
    }
  }

  if (Object.keys(update).length === 0) {
    return { success: true, updated: [] };
  }

  update.updatedAt = FieldValue.serverTimestamp();
  update.updatedBy = uid;

  await db.doc('config/ai_king').set(update, { merge: true });

  // Invalidate cache
  _aiKingConfig = null;
  _aiKingConfigFetchedAt = 0;

  return { success: true, updated: Object.keys(update).filter(k => k !== 'updatedAt' && k !== 'updatedBy') };
});

// ── purchaseAiExtraUse ──
exports.purchaseAiExtraUse = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const quantity = Math.min(Math.max(Math.floor(Number(request.data?.quantity) || 1), 1), 10);
  // 묶음 구매 보너스: 5개→+1, 10개→+3
  const BONUS_MAP = { 5: 1, 10: 3 };
  const bonus = BONUS_MAP[quantity] || 0;
  const totalQuantity = quantity + bonus;

  const config = await getAiKingConfig();
  const pointsPerUse = config.pointsPerUse || 100;
  const totalCost = pointsPerUse * quantity;

  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '사용자를 찾을 수 없어요');

    const currentPoints = userSnap.data()?.points || 0;
    if (currentPoints < totalCost) {
      throw new HttpsError(
        'failed-precondition',
        `포인트가 부족해요. 현재 ${currentPoints}포인트 / 필요 ${totalCost}포인트`,
      );
    }

    tx.set(userRef, {
      points: FieldValue.increment(-totalCost),
      extraAiUses: FieldValue.increment(totalQuantity),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { success: true, quantity: totalQuantity, bonus, pointsUsed: totalCost };
});
