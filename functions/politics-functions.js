'use strict';

// politics-functions.js — 소소공화국 정당·입당·정치력 시스템
// 7개 가상 정당(AI 정치인이 이끄는)에 유저가 입당하고, 활동 포인트가 '정치력'이 되어
// 정당 순위와 당대표(당내 활동 1위)가 결정된다. 모든 쓰기는 서버에서만 처리한다.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');

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

// ── AI 정치인 NPC ──
// 실제 유저가 0명이어도 정당·랭킹·당대표·대선후보가 항상 채워지도록 각 정당에 NPC를 시드한다.
// 각 정당 첫 번째 NPC(페르소나)가 최강 → 기본 당대표. 유저가 정치력을 쌓으면 NPC를 제칠 수 있다.
const PARTY_NPCS = Object.freeze({
  national: [
    { name: '김중진', emoji: '🎩', power: 2400 }, { name: '박관록', emoji: '📜', power: 1500 },
    { name: '이원로', emoji: '🏅', power: 900 },  { name: '정선배', emoji: '☕', power: 520 },
    { name: '최고참', emoji: '🗂️', power: 280 },
  ],
  truth: [
    { name: '폭로왕', emoji: '📣', power: 2200 }, { name: '단독맨', emoji: '🎬', power: 1400 },
    { name: '속보러', emoji: '⚡', power: 820 },  { name: '구독요정', emoji: '🔔', power: 480 },
    { name: '댓글픽', emoji: '💬', power: 240 },
  ],
  youth: [
    { name: '갈아엎자', emoji: '🔥', power: 2000 }, { name: '영끌이', emoji: '🚀', power: 1300 },
    { name: '공정좌', emoji: '⚖️', power: 760 },   { name: '이생망', emoji: '😤', power: 440 },
    { name: '팩폭러', emoji: '🥊', power: 220 },
  ],
  center: [
    { name: '김퍼센트', emoji: '📊', power: 2100 }, { name: '박표본', emoji: '🧮', power: 1350 },
    { name: '이오차', emoji: '📈', power: 780 },    { name: '중도층', emoji: '🤔', power: 460 },
    { name: '여론바람', emoji: '🌬️', power: 230 },
  ],
  future: [
    { name: '무조건찬성', emoji: '🙌', power: 1900 }, { name: '박수만', emoji: '👏', power: 1250 },
    { name: '늘긍정', emoji: '😄', power: 720 },      { name: '함께해요', emoji: '🤝', power: 420 },
    { name: '미래로', emoji: '🌈', power: 210 },
  ],
  rights: [
    { name: '김탐사', emoji: '🔦', power: 2050 }, { name: '제보받음', emoji: '📨', power: 1320 },
    { name: '취재중', emoji: '🎙️', power: 750 },  { name: '단독입수', emoji: '📂', power: 450 },
    { name: '팩트체크', emoji: '✅', power: 225 },
  ],
  justice: [
    { name: '법대로', emoji: '⚖️', power: 2300 }, { name: '원칙주의', emoji: '📕', power: 1450 },
    { name: '무관용', emoji: '🚫', power: 850 },   { name: '정의구현', emoji: '🛡️', power: 500 },
    { name: '엄벌해', emoji: '🔨', power: 260 },
  ],
});

function npcMembers(partyId) {
  return (PARTY_NPCS[partyId] || []).map((n, i) => ({
    uid: `npc_${partyId}_${i + 1}`,
    nickname: n.name,
    icon: { type: 'emoji', value: n.emoji },
    power: n.power,
    isNpc: true,
  }));
}

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// 현재 KST 기준 이번 주 월요일 날짜 (YYYY-MM-DD)
function kstMondayKey() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=일, 1=월 … 6=토
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(kst);
  monday.setUTCDate(kst.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
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

// 정당 문서가 없으면 기본 통계로 생성하고, AI NPC 당원을 시드한다 (최초 1회, 멱등).
async function ensureParties() {
  const refs = PARTY_IDS.map(partyRef);
  const snaps = await db.getAll(...refs);

  const batch = db.batch();
  const toSeedNpc = [];
  let dirty = false;

  snaps.forEach((snap, i) => {
    const p = PARTIES[i];
    const data = snap.exists ? (snap.data() || {}) : null;
    if (!snap.exists) {
      batch.set(partyRef(p.id), {
        id: p.id, name: p.name, emoji: p.emoji, color: p.color,
        leaderName: p.leaderName, slogan: p.slogan,
        memberCount: 0, totalPower: 0,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      dirty = true;
    }
    // NPC 미시드 정당은 시드 대상에 추가
    if (!data || !data.npcSeeded) toSeedNpc.push(p.id);
  });

  // AI NPC 당원 시드
  for (const pid of toSeedNpc) {
    const npcs = npcMembers(pid);
    if (!npcs.length) continue;
    let powerSum = 0;
    for (const npc of npcs) {
      powerSum += npc.power;
      batch.set(memberRef(pid, npc.uid), {
        ...npc,
        joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    batch.set(partyRef(pid), {
      npcSeeded: true,
      memberCount: FieldValue.increment(npcs.length),
      totalPower: FieldValue.increment(powerSum),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    dirty = true;
  }

  if (dirty) await batch.commit();
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
    return { uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null, power: Number(m.power || 0), isNpc: !!m.isNpc };
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

  // 어제 정치력 스냅샷 업데이트 (하루 1회)
  const today = kstToday();
  const batch = db.batch();
  let snapshotDirty = false;
  snaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const d = snap.data() || {};
    if (d.powerSnapshotDate !== today) {
      batch.update(partyRef(PARTY_IDS[i]), {
        powerSnapshotDate: today,
        prevDayPower: Number(d.totalPower || 0),
      });
      snapshotDirty = true;
    }
  });
  if (snapshotDirty) batch.commit().catch(() => {});

  const parties = PARTIES.map((meta, i) => {
    const data = snaps[i].exists ? (snaps[i].data() || {}) : {};
    const totalPower = Number(data.totalPower || 0);
    const prevDayPower = Number(data.prevDayPower || 0);
    const powerDiff = prevDayPower > 0 ? totalPower - prevDayPower : 0;
    return {
      ...meta,
      memberCount: Number(data.memberCount || 0),
      totalPower,
      powerDiff,
      leader: leaders[i], // 당대표(활동 1위) — 없으면 null
    };
  }).sort((a, b) => b.totalPower - a.totalPower || b.memberCount - a.memberCount);

  parties.forEach((p, i) => { p.rank = i + 1; });

  return { ok: true, parties, me };
});

// ── 당원 목록(정치력 순) ──
exports.getPartyMembers = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const partyId = assertPartyId(request.data && request.data.partyId);
  const currentWeekKey = kstMondayKey();
  const [powerQ, gainQ] = await Promise.all([
    partyRef(partyId).collection('members').orderBy('power', 'desc').limit(30).get(),
    partyRef(partyId).collection('members').orderBy('weeklyGain', 'desc').limit(3).get(),
  ]);
  const members = powerQ.docs.map((d, i) => {
    const m = d.data() || {};
    return { rank: i + 1, nickname: m.nickname || '시민', icon: m.icon || null, power: Number(m.power || 0) };
  });
  const weeklyStars = gainQ.docs
    .filter(d => {
      const m = d.data() || {};
      return m.weekKey === currentWeekKey && Number(m.weeklyGain || 0) > 0;
    })
    .map(d => {
      const m = d.data() || {};
      return { uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null, weeklyGain: Number(m.weeklyGain || 0) };
    });
  return { ok: true, partyId, party: PARTY_BY_ID[partyId], members, weeklyStars };
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
    // 당대표(당내 1위)가 후보. NPC면 AI 후보로 표기, 실제 유저면 인간 후보.
    const isHuman = leader && leader.power > 0 && !leader.isNpc;
    return {
      partyId: meta.id, partyName: meta.name, emoji: meta.emoji, color: meta.color,
      candidateName: leader ? leader.nickname : meta.leaderName,
      candidateUid: isHuman ? (leader.uid || null) : null,
      isAI: !isHuman,
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
  if (justClosed && closedWinner) {
    generateDecreeFor(periodId, closedWinner).catch(() => {});
    // 인간 당대표가 대통령 당선 시 알림
    if (closedWinner.candidateUid) {
      db.collection('notifications').add({
        userId: closedWinner.candidateUid,
        type: 'president',
        title: `🎉 대통령 당선!`,
        body: `${closedWinner.candidateName}님이 소소공화국 대통령으로 선출됐어요! 포고령을 발표하세요.`,
        partyId: closedWinner.partyId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
  }
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

    // 지난 주 선거가 있으면 마감, 없으면 초기 대통령을 무투표 당선으로 시드
    // (유저가 0명이어도 1주차부터 현직 대통령이 존재하도록)
    const prevRef = db.doc(`elections/${prevKey}`);
    const prevSnap = await prevRef.get();
    if (prevSnap.exists) {
      await finalizeElection(prevKey);
    } else {
      const winner = candidates[0] || null; // 정치력 1위 정당 후보
      await prevRef.set({
        periodId: prevKey, status: 'closed', startKey: prevKey, endKey: key,
        candidates, votes: {}, totalVotes: 0, seeded: true,
        winnerPartyId: winner ? winner.partyId : null, winner: winner || null,
        createdAt: FieldValue.serverTimestamp(), closedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (winner) generateDecreeFor(prevKey, winner).catch(() => {});
    }
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
  const pledges = d.pledges || {};
  const candidates = (d.candidates || []).map(c => ({ ...c, votes: Number(votes[c.partyId] || 0), pledge: pledges[c.partyId] || null }));

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
    // Award +5 political power for election vote
    const awardRef = db.doc(`point_awards/${uid}_election_vote_${key}`);
    const userRef = db.doc(`users/${uid}`);
    tx.set(awardRef, { uid, action: 'election_vote', points: 5, weekKey: key, createdAt: FieldValue.serverTimestamp() }, { merge: false });
    tx.set(userRef, { totalPoints: FieldValue.increment(5), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, partyId };
  });
});

// ── 내 정치 현황 (홈 대시보드용 경량 조회) ──
exports.getMyStatus = onCall({ region: REGION, timeoutSeconds: 10 }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) return { loggedIn: false };

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : {};
  const power = Math.max(0, Number(user.totalPoints || user.points || 0));
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  const party = partyId ? PARTY_BY_ID[partyId] : null;

  // 당내 순위 (당원일 때만, 경량: 상위 30명 중 내 위치)
  let partyRank = null, isLeader = false;
  if (partyId) {
    try {
      const q = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(30).get();
      const ids = q.docs.map(d => d.id);
      const i = ids.indexOf(uid);
      if (i >= 0) { partyRank = i + 1; isLeader = i === 0; }
    } catch {}
  }

  // 이번 주 대선 투표 여부 + 마감일 (미션 체크리스트용)
  let votedElection = false;
  let electionEndKey = null;
  try {
    const { key, endKey } = weekPeriod();
    const [b, elecSnap] = await Promise.all([
      db.doc(`elections/${key}/ballots/${uid}`).get(),
      db.doc(`elections/${key}`).get(),
    ]);
    votedElection = b.exists;
    electionEndKey = elecSnap.exists ? (elecSnap.data().endKey || endKey) : endKey;
  } catch {}

  // 당대표까지 남은 포인트 (2위 또는 그 이상일 때)
  let pointsToLeader = null;
  if (partyId && partyRank && partyRank > 1) {
    try {
      const leaderSnap = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(1).get();
      if (!leaderSnap.empty) {
        const leaderPower = Number(leaderSnap.docs[0].data().power || 0);
        pointsToLeader = Math.max(0, leaderPower - power + 1);
      }
    } catch {}
  }

  return {
    loggedIn: true,
    power,
    partyId,
    partyName: party ? party.name : null,
    partyEmoji: party ? party.emoji : null,
    partyColor: party ? party.color : null,
    partyRank,
    isLeader,
    votedElection,
    electionEndKey,
    pointsToLeader,
  };
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

// ── 대통령 포고령 직접 작성 ──
exports.setPresidentialDecree = onCall({ region: REGION, timeoutSeconds: 10 }, async request => {
  const uid = requireUid(request);
  const text = String((request.data && request.data.decree) || '').trim();
  if (!text) throw new HttpsError('invalid-argument', '포고령 내용을 입력해주세요.');
  if (text.length > 200) throw new HttpsError('invalid-argument', '포고령은 200자 이내로 작성해주세요.');

  const { prevKey } = weekPeriod();
  const ref = db.doc(`elections/${prevKey}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '현 임기 선거 기록이 없습니다.');
  const d = snap.data() || {};
  if (d.status !== 'closed' || !d.winner) throw new HttpsError('failed-precondition', '현직 대통령이 없습니다.');
  if (d.winner.candidateUid !== uid) throw new HttpsError('permission-denied', '현직 대통령만 포고령을 발표할 수 있어요.');

  await ref.update({ decree: text, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, decree: text };
});

// ── 선거 공약 작성 (당대표 전용) ──
exports.setCampaignPledge = onCall({ region: REGION, timeoutSeconds: 10 }, async request => {
  const uid = requireUid(request);
  const text = String((request.data && request.data.pledge) || '').trim();
  if (!text) throw new HttpsError('invalid-argument', '공약 내용을 입력해주세요.');
  if (text.length > 80) throw new HttpsError('invalid-argument', '공약은 80자 이내로 작성해주세요.');

  const key = await ensureElection();
  const ref = db.doc(`elections/${key}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '현재 선거 기록이 없습니다.');
  const d = snap.data() || {};
  if (d.status === 'closed') throw new HttpsError('failed-precondition', '이미 종료된 선거입니다.');
  const candidate = (d.candidates || []).find(c => c.candidateUid === uid);
  if (!candidate) throw new HttpsError('permission-denied', '이번 선거 후보만 공약을 작성할 수 있어요.');

  await ref.update({ [`pledges.${candidate.partyId}`]: text, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, pledge: text, partyId: candidate.partyId };
});

// ── 선거 지지 선언 (투표한 유저만, 1인 1선언) ──
exports.addElectionEndorsement = onCall({ region: REGION, timeoutSeconds: 15 }, async request => {
  const uid = requireUid(request);
  const text = String((request.data && request.data.text) || '').trim();
  if (!text) throw new HttpsError('invalid-argument', '지지 선언 내용을 입력해주세요.');
  if (text.length > 60) throw new HttpsError('invalid-argument', '지지 선언은 60자 이내로 작성해주세요.');

  const key = await ensureElection();
  const elecRef = db.doc(`elections/${key}`);
  const ballotRef = elecRef.collection('ballots').doc(uid);
  const ballot = await ballotRef.get();
  if (!ballot.exists) throw new HttpsError('failed-precondition', '먼저 투표해야 지지 선언을 남길 수 있어요.');

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : {};
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  const party = partyId ? PARTY_BY_ID[partyId] : null;

  const endorsementRef = elecRef.collection('endorsements').doc(uid);
  await endorsementRef.set({
    uid,
    nickname: String(user.nickname || user.displayName || '시민').slice(0, 20),
    icon: (user.nicknameIcon && typeof user.nicknameIcon === 'object') ? user.nicknameIcon : null,
    partyId: partyId || null,
    partyName: party ? party.name : null,
    partyEmoji: party ? party.emoji : null,
    partyColor: party ? party.color : null,
    votedPartyId: ballot.data().partyId,
    text,
    power: Math.max(0, Number(user.totalPoints || user.points || 0)),
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });
  return { ok: true };
});

exports.getElectionEndorsements = onCall({ region: REGION, timeoutSeconds: 10 }, async () => {
  const key = await ensureElection();
  const snap = await db.doc(`elections/${key}`).collection('endorsements')
    .orderBy('createdAtMs', 'desc').limit(20).get();
  const endorsements = snap.docs.map(d => {
    const m = d.data() || {};
    return {
      uid: d.id,
      nickname: m.nickname || '시민',
      icon: m.icon || null,
      partyEmoji: m.partyEmoji || null,
      partyColor: m.partyColor || null,
      partyName: m.partyName || null,
      votedPartyId: m.votedPartyId || null,
      text: m.text || '',
      power: Number(m.power || 0),
    };
  });
  return { endorsements };
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

  // 이번 주 급부상 정치인 (정당별 주간 증가 상위 5명씩 수집, 전체 top 10)
  const currentWeekKey = kstMondayKey();
  const gainQueries = PARTY_IDS.map(pid =>
    partyRef(pid).collection('members').orderBy('weeklyGain', 'desc').limit(5).get()
  );
  const gainResults = await Promise.all(gainQueries);
  const seenGain = new Set();
  const gainers = [];
  gainResults.forEach((snap, i) => {
    const partyMeta = PARTIES[i];
    snap.docs.forEach(d => {
      if (seenGain.has(d.id)) return;
      const m = d.data() || {};
      const weeklyGain = Number(m.weeklyGain || 0);
      if (weeklyGain <= 0 || m.weekKey !== currentWeekKey) return;
      seenGain.add(d.id);
      gainers.push({
        uid: d.id, nickname: m.nickname || '시민', icon: m.icon || null,
        weeklyGain, power: Number(m.power || 0),
        partyId: partyMeta.id, partyName: partyMeta.name,
        partyEmoji: partyMeta.emoji, partyColor: partyMeta.color,
      });
    });
  });
  gainers.sort((a, b) => b.weeklyGain - a.weeklyGain);
  const topGainers = gainers.slice(0, 10).map((m, i) => ({ ...m, rank: i + 1 }));

  return { top30, leaders, myEntry, topGainers };
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

// ── 소소신문 — AI 일간 정치 뉴스 ──
exports.getDailyNews = onCall({ region: REGION, timeoutSeconds: 60 }, async () => {
  const today = kstToday();
  const ref = db.doc(`daily_news/${today}`);
  const snap = await ref.get();
  if (snap.exists && snap.data().headline) return { ...snap.data(), date: today };
  if (snap.exists && snap.data().generating) return { headline: null, body: null, date: today };

  await ref.set({ generating: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  try {
    const { prevKey } = weekPeriod();

    // 병렬 데이터 수집: 배틀·대통령·정당활동·정당별 랭킹 1위
    const memberQueries = PARTY_IDS.map(pid =>
      partyRef(pid).collection('members').orderBy('power', 'desc').limit(1).get()
    );
    const { key: elecKey } = weekPeriod();
    const [battleSnap, presSnap, actSnap, elecSnap, ...memberSnaps] = await Promise.all([
      db.doc(`battles/${today}`).get(),
      db.doc(`elections/${prevKey}`).get(),
      db.doc(`party_activities/${today}`).get(),
      db.doc(`elections/${elecKey}`).get(),
      ...memberQueries,
    ]);

    // 전체 랭킹 1위
    let topMember = null, topPower = 0;
    memberSnaps.forEach((s, i) => {
      if (!s.empty) {
        const d = s.docs[0].data();
        if (Number(d.power || 0) > topPower) {
          topPower = Number(d.power || 0);
          topMember = { nickname: d.nickname || '시민', partyName: PARTIES[i].name, power: topPower };
        }
      }
    });

    const battle = battleSnap.exists ? battleSnap.data() : null;
    const battleWinner = battle && battle.king
      ? (battle.chars || []).find(c => c.id === battle.king) : null;
    const pres = presSnap.exists && presSnap.data().status === 'closed' ? presSnap.data() : null;
    const actTopic = (actSnap.exists && actSnap.data().topic) ? actSnap.data().topic : pickTodayTopic();

    // 이번 주 대선 선두 후보
    let elecLeader = null;
    if (elecSnap.exists && elecSnap.data().status !== 'closed') {
      const eData = elecSnap.data() || {};
      const cands = eData.candidates || [];
      const votes = eData.votes || {};
      let best = -1;
      cands.forEach(c => {
        const v = Number(votes[c.partyId] || 0);
        if (v > best) { best = v; elecLeader = c; }
      });
      if (best === 0) elecLeader = null;
    }

    const lines = [
      battle ? `정치배틀 이슈: "${battle.topic}"${battleWinner ? ` → ${battleWinner.emoji} ${battleWinner.name} 승리` : ' (진행 중)'}` : null,
      pres && pres.winner ? `현직 대통령: ${pres.winner.candidateName} (${pres.winner.partyName})${pres.decree ? ` / 포고령: "${pres.decree}"` : ''}` : null,
      elecLeader ? `이번 주 대선 선두: ${elecLeader.candidateName} (${elecLeader.partyName}) ${elecLeader.votes || 0}표` : null,
      topMember ? `정치력 1위: ${topMember.nickname} (${topMember.partyName}) ${topMember.power}P` : null,
      `오늘의 이슈: "${actTopic}"`,
    ].filter(Boolean).join('\n');

    const prompt = `소소공화국 일간지 "소소신문" 오늘자 기사를 작성하세요.

오늘의 정보:
${lines}

기사 스타일:
- 선정적·과장된 한국 타블로이드 신문체
- 헤드라인: 클릭 욕구 자극, 15자 내외, 위 정보 중 가장 재미있는 것 활용
- 본문: 2~3문장, 위 정보를 재미있게 버무려서, 소소공화국 세계관 내 이야기

JSON으로만 응답: {"headline":"제목","body":"본문"}`;

    const raw = await callAI(prompt, 400);
    const parsed = safeParseJson(raw);
    if (!parsed || !parsed.headline) throw new Error('파싱 실패');

    const news = {
      headline: String(parsed.headline).trim().slice(0, 60),
      body: String(parsed.body || '').trim().slice(0, 400),
      date: today, generating: false,
      generatedAt: FieldValue.serverTimestamp(),
    };
    await ref.set(news);
    return news;
  } catch (e) {
    await ref.set({ generating: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.error('[getDailyNews] error', e);
    return { headline: null, body: null, date: today };
  }
});

// ── 당원 정치력 동기화 (홈 방문 시 fire-and-forget) ──
exports.syncPartyMemberPower = onCall({ region: REGION, timeoutSeconds: 15 }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) return { ok: false };
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) return { ok: false };
  const user = userSnap.data() || {};
  const partyId = PARTY_BY_ID[user.partyId] ? user.partyId : null;
  if (!partyId) return { ok: false, reason: 'no_party' };
  const newPower = Math.max(0, Number(user.totalPoints || user.points || 0));
  const mRef = memberRef(partyId, uid);
  const mSnap = await mRef.get();
  if (!mSnap.exists) return { ok: false, reason: 'not_member' };
  const mData = mSnap.data() || {};
  const oldPower = Number(mData.power || 0);
  if (oldPower === newPower) return { ok: true, changed: false };
  const diff = newPower - oldPower;

  // 주간 정치력 증가 추적
  const currentWeekKey = kstMondayKey();
  let weeklyFields;
  if (mData.weekKey !== currentWeekKey) {
    // 새 주 시작: 현재 포인트를 주 시작값으로 스냅샷
    weeklyFields = { weekKey: currentWeekKey, weekStartPower: oldPower, weeklyGain: Math.max(0, diff) };
  } else {
    const weekStartPower = Number(mData.weekStartPower || 0);
    weeklyFields = { weeklyGain: Math.max(0, newPower - weekStartPower) };
  }

  const pRef = partyRef(partyId);
  await db.runTransaction(async tx => {
    tx.update(mRef, { power: newPower, ...weeklyFields, updatedAt: FieldValue.serverTimestamp() });
    tx.update(pRef, { totalPower: FieldValue.increment(diff), updatedAt: FieldValue.serverTimestamp() });
  });

  const RANK_THRESHOLDS = [0, 100, 300, 700, 1500, 3000, 6000, 10000];
  const RANK_META = ['', '📢 동네 운동가', '🪧 청년 당원', '🎖️ 당 간부', '🏛️ 지역 위원장', '⚖️ 국회의원', '👔 당 중진', '👑 거물 정치인'];
  function getRankLevel(p) { let l = 1; for (let i = 1; i < RANK_THRESHOLDS.length; i++) { if (p >= RANK_THRESHOLDS[i]) l = i + 1; } return l; }

  const oldLevel = getRankLevel(oldPower);
  const newLevel = getRankLevel(newPower);

  // 등급 상승 알림
  if (newLevel > oldLevel) {
    try {
      const notifKey = `rankup_${uid}_${newLevel}`;
      const notifRef = db.doc(`notifications/${notifKey}`);
      const existing = await notifRef.get();
      if (!existing.exists) {
        await notifRef.set({
          userId: uid,
          type: 'rankup',
          title: `🎉 등급 상승! ${RANK_META[newLevel - 1] || `Lv.${newLevel}`}`,
          body: `축하해요! 정치력 ${newPower.toLocaleString()}P로 새 등급에 도달했어요.`,
          rankLevel: newLevel,
          power: newPower,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch {}
  }

  // 당대표 등극 알림 (1위 → 처음 달성 시, 비동기)
  try {
    const top = await partyRef(partyId).collection('members').orderBy('power', 'desc').limit(1).get();
    if (!top.empty && top.docs[0].id === uid) {
      const party = PARTY_BY_ID[partyId];
      const weekKey = kstToday().slice(0, 7); // YYYY-MM
      const notifKey = `leader_${uid}_${partyId}_${weekKey}`;
      const notifRef = db.doc(`notifications/${notifKey}`);
      const existing = await notifRef.get();
      if (!existing.exists) {
        await notifRef.set({
          userId: uid,
          type: 'leader',
          title: `👑 ${party?.name || partyId} 당대표 등극!`,
          body: `정치력 1위로 당대표가 되셨어요. 이번 주 대선에 후보로 자동 출마됩니다!`,
          partyId,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }
  } catch {}

  return { ok: true, changed: true, oldPower, newPower };
});

// ── 유저 정치 활동 통계 (계정 통계 탭용) ──
exports.getUserPoliticsStats = onCall({ region: REGION, timeoutSeconds: 15 }, async request => {
  const uid = request.auth && request.auth.uid;
  if (!uid) return { loggedIn: false };

  const [userSnap, battleCountSnap, electionCountSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection('point_awards')
      .where(FieldPath.documentId(), '>=', `${uid}_battle_vote_`)
      .where(FieldPath.documentId(), '<', `${uid}_battle_vote_￿`)
      .count().get().catch(() => null),
    db.collection('point_awards')
      .where(FieldPath.documentId(), '>=', `${uid}_election_vote_`)
      .where(FieldPath.documentId(), '<', `${uid}_election_vote_￿`)
      .count().get().catch(() => null),
  ]);

  const user = userSnap.exists ? (userSnap.data() || {}) : {};
  const battleVotes = battleCountSnap ? battleCountSnap.data().count : 0;
  const electionVotes = electionCountSnap ? electionCountSnap.data().count : 0;

  return {
    loggedIn: true,
    battleVotes,
    electionVotes,
    streak: Number(user.streak || 0),
    maxStreak: Number(user.maxStreak || user.streak || 0),
    signupDate: user.createdAt ? user.createdAt.toDate().toISOString().slice(0, 10) : null,
  };
});

// ── 주간 정당 당론 성명 (AI 생성, 정당별 1회) ──
const MANIFESTO_VOICES = {
  national: `너는 국민안정당 3선 의원이다. 권위 있고 느긋한 어투. 안정과 경험을 강조. 한두 문장.`,
  truth:    `너는 진실방송당 정치 유튜버다. 과장되고 자극적인 어투. 폭로·단독 프레임. 한두 문장.`,
  youth:    `너는 청년혁명당 MZ 운동가다. 반말·직설·팩폭 스타일. 기득권 비판. 한두 문장.`,
  center:   `너는 중도민주당 여론조사 전문가다. 냉정·분석적. 통계 자주 언급. 결론은 애매하게. 한두 문장.`,
  future:   `너는 함께미래당 대변인이다. 과잉 긍정·동조. 화합·미래 강조. 한두 문장.`,
  rights:   `너는 알권리당 탐사 기자다. 침착하고 날카롭게. 내부 제보 프레임. 한두 문장.`,
  justice:  `너는 법치정의당 검사 출신 변호사다. 딱딱하고 원칙적. 법 근거 강조. 한두 문장.`,
};

exports.getPartyManifesto = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const partyId = assertPartyId(request.data && request.data.partyId);
  const { key: weekKey } = weekPeriod();
  const refKey = `${weekKey}_${partyId}`;
  const ref = db.doc(`party_manifestos/${refKey}`);
  const snap = await ref.get();

  if (snap.exists && snap.data().text) return { manifesto: snap.data().text, partyId, weekKey };
  if (snap.exists && snap.data().generating) return { manifesto: null, partyId, weekKey };

  await ref.set({ generating: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  try {
    // 현재 정세 수집
    const [partySnap, elecSnap, battleSnap] = await Promise.all([
      partyRef(partyId).get(),
      db.doc(`elections/${weekKey}`).get(),
      db.doc(`battles/${kstToday()}`).get(),
    ]);

    const pData = partySnap.exists ? partySnap.data() : {};
    const party = PARTY_BY_ID[partyId];

    // 전체 정당 순위 파악
    const refs = PARTY_IDS.map(partyRef);
    const allSnaps = await db.getAll(...refs);
    const ranked = allSnaps
      .map((s, i) => ({ id: PARTY_IDS[i], power: Number((s.exists ? s.data().totalPower : 0) || 0) }))
      .sort((a, b) => b.power - a.power);
    const myRank = ranked.findIndex(p => p.id === partyId) + 1;

    const elecData = elecSnap.exists ? elecSnap.data() : {};
    const votes = elecData.votes || {};
    const myCandVotes = votes[partyId] || 0;
    const totalVotes = elecData.totalVotes || 0;

    const battleData = battleSnap.exists ? battleSnap.data() : {};
    const battleTopic = battleData.topic || '정치 현안';

    const context = [
      `현재 ${party.name}은 정치력 ${myRank}위 (전체 ${PARTY_IDS.length}개 정당 중)`,
      totalVotes > 0 ? `이번 주 대선 투표: ${myCandVotes}표/${totalVotes}표 (${Math.round(myCandVotes/totalVotes*100)}%)` : '이번 주 대선 진행 중',
      `오늘 배틀 이슈: "${battleTopic}"`,
    ].join('. ');

    const voice = MANIFESTO_VOICES[partyId] || `너는 ${party.name} 대변인이다. 한두 문장.`;
    const prompt = `${voice}

이번 주 소소공화국 정세: ${context}

이 상황에 대한 ${party.name}의 공식 입장 성명을 한두 문장으로 발표하세요. 캐릭터에 완전히 충실하게.

JSON으로만 응답: {"text":"성명 내용"}`;

    const raw = await callAI(prompt, 200);
    const parsed = safeParseJson(raw);
    if (!parsed || !parsed.text) throw new Error('파싱 실패');

    const text = String(parsed.text).trim().slice(0, 150);
    await ref.set({ text, partyId, weekKey, generating: false, generatedAt: FieldValue.serverTimestamp() });
    return { manifesto: text, partyId, weekKey };
  } catch (e) {
    await ref.set({ generating: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.error('[getPartyManifesto] error', e);
    return { manifesto: null, partyId, weekKey };
  }
});

// ── 역대 대통령 선거 기록 ──
exports.getElectionHistory = onCall({ region: REGION, timeoutSeconds: 15 }, async () => {
  const snap = await db.collection('elections')
    .where('status', '==', 'closed')
    .orderBy('periodId', 'desc')
    .limit(10)
    .get();

  const history = snap.docs
    .map(d => {
      const data = d.data();
      if (!data.winner) return null;
      return {
        periodId: d.id,
        endKey: data.endKey || null,
        winner: data.winner,
        decree: data.decree || null,
        totalVotes: Number(data.totalVotes || 0),
        votes: data.votes || {},
        seeded: data.seeded || false,
      };
    })
    .filter(Boolean);

  return { history };
});
