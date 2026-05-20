import { buildGameInviteUrl, esc } from '../common.js';

export function renderLiarLobbyHTML() {
  return `
    <div class="liar-page">
      <section class="liar-hero liar-hero--lobby">
        <button class="write-back-btn" id="liar-back" type="button">←</button>
        <div class="liar-hero__bg">🕵️</div>
        <div class="liar-hero__eyebrow">HIDDEN WORD</div>
        <h1>라이어게임</h1>
        <p>모두가 같은 제시어를 받지만, 단 한 명의 라이어만 제시어를 모릅니다. 서로 자연스럽게 설명하고 질문하면서 제시어를 모르는 사람을 찾아내는 추리 대화 게임입니다.</p>
        <div class="liar-hero__chips"><span>친구 초대</span><span>제시어 추리</span><span>라운드 토크</span></div>
      </section>

      <section class="game-detail-card game-guide-card">
        <div class="game-detail-card__head"><div><b>라이어게임 설명</b><span>대화 속 어색함을 찾아내는 심리 추리 게임</span></div><i>🕵️</i></div>
        <div class="game-guide-list">
          <div><b>목표</b><span>일반 참가자는 라이어를 찾아내고, 라이어는 정체를 들키지 않은 채 제시어를 맞히거나 끝까지 버팁니다.</span></div>
          <div><b>진행</b><span>방 만들기 → 초대 링크 공유 → 참가자 입장 → 제시어 확인 → 돌아가며 설명/질문 → 투표로 라이어 지목 순서로 진행합니다.</span></div>
          <div><b>팁</b><span>너무 직접적인 설명은 라이어에게 힌트가 되고, 너무 애매한 설명은 의심을 받을 수 있습니다.</span></div>
        </div>
      </section>

      <section class="liar-create-card">
        <h2>방 만들기</h2>
        <div class="form-group"><label class="form-label">방 제목</label><input id="liar-title" class="form-input" maxlength="40" value="라이어게임" placeholder="방 제목"></div>
        <div class="form-group"><label class="form-label">카테고리</label><select id="liar-category" class="form-select"><option value="food">음식</option><option value="place">장소</option><option value="thing">물건</option><option value="animal">동물</option><option value="random">랜덤</option></select></div>
        <div class="liar-option-row">
          <div class="form-group"><label class="form-label">최대 인원</label><select id="liar-max" class="form-select"><option value="4">4명</option><option value="5">5명</option><option value="6" selected>6명</option><option value="8">8명</option></select></div>
          <div class="form-group"><label class="form-label">라이어 수</label><select id="liar-count" class="form-select"><option value="1" selected>1명</option><option value="2">2명</option></select></div>
        </div>
        <button class="btn btn--primary" id="liar-create">방 만들기</button>
      </section>

      <section class="liar-rule-card"><b>진행 방식</b><span>방 만들기 → 초대 링크 공유 → 참가자 입장 → 방장이 시작 → 각자 제시어/라이어 확인</span></section>
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
  return `<div class="empty-state"><div class="empty-state__icon">🚫</div><div class="empty-state__title">라이어게임 방이 아니에요</div><div class="empty-state__desc">라이어게임에서는 라이어게임 방만 열 수 있습니다.</div><button class="btn btn--primary" onclick="navigate('${target}')">${label}</button></div>`;
}

function renderPlayerItem(player, room) {
  const isHost = player.uid === room.hostId || player.role === 'host';
  return `
    <div class="liar-player-item has-avatar">
      <i class="game-player-avatar ${isHost ? 'game-player-avatar--host' : 'game-player-avatar--player'}" aria-hidden="true"></i>
      <div class="liar-player-name"><span>${esc(player.name || '참가자')}</span>${isHost ? '<small>방장</small>' : ''}</div>
      <b>${isHost ? '방장' : '참가자'}</b>
    </div>`;
}

export function renderLiarRoomHTML(room, players = []) {
  const url = buildGameInviteUrl('liar', room.id);
  const visiblePlayers = players.length ? players : [{ uid: room.hostId, name: room.hostName || '방장', role: 'host' }];
  return `
    <div class="liar-page">
      <section class="liar-hero liar-hero--room">
        <button class="write-back-btn" id="liar-back" type="button">←</button>
        <div class="liar-hero__bg">🕵️</div>
        <div class="liar-hero__eyebrow">방 코드 ${esc(room.code || '')}</div>
        <h1>${esc(room.title || '라이어게임')}</h1>
        <p>초대 링크를 공유해서 참가자를 모으세요. 참가자가 모이면 제시어를 확인하고 대화로 라이어를 찾아내면 됩니다.</p>
      </section>

      <section class="liar-room-card">
        <div class="liar-room-info"><span>상태</span><b>${room.status === 'waiting' ? '대기중' : esc(room.status)}</b></div>
        <div class="liar-room-info"><span>카테고리</span><b>${esc(room.category || '-')}</b></div>
        <div class="liar-room-info"><span>참가자</span><b>${visiblePlayers.length}/${room.maxPlayers || 0}명</b></div>
        <div class="liar-room-info"><span>라이어</span><b>${room.liarCount || 1}명</b></div>
      </section>

      <section class="liar-invite-card">
        <label class="form-label">초대 링크</label>
        <div class="liar-invite-row"><input class="form-input" id="liar-invite-url" value="${url}" readonly><button class="btn btn--primary btn--sm" id="liar-copy">복사</button></div>
        <div class="form-hint">회원가입 없이 닉네임만 입력해도 참가할 수 있습니다.</div>
      </section>

      <section class="liar-player-card">
        <h2>참가자</h2>
        <div class="liar-player-list" id="liar-player-list">${visiblePlayers.map(player => renderPlayerItem(player, room)).join('')}</div>
        <button class="btn btn--ghost" id="liar-join">참가하기</button>
        <button class="btn btn--primary" id="liar-start" disabled>게임 시작 준비중</button>
      </section>
    </div>`;
}