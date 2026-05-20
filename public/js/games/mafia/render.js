import { buildGameInviteUrl, esc, findMyPlayer, isRoomHost } from '../common.js';
import { alivePlayers, roleLabel, voteCounts } from './rules.js';
import { auth } from '../../firebase.js';

export function renderMafiaLobbyHTML() {
  return `
    <div class="game-detail-page game-detail-page--mafia">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="mafia-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🌙</div>
        <div class="game-detail-hero__eyebrow">NIGHT MISSION</div>
        <h1>마피아게임</h1>
        <p>정체를 숨긴 마피아를 대화와 투표로 찾아내는 추리 게임입니다.</p>
        <div class="game-detail-hero__chips"><span>역할 비공개</span><span>토론 투표</span><span>친구 초대</span></div>
      </section>

      <section class="game-detail-card">
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
  return `<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__title">방을 찾을 수 없어요</div><button class="btn btn--primary" onclick="navigate('/game/mafia')">방 만들기</button></div>`;
}

export function renderMafiaLoadingHTML() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

export function renderMafiaRoomHTML(room, players) {
  const me = findMyPlayer(players);
  const joined = !!me;
  const url = buildGameInviteUrl('mafia', room.id);
  const counts = voteCounts(players);
  const alive = alivePlayers(players);
  const gameOver = room.status === 'ended';
  const host = isRoomHost(room);

  return `
    <div class="game-detail-page game-detail-page--mafia">
      <section class="game-detail-hero">
        <button class="write-back-btn" id="mafia-back" type="button">←</button>
        <div class="game-detail-hero__bg-icon">🌙</div>
        <div class="game-detail-hero__eyebrow">방 코드 ${esc(room.code || '')}</div>
        <h1>${esc(room.title || '마피아게임')}</h1>
        <p>${esc(room.log || '참가자를 모아 게임을 시작하세요.')}</p>
        <div class="game-detail-hero__chips"><span>${room.status === 'waiting' ? '대기중' : gameOver ? '종료' : `${room.day || 1}라운드`}</span><span>생존 ${alive.length}명</span><span>마피아 ${room.mafiaCount || 1}명</span></div>
      </section>

      <section class="liar-room-card">
        <div class="liar-room-info"><span>상태</span><b>${room.status === 'waiting' ? '대기중' : gameOver ? '종료' : '진행중'}</b></div>
        <div class="liar-room-info"><span>참가자</span><b>${players.length}/${room.maxPlayers || 0}명</b></div>
        <div class="liar-room-info"><span>마피아</span><b>${room.mafiaCount || 1}명</b></div>
        <div class="liar-room-info"><span>내 역할</span><b>${me?.assignedRole ? roleLabel(me.assignedRole) : '-'}</b></div>
      </section>

      <section class="liar-invite-card">
        <label class="form-label">초대 링크</label>
        <div class="liar-invite-row"><input class="form-input" id="mafia-invite-url" value="${url}" readonly><button class="btn btn--primary btn--sm" id="mafia-copy">복사</button></div>
        <div class="form-hint">회원가입 없이 닉네임만 입력해도 참가할 수 있습니다.</div>
      </section>

      <section class="liar-player-card">
        <h2>참가자</h2>
        <div class="liar-player-list">
          ${players.map(p => `
            <div class="liar-player-item mafia-player ${p.alive === false ? 'is-dead' : ''}">
              <span>${esc(p.name)} ${p.uid === room.hostId ? '<small>방장</small>' : ''}</span>
              <b>${p.alive === false ? '탈락' : p.assignedRole && gameOver ? roleLabel(p.assignedRole) : `${counts[p.uid] || 0}표`}</b>
            </div>`).join('') || '<div class="hall-empty">참가자가 없습니다.</div>'}
        </div>
        ${!joined ? '<button class="btn btn--primary" id="mafia-join">참가하기</button>' : ''}
        ${host && room.status === 'waiting' ? '<button class="btn btn--primary" id="mafia-start">게임 시작</button>' : ''}
      </section>

      ${room.status === 'playing' && joined && me?.alive !== false ? renderMafiaVoteBoxHTML(me, players) : ''}
      ${host && room.status === 'playing' ? '<button class="btn btn--primary btn--full" id="mafia-count-vote">투표 집계 / 처형</button>' : ''}
      ${host && gameOver ? '<button class="btn btn--ghost btn--full" id="mafia-reset">새 게임 준비</button>' : ''}
    </div>`;
}

export function renderMafiaVoteBoxHTML(me, players) {
  const targets = alivePlayers(players).filter(p => p.uid !== me.uid);
  return `
    <section class="game-detail-card">
      <div class="game-detail-card__head"><div><b>투표하기</b><span>${me.votedFor ? '투표 완료' : '의심되는 사람 선택'}</span></div><i>🗳️</i></div>
      <div class="mafia-vote-grid">
        ${targets.map(p => `<button class="btn ${me.votedFor === p.uid ? 'btn--primary' : 'btn--ghost'} btn--sm" data-mafia-vote="${p.uid}">${esc(p.name)}</button>`).join('') || '<div class="hall-empty">투표할 대상이 없습니다.</div>'}
      </div>
    </section>`;
}
