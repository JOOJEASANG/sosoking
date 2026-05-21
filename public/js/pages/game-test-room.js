import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const GAME_DATA = {
  liar: {
    title: '라이어게임',
    icon: '🕵️',
    eyebrow: 'VIRTUAL LIAR ROOM',
    code: 'LIAR-TEST',
    status: '가상 대기방',
    phase: '설명/질문 테스트',
    mainAction: '가상 게임 시작',
    resetAction: '방 초기화',
    note: '실제 DB에 방을 만들지 않고 화면 흐름만 확인하는 테스트용 페이지입니다. 방 생성, 참가자 목록, 초대 링크, 시작 버튼 배치를 빠르게 확인할 수 있습니다.',
    players: [
      { name: '방장 토끼', sub: '방장 · 제시어 확인 가능', role: '방장', type: 'safe' },
      { name: '참가자 민수', sub: '일반 참가자', role: '참가자', type: 'safe' },
      { name: '참가자 지아', sub: '라이어 후보', role: '비공개', type: 'hot' },
      { name: '참가자 현우', sub: '대기중', role: '참가자', type: 'safe' },
    ],
    stats: [
      ['상태', '대기중'],
      ['참가자', '4/6명'],
      ['라이어', '1명'],
      ['카테고리', '랜덤'],
    ],
    actions: ['초대 링크 복사', '참가하기', '제시어 확인', '투표 화면 보기'],
  },
  mafia: {
    title: '마피아게임',
    icon: '🌙',
    eyebrow: 'VIRTUAL MAFIA ROOM',
    code: 'MAFIA-TEST',
    status: '가상 진행방',
    phase: '1라운드 토론 테스트',
    mainAction: '투표 집계 테스트',
    resetAction: '새 게임 준비',
    note: '실제 Firestore 데이터를 건드리지 않는 마피아게임 테스트 화면입니다. 역할 배정, 생존자, 투표 버튼, 집계 버튼 위치를 확인하는 용도입니다.',
    players: [
      { name: '방장 토끼', sub: '방장 · 시민', role: '시민', type: 'safe' },
      { name: '참가자 민수', sub: '투표 2표', role: '마피아?', type: 'hot' },
      { name: '참가자 지아', sub: '투표 1표', role: '시민', type: 'safe' },
      { name: '참가자 현우', sub: '탈락 처리 예시', role: '탈락', type: 'dead' },
    ],
    stats: [
      ['상태', '진행중'],
      ['참가자', '4/6명'],
      ['생존', '3명'],
      ['마피아', '1명'],
    ],
    actions: ['초대 링크 복사', '참가하기', '민수에게 투표', '지아에게 투표'],
  },
};

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function ensureStyles() {
  if (document.querySelector('link[href="/css/game-test-room.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/game-test-room.css';
  document.head.appendChild(link);
}

function getGame(kind) {
  return GAME_DATA[kind] || GAME_DATA.liar;
}

function renderStats(game) {
  return game.stats.map(([label, value]) => `
    <div class="test-room-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>
  `).join('');
}

function renderPlayers(game) {
  return game.players.map((player, index) => `
    <div class="test-room-player">
      <div class="test-room-avatar">${index + 1}</div>
      <div><strong>${esc(player.name)}</strong><small>${esc(player.sub)}</small></div>
      <span class="test-room-role test-room-role--${esc(player.type)}">${esc(player.role)}</span>
    </div>
  `).join('');
}

function renderVoteButtons(game) {
  return game.players
    .filter(player => player.type !== 'dead')
    .map(player => `<button class="test-room-btn test-room-btn--ghost" type="button" data-test-toast="${esc(player.name)} 선택됨">${esc(player.name)}</button>`)
    .join('');
}

export function renderGameTestRoom(params = {}) {
  ensureStyles();
  const kind = params.kind === 'mafia' ? 'mafia' : 'liar';
  const game = getGame(kind);
  setMeta(`게임 테스트 · ${game.title}`);
  const el = document.getElementById('page-content');
  if (!el) return;

  const inviteUrl = `${location.origin}/#${kind === 'mafia' ? '/game/mafia/demo-room' : '/game/liar/demo-room'}`;

  el.innerHTML = `
    <div class="test-room-page test-room-page--${esc(kind)}">
      <div class="test-room-wrap">
        <div class="test-room-top">
          <button class="test-room-back" type="button" id="test-room-back">← 게임 목록</button>
          <span class="test-room-badge">실제 저장 없음 · 화면 테스트용</span>
        </div>

        <section class="test-room-hero">
          <div class="test-room-hero__icon">${game.icon}</div>
          <div class="test-room-kicker">${esc(game.eyebrow)}</div>
          <h1>${esc(game.title)}<br>가상 방 테스트</h1>
          <p>${esc(game.note)}</p>
          <div class="test-room-actions">
            <button class="test-room-btn test-room-btn--primary" type="button" data-test-toast="${esc(game.mainAction)} 완료">${esc(game.mainAction)}</button>
            <button class="test-room-btn test-room-btn--ghost" type="button" data-test-toast="${esc(game.resetAction)} 완료">${esc(game.resetAction)}</button>
            <button class="test-room-btn test-room-btn--ghost" type="button" id="test-real-room">실제 방 만들기 화면</button>
          </div>
        </section>

        <section class="test-room-grid">
          <div class="test-room-card">
            <h2>방 정보</h2>
            <div class="test-room-stats">${renderStats(game)}</div>
            <div class="test-room-actions">
              <span class="test-room-badge">방 코드 ${esc(game.code)}</span>
              <span class="test-room-badge">${esc(game.status)}</span>
              <span class="test-room-badge">${esc(game.phase)}</span>
            </div>
          </div>

          <div class="test-room-card test-room-panel">
            <h2>초대 링크 테스트</h2>
            <p class="test-room-note">복사 버튼은 실제 클립보드 동작까지 확인할 수 있습니다. 링크는 데모 주소이며 실제 방 데이터는 만들지 않습니다.</p>
            <div class="test-room-input-row">
              <input id="test-invite-url" value="${esc(inviteUrl)}" readonly>
              <button class="test-room-btn test-room-btn--primary" id="test-copy" type="button">복사</button>
            </div>
          </div>
        </section>

        <section class="test-room-grid">
          <div class="test-room-card">
            <h2>참가자 목록</h2>
            <div class="test-room-players">${renderPlayers(game)}</div>
          </div>

          <div class="test-room-card test-room-panel">
            <h2>버튼 동작 테스트</h2>
            <p class="test-room-note">아래 버튼은 실제 DB 작업 없이 토스트/상태만 확인합니다.</p>
            <div class="test-room-actions">
              ${game.actions.map(action => `<button class="test-room-btn test-room-btn--ghost" type="button" data-test-toast="${esc(action)} 테스트 완료">${esc(action)}</button>`).join('')}
            </div>
            <h2 style="margin-top:10px">투표 UI</h2>
            <div class="test-room-vote-grid">${renderVoteButtons(game)}</div>
          </div>
        </section>
      </div>
    </div>`;

  document.getElementById('test-room-back')?.addEventListener('click', () => navigate('/sosoland'));
  document.getElementById('test-real-room')?.addEventListener('click', () => navigate(kind === 'mafia' ? '/game/mafia' : '/game/liar'));
  document.getElementById('test-copy')?.addEventListener('click', async () => {
    const input = document.getElementById('test-invite-url');
    try {
      await navigator.clipboard.writeText(input?.value || inviteUrl);
      showMiniToast('초대 링크 복사 테스트 완료');
    } catch {
      input?.select?.();
      document.execCommand?.('copy');
      showMiniToast('초대 링크를 선택/복사했습니다');
    }
  });
  el.querySelectorAll('[data-test-toast]').forEach(btn => btn.addEventListener('click', () => showMiniToast(btn.dataset.testToast || '테스트 완료')));
}

function showMiniToast(message) {
  let box = document.getElementById('test-room-toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'test-room-toast';
    box.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;background:#111827;color:#fff;border-radius:999px;padding:12px 16px;font-weight:900;box-shadow:0 14px 40px rgba(0,0,0,.28);transition:.2s;';
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.style.opacity = '1';
  clearTimeout(showMiniToast.timer);
  showMiniToast.timer = setTimeout(() => { box.style.opacity = '0'; }, 1600);
}
