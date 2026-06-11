'use strict';

// politics-functions.js — 소소공화국 정당·입당·정치력 시스템
// 7개 가상 정당(AI 정치인이 이끄는)에 유저가 입당하고, 활동 포인트가 '정치력'이 되어
// 정당 순위와 당대표(당내 활동 1위)가 결정된다. 모든 쓰기는 서버에서만 처리한다.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// AI API (config/ai_king에서 키 로드)
let _aiConfig = null, _aiConfigAt = 0;
async function getAiConfig() {
  if (_aiConfig && Date.now() - _aiConfigAt < 30_000) return _aiConfig;
  const snap = await db.doc('config/ai_king').get();
  _aiConfig = snap.exists ? snap.data() : {};
  _aiConfigAt = Date.now();
  return _aiConfig;
}
async function callAI(prompt, maxTokens = 800) {
  const config = await getAiConfig();
  if (config.activeModel === 'gemini') {
    if (!config.geminiApiKey) throw new Error('AI 키 미설정');
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
    max_tokens: maxTokens,
    temperature: 1.0,
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

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

// ── 7개 정당 (battle-functions.js의 AI 캐릭터 소속과 일치) ──
const PARTIES = Object.freeze([
  { id: 'national',  name: '국민안정당', emoji: '🎙️', color: '#8B7355', leaderName: '3선 의원',        slogan: '검증된 경험, 흔들림 없는 안정' },
  { id: 'truth',     name: '진실방송당', emoji: '📺', color: '#6C5CE7', leaderName: '정치 유튜버',      slogan: '숨겨진 진실을 폭로한다' },
  { id: 'youth',     name: '청년혁명당', emoji: '📱', color: '#E84393', leaderName: 'MZ 운동가',        slogan: '기득권을 갈아엎자' },
  { id: 'center',    name: '중도민주당', emoji: '📊', color: '#00CEC9', leaderName: '여론조사 전문가',  slogan: '데이터가 곧 민심이다' },
  { id: 'future',    name: '함께미래당', emoji: '🤝', color: '#FDCB6E', leaderName: '당 대변인',        slogan: '우리는 늘 여러분 편입니다' },
  { id: 'rights',    name: '알권리당',   emoji: '🔍', color: '#00B894', leaderName: '탐사 기자',        slogan: '국민은 알 권리가 있다' },
  { id: 'justice',   name: '법치정의당', emoji: '⚖️', color: '#2D3436', leaderName: '검사 출신 변호사', slogan: '법 앞에 예외는 없다' },
]);

const PARTY_BY_ID = Object.freeze(Object.fromEntries(PARTIES.map(p => [p.id, p])));
const PARTY_IDS = PARTIES.map(p => p.id);

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function requireUid(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function assertPartyId(value) {
  const id = String(value || '').trim();
  if (!PARTY_BY_ID[id]) throw new HttpsError('invalid-argument', '존재하지 않는 정당입니다.');
  return id;
}

function partyRef(id) { return db.doc(`parties/${id}`); }
function memberRef(partyId, uid) { return db.doc(`parties/${partyId}/members/${uid}`); }

// 정당 문서가 없으면 기본 통계로 생성한다 (최초 1회).
async function ensureParties() {
  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);
  const missing = [];
  snaps.forEach((snap, i) => { if (!snap.exists) missing.push(PARTIES[i]); });
  if (!missing.length) return;
  const batch = db.batch();
  for (const p of missing) {
    batch.set(partyRef(p.id), {
      id: p.id, name: p.name, emoji: p.emoji, color: p.color,
      leaderName: p.leaderName, slogan: p.slogan,
      memberCount: 0, totalPower: 0,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

function publicMember(uid, userData) {
  return {
    uid,
    nickname: String(userData.nickname || userData.displayName || '시민').slice(0, 20),
    icon: (userData.nicknameIcon && typeof userData.nicknameIcon === 'object') ? userData.nicknameIcon : null,
    power: Math.max(0, Number(userData.totalPoints || userData.points || 0)),
  };
}

// 각 정당 당대표(정치력 1위 당원) 1명을 조회한다.
async function topMemberOf(partyId) {
  try {
    const q = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(1).get();
    if (q.empty) return null;
    const d = q.docs[0];
    const m = d.data() || {};
    return { uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null, power: Number(m.power || 0) };
  } catch {
    return null;
  }
}

// ── 정당 현황 + 내 소속 (페이지 1회 호출) ──
exports.getPoliticsOverview = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await ensureParties();

  const uid = request.auth && request.auth.uid;
  let me = null;

  if (uid) {
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const myPartyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    if (myPartyId) {
      // 내 정치력을 현재 누적 포인트에 맞춰 동기화한다 (가벼운 트랜잭션).
      const myPower = Math.max(0, Number(user.totalPoints || user.points || 0));
      await db.runTransaction(async tx => {
        const mRef = memberRef(myPartyId, uid);
        const pRef = partyRef(myPartyId);
        const [mSnap, pSnap] = await Promise.all([tx.get(mRef), tx.get(pRef)]);
        if (!pSnap.exists) return;
        const oldPower = mSnap.exists ? Number(mSnap.data().power || 0) : 0;
        const delta = myPower - oldPower;
        tx.set(mRef, { ...publicMember(uid, user), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (delta !== 0) tx.update(pRef, { totalPower: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() });
      });
      me = { partyId: myPartyId, partyName: PARTY_BY_ID[myPartyId].name, power: myPower };
    } else {
      me = { partyId: null, partyName: null, power: Math.max(0, Number(user.totalPoints || user.points || 0)) };
    }
  }

  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);
  const leaders = await Promise.all(PARTY_IDS.map(topMemberOf));

  const parties = PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? (snaps[i].data() || {}) : {};
    return {
      ...meta,
      memberCount: Number(data.memberCount || 0),
      totalPower: Number(data.totalPower || 0),
      leader: leaders[i], // 당대표(활동 1위) — 없으면 null
    };
  }).sort((a, b) => b.totalPower - a.totalPower || b.memberCount - a.memberCount);

  parties.forEach((p, i) => { p.rank = i + 1; });

  return { ok: true, parties, me };
});

// ── 당원 목록(정치력 순) ──
exports.getPartyMembers = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const partyId = assertPartyId(request.data && request.data.partyId);
  const q = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(30).get();
  const members = q.docs.map((d, i) => {
    const m = d.data() || {};
    return { rank: i + 1, nickname: m.nickname || '시민', icon: m.icon || null, power: Number(m.power || 0) };
  });
  return { ok: true, partyId, party: PARTY_BY_ID[partyId], members };
});

// ── 입당 / 정당 변경 ──
exports.joinParty = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const newPartyId = assertPartyId(request.data && request.data.partyId);
  await ensureParties();

  const userRef = db.doc(`users/${uid}`);

  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const oldPartyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    if (oldPartyId === newPartyId) return { changed: false, partyId: newPartyId };

    const power = Math.max(0, Number(user.totalPoints || user.points || 0));
    const newPRef = partyRef(newPartyId);
    const newMRef = memberRef(newPartyId, uid);

    // 읽기 먼저
    const newPSnap = await tx.get(newPRef);
    if (!newPSnap.exists) throw new HttpsError('failed-precondition', '정당 정보가 아직 준비되지 않았습니다.');

    let oldPSnap = null, oldMSnap = null, oldPRef = null, oldMRef = null;
    if (oldPartyId) {
      oldPRef = partyRef(oldPartyId);
      oldMRef = memberRef(oldPartyId, uid);
      [oldPSnap, oldMSnap] = await Promise.all([tx.get(oldPRef), tx.get(oldMRef)]);
    }

    // 쓰기
    if (oldPartyId && oldMSnap && oldMSnap.exists) {
      const oldPower = Number(oldMSnap.data().power || 0);
      tx.delete(oldMRef);
      tx.update(oldPRef, {
        memberCount: FieldValue.increment(-1),
        totalPower: FieldValue.increment(-oldPower),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(newMRef, { ...publicMember(uid, user), power, joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(newPRef, {
      memberCount: FieldValue.increment(1),
      totalPower: FieldValue.increment(power),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, { partyId: newPartyId, partyJoinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    return { changed: true, partyId: newPartyId, switched: !!oldPartyId };
  });

  return { ok: true, ...result, party: PARTY_BY_ID[newPartyId] };
});

// ── 탈당 ──
exports.leaveParty = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const userRef = db.doc(`users/${uid}`);

  const result = await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', '회원 정보를 찾을 수 없습니다.');
    const user = userSnap.data() || {};
    const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
    if (!partyId) return { left: false };

    const pRef = partyRef(partyId);
    const mRef = memberRef(partyId, uid);
    const mSnap = await tx.get(mRef);
    const power = mSnap.exists ? Number(mSnap.data().power || 0) : 0;

    if (mSnap.exists) tx.delete(mRef);
    tx.update(pRef, {
      memberCount: FieldValue.increment(mSnap.exists ? -1 : 0),
      totalPower: FieldValue.increment(-power),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, { partyId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { left: true };
  });

  return { ok: true, ...result };
});

// ──────────────────────────────────────────────
//  대통령 선거 — 매주(월요일~일요일) 7개 정당 후보로 진행
//  후보 = 당대표(당내 정치력 1위 인간) / 없으면 AI 정치인이 후보
//  유저가 없어도 항상 후보가 존재해 매주 대통령이 선출된다.
// ──────────────────────────────────────────────

// 이번 주(KST 월요일 기준) / 다음 주 / 지난 주 키
function weekPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date());
  const o = {}; parts.forEach(p => { o[p.type] = p.value; });
  const wmap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const off = (wmap[o.weekday] + 6) % 7; // 월요일로부터 지난 일수
  const base = Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day));
  const monMs = base - off * 86400000;
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  return { key: iso(monMs), endKey: iso(monMs + 7 * 86400000), prevKey: iso(monMs - 7 * 86400000) };
}

// 7개 정당 후보 스냅샷 (정치력 순)
async function buildCandidates() {
  await ensureParties();
  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);
  const leaders = await Promise.all(PARTY_IDS.map(topMemberOf));
  return PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? (snaps[i].data() || {}) : {};
    const leader = leaders[i];
    const hasHuman = leader && leader.power > 0;
    return {
      partyId: meta.id, partyName: meta.name, emoji: meta.emoji, color: meta.color,
      candidateName: hasHuman ? leader.nickname : meta.leaderName,
      candidateUid: hasHuman ? (leader.uid || null) : null,
      isAI: !hasHuman,
      power: Number(data.totalPower || 0),
    };
  }).sort((a, b) => b.power - a.power);
}

// 대통령 포고령 생성 프롬프트
function buildDecreePrompt(winner) {
  const party = PARTY_BY_ID[winner.partyId] || {};
  const role = PARTY_ROLES[winner.partyId] || '대통령 캐릭터에 맞게';
  return `소소공화국 대통령 선거에서 ${party.name}(${party.emoji}) 후보 "${winner.candidateName}"이 당선됐습니다.

당선자의 첫 번째 대통령 포고령을 작성하세요.
캐릭터: ${role}
정당 슬로건: "${party.slogan}"
- 1~2문장, 구체적·재미있게, 한국어
- 당의 핵심 정책을 반영한 취임 선언 스타일

JSON으로만 응답: {"decree":"포고령 내용"}`;
}

// 포고령 생성 (비동기 fire-and-forget, 게임플로우 차단 안 함)
async function generateDecreeFor(periodId, winner) {
  const ref = db.doc(`elections/${periodId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().decree) return;
  try {
    const raw = await callAI(buildDecreePrompt(winner), 300);
    const parsed = safeParseJson(raw);
    const decree = parsed && parsed.decree ? String(parsed.decree).trim().slice(0, 200) : null;
    if (decree) await ref.update({ decree, updatedAt: FieldValue.serverTimestamp() });
  } catch (e) {
    console.error('[decree] AI error', e);
  }
}

async function finalizeElection(periodId) {
  const ref = db.doc(`elections/${periodId}`);
  let justClosed = false, closedWinner = null;
  await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) return;
    const d = s.data() || {};
    if (d.status === 'closed') return;
    const cands = d.candidates || [];
    const votes = d.votes || {};
    let win = null, best = -1;
    cands.forEach(c => {
      const v = Number(votes[c.partyId] || 0);
      if (v > best) { best = v; win = c; } // 동률 시 정치력 상위(후보 정렬 순) 우선
    });
    tx.update(ref, {
      status: 'closed',
      winnerPartyId: win ? win.partyId : null,
      winner: win || null,
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    justClosed = true; closedWinner = win;
  });
  // 트랜잭션 완료 후 포고령 생성 (비동기, 실패 무시)
  if (justClosed && closedWinner) generateDecreeFor(periodId, closedWinner).catch(() => {});
}

// 이번 주 선거 보장 + 지난 주 선거 마감 처리
async function ensureElection() {
  const { key, endKey, prevKey } = weekPeriod();
  const ref = db.doc(`elections/${key}`);
  const snap = await ref.get();
  if (!snap.exists) {
    const candidates = await buildCandidates();
    await ref.set({
      periodId: key, status: 'open', startKey: key, endKey,
      candidates, votes: {}, totalVotes: 0,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await finalizeElection(prevKey); // 지난 주 당선자 확정
  }
  return key;
}

// ── 현재 선거 현황 + 현 대통령 ──
exports.getElection = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const key = await ensureElection();
  const { prevKey } = weekPeriod();
  const uid = request.auth && request.auth.uid;

  const ref = db.doc(`elections/${key}`);
  const snap = await ref.get();
  const d = snap.data() || {};
  const votes = d.votes || {};
  const candidates = (d.candidates || []).map(c => ({ ...c, votes: Number(votes[c.partyId] || 0) }));

  let myVote = null;
  if (uid) {
    const b = await ref.collection('ballots').doc(uid).get();
    if (b.exists) myVote = b.data().partyId || null;
  }

  let president = null;
  const prevSnap = await db.doc(`elections/${prevKey}`).get();
  if (prevSnap.exists && prevSnap.data().status === 'closed' && prevSnap.data().winner) {
    const d = prevSnap.data();
    president = { ...d.winner, decree: d.decree || null, periodId: prevKey };
  }

  return {
    ok: true,
    election: { periodId: key, endKey: d.endKey, totalVotes: Number(d.totalVotes || 0), candidates, myVote },
    president,
  };
});

// ── 대통령 후보 투표 (1인 1표) ──
exports.voteForPresident = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUid(request);
  const partyId = assertPartyId(request.data && request.data.partyId);
  const key = await ensureElection();
  const ref = db.doc(`elections/${key}`);

  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('failed-precondition', '선거가 준비되지 않았습니다.');
    const d = s.data() || {};
    if (d.status !== 'open') throw new HttpsError('failed-precondition', '종료된 선거입니다.');
    if (!(d.candidates || []).some(c => c.partyId === partyId)) {
      throw new HttpsError('invalid-argument', '후보 정당이 아닙니다.');
    }
    const ballotRef = ref.collection('ballots').doc(uid);
    const b = await tx.get(ballotRef);
    if (b.exists) throw new HttpsError('failed-precondition', '이미 투표했습니다.');
    tx.set(ballotRef, { partyId, createdAt: FieldValue.serverTimestamp() });
    tx.update(ref, {
      [`votes.${partyId}`]: FieldValue.increment(1),
      totalVotes: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, partyId };
  });
});

// ── 현직 대통령 (홈 화면용 경량 조회) ──
exports.getPresident = onCall({ region: REGION, timeoutSeconds: 10 }, async () => {
  const { prevKey } = weekPeriod();
  const prevSnap = await db.doc(`elections/${prevKey}`).get();
  if (!prevSnap.exists || prevSnap.data().status !== 'closed' || !prevSnap.data().winner) {
    return { president: null };
  }
  const d = prevSnap.data();
  return { president: { ...d.winner, decree: d.decree || null, periodId: prevKey } };
});

// ── 정치력 랭킹 — 전 정당 상위 유저 통합 순위 ──
exports.getRankings = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  await ensureParties();

  // 각 정당 상위 10명씩 수집 후 통합 정렬
  const queries = PARTY_IDS.map(pid =>
    partyRef(pid).collection('members').orderBy('power', 'desc').limit(10).get()
  );
  const results = await Promise.all(queries);

  const seen = new Set();
  const allMembers = [];
  results.forEach((snap, i) => {
    const partyMeta = PARTIES[PARTY_IDS.indexOf(PARTY_IDS[i])];
    snap.docs.forEach(d => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const m = d.data() || {};
      if (Number(m.power || 0) <= 0) return;
      allMembers.push({
        uid: d.id,
        nickname: m.nickname || '시민',
        icon: m.icon || null,
        power: Number(m.power || 0),
        partyId: partyMeta.id,
        partyName: partyMeta.name,
        partyEmoji: partyMeta.emoji,
        partyColor: partyMeta.color,
      });
    });
  });

  allMembers.sort((a, b) => b.power - a.power);
  const top30 = allMembers.slice(0, 30).map((m, i) => ({ ...m, rank: i + 1 }));

  // 정당별 당대표 (이미 상위 1명씩이므로 재활용)
  const leaders = PARTIES.map((meta, i) => {
    const snap = results[PARTY_IDS.indexOf(meta.id)];
    if (!snap || snap.empty) return { ...meta, leader: null };
    const d = snap.docs[0];
    const m = d.data() || {};
    const power = Number(m.power || 0);
    return {
      ...meta,
      leader: power > 0
        ? { uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null, power }
        : null,
    };
  });

  const myUid = request.auth && request.auth.uid;
  const myEntry = myUid ? top30.find(m => m.uid === myUid) || null : null;

  return { top30, leaders, myEntry };
});

// ── 오늘의 정당 활동 — AI가 정당별 한마디 생성 (lazy, 하루 1회) ──
const PARTY_ROLES = {
  national: `너는 18년 경력 3선 국회의원이다. 권위적·느긋한 말투. 관례·선례 강조. 경력 자랑 뉘앙스.`,
  truth:    `너는 구독자 120만 정치 유튜버다. 과장·흥분·충격 말투. 폭로·단독 프레임. 구독 유도.`,
  youth:    `너는 MZ세대 시민운동가다. 반말·SNS체·직설 말투. 기득권 비판. ㅋㅋ·ㄹㅇ·팩폭 자연스럽게.`,
  center:   `너는 여론조사 전문가다. 냉정·분석적·모호한 말투. 퍼센트·통계 활용. 결론은 항상 애매하게.`,
  future:   `너는 여당 공식 대변인이다. 과잉 동조·흥분·아첨 말투. 무조건 긍정적 프레임.`,
  rights:   `너는 탐사 기자다. 침착하고 날카로운 말투. 내부 제보·문서 프레임. 사실 추적.`,
  justice:  `너는 검사 출신 변호사다. 딱딱하고 원칙적인 말투. 법적 근거 강조. 무관용 원칙.`,
};

function buildActivityPrompt(topic) {
  const entries = PARTIES.map(p => `- partyId: "${p.id}" (${p.name}, ${p.emoji})\n  역할: ${PARTY_ROLES[p.id]}`).join('\n');
  return `오늘의 소소공화국 정치 이슈: "${topic}"

아래 7명의 정치인이 각자의 캐릭터로 이 이슈에 한마디 합니다.
각 발언은 1~2문장, 캐릭터에 완전히 충실하게, 한국어로.

${entries}

JSON 배열로만 응답하세요 (다른 텍스트 금지):
[{"partyId":"national","text":"..."},{"partyId":"truth","text":"..."},{"partyId":"youth","text":"..."},{"partyId":"center","text":"..."},{"partyId":"future","text":"..."},{"partyId":"rights","text":"..."},{"partyId":"justice","text":"..."}]`;
}

const DAILY_TOPICS = [
  '오늘 국회에서 예산안 심의가 진행됐다',
  '여론조사에서 지지율 변동이 나타났다',
  '유명 정치인의 발언이 논란을 일으켰다',
  '정당 간 정책 대결이 뜨겁게 달아올랐다',
  '선거구 개편안을 둘러싼 공방이 벌어졌다',
  '소소공화국의 미래 방향성을 놓고 갑론을박이 벌어졌다',
  '국민 청원 상위권 이슈가 공개됐다',
  '정치인 자질 논쟁이 또다시 터졌다',
];

function pickTodayTopic() {
  const today = kstToday();
  const idx = today.replace(/-/g, '').split('').reduce((a, c) => a + Number(c), 0) % DAILY_TOPICS.length;
  return DAILY_TOPICS[idx];
}

exports.getPartyActivities = onCall({ region: REGION, timeoutSeconds: 60 }, async () => {
  const today = kstToday();
  const ref = db.doc(`party_activities/${today}`);
  const snap = await ref.get();

  if (snap.exists) {
    const d = snap.data();
    if (d.activities && d.activities.length === 7) return { activities: d.activities, topic: d.topic, date: today };
  }

  // 중복 생성 방지: generating 플래그 체크
  if (snap.exists && snap.data().generating) return { activities: snap.data().activities || [], topic: snap.data().topic || '', date: today };
  await ref.set({ generating: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  try {
    const topic = pickTodayTopic();
    const raw = await callAI(buildActivityPrompt(topic), 1200);
    const parsed = safeParseJson(raw);
    if (!Array.isArray(parsed) || parsed.length < 7) throw new Error('AI 응답 파싱 실패');

    const activities = parsed.map(item => {
      const party = PARTY_BY_ID[item.partyId];
      if (!party) return null;
      return {
        partyId: party.id, partyName: party.name,
        emoji: party.emoji, color: party.color,
        charName: party.leaderName,
        text: String(item.text || '').trim().slice(0, 200),
      };
    }).filter(Boolean);

    await ref.set({ activities, topic, date: today, generating: false, generatedAt: FieldValue.serverTimestamp() });
    return { activities, topic, date: today };
  } catch (e) {
    await ref.set({ generating: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.error('[getPartyActivities] AI error', e);
    // AI 실패 시 기본 활동 반환 (게임이 멈추지 않도록)
    const topic = pickTodayTopic();
    const fallback = PARTIES.map(p => ({
      partyId: p.id, partyName: p.name, emoji: p.emoji, color: p.color,
      charName: p.leaderName, text: p.slogan + '.',
    }));
    return { activities: fallback, topic, date: today };
  }
});
