'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MAX_PLAYERS = 10;
const MIN_PLAYERS = 5;
const AI = [
  ['minsu', '민수', '😂', '드립왕'],
  ['daon', '다온', '❤️', '상담러'],
  ['jieun', '지은', '🧠', '분석가'],
  ['junho', '준호', '⚖️', '토론러'],
  ['miyoung', '미영', '👵', '인생선배'],
  ['cheolgu', '철구', '😈', '장난꾸러기'],
  ['haru', '하루', '🎨', '감성러'],
];
const LABEL = { shadow: '그림자', seer: '조사자', guard: '보호자', citizen: '시민' };

function clean(v, max = 80) { return String(v || '').replace(/[<>]/g, '').replace(/[\n\r\t]+/g, ' ').trim().slice(0, max); }
function uid(req) { if (!req.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.'); return req.auth.uid; }
function name(req) { return clean(req.data?.nickname || req.auth?.token?.name || req.auth?.token?.email?.split('@')[0] || '참가자', 20) || '참가자'; }
function ref(id) { const safe = clean(id); if (!safe) throw new HttpsError('invalid-argument', '방 ID가 없습니다.'); return db.collection('game_rooms').doc(safe); }
function mod(text) { return { speaker: '운영봇', text: clean(text, 240), type: 'moderator', atMs: Date.now() }; }
function speech(name, text, meta = {}) { return { speaker: clean(name, 20), text: clean(text, 240), type: 'ai', atMs: Date.now(), ...meta }; }
function logs(room, add) { return [...(Array.isArray(room.publicLog) ? room.publicLog : []), ...add].slice(-80); }
function shuffle(list) { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
async function room(ref) { const s = await ref.get(); if (!s.exists) throw new HttpsError('not-found', '방을 찾을 수 없습니다.'); return { id: s.id, ...s.data() }; }
async function players(ref) { const s = await ref.collection('players').get(); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
async function roles(ref) { const s = await ref.collection('secrets').doc('roles').collection('items').get(); const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); }); return m; }
function host(r, u) { if (r.hostId !== u) throw new HttpsError('permission-denied', '방장만 실행할 수 있습니다.'); }
function alive(ps) { return ps.filter(p => p.isAlive !== false); }
function team(role) { return role === 'shadow' ? 'shadow' : 'town'; }
function roleSet(n) { const a = Array(n >= 8 ? 2 : 1).fill('shadow'); if (n >= 5) a.push('seer'); if (n >= 6) a.push('guard'); while (a.length < n) a.push('citizen'); return shuffle(a); }
function target(ps, actor = '') { const pool = alive(ps).filter(p => p.id !== actor); const list = pool.length ? pool : alive(ps); return list[Math.floor(Math.random() * list.length)]?.id || ''; }
function top(items) { const t = {}; items.forEach(x => { if (x.targetId) t[x.targetId] = (t[x.targetId] || 0) + 1; }); const s = Object.entries(t).sort((a, b) => b[1] - a[1]); return { id: s[0]?.[0] || '', tie: !!(s[1] && s[0][1] === s[1][1]) }; }
function win(ps, rs) { const live = alive(ps); const s = live.filter(p => rs[p.id]?.role === 'shadow').length; const t = live.length - s; if (s <= 0) return ['town', '시민팀 승리']; if (s >= t) return ['shadow', '그림자팀 승리']; return null; }
function reveal(ps, rs) { const out = {}; ps.forEach(p => { const r = rs[p.id]?.role || 'citizen'; out[p.id] = { name: p.displayName, emoji: p.emoji || '', role: r, roleLabel: LABEL[r], team: team(r), isAlive: p.isAlive !== false }; }); return out; }

async function fillAi(ref, ps, count = MIN_PLAYERS) {
  const list = [...ps]; const seen = new Set(list.map(p => p.id)); const b = db.batch(); let writes = 0;
  for (const row of AI) {
    if (list.length >= count || list.length >= MAX_PLAYERS) break;
    const id = `ai:${row[0]}`;
    if (seen.has(id)) continue;
    const p = { uid: id, type: 'ai', aiId: row[0], displayName: row[1], emoji: row[2], roleName: row[3], isAlive: true, isHost: false, joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    b.set(ref.collection('players').doc(id), p, { merge: true }); writes += 1;
    list.push({ id, ...p }); seen.add(id);
  }
  if (writes > 0) await b.commit();
  return list;
}

function assignRolesBatch(r, ps, b) {
  const set = roleSet(ps.length);
  const order = shuffle(ps);
  order.forEach((p, i) => {
    const role = set[i];
    b.set(r.collection('secrets').doc('roles').collection('items').doc(p.id), { uid: p.uid || p.id, role, roleLabel: LABEL[role], team: team(role), lastResult: null, assignedAt: FieldValue.serverTimestamp() }, { merge: true });
    b.set(r.collection('players').doc(p.id), { isAlive: true, eliminatedAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

async function startRoomNow(r, ps, mode = 'invite') {
  const b = db.batch();
  assignRolesBatch(r, ps, b);
  const intro = mode === 'solo'
    ? [mod('혼자 추리방을 시작합니다. 모든 참가자에게 역할을 비공개로 배정했습니다.'), mod('1일차 밤입니다. 본인의 역할을 확인하고 가능한 밤 행동을 선택하세요.')]
    : [mod('게임을 시작합니다. 역할은 각자에게만 공개됩니다.'), mod('밤입니다. 그림자·조사자·보호자는 비공개 행동을 선택하세요.')];
  b.update(r, { status: 'playing', phase: 'night', phaseLabel: '1일차 밤', day: 1, playerCount: ps.length, aliveCount: ps.length, publicLog: intro, updatedAt: FieldValue.serverTimestamp() });
  await b.commit();
}

exports.createRoleRoom = onCall({ region: REGION, timeoutSeconds: 60 }, async req => {
  const u = uid(req); const n = name(req); const r = db.collection('game_rooms').doc(); const now = FieldValue.serverTimestamp();
  await r.set({ type: 'shadow_room', title: '친구와 추리방', hostId: u, hostName: n, status: 'lobby', phase: 'lobby', phaseLabel: '대기실', day: 0, playerCount: 1, aliveCount: 1, maxPlayers: MAX_PLAYERS, playMode: 'invite', publicLog: [mod('추리방이 열렸습니다. 링크로 친구를 초대하세요.')], createdAt: now, updatedAt: now });
  await r.collection('players').doc(u).set({ uid: u, type: 'user', displayName: n, emoji: '🙂', isAlive: true, isHost: true, joinedAt: now, updatedAt: now });
  return { ok: true, roomId: r.id };
});

exports.createSoloRoleRoom = onCall({ region: REGION, timeoutSeconds: 90 }, async req => {
  const u = uid(req); const n = name(req); const r = db.collection('game_rooms').doc(); const now = FieldValue.serverTimestamp();
  await r.set({ type: 'shadow_room', title: '혼자 추리방', hostId: u, hostName: n, status: 'lobby', phase: 'lobby', phaseLabel: '대기실', day: 0, playerCount: 1, aliveCount: 1, maxPlayers: MAX_PLAYERS, playMode: 'solo', publicLog: [mod('혼자 추리방을 준비합니다.')], createdAt: now, updatedAt: now });
  await r.collection('players').doc(u).set({ uid: u, type: 'user', displayName: n, emoji: '🙂', isAlive: true, isHost: true, joinedAt: now, updatedAt: now });
  const ps = await fillAi(r, await players(r), 8);
  await startRoomNow(r, ps, 'solo');
  return { ok: true, roomId: r.id, playerCount: ps.length, started: true };
});

exports.joinRoleRoom = onCall({ region: REGION, timeoutSeconds: 60 }, async req => {
  const u = uid(req); const r = ref(req.data?.roomId); const ro = await room(r); if (ro.status === 'ended') throw new HttpsError('failed-precondition', '종료된 방입니다.');
  const ps = await players(r); const existing = ps.some(p => p.id === u);
  if (!existing && ro.status !== 'lobby') throw new HttpsError('failed-precondition', '이미 시작된 방에는 새로 참가할 수 없습니다.');
  if (!existing && ps.length >= MAX_PLAYERS) throw new HttpsError('resource-exhausted', '방이 가득 찼습니다.');
  const n = name(req); await r.collection('players').doc(u).set({ uid: u, type: 'user', displayName: n, emoji: '🙂', isAlive: true, isHost: ro.hostId === u, joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const np = await players(r); await r.update({ playerCount: np.length, publicLog: logs(ro, [mod(`${n}님이 입장했습니다.`)]), updatedAt: FieldValue.serverTimestamp() }); return { ok: true };
});

exports.addRoleAi = onCall({ region: REGION, timeoutSeconds: 60 }, async req => {
  const u = uid(req); const r = ref(req.data?.roomId); const ro = await room(r); host(ro, u); if (ro.status !== 'lobby') throw new HttpsError('failed-precondition', '대기실에서만 추가할 수 있습니다.');
  const ps = await fillAi(r, await players(r), Math.min(MAX_PLAYERS, Number(req.data?.targetCount || 8))); await r.update({ playerCount: ps.length, publicLog: logs(ro, [mod('AI 참가자를 추가했습니다.')]), updatedAt: FieldValue.serverTimestamp() }); return { ok: true, playerCount: ps.length };
});

exports.startRoleRoom = onCall({ region: REGION, timeoutSeconds: 90 }, async req => {
  const u = uid(req); const r = ref(req.data?.roomId); const ro = await room(r); host(ro, u); if (ro.status !== 'lobby') throw new HttpsError('failed-precondition', '이미 시작된 방입니다.');
  let ps = await fillAi(r, await players(r), MIN_PLAYERS); if (ps.length < MIN_PLAYERS) throw new HttpsError('failed-precondition', '최소 5명이 필요합니다.');
  await startRoomNow(r, ps, 'invite');
  return { ok: true, playerCount: ps.length };
});

exports.getRoleRoomRole = onCall({ region: REGION, timeoutSeconds: 30 }, async req => {
  const u = uid(req); const r = ref(req.data?.roomId); await room(r); const p = await r.collection('players').doc(u).get(); if (!p.exists) throw new HttpsError('permission-denied', '참가자만 역할을 볼 수 있습니다.');
  const s = await r.collection('secrets').doc('roles').collection('items').doc(u).get(); if (!s.exists) return { ok: true, assigned: false }; return { ok: true, assigned: true, ...s.data() };
});

exports.actRoleNight = onCall({ region: REGION, timeoutSeconds: 60 }, async req => {
  const u = uid(req); const r = ref(req.data?.roomId); const targetId = clean(req.data?.targetId); const ro = await room(r); if (ro.phase !== 'night') throw new HttpsError('failed-precondition', '밤 단계가 아닙니다.');
  const p = await r.collection('players').doc(u).get(); const t = await r.collection('players').doc(targetId).get(); if (!p.exists || p.data().isAlive === false) throw new HttpsError('permission-denied', '행동할 수 없습니다.'); if (!t.exists || t.data().isAlive === false) throw new HttpsError('invalid-argument', '대상을 선택할 수 없습니다.');
  const s = await r.collection('secrets').doc('roles').collection('items').doc(u).get(); const role = s.data()?.role || 'citizen'; if (!['shadow', 'seer', 'guard'].includes(role)) throw new HttpsError('permission-denied', '밤 행동이 없는 역할입니다.');
  await r.collection('night_actions').doc(String(ro.day)).collection('items').doc(u).set({ actorId: u, role, targetId, createdAt: FieldValue.serverTimestamp() }, { merge: true }); return { ok: true };
});

async function fillAiNight(r, ro, ps, rs) {
  const c = r.collection('night_actions').doc(String(ro.day)).collection('items'); const has = new Set((await c.get()).docs.map(d => d.id)); const b = db.batch(); let writes = 0;
  alive(ps).filter(p => p.type === 'ai').forEach(p => { const role = rs[p.id]?.role; if (has.has(p.id) || !['shadow', 'seer', 'guard'].includes(role)) return; b.set(c.doc(p.id), { actorId: p.id, role, targetId: target(ps, p.id), auto: true, createdAt: FieldValue.serverTimestamp() }, { merge: true }); writes += 1; });
  if (writes > 0) await b.commit();
}

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function suspectName(ps, speaker, out) {
  const pool = alive(ps).filter(p => p.id !== speaker.id && p.id !== out?.id);
  return (pool[Math.floor(Math.random() * pool.length)] || pool[0] || alive(ps)[0] || {}).displayName || '누군가';
}
function aiLineFor(p, ps, rs, out, day) {
  const role = rs[p.id]?.role || 'citizen';
  const suspect = suspectName(ps, p, out);
  const eliminated = out?.displayName || '탈락자';
  const common = {
    minsu: [`확신은 못 하겠는데 ${suspect}님 반응이 살짝 늦었음. 그냥 느낌임ㅋㅋ`, `나 지금 찍으면 손해일 수도 있음. 일단 말 더 들어보자.`],
    daon: [`저는 ${suspect}님 말투가 갑자기 조심스러워진 게 걸려요.`, `아직 단정은 못 하겠어요. 너무 빨리 몰아가면 오히려 헷갈릴 듯해요.`],
    jieun: [`밤 결과만 보면 단정하기 어렵습니다. ${suspect}님 발언 변화부터 보겠습니다.`, `${eliminated}님과 대화가 엮였던 사람을 먼저 보는 게 합리적입니다.`],
    junho: [`지금은 한 명 몰아가기보다 근거를 모아야 합니다. ${suspect}님 의견부터 듣죠.`, `투표 전에 각자 의심 이유를 하나씩 말하는 게 좋겠습니다.`],
    miyoung: [`이런 건 너무 앞장서는 사람도, 너무 숨는 사람도 다 봐야 해요.`, `${suspect}님이 수상하긴 한데 아직 확정할 정도는 아니에요.`],
    cheolgu: [`나 또 몰아가려고? 그렇게 쉬우면 게임이 아니지. ${suspect}도 좀 봐라.`, `내가 그림자면 이렇게 말하겠냐? 너무 뻔하게 몰지 마.`],
    haru: [`분위기가 갑자기 차가워졌어요. ${suspect}님 반응이 좀 남아요.`, `저는 말보다 침묵이 더 신경 쓰여요.`],
  };
  const shadow = {
    minsu: [`그림자면 지금 티 안 내려고 더 조용할 듯. ${suspect}님 쪽 한번 보자.`, `나보다 ${suspect}님 흐름이 더 이상한데?`],
    daon: [`저를 의심해도 되는데, 지금은 ${suspect}님 반응이 더 급해 보여요.`, `확신 없이 몰면 시민팀만 손해일 수 있어요.`],
    jieun: [`탈락 결과만으로 그림자를 특정하면 위험합니다. ${suspect}님 방어 논리부터 확인하죠.`, `정보가 적을수록 감정 몰표는 피해야 합니다.`],
    junho: [`지금 결론 내리면 그림자에게 휘둘립니다. ${suspect}님에게 질문해보죠.`, `저는 아직 보류입니다. 근거 없는 몰표는 반대합니다.`],
    miyoung: [`너무 티 나는 사람보다 자연스럽게 묻어가는 사람이 더 무서운 법이에요.`, `${suspect}님이 조용히 넘어가려는 게 마음에 걸려요.`],
    cheolgu: [`그래 나 수상하지? 근데 너무 쉬운 답 같지 않냐? ${suspect}도 봐.`, `나 잡고 끝날 것 같으면 잡아봐. 근데 후회할 수도 있음.`],
    haru: [`지금 제일 큰 소리 나는 쪽보다 조용히 방향 바꾸는 사람이 보여요.`, `${suspect}님 말이 묘하게 안전한 말만 해요.`],
  };
  const source = role === 'shadow' ? shadow[p.aiId] || common[p.aiId] : common[p.aiId];
  return speech(p.displayName, pick(source || [`${suspect}님 이야기를 더 들어보고 싶어요.`]), { aiId: p.aiId || '', day });
}
function aiTalkLines(ps, rs, out, day) {
  return shuffle(alive(ps).filter(p => p.type === 'ai')).slice(0, 5).map(p => aiLineFor(p, ps, rs, out, day));
}

exports.finishRoleNight = onCall({ region: REGION, timeoutSeconds: 90 }, async req => {
  const u = uid(req); const r = ref(req.data?.roomId); const ro = await room(r); host(ro, u); if (ro.phase !== 'night') throw new HttpsError('failed-precondition', '밤 단계가 아닙니다.');
  let ps = await players(r); const rs = await roles(r); await fillAiNight(r, ro, ps, rs); const acts = (await r.collection('night_actions').doc(String(ro.day)).collection('items').get()).docs.map(d => d.data());
  const sh = top(acts.filter(a => a.role === 'shadow')).id; const gd = acts.find(a => a.role === 'guard')?.targetId || ''; const seers = acts.filter(a => a.role === 'seer'); const b = db.batch(); const out = sh && sh !== gd ? ps.find(p => p.id === sh) : null;
  if (out) { b.update(r.collection('players').doc(out.id), { isAlive: false, eliminatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); ps = ps.map(p => p.id === out.id ? { ...p, isAlive: false } : p); }
  seers.forEach(a => { const targetPlayer = ps.find(p => p.id === a.targetId); b.set(r.collection('secrets').doc('roles').collection('items').doc(a.actorId), { lastResult: targetPlayer ? { day: ro.day, targetId: targetPlayer.id, targetName: targetPlayer.displayName, isShadow: rs[a.targetId]?.role === 'shadow' } : null }, { merge: true }); });
  const w = win(ps, rs); const add = [mod(out ? `아침입니다. ${out.displayName}님이 탈락했습니다.` : '아침입니다. 밤 사이 탈락자는 없습니다.'), mod('낮 토론을 시작합니다. 참가자들의 발언을 보고 투표 대상을 판단하세요.'), ...aiTalkLines(ps, rs, out, ro.day)]; if (w) add.push(mod(`${w[1]}! 게임이 종료되었습니다.`));
  b.update(r, { status: w ? 'ended' : 'playing', phase: w ? 'ended' : 'day', phaseLabel: w ? '게임 종료' : `${ro.day}일차 낮 토론`, winner: w?.[0] || '', winnerLabel: w?.[1] || '', aliveCount: alive(ps).length, revealedRoles: w ? reveal(ps, rs) : FieldValue.delete(), publicLog: logs(ro, add), updatedAt: FieldValue.serverTimestamp() }); await b.commit(); return { ok: true };
});

exports.openRoleVote = onCall({ region: REGION, timeoutSeconds: 60 }, async req => { const u = uid(req); const r = ref(req.data?.roomId); const ro = await room(r); host(ro, u); if (ro.phase !== 'day') throw new HttpsError('failed-precondition', '낮 토론 단계가 아닙니다.'); await r.update({ phase: 'vote', phaseLabel: `${ro.day}일차 투표`, publicLog: logs(ro, [mod('투표를 시작합니다. 의심되는 참가자를 선택하세요.')]), updatedAt: FieldValue.serverTimestamp() }); return { ok: true }; });

exports.voteRoleDay = onCall({ region: REGION, timeoutSeconds: 60 }, async req => { const u = uid(req); const r = ref(req.data?.roomId); const targetId = clean(req.data?.targetId); const ro = await room(r); if (ro.phase !== 'vote') throw new HttpsError('failed-precondition', '투표 단계가 아닙니다.'); const p = await r.collection('players').doc(u).get(); const t = await r.collection('players').doc(targetId).get(); if (!p.exists || p.data().isAlive === false) throw new HttpsError('permission-denied', '투표할 수 없습니다.'); if (!t.exists || t.data().isAlive === false) throw new HttpsError('invalid-argument', '대상을 선택할 수 없습니다.'); await r.collection('day_votes').doc(String(ro.day)).collection('items').doc(u).set({ actorId: u, targetId, createdAt: FieldValue.serverTimestamp() }, { merge: true }); return { ok: true }; });

async function fillAiVote(r, ro, ps) { const c = r.collection('day_votes').doc(String(ro.day)).collection('items'); const has = new Set((await c.get()).docs.map(d => d.id)); const b = db.batch(); let writes = 0; alive(ps).filter(p => p.type === 'ai').forEach(p => { if (has.has(p.id)) return; b.set(c.doc(p.id), { actorId: p.id, targetId: target(ps, p.id), auto: true, createdAt: FieldValue.serverTimestamp() }, { merge: true }); writes += 1; }); if (writes > 0) await b.commit(); }

exports.finishRoleVote = onCall({ region: REGION, timeoutSeconds: 90 }, async req => {
  const u = uid(req); const r = ref(req.data?.roomId); const ro = await room(r); host(ro, u); if (ro.phase !== 'vote') throw new HttpsError('failed-precondition', '투표 단계가 아닙니다.'); let ps = await players(r); const rs = await roles(r); await fillAiVote(r, ro, ps);
  const votes = (await r.collection('day_votes').doc(String(ro.day)).collection('items').get()).docs.map(d => d.data()); const res = top(votes); const out = !res.tie && res.id ? ps.find(p => p.id === res.id) : null; const b = db.batch();
  if (out) { b.update(r.collection('players').doc(out.id), { isAlive: false, eliminatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); ps = ps.map(p => p.id === out.id ? { ...p, isAlive: false } : p); }
  const w = win(ps, rs); const nextDay = Number(ro.day || 1) + 1; const add = [mod(out ? `투표 결과 ${out.displayName}님이 탈락했습니다.` : '투표가 동률입니다. 탈락자는 없습니다.')]; if (w) add.push(mod(`${w[1]}! 게임이 종료되었습니다.`)); else add.push(mod('다시 밤이 되었습니다. 본인의 역할 행동을 선택하세요.'));
  b.update(r, { status: w ? 'ended' : 'playing', phase: w ? 'ended' : 'night', phaseLabel: w ? '게임 종료' : `${nextDay}일차 밤`, day: w ? ro.day : nextDay, winner: w?.[0] || '', winnerLabel: w?.[1] || '', aliveCount: alive(ps).length, revealedRoles: w ? reveal(ps, rs) : FieldValue.delete(), publicLog: logs(ro, add), updatedAt: FieldValue.serverTimestamp() }); await b.commit(); return { ok: true };
});
