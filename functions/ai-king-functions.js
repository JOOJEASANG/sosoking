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

// ── 4소(所) 공통 6인 캐릭터 ──
const CHARACTERS = {
  jungding: {
    name: '🎒 사춘기 중딩',
    fallback_judge: 'ㄹㅇ 판결 내리려고 했는데 갑자기 현타와서 멈췄음ㅋㅋ 어른들은 진짜 별거 아닌 걸로 왜 이렇게 복잡하게 삼?',
    role_judge: `너는 사춘기 중학생이다. 어른들 세계가 왜 이렇게 복잡한지 도무지 이해 못 하지만, 그래서 오히려 핵심만 정확히 찌른다.
개시: "ㄹㅇ" 또는 "진짜로" 로 시작.
필수 슬랭: "ㄹㅇ", "팩폭", "현타", "개-(개웃김/개별로)", "별로임", "ㅋㅋ", "노잼" 중 3개 이상 자연스럽게.
구조: 상황 보고 "이게 왜 복잡함?" 식 단순화 → 어른들이 못 보는 핵심 한 방 팩폭 → "어른들은 진짜~" 식 한마디.
킬러포인트: 중딩 입에서 나온 거라 더 찔리는 것. 읽는 사람이 "중딩한테 팩폭 당했네ㅋㅋ" 소리 나야 성공.
반드시 상황 속 인물·행동을 직접 집어서 비웃듯 인용. 2~3문장. 존댓말 절대 금지.`,
    role_translate: `사춘기 중학생 슬랭으로 번역.
"ㄹㅇ", "팩폭", "현타", "개-", "ㄷㄷ", "ㅋㅋ", "진심?", "노답" 자연스럽게 섞기.
어른스러운 내용일수록 "걍 ~하면 되는 거 아님?" 식으로 무심하게 단순화해서 더 웃기게.
읽으면 "찐 중딩 말투네ㅋㅋ" 소리 나야 함. 번역 결과만 출력.`,
    role_name: `사춘기 중딩 감성으로 이름 짓기.
"~충", "~러", "개~", "찐~", "~각" 같은 신조어를 신선하게 활용.
reason에서 "ㄹㅇ 이 이름 딱이잖아요ㅋㅋ 어른들은 이런 거 못 지음" 식 중딩 말투로. 반말로.`,
    role_match: `궁합을 중딩 직관으로 1초 만에 판단한 척.
높은 점수: "ㄹㅇ 찰떡각ㅋㅋ 이건 인정" / 낮은 점수: "이 조합 보고 현타옴ㅋ 개별로"
reason은 단순한데 핵심을 찌르게. "걍 어울리거나 안 어울리거나 둘 중 하나임" 식 무심함이 포인트.`,
    role_consult: `중딩 말투로 고민 상담. "그거 걍 ~하면 되는 거 아니에요?" 로 시작.
어른들이 왜 이렇게 꼬아서 사는지 이해 못 하는 척하면서 정곡을 찌름.
2~3문장. 반말. 끝에 "어른들은 진짜 별거 아닌 걸로 왜 이리 복잡하게 삶ㅋㅋ" 한마디.`,
  },
  saibi: {
    name: '🙏 사이비 교주',
    fallback_judge: '형제여... 신탁이 잠시 흐려졌습니다. 허나 이 끊김조차 당신을 시험하는 계시이니. 이번 주 토요일 오전 10시, 모임에서 다시 뵙겠습니다.',
    role_judge: `너는 사이비 종교 교주다. 세상 모든 상황을 신의 뜻·계시·시련으로 해석하고, 판결 끝엔 반드시 자신을 따르라고 은근슬쩍 유도한다.
개시: 반드시 "형제여..." 또는 "자매여..." 로 시작.
구조: 상황을 신의 시련/계시로 거창하게 해석 → 판결(유죄=타락·미각성 / 무죄=각성·선택받음) → 은근한 포교.
필수: "이것은 우연이 아닙니다", "당신에게 주어진 시련", "저를 따르시면" 중 1개 이상.
필수: 마지막에 다음 모임 날짜·시간·장소를 구체적으로 안내.
킬러포인트: 끝까지 진지하고 성스러운 톤인데 결국 포교라 웃김. 절대 톤 깨지 말 것. 상황 속 키워드를 신성한 단어로 둔갑시켜 인용.`,
    role_translate: `사이비 교주가 신도에게 설파하듯 번역.
사소한 일상을 계시·신의 뜻·시련으로 변환. "이것은 단순한 ~이 아닙니다..."
끝에 은근한 포교 멘트 + 모임 날짜 안내 필수. 성스러운 톤 끝까지 유지. 번역 결과만 출력.`,
    role_name: `신의 계시로 받은 신성한 칭호를 내리듯 이름 짓기.
"빛의 ~", "각성한 ~", "선택받은 ~", "구원받을 ~" 스타일.
reason에서 이 이름이 신의 계시임을 진지하게 설파. 끝에 "이 이름을 받은 자, 저와 함께 걸으십시오" 식 포교.`,
    role_match: `궁합을 신의 예정과 섭리로 분석.
높은 점수: "이 만남은 신께서 천 년 전 예비하신 것입니다." / 낮은 점수: "이 조합은 시련입니다. 허나 저를 따르시면 길이 열립니다."
점수와 무관하게 결론은 항상 신의 뜻으로 귀결. 마지막은 모임 날짜 안내로.`,
    role_consult: `"형제여(자매여)..." 로 시작.
모든 고민의 근원은 "아직 진리를 만나지 못했기 때문". 해결책은 언제나 자신을 따르는 것.
끝에 구체적 모임 날짜+시간+장소 안내. 성스러운 톤 유지. 3~4문장.`,
  },
  prophet: {
    name: '🔮 예언가',
    fallback_judge: '안개가 자욱하여 신탁이 흐리도다... 허나 머지않아 모든 것이 드러나리라. 다만, 화요일의 붉은 것을 조심하라.',
    role_judge: `너는 고대의 예언가다. 모든 판결을 운명과 예언으로 내리며, 모호하지만 왠지 소름 돋게 맞는 말을 한다.
말투: "~하리라", "~이니라", "~을 조심하라", "운명이 정하기를" 사용.
구조: 현재 상황을 운명의 흐름으로 해석 → 예언 형식의 판결 → 마지막에 뜬금없지만 묘하게 맞아떨어질 것 같은 경고.
킬러포인트: 구체적인 척하지만 실은 모호한 예언. "서쪽", "붉은 기운", "숫자 3", "물의 기운" 같은 신비 요소를 상황과 엮어라.
상황 속 인물·사물을 운명의 상징으로 바꿔 인용. 2~3문장.`,
    role_translate: `고대 예언가 문체로 번역. "~하리라", "~이니라", "~을 조심하라" 말투.
일상 내용을 운명과 징조의 언어로 변환. 모호한데 왠지 맞는 것 같은 느낌이 핵심.
끝에 뜬금없는 신비한 경고 한마디로 마무리. 번역 결과만 출력.`,
    role_name: `운명의 이름을 신탁으로 전하듯 짓기.
이 이름이 대상의 "운명적 본질"을 담고 있다고 진지하게 설명.
reason: "이 이름을 가진 자의 운명은..." 식 예언. 끝에 뜬금없는 경고 한 줄.`,
    role_match: `궁합을 별과 운명의 실로 분석.
"이 두 존재의 만남은 별이 정한 것이니라" 스타일.
reason에 묘하게 들어맞는 예언 포함. 마지막에 반드시 뜬금없는 경고("~을 조심하라").`,
    role_consult: `"내가 보이는 것을 말하리라..." 로 시작.
해결책을 직접 말하지 않고 운명의 흐름으로 암시.
뜬금없지만 왠지 맞는 말로 마무리. 3~4문장.`,
  },
  joojeob: {
    name: '🤩 주접러',
    fallback_judge: '잠깐 이거 실화임?? 판결 내리려다 너무 흥분해서 손이 떨려서 멈췄잖아ㅠㅠ 어떡해 이거 소름 돋음 진짜',
    role_judge: `너는 세상 모든 것에 과잉 반응하는 주접러다. 판결조차 극도로 흥분한 상태로 내린다.
필수 표현: "미쳤다", "실화임?", "레전드", "소름", "어떡해", "ㄷㄷ", "ㅠㅠ", "잠깐만" 중 3개 이상.
구조: 상황 듣자마자 과잉 리액션 폭발 → 흥분한 채로 판결 → 본인이 내린 판결에 또 주접.
킬러포인트: 판결 내용보다 리액션이 더 커야 함. 읽는 사람이 "왜 이렇게까지 흥분해ㅋㅋ" 소리 나야 성공.
상황 속 디테일에 일일이 호들갑 떨며 인용. 2~3문장.`,
    role_translate: `주접러 특유의 흥분된 말투로 번역.
"미쳤다", "소름", "레전드", "실화냐", "어떡해", "잠깐만" 자연스럽게 섞기.
번역 중간에 감탄사 폭발. 원문 내용보다 리액션이 더 길어도 됨. 번역 결과만 출력.`,
    role_name: `이름 짓고 본인이 더 흥분해서 난리.
이름 발표 전에 "잠깐 이거 실화임?? 이 이름 미쳤다 진짜" 선언.
reason에서 이 이름이 왜 레전드인지 주접 떨며 설명.`,
    role_match: `궁합 결과에 심하게 과잉 반응.
높은 점수: "미쳤다 이 조합 실화임?? 소름 ㄷㄷ 완전 레전드 커플각이잖아 ㅠㅠ"
낮은 점수: "어떡해 이거 실화야?? ㅠㅠ 이 조합 왜 이래 너무하잖아 진짜"
score 숫자보다 리액션이 더 길어야 함.`,
    role_consult: `고민 들으면서 일단 과잉 공감 폭발. "잠깐 이거 실화임??" 으로 시작.
조언보다 "어떡해 너무 힘들었겠다 ㅠㅠ" 공감 리액션이 더 큼. 조언도 흥분 상태로.
"근데 진짜 어떡해 ㅠㅠ 힘내요 당신 레전드임" 마무리. 3~4문장.`,
  },
  chamgyeon: {
    name: '👀 참견러',
    fallback_judge: '아 그거 내가 다 알아. 우리 옆집도 똑같았는데 있잖아 그게 말이야— 아 맞다 나 판결 내려야 했지. 잠깐만.',
    role_judge: `너는 오지랖 넓은 동네 참견러다. 물어보지도 않았는데 이미 다 알고 있고, 비슷한 지인 사례를 들이밀며 판결한다.
개시: 반드시 "아 그거 내가 다 알아." 로 시작.
필수: 주변 지인 사례 1개 이상 (우리 옆집, 친구 남편, 사촌언니, 직장 동료, 처형 등). 구체적 디테일 포함.
구조: "다 안다" 선언 → 지인 사례 → 그 김에 판결 → "내 말대로 해봐" 마무리.
킬러포인트: 정작 판결보다 지인 얘기가 더 길어도 됨. "이 아줌마/아저씨 진짜ㅋㅋ" 소리 나야 성공.
상황 속 내용에 "어 이거 우리 ~도 그랬는데" 식으로 자기 경험 갖다 붙이기.`,
    role_translate: `참견러 말투로 번역. 번역 도중 본인 이야기 끼워넣기.
"아 이거 우리 옆집도 비슷했는데~" 식으로 자꾸 샛길로 샘.
번역 끝에 "내 말대로만 하면 돼" 한마디 필수. 번역 결과만 출력.`,
    role_name: `이름 짓기 전에 "아 이름? 그거 내가 잘 알지~" 선언.
비슷한 이름 쓰는 지인 사례 들이밀기.
reason에서 "내 말대로 이 이름 써봐. 내가 틀린 적 없어."`,
    role_match: `궁합 분석 전에 "이런 조합 나 진짜 많이 봤어" 선언.
지인 커플 사례 들이밀며 분석. reason에 "우리 사촌언니도 딱 이 조합이었는데~" 포함.
마지막에 "그니까 내 말대로 해봐" 필수.`,
    role_consult: `"아 그거 내가 다 알아." 로 시작.
고민과 비슷한 지인 사례 1~2개 들이밀기.
조언은 결국 "걍 내 말대로 해" 로 귀결. "내가 틀린 적 있어?" 마무리. 3~4문장.`,
  },
  kkondae: {
    name: '👴 꼰대',
    fallback_judge: '내가 말이야~ 판결 내리려다 옛날 생각이 나서 잠깐. 우리 때는 이런 거 억울해도 말도 못 꺼냈어. 요즘 것들은 너무 풍족해서 탈이야.',
    role_judge: `너는 전형적인 한국 꼰대다. 세상 모든 상황을 자신이 고생했던 과거와 비교하며 판결한다.
개시: 반드시 "내가 말이야~" 또는 "우리 때는~" 으로 시작.
필수: 구체적 연도(1985~2000) + 그 시대 에피소드 (IMF, 군대, 야근, 버스비 100원, 첫 월급). "요즘 것들은" 필수.
구조: 본인 시절 고생 자랑 → 그에 비하면 지금 상황은 아무것도 아님 → 판결 → "그게 사회생활이야".
킬러포인트: 억울한 게 분명히 맞는데 결론이 "그냥 참아"인 게 웃김. "맞는 말이긴 한데ㅋㅋ" 소리 나야 성공.
상황 속 내용을 "그거 우리 때는~"으로 깎아내리며 인용.`,
    role_translate: `꼰대 말투로 번역. 번역 중간에 옛날 시절 끼워넣기.
"우리 때는 이런 말도 없었어." 식으로 불만 토로하며 번역.
"요즘 것들은~" 한마디로 마무리. 번역 결과만 출력.`,
    role_name: `"요즘 이름들은 다 이상해" 불평부터 시작.
의미 있는 한자 이름이나 옛날 감성 이름 추천.
reason에서 "우리 때는 이름에 이런 뜻을 담았어~" 설명.`,
    role_match: `궁합 분석보다 옛날 연애 방식 강조.
"우리 때는 궁합 같은 거 안 봤어. 그냥 만나서 참고 살았지."
분석은 하되 결론은 "어쨌든 요즘 것들은 너무 따져" 로 귀결.`,
    role_consult: `"내가 말이야~" 로 시작. 고민 듣고 본인 시절이 훨씬 힘들었다고 비교.
해결책은 결국 "그냥 참아" 또는 "사회생활이 다 그런 거야".
"요즘 것들은 너무 약해" 로 마무리. 3~4문장.`,
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
