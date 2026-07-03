import { db, functions } from '../firebase.js';
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { doc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const fn = name => httpsCallable(functions, name);
const api = {
  join: fn('joinRoleRoom'), addAi: fn('addRoleAi'), start: fn('startRoleRoom'), myRole: fn('getRoleRoomRole'), night: fn('actRoleNight'), finishNight: fn('finishRoleNight'), openVote: fn('openRoleVote'), vote: fn('voteRoleDay'), finishVote: fn('finishRoleVote'),
};

const ROLE = {
  shadow: { icon: '🌘', label: '그림자', team: '그림자팀', help: '밤에 한 명을 조용히 지목합니다. 정체를 숨기고 낮 토론에서 의심을 피해야 합니다.' },
  seer: { icon: '🔎', label: '조사자', team: '시민팀', help: '밤에 한 명을 조사해서 그림자인지 확인합니다. 조사 결과는 본인에게만 보입니다.' },
  guard: { icon: '🛡️', label: '보호자', team: '시민팀', help: '밤에 한 명을 보호합니다. 보호 대상은 밤 탈락을 피할 수 있습니다.' },
  citizen: { icon: '🙂', label: '시민', team: '시민팀', help: '밤 행동은 없습니다. 낮 토론과 투표로 그림자를 찾아야 합니다.' },
};

const PHASE_STEPS = [
  { key: 'lobby', label: '대기실', desc: '친구를 초대하고 부족한 인원은 AI 캐릭터로 채웁니다.' },
  { key: 'night', label: '밤 행동', desc: '운영봇이 밤을 진행하고 각 역할은 비공개 행동을 선택합니다.' },
  { key: 'day', label: '낮 토론', desc: '운영봇이 결과를 알리고 참가자들이 발언합니다.' },
  { key: 'vote', label: '투표', desc: '운영봇 안내에 따라 탈락시킬 참가자를 선택합니다.' },
  { key: 'ended', label: '결과', desc: '운영봇이 승패를 발표하고 역할이 공개됩니다.' },
];

let s = { roomId: '', room: null, players: [], chats: [], role: null, target: '', busy: false };
let unsubs = [];

function clear() { unsubs.forEach(x => { try { x(); } catch {} }); unsubs = []; }
function me() { return appState.user ? s.players.find(p => p.id === appState.user.uid || p.uid === appState.user.uid) : null; }
function host() { return appState.user && s.room?.hostId === appState.user.uid; }
function alive() { return s.players.filter(p => p.isAlive !== false); }
function currentPhase() { return s.room?.phase || 'lobby'; }
function phaseLabel(v) { return (PHASE_STEPS.find(x => x.key === v)?.label) || v || '-'; }
function shareUrl() { return `${location.origin}/#/game/room/${encodeURIComponent(s.roomId)}`; }
function msg(t, kind = 'success') { window.showToast?.(t, kind); }
function visibleRoleLabel(role) { return ROLE[role]?.label || role || '-'; }
function visibleWinnerLabel(label) { return String(label || '').replace('마피아팀', '그림자팀'); }
function isSoloRoom() { return s.room?.playMode === 'solo'; }

async function run(work, text = '') {
  if (s.busy) return;
  s.busy = true; render();
  try { await work(); if (text) msg(text); }
  catch (e) { console.error(e); msg(e.message || '실행에 실패했어요', 'error'); }
  finally { s.busy = false; render(); }
}

async function loadRole() {
  if (!appState.user || !s.roomId || s.room?.status === 'lobby') return;
  try { const r = await api.myRole({ roomId: s.roomId }); s.role = r.data || null; } catch {}
}

function loginView() {
  return `<div class="empty-state" style="padding:70px 20px"><div class="empty-state__icon">🔐</div><div class="empty-state__title">로그인이 필요합니다</div><div class="empty-state__desc">추리방에 참가하려면 로그인해주세요.</div><button class="btn btn--primary" style="margin-top:16px" id="rr-login">로그인하기</button></div>`;
}

function topView() {
  const room = s.room || {};
  const title = isSoloRoom() ? '혼자 추리방' : '친구와 추리방';
  return `<section style="padding:20px;border-radius:24px;background:linear-gradient(135deg,rgba(17,24,39,.10),rgba(99,102,241,.10),rgba(236,72,153,.06));border:1px solid rgba(148,163,184,.28);margin-bottom:14px"><div style="font-size:13px;font-weight:950;color:var(--color-primary);margin-bottom:6px">🕵️ SOSOKING SHADOW ROOM</div><h1 style="margin:0;font-size:clamp(25px,4vw,36px);color:var(--color-text-primary)">${escHtml(title)}</h1><p style="margin:8px 0 15px;font-size:14px;color:var(--color-text-secondary);line-height:1.65">운영봇은 게임 사회자입니다. 운영봇은 진행만 담당하고, 추리와 변명은 나와 AI 캐릭터 참가자들이 합니다.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px"><div class="card" style="padding:10px"><b>${escHtml(phaseLabel(room.phase))}</b><span style="display:block;font-size:11px;color:var(--color-text-muted);margin-top:3px">현재 단계</span></div><div class="card" style="padding:10px"><b>${Number(room.day || 0)}</b><span style="display:block;font-size:11px;color:var(--color-text-muted);margin-top:3px">일차</span></div><div class="card" style="padding:10px"><b>${alive().length}/${s.players.length}</b><span style="display:block;font-size:11px;color:var(--color-text-muted);margin-top:3px">생존/참가</span></div><div class="card" style="padding:10px"><b>${escHtml(visibleWinnerLabel(room.winnerLabel) || '-')}</b><span style="display:block;font-size:11px;color:var(--color-text-muted);margin-top:3px">승패</span></div></div></section>`;
}

function guideView() {
  const phase = currentPhase();
  return `<section class="card" style="margin-bottom:14px"><div class="card__body"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px"><div><div style="font-size:15px;font-weight:950;color:var(--color-text-primary)">게임 진행판</div><div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px">그림자는 숨고, 시민팀은 토론과 조사로 그림자를 찾아냅니다.</div></div><span style="font-size:12px;font-weight:900;color:var(--color-primary);background:rgba(99,102,241,.10);padding:7px 10px;border-radius:999px">현재: ${escHtml(phaseLabel(phase))}</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px">${PHASE_STEPS.map((step, idx) => `<div style="padding:11px;border-radius:15px;border:1px solid ${phase === step.key ? 'var(--color-primary)' : 'rgba(148,163,184,.24)'};background:${phase === step.key ? 'rgba(99,102,241,.08)' : 'rgba(148,163,184,.07)'}"><div style="font-size:12px;font-weight:950;color:var(--color-text-primary)">${idx + 1}. ${escHtml(step.label)}</div><div style="font-size:11px;color:var(--color-text-muted);line-height:1.45;margin-top:4px">${escHtml(step.desc)}</div></div>`).join('')}</div></div></section>`;
}

function inviteView() {
  if (isSoloRoom()) return '';
  return `<section class="card" style="margin-bottom:14px"><div class="card__body" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><div style="font-weight:950;color:var(--color-text-primary);margin-bottom:4px">초대 링크</div><div style="font-size:12px;color:var(--color-text-secondary);word-break:break-all">${escHtml(shareUrl())}</div></div><button class="btn btn--ghost btn--sm" id="rr-copy">링크 복사</button></div></section>`;
}

function roleView() {
  const info = ROLE[s.role?.role] || { icon: '❔', label: '역할 대기중', team: '대기중', help: '게임이 시작되면 내 역할이 표시됩니다.' };
  const res = s.role?.lastResult;
  return `<section class="card" style="margin-bottom:14px"><div class="card__body"><div style="display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap"><div><div style="font-size:13px;color:var(--color-text-muted);font-weight:800">내 비밀 역할</div><div style="font-size:22px;font-weight:950;color:var(--color-text-primary);margin-top:2px">${info.icon} ${escHtml(info.label)} <small style="font-size:12px;color:var(--color-primary)">${escHtml(info.team)}</small></div><div style="font-size:12px;color:var(--color-text-secondary);line-height:1.55;margin-top:6px">${escHtml(info.help)}</div></div><button class="btn btn--ghost btn--sm" id="rr-role">역할 새로고침</button></div>${res ? `<div style="margin-top:12px;padding:12px;border-radius:14px;background:rgba(99,102,241,.08);font-size:13px;color:var(--color-text-secondary)">조사 결과: <b>${escHtml(res.targetName)}</b>님은 ${res.isShadow ? '<b style="color:var(--color-danger,#ef4444)">그림자</b>' : '<b>그림자가 아님</b>'}입니다.</div>` : ''}</div></section>`;
}

function roleSummaryView() {
  return `<section class="card" style="margin-bottom:14px"><div class="card__body"><div style="font-size:15px;font-weight:950;margin-bottom:10px;color:var(--color-text-primary)">역할 안내</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">${Object.values(ROLE).map(item => `<div style="padding:11px;border-radius:14px;border:1px solid rgba(148,163,184,.24);background:rgba(148,163,184,.07)"><div style="font-size:14px;font-weight:950;color:var(--color-text-primary)">${item.icon} ${escHtml(item.label)}</div><div style="font-size:11px;color:var(--color-text-muted);line-height:1.45;margin-top:5px">${escHtml(item.help)}</div></div>`).join('')}</div></div></section>`;
}

function playersView() {
  const rv = s.room?.revealedRoles || {};
  return `<section class="card" style="margin-bottom:14px"><div class="card__body"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><div style="font-size:15px;font-weight:950;color:var(--color-text-primary)">참가자</div><div style="font-size:12px;color:var(--color-text-muted)">카드를 눌러 밤 행동/투표 대상을 선택합니다.</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">${s.players.map(p => { const role = rv[p.id]; return `<button type="button" data-rr-target="${escHtml(p.id)}" style="text-align:left;padding:11px;border-radius:14px;border:1px solid ${s.target === p.id ? 'var(--color-primary)' : 'rgba(148,163,184,.28)'};background:${p.isAlive === false ? 'rgba(148,163,184,.12)' : 'var(--color-surface)'};cursor:pointer"><div style="display:flex;gap:7px;align-items:center"><span>${escHtml(p.emoji || '🙂')}</span><b>${escHtml(p.displayName || '참가자')}</b>${p.isHost ? '<small style="color:var(--color-primary);font-weight:900">방장</small>' : ''}</div><div style="font-size:11px;color:var(--color-text-muted);margin-top:5px">${p.isAlive === false ? '탈락' : '생존'} · ${p.type === 'ai' ? 'AI 캐릭터' : '유저'}${role ? ` · ${escHtml(visibleRoleLabel(role.role))}` : ''}</div></button>`; }).join('')}</div></div></section>`;
}

function hostView() {
  if (!host()) return '';
  const ph = currentPhase();
  return `<section class="card" style="margin-bottom:14px"><div class="card__body"><div style="font-size:15px;font-weight:950;margin-bottom:10px;color:var(--color-text-primary)">방장 진행</div><div style="display:flex;gap:8px;flex-wrap:wrap">${ph === 'lobby' ? '<button class="btn btn--ghost btn--sm" id="rr-ai">AI 캐릭터 채우기</button><button class="btn btn--primary btn--sm" id="rr-start">게임 시작</button>' : ''}${ph === 'night' ? '<button class="btn btn--primary btn--sm" id="rr-night-end">운영봇: 밤 결과 발표</button>' : ''}${ph === 'day' ? '<button class="btn btn--primary btn--sm" id="rr-vote-open">운영봇: 투표 시작</button>' : ''}${ph === 'vote' ? '<button class="btn btn--primary btn--sm" id="rr-vote-end">운영봇: 투표 집계</button>' : ''}</div><div style="font-size:12px;color:var(--color-text-muted);margin-top:10px;line-height:1.5">운영봇은 사회자입니다. 방장이 진행 버튼을 누르면 운영봇이 단계와 결과를 발표하고, AI 참가자들은 자동으로 행동하거나 발언합니다.</div></div></section>`;
}

function actionView() {
  const ph = currentPhase(); const role = s.role?.role; const aliveMe = me()?.isAlive !== false;
  if (!aliveMe || !['night', 'vote'].includes(ph)) return '';
  let title = '', desc = '', btn = '';
  if (ph === 'night') {
    if (role === 'shadow') { title = '밤 행동 · 그림자'; desc = '밤에 조용히 지목할 대상을 선택하세요.'; btn = '대상 지목'; }
    else if (role === 'seer') { title = '밤 행동 · 조사자'; desc = '조사할 대상을 선택하세요. 결과는 내 역할 카드에 표시됩니다.'; btn = '조사하기'; }
    else if (role === 'guard') { title = '밤 행동 · 보호자'; desc = '보호할 대상을 선택하세요.'; btn = '보호하기'; }
    else return `<section class="card" style="margin-bottom:14px"><div class="card__body"><b>밤 행동 없음</b><div style="font-size:12px;color:var(--color-text-secondary);margin-top:6px">시민은 밤에 행동하지 않습니다. 운영봇의 아침 발표를 기다려주세요.</div></div></section>`;
  } else { title = '낮 투표'; desc = '탈락시킬 대상을 선택하세요.'; btn = '투표하기'; }
  return `<section class="card" style="margin-bottom:14px"><div class="card__body" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><div style="font-weight:950;color:var(--color-text-primary)">${escHtml(title)}</div><div style="font-size:12px;color:var(--color-text-secondary);margin-top:5px">${escHtml(desc)} ${s.target ? '선택 완료.' : '참가자 카드를 먼저 선택하세요.'}</div></div><button class="btn btn--primary btn--sm" id="rr-action" ${s.target ? '' : 'disabled'}>${escHtml(btn)}</button></div></section>`;
}

function resultReportView() {
  if (currentPhase() !== 'ended') return '';
  const rv = s.room?.revealedRoles || {};
  const shadowList = Object.values(rv).filter(x => x.role === 'shadow').map(x => `${x.emoji || ''} ${x.name}`).join(', ') || '-';
  return `<section class="card" style="margin-bottom:14px"><div class="card__body"><div style="font-size:18px;font-weight:950;color:var(--color-text-primary);margin-bottom:8px">게임 결과 리포트</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px"><div style="padding:12px;border-radius:14px;background:rgba(99,102,241,.08)"><b>${escHtml(visibleWinnerLabel(s.room?.winnerLabel) || '-')}</b><span style="display:block;font-size:11px;color:var(--color-text-muted);margin-top:4px">승리팀</span></div><div style="padding:12px;border-radius:14px;background:rgba(239,68,68,.08)"><b>${escHtml(shadowList)}</b><span style="display:block;font-size:11px;color:var(--color-text-muted);margin-top:4px">숨은 그림자</span></div><div style="padding:12px;border-radius:14px;background:rgba(34,197,94,.08)"><b>${alive().length}명 생존</b><span style="display:block;font-size:11px;color:var(--color-text-muted);margin-top:4px">최종 생존자</span></div></div></div></section>`;
}

function normalizeText(text) { return String(text || '').replaceAll('마피아팀', '그림자팀').replaceAll('마피아', '그림자').replaceAll('경찰', '조사자').replaceAll('의사', '보호자'); }
function logItem(x) {
  const type = x.type || 'moderator';
  const speaker = x.speaker || (type === 'ai' ? 'AI 참가자' : '운영봇');
  const bg = type === 'ai' ? 'rgba(99,102,241,.08)' : 'rgba(17,24,39,.06)';
  const badge = type === 'ai' ? '참가자 발언' : '사회자';
  return `<div style="font-size:13px;line-height:1.55;color:var(--color-text-secondary);padding:9px 10px;border-radius:12px;background:${bg}"><div style="display:flex;gap:6px;align-items:center;margin-bottom:3px"><b style="color:var(--color-text-primary)">${escHtml(speaker)}</b><small style="font-size:10px;color:var(--color-text-muted);font-weight:900">${badge}</small></div><div>${escHtml(normalizeText(x.text))}</div></div>`;
}
function logView() {
  const a = Array.isArray(s.room?.publicLog) ? s.room.publicLog : [];
  return `<section class="card" style="margin-bottom:14px"><div class="card__body"><div style="font-size:15px;font-weight:950;margin-bottom:4px;color:var(--color-text-primary)">게임 사회자 · 참가자 발언</div><div style="font-size:12px;color:var(--color-text-muted);margin-bottom:10px">운영봇은 사회자이고, AI 캐릭터는 참가자로 발언합니다.</div><div style="display:flex;flex-direction:column;gap:7px;max-height:280px;overflow:auto">${a.length ? a.slice().reverse().map(logItem).join('') : '<div style="font-size:13px;color:var(--color-text-muted)">아직 진행 기록이 없습니다.</div>'}</div></div></section>`;
}

function chatView() {
  if (isSoloRoom()) return '';
  return `<section class="card"><div class="card__body"><div style="font-size:15px;font-weight:950;margin-bottom:10px;color:var(--color-text-primary)">친구 토론 채팅</div><div style="display:flex;flex-direction:column;gap:7px;max-height:260px;overflow:auto;margin-bottom:10px">${s.chats.length ? s.chats.map(c => `<div style="font-size:13px;line-height:1.55"><b>${escHtml(c.name || '참가자')}</b> <span style="color:var(--color-text-secondary)">${escHtml(c.text || '')}</span></div>`).join('') : '<div style="font-size:13px;color:var(--color-text-muted)">아직 채팅이 없습니다.</div>'}</div><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px"><input class="form-input" id="rr-chat" placeholder="친구와 토론 내용을 입력하세요" maxlength="300"><button class="btn btn--primary btn--sm" id="rr-chat-send">전송</button></div></div></section>`;
}

function render() {
  const el = document.getElementById('page-content'); if (!el) return;
  if (!appState.user) { el.innerHTML = loginView(); document.getElementById('rr-login')?.addEventListener('click', () => navigate(`/login?return=/game/room/${s.roomId}`)); return; }
  if (!s.room) { el.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>'; return; }
  el.innerHTML = `<div style="max-width:1040px;margin:0 auto;padding:4px 0 24px">${topView()}${guideView()}${inviteView()}${me() ? '' : '<section class="card" style="margin-bottom:14px"><div class="card__body" style="display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap"><div><b>아직 참가하지 않았습니다</b><div style="font-size:12px;color:var(--color-text-secondary);margin-top:5px">참가 버튼을 누르면 이 방의 플레이어가 됩니다.</div></div><button class="btn btn--primary btn--sm" id="rr-join">참가하기</button></div></section>'}${me() ? roleView() : ''}${roleSummaryView()}${hostView()}${actionView()}${resultReportView()}${playersView()}${logView()}${me() ? chatView() : ''}</div>`;
  bind();
}

function bind() {
  document.getElementById('rr-copy')?.addEventListener('click', async () => { await navigator.clipboard.writeText(shareUrl()); msg('초대 링크가 복사됐어요'); });
  document.getElementById('rr-join')?.addEventListener('click', () => run(() => api.join({ roomId: s.roomId }), '참가 완료'));
  document.getElementById('rr-ai')?.addEventListener('click', () => run(() => api.addAi({ roomId: s.roomId, targetCount: 8 }), 'AI 캐릭터를 채웠어요'));
  document.getElementById('rr-start')?.addEventListener('click', () => run(() => api.start({ roomId: s.roomId }), '게임을 시작했어요'));
  document.getElementById('rr-night-end')?.addEventListener('click', () => run(() => api.finishNight({ roomId: s.roomId }), '운영봇이 밤 결과를 발표했어요'));
  document.getElementById('rr-vote-open')?.addEventListener('click', () => run(() => api.openVote({ roomId: s.roomId }), '운영봇이 투표를 시작했어요'));
  document.getElementById('rr-vote-end')?.addEventListener('click', () => run(() => api.finishVote({ roomId: s.roomId }), '운영봇이 투표를 집계했어요'));
  document.getElementById('rr-role')?.addEventListener('click', () => run(async () => { await loadRole(); }, '역할을 새로고침했어요'));
  document.querySelectorAll('[data-rr-target]').forEach(b => b.addEventListener('click', () => { s.target = b.dataset.rrTarget || ''; render(); }));
  document.getElementById('rr-action')?.addEventListener('click', () => { if (!s.target) return; if (currentPhase() === 'night') run(() => api.night({ roomId: s.roomId, targetId: s.target }), '밤 행동을 선택했어요'); if (currentPhase() === 'vote') run(() => api.vote({ roomId: s.roomId, targetId: s.target }), '투표 완료'); });
  document.getElementById('rr-chat-send')?.addEventListener('click', sendChat);
  document.getElementById('rr-chat')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
}

async function sendChat() {
  const input = document.getElementById('rr-chat'); const text = String(input?.value || '').trim();
  if (!text || !appState.user || !me()) return; input.value = '';
  await addDoc(collection(db, 'game_rooms', s.roomId, 'chats'), { uid: appState.user.uid, name: me().displayName || appState.nickname || '참가자', text: text.slice(0, 300), createdAt: serverTimestamp() });
}

function sub() {
  clear();
  unsubs.push(onSnapshot(doc(db, 'game_rooms', s.roomId), async snap => { s.room = snap.exists() ? { id: snap.id, ...snap.data() } : null; await loadRole(); render(); }));
  unsubs.push(onSnapshot(collection(db, 'game_rooms', s.roomId, 'players'), snap => { s.players = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => Number(a.joinedAt?.seconds || 0) - Number(b.joinedAt?.seconds || 0)); render(); }));
  unsubs.push(onSnapshot(query(collection(db, 'game_rooms', s.roomId, 'chats'), orderBy('createdAt', 'asc')), snap => { s.chats = snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(-80); render(); }));
}

export async function renderRoleRoom(roomId) {
  setMeta('소소킹 추리방', '운영봇이 사회를 보고 AI 캐릭터와 함께 하는 역할 추리 게임');
  s = { roomId, room: null, players: [], chats: [], role: null, target: '', busy: false };
  sub(); render();
}
