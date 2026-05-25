import { buildGameInviteUrl, esc, findMyPlayer, isRoomHost } from '../common.js';
import { renderGameChatHTML } from '../chat.js';
import { alivePlayers, roleLabel, roleGuide, voteCounts } from './rules.js';
import { auth } from '../../firebase.js';

const DIFFICULTY_LABELS = { easy: '😊 쉬움', normal: '😐 보통', hard: '😈 어려움' };

export function renderMafiaLobbyHTML() {
  return `
    <div class="game-ai-shell">
      <section class="mafia-hero-v2">
        <button class="game-back-btn" id="mafia-back" type="button" aria-label="뒤로">←</button>
        <div class="hero-eyebrow">🌙 FIND THE AI · MAFIA GAME</div>
        <h1>마피아게임</h1>
        <p>AI가 마피아로 잠입합니다.<br>채팅으로 토론하며 숨은 AI를 찾아 투표하세요.</p>
        <div class="game-hero-chips">
          <span>🤖 AI 마피아</span><span>💬 채팅 토론</span><span>🗳️ 투표 처형</span>
        </div>
      </section>

      <section class="game-guide-v2 game-guide-v2--mafia">
        <div class="game-guide-v2__head">HOW TO PLAY</div>
        <div class="game-guide-steps">
          <div class="game-guide-step">
            <div class="game-guide-step__num">1</div>
            <div class="game-guide-step__text"><b><span class="game-guide-step__icon">👥</span>역할 배정</b><span>방장이 게임을 시작하면 시민·마피아 역할이 배정됩니다. AI는 항상 마피아입니다.</span></div>
          </div>
          <div class="game-guide-step">
            <div class="game-guide-step__num">2</div>
            <div class="game-guide-step__text"><b><span class="game-guide-step__icon">💬</span>채팅 토론</b><span>채팅으로 의심되는 사람에게 질문하고 방어하세요. AI도 직접 채팅에 참여합니다!</span></div>
          </div>
          <div class="game-guide-step">
            <div class="game-guide-step__num">3</div>
            <div class="game-guide-step__text"><b><span class="game-guide-step__icon">🗳️</span>투표 처형</b><span>가장 의심되는 플레이어에게 투표하세요. 방장이 집계하면 최다 득표자가 탈락합니다.</span></div>
          </div>
          <div class="game-guide-step">
            <div class="game-guide-step__num">4</div>
            <div class="game-guide-step__text"><b><span class="game-guide-step__icon">🏆</span>승리 조건</b><span>시민팀은 마피아를 모두 처형하면 승리! 마피아 수≥시민 수가 되면 마피아 승리!</span></div>
          </div>
        </div>
      </section>

      <section class="game-create-v2">
        <h2>방 만들기</h2>
        <div class="form-group">
          <label class="form-label">방 제목</label>
          <input id="mafia-title" class="form-input" maxlength="40" value="마피아게임" placeholder="방 제목">
        </div>
        <div class="game-option-row">
          <div class="form-group">
            <label class="form-label">최대 인원</label>
            <select id="mafia-max" class="form-select">
              <option value="4">4명</option>
              <option value="6" selected>6명</option>
              <option value="8">8명</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">마피아 수</label>
            <select id="mafia-count" class="form-select">
              <option value="1" selected>1명</option>
              <option value="2">2명</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">🤖 AI 마피아</label>
          <div class="ai-toggle-row">
            <div>
              <div class="ai-toggle-row__label">AI를 마피아로 참가시키기</div>
              <div class="ai-toggle-row__sub">AI가 시민으로 위장하며 채팅에 참여합니다</div>
            </div>
            <label class="ai-switch">
              <input type="checkbox" id="mafia-with-ai" checked>
              <span class="ai-switch__track"></span>
            </label>
          </div>
        </div>

        <div id="mafia-difficulty-group" class="form-group">
          <label class="form-label">AI 난이도</label>
          <input type="hidden" id="mafia-difficulty" value="normal">
          <div class="difficulty-toggle">
            <button type="button" class="difficulty-btn" data-difficulty="easy">😊 쉬움</button>
            <button type="button" class="difficulty-btn active" data-difficulty="normal">😐 보통</button>
            <button type="button" class="difficulty-btn" data-difficulty="hard">😈 어려움</button>
          </div>
          <div class="form-hint" id="mafia-difficulty-hint">AI가 약간의 어색함을 내비쳐 잡기 쉬운 편이에요.</div>
        </div>

        <button class="btn btn--primary btn--full" id="mafia-create" style="margin-top:4px">방 만들기</button>
      </section>

      <div class="game-tip-v2">💡 5명부터 경찰, 6명부터 의사 특수 역할이 추가됩니다. AI 난이도 <b>어려움</b>은 완벽한 구어체로 위장해 구별이 매우 어렵습니다!</div>
    </div>`;
}

export function renderMafiaLoadingHTML() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

export function renderMafiaNotFoundHTML() {
  return `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">방을 찾을 수 없어요</div><button class="btn btn--primary" onclick="navigate('/game/mafia')">마피아게임 방 만들기</button></div>`;
}

export function renderMafiaWrongGameHTML(game = '') {
  const target = game === 'liar' ? '/game/liar' : '/sosoland';
  const label = game === 'liar' ? '라이어게임으로 이동' : '게임 목록으로 이동';
  return `<div class="empty-state"><div class="empty-state__icon">🚫</div><div class="empty-state__title">마피아게임 방이 아니에요</div><button class="btn btn--primary" onclick="navigate('${target}')">${label}</button></div>`;
}

function renderPlayerItem(p, room, counts, gameOver) {
  const isHost = p.uid === room.hostId || p.role === 'host';
  const dead = p.alive === false;
  const isMe = auth.currentUser?.uid === p.uid;
  const initial = String(p.name || '?').slice(0, 1).toUpperCase();
  const voteCount = counts[p.uid] || 0;
  let statusText = dead ? '탈락' : (voteCount > 0 ? `${voteCount}표` : '생존');
  if (gameOver && p.assignedRole) statusText = roleLabel(p.assignedRole);
  return `
    <div class="game-player-item-v2 ${isMe ? 'is-me' : ''} ${dead ? 'is-dead' : ''}">
      <div class="game-player-avatar-v2 ${isHost ? 'game-player-avatar-v2--host' : ''} ${dead ? 'game-player-avatar-v2--dead' : ''}">${dead ? '💀' : esc(initial)}</div>
      <div class="game-player-info">
        <div class="game-player-info__name">
          ${esc(p.name || '참가자')}
          ${isHost ? '<span class="game-player-info__tag">방장</span>' : ''}
          ${isMe ? '<span class="game-player-info__tag" style="color:var(--color-primary)">나</span>' : ''}
        </div>
      </div>
      <div class="game-player-votes ${dead ? 'game-player-votes--dead' : voteCount > 0 ? 'game-player-votes--voted' : ''}">${esc(statusText)}</div>
    </div>`;
}

function renderMyRoleCard(room, me) {
  if (!me || room.status === 'waiting') return '';
  const isMafia = me.assignedRole === 'mafia';
  const isPolice = me.assignedRole === 'police';
  const isDoctor = me.assignedRole === 'doctor';
  const guide = roleGuide(me.assignedRole || '');
  const icon = isMafia ? '🌙' : isPolice ? '🔍' : isDoctor ? '💉' : '🛡️';
  return `
    <div class="game-secret-v2 ${isMafia ? 'game-secret-v2--liar' : (isPolice || isDoctor) ? 'game-secret-v2--special' : ''}">
      <div class="game-secret-v2__icon">${icon}</div>
      <div>
        <div class="game-secret-v2__role">당신의 역할</div>
        <div class="game-secret-v2__word">${roleLabel(me.assignedRole || '') || '미배정'}</div>
        <div class="game-secret-v2__hint">${esc(guide)}</div>
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
  const humanPlayers = players.filter(p => !p.isAI);
  const enough = humanPlayers.length >= 3;
  const hasAI = !!room.withAI;
  const alive = players.filter(p => p.alive !== false && !p.isAI);

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
          <div class="game-phase-step__label">토론</div>
        </div>
        <div class="game-phase-line ${ended ? 'done' : ''}"></div>
        <div class="game-phase-step ${ended ? 'active' : ''}">
          <div class="game-phase-step__num">3</div>
          <div class="game-phase-step__label">결과</div>
        </div>
      </div>
      <div class="game-phase-log">
        ${waiting
          ? enough ? `참가자 ${humanPlayers.length}명 대기중${hasAI ? ' · 🤖 AI 참가 예정' : ''} — 방장이 시작하면 돼요`
                   : '최소 3명이 모여야 시작할 수 있어요'
          : esc(room.log || `생존 ${alive.length}명 · 채팅으로 토론하세요`)}
      </div>
    </div>`;
}

function renderVotePanel(me, players) {
  if (!me || me.alive === false) return '';
  const targets = players.filter(p => p.alive !== false && p.uid !== me.uid && !p.isAI);
  if (!targets.length) return '';
  return `
    <div class="mafia-vote-panel">
      <div class="mafia-vote-panel__head">
        <span class="mafia-vote-panel__title">🗳️ 투표하기</span>
        <span class="mafia-vote-panel__sub">${me.votedFor ? '투표 완료 — 방장이 집계할 때까지 대기하세요' : '가장 의심되는 사람을 선택하세요'}</span>
      </div>
      <div class="mafia-vote-grid-v2">
        ${targets.map(p => `
          <button class="mafia-vote-btn ${me.votedFor === p.uid ? 'mafia-vote-btn--selected' : ''}" data-mafia-vote="${p.uid}">
            <span class="mafia-vote-btn__name">${esc(p.name)}</span>
            <span class="mafia-vote-btn__check">${me.votedFor === p.uid ? '✓' : ''}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
}

export function renderMafiaRoomHTML(room, players = [], chats = []) {
  const url = buildGameInviteUrl('mafia', room.id);
  const visiblePlayers = players.length ? players : [{ uid: room.hostId, name: room.hostName || '방장', role: 'host' }];
  const me = findMyPlayer(visiblePlayers);
  const joined = !!me;
  const host = isRoomHost(room);
  const gameOver = room.status === 'ended';
  const canStart = host && room.status === 'waiting' && visiblePlayers.filter(p => !p.isAI).length >= 3;
  const counts = voteCounts(visiblePlayers);
  const hasAI = !!(room.withAI || room.aiPlayerUid);
  const diff = DIFFICULTY_LABELS[room.aiDifficulty] || '';
  const alive = visiblePlayers.filter(p => p.alive !== false);

  return `
    <div class="game-ai-shell">
      <section class="mafia-hero-v2 mafia-hero-v2--room">
        <button class="game-back-btn" id="mafia-back" type="button" aria-label="뒤로">←</button>
        <div class="hero-eyebrow">방 코드 ${esc(room.code || '')}</div>
        <h1>${esc(room.title || '마피아게임')}</h1>
        <p>${esc(room.log || '참가자를 모아 게임을 시작하세요.')}</p>
        <div class="game-hero-chips">
          <span>${room.status === 'waiting' ? '대기중' : gameOver ? '종료' : `${room.day || 1}라운드`}</span>
          <span>생존 ${alive.length}명</span>
          <span>마피아 ${room.mafiaCount || 1}명</span>
          ${hasAI ? `<span>🤖 AI ${diff}</span>` : ''}
        </div>
        <div class="game-room-actions">
          <button class="btn btn--ghost btn--sm" data-copy-invite>초대 복사</button>
          ${!joined ? '<button class="btn btn--primary btn--sm" id="mafia-join">참가하기</button>' : ''}
        </div>
      </section>

      ${renderMyRoleCard(room, me)}
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
            ${visiblePlayers.filter(p => !p.isAI || gameOver).map(p => renderPlayerItem(p, room, counts, gameOver)).join('')}
          </div>
          ${host ? `<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
            ${room.status === 'waiting' ? `<button class="btn btn--primary btn--full" id="mafia-start" ${canStart ? '' : 'disabled'}>${canStart ? '🎮 게임 시작' : '3명 이상 필요'}</button>` : ''}
            ${room.status === 'playing' ? '<button class="btn btn--primary btn--full" id="mafia-count-vote">투표 집계 / 처형</button>' : ''}
            ${gameOver ? '<button class="btn btn--ghost btn--full" id="mafia-reset">🔄 새 게임 준비</button>' : ''}
          </div>` : ''}
        </section>

        ${renderGameChatHTML({
          room,
          chats,
          joined,
          inputId: 'mafia-chat-input',
          sendId: 'mafia-chat-send',
          title: '마피아 토론',
          hint: room.status === 'playing' ? '의심되는 사람에게 질문하고 방어하세요. AI도 채팅에 참여합니다!' : '참가자가 모이면 이곳에서 토론을 진행합니다.',
        })}
      </div>

      ${room.status === 'playing' && joined ? renderVotePanel(me, visiblePlayers) : ''}
    </div>`;
}

export function renderMafiaVoteBoxHTML(me, players) {
  return renderVotePanel(me, players);
}
