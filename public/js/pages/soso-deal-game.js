import { auth, db } from '../firebase.js';
import { collection, doc, getDoc, onSnapshot, orderBy, query, limit, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { ensureGameGuestAuth } from '../game-guest-access.js';
import { buildGameInviteUrl, isRoomHost } from '../games/common.js';
import {
  createDealRoom, joinDealRoom, startDealGame,
  marketSwap, drawCard, cashInSet,
  proposeTrade, acceptTrade, rejectTrade,
  endDealTurn, addDealAiToRoom, triggerAiDealTurn,
  CARD_TYPES, countCards, calcSetPoints,
} from '../games/soso-deal/actions.js';
import {
  renderDealLobbyHTML, renderDealLoadingHTML, renderDealNotFoundHTML,
  renderDealWrongGameHTML, renderDealRoomHTML, renderDealPlayingHTML,
  renderDealDoneHTML,
} from '../games/soso-deal/render.js';

let unsubRoom = null;
let unsubPlayers = null;
let unsubActions = null;
let unsubProposals = null;
let timerInterval = null;

let currentRoom = null;
let currentPlayers = [];
let currentActions = [];
let currentProposals = [];

// 현재 선택 상태
let selectedHandCard = null;
let selectedMarketCard = null;
let showProposeForm = false;

export async function renderSosoDealGame(params = {}) {
  setMeta('소소딜 · AI 브로커 카드 거래');
  destroySosoDealGame();
  const roomId = params.id || '';
  if (roomId) return enterRoom(roomId);
  return showLobby();
}

export function destroySosoDealGame() {
  if (unsubRoom) unsubRoom();
  if (unsubPlayers) unsubPlayers();
  if (unsubActions) unsubActions();
  if (unsubProposals) unsubProposals();
  clearInterval(timerInterval);
  unsubRoom = null; unsubPlayers = null; unsubActions = null; unsubProposals = null;
  timerInterval = null;
  currentRoom = null; currentPlayers = []; currentActions = []; currentProposals = [];
  selectedHandCard = null; selectedMarketCard = null; showProposeForm = false;
  if (window.__sosokingCurrentGameRoom?.game === 'soso-deal') window.__sosokingCurrentGameRoom = null;
}

function pageEl() { return document.getElementById('page-content'); }
function myUid() { return auth.currentUser?.uid || ''; }
function isMyTurn() { return !!currentRoom && currentRoom.currentTurnUid === myUid(); }

// ── 로비 ──────────────────────────────────────────────────────────────────────
function showLobby() {
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderDealLobbyHTML();
  bindLobbyEvents();
}

function bindLobbyEvents() {
  document.getElementById('deal-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('deal-create-btn')?.addEventListener('click', handleCreateRoom);
  document.getElementById('deal-join-btn')?.addEventListener('click', handleJoinByCode);
  document.getElementById('deal-join-code')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleJoinByCode();
  });
}

async function handleCreateRoom() {
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;
  const btn = document.getElementById('deal-create-btn');
  try {
    btn.disabled = true;
    btn.textContent = '방 만드는 중...';
    const difficulty = document.getElementById('deal-difficulty')?.value || 'normal';
    const roomId = await createDealRoom({
      title: document.getElementById('deal-title')?.value.trim() || '소소딜',
      maxPlayers: Number(document.getElementById('deal-max')?.value || 4),
      difficulty,
    });
    const aiResult = await addDealAiToRoom(roomId, difficulty);
    if (!aiResult?.ok) toast.warn('AI 브로커 추가에 실패했어요');
    toast.success('소소딜 방을 만들었어요');
    navigate(`/game/soso-deal/${roomId}`);
  } catch (err) {
    console.error(err);
    toast.error(err.message || '방 만들기에 실패했어요');
    if (btn) { btn.disabled = false; btn.textContent = '방 만들기'; }
  }
}

async function handleJoinByCode() {
  const code = (document.getElementById('deal-join-code')?.value || '').trim().toUpperCase();
  if (!code) return toast.warn('초대 코드를 입력해주세요');
  await ensureGameGuestAuth();
  if (!auth.currentUser) return;
  try {
    const { query: q, collection: col, where: wh, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDocs(q(col(db, 'game_rooms'), wh('code', '==', code), wh('game', '==', 'soso-deal')));
    if (snap.empty) return toast.error('해당 코드의 소소딜 방을 찾지 못했어요');
    navigate(`/game/soso-deal/${snap.docs[0].id}`);
  } catch (err) {
    toast.error(err.message || '참가에 실패했어요');
  }
}

// ── 방 입장 ───────────────────────────────────────────────────────────────────
async function enterRoom(roomId) {
  await ensureGameGuestAuth();
  const el = pageEl();
  if (!el) return;
  el.innerHTML = renderDealLoadingHTML();

  const roomRef = doc(db, 'game_rooms', roomId);
  const initial = await getDoc(roomRef).catch(() => null);
  if (!initial?.exists()) { el.innerHTML = renderDealNotFoundHTML(); return; }

  const initialData = { id: initial.id, ...initial.data() };
  if (initialData.game && initialData.game !== 'soso-deal') { el.innerHTML = renderDealWrongGameHTML(); return; }

  try { await joinDealRoom(roomId); } catch {}

  unsubRoom = onSnapshot(roomRef, snap => {
    if (!snap.exists()) { el.innerHTML = renderDealNotFoundHTML(); return; }
    const prevTurn = currentRoom?.currentTurnUid;
    currentRoom = { id: snap.id, ...snap.data() };
    window.__sosokingCurrentGameRoom = currentRoom;
    redraw();
    maybeTriggerAiTurn(prevTurn);
  });

  unsubPlayers = onSnapshot(
    query(collection(db, 'game_rooms', roomId, 'players'), orderBy('joinedAt', 'asc')),
    snap => { currentPlayers = snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() })); redraw(); }
  );

  unsubActions = onSnapshot(
    query(collection(db, 'game_rooms', roomId, 'actions'), orderBy('createdAt', 'desc'), limit(20)),
    snap => { currentActions = snap.docs.map(d => ({ id: d.id, ...d.data() })); redraw(); }
  );

  unsubProposals = onSnapshot(
    collection(db, 'game_rooms', roomId, 'proposals'),
    snap => { currentProposals = snap.docs.map(d => ({ id: d.id, ...d.data() })); redraw(); }
  );

  timerInterval = setInterval(() => {
    if (currentRoom?.status === 'playing') redraw();
  }, 1000);
}

// ── AI 턴 자동 트리거 ─────────────────────────────────────────────────────────
function maybeTriggerAiTurn(prevTurn) {
  if (!currentRoom?.aiPlayerUid) return;
  if (currentRoom.status !== 'playing') return;
  if (!isRoomHost(currentRoom)) return;
  if (currentRoom.currentTurnUid !== currentRoom.aiPlayerUid) return;
  if (prevTurn === currentRoom.aiPlayerUid) return;
  setTimeout(async () => {
    try { await triggerAiDealTurn(currentRoom.id); } catch {}
  }, 2000 + Math.random() * 2000);
}

// ── 렌더링 ────────────────────────────────────────────────────────────────────
function redraw() {
  const el = pageEl();
  if (!el || !currentRoom) return;
  const uid = myUid();
  const status = currentRoom.status;

  if (status === 'waiting') {
    el.innerHTML = renderDealRoomHTML(currentRoom, currentPlayers, uid);
    bindWaitingEvents();
  } else if (status === 'playing') {
    el.innerHTML = renderDealPlayingHTML(currentRoom, currentPlayers, currentActions, currentProposals, uid);
    bindPlayingEvents();
  } else if (status === 'done') {
    el.innerHTML = renderDealDoneHTML(currentRoom, currentPlayers, uid);
    bindDoneEvents();
  }
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────────────────────
function bindBack() {
  document.getElementById('deal-back')?.addEventListener('click', () => navigate('/sosoland'));
}

function bindCopyInvite() {
  document.querySelectorAll('[data-copy-invite]').forEach(btn => btn.addEventListener('click', async () => {
    const url = buildGameInviteUrl('soso-deal', currentRoom.id);
    try { await navigator.clipboard.writeText(url); toast.success('초대 링크를 복사했어요'); }
    catch { toast.error('복사에 실패했어요: ' + url); }
  }));
}

function bindWaitingEvents() {
  bindBack(); bindCopyInvite();
  document.getElementById('deal-add-ai-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('deal-add-ai-btn');
    try {
      if (btn) btn.disabled = true;
      await addDealAiToRoom(currentRoom.id, currentRoom.difficulty || 'normal');
      toast.success('AI 브로커를 추가했어요');
    } catch (err) { toast.error(err.message || 'AI 추가 실패'); if (btn) btn.disabled = false; }
  });
  document.getElementById('deal-start-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('deal-start-btn');
    try {
      if (btn) btn.disabled = true;
      await startDealGame(currentRoom.id);
    } catch (err) { toast.error(err.message || '게임 시작 실패'); if (btn) btn.disabled = false; }
  });
}

function bindPlayingEvents() {
  bindBack();

  // 손패 카드 선택
  document.querySelectorAll('.deal-card[data-card]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.dataset.card;
      selectedHandCard = selectedHandCard === card ? null : card;
      document.querySelectorAll('.deal-card[data-card]').forEach(b => {
        b.classList.toggle('deal-card--selected', b.dataset.card === selectedHandCard);
      });
    });
  });

  // 시장 카드 선택
  document.querySelectorAll('.deal-market-card[data-market-card]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.dataset.marketCard;
      selectedMarketCard = selectedMarketCard === card ? null : card;
      document.querySelectorAll('.deal-market-card[data-market-card]').forEach(b => {
        b.classList.toggle('deal-market-card--selected', b.dataset.marketCard === selectedMarketCard);
      });
    });
  });

  // 시장 교환
  document.getElementById('deal-btn-swap')?.addEventListener('click', async () => {
    if (!selectedHandCard || !selectedMarketCard) return toast.warn('손패 카드와 시장 카드를 각각 선택해주세요');
    const btn = document.getElementById('deal-btn-swap');
    try {
      if (btn) btn.disabled = true;
      await marketSwap(currentRoom.id, selectedHandCard, selectedMarketCard);
      selectedHandCard = null; selectedMarketCard = null;
      toast.success('시장 교환 완료!');
    } catch (err) { toast.error(err.message || '교환 실패'); if (btn) btn.disabled = false; }
  });

  // 덱 드로우
  document.getElementById('deal-btn-draw')?.addEventListener('click', async () => {
    const btn = document.getElementById('deal-btn-draw');
    try {
      if (btn) btn.disabled = true;
      await drawCard(currentRoom.id);
      toast.success('카드를 드로우했어요');
    } catch (err) { toast.error(err.message || '드로우 실패'); if (btn) btn.disabled = false; }
  });

  // 세트 제출
  document.getElementById('deal-btn-cashin')?.addEventListener('click', async () => {
    if (!selectedHandCard) return toast.warn('제출할 카드 종류를 선택해주세요');
    const me = currentPlayers.find(p => p.uid === myUid());
    const counts = countCards(me?.hand || []);
    const count = counts[selectedHandCard] || 0;
    if (count < 3) return toast.warn(`${selectedHandCard} 카드가 3장 이상 필요합니다`);
    const btn = document.getElementById('deal-btn-cashin');
    try {
      if (btn) btn.disabled = true;
      await cashInSet(currentRoom.id, selectedHandCard, count);
      selectedHandCard = null;
      toast.success(`세트 제출! +${calcSetPoints(Math.min(count, 5))}점`);
    } catch (err) { toast.error(err.message || '세트 제출 실패'); if (btn) btn.disabled = false; }
  });

  // 거래 제안 폼 토글
  document.getElementById('deal-btn-propose')?.addEventListener('click', () => {
    showProposeForm = !showProposeForm;
    const form = document.getElementById('deal-propose-form');
    if (form) form.hidden = !showProposeForm;
  });
  document.getElementById('deal-propose-cancel')?.addEventListener('click', () => {
    showProposeForm = false;
    const form = document.getElementById('deal-propose-form');
    if (form) form.hidden = true;
  });

  // 거래 제안 제출
  document.getElementById('deal-propose-submit')?.addEventListener('click', async () => {
    const targetUid = document.getElementById('deal-propose-target')?.value;
    const offerRaw = (document.getElementById('deal-propose-offer')?.value || '').trim();
    const requestRaw = (document.getElementById('deal-propose-request')?.value || '').trim();
    if (!targetUid || !offerRaw || !requestRaw) return toast.warn('대상, 제공 카드, 요청 카드를 모두 입력해주세요');
    const offerCards = offerRaw.split(',').map(s => s.trim()).filter(Boolean);
    const requestCards = requestRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (!offerCards.length || !requestCards.length) return toast.warn('카드 이름을 올바르게 입력해주세요');
    const targetPlayer = currentPlayers.find(p => p.uid === targetUid);
    const btn = document.getElementById('deal-propose-submit');
    try {
      if (btn) btn.disabled = true;
      await proposeTrade(currentRoom.id, targetUid, targetPlayer?.name || '?', offerCards, requestCards);
      showProposeForm = false;
      const form = document.getElementById('deal-propose-form');
      if (form) form.hidden = true;
      toast.success('거래를 제안했어요');
    } catch (err) { toast.error(err.message || '제안 실패'); if (btn) btn.disabled = false; }
  });

  // 거래 수락/거절
  document.querySelectorAll('[data-accept-proposal]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const proposalId = btn.dataset.acceptProposal;
      try {
        btn.disabled = true;
        await acceptTrade(currentRoom.id, proposalId);
        toast.success('거래를 수락했어요!');
      } catch (err) { toast.error(err.message || '수락 실패'); btn.disabled = false; }
    });
  });
  document.querySelectorAll('[data-reject-proposal]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const proposalId = btn.dataset.rejectProposal;
      try {
        btn.disabled = true;
        await rejectTrade(currentRoom.id, proposalId);
        toast.info('거래를 거절했어요');
      } catch (err) { toast.error(err.message || '거절 실패'); btn.disabled = false; }
    });
  });

  // 턴 종료
  document.getElementById('deal-btn-end-turn')?.addEventListener('click', async () => {
    const btn = document.getElementById('deal-btn-end-turn');
    try {
      if (btn) btn.disabled = true;
      await endDealTurn(currentRoom.id);
      selectedHandCard = null; selectedMarketCard = null;
    } catch (err) { toast.error(err.message || '턴 종료 실패'); if (btn) btn.disabled = false; }
  });
}

function bindDoneEvents() {
  bindBack();
}
