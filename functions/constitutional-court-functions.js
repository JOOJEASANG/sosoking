'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

const COURT_CHARACTERS = [
  { id: 'jungding',  name: '🎒 사춘기 중딩 재판관', stance: '팩폭 직구로 탄핵 찬반을 결정한다. ㄹㅇ 맞는 말을 해야 함' },
  { id: 'saibi',     name: '🙏 사이비 교주 재판관', stance: '신의 계시와 영적 판단으로 탄핵을 심판한다' },
  { id: 'prophet',   name: '🔮 예언가 재판관',      stance: '미래를 내다보고 탄핵의 결과를 예언하듯 판결한다' },
  { id: 'joojeob',   name: '🤩 주접러 재판관',      stance: '과장된 감탄과 열정으로 탄핵 의견을 표명한다' },
  { id: 'chamgyeon', name: '👀 참견러 재판관',       stance: '주변 사례를 끌어와 오지랖 넘치게 판결한다' },
  { id: 'kkondae',   name: '👴 꼰대 재판관',        stance: '"우리 때는~"으로 시작해 탄핵 찬반 의견을 낸다' },
];

async function getAiConfig() {
  try {
    const snap = await db.doc('config/ai_king').get();
    return snap.exists ? snap.data() : {};
  } catch { return {}; }
}

async function callCourtAI(system, userText, maxTokens = 2000) {
  const config = await getAiConfig();

  if (config.activeModel === 'claude' && config.claudeApiKey) {
    const { Anthropic } = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.claudeApiKey });
    const model = config.claudeModel || 'claude-haiku-4-5-20251001';
    const msg = await client.messages.create({
      model, max_tokens: maxTokens,
      messages: [{ role: 'user', content: userText }],
      system,
    });
    return msg.content?.[0]?.text || '';
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  let apiKey = config.geminiApiKey;
  if (!apiKey) {
    const { defineSecret } = require('firebase-functions/params');
    try { apiKey = defineSecret('GEMINI_API_KEY').value(); } catch {}
  }
  if (!apiKey) throw new HttpsError('internal', 'AI API 키가 설정되지 않았습니다.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: config.geminiModel || 'gemini-2.5-flash',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json' },
    systemInstruction: { parts: [{ text: system }] },
  });
  const result = await model.generateContent(userText);
  return result.response.text();
}

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// politics-functions.js 와 동일한 주차 계산
function weekPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date());
  const o = {}; parts.forEach(p => { o[p.type] = p.value; });
  const wmap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const off = (wmap[o.weekday] + 6) % 7;
  const base = Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day));
  const monMs = base - off * 86400000;
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  return { key: iso(monMs), endKey: iso(monMs + 7 * 86400000), prevKey: iso(monMs - 7 * 86400000) };
}

function reviewIdForPresident(presidentId) {
  return `impeachment_${String(presidentId || 'current').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function reviewRef(id) { return db.doc(`constitutional_reviews/${id}`); }

function judgeVotesFromPresident(president) {
  const impeachCount = Number(president.impeachCount || 0);
  const threshold = Math.max(1, Number(president.impeachThreshold || 5));
  const decreeDisapprove = Number(president.decreeDisapprove || 0);
  const decreeApprove = Number(president.decreeApprove || 0);
  const publicPressure = Math.min(4, Math.floor((impeachCount / threshold) * 4));
  const decreePressure = decreeDisapprove > decreeApprove ? 2 : decreeDisapprove > 0 ? 1 : 0;
  const votesForRemoval = Math.max(0, Math.min(9, 3 + publicPressure + decreePressure));
  return {
    votesForRemoval,
    votesForDismissal: 9 - votesForRemoval,
    result: votesForRemoval >= 6 ? 'accepted' : 'rejected',
  };
}

function publicReview(id, data) {
  return {
    id,
    status: data.status || 'pending',
    presidentId: data.presidentId || null,
    presidentName: data.presidentName || '대통령',
    partyId: data.partyId || null,
    partyName: data.partyName || null,
    charge: data.charge || '국회 탄핵소추안 심판',
    impeachCount: Number(data.impeachCount || 0),
    threshold: Number(data.threshold || 0),
    votesForRemoval: Number(data.votesForRemoval || 0),
    votesForDismissal: Number(data.votesForDismissal || 0),
    result: data.result || null,
    createdAtMs: Number(data.createdAtMs || 0),
    decidedAtMs: Number(data.decidedAtMs || 0),
    // 판결 후 조기선거 여부
    earlyElectionRequired: !!data.earlyElectionRequired,
    periodId: data.periodId || null,
  };
}

// elections/{prevKey} 에서 현직 대통령 정보를 읽는다 (politics-functions.js 와 동일한 출처)
async function getCurrentPresidentFromElections() {
  const { prevKey } = weekPeriod();
  const [elecSnap, petitionSnap] = await Promise.all([
    db.doc(`elections/${prevKey}`).get(),
    db.doc(`impeachment_petitions/${prevKey}`).get().catch(() => null),
  ]);

  if (!elecSnap.exists || elecSnap.data().status !== 'closed' || !elecSnap.data().winner) {
    return null;
  }
  const d = elecSnap.data();
  const winner = d.winner || {};
  const impeachCount = petitionSnap && petitionSnap.exists ? Number(petitionSnap.data().count || 0) : 0;
  const impeachTriggered = petitionSnap && petitionSnap.exists ? !!petitionSnap.data().triggered : false;

  return {
    candidateUid: winner.candidateUid || '',
    candidateName: winner.candidateName || winner.name || '대통령',
    partyId: winner.partyId || '',
    partyName: winner.partyName || '',
    decree: d.decree || null,
    decreeApprove: Number(d.decreeApprove || 0),
    decreeDisapprove: Number(d.decreeDisapprove || 0),
    impeachCount,
    impeachThreshold: 5,
    impeachTriggered,
    weekKey: prevKey,
  };
}

async function ensureReviewFromPresident() {
  const president = await getCurrentPresidentFromElections();
  if (!president || !president.candidateName) return null;

  const impeachCount = Number(president.impeachCount || 0);
  const threshold = Number(president.impeachThreshold || 5);
  const triggered = !!president.impeachTriggered || impeachCount >= threshold;
  if (!triggered) return null;

  const presidentId = president.weekKey || president.candidateUid || 'current';
  const id = reviewIdForPresident(presidentId);
  const ref = reviewRef(id);
  const snap = await ref.get();
  if (snap.exists) return { id, ...snap.data() };

  const votes = judgeVotesFromPresident(president);
  const review = {
    id,
    status: 'pending',
    presidentId,
    periodId: president.weekKey || null,
    presidentName: president.candidateName,
    partyId: president.partyId || null,
    partyName: president.partyName || null,
    charge: '국회 탄핵소추안 심판',
    impeachCount,
    threshold,
    votesForRemoval: votes.votesForRemoval,
    votesForDismissal: votes.votesForDismissal,
    result: votes.result,
    earlyElectionRequired: false,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(review);
  return review;
}

const getConstitutionalCourtStatus = onCall({ region: REGION, timeoutSeconds: 20 }, async () => {
  const pending = await ensureReviewFromPresident();
  const query = await db.collection('constitutional_reviews').orderBy('createdAtMs', 'desc').limit(5).get();
  const reviews = query.docs.map(d => publicReview(d.id, d.data() || {}));
  return {
    ok: true,
    active: !!pending,
    current: pending ? publicReview(pending.id, pending) : null,
    reviews,
  };
});

const decideConstitutionalReview = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUid(request);
  const reviewId = String((request.data && request.data.reviewId) || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  if (!reviewId) throw new HttpsError('invalid-argument', '심판 정보가 올바르지 않습니다.');

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  if (!user.isAdmin) throw new HttpsError('permission-denied', '관리자만 결정할 수 있습니다.');

  const ref = reviewRef(reviewId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '헌법재판소 심판을 찾을 수 없습니다.');
  const data = snap.data() || {};
  if (data.status === 'decided') return { ok: true, review: publicReview(reviewId, data) };

  const result = data.result || (Number(data.votesForRemoval || 0) >= 6 ? 'accepted' : 'rejected');
  const periodId = data.periodId || null;
  const today = kstToday();

  await db.runTransaction(async tx => {
    // 헌법재판소 심판 확정
    tx.set(ref, {
      status: 'decided',
      result,
      decidedAt: FieldValue.serverTimestamp(),
      decidedAtMs: Date.now(),
      earlyElectionRequired: result === 'accepted',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (result === 'accepted') {
      // 해당 election 문서에 대통령 파면 표시
      if (periodId) {
        const elecRef = db.doc(`elections/${periodId}`);
        const elecSnap = await tx.get(elecRef);
        if (elecSnap.exists) {
          tx.set(elecRef, {
            presidentRemoved: true,
            presidentRemovedAt: FieldValue.serverTimestamp(),
            presidentRemovedReason: 'constitutional_court_impeachment',
            earlyElectionRequired: true,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
      // 조기선거 플래그 생성
      tx.set(db.doc(`election_flags/early_${today}`), {
        type: 'early_election',
        reason: 'constitutional_court_impeachment_accepted',
        reviewId,
        periodId: periodId || null,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      // 기각 시: 탄핵 청원 초기화
      if (periodId) {
        const petitionRef = db.doc(`impeachment_petitions/${periodId}`);
        const petitionSnap = await tx.get(petitionRef);
        if (petitionSnap.exists) {
          tx.set(petitionRef, {
            triggered: false,
            impeachmentRejectedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    }
  });

  const after = await ref.get();
  return { ok: true, review: publicReview(reviewId, after.data() || {}) };
});

const generateCourtAiVerdict = onCall({ region: REGION, timeoutSeconds: 60, memory: '512MiB' }, async request => {
  const uid = requireUid(request);
  const reviewId = String((request.data && request.data.reviewId) || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  if (!reviewId) throw new HttpsError('invalid-argument', '심판 ID가 필요합니다.');

  const ref = reviewRef(reviewId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '탄핵심판을 찾을 수 없습니다.');
  const data = snap.data() || {};

  if (data.aiVerdicts && data.aiVerdicts.length > 0) {
    return { ok: true, verdicts: data.aiVerdicts };
  }

  const charCount = 3;
  const selected = [...COURT_CHARACTERS].sort(() => Math.random() - 0.5).slice(0, charCount);

  const charDescs = selected.map(c => `[${c.id}] ${c.name}: ${c.stance}`).join('\n');
  const jsonFormat = selected.map(c =>
    `  {"id":"${c.id}","charName":"${c.name}","verdict":"(판결 의견 2~4문장, 자신의 캐릭터 말투로)"}`
  ).join(',\n');

  const system = `당신은 소소공화국 헌법재판소의 재판관들입니다.
현재 ${data.presidentName || '대통령'} 대통령 탄핵심판이 진행 중입니다.
혐의: ${data.charge || '국회 탄핵소추안'}
탄핵 청원: ${data.impeachCount || 0}명 (기준: ${data.threshold || 5}명)
현재 인용(파면) 의견 재판관: ${data.votesForRemoval || 0}명 / 기각(유지) 의견: ${data.votesForDismissal || 0}명

각 재판관은 자신의 고유한 말투와 캐릭터로 탄핵 의견을 밝혀야 합니다.
진지하게 시작해서 각 캐릭터 특유의 방식으로 마무리하세요.
반드시 JSON만 출력하세요.`;

  const userText = `다음 재판관들이 탄핵심판에 대해 각자의 방식으로 의견을 밝혀주세요:\n\n${charDescs}\n\n{"verdicts":[\n${jsonFormat}\n]}`;

  let verdicts;
  try {
    const raw = await callCourtAI(system, userText, 1800);
    const text = String(raw || '').trim().replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }
    verdicts = (parsed?.verdicts || []).map(v => ({
      charId: String(v.id || v.charId || ''),
      charName: String(v.charName || ''),
      verdict: String(v.verdict || '').slice(0, 400),
    })).filter(v => v.verdict);
  } catch (e) {
    console.error('[generateCourtAiVerdict] AI 실패:', e.message);
    throw new HttpsError('internal', 'AI 판결 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
  }

  if (verdicts.length > 0) {
    await ref.set({ aiVerdicts: verdicts, aiVerdictGeneratedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  return { ok: true, verdicts };
});

module.exports = { getConstitutionalCourtStatus, decideConstitutionalReview, generateCourtAiVerdict };
