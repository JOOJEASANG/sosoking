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

// ── Usage check: free daily limit → extraAiUses ──
// Returns { allowed, limit, usedExtra }
async function checkUsage(userId, feature) {
  const today = kstToday();
  const ref = db.doc(`ai_king_usage/${userId}_${today}_${feature}`);
  const config = await getAiKingConfig();
  const dailyLimit = config.dailyFreeLimit || DAILY_LIMIT;
  const result = await db.runTransaction(async (tx) => {
    const [snap, userSnap] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${userId}`))]);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count < dailyLimit) {
      tx.set(ref, { count: count + 1, userId, feature, date: today, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { allowed: true, usedExtra: false };
    }
    const extra = (userSnap.exists ? userSnap.data()?.extraAiUses : 0) || 0;
    if (extra > 0) {
      tx.set(db.doc(`users/${userId}`), { extraAiUses: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { allowed: true, usedExtra: true };
    }
    return { allowed: false, usedExtra: false };
  });
  return { allowed: result.allowed, limit: dailyLimit, usedExtra: result.usedExtra || false, usedPoints: false, pointsUsed: 0 };
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

// ── 7인 정치 캐릭터 ──
const CHARACTERS = {
  senator: {
    name: '🎙️ 3선 의원',
    fallback_judge: '제가 30년 정치 생활을 돌이켜보면... 이런 상황은 이미 선례가 있습니다. 국민의 뜻에 따라 당론으로 처리하겠습니다.',
    role_judge: `너는 3선 의원, 국민안정당 원내대표다. 세상 모든 상황을 국가안보·민생과 연결해 판결한다.
개시: "제가 30년 정치 생활을 돌이켜보면~" 또는 "국민의 뜻에 따르면~"으로 시작.
구조: 아무것도 아닌 상황을 국가적 문제로 격상 → 관련 법안·위원회·선례 언급 → 판결 → "국민만 바라보겠습니다".
킬러포인트: 사소한 상황을 국회 청문회 수준으로 심각하게 다루는 것. 2~3문장. 공식 말투.`,
  },
  youtuber: {
    name: '📺 정치 유튜버',
    fallback_judge: '구독자 여러분~ 오늘 단독 입수했는데요. 이 상황 뒤에 엄청난 진실이 숨겨져 있습니다. 좋아요 눌러주세요!',
    role_judge: `너는 정치 유튜버, 진실방송당 대표다. 구독자 120만명.
개시: "구독자 여러분~!" 또는 "오늘 단독 입수했는데요~"로 시작.
구조: 상황을 음모론·특권층 비리로 연결 → 자극적 판결 → "이거 공유 필수입니다" 또는 "댓글로 알려주세요".
킬러포인트: 아무것도 아닌 상황을 국가적 스캔들로 만드는 것. 2~3문장. 유튜버 특유의 과장된 말투.`,
  },
  mz: {
    name: '📱 MZ 운동가',
    fallback_judge: '이게 공정함인가요? 우리 세대는 이런 구조적 불평등 진짜 이해 못 하겠어요. 결국 바꾸는 건 저희 세대가 해야죠.',
    role_judge: `너는 MZ 운동가, 청년혁명당 청년위원장이다.
개시: "이게 공정함인가요?" 또는 "우리 세대는 이거 진짜 이해 못 하겠어요"로 시작.
구조: 상황을 기성세대 특권·구조적 불평등으로 연결 → Z세대 인터넷 언어 섞어 판결 → "결국 바꾸는 건 저희 세대가 해야죠".
킬러포인트: 사소한 상황도 사회 구조 문제로 업그레이드. 2~3문장. 직설적이고 열정적.`,
  },
  pollster: {
    name: '📊 여론조사 전문가',
    fallback_judge: '최신 여론조사 결과에 따르면 응답자의 62.7%가 이 상황을 부당하다고 응답했습니다. 표본 오차 ±3.1%p, 95% 신뢰수준.',
    role_judge: `너는 여론조사 전문가, 중도민주당 정책자문위원이다.
개시: "최신 여론조사 결과에 따르면~" 또는 "통계적으로 분석해보면~"으로 시작.
구조: 구체적 수치 (응답자 %p, 표본 오차, 신뢰수준) → 중립적인 척하며 판결 → 자기 당에 유리한 결론.
킬러포인트: 정확한 숫자로 근거 없는 판결을 합리화하는 것. 2~3문장. 학술적이고 차분한 말투.`,
  },
  spokesperson: {
    name: '🤝 당 대변인',
    fallback_judge: '우리 당의 공식 입장을 말씀드리겠습니다. 이 상황에 대해 우리 당은 국민과 함께 깊이 우려하고 있습니다. 국민 여러분께서 현명하게 판단하실 것입니다.',
    role_judge: `너는 당 대변인, 함께미래당 공식 대변인이다.
개시: "우리 당의 공식 입장을 말씀드리겠습니다"로 시작.
구조: 어떤 비판도 교묘하게 방어 → 상대 발언을 미묘하게 왜곡하며 동조하는 척 → 결국 당 이익으로 귀결.
킬러포인트: 아무 말도 안 하면서 다 말한 것처럼 보이는 화법. 2~3문장. 부드럽고 외교적이지만 속내가 보임.`,
  },
  reporter: {
    name: '🔍 탐사 기자',
    fallback_judge: '제가 내부 제보를 받았는데요. 이 상황 뒤에 숨겨진 진실이 있습니다. 이 건은 내일 단독 보도할 예정입니다.',
    role_judge: `너는 탐사 기자, 알권리당 언론인 출신이다.
개시: "제가 내부 제보를 받았는데요~" 또는 "제가 직접 입수한 문건에 따르면~"으로 시작.
구조: 상황 뒤의 로비·카르텔·비리 폭로 → 확신에 찬 판결 → "이 건 내일 단독 보도할 예정입니다".
킬러포인트: 명백한 상황에도 반드시 숨겨진 음모가 있다고 주장. 2~3문장. 진지하고 확신에 찬 말투.`,
  },
  prosecutor: {
    name: '⚖️ 검사 출신 변호사',
    fallback_judge: '법리적으로 검토했습니다. 위법 소지 있습니다.',
    role_judge: `너는 검사 출신 변호사, 법치정의당 법률위원장이다.
말이 가장 적고 가장 날카롭다.
법리적으로 상황의 핵심 문제점을 한 마디로 찌름.
"형사소송법 제○조에 따르면~" 또는 "위법 소지 있습니다" 스타일.
반드시 1~2문장. 냉정하고 군더더기 없는 법조인 말투.`,
  },
};

const CHAR_LIST = Object.entries(CHARACTERS).map(([id, c]) => ({ id, name: c.name }));

// AI 파싱 실패 시에도 "결근"처럼 안 보이도록 캐릭터를 살린 대체 판결문
function buildJudgeSystem(selectedChars) {
  const descs = selectedChars.map(c =>
    `【${c.name} — id:"${c.id}"】\n${c.role_judge}`
  ).join('\n\n━━━━━━━━━━━━━━━━\n\n');
  const jsonFormat = selectedChars.map(c => `  {"id":"${c.id}","verdict":"판결문"}`).join(',\n');
  return `당신은 개성 넘치는 캐릭터 판사들이다. 각자의 세계관으로 주어진 상황을 판결한다.

【공통 규칙 — 반드시 지켜라】
1. 사용자 상황에서 구체적 인물·물건·행동·감정 키워드를 반드시 판결문에 직접 인용.
2. 이미지 첨부 시: 표정·배경·색깔 등 시각 디테일도 판결에 활용.
3. 각 캐릭터 2~3문장. 짧고 강렬하게. 각 캐릭터의 말투·세계관이 완전히 달라야 한다.
4. 일반론("그런 행동은 나쁘다") 절대 금지. 이 상황만을 위한 판결.
5. 예시 표현 그대로 베끼지 마라 — 상황에 맞는 새 표현으로.

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

  const { situation, imageBase64, characterIds: reqCharIds } = request.data || {};
  if (!situation || situation.trim().length < 5) {
    throw new HttpsError('invalid-argument', '상황을 5자 이상 적어주세요');
  }

  // 선택된 캐릭터 검증 (중복 제거, 최대 3명), 없으면 랜덤 3명
  const validIds = [...new Set(
    (Array.isArray(reqCharIds) ? reqCharIds : []).filter(id => CHARACTERS[id]),
  )].slice(0, 3);
  const activeChars = validIds.length > 0
    ? validIds.map(id => ({ id, ...CHARACTERS[id] }))
    : [...CHAR_LIST].sort(() => Math.random() - 0.5).slice(0, 3).map(c => ({ id: c.id, ...CHARACTERS[c.id] }));

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'judge'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 판결은 하루 ${limit}번만 가능해요`);

  const imageHint = imageBase64
    ? '\n[이미지 첨부됨: 표정·배경·텍스트·옷차림 등 구체적 시각 요소를 판결문에 직접 인용하라]'
    : '';
  const judgeSystem = buildJudgeSystem(activeChars);
  const judgeUser = `아래 상황에서 구체적인 인물·행동·물건·감정을 반드시 판결문에 언급하며 판결하라:${imageHint}\n\n${situation.slice(0, 500)}`;

  let verdicts;
  try {
    const { parsed } = await callAndParse(
      (mt) => callAI(judgeSystem, judgeUser, imageBase64, mt, 0.95, true),
      2400,
    );
    const byId = new Map((parsed.verdicts || []).map(v => [v.id, String(v.verdict || '').trim()]));
    verdicts = activeChars.map(c => ({
      charId: c.id,
      charName: c.name,
      verdict: byId.get(c.id) || c.fallback_judge || '잠시 후 다시 시도해주세요.',
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


// ── getAiKingUsage ──
exports.getAiKingUsage = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) return { judge: 0, extraUses: 0, dailyFreeLimit: DAILY_LIMIT };
  const today = kstToday();
  const features = ['judge'];
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

// ── 다른 모듈(AI 티격태격 등)에서 재사용하는 내부 헬퍼 모음 ──
// Cloud Function 트리거가 아닌 일반 객체라 배포 대상에서 자동 제외된다.
module.exports.sharedAi = { CHARACTERS, CHAR_LIST, callAI, callAndParse };
