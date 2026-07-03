import { functions } from './firebase.js';
import { appState } from './state.js';
import { navigate } from './router.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const createRoom = httpsCallable(functions, 'createRoleRoom');
const createSoloRoom = httpsCallable(functions, 'createSoloRoleRoom');

function safeName() {
  return String(appState.nickname || appState.user?.displayName || appState.user?.email?.split('@')[0] || '방장').replace(/[<>]/g, '').slice(0, 20) || '방장';
}

function readableError(error, fallback) {
  const message = String(error?.message || '').trim();
  return message || fallback;
}

function makeEntryCard() {
  const card = document.createElement('section');
  card.id = 'live-role-room-entry';
  card.style.cssText = 'margin:0 0 14px;padding:16px;border:1px solid rgba(148,163,184,.32);border-radius:20px;background:linear-gradient(135deg,rgba(17,24,39,.08),rgba(99,102,241,.08));display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap';
  card.innerHTML = `
    <div>
      <div style="font-size:14px;font-weight:950;color:var(--color-text-primary);margin-bottom:5px">🕵️ 추리방 만들기</div>
      <div style="font-size:12px;color:var(--color-text-secondary);line-height:1.55">혼자방은 서버에서 AI 7명 참가, 랜덤 역할 배정, 1일차 밤 시작까지 한 번에 처리합니다.</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn--primary btn--sm" id="live-role-room-solo">혼자방 만들기</button>
      <button class="btn btn--ghost btn--sm" id="live-role-room-create">친구 초대방 만들기</button>
    </div>`;
  return card;
}

async function requireLogin() {
  if (!appState.user) {
    navigate('/login?return=/games');
    return false;
  }
  return true;
}

async function startSoloRoom() {
  if (!await requireLogin()) return;
  const btn = document.getElementById('live-role-room-solo');
  const inviteBtn = document.getElementById('live-role-room-create');
  if (btn) { btn.disabled = true; btn.textContent = '혼자방 시작 중...'; }
  if (inviteBtn) inviteBtn.disabled = true;
  try {
    const res = await createSoloRoom({ nickname: safeName() });
    const roomId = res.data?.roomId || '';
    if (!roomId) throw new Error('방 ID를 받지 못했습니다.');
    navigate(`/game/room/${encodeURIComponent(roomId)}`);
  } catch (error) {
    console.error('[role room] solo start failed', error);
    window.showToast?.(readableError(error, '혼자방 시작에 실패했습니다. Functions 배포 상태를 확인하세요.'), 'error');
    if (btn) { btn.disabled = false; btn.textContent = '혼자방 만들기'; }
    if (inviteBtn) inviteBtn.disabled = false;
  }
}

async function createInviteRoom() {
  if (!await requireLogin()) return;
  const btn = document.getElementById('live-role-room-create');
  const soloBtn = document.getElementById('live-role-room-solo');
  if (btn) { btn.disabled = true; btn.textContent = '초대방 생성 중...'; }
  if (soloBtn) soloBtn.disabled = true;
  try {
    const res = await createRoom({ nickname: safeName() });
    const roomId = res.data?.roomId || '';
    if (!roomId) throw new Error('방 ID를 받지 못했습니다.');
    navigate(`/game/room/${encodeURIComponent(roomId)}`);
  } catch (error) {
    console.error('[role room] invite create failed', error);
    window.showToast?.(readableError(error, '초대방 만들기에 실패했습니다. Functions 배포 상태를 확인하세요.'), 'error');
    if (btn) { btn.disabled = false; btn.textContent = '친구 초대방 만들기'; }
    if (soloBtn) soloBtn.disabled = false;
  }
}

function injectEntry() {
  const root = document.getElementById('character-game-root');
  if (!root || document.getElementById('live-role-room-entry')) return;
  const hero = root.querySelector('section');
  const card = makeEntryCard();
  if (hero && hero.nextSibling) root.insertBefore(card, hero.nextSibling);
  else root.prepend(card);
  document.getElementById('live-role-room-solo')?.addEventListener('click', startSoloRoom);
  document.getElementById('live-role-room-create')?.addEventListener('click', createInviteRoom);
}

function scheduleInject() { setTimeout(injectEntry, 120); }

window.addEventListener('hashchange', scheduleInject);
window.addEventListener('sosoking:extensions-ready', scheduleInject);
window.addEventListener('sosoking:game-room-page-ready', scheduleInject);
new MutationObserver(scheduleInject).observe(document.documentElement, { childList: true, subtree: true });
scheduleInject();
