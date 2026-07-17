const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireVerifiedUser, assertNoSensitiveContent } = require('./security-utils');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const MAX_TITLE = 40;
const MAX_DESC = 320;
const TITLE_DAILY_LIMIT = 30;
const TITLE_COOLDOWN_SEC = 10;
const SERIOUS_KEYWORDS = ['폭행','폭력','상해','살인','강도','절도','사기','협박','스토킹','납치','감금','성범죄','성폭력','성추행','성희롱','강간','강제추행','가정폭력','학교폭력','직장내괴롭힘','갑질','따돌림','왕따','이혼','위자료','손해배상','형사고소','고발','소송','민사','형사','법원','응급','정신과','우울증','공황','자해','자살','의료','진단','치료'];

function textValue(value, maxLen) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').replace(/["“”'‘’]/g, '').trim();
}
function clipTitle(title) {
  const clean = compact(title).replace(/사건\s*사건$/g, '사건');
  return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trim()}…` : clean;
}
function normalizeAiTitle(raw, fallbackTitle) {
  let title = String(raw || '').replace(/```json|```/g, '').trim();
  try {
    const start = title.indexOf('{');
    const end = title.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(title.slice(start, end + 1));
      title = parsed.caseTitle || parsed.refinedTitle || parsed.draftTitle || parsed.title || title;
    }
  } catch (_) {}
  title = textValue(title, MAX_TITLE).replace(/^사건명\s*[:：]\s*/g, '').replace(/["“”'‘’]/g, '').replace(/[.!?。！？]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!title) return fallbackTitle || '';
  if (!title.endsWith('사건')) title = `${title} 사건`;
  return clipTitle(title);
}
function fallbackTitle(desc) {
  const text = textValue(desc, MAX_DESC)
    .replace(/^(제가|내가|나는|저는|나|저)\s*/g, '')
    .replace(/(하고 있었는데|하고 있었는 데|했는데|하던 중|한눈판사이|한눈 판 사이|잠깐 사이|사이에)/g, ' ')
    .replace(/[.!?。！？].*$/g, '')
    .trim();
  return clipTitle(`${text.slice(0, 28).trim() || '소소한 일상'} 사건`);
}
function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function containsSeriousKeyword(text) {
  const source = String(text || '').replace(/\s+/g, '');
  return SERIOUS_KEYWORDS.some(word => source.includes(word));
}

async function reserveTitleSuggestion(uid) {
  const today = kstDateKey();
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const limitRef = db.doc(`title_suggestion_limits/${uid}`);
  const reservationRef = db.doc(`title_suggestion_reservations/${uid}_${nonce}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(limitRef);
    const current = snap.exists ? snap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= TITLE_DAILY_LIMIT) throw new HttpsError('resource-exhausted', `오늘 AI 사건명 분석 한도 ${TITLE_DAILY_LIMIT}회를 모두 사용했습니다.`);
    if (current.lastSuggestedAt && current.date === today) {
      const lastMs = current.lastSuggestedAt.toMillis ? current.lastSuggestedAt.toMillis() : new Date(current.lastSuggestedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (diffSec < TITLE_COOLDOWN_SEC) throw new HttpsError('resource-exhausted', `${TITLE_COOLDOWN_SEC - diffSec}초 후에 다시 분석할 수 있습니다.`);
    }
    tx.set(limitRef, { date: today, count: count + 1, lastSuggestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(reservationRef, { uid, date: today, status: 'pending', createdAt: FieldValue.serverTimestamp() });
  });
  return { today, limitRef, reservationRef };
}

async function finishReservation(reservation, success) {
  if (!reservation) return;
  await db.runTransaction(async tx => {
    const reservationSnap = await tx.get(reservation.reservationRef);
    if (!reservationSnap.exists) return;
    if (!success) {
      const limitSnap = await tx.get(reservation.limitRef);
      const current = limitSnap.exists ? limitSnap.data() : {};
      if (current.date === reservation.today) {
        tx.set(reservation.limitRef, {
          count: Math.max(0, Number(current.count || 0) - 1),
          lastFailureRefundAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
    tx.delete(reservation.reservationRef);
  }).catch(error => console.error('title reservation cleanup failed:', error.message || error));
}

async function loadSettings() {
  try {
    const snap = await db.doc('site_settings/config').get();
    return snap.exists ? snap.data() : {};
  } catch {
    return {};
  }
}

exports.suggestCaseTitle = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = requireVerifiedUser(request, '사건명 AI 분석은 구글 또는 인증된 이메일 로그인 후 이용할 수 있습니다.');
  const desc = textValue(request.data?.caseDescription || request.data?.description, MAX_DESC);
  if (desc.length < 10) throw new HttpsError('invalid-argument', '사건 내용을 10자 이상 입력해주세요.');
  assertNoSensitiveContent(desc, '사건명 분석에 보낼 수 없는 정보');
  if (containsSeriousKeyword(desc)) throw new HttpsError('failed-precondition', '실제 범죄·소송·학교폭력·의료·정신건강 등 중대한 내용은 사건명 AI 분석에 사용할 수 없습니다.');

  const fallback = fallbackTitle(desc);
  const reservation = await reserveTitleSuggestion(uid);
  let aiSuccess = false;
  try {
    const settings = await loadSettings();
    const key = geminiKey.value().trim();
    if (!key) throw new Error('Gemini API key is not configured');
    const modelName = textValue(settings.geminiModel, 60) || 'gemini-2.5-flash';
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.82, topP: 0.94, topK: 40, responseMimeType: 'application/json' }
    });
    const prompt = `너는 소소킹 황당재판소의 사건명 작성관이다.\n\n사용자의 접수 내용을 바로 제목으로 만들지 말고, 내부적으로 정리한 뒤 최종 사건명 1개를 만든다. 내부 정리 과정은 출력하지 않는다.\n\n규칙:\n- 18~35자 권장, 최대 40자.\n- 사건의 핵심 대상과 핵심 행동을 포함한다.\n- 문장 앞부분을 그대로 자르지 않는다.\n- 반드시 '사건'으로 끝낸다.\n- 실제 범죄처럼 보이게 과격하게 쓰지 않는다.\n- 웃기려고 드립을 치지 말고, 너무 진지한 사건명처럼 쓴다.\n\n사건 내용:\n${desc}\n\nJSON만 출력하라.\n{"draftTitle":"1차 사건명 초안","refinedTitle":"보완 사건명","caseTitle":"최종 사건명","titleBasis":["구체명사","핵심 행동"]}`;
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const parsedText = result.response.text();
    const caseTitle = normalizeAiTitle(parsedText, fallback);
    let parsed = {};
    try {
      const raw = parsedText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    } catch (_) {}
    aiSuccess = true;
    return {
      caseTitle,
      aiCaseTitle: caseTitle,
      draftTitle: textValue(parsed.draftTitle, MAX_TITLE),
      refinedTitle: textValue(parsed.refinedTitle, MAX_TITLE),
      titleBasis: Array.isArray(parsed.titleBasis) ? parsed.titleBasis.map(x => textValue(x, 40)).filter(Boolean).slice(0, 4) : [],
      fallbackCaseTitle: fallback
    };
  } catch (err) {
    console.error('suggestCaseTitle failed:', err);
    return { caseTitle: fallback, aiCaseTitle: '', fallbackCaseTitle: fallback, fallback: true };
  } finally {
    await finishReservation(reservation, aiSuccess);
  }
});
