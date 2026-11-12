import { newGame, play, retire, captain, finishAutoTurn } from '../public/js/rules.js';

export const TURN_MS = 85000;
export const ROOM_TTL = 24 * 60 * 60 * 1000;
const HOST_LEASE = 90000;
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
const KEY_RE = /^[a-f0-9]{48}$/;
const NONCE_RE = /^[a-f0-9]{24}$/;
export class RoomError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status,text) => { throw new RoomError(status,text); };
function cleanName(name) {
  if (typeof name !== 'string') return '우편 선장';
  const clean = name.replace(/[\p{Cc}\p{Cf}]/gu,'').trim().slice(0,16);
  return clean || '우편 선장';
}
async function digest(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
  return Array.from(bytes,b => b.toString(16).padStart(2,'0')).join('');
}
function randomNumber() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
}
function makeMember(name, key, seat) {
  return {id:crypto.randomUUID(), name:cleanName(name), seat, key, recent:[]};
}
function snapshot(r, id, now) {
  return {code:r.code, me:id, host:r.host, rev:r.rev, now, deadline:r.deadline, takeOverAt:r.hostSeen+HOST_LEASE,
    members:r.members.map(({id,name,seat}) => ({id,name,seat})), game:r.game};
}
function bump(r, now) { r.rev++; r.changed = now; }
function ringDeadline(r, now) {
  r.deadline = r.game && r.game.phase !== 'finished' ? now + TURN_MS : 0;
}
function autopilot(r, now, random) {
  if (!r.deadline || now < r.deadline) return false;
  finishAutoTurn(r.game,random); bump(r,now); ringDeadline(r,now); return true;
}

// The store swaps one room version atomically. A retry reloads the latest turn before applying input.
export async function roomRequest(store, input, now = Date.now(), random = randomNumber) {
  const {op, code, token} = input || {};
  if (!CODE_RE.test(code || '') || !KEY_RE.test(token || '')) fail(400,'초대 코드나 승선 정보가 올바르지 않아요.');
  const key = await digest(code+':'+token);
  const writes = ['start','roll','sail','build','pass','leave','rematch'];
  if (writes.includes(op) && !NONCE_RE.test(input.nonce || '')) fail(400,'요청 번호를 확인해 주세요.');
  for (let attempt=0; attempt<7; attempt++) {
    const row = await store.get(code);
    if (op === 'create' && !row) {
      const m = makeMember(input.name,key,0);
      const r = {code, rev:1, members:[m], host:m.id, hostSeen:now, changed:now, deadline:0, game:null};
      if (await store.insert(r,now+ROOM_TTL)) return snapshot(r,m.id,now);
      continue;
    }
    if (!row || row.expires <= now) fail(404,'방을 찾을 수 없어요. 초대 코드를 다시 확인해 주세요.');
    const r = row.room;
    let member = r.members.find(m => m.key === key);
    if (op === 'create') {
      if (!member) fail(409,'이미 사용 중인 방 코드예요.');
      return snapshot(r,member.id,now);
    }
    if (op === 'join') {
      if (member) return snapshot(r,member.id,now);
      if (r.game) fail(409,'이미 출항한 방이에요. 원래 좌석은 이어하기로 돌아올 수 있어요.');
      if (!r.members.length) fail(410,'종료된 방이에요.');
      if (r.members.length >= 4) fail(409,'네 좌석이 모두 찼어요.');
      const seat = [0,1,2,3].find(i => r.members.every(m => m.seat !== i));
      member = makeMember(input.name,key,seat); r.members.push(member); bump(r,now);
      if (await store.swap(row,r,now+ROOM_TTL)) return snapshot(r,member.id,now);
      continue;
    }
    if (op === 'leave' && !member) return {left:true};
    if (!member) fail(403,'이 방의 승선 정보가 없어요. 초대 코드로 참가해 주세요.');
    if (writes.includes(op) && member.recent.includes(input.nonce)) return snapshot(r,member.id,now);
    if (autopilot(r,now,random)) {
      if (!await store.swap(row,r,now+ROOM_TTL)) continue;
      if (op === 'state') return snapshot(r,member.id,now);
      continue;
    }
    if (op === 'state') {
      if (!r.game && r.host === member.id && now-r.hostSeen>25000) {
        r.hostSeen = now;
        if (!await store.swap(row,r,now+ROOM_TTL)) continue;
      }
      return snapshot(r,member.id,now);
    }
    if (!writes.includes(op)) fail(400,'알 수 없는 행동이에요.');
    if (op !== 'leave' && input.rev !== r.rev) fail(409,'다른 선장의 행동이 먼저 반영됐어요. 현재 판을 다시 확인해 주세요.');
    if (op === 'leave') {
      if (r.game) retire(r.game,member.id);
      r.members = r.members.filter(m => m.id !== member.id);
      if (r.host === member.id) { r.host = r.members[0]?.id || null; r.hostSeen = now; }
      ringDeadline(r,now);
    } else if (op === 'start' || op === 'rematch') {
      if (r.host !== member.id && now-r.hostSeen<HOST_LEASE) fail(403,'방장이 출항을 준비하고 있어요.');
      if (op === 'start' && r.game) fail(409,'이미 출항한 방이에요.');
      if (op === 'rematch' && r.game?.phase !== 'finished') fail(409,'현재 항해를 먼저 마쳐 주세요.');
      if (op === 'start' && r.members.length < 2) fail(409,'친구가 한 명 이상 승선하면 출항할 수 있어요.');
      r.host = member.id; r.hostSeen = now;
      if (op === 'rematch') r.game = null;
      else r.game = newGame(r.members);
      ringDeadline(r,now);
    } else {
      if (!r.game || r.game.phase === 'finished' || captain(r.game).id !== member.id) fail(409,'지금은 내 차례가 아니에요.');
      const oldTurn = r.game.turn;
      try { play(r.game,member.id,{type:op,choice:input.choice},random); }
      catch (error) { fail(409,error.message); }
      if (oldTurn !== r.game.turn || r.game.phase === 'finished') ringDeadline(r,now);
      else r.deadline = Math.max(r.deadline,now+20000);
    }
    member.recent = [...member.recent.slice(-7),input.nonce];
    bump(r,now);
    const expires = r.members.length ? now+ROOM_TTL : now+60000;
    if (await store.swap(row,r,expires)) return op === 'leave' ? {left:true} : snapshot(r,member.id,now);
  }
  fail(409,'항구가 잠시 붐벼요. 다시 시도해 주세요.');
}
