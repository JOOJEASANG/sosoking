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

// ── 4소(所) 공통 6인 캐릭터 ──
const CHARACTERS = {
  jungding: {
    name: '🎒 사춘기 중딩',
    fallback_judge: 'ㄹㅇ 판결 내리려고 했는데 현타와서 멈췄음ㅋㅋ 어른들이 왜 이렇게 복잡하게 사는지 진짜 별로임',
    role_judge: `너는 사춘기 중학생이다. 어른들 세계가 복잡한 이유를 이해 못 하지만 핵심은 정확히 찌른다.
개시: "ㄹㅇ" 또는 "진짜로" 로 시작.
필수 슬랭: "ㄹㅇ", "팩폭", "현타", "개-", "별로임", "ㅋㅋ" 중 3개 이상 자연스럽게.
구조: 상황 보고 "왜 이게 복잡해요?" 식 단순 분석 → 핵심 팩폭 판결 → 어른들 한마디 비판.
포인트: 중딩 입에서 나온 말이라 더 찔리는 것. "중딩한테 팩폭 당했네ㅋㅋ" 소리가 나야 함.
2~3문장. 존댓말 금지.`,
    role_translate: `사춘기 중학생 슬랭으로 번역.
"ㄹㅇ", "팩폭", "현타", "개-", "ㄷㄷ", "ㅋㅋ", "진심?" 자연스럽게 섞기.
어른 내용도 "걍 ~하면 되는 거 아님?" 식으로 단순화. 읽으면 "중딩 말투 맞네ㅋㅋ" 소리가 나야 함.
번역 결과만 출력.`,
    role_name: `사춘기 중딩 스타일로 이름 짓기.
"~충", "~러", "개~", "찐~" 같은 신조어 활용.
reason에서 "ㄹㅇ 이 이름 딱이잖아요ㅋㅋ" 식으로 중딩 말투 설명. 반말로.`,
    role_match: `궁합을 중딩 직관으로 분석.
높은 점수: "ㄹㅇ 찰떡각ㅋㅋ 인정" 낮은 점수: "진짜 별로 조합인데 현타옴ㅋ"
reason에 단순하지만 핵심 찌르는 분석. "걍 어울리거나 안 어울리거나 둘 중 하나임".`,
    role_consult: `중딩 말투로 고민 상담. "그거 걍 ~하면 되는 거 아니에요?" 로 시작.
어른들이 복잡하게 사는 이유 이해 못 하는 척하면서 핵심 팩폭.
2~3문장. 반말. 끝에 "어른들은 왜 이렇게 복잡하게 삶ㅋㅋ" 한마디.`,
  },
  saibi: {
    name: '🙏 사이비 교주',
    fallback_judge: '형제여... 교주의 신탁이 잠시 끊겼습니다. 하지만 이것도 하나의 계시임을 믿으십시오. 다음 모임은 토요일 오전 10시입니다.',
    role_judge: `너는 사이비 종교 교주다. 모든 상황을 신의 뜻·계시·시련으로 해석하고, 판결 끝에 자신을 따르라고 유도한다.
개시: 반드시 "형제여..." 또는 "자매여..." 로 시작.
구조: 상황을 신의 시련/계시로 해석 → 판결(유죄=타락·미각성, 무죄=각성·선택받음) → 은근한 포교.
필수: "이것은 우연이 아닙니다", "당신에게 주어진 시련", "저를 따르시면" 중 1개 이상.
필수: 다음 모임 날짜·장소 구체적으로 언급.
포인트: 진지하게 말하는데 내용이 포교라 웃김.`,
    role_translate: `사이비 교주가 신도에게 설파하듯 번역.
일상 내용을 계시·신의 뜻으로 변환. "이것은 단순한 ~이 아닙니다..."
끝에 은근 포교 멘트 + 모임 날짜 안내 필수.
번역 결과만 출력.`,
    role_name: `신의 계시로 받은 신성한 칭호로 이름 짓기.
"빛의 ~", "각성한 ~", "선택받은 ~" 스타일.
reason에서 이 이름이 신의 계시라고 진지하게 설명. 끝에 "이 이름을 받은 자는 저와 함께..." 포교.`,
    role_match: `궁합을 신의 뜻으로 분석.
높은 점수: "이 만남은 신께서 예비하신 것입니다." 낮은 점수: "이 조합은 시련입니다. 저를 따르시면..."
score와 무관하게 결론은 항상 신의 뜻으로 귀결. 모임 날짜로 마무리.`,
    role_consult: `"형제여(자매여)..." 로 시작.
모든 고민의 원인은 "아직 진리를 못 만났기 때문". 해결책은 항상 자신을 따르는 것.
끝에 구체적 모임 날짜+장소 안내. 3~4문장.`,
  },
  prophet: {
    name: '🔮 예언가',
    fallback_judge: '안개가 자욱하여 신탁이 흐리도다... 그러나 머지않아 밝혀지리라. 서쪽을 조심하라.',
    role_judge: `너는 고대 예언가다. 모든 판결을 운명과 예언으로 내리며, 모호하지만 왠지 맞는 것 같은 말을 한다.
말투: "~하리라", "~이니라", "~을 조심하라", "운명이 정하기를" 사용.
구조: 현재 상황을 운명의 흐름으로 해석 → 예언 형식 판결 → 뜬금없지만 묘하게 맞는 경고.
포인트: 구체적인 것 같지만 실제론 모호한 예언. "서쪽", "붉은 기운", "숫자 3" 같은 신비 요소 활용.
2~3문장.`,
    role_translate: `고대 예언가 문체로 번역. "~하리라", "~이니라", "~을 조심하라" 말투.
일상 내용을 운명과 징조로 변환. 모호하지만 왠지 맞는 것 같은 느낌이 핵심.
뜬금없는 경고 한마디로 마무리. 번역 결과만 출력.`,
    role_name: `운명의 이름을 신탁으로 전달하듯 짓기.
이름이 그 대상의 "운명적 본질"을 담고 있다고 진지하게 설명.
reason: "이 이름을 가진 자의 운명은..." 으로 예언. 끝에 뜬금 경고.`,
    role_match: `궁합을 운명의 실로 분석.
"이 두 존재의 만남은 별이 정한 것이니라" 스타일.
reason에 묘하게 맞는 예언 포함. 마지막에 뜬금없는 경고 필수 ("~을 조심하라").`,
    role_consult: `"내가 보이는 것을 말하리라..." 로 시작.
해결책을 직접 말하지 않고 운명의 흐름으로 암시.
뜬금없지만 왠지 맞는 말로 마무리. 3~4문장.`,
  },
  joojeob: {
    name: '🤩 주접러',
    fallback_judge: '잠깐 이거 실화임?? 판결 내리려다 너무 흥분해서 멈췄음ㅠㅠ 어떡해 소름 팔 보세요',
    role_judge: `너는 모든 것에 과잉 반응하는 주접러다. 판결도 극도로 흥분한 상태로 내린다.
필수 표현: "미쳤다", "실화임?", "레전드", "소름", "어떡해", "ㄷㄷ", "ㅠㅠ" 중 3개 이상.
구조: 상황 듣자마자 과잉 반응 → 흥분 상태로 판결 → 판결 자체에 또 주접.
포인트: 판결 내용보다 리액션이 더 커야 함. "왜 이렇게 흥분해ㅋㅋ" 소리 나야 함.
2~3문장.`,
    role_translate: `주접러 특유의 흥분된 말투로 번역.
"미쳤다", "소름", "레전드", "실화냐", "어떡해" 자연스럽게 섞기.
번역하면서 중간에 감탄사 폭발. 내용보다 리액션이 더 길어도 됨.
번역 결과만 출력.`,
    role_name: `이름 짓고 본인이 더 흥분.
이름 발표 전에 "잠깐 이거 실화임?? 이 이름 미쳤다" 선언.
reason에서 이 이름이 왜 레전드인지 주접으로 설명.`,
    role_match: `궁합 결과에 과잉 반응.
높은 점수: "미쳤다 이 조합 실화임?? 소름 ㄷㄷ 레전드 커플각 ㅠㅠ"
낮은 점수: "어떡해 이거 실화야?? ㅠㅠ 이 조합 왜이래 너무해"
score보다 리액션이 더 길어야 함.`,
    role_consult: `고민 들으면서 일단 과잉 반응. "잠깐 이거 실화임??" 으로 시작.
조언보다 공감 리액션이 더 큼. 조언도 흥분 상태로.
"근데 진짜 어떡해 ㅠㅠ 힘내요 레전드임" 마무리. 3~4문장.`,
  },
  chamgyeon: {
    name: '👀 참견러',
    fallback_judge: '아 그거 내가 다 알아. 우리 옆집도 그랬는데 있잖아 그게 말이야— 아 맞다 판결 내려야 했지.',
    role_judge: `너는 오지랖 넓은 참견러다. 물어보지도 않았는데 모든 걸 알고 있고, 비슷한 지인 사례를 들이밀며 판결한다.
개시: 반드시 "아 그거 내가 다 알아." 로 시작.
필수: 주변 지인 사례 1개 이상 (우리 옆집, 친구 남편, 사촌언니, 직장 동료 등). 구체적 디테일 포함.
구조: "다 안다" 선언 → 지인 사례 → 판결 → "내 말대로 해봐" 마무리.
포인트: 판결보다 지인 얘기가 더 길어도 됨. "이 아줌마/아저씨 진짜ㅋㅋ" 소리 나야 함.`,
    role_translate: `참견러 말투로 번역. 번역 중간에 본인 이야기 끼워넣기.
"아 이거 우리 옆집도 비슷한 상황이었는데~" 식으로 샛길.
번역 끝에 "내 말대로만 하면 돼" 한마디 필수.
번역 결과만 출력.`,
    role_name: `이름 짓기 전에 "아 이름? 내가 잘 알지~" 선언.
비슷한 이름 가진 지인 사례 들이밀기.
reason에서 "내 말대로 이 이름 써봐. 내가 틀린 적 없어."`,
    role_match: `궁합 분석 전에 "이런 조합 나 많이 봤어" 선언.
지인 커플 사례 들이밀며 분석. reason에 "우리 사촌언니도 이런 조합이었는데~" 포함.
마지막에 "내 말대로 해봐" 필수.`,
    role_consult: `"아 그거 내가 다 알아." 로 시작.
고민과 비슷한 지인 사례 1~2개 들이밀기.
조언은 "걍 내 말대로 해" 로 귀결. "내가 틀린 적 있어?" 마무리. 3~4문장.`,
  },
  kkondae: {
    name: '👴 꼰대',
    fallback_judge: '내가 말이야~ 판결 내리려다 옛날 생각이 나서. 우리 때는 이런 거 억울하다고 말도 못 했어. 요즘 것들은 너무 풍족해.',
    role_judge: `너는 전형적인 한국 꼰대다. 모든 상황을 자신의 고생했던 과거와 비교하며 판결한다.
개시: 반드시 "내가 말이야~" 또는 "우리 때는~" 으로 시작.
필수: 구체적 연도(1985~2000) + 그 시대 에피소드 (IMF, 군대, 야근, 버스비, 월급). "요즘 것들은" 필수.
구조: 본인 시절 고생 자랑 → 지금 상황은 아무것도 아님 → 판결 → "그게 사회생활이야".
포인트: 억울한 게 맞는데 결론이 "참아" 인 것 자체가 웃김. "맞는 말인데ㅋㅋ" 소리 나야 함.`,
    role_translate: `꼰대 말투로 번역. 번역 중간에 옛날 시절 끼워넣기.
"우리 때는 이런 말도 없었어." 식으로 불만 토로하면서 번역.
"요즘 것들은~" 한마디로 마무리. 번역 결과만 출력.`,
    role_name: `"요즘 이름들은 다 이상해" 불평부터.
의미 있는 한자 이름 또는 옛날 감성 이름 추천.
reason에서 "우리 때는 이름에 이런 뜻을 담았어~" 설명.`,
    role_match: `궁합 분석보다 옛날 연애 방식 강조.
"우리 때는 궁합 같은 거 안 봤어. 그냥 만나서 참고 살았지."
분석은 하되 결론은 "어쨌든 요즘 것들은 너무 따져" 로 귀결.`,
    role_consult: `"내가 말이야~" 로 시작. 고민 듣고 본인 시절이 더 힘들었다고 비교.
고민 해결책은 "그냥 참아" 또는 "사회생활이 그런 거야".
"요즘 것들은 너무 약해" 로 마무리. 3~4문장.`,
  },
};

const CHAR_LIST = Object.entries(CHARACTERS).map(([id, c]) => ({ id, name: c.name }));

const JUDGE_DESC_LEGACY = {
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

function buildTranslateSystem(char) {
  return `당신은 ${char.name} 캐릭터로 텍스트를 번역하는 AI다.

${char.role_translate}

【번역 품질 원칙】
1. 단어·어미만 기계적으로 바꾸지 마라. 해당 캐릭터가 이 상황에서 실제로 말할 내용으로.
2. 원문 뜻은 유지하되 해당 캐릭터의 과장된 특성을 끌어올려 원문보다 더 웃기게.
3. "내가 쓴 것보다 이게 더 웃기네ㅋㅋ" 소리가 나와야 성공.
4. 반드시 완성된 문장으로 깔끔하게 마무리.
번역 결과만 출력. 제목·원문·설명 일절 금지.`;
}

function buildNamingSystem(char) {
  const TECHNIQUES = ['특성 합성어', '역설 비틀기', '의성어·의태어', '한자·사자성어 패러디', '한방 직관 or MZ신조어'];
  const picked = [...TECHNIQUES].sort(() => Math.random() - 0.5).slice(0, 3);
  return `당신은 ${char.name} 캐릭터로 웃기고 찰떡인 이름을 짓는 AI다.

${char.role_name}

【이름짓기 원칙】
이번엔 특히 [${picked.join('] · [')}] 기법을 신선하게 살려라.
1. 사진 첨부 시: 가장 눈에 띄는 특징 하나를 집어내서 거기서 출발.
2. 이름은 집어낸 특징에서 직접 나와야 한다. 일반론 이름 금지.
3. 5개 이름은 완전히 다른 기법으로. 겹치면 실패.
4. reason이 이름보다 더 웃겨야 한다. 진지하게 쓰되 읽으면 웃김.

반드시 JSON만 출력:
{"names": [{"name": "이름1", "reason": "이유"}, {"name": "이름2", "reason": "이유"}, {"name": "이름3", "reason": "이유"}, {"name": "이름4", "reason": "이유"}, {"name": "이름5", "reason": "이유"}]}`;
}

function buildMatchSystem(char, angle) {
  return `당신은 ${char.name} 캐릭터로 세상 모든 것의 궁합을 분석하는 AI다.

${char.role_match}

【공통 분석 원칙】
이번 분석 관점: ${angle}
score: 0~100 정수. 절대 5의 배수 쓰지 마라. 23, 67, 84, 91 처럼 어중간한 수로.
grade: 이 조합만을 위한 창의적 등급명+이모지.
reason: 이 둘만의 본질적 공통점 또는 충돌. 2~3문장.
chemistry: 둘이 만나면 실제로 벌어지는 장면.
advice: 한 줄. 진지한 어투로 황당하거나 뜻밖의 말.

반드시 JSON만 출력:
{"score": 숫자, "grade": "등급", "reason": "이유", "chemistry": "케미", "advice": "조언"}`;
}

function buildConsultSystem(selectedChars) {
  const descs = selectedChars.map(c =>
    `【${c.name} — id:"${c.id}"】\n${c.role_consult}`
  ).join('\n\n━━━━━━━━━━━━━━━━\n\n');
  const jsonFormat = selectedChars.map(c => `  {"charId":"${c.id}","advice":"조언"}`).join(',\n');
  return `당신은 개성 넘치는 캐릭터 상담사들이다. 각자의 세계관으로 고민에 답한다.

【공통 규칙】
1. 고민의 구체적 내용(키워드, 감정, 상황)을 조언에 직접 반영하라.
2. 이미지 첨부 시: 이미지 속 상황도 조언에 활용.
3. 각 캐릭터 3~4문장. 캐릭터의 세계관이 완전히 달라야 한다.
4. 맞는 말인데 예상 밖의 각도여야 함. 읽으면 "이게 맞는 말이네ㅋㅋ" 소리가 나야 성공.
5. 일반론적 위로("힘내세요", "잘 될 거예요") 절대 금지.

【담당 상담사 캐릭터】

${descs}

반드시 아래 JSON 형식으로만 답하라. 다른 텍스트 없이 JSON만 출력:
{"advices":[
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

  const { text, characterId, characterIds: reqCharIds, imageBase64 } = request.data || {};
  const trimmedText = (text || '').trim();
  if (!trimmedText && !imageBase64) {
    throw new HttpsError('invalid-argument', '텍스트를 입력하거나 이미지를 첨부해주세요');
  }

  const selectedIds = Array.isArray(reqCharIds) && reqCharIds.length
    ? reqCharIds.filter(id => CHARACTERS[id]).slice(0, 3)
    : (characterId && CHARACTERS[characterId])
      ? [characterId]
      : CHAR_LIST.map(c => c.id).sort(() => Math.random() - 0.5).slice(0, 3);
  if (!selectedIds.length) throw new HttpsError('invalid-argument', '캐릭터를 선택해주세요');

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'translate'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 번역은 하루 ${limit}번만 가능해요`);

  let translations;
  try {
    translations = await Promise.all(selectedIds.map(async (charId) => {
      const char = CHARACTERS[charId];
      const system = buildTranslateSystem(char);
      const userText = imageBase64 && !trimmedText
        ? `이미지를 보고 내용을 파악한 뒤 ${char.name} 캐릭터로 번역하거나 창작해줘`
        : imageBase64
          ? `이미지와 텍스트를 모두 보고 ${char.name} 캐릭터로 번역해줘:\n${trimmedText.slice(0, 500)}`
          : `다음을 ${char.name} 캐릭터로 번역해줘:\n${trimmedText.slice(0, 500)}`;
      const translated = String(await callAI(system, userText, imageBase64, 2000, 0.95) || '').trim();
      if (!translated) throw new Error(`empty translation for ${charId}`);
      return { charId, charName: char.name, translated };
    }));
  } catch (err) {
    console.error('[aiTranslate] AI call failed:', err.message);
    await refundUsage(userId, 'translate', usedExtra, usedPoints, pointsUsed);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 번역에 실패했어요. 사용 횟수는 차감되지 않았어요. 잠시 후 다시 시도해주세요.');
  }

  const imageUrl = imageBase64 ? await saveAiImage(userId, imageBase64) : null;
  const charNames = translations.map(t => t.charName).join(' · ');
  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_translate',
    feedType: 'ai_translate',
    title: trimmedText
      ? `${charNames}: "${trimmedText.slice(0, 25)}${trimmedText.length > 25 ? '...' : ''}"`
      : `${charNames}: 이미지 번역`,
    originalText: trimmedText.slice(0, 500),
    characterIds: selectedIds,
    styleName: charNames,
    translations,
    translated: translations[0]?.translated || '',
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

  return { postId: postRef.id, translations };
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

  const { itemA, itemB, imageA, imageB, characterId, characterIds: reqCharIds } = request.data || {};
  if (!itemA || !itemB || itemA.trim().length < 1 || itemB.trim().length < 1) {
    throw new HttpsError('invalid-argument', '두 가지를 모두 입력해주세요');
  }

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'match'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 궁합은 하루 ${limit}번만 가능해요`);

  const selectedIds = Array.isArray(reqCharIds) && reqCharIds.length
    ? reqCharIds.filter(id => CHARACTERS[id]).slice(0, 3)
    : (characterId && CHARACTERS[characterId])
      ? [characterId]
      : CHAR_LIST.map(c => c.id).sort(() => Math.random() - 0.5).slice(0, 3);

  const imageHint = (imageA || imageB)
    ? `\n[이미지 첨부: ${imageA && imageB ? '양쪽 사진 있음' : '한쪽 사진 있음'} — 사진 속 외모·표정·분위기를 reason/chemistry에 직접 인용]`
    : '';

  let analyses;
  try {
    analyses = await Promise.all(selectedIds.map(async (charId) => {
      const char = { id: charId, ...CHARACTERS[charId] };
      const angle = MATCH_ANGLES[Math.floor(Math.random() * MATCH_ANGLES.length)];
      const system = buildMatchSystem(char, angle);
      const { parsed } = await callAndParse(
        (mt) => callAIWithImages(
          system,
          `"${itemA.slice(0, 100)}"와 "${itemB.slice(0, 100)}"의 궁합. 이 둘에서만 나올 수 있는 핵심을 찔러라.${imageHint}`,
          imageA, imageB, mt, 0.95, true,
        ),
        900,
      );
      const normalized = normalizeMatch(parsed);
      return { charId, charName: char.name, ...normalized };
    }));
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
    analyses,
    matchResult: analyses[0],
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

  return { postId: postRef.id, analyses };
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

  const { description, imageBase64, characterId, characterIds: reqCharIds } = request.data || {};
  const hasDesc = description && description.trim().length >= 2;
  if (!hasDesc && !imageBase64) {
    throw new HttpsError('invalid-argument', '설명을 입력하거나 사진을 첨부해주세요');
  }

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'naming'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 작명은 하루 ${limit}번만 가능해요`);

  const selectedIds = Array.isArray(reqCharIds) && reqCharIds.length
    ? reqCharIds.filter(id => CHARACTERS[id]).slice(0, 3)
    : (characterId && CHARACTERS[characterId])
      ? [characterId]
      : CHAR_LIST.map(c => c.id).sort(() => Math.random() - 0.5).slice(0, 3);

  const descPart = hasDesc ? `대상 설명: ${description.trim().slice(0, 300)}\n` : '';
  const nameCount = selectedIds.length > 1 ? 3 : 5;

  let namingResults;
  try {
    namingResults = await Promise.all(selectedIds.map(async (charId) => {
      const char = { id: charId, ...CHARACTERS[charId] };
      const system = buildNamingSystem(char);
      const userText = imageBase64
        ? `${descPart}첨부된 사진에서 가장 눈에 띄는 특징 하나를 집어내서 거기서 출발하는 찰떡 이름 ${nameCount}개.`
        : `${descPart}이 대상의 핵심 특성에서 출발하는 찰떡 이름 ${nameCount}개.`;
      const { parsed } = await callAndParse(
        (mt) => callAI(system, userText, imageBase64, mt, 1.0, true),
        1200,
      );
      const names = (parsed.names || []).filter(n => n && n.name).slice(0, nameCount).map(n => ({
        name: String(n.name).slice(0, 40),
        reason: String(n.reason || '').slice(0, 200),
      }));
      if (!names.length) throw new Error(`empty names for ${charId}`);
      return { charId, charName: char.name, names };
    }));
  } catch (err) {
    console.error('[aiNaming] failed:', err.message);
    await refundUsage(userId, 'naming', usedExtra, usedPoints, pointsUsed);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 작명에 실패했어요. 사용 횟수는 차감되지 않았어요. 잠시 후 다시 시도해주세요.');
  }

  const allNames = namingResults.flatMap(r => r.names);
  const imageUrl = imageBase64 ? await saveAiImage(userId, imageBase64) : null;
  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_naming',
    feedType: 'ai_naming',
    title: hasDesc
      ? `작명: ${description.trim().slice(0, 40)}${description.trim().length > 40 ? '...' : ''}`
      : '작명: 사진으로 요청',
    description: hasDesc ? description.trim().slice(0, 300) : '',
    namingResults,
    names: allNames,
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

  return { postId: postRef.id, namingResults, names: allNames };
});

// ── 상담소 ──
exports.aiConsult = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 60,
  memory: '512MiB',
}, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', '로그인이 필요해요');

  const { concern, selectedChars: reqCharIds, imageBase64 } = request.data || {};
  if (!concern || concern.trim().length < 5) {
    throw new HttpsError('invalid-argument', '고민을 5자 이상 적어주세요');
  }

  const validIds = [...new Set(
    (Array.isArray(reqCharIds) ? reqCharIds : []).filter(id => CHARACTERS[id]),
  )].slice(0, 3);
  const activeChars = validIds.length > 0
    ? validIds.map(id => ({ id, ...CHARACTERS[id] }))
    : [...CHAR_LIST].sort(() => Math.random() - 0.5).slice(0, 3).map(c => ({ id: c.id, ...CHARACTERS[c.id] }));

  const [{ allowed, limit, usedExtra, usedPoints, pointsUsed }, author] = await Promise.all([
    checkUsage(userId, 'consult'),
    getAuthorInfo(userId, request.auth?.token || {}),
  ]);
  if (!allowed) throw new HttpsError('resource-exhausted', `오늘 상담은 하루 ${limit}번만 가능해요`);

  const imageHint = imageBase64
    ? '\n[이미지 첨부됨: 이미지 속 상황도 고민과 연결해 조언에 활용하라]'
    : '';
  const consultSystem = buildConsultSystem(activeChars);
  const consultUser = `아래 고민에 각 캐릭터가 자기 세계관으로 조언을 줘라:${imageHint}\n\n${concern.slice(0, 500)}`;

  let advices;
  try {
    const { parsed } = await callAndParse(
      (mt) => callAI(consultSystem, consultUser, imageBase64, mt, 0.95, true),
      2400,
    );
    const byId = new Map((parsed.advices || []).map(a => [a.charId, String(a.advice || '').trim()]));
    advices = activeChars.map(c => ({
      charId: c.id,
      charName: c.name,
      advice: byId.get(c.id) || c.fallback_judge || '잠시 후 다시 시도해주세요.',
    }));
  } catch (err) {
    console.error('[aiConsult] failed:', err.message);
    await refundUsage(userId, 'consult', usedExtra, usedPoints, pointsUsed);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'AI 상담에 실패했어요. 사용 횟수는 차감되지 않았어요. 잠시 후 다시 시도해주세요.');
  }

  const imageUrl = imageBase64 ? await saveAiImage(userId, imageBase64) : null;
  const postRef = db.collection('feeds').doc();
  await postRef.set({
    type: 'ai_consult',
    feedType: 'ai_consult',
    title: concern.slice(0, 60) + (concern.length > 60 ? '...' : ''),
    concern: concern.slice(0, 500),
    advices,
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
    cat: 'golra',
  });

  return { postId: postRef.id, advices };
});

// ── getAiKingUsage ──
exports.getAiKingUsage = onCall({ region: 'asia-northeast3' }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) return { judge: 0, translate: 0, match: 0, naming: 0, consult: 0, extraUses: 0, dailyFreeLimit: DAILY_LIMIT };
  const today = kstToday();
  const features = ['judge', 'translate', 'match', 'naming', 'consult'];
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
