import { auth, db } from '../firebase.js';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function inviteUrl(roomId) {
  const base = location.origin + location.pathname;
  return `${base}#/game/liar/${roomId}`;
}

export async function renderLiarGame(params = {}) {
  setMeta('게임 · 라이어게임');
  const roomId = params.id || '';
  if (roomId) return renderRoom(roomId);
  return renderLobby();
}

function renderLobby() {
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="liar-page">
      <section class="liar-hero">
        <button class="write-back-btn" id="liar-back" type="button">←</button>
        <div class="liar-hero__eyebrow">🕵️ 게임</div>
        <h1>라이어게임</h1>
        <p>친구를 초대해서 제시어를 모르는 라이어를 찾아내는 추리 게임입니다.</p>
      </section>

      <section class="liar-create-card">
        <h2>방 만들기</h2>
        <div class="form-group">
          <label class="form-label">방 제목</label>
          <input id="liar-title" class="form-input" maxlength="40" value="소소 라이어게임" placeholder="방 제목">
        </div>
        <div class="form-group">
          <label class="form-label">카테고리</label>
          <select id="liar-category" class="form-select">
            <option value="food">음식</option>
            <option value="place">장소</option>
            <option value="thing">물건</option>
            <option value="animal">동물</option>
            <option value="random">랜덤</option>
          </select>
        </div>
        <div class="liar-option-row">
          <div class="form-group">
            <label class="form-label">최대 인원</label>
            <select id="liar-max" class="form-select">
              <option value="4">4명</option>
              <option value="5">5명</option>
              <option value="6" selected>6명</option>
              <option value="8">8명</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">라이어 수</label>
            <select id="liar-count" class="form-select">
              <option value="1" selected>1명</option>
              <option value="2">2명</option>
            </select>
          </div>
        </div>
        <button class="btn btn--primary" id="liar-create">방 만들기</button>
      </section>

      <section class="liar-rule-card">
        <b>진행 방식</b>
        <span>방 만들기 → 초대 링크 공유 → 참가자 입장 → 방장이 시작 → 각자 제시어/라이어 확인</span>
      </section>
    </div>`;

  document.getElementById('liar-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('liar-create')?.addEventListener('click', createRoom);
}

async function createRoom() {
  if (!auth.currentUser) { navigate('/login'); return; }
  const btn = document.getElementById('liar-create');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const room = {
      game: 'liar',
      status: 'waiting',
      title: document.getElementById('liar-title')?.value.trim() || '소소 라이어게임',
      category: document.getElementById('liar-category')?.value || 'food',
      maxPlayers: Number(document.getElementById('liar-max')?.value || 6),
      liarCount: Number(document.getElementById('liar-count')?.value || 1),
      code: makeRoomCode(),
      hostId: auth.currentUser.uid,
      hostName: appState.nickname || auth.currentUser.displayName || '방장',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'game_rooms'), room);
    await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), {
      uid: auth.currentUser.uid,
      name: appState.nickname || auth.currentUser.displayName || '익명',
      role: 'host',
      joinedAt: serverTimestamp(),
    });
    toast.success('라이어게임 방을 만들었어요');
    navigate(`/game/liar/${ref.id}`);
  } catch (error) {
    console.error(error);
    toast.error(error.message || '방 만들기에 실패했어요');
    btn.disabled = false;
    btn.textContent = '방 만들기';
  }
}

async function renderRoom(roomId) {
  const el = document.getElementById('page-content');
  if (!el) return;
  const snap = await getDoc(doc(db, 'game_rooms', roomId)).catch(() => null);
  if (!snap?.exists()) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">방을 찾을 수 없어요</div><button class="btn btn--primary" onclick="navigate('/game/liar')">방 만들기</button></div>`;
    return;
  }
  const room = { id: snap.id, ...snap.data() };
  const url = inviteUrl(room.id);
  el.innerHTML = `
    <div class="liar-page">
      <section class="liar-hero">
        <button class="write-back-btn" id="liar-back" type="button">←</button>
        <div class="liar-hero__eyebrow">방 코드 ${room.code || ''}</div>
        <h1>${room.title || '라이어게임'}</h1>
        <p>초대 링크를 공유해서 참가자를 모으세요.</p>
      </section>

      <section class="liar-room-card">
        <div class="liar-room-info">
          <span>상태</span><b>${room.status === 'waiting' ? '대기중' : room.status}</b>
        </div>
        <div class="liar-room-info">
          <span>카테고리</span><b>${room.category || '-'}</b>
        </div>
        <div class="liar-room-info">
          <span>최대 인원</span><b>${room.maxPlayers || 0}명</b>
        </div>
        <div class="liar-room-info">
          <span>라이어</span><b>${room.liarCount || 1}명</b>
        </div>
      </section>

      <section class="liar-invite-card">
        <label class="form-label">초대 링크</label>
        <div class="liar-invite-row">
          <input class="form-input" id="liar-invite-url" value="${url}" readonly>
          <button class="btn btn--primary btn--sm" id="liar-copy">복사</button>
        </div>
        <div class="form-hint">카카오톡으로 이 링크를 보내면 친구가 바로 들어올 수 있습니다.</div>
      </section>

      <section class="liar-player-card">
        <h2>참가자</h2>
        <div class="liar-player-list" id="liar-player-list">
          <div class="liar-player-item"><span>${room.hostName || '방장'}</span><b>방장</b></div>
        </div>
        <button class="btn btn--ghost" id="liar-join">참가하기</button>
        <button class="btn btn--primary" id="liar-start" disabled>게임 시작 준비중</button>
      </section>
    </div>`;

  document.getElementById('liar-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('liar-copy')?.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(url);
    toast.success('초대 링크를 복사했어요');
  });
  document.getElementById('liar-join')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    await setDoc(doc(db, 'game_rooms', room.id, 'players', auth.currentUser.uid), {
      uid: auth.currentUser.uid,
      name: appState.nickname || auth.currentUser.displayName || '익명',
      role: auth.currentUser.uid === room.hostId ? 'host' : 'player',
      joinedAt: serverTimestamp(),
    }, { merge: true });
    toast.success('방에 참가했어요');
  });
}
