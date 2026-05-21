import { auth } from '../../firebase.js';
import { buildGameInviteUrl, esc, findMyPlayer, isRoomHost } from '../common.js';
import { renderGameChatHTML } from '../chat.js';

export function renderWordtrapLobbyHTML() {
  return `
    <div class="game-detail-page game-detail-page--wordtrap game-shell-polished">
      <section class="game-detail-hero wordtrap-hero">
        <button class="write-back-btn" id="wordtrap-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🚫</div>
        <div class="game-detail-hero__eyebrow">FORBIDDEN WORD CHAT</div>
        <h1>금칙어 채팅게임</h1>
        <p>각자에게 금칙어가 주어집니다. 자연스럽게 채팅하면서 내 금칙어를 절대 말하지 마세요. 말하는 순간 자동으로 걸립니다.</p>
        <div class="game-detail-hero__chips"><span>채팅 전용</span><span>자동 판정</span><span>2명부터 가능</span></div>
      </section>

      <section class="game-detail-card game-guide-card game-guide-card--steps">
        <div class="game-detail-card__head"><div><b>게임 설명</b><span>내 금칙어를 피하면서 상대를 유도하는 채팅 게임</span></div><i>🚫</i></div>
        <div class="game-guide-list">
          <div><b>1. 시작</b><span>방장이 주제를 고르고 게임을 시작하면 각자 금칙어가 배정됩니다.</span></div>
          <div><b>2. 대화</b><span>주제에 맞게 채팅하되, 내 금칙어는 절대 쓰면 안 됩니다.</span></div>
          <div><b>3. 유도</b><span>상대가 금칙어를 말하도록 질문하거나 상황을 만들어보세요.</span></div>
        </div>
      </section>

      <section class="game-detail-card game-create-panel">
        <div class="game-detail-card__head"><div><b>금칙어 방 만들기</b><span>2명 이상 추천</span></div><i>🚫</i></div>
        <div class="form-group"><label class="form-label">방 제목</label><input id="wordtrap-title" class="form-input" maxlength="40" value="금칙어 채팅게임" placeholder="방 제목"></div>
        <div class="liar-option-row">
          <div class="form-group"><label class="form-label">주제</label><select id="wordtrap-preset" class="form-select"><option value="daily">일상 토크</option><option value="food">음식 토크</option><option value="love">연애 토크</option><option value="random">랜덤 토크</option></select></div>
          <div class="form-group"><label class="form-label">최대 인원</label><select id="wordtrap-max" class="form-select"><option value="4">4명</option><option value="6" selected>6명</option><option value="8">8명</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">직접 금칙어 입력 <span style="color:var(--color-text-muted);font-size:12px">선택</span></label><input id="wordtrap-words" class="form-input" maxlength="80" placeholder="예: 근데, 진짜, 아니"></div>
        <button class="btn btn--primary" id="wordtrap-create">방 만들기</button>
      </section>
    </div>`;
}

export function renderWordtrapLoadingHTML() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

export function renderWordtrapNotFoundHTML() {
  return `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">방을 찾을 수 없어요</div><button class="btn btn--primary" onclick="navigate('/game/wordtrap')">금칙어 방 만들기</button></div>`;
}

export function renderWordtrapWrongGameHTML(game = '') {
  const target = game === 'liar' ? '/game/liar' : game === 'mafia' ? '/game/mafia' : '/sosoland';
  return `<div class="empty-state"><div class="empty-state__icon">🚫</div><div class="empty-state__title">금칙어 게임방이 아니에요</div><button class="btn btn--primary" onclick="navigate('${target}')">게임 이동</button></div>`;
}

function renderPlayer(player, room) {
  const isHost = player.uid === room.hostId || player.role === 'host';
  const isMe = auth.currentUser?.uid === player.uid;
  const out = player.alive === false;
  return `
    <div class="liar-player-item has-avatar ${isMe ? 'is-me' : ''} ${out ? 'is-dead' : ''}">
      <i class="game-player-avatar ${out ? 'game-player-avatar--dead' : isHost ? 'game-player-avatar--host' : 'game-player-avatar--player'}" aria-hidden="true"></i>
      <div class="liar-player-name"><span>${esc(player.name || '참가자')}</span>${isHost ? '<small>방장</small>' : ''}${isMe ? '<small>나</small>' : ''}</div>
      <b>${out ? '걸림' : room.status === 'playing' ? '생존' : '대기중'}</b>
    </div>`;
}

function renderSecretCard(room, me) {
  if (!me || room.status !== 'playing') return '';
  return `
    <section class="game-secret-card game-secret-card--wordtrap">
      <div>
        <small>내 금칙어</small>
        <b>${esc(me.myTrapWord || '확인중')}</b>
        <span>이 단어를 채팅에 쓰면 자동으로 걸립니다.</span>
      </div>
      <i>🚫</i>
    </section>`;
}

function renderPhaseCard(room, players) {
  const waiting = room.status === 'waiting';
  const alive = players.filter(p => p.alive !== false).length;
  return `
    <section class="game-phase-card">
      <div class="game-phase-card__step ${waiting ? 'active' : 'done'}"><b>1</b><span>입장</span></div>
      <div class="game-phase-card__line"></div>
      <div class="game-phase-card__step ${!waiting ? 'active' : ''}"><b>2</b><span>채팅</span></div>
      <div class="game-phase-card__line"></div>
      <div class="game-phase-card__step"><b>3</b><span>생존</span></div>
      <p>${waiting ? (players.length >= 2 ? '이제 방장이 게임을 시작할 수 있어요.' : '2명 이상이면 시작할 수 있어요.') : `생존 ${alive}명 · ${esc(room.log || '금칙어를 피하면서 대화하세요.')}`}</p>
    </section>`;
}

export function renderWordtrapRoomHTML(room, players = [], chats = []) {
  const me = findMyPlayer(players);
  const joined = !!me;
  const host = isRoomHost(room);
  const url = buildGameInviteUrl('wordtrap', room.id);
  const canStart = host && room.status === 'waiting' && players.length >= 2;
  const alive = players.filter(p => p.alive !== false).length;

  return `
    <div class="game-detail-page game-detail-page--wordtrap game-shell-polished">
      <section class="game-detail-hero wordtrap-hero">
        <button class="write-back-btn" id="wordtrap-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🚫</div>
        <div class="game-detail-hero__eyebrow">방 코드 ${esc(room.code || '')}</div>
        <h1>${esc(room.title || '금칙어 채팅게임')}</h1>
        <p>${esc(room.log || '참가자를 모은 뒤 방장이 게임을 시작하세요.')}</p>
        <div class="game-detail-hero__chips"><span>${room.status === 'waiting' ? '대기중' : '진행중'}</span><span>${esc(room.topic || '일상 토크')}</span><span>생존 ${alive}명</span></div>
        <div class="game-room-actions"><button class="btn btn--ghost btn--sm" id="wordtrap-copy">초대 링크 복사</button>${!joined ? '<button class="btn btn--primary btn--sm" id="wordtrap-join">참가하기</button>' : ''}</div>
      </section>

      <section class="liar-room-card game-stat-grid">
        <div class="liar-room-info"><span>상태</span><b>${room.status === 'waiting' ? '대기중' : '진행중'}</b></div>
        <div class="liar-room-info"><span>주제</span><b>${esc(room.topic || '-')}</b></div>
        <div class="liar-room-info"><span>참가자</span><b>${players.length}/${room.maxPlayers || 0}명</b></div>
        <div class="liar-room-info"><span>생존</span><b>${alive}명</b></div>
      </section>

      ${renderSecretCard(room, me)}
      ${renderPhaseCard(room, players)}

      <section class="liar-invite-card game-invite-compact">
        <label class="form-label">초대 링크</label>
        <div class="liar-invite-row"><input class="form-input" id="wordtrap-invite-url" value="${url}" readonly><button class="btn btn--primary btn--sm" id="wordtrap-copy">복사</button></div>
        <div class="form-hint">회원과 게스트가 같은 방에서 같이 플레이할 수 있습니다.</div>
      </section>

      <div class="game-room-grid">
        <section class="liar-player-card game-player-panel">
          <div class="game-panel-head"><h2>참가자</h2><span>${players.length}명</span></div>
          <div class="liar-player-list">${players.map(player => renderPlayer(player, room)).join('') || '<div class="hall-empty">참가자가 없습니다.</div>'}</div>
          ${host && room.status === 'waiting' ? `<button class="btn btn--primary btn--full" id="wordtrap-start" ${canStart ? '' : 'disabled'}>${canStart ? '게임 시작' : '2명 이상 필요'}</button>` : ''}
          ${host && room.status === 'playing' ? '<button class="btn btn--ghost btn--full" id="wordtrap-reset">새 게임 준비</button>' : ''}
        </section>

        ${renderGameChatHTML({
          room,
          chats,
          joined: joined && me?.alive !== false,
          inputId: 'wordtrap-chat-input',
          sendId: 'wordtrap-chat-send',
          title: '금칙어 채팅',
          hint: room.status === 'playing' ? '내 금칙어를 피하면서 자연스럽게 대화하세요.' : '게임이 시작되면 금칙어가 배정되고 채팅이 시작됩니다.',
        })}
      </div>
    </div>`;
}
