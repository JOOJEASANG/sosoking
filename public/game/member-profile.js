import { auth, db, functions, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import { collection, doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const getGamePlayerProfiles = httpsCallable(functions, 'getGamePlayerProfiles');
let ownProfile = null;
let roomPlayers = [];
let safeProfiles = {};
let activeRoomId = '';
let lastPlayerSignature = '';
let profileFetchPending = false;
let unsubscribePlayers = null;

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanUrl(value) {
  const url = String(value || '').trim();
  return /^https:\/\//.test(url) ? url : '';
}

function currentRoomId() {
  return String(new URL(location.href).searchParams.get('room') || '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 6);
}

function hashCode(text) {
  let h = 0;
  for (const ch of String(text || '')) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function generatedAvatarUrl(name = '', seed = '') {
  const palettes = [
    ['#2b314f', '#c9a84c'], ['#233a34', '#8bd1a5'], ['#3d2a43', '#e2a3ff'],
    ['#3c2d24', '#f0b37e'], ['#233349', '#8ec5ff'], ['#3a2630', '#ff9fb8']
  ];
  const [bg, fg] = palettes[hashCode(`${name}|${seed}`) % palettes.length];
  const mark = escapeText(String(name || '소').trim().slice(0, 1).toUpperCase() || '소');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#101522"/></linearGradient></defs><rect width="160" height="160" rx="80" fill="url(#g)"/><circle cx="80" cy="80" r="70" fill="none" stroke="${fg}" stroke-opacity=".55" stroke-width="4"/><text x="80" y="98" text-anchor="middle" font-family="Arial,sans-serif" font-size="62" font-weight="700" fill="${fg}">${mark}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function avatarUrl(profile) {
  return cleanUrl(profile?.photoURL) || generatedAvatarUrl(profile?.nickname || '소', profile?.avatarSeed || profile?.uid || '');
}

function memberCardMarkup(profile) {
  return `<div class="game-member-card" data-game-member-card><img src="${escapeText(avatarUrl(profile))}" alt="${escapeText(profile.nickname || '회원')} 프로필" referrerpolicy="no-referrer"><div><strong>${escapeText(profile.nickname || '소소킹 회원')}<span class="game-member-badge">회원</span></strong><small>소소킹 회원 프로필로 참가합니다</small></div></div>`;
}

async function loadOwnProfile() {
  await initAuth();
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  if (!snap?.exists()) return null;
  const data = snap.data() || {};
  const nickname = String(data.nickname || user.displayName || '').trim();
  if (!nickname) return null;
  return {
    uid: user.uid,
    nickname,
    photoURL: cleanUrl(data.photoURL || user.photoURL || ''),
    avatarSeed: String(data.avatarSeed || user.uid),
    isMember: true
  };
}

function enhanceNicknameInput(input) {
  if (!input || !ownProfile) return;
  input.value = ownProfile.nickname;
  const field = input.closest('.field');
  if (field) field.hidden = true;
  const form = input.closest('form');
  if (form && !form.querySelector('[data-game-member-card]')) {
    const buttonRow = form.querySelector('.button-row');
    buttonRow?.insertAdjacentHTML('beforebegin', memberCardMarkup(ownProfile));
  }
}

function enhanceCreateForm() {
  const form = document.getElementById('create-room-form');
  if (!form) return;
  enhanceNicknameInput(document.getElementById('create-nickname'));
  if (!form.querySelector('[data-auto-code-note]')) {
    const note = document.createElement('p');
    note.className = 'game-auto-code-note';
    note.dataset.autoCodeNote = 'true';
    note.textContent = '방을 만들면 6자리 초대코드가 자동으로 생성됩니다.';
    form.querySelector('.button-row')?.insertAdjacentElement('afterend', note);
  }
}

function enhanceJoinForms() {
  enhanceNicknameInput(document.getElementById('join-nickname'));
  enhanceNicknameInput(document.getElementById('invite-nickname'));
}

function enhanceRoomCodeLabels() {
  document.querySelectorAll('.room-code small').forEach(label => {
    if (String(label.textContent || '').includes('초대 코드')) label.textContent = '자동 생성된 초대코드';
  });
}

function profileForVisibleName(value) {
  const text = String(value || '').trim();
  return Object.values(safeProfiles).find(profile => {
    const full = String(profile.nickname || '').trim();
    if (!full) return false;
    return text.includes(full) || text.includes(full.slice(0, 12));
  }) || null;
}

function decoratePlayerRows() {
  document.querySelectorAll('.player-item').forEach(item => {
    if (item.dataset.memberDecorated === 'true') return;
    const name = item.querySelector('.player-name');
    if (!name) return;
    const profile = profileForVisibleName(name.textContent);
    if (!profile) return;
    const textNode = [...name.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = profile.nickname;
    const wrap = document.createElement('span');
    wrap.className = 'game-member-avatar-wrap';
    wrap.innerHTML = `<img class="game-member-avatar" src="${escapeText(avatarUrl(profile))}" alt="${escapeText(profile.nickname)} 프로필" referrerpolicy="no-referrer">`;
    item.insertBefore(wrap, name);
    if (!name.querySelector('.game-member-badge')) name.insertAdjacentHTML('beforeend', '<span class="game-member-badge">회원</span>');
    item.classList.add('has-member-profile');
    item.dataset.memberDecorated = 'true';
  });

  document.querySelectorAll('.rank-item').forEach(item => {
    if (item.dataset.memberDecorated === 'true') return;
    const name = item.querySelector('.rank-name');
    if (!name) return;
    const profile = profileForVisibleName(name.textContent);
    if (!profile) return;
    name.textContent = profile.nickname;
    const wrap = document.createElement('span');
    wrap.className = 'game-member-avatar-wrap';
    wrap.innerHTML = `<img class="game-member-avatar" src="${escapeText(avatarUrl(profile))}" alt="${escapeText(profile.nickname)} 프로필" referrerpolicy="no-referrer">`;
    item.insertBefore(wrap, name);
    name.insertAdjacentHTML('beforeend', '<span class="game-member-badge">회원</span>');
    item.classList.add('has-member-profile');
    item.dataset.memberDecorated = 'true';
  });
}

async function refreshSafeProfiles() {
  const roomId = activeRoomId || currentRoomId();
  if (!roomId || profileFetchPending || !auth.currentUser) return;
  const me = roomPlayers.find(player => player.uid === auth.currentUser.uid);
  if (!me) return;
  profileFetchPending = true;
  try {
    const result = await getGamePlayerProfiles({ roomId });
    if (roomId !== activeRoomId) return;
    safeProfiles = result?.data?.profiles || {};
    enhanceDom();
  } catch (error) {
    console.warn('game member profiles skipped:', error?.code || error);
  } finally {
    profileFetchPending = false;
  }
}

function ensureRoomWatch() {
  const nextRoomId = currentRoomId();
  if (nextRoomId === activeRoomId) return;

  unsubscribePlayers?.();
  unsubscribePlayers = null;
  activeRoomId = nextRoomId;
  roomPlayers = [];
  safeProfiles = {};
  lastPlayerSignature = '';

  if (!activeRoomId) return;
  unsubscribePlayers = onSnapshot(collection(db, 'game_rooms', activeRoomId, 'players'), snap => {
    roomPlayers = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    const signature = roomPlayers.map(player => player.uid).sort().join('|');
    if (signature !== lastPlayerSignature) {
      lastPlayerSignature = signature;
      void refreshSafeProfiles();
    }
    enhanceDom();
  }, error => console.warn('game player profile watch skipped:', error?.code || error));
}

function enhanceDom() {
  ensureRoomWatch();
  enhanceCreateForm();
  enhanceJoinForms();
  enhanceRoomCodeLabels();
  decoratePlayerRows();
}

async function boot() {
  ownProfile = await loadOwnProfile().catch(() => null);
  enhanceDom();
  const observer = new MutationObserver(() => enhanceDom());
  observer.observe(document.getElementById('game-app') || document.body, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => unsubscribePlayers?.(), { once: true });
}

void boot();
