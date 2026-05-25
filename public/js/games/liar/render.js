import { buildGameInviteUrl, esc, findMyPlayer, isRoomHost } from '../common.js';
import { renderGameChatHTML } from '../chat.js';
import { auth } from '../../firebase.js';

const CATEGORY_LABELS = {
  food: '음식', place: '장소', thing: '물건', animal: '동물', job: '직업', random: '랜덤',
};

const DIFFICULTY_LABELS = { easy: '😊 쉬움', normal: '😐 보통', hard: '😈 어려움' };

export function renderLiarLobbyHTML() {
  return `
    <div class="game-ai-shell">
      <section class="liar-hero-v2">
        <button class="game-back-btn" id="liar-back" type="button" aria-label="뒤로">←</button>
        <div class="hero-eyebrow">🕵️ FIND THE AI · LIAR GAME</div>
        <h1>라이어게임</h1>
        <p>AI가 라이어로 위장 참가합니다.<br>채팅으로 제시어를 설명하며 숨은 AI를 찾아내세요.</p>
        <div class="game-hero-chips">
          <span>🤖 AI 라이어</span><span>💬 채팅 추리</span><span>🎯 난이도 선택</span>
        </div>
      </section>

      <section class="game-guide-v2 game-guide-v2--liar">
        <div class="game-guide-v2__head">HOW TO PLAY</div>
        <div class="game-guide-steps">
          <div class="game-guide-step">
            <div class="game-guide-step__num">1</div>
            <div class="game-guide-step__text"><b><span class="game-guide-step__icon">🚪</span>입장</b><span>방을 만들고 초대 링크로 친구들을 초대하세요. 3명부터 시작 가능합니다.</span></div>
          </div>
          <div class="game-guide-step">
            <div class="game-guide-step__num">2</div>
            <div class="game-guide-step__text"><b><span class="game-guide-step__icon">🔑</span>제시어 확인</b><span>시민은 제시어를 받고, AI 라이어는 카테고리만 알고 있습니다.</span></div>
          </div>
          <div class="game-guide-step">
            <div class="game-guide-step__num">3</div>
            <div class="game-guide-step__text"><b><span class="game-guide-step__icon">💬</span>채팅 추리</b><span>모두가 제시어를 자연스럽게 설명합니다. 어색하게 대답하는 AI를 찾아내세요!</span></div>
          </div>
          <div class="game-guide-step">
            <div class="game-guide-step__num">4</div>
            <div class="game-guide-step__text"><b><span class="game-guide-step__icon">🕵️</span>AI 공개</b><span>투표로 라이어를 지목하면 AI인지 밝혀집니다. 시민이 AI를 잡으면 승리!</span></div>
          </div>
        </div>
      </section>

      <section class="game-create-v2">
        <h2>방 만들기</h2>
        <div class="form-group">
          <label class="form-label">방 제목</label>
          <input id="liar-title" class="form-input" maxlength="40" value="라이어게임" placeholder="방 제목">
        </div>
        <div class="form-group">
          <label class="form-label">카테고리</label>
          <select id="liar-category" class="form-select">
            <option value="food">🍕 음식</option>
            <option value="place">🏢 장소</option>
            <option value="thing">📦 물건</option>
            <option value="animal">🐾 동물</option>
            <option value="job">💼 직업</option>
            <option value="random">🎲 랜덤</option>
          </select>
        </div>
        <div class="game-option-row">
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

        <div class="form-group">
          <label class="form-label">🤖 AI 라이어</label>
          <div class="ai-toggle-row">
            <div>
              <div class="ai-toggle-row__label">AI를 라이어로 참가시키기</div>
              <div class="ai-toggle-row__sub">AI가 제시어를 모르는 라이어로 위장합니다</div>
            </div>
            <label class="ai-switch">
              <input type="checkbox" id="liar-with-ai" checked>
              <span class="ai-switch__track"></span>
            </label>
          </div>
        </div>

        <div id="liar-difficulty-group" class="form-group">
          <label class="form-label">AI 난이도</label>
          <input type="hidden" id="liar-difficulty" value="normal">
          <div class="difficulty-toggle">
            <button type="button" class="difficulty-btn" data-difficulty="easy">😊 쉬움</button>
            <button type="button" class="difficulty-btn active" data-difficulty="normal">😐 보통</button>
            <button type="button" class="difficulty-btn" data-difficulty="hard">😈 어려움</button>
          </div>
          <div class="form-hint" id="liar-difficulty-hint">AI가 약간의 어색함을 내비쳐 잡기 쉬운 편이에요.</div>
        </div>

        <button class="btn btn--primary btn--full" id="liar-create" style="margin-top:4px">방 만들기</button>
      </section>

      <div class="game-tip-v2">AI 난이도 <b>어려움</b>은 인터넷 슬랭까지 구사해 구별이 매우 어렵습니다. 주의 깊게 관찰하세요!</div>
    </div>`;
}

export function renderLiarLoadingHTML() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

export function renderLiarNotFoundHTML() {
  return `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">방을 찾을 수 없어요</div><button class="btn btn--primary" onclick="navigate('/game/liar')">라이어게임 방 만들기</button></div>`;
}

export function renderLiarWrongGameHTML(game = '') {
  const target = game === 'mafia' ? '/game/mafia' : '/sosoland';
  const label = game === 'mafia' ? '마피아게임으로 이동' : '게임 목록으로 이동';
  return `<div class="empty-state"><div class="empty-state__icon">🚫</div><div class="empty-state__title">라이어게임 방이 아니에요</div><button class="btn btn--primary" onclick="navigate('${target}')">${label}</button></div>`;
}

function renderPlayerItem(player, room) {
  const isHost = player.uid === room.hostId || player.role === 'host';
  const isMe = auth.currentUser?.uid === player.uid;
  const initial = String(player.name || '?').slice(0, 1).toUpperCase();
  let statusText = '대기중';
  if (room.status === 'playing') {
    statusText = player.assignedRole === 'liar' && isMe ? '🤫 라이어' : '참가중';
  }
  return `
    <div class="game-player-item-v2 ${isMe ? 'is-me' : ''}">
      <div class="game-player-avatar-v2 ${isHost ? 'game-player-avatar-v2--host' : ''}">${esc(initial)}</div>
      <div class="game-player-info">
        <div class="game-player-info__name">
          ${esc(player.name || '참가자')}
          ${isHost ? '<span class="game-player-info__tag">방장</span>' : ''}
          ${isMe ? '<span class="game-player-info__tag" style="color:var(--color-primary)">나</span>' : ''}
        </div>
      </div>
      <div class="game-player-votes">${esc(statusText)}</div>
    </div>`;
}

function renderMySecretCard(room, me) {
  if (!me || room.status !== 'playing') return '';
  const isLiar = me.assignedRole === 'liar';
  return `
    <div class="game-secret-v2 ${isLiar ? 'game-secret-v2--liar' : ''}">
      <div class="game-secret-v2__icon">${isLiar ? '🤫' : '🔐'}</div>
      <div>
        <div class="game-secret-v2__role">${isLiar ? '당신은 라이어입니다' : '당신의 제시어'}</div>
        <div class="game-secret-v2__word">${isLiar ? '제시어를 모릅니다' : esc(room.word || '')}</div>
        <div class="game-secret-v2__hint">${isLiar ? `카테고리: ${esc(room.topic || CATEGORY_LABELS[room.category] || '-')}` : '너무 직접적으로 말하면 라이어에게 힌트가 됩니다.'}</div>
      </div>
    </div>`;
}

function renderAiRevealCard(room, players) {
  if (room.status !== 'ended' || !room.aiPlayerUid) return '';
  const aiPlayer = players.find(p => p.uid === room.aiPlayerUid);
  const aiName = aiPlayer?.name || room.aiPlayerName || 'AI';
  const diff = DIFFICULTY_LABELS[room.aiDifficulty] || '보통';
  return `
    <div class="ai-reveal-card">
      <div class="ai-reveal-card__icon">🤖</div>
      <div class="ai-reveal-card__title">AI의 정체가 밝혀졌습니다!</div>
      <div class="ai-reveal-card__name">${esc(aiName)}</div>
      <div class="ai-reveal-card__desc">이 플레이어가 AI(Gemini)였습니다<br>난이도: ${esc(diff)}</div>
    </div>`;
}

function renderPhaseCard(room, players) {
  const waiting = room.status === 'waiting';
  const playing = room.status === 'playing';
  const ended = room.status === 'ended';
  const enough = players.length >= 3;
  const hasAI = !!room.withAI;

  return `
    <div class="game-phase-v2">
      <div class="game-phase-steps">
        <div class="game-phase-step ${waiting ? 'active' : 'done'}">
          <div class="game-phase-step__num">${waiting ? '1' : '✓'}</div>
          <div class="game-phase-step__label">입장</div>
        </div>
        <div class="game-phase-line ${!waiting ? 'done' : ''}"></div>
        <div class="game-phase-step ${playing ? 'active' : ended ? 'done' : ''}">
          <div class="game-phase-step__num">${ended ? '✓' : '2'}</div>
          <div class="game-phase-step__label">추리</div>
        </div>
        <div class="game-phase-line ${ended ? 'done' : ''}"></div>
        <div class="game-phase-step ${ended ? 'active' : ''}">
          <div class="game-phase-step__num">3</div>
          <div class="game-phase-step__label">공개</div>
        </div>
      </div>
      <div class="game-phase-log">
        ${waiting
          ? enough ? `참가자 ${players.length}명 대기중${hasAI ? ' · 🤖 AI 참가 예정' : ''} — 방장이 시작하면 돼요`
                   : '최소 3명이 모여야 시작할 수 있어요'
          : esc(room.log || '채팅으로 토론하세요')}
      </div>
    </div>`;
}

export function renderLiarRoomHTML(room, players = [], chats = []) {
  const url = buildGameInviteUrl('liar', room.id);
  const visiblePlayers = players.length ? players : [{ uid: room.hostId, name: room.hostName || '방장', role: 'host' }];
  const me = findMyPlayer(visiblePlayers);
  const joined = !!me;
  const host = isRoomHost(room);
  const canStart = host && room.status === 'waiting' && visiblePlayers.filter(p => !p.isAI).length >= 3;
  const category = room.topic || CATEGORY_LABELS[room.category] || room.category || '-';
  const hasAI = !!(room.withAI || room.aiPlayerUid);
  const diff = DIFFICULTY_LABELS[room.aiDifficulty] || '';

  return `
    <div class="game-ai-shell">
      <section class="liar-hero-v2 liar-hero-v2--room">
        <button class="game-back-btn" id="liar-back" type="button" aria-label="뒤로">←</button>
        <div class="hero-eyebrow">방 코드 ${esc(room.code || '')}</div>
        <h1>${esc(room.title || '라이어게임')}</h1>
        <p>${esc(room.log || '초대 링크를 공유해 친구들을 불러오세요.')}</p>
        <div class="game-hero-chips">
          <span>${room.status === 'waiting' ? '대기중' : room.status === 'ended' ? '종료' : '진행중'}</span>
          <span>${esc(category)}</span>
          <span>${visiblePlayers.length}/${room.maxPlayers || 0}명</span>
          ${hasAI ? `<span>🤖 AI ${diff}</span>` : ''}
        </div>
        <div class="game-room-actions">
          <button class="btn btn--ghost btn--sm" data-copy-invite>초대 복사</button>
          ${!joined ? '<button class="btn btn--primary btn--sm" id="liar-join">참가하기</button>' : ''}
        </div>
      </section>

      ${renderMySecretCard(room, me)}
      ${renderPhaseCard(room, visiblePlayers)}

      <div class="game-invite-v2">
        <input class="form-input" style="flex:1;font-size:12px" value="${url}" readonly>
        <button class="btn btn--primary btn--sm" data-copy-invite>복사</button>
      </div>

      ${renderAiRevealCard(room, visiblePlayers)}

      <div class="game-room-grid-v2">
        <section class="game-card-v2">
          <div class="game-card-v2__head">
            <h2>참가자</h2>
            <span>${visiblePlayers.length}명</span>
          </div>
          <div class="game-player-list-v2">
            ${visiblePlayers.filter(p => !p.isAI || room.status === 'ended').map(p => renderPlayerItem(p, room)).join('')}
          </div>
          ${host ? `<div style="margin-top:10px">
            <button class="btn btn--primary btn--full" id="liar-start" ${canStart ? '' : 'disabled'}>
              ${room.status === 'waiting' ? (canStart ? '🎮 게임 시작' : '3명 이상 필요') : room.status === 'ended' ? '게임 종료' : '진행중'}
            </button>
          </div>` : ''}
        </section>

        ${renderGameChatHTML({
          room,
          chats,
          joined,
          inputId: 'liar-chat-input',
          sendId: 'liar-chat-send',
          title: '채팅 추리',
          hint: room.status === 'playing' ? '제시어를 직접 말하지 말고 자연스럽게 설명하세요. AI를 찾아내세요!' : '참가자가 모이면 여기서 토론합니다.',
        })}
      </div>
    </div>`;
}
