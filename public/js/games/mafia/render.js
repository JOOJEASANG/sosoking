import { buildGameInviteUrl, esc, findMyPlayer, isRoomHost } from '../common.js';
import { renderGameChatHTML } from '../chat.js';
import { alivePlayers, roleLabel, voteCounts } from './rules.js';
import { auth } from '../../firebase.js';

export function renderMafiaLobbyHTML() {
  return `
    <div class="game-detail-page game-detail-page--mafia game-shell-polished">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="mafia-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🌙</div>
        <div class="game-detail-hero__eyebrow">NIGHT MISSION</div>
        <h1>마피아게임</h1>
        <p>마이크 없이 채팅으로 토론합니다. 마피아는 정체를 숨기고, 시민은 말투와 투표 흐름을 보고 마피아를 찾아내세요.</p>
        <div class="game-detail-hero__chips"><span>채팅 토론</span><span>역할 비공개</span><span>투표 처형</span></div>
      </section>

      <section class="game-detail-card game-guide-card game-guide-card--steps">
        <div class="game-detail-card__head"><div><b>마피아게임 설명</b><span>정체를 숨긴 사람을 토론과 투표로 찾아내는 게임</span></div><i>🌙</i></div>
        <div class="game-guide-list">
          <div><b>1. 역할</b><span>방장이 시작하면 시민과 마피아 역할이 자동으로 배정됩니다.</span></div>
          <div><b>2. 토론</b><span>채팅으로 의심되는 사람을 질문하고 방어합니다.</span></div>
          <div><b>3. 투표</b><span>가장 의심되는 사람에게 투표하고, 방장이 집계해 처형합니다.</span></div>
        </div>
      </section>

      <section class="game-detail-card game-create-panel">
        <div class="game-detail-card__head"><div><b>마피아게임 방 만들기</b><span>3명 이상 추천</span></div><i>🌙</i></div>
        <div class="form-group"><label class="form-label">방 제목</label><input id="mafia-title" class="form-input" maxlength="40" value="마피아게임" placeholder="방 제목"></div>
        <div class="liar-option-row">
          <div class="form-group"><label class="form-label">최대 인원</label><select id="mafia-max" class="form-select"><option value="4">4명</option><option value="6" selected>6명</option><option value="8">8명</option></select></div>
          <div class="form-group"><label class="form-label">마피아 수</label><select id="mafia-count" class="form-select"><option value="1" selected>1명</option><option value="2">2명</option></select></div>
        </div>
        <button class="btn btn--primary" id="mafia-create">방 만들기</button>
      </section>
    </div>`;
}

export function renderMafiaNotFoundHTML() {
  return `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">방을 찾을 수 없어요</div><button class="btn btn--primary" onclick="navigate('/game/mafia')">마피아게임 방 만들기</button></div>`;
}

export function renderMafiaWrongGameHTML(game = '') {
  const target = game === 'liar' ? '/game/liar' : '/sosoland';
  const label = game === 'liar' ? '라이어게임으로 이동' : '게임 목록으로 이동';
  return `<div class="empty-state"><div class="empty-state__icon">🚫</div><div class="empty-state__title">마피아게임 방이 아니에요</div><div class="empty-state__desc">마피아게임에서는 마피아게임 방만 열 수 있습니다.</div><button class="btn btn--primary" onclick="navigate('${target}')">${label}</button></div>`;
}

export function renderMafiaLoadingHTML() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

function renderMafiaPlayerItem(p, room, counts, gameOver) {
  const isHost = p.uid === room.hostId;
  const dead = p.alive === false;
  const isMe = auth.currentUser?.uid === p.uid;
  return `
    <div class="liar-player-item has-avatar mafia-player ${dead ? 'is-dead' : ''} ${isMe ? 'is-me' : ''}">
      <i class="game-player-avatar ${dead ? 'game-player-avatar--dead' : isHost ? 'game-player-avatar--host' : 'game-player-avatar--player'}" aria-hidden="true"></i>
      <div class="liar-player-name"><span>${esc(p.name)}</span>${isHost ? '<small>방장</small>' : ''}${isMe ? '<small>나</small>' : ''}</div>
      <b>${dead ? '탈락' : p.assignedRole && gameOver ? roleLabel(p.assignedRole) : `${counts[p.uid] || 0}표`}</b>
    </div>`;
}

function renderRoleCard(room, me) {
  if (!me || room.status === 'waiting') return '';
  const mafia = me.assignedRole === 'mafia';
  return `
    <section class="game-secret-card ${mafia ? 'game-secret-card--liar' : ''}">
      <div>
        <small>당신의 역할</small>
        <b>${roleLabel(me.assignedRole || '') || '역할 확인 전'}</b>
        <span>${mafia ? '정체를 숨기고 시민처럼 말하세요.' : '대화와 투표로 마피아를 찾아내세요.'}</span>
      </div>
      <i>${mafia ? '🌙' : '🛡️'}</i>
    </section>`;
}

function renderPhaseCard(room, alive, players) {
  const waiting = room.status === 'waiting';
  const ended = room.status === 'ended';
  return `
    <section class="game-phase-card game-phase-card--mafia">
      <div class="game-phase-card__step ${waiting ? 'active' : 'done'}"><b>1</b><span>입장</span></div>
      <div class="game-phase-card__line"></div>
      <div class="game-phase-card__step ${room.status === 'playing' ? 'active' : ended ? 'done' : ''}"><b>2</b><span>토론</span></div>
      <div class="game-phase-card__line"></div>
      <div class="game-phase-card__step ${ended ? 'active' : ''}"><b>3</b><span>결과</span></div>
      <p>${waiting ? (players.length >= 3 ? '이제 방장이 게임을 시작할 수 있어요.' : '최소 3명이 모이면 시작할 수 있어요.') : esc(room.log || `생존 ${alive.length}명 · 채팅으로 토론하세요.`)}</p>
    </section>`;
}

export function renderMafiaRoomHTML(room, players = [], chats = []) {
  const me = findMyPlayer(players);
  const joined = !!me;
  const url = buildGameInviteUrl('mafia', room.id);
  const counts = voteCounts(players);
  const alive = alivePlayers(players);
  const gameOver = room.status === 'ended';
  const host = isRoomHost(room);
  const canStart = host && room.status === 'waiting' && players.length >= 3;

  return `
    <div class="game-detail-page game-detail-page--mafia game-shell-polished">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="mafia-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🌙</div>
        <div class="game-detail-hero__eyebrow">방 코드 ${esc(room.code || '')}</div>
        <h1>${esc(room.title || '마피아게임')}</h1>
        <p>${esc(room.log || '참가자를 모아 게임을 시작하세요.')}</p>
        <div class="game-detail-hero__chips"><span>${room.status === 'waiting' ? '대기중' : gameOver ? '종료' : `${room.day || 1}라운드`}</span><span>생존 ${alive.length}명</span><span>마피아 ${room.mafiaCount || 1}명</span></div>
        <div class="game-room-actions"><button class="btn btn--ghost btn--sm" id="mafia-copy">초대 링크 복사</button>${!joined ? '<button class="btn btn--primary btn--sm" id="mafia-join">참가하기</button>' : ''}</div>
      </section>

      <section class="liar-room-card game-stat-grid">
        <div class="liar-room-info"><span>상태</span><b>${room.status === 'waiting' ? '대기중' : gameOver ? '종료' : '진행중'}</b></div>
        <div class="liar-room-info"><span>참가자</span><b>${players.length}/${room.maxPlayers || 0}명</b></div>
        <div class="liar-room-info"><span>마피아</span><b>${room.mafiaCount || 1}명</b></div>
        <div class="liar-room-info"><span>내 역할</span><b>${me?.assignedRole ? roleLabel(me.assignedRole) : '-'}</b></div>
      </section>

      ${renderRoleCard(room, me)}
      ${renderPhaseCard(room, alive, players)}

      <section class="liar-invite-card game-invite-compact">
        <label class="form-label">초대 링크</label>
        <div class="liar-invite-row"><input class="form-input" id="mafia-invite-url" value="${url}" readonly><button class="btn btn--primary btn--sm" id="mafia-copy">복사</button></div>
        <div class="form-hint">마이크 없이 채팅 토론으로 진행합니다. 참가자는 닉네임만 있어도 입장할 수 있어요.</div>
      </section>

      <div class="game-room-grid">
        <section class="liar-player-card game-player-panel">
          <div class="game-panel-head"><h2>참가자</h2><span>${players.length}명</span></div>
          <div class="liar-player-list">
            ${players.map(p => renderMafiaPlayerItem(p, room, counts, gameOver)).join('') || '<div class="hall-empty">참가자가 없습니다.</div>'}
          </div>
          ${host && room.status === 'waiting' ? `<button class="btn btn--primary btn--full" id="mafia-start" ${canStart ? '' : 'disabled'}>${canStart ? '게임 시작' : '3명 이상 필요'}</button>` : ''}
          ${host && room.status === 'playing' ? '<button class="btn btn--primary btn--full" id="mafia-count-vote">투표 집계 / 처형</button>' : ''}
          ${host && gameOver ? '<button class="btn btn--ghost btn--full" id="mafia-reset">새 게임 준비</button>' : ''}
        </section>

        ${renderGameChatHTML({
          room,
          chats,
          joined,
          inputId: 'mafia-chat-input',
          sendId: 'mafia-chat-send',
          title: '마피아 토론 채팅',
          hint: room.status === 'playing' ? '의심되는 사람을 질문하고 방어하세요. 투표 전 토론을 충분히 진행하세요.' : '참가자가 모이면 이곳에서 토론을 진행합니다.',
        })}
      </div>

      ${room.status === 'playing' && joined && me?.alive !== false ? renderMafiaVoteBoxHTML(me, players) : ''}
    </div>`;
}

export function renderMafiaVoteBoxHTML(me, players) {
  const targets = alivePlayers(players).filter(p => p.uid !== me.uid);
  return `
    <section class="game-detail-card game-vote-card">
      <div class="game-detail-card__head"><div><b>투표하기</b><span>${me.votedFor ? '투표 완료' : '의심되는 사람 선택'}</span></div><i>🗳️</i></div>
      <div class="mafia-vote-grid">
        ${targets.map(p => `<button class="btn ${me.votedFor === p.uid ? 'btn--primary' : 'btn--ghost'} btn--sm" data-mafia-vote="${p.uid}">${esc(p.name)}</button>`).join('') || '<div class="hall-empty">투표할 대상이 없습니다.</div>'}
      </div>
    </section>`;
}