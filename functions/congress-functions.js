'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

async function getAiConfig() {
  try { const snap = await db.doc('config/ai_king').get(); return snap.exists ? snap.data() : {}; } catch { return {}; }
}

async function callAI(prompt, maxTokens = 400) {
  const config = await getAiConfig();
  if (config.activeModel === 'gemini' && config.geminiApiKey) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: config.geminiModel || 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 1.0, responseMimeType: 'application/json' },
    });
    return result.response.text();
  }
  if (!config.claudeApiKey) throw new Error('AI 키 미설정');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });
  const msg = await anthropic.messages.create({
    model: config.claudeModel || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens, temperature: 1.0,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content.find(b => b.type === 'text')?.text || '';
}

function safeParseJson(raw) {
  const cleaned = String(raw || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

const PARTIES = Object.freeze([
  { id: 'national', name: '국민질서당', emoji: '🛡️', color: '#263B66' },
  { id: 'youth', name: '시민개혁당', emoji: '🕯️', color: '#B8323B' },
  { id: 'center', name: '국민통합당', emoji: '⚖️', color: '#2F7D6E' },
]);
const PARTY_BY_ID = Object.freeze(Object.fromEntries(PARTIES.map(p => [p.id, p])));
const PARTY_IDS = PARTIES.map(p => p.id);
const BILL_TYPES = Object.freeze(['welfare', 'economy', 'media', 'security', 'education']);

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get().catch(() => null);
  return !!snap?.exists;
}

function clean(value, max = 120) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function kstMondayKey() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(kst);
  monday.setUTCDate(kst.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function billRef(id) { return db.doc(`congress_bills/${id}`); }
function partyRef(id) { return db.doc(`parties/${id}`); }

async function generateBillConsequence(billId, billData) {
  try {
    const result = billData.result === 'passed' ? '가결' : '부결';
    const votesFor = Number(billData.votesFor || 0);
    const votesAgainst = Number(billData.votesAgainst || 0);
    const prompt = `소소공화국 의회 법안 표결이 끝났습니다. 결과에 따른 짧은 정치 논평을 작성하세요.

법안명: ${billData.title}
내용: ${billData.desc || ''}
찬성 선택지: ${billData.optionFor || '찬성'}
반대 선택지: ${billData.optionAgainst || '반대'}
표결 결과: ${result} (찬성 ${votesFor}표, 반대 ${votesAgainst}표)

JSON 형식으로만 답하세요:
{"consequence": "이 법안 결과가 소소공화국에 미치는 정치·사회적 파장을 2~3문장으로. 구체적이고 생동감 있게."}`;
    const raw = await callAI(prompt, 300);
    const parsed = safeParseJson(raw);
    const consequence = typeof parsed?.consequence === 'string' ? parsed.consequence.trim() : '';
    if (consequence) {
      await billRef(billId).set({ consequence }, { merge: true });
    }
  } catch (e) {
    console.error('[generateBillConsequence]', e.message);
  }
}

function defaultBillForWeek(weekKey, seed = 0) {
  const pool = [
    { type: 'welfare', title: '민생지원 특별법', desc: '복지와 민생 안정을 위해 긴급 지원안을 표결합니다.', optionFor: '지원 확대', optionAgainst: '재정 신중' },
    { type: 'economy', title: '경제활력 촉진법', desc: '소상공인과 지역 경제 회복을 위한 정책 패키지를 심의합니다.', optionFor: '활력 우선', optionAgainst: '부작용 우려' },
    { type: 'media', title: '언론책임 강화법', desc: '가짜뉴스 대응과 표현 자유 사이의 균형을 두고 표결합니다.', optionFor: '책임 강화', optionAgainst: '자유 침해' },
    { type: 'security', title: '공공질서 안정법', desc: '치안과 시민 자유 사이의 기준을 정하는 안건입니다.', optionFor: '질서 우선', optionAgainst: '권한 남용 우려' },
    { type: 'education', title: '미래교육 개혁법', desc: '교육 투자와 평가 개편 방향을 정하는 주간 법안입니다.', optionFor: '개혁 찬성', optionAgainst: '현장 혼란' },
  ];
  const idx = (Number(weekKey.replace(/-/g, '')) + seed) % pool.length;
  return pool[idx];
}

async function ensureWeeklyBill() {
  const weekKey = kstMondayKey();
  const id = `weekly_${weekKey}`;
  const ref = billRef(id);
  const snap = await ref.get();
  if (snap.exists) return { id, ...snap.data() };

  const bill = defaultBillForWeek(weekKey);
  await ref.set({
    id,
    weekKey,
    status: 'open',
    source: 'weekly',
    type: bill.type,
    title: bill.title,
    desc: bill.desc,
    optionFor: bill.optionFor,
    optionAgainst: bill.optionAgainst,
    votesFor: 0,
    votesAgainst: 0,
    partyVotes: {},
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id, weekKey, status: 'open', source: 'weekly', ...bill, votesFor: 0, votesAgainst: 0, partyVotes: {} };
}

function publicBill(data) {
  const votesFor = Number(data.votesFor || 0);
  const votesAgainst = Number(data.votesAgainst || 0);
  const totalVotes = votesFor + votesAgainst;
  let result = data.result || null;
  if (!result && data.status === 'closed') result = votesFor >= votesAgainst ? 'passed' : 'rejected';
  return {
    id: data.id,
    weekKey: data.weekKey || null,
    status: data.status || 'open',
    source: data.source || 'weekly',
    type: data.type || 'economy',
    title: data.title || '계류 안건',
    desc: data.desc || '',
    optionFor: data.optionFor || '찬성',
    optionAgainst: data.optionAgainst || '반대',
    votesFor,
    votesAgainst,
    totalVotes,
    partyVotes: data.partyVotes || {},
    result,
    consequence: data.consequence || null,
  };
}

const getCongressBills = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth && request.auth.uid;
  await ensureWeeklyBill();

  const snap = await db.collection('congress_bills')
    .orderBy('createdAtMs', 'desc')
    .limit(10)
    .get();
  const bills = snap.docs.map(d => publicBill({ id: d.id, ...(d.data() || {}) }));

  let myVotes = {};
  if (uid && bills.length) {
    const voteSnaps = await db.getAll(...bills.map(b => billRef(b.id).collection('votes').doc(uid)));
    voteSnaps.forEach((s, i) => {
      if (s.exists) myVotes[bills[i].id] = s.data().choice || null;
    });
  }

  return { ok: true, mode: 'three-party', parties: PARTIES, bills, myVotes };
});

const voteCongressBill = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const billId = clean(request.data && request.data.billId, 140);
  const choice = request.data && request.data.choice === 'against' ? 'against' : request.data && request.data.choice === 'for' ? 'for' : null;
  if (!billId || billId.includes('/')) throw new HttpsError('invalid-argument', '법안 정보가 올바르지 않습니다.');
  if (!choice) throw new HttpsError('invalid-argument', '찬성 또는 반대를 선택해주세요.');

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  const voteRef = billRef(billId).collection('votes').doc(uid);

  const result = await db.runTransaction(async tx => {
    const [billSnap, existingVote] = await Promise.all([tx.get(billRef(billId)), tx.get(voteRef)]);
    if (!billSnap.exists) throw new HttpsError('not-found', '법안을 찾을 수 없습니다.');
    const bill = billSnap.data() || {};
    if ((bill.status || 'open') !== 'open') throw new HttpsError('failed-precondition', '이미 종료된 법안입니다.');
    if (existingVote.exists) throw new HttpsError('failed-precondition', '이미 표결했습니다.');

    tx.set(voteRef, {
      uid,
      choice,
      partyId,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });

    const update = {
      [choice === 'for' ? 'votesFor' : 'votesAgainst']: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (partyId) update[`partyVotes.${partyId}.${choice}`] = FieldValue.increment(1);
    tx.update(billRef(billId), update);

    return { bill: { id: billId, ...bill }, partyId };
  });

  const updated = await billRef(billId).get();
  return { ok: true, choice, bill: publicBill({ id: billId, ...(updated.data() || result.bill) }) };
});

const closeCongressBill = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const billId = clean(request.data && request.data.billId, 140);
  if (!billId || billId.includes('/')) throw new HttpsError('invalid-argument', '법안 정보가 올바르지 않습니다.');

  if (!(await isAdmin(uid))) throw new HttpsError('permission-denied', '관리자만 종료할 수 있습니다.');

  const ref = billRef(billId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '법안을 찾을 수 없습니다.');
  const data = snap.data() || {};
  const result = Number(data.votesFor || 0) >= Number(data.votesAgainst || 0) ? 'passed' : 'rejected';
  await ref.set({ status: 'closed', result, closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const closedBillData = { ...data, status: 'closed', result };
  generateBillConsequence(billId, closedBillData).catch(() => {});
  return { ok: true, bill: publicBill({ id: billId, ...closedBillData }) };
});

const seedCongressBillFromCrisis = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  if (!(await isAdmin(uid))) throw new HttpsError('permission-denied', '관리자만 생성할 수 있습니다.');

  const title = clean(request.data && request.data.title, 40) || '긴급 국정 현안';
  const desc = clean(request.data && request.data.desc, 120) || '국정 위기 대응 안건입니다.';
  const id = `admin_${Date.now()}`;
  await billRef(id).set({
    id,
    weekKey: kstMondayKey(),
    status: 'open',
    source: 'admin',
    type: BILL_TYPES.includes(request.data && request.data.type) ? request.data.type : 'economy',
    title,
    desc,
    optionFor: clean(request.data && request.data.optionFor, 20) || '찬성',
    optionAgainst: clean(request.data && request.data.optionAgainst, 20) || '반대',
    votesFor: 0,
    votesAgainst: 0,
    partyVotes: {},
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true, billId: id };
});

module.exports = { getCongressBills, voteCongressBill, closeCongressBill, seedCongressBillFromCrisis };
