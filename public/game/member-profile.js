import { auth, db, functions, initAuth } from '/js/firebase.js?v=20260729-auth-session-1';
import { collection, doc, getDoc, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const getGamePlayerProfiles = httpsCallable(functions, 'getGamePlayerProfiles');
const GAME_GUIDES = {
  grid: {
    match: /^\/game\/grid(?:\/|$)/,
    emoji: '🏁',
    title: '칸폭주 30',
    meta: '2~8명 · 30칸 · 턴당 10초',
    goal: '내 5×6 진행판의 30칸을 가장 먼저 채우는 동시 선택 방해물 레이스입니다.',
    steps: ['앞에 놓인 장치를 확인합니다.', '질주·방어·역이용 중 한 도구를 모두 동시에 고릅니다.', '결과가 한꺼번에 적용되며 30칸을 먼저 채우면 승리합니다.'],
    scoring: ['질주는 기본 3칸, 방어는 2칸과 보호막, 역이용은 1칸과 고철을 얻습니다.', '고철 3개는 즉시 보너스 4칸으로 재조립됩니다.', '같은 턴에 함께 완주하면 남은 도장·보호막·고철을 합친 완주 파워로 순위를 정합니다.'],
    specials: ['🧱 이중벽은 도장 2개가 필요하고, 🕸️ 끈끈이는 지금과 다음 턴을 늦춥니다.', '🔒 정지문·💣 고철폭탄은 남은 도장을 멈추고, 🪞 반사판은 도장을 다음 턴으로 보냅니다.', '🚀 가속칸은 보너스 1칸을 주며, 모든 위험 장치는 보호하거나 고철로 바꿀 수 있습니다.'],
    tips: ['다음 장치가 평범하면 질주, 위험하면 방어가 안정적입니다.', '장치 직전에 역이용을 고르면 느리지만 고철 보너스로 크게 치고 나갈 수 있습니다.', '보호막은 최대 2개이므로 가득 찼을 때는 다른 도구를 고르세요.']
  },
  vault: {
    match: /^\/game\/vault(?:\/|$)/,
    emoji: '💰',
    title: '금고런',
    meta: '2~8명 · 9라운드 · 라운드 12초',
    goal: '다른 사람과 겹치지 않는 금고를 골라 가장 많은 코인을 모으는 눈치게임입니다.',
    steps: ['금고 5개 중 하나를 고릅니다.', '모두 고르면 선택이 동시에 공개됩니다.', '혼자 고른 금고는 성공, 같은 금고에 2명 이상 몰리면 충돌합니다.'],
    scoring: ['일반 금고는 화면에 보이는 코인을 획득합니다.', '연속 단독 성공은 콤보 보너스로 이어집니다.', '마지막 라운드는 기본 보상이 2배가 됩니다.'],
    specials: ['👑 황금 · ❓ 미스터리 · 🥷 도둑 · 🚀 역전 금고가 매 라운드 하나씩 섞입니다.', '미스터리 금고는 잭팟·보너스·빈 금고·폭탄 중 하나가 공개됩니다.', '마지막 라운드는 모든 금고의 기본 보상이 2배가 됩니다.'],
    tips: ['무조건 가장 큰 금고만 노리면 다른 사람과 겹치기 쉽습니다.', '앞 라운드에서 자주 고른 사람의 습관을 기억해 두세요.', '점수가 뒤처졌다면 역전 금고가 큰 기회가 될 수 있습니다.']
  },
  chosung: {
    match: /^\/game\/chosung(?:\/|$)/,
    emoji: '💣',
    title: '초성 폭탄',
    meta: '2~8명 · 7라운드 · 기본 25초',
    goal: '제시된 초성과 글자 수에 맞는 단어를 남들과 겹치지 않게 입력하는 순발력 게임입니다.',
    steps: ['화면의 2~4글자 초성을 확인합니다.', '초성 순서와 글자 수가 정확히 맞는 단어를 입력합니다.', '정답이어도 다른 사람과 같은 단어면 중복 폭탄으로 기본점수를 받지 못합니다.'],
    scoring: ['기본은 글자 수만큼 점수를 얻고, 더블/왕의 폭탄은 2배가 됩니다.', '기본 25초 · 번개 15초 · 더블 22초 · 왕의 폭탄 20초로 진행됩니다.', '초성이 맞아도 같은 단어가 겹치면 0점, 혼자 쓴 정답만 점수를 얻습니다.'],
    specials: ['⚡ 번개 라운드는 15초로 빠르게 진행됩니다.', '💥 더블과 👑 왕의 폭탄에서는 단독 정답 점수가 2배가 됩니다.', '라운드마다 2~4글자 초성이 섞여 템포와 난도가 달라집니다.'],
    tips: ['가장 먼저 떠오른 흔한 단어는 다른 사람도 생각했을 가능성이 큽니다.', '정답을 어렵게 만들 필요는 없고, “맞지만 덜 흔한 단어”가 가장 좋습니다.', '4글자 라운드는 점수가 크므로 긴 단어 후보를 미리 떠올려 보세요.']
  },
  mind: {
    match: /^\/game\/mind(?:\/|$)/,
    emoji: '🧠',
    title: '관심법',
    meta: '3~8명 · 참가자 수만큼 라운드 · 라운드 28초',
    goal: '라운드마다 바뀌는 관찰자가 친구들의 실제 선택을 얼마나 잘 맞히는지 겨루는 관계 심리게임입니다.',
    steps: ['관찰자는 친구 한 명씩 선택을 예측합니다.', '나머지는 관찰자에게 보이지 않게 실제 선택을 고릅니다.', '모두 고르면 실제 선택과 예측이 동시에 공개됩니다.'],
    scoring: ['관찰자가 한 사람을 맞힐 때마다 관찰자 +2점입니다.', '관찰자가 틀리면 선택을 숨긴 해당 참가자가 +1점입니다.', '모든 참가자가 한 번씩 관찰자가 된 뒤 총점 1위가 승리합니다.'],
    specials: ['진행 중에는 다른 참가자의 선택 원문이 공개되지 않습니다.', '관찰자는 모든 사람의 예측을 각각 완료해야 전원 선택으로 처리됩니다.', '참가자 수에 맞춰 3~8라운드로 자동 조정됩니다.'],
    tips: ['평소 취향보다 상황에서 실제로 할 행동을 떠올리세요.', '관찰자일 때는 한 기준으로 모두 찍기보다 사람별 습관을 나눠 보세요.', '선택지는 마감 전까지 바꿀 수 있습니다.']
  },
  alibi: {
    match: /^\/game\/alibi(?:\/|$)/,
    emoji: '🧾',
    title: '변명거래소',
    meta: '3~8명 · 3개 사건 · 작성 45초/베팅 25초',
    goal: '비밀 키워드를 자연스럽게 섞은 변명을 만들고, 익명 변명에 신뢰칩을 걸어 점수를 얻는 창작게임입니다.',
    steps: ['내 비밀 키워드를 포함해 12~100자의 변명을 씁니다.', '작성 시간이 끝나면 변명이 익명으로 공개됩니다.', '내 글을 제외한 변명 하나에 신뢰칩 1~3개를 걸고 작성자를 공개합니다.'],
    scoring: ['가장 많은 신뢰칩을 받은 작성자는 받은 칩만큼 점수를 얻습니다.', '시장 선택에 베팅하면 건 칩만큼 더하고, 빗나가면 그만큼 뺍니다.', '3개 사건이 끝난 뒤 총점 1위가 승리합니다.'],
    specials: ['작성 단계에는 다른 사람의 변명과 베팅이 보이지 않습니다.', '베팅 단계에는 변명만 익명 공개되고 베팅 내용은 결과 전까지 비공개입니다.', '최고 신뢰가 동점이면 동점 작성자 모두 시장 선택으로 인정됩니다.'],
    tips: ['키워드를 억지로 붙이지 말고 사건의 원인처럼 자연스럽게 숨기세요.', '3칩은 보상도 크지만 실패 감점도 큽니다.', '문체만 보고 사람을 맞히려 하기보다 변명의 설득력을 보세요.']
  }
};

let ownProfile = null;
let roomPlayers = [];
let safeProfiles = {};
let activeRoomId = '';
let roomData = null;
let roomAnswers = [];
let lastPlayerSignature = '';
let profileFetchPending = false;
let guideAutoOpened = false;
let unsubscribePlayers = null;
let unsubscribeRoomPolish = null;
let unsubscribeAnswersPolish = null;
let answerScope = '';

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

function currentGuide() {
  return Object.entries(GAME_GUIDES).find(([, guide]) => guide.match.test(location.pathname))?.[1] || null;
}

function currentGameId() {
  return Object.entries(GAME_GUIDES).find(([, guide]) => guide.match.test(location.pathname))?.[0] || '';
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

function guideSeenKey() {
  return `sosoking-game-guide-seen:${currentGameId()}`;
}

function hasSeenGuide() {
  try { return localStorage.getItem(guideSeenKey()) === '1'; }
  catch { return false; }
}

function markGuideSeen() {
  try { localStorage.setItem(guideSeenKey(), '1'); } catch {}
}

function guideListMarkup(items = []) {
  return `<ul>${items.map(item => `<li>${escapeText(item)}</li>`).join('')}</ul>`;
}

function guideStepsMarkup(items = []) {
  return `<ol class="game-guide-steps">${items.map((item, index) => `<li><span>${index + 1}</span><p>${escapeText(item)}</p></li>`).join('')}</ol>`;
}

function closeGuide() {
  document.querySelector('.game-guide-backdrop')?.remove();
  document.body.classList.remove('game-guide-open');
}

function openGuide() {
  const guide = currentGuide();
  if (!guide) return;
  markGuideSeen();
  closeGuide();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-guide-backdrop';
  backdrop.innerHTML = `
    <section class="game-guide-modal" role="dialog" aria-modal="true" aria-labelledby="game-guide-title">
      <header class="game-guide-header">
        <div><span>GAME GUIDE</span><h2 id="game-guide-title">${guide.emoji} ${escapeText(guide.title)} 이용설명</h2><p>${escapeText(guide.meta)}</p></div>
        <button type="button" class="game-guide-close" aria-label="게임 설명 닫기">×</button>
      </header>
      <div class="game-guide-body">
        <div class="game-guide-goal"><b>🎯 목표</b><p>${escapeText(guide.goal)}</p></div>
        <section><h3>이렇게 하면 됩니다</h3>${guideStepsMarkup(guide.steps)}</section>
        <section><h3>점수 / 승리</h3>${guideListMarkup(guide.scoring)}</section>
        <section><h3>특수 기능</h3>${guideListMarkup(guide.specials)}</section>
        <section class="game-guide-tip"><h3>💡 이기기 팁</h3>${guideListMarkup(guide.tips)}</section>
      </div>
      <footer><button type="button" class="game-guide-ok">설명 확인 · 게임하러 가기</button></footer>
    </section>`;
  backdrop.addEventListener('click', event => { if (event.target === backdrop) closeGuide(); });
  backdrop.querySelector('.game-guide-close')?.addEventListener('click', closeGuide);
  backdrop.querySelector('.game-guide-ok')?.addEventListener('click', closeGuide);
  document.body.append(backdrop);
  document.body.classList.add('game-guide-open');
  backdrop.querySelector('.game-guide-close')?.focus();
}

function mountGuideControls() {
  const guide = currentGuide();
  if (!guide) return;
  if (!document.querySelector('.game-guide-fab')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-guide-fab';
    button.innerHTML = '<span>?</span>';
    button.setAttribute('aria-label', `${guide.title} 게임 이용설명 보기`);
    button.title = '게임 이용설명';
    button.addEventListener('click', openGuide);
    document.body.append(button);
  }

  const panel = document.querySelector('#game-app .panel');
  const shouldInline = panel && (!activeRoomId || roomData?.status === 'lobby');
  if (shouldInline && !panel.querySelector('.game-guide-inline')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-guide-inline';
    button.textContent = '📖 게임 이용설명';
    button.addEventListener('click', openGuide);
    const lead = panel.querySelector('.lead');
    if (lead) lead.insertAdjacentElement('afterend', button);
    else panel.insertAdjacentElement('afterbegin', button);
  }
}

function maybeAutoOpenGuide() {
  if (guideAutoOpened || !currentGuide() || hasSeenGuide()) return;
  if (activeRoomId && !roomData) return;
  if (activeRoomId && roomData?.status !== 'lobby') return;
  guideAutoOpened = true;
  setTimeout(() => {
    if (!document.querySelector('.game-guide-backdrop')) openGuide();
  }, 450);
}

function getInitials(value) {
  const initials = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return Array.from(String(value || '')).map(char => {
    if (initials.includes(char)) return char;
    const offset = char.charCodeAt(0) - 0xac00;
    return offset >= 0 && offset <= 11171 ? initials[Math.floor(offset / 588)] : '';
  }).join('');
}

function normalizedAnswer(value) {
  return String(value || '').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

function playerName(uid) {
  return roomPlayers.find(player => player.uid === uid)?.nickname || '플레이어';
}

function scoreUnit() {
  return currentGameId() === 'vault' ? 'C' : '점';
}

function pressureThreshold() {
  return { vault: 250, chosung: 3 }[currentGameId()] || 0;
}

function upsertPanelCard(selector, className, html, afterSelector = '') {
  const panel = document.querySelector('#game-app .panel');
  if (!panel) return;
  let node = panel.querySelector(selector);
  if (!html) { node?.remove(); return; }
  if (!node) {
    node = document.createElement('div');
    node.className = className;
    if (afterSelector) panel.querySelector(afterSelector)?.insertAdjacentElement('afterend', node);
    if (!node.isConnected) panel.insertAdjacentElement('afterbegin', node);
  }
  if (node.dataset.html !== html) {
    node.dataset.html = html;
    node.innerHTML = html;
  }
}

function pressureMarkup() {
  if (!roomData || roomData.status !== 'playing' || roomData.roundState !== 'open' || roomPlayers.length < 2) return '';
  const ranking = [...roomPlayers].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const leader = ranking[0];
  const second = ranking[1];
  const gap = Math.max(0, Number(leader?.score || 0) - Number(second?.score || 0));
  if (gap > pressureThreshold()) return '';
  const me = auth.currentUser?.uid || '';
  const mine = ranking.find(player => player.uid === me);
  const message = leader?.uid === me
    ? `현재 1위지만 ${escapeText(second?.nickname || '2위')}가 ${gap}${scoreUnit()} 차로 바로 뒤에 있습니다.`
    : mine ? `1위 ${escapeText(leader?.nickname || '플레이어')}까지 ${Math.max(0, Number(leader?.score || 0) - Number(mine.score || 0))}${scoreUnit()} 차. 한 번이면 뒤집힐 수 있습니다.` : `1위와 2위가 ${gap}${scoreUnit()} 차입니다.`;
  return `<span>⚔️ 초접전</span><b>${message}</b>`;
}

function revealKey() {
  if (!roomData || roomData.roundState !== 'reveal') return '';
  return `${activeRoomId}:${currentGameId()}:${Number(roomData.round || 0)}:${Number(roomData.stage || 0)}`;
}

function ownRoundPositive() {
  const uid = auth.currentUser?.uid || '';
  if (!uid || !roomData) return false;
  if (currentGameId() === 'vault') {
    const result = (Array.isArray(roomData.lastResults) ? roomData.lastResults : []).find(item => item.uid === uid);
    return Number(result?.delta || 0) > 0;
  }
  if (currentGameId() === 'chosung') {
    const mine = roomAnswers.find(item => item.uid === uid && item.kind === 'chosung' && Number(item.round) === Number(roomData.round));
    if (!mine || getInitials(mine.text || '') !== String(roomData.target || '')) return false;
    return roomAnswers.filter(item => item.kind === 'chosung' && Number(item.round) === Number(roomData.round) && getInitials(item.text || '') === String(roomData.target || '') && normalizedAnswer(item.text) === normalizedAnswer(mine.text)).length === 1;
  }
  return false;
}

function streakStorageKey() {
  return `sosoking-round-streak:${currentGameId()}:${activeRoomId}:${auth.currentUser?.uid || ''}`;
}

function updateAndReadStreak() {
  const key = revealKey();
  if (!key) return { current: 0, best: 0 };
  let state = { processed: '', current: 0, best: 0 };
  try { state = { ...state, ...JSON.parse(sessionStorage.getItem(streakStorageKey()) || '{}') }; } catch {}
  if (state.processed !== key) {
    state.current = ownRoundPositive() ? Number(state.current || 0) + 1 : 0;
    state.best = Math.max(Number(state.best || 0), Number(state.current || 0));
    state.processed = key;
    try { sessionStorage.setItem(streakStorageKey(), JSON.stringify(state)); } catch {}
  }
  return state;
}

function revealStoryMarkup() {
  if (!roomData || roomData.status !== 'playing' || roomData.roundState !== 'reveal') return '';
  const game = currentGameId();
  const results = Array.isArray(roomData.lastResults) ? roomData.lastResults : [];
  let title = '🎲 이번 라운드 한눈에';
  let text = '다음 라운드에서 바로 뒤집을 수 있습니다.';

  if (game === 'vault') {
    const collisions = results.filter(item => item.status === 'collision');
    const best = [...results].sort((a, b) => Number(b.delta || 0) - Number(a.delta || 0))[0];
    if (collisions.length >= 2) {
      title = '💥 금고 앞 대참사';
      text = `${collisions.length}명이 충돌했습니다. ${best && Number(best.delta || 0) > 0 ? `${playerName(best.uid)}는 +${Number(best.delta)}C로 틈새를 챙겼습니다.` : '이번 판은 큰 금고보다 눈치가 더 중요했습니다.'}`;
    } else if (best && Number(best.delta || 0) > 0) {
      title = '💰 이번 판 최고 한탕';
      text = `${playerName(best.uid)}가 한 번에 +${Number(best.delta)}C를 챙겼습니다.`;
    }
  }

  if (game === 'chosung') {
    const roundAnswers = roomAnswers.filter(item => item.kind === 'chosung' && Number(item.round) === Number(roomData.round));
    const valid = roundAnswers.filter(item => getInitials(item.text || '') === String(roomData.target || ''));
    const counts = new Map();
    valid.forEach(item => counts.set(normalizedAnswer(item.text), (counts.get(normalizedAnswer(item.text)) || 0) + 1));
    const unique = valid.filter(item => (counts.get(normalizedAnswer(item.text)) || 0) === 1);
    const duplicatePlayers = valid.length - unique.length;
    const fastest = [...unique].sort((a, b) => Number(a.createdAt?.toMillis?.() || 9e15) - Number(b.createdAt?.toMillis?.() || 9e15))[0];
    if (duplicatePlayers >= 2) {
      title = '💣 텔레파시 폭발';
      text = `${duplicatePlayers}명이 다른 사람과 답이 겹쳤습니다.${fastest ? ` 가장 빠른 단독 정답은 ${playerName(fastest.uid)}의 “${escapeText(fastest.text)}”.` : ''}`;
    } else if (fastest) {
      title = '⚡ 단독 정답 포착';
      text = `${playerName(fastest.uid)}가 “${escapeText(fastest.text)}”로 빠르게 단독 정답을 만들었습니다.`;
    } else {
      title = '🫥 폭탄만 남았습니다';
      text = '이번 라운드는 단독 정답이 없었습니다. 다음 초성에서 다시 노려보세요.';
    }
  }

  const streak = updateAndReadStreak();
  const streakHtml = streak.current >= 2 ? `<em>🔥 내 ${streak.current}연속 성공 중</em>` : streak.best >= 3 ? `<em>🏅 이번 게임 최고 ${streak.best}연속 성공</em>` : '';
  return `<span>ROUND HIGHLIGHT</span><b>${title}</b><p>${text}</p>${streakHtml}`;
}

function enhanceGameMoments() {
  upsertPanelCard('.game-pressure-card', 'game-pressure-card', pressureMarkup());
  upsertPanelCard('.game-round-story', 'game-round-story', revealStoryMarkup());
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

function ensureAnswersWatch() {
  const uid = auth.currentUser?.uid || '';
  const me = roomPlayers.some(player => player.uid === uid);
  if (!activeRoomId || !me) {
    unsubscribeAnswersPolish?.();
    unsubscribeAnswersPolish = null;
    answerScope = '';
    roomAnswers = [];
    return;
  }
  const openRound = !roomData || (roomData.status === 'playing' && roomData.roundState === 'open');
  const nextScope = openRound && roomData?.hostUid !== uid ? 'mine' : 'all';
  if (unsubscribeAnswersPolish && answerScope === nextScope) return;
  unsubscribeAnswersPolish?.();
  unsubscribeAnswersPolish = null;
  answerScope = nextScope;
  roomAnswers = [];
  const base = collection(db, 'game_rooms', activeRoomId, 'answers');
  const source = nextScope === 'mine' ? query(base, where('uid', '==', uid)) : base;
  unsubscribeAnswersPolish = onSnapshot(source, snap => {
    roomAnswers = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    enhanceDom();
  }, error => {
    unsubscribeAnswersPolish = null;
    answerScope = '';
    console.warn('game highlight answers skipped:', error?.code || error);
  });
}

function ensureRoomWatch() {
  const nextRoomId = currentRoomId();
  if (nextRoomId === activeRoomId) return;

  unsubscribePlayers?.();
  unsubscribeRoomPolish?.();
  unsubscribeAnswersPolish?.();
  unsubscribePlayers = null;
  unsubscribeRoomPolish = null;
  unsubscribeAnswersPolish = null;
  answerScope = '';
  activeRoomId = nextRoomId;
  roomPlayers = [];
  roomData = null;
  roomAnswers = [];
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
    ensureAnswersWatch();
    enhanceDom();
  }, error => console.warn('game player profile watch skipped:', error?.code || error));

  unsubscribeRoomPolish = onSnapshot(doc(db, 'game_rooms', activeRoomId), snap => {
    roomData = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    ensureAnswersWatch();
    enhanceDom();
  }, error => console.warn('game room polish watch skipped:', error?.code || error));
}

function enhanceDom() {
  ensureRoomWatch();
  enhanceCreateForm();
  enhanceJoinForms();
  enhanceRoomCodeLabels();
  decoratePlayerRows();
  mountGuideControls();
  maybeAutoOpenGuide();
  enhanceGameMoments();
}

async function boot() {
  ownProfile = await loadOwnProfile().catch(() => null);
  enhanceDom();
  const observer = new MutationObserver(() => enhanceDom());
  observer.observe(document.getElementById('game-app') || document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeGuide(); });
  window.addEventListener('pagehide', () => {
    unsubscribePlayers?.();
    unsubscribeRoomPolish?.();
    unsubscribeAnswersPolish?.();
  }, { once: true });
}

void boot();
