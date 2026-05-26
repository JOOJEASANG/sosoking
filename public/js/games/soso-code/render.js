import { buildGameInviteUrl, esc } from '../common.js';
import { auth } from '../../firebase.js';

const DIFFICULTY_LABELS = { easy: '😊 쉬움', normal: '😐 보통', hard: '😈 어려움' };

// ─── 로비 ─────────────────────────────────────────────────────────────────────
export function renderCodeLobbyHTML() {
  return `
    <div class="code-shell">
      <section class="code-hero">
        <button class="game-back-btn" id="code-back" type="button" aria-label="뒤로">←</button>
        <div class="code-hero__eyebrow">🔐 SOSO CODE · AI HACKER DEDUCTION GAME</div>
        <h1 class="code-hero__title">소소코드</h1>
        <p class="code-hero__desc">AI 해커가 라운드마다 인텔 정보를 흘립니다.<br>Hit &amp; Blow로 상대 코드를 추리하고, 최종 추측으로 탈락시키세요!</p>
        <div class="game-hero-chips">
          <span>🤖 AI 해커</span><span>🔢 4자리 코드</span><span>💥 Hit &amp; Blow</span>
        </div>
      </section>

      <section class="code-guide">
        <div class="code-guide__head">HOW TO PLAY</div>
        <div class="code-guide__steps">
          <div class="code-guide-step">
            <div class="code-guide-step__num">1</div>
            <div class="code-guide-step__body">
              <b><span class="code-guide-step__icon">🔐</span>코드 확인</b>
              <span>게임 시작 시 각자에게 1~6 숫자 4자리 비밀 코드가 배정됩니다. 내 코드는 나만 볼 수 있어요.</span>
            </div>
          </div>
          <div class="code-guide-step">
            <div class="code-guide-step__num">2</div>
            <div class="code-guide-step__body">
              <b><span class="code-guide-step__icon">💬</span>질문으로 추리</b>
              <span>상대방 코드를 추측해 질문하면 Hit(자리·숫자 일치)와 Blow(숫자만 일치) 결과를 알려줍니다.</span>
            </div>
          </div>
          <div class="code-guide-step">
            <div class="code-guide-step__num">3</div>
            <div class="code-guide-step__body">
              <b><span class="code-guide-step__icon">🎯</span>최종 추측</b>
              <span>확신이 생기면 최종 추측! 맞으면 상대 탈락, 틀리면 내 코드 1자리가 공개되는 위험이 있어요.</span>
            </div>
          </div>
          <div class="code-guide-step">
            <div class="code-guide-step__num">4</div>
            <div class="code-guide-step__body">
              <b><span class="code-guide-step__icon">🤖</span>AI 인텔 주의</b>
              <span>매 라운드 AI 해커가 인텔 정보를 공개합니다. 진짜일 수도, 거짓일 수도 있어요. 주의하세요!</span>
            </div>
          </div>
        </div>
      </section>

      <section class="code-create-form">
        <h2>방 만들기</h2>
        <div class="form-group">
          <label class="form-label">방 제목</label>
          <input id="code-title" class="form-input" maxlength="40" value="소소코드" placeholder="방 제목">
        </div>
        <div class="game-option-row">
          <div class="form-group">
            <label class="form-label">최대 인원</label>
            <select id="code-max" class="form-select">
              <option value="2">2명</option>
              <option value="3">3명</option>
              <option value="4" selected>4명</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">AI 난이도</label>
            <select id="code-difficulty" class="form-select">
              <option value="easy">😊 쉬움</option>
              <option value="normal" selected>😐 보통</option>
              <option value="hard">😈 어려움</option>
            </select>
          </div>
        </div>
        <button class="btn btn--primary btn--full code-btn-glow" id="code-create-btn" style="margin-top:8px">방 만들기</button>
      </section>

      <div class="code-divider">또는</div>

      <section class="code-join-form">
        <h2>초대 코드로 참가</h2>
        <div class="code-join-row">
          <input id="code-join-code" class="form-input" maxlength="8" placeholder="초대 코드 입력 (예: AB1234)" style="text-transform:uppercase;letter-spacing:2px">
          <button class="btn btn--secondary" id="code-join-btn">참가</button>
        </div>
      </section>

      <div class="game-tip-v2">AI 난이도 <b>어려움</b>은 매우 그럴듯한 거짓 인텔을 흘려 판단을 흐립니다. 정보를 비판적으로 분석하세요!</div>
    </div>`;
}

// ─── 대기실 ───────────────────────────────────────────────────────────────────
export function renderCodeRoomHTML(room, players, myUid) {
  const url = buildGameInviteUrl('soso-code', room.id);
  const isHost = myUid === room.hostId;
  const humanPlayers = players.filter(p => !p.isAI && !p.isHacker);
  const hasAI = players.some(p => p.isHacker || p.isAI);
  const canStart = isHost && room.status === 'waiting' && humanPlayers.length >= 2;
  const diff = DIFFICULTY_LABELS[room.difficulty] || '보통';

  return `
    <div class="code-shell">
      <section class="code-hero code-hero--room">
        <button class="game-back-btn" id="code-back" type="button" aria-label="뒤로">←</button>
        <div class="code-hero__eyebrow">방 코드 <span class="code-room-badge">${esc(room.code || '')}</span></div>
        <h1 class="code-hero__title">${esc(room.title || '소소코드')}</h1>
        <div class="game-hero-chips">
          <span>대기중</span>
          <span>${humanPlayers.length}/${room.maxPlayers || 4}명</span>
          <span>${esc(diff)}</span>
          ${hasAI ? '<span>🤖 AI 해커 참가중</span>' : ''}
        </div>
      </section>

      <div class="code-invite-bar">
        <input class="form-input code-invite-input" value="${esc(url)}" readonly>
        <button class="btn btn--secondary btn--sm" data-copy-invite>링크 복사</button>
      </div>

      <section class="code-card">
        <div class="code-card__head">
          <h2>참가자 <span class="code-badge">${humanPlayers.length}명</span></h2>
        </div>

        ${hasAI ? `
          <div class="code-ai-banner">
            <span class="code-ai-banner__icon">🤖</span>
            <div class="code-ai-banner__body">
              <div class="code-ai-banner__title">AI 해커 참가중</div>
              <div class="code-ai-banner__sub">매 라운드 인텔 정보를 제공합니다. 신뢰 여부는 당신의 판단에 달렸습니다.</div>
            </div>
          </div>` : ''}

        <div class="code-player-list">
          ${humanPlayers.map(p => _renderWaitingPlayer(p, room, myUid)).join('')}
        </div>

        ${isHost ? `
          <div class="code-host-actions">
            ${!hasAI ? `<button class="btn btn--ghost btn--sm" id="code-add-ai-btn">🤖 AI 해커 추가</button>` : ''}
            <button class="btn btn--primary btn--full code-btn-glow" id="code-start-btn" ${canStart ? '' : 'disabled'}>
              ${canStart ? '🎮 게임 시작' : humanPlayers.length < 2 ? '2명 이상 필요' : '대기중...'}
            </button>
          </div>` : `
          <div class="code-waiting-msg">방장이 게임을 시작할 때까지 기다려주세요.</div>`}
      </section>

      <div class="game-tip-v2">초대 링크를 공유해 친구들을 불러오세요. AI 해커가 함께 인텔을 흘립니다.</div>
    </div>`;
}

function _renderWaitingPlayer(player, room, myUid) {
  const isHost = player.uid === room.hostId;
  const isMe = player.uid === myUid;
  const initial = String(player.name || '?').slice(0, 1).toUpperCase();
  return `
    <div class="code-player-item ${isMe ? 'code-player-item--me' : ''}">
      <div class="code-player-avatar ${isHost ? 'code-player-avatar--host' : ''}">${esc(initial)}</div>
      <div class="code-player-info">
        <div class="code-player-name">
          ${esc(player.name || '참가자')}
          ${isHost ? '<span class="code-tag">방장</span>' : ''}
          ${isMe ? '<span class="code-tag code-tag--me">나</span>' : ''}
        </div>
        <div class="code-player-sub">대기중</div>
      </div>
    </div>`;
}

// ─── 플레이 중 ────────────────────────────────────────────────────────────────
export function renderCodePlayingHTML(room, players, actions, myUid) {
  const turnOrder = room.turnOrder || [];
  const currentTurnUid = turnOrder[room.currentTurnIdx % (turnOrder.length || 1)] || null;
  const isMyTurn = currentTurnUid === myUid;

  const me = players.find(p => p.uid === myUid);
  const alivePlayers = players.filter(p => !p.isAI && !p.isHacker && p.alive !== false);
  const targets = alivePlayers.filter(p => p.uid !== myUid);

  return `
    <div class="code-shell">
      <div class="code-round-bar">
        <span class="code-round-label">ROUND ${esc(room.round || 1)} / ${esc(room.maxRounds || 8)}</span>
        <span class="code-turn-label">${isMyTurn ? '🟢 내 차례' : `⏳ ${esc(_playerName(players, currentTurnUid))}님의 차례`}</span>
      </div>

      ${_renderMyCodeCard(me)}

      ${isMyTurn ? _renderActionForm(targets, room) : _renderWaitingMsg(players, currentTurnUid)}

      ${_renderPlayerStatus(players, myUid)}

      ${_renderActionLog(actions, players)}
    </div>`;
}

function _playerName(players, uid) {
  return players.find(p => p.uid === uid)?.name || '?';
}

function _renderMyCodeCard(me) {
  if (!me) return '';
  const digits = me.codeDigits || [null, null, null, null];
  const revealed = me.revealedPositions || [false, false, false, false];
  const isAlive = me.alive !== false;

  const digitHtml = digits.map((d, i) => {
    const isRevealed = revealed[i];
    return `<div class="code-digit ${isRevealed ? 'code-digit--revealed' : ''}" data-pos="${i}">
      ${isRevealed ? esc(String(d ?? '?')) : esc(String(d ?? '?'))}
      ${isRevealed ? '<span class="code-digit__lock">🔓</span>' : ''}
    </div>`;
  }).join('');

  return `
    <div class="code-my-card ${!isAlive ? 'code-my-card--eliminated' : ''}">
      <div class="code-my-card__label">
        ${isAlive ? '🔐 내 비밀 코드' : '💀 탈락'}
      </div>
      <div class="code-digit-row">${digitHtml}</div>
      ${!isAlive ? '<div class="code-my-card__elim-msg">코드가 완전히 해킹되었습니다.</div>' : ''}
      <div class="code-my-card__hint">
        공개된 자리: ${(revealed.filter(Boolean).length)}개 / 4개
      </div>
    </div>`;
}

function _renderActionForm(targets, room) {
  const targetOptions = targets.map(p =>
    `<option value="${esc(p.uid)}">${esc(p.name || '?')}</option>`
  ).join('');

  const digitPicker = [1, 2, 3, 4].map(pos => `
    <div class="code-digit-picker-group">
      <div class="code-digit-picker-label">${pos}번째</div>
      <div class="code-digit-picker-btns">
        ${[1,2,3,4,5,6].map(val =>
          `<button type="button" class="code-digit-btn" data-pos="${pos - 1}" data-val="${val}">${val}</button>`
        ).join('')}
      </div>
    </div>`
  ).join('');

  return `
    <div class="code-action-form" id="code-digit-picker">
      <div class="code-action-form__head">🎯 행동 선택</div>

      <div class="form-group">
        <label class="form-label">대상 선택</label>
        <select id="code-target-select" class="form-select">
          ${targets.length ? targetOptions : '<option value="">대상 없음</option>'}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">코드 입력 (1~6)</label>
        <div class="code-digit-picker-wrap">${digitPicker}</div>
      </div>

      <div class="code-current-guess-row">
        <span class="code-current-guess-label">현재 입력:</span>
        <span id="code-current-guess" class="code-current-guess">----</span>
      </div>

      <div class="code-action-btns">
        <button class="btn btn--secondary code-btn-question" id="code-btn-question" ${targets.length ? '' : 'disabled'}>
          💬 질문 (Hit/Blow)
        </button>
        <button class="btn btn--danger code-btn-final" id="code-btn-final" ${targets.length ? '' : 'disabled'}>
          🎯 최종 추측
        </button>
      </div>
      <div class="code-action-hint">최종 추측 실패 시 내 코드 1자리가 공개됩니다!</div>
    </div>`;
}

function _renderWaitingMsg(players, currentTurnUid) {
  const name = _playerName(players, currentTurnUid);
  return `
    <div class="code-waiting-turn">
      <div class="code-waiting-turn__icon">⏳</div>
      <div class="code-waiting-turn__msg">${esc(name)}님이 행동 중입니다...</div>
    </div>`;
}

function _renderPlayerStatus(players, myUid) {
  const humans = players.filter(p => !p.isAI && !p.isHacker);
  if (!humans.length) return '';

  const items = humans.map(p => {
    const isMe = p.uid === myUid;
    const isAlive = p.alive !== false;
    const revealed = (p.revealedPositions || []).filter(Boolean).length;
    const initial = String(p.name || '?').slice(0, 1).toUpperCase();

    return `
      <div class="code-status-item ${!isAlive ? 'code-status-item--eliminated' : ''} ${isMe ? 'code-status-item--me' : ''}">
        <div class="code-status-avatar">${esc(initial)}</div>
        <div class="code-status-info">
          <div class="code-status-name">
            ${esc(p.name || '?')}
            ${isMe ? '<span class="code-tag code-tag--me">나</span>' : ''}
            ${!isAlive ? '<span class="code-tag code-tag--elim">탈락</span>' : ''}
          </div>
          <div class="code-status-meta">
            코드 공개: ${revealed}/4 &nbsp;·&nbsp; 점수: ${esc(String(p.score || 0))}
          </div>
        </div>
        <div class="code-status-revealed">
          ${(p.revealedPositions || [false,false,false,false]).map((r, i) =>
            `<span class="code-status-dot ${r ? 'code-status-dot--open' : ''}">${r ? esc(String((p.codeDigits || [])[i] ?? '?')) : '●'}</span>`
          ).join('')}
        </div>
      </div>`;
  }).join('');

  return `
    <section class="code-card">
      <div class="code-card__head"><h2>플레이어 현황</h2></div>
      <div class="code-status-list">${items}</div>
    </section>`;
}

function _renderActionLog(actions, players) {
  if (!actions || !actions.length) return '';

  const entries = [...actions]
    .sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    })
    .slice(0, 30)
    .map(a => _renderLogEntry(a))
    .join('');

  return `
    <section class="code-card">
      <div class="code-card__head"><h2>액션 로그</h2></div>
      <div class="code-log">${entries || '<div class="code-log-empty">아직 행동이 없습니다.</div>'}</div>
    </section>`;
}

function _renderLogEntry(action) {
  if (action.type === 'question') {
    return `
      <div class="code-log-entry code-log-entry--question">
        <span class="code-log-entry__actor">${esc(action.actorName || '?')}</span>
        <span class="code-log-entry__verb">→</span>
        <span class="code-log-entry__target">${esc(action.targetName || '?')}</span>
        <span class="code-log-entry__guess">[${esc((action.guess || []).join(''))}]</span>
        <span class="code-log-entry__result">
          <b class="code-hit">${esc(String(action.hits || 0))}H</b>
          <b class="code-blow">${esc(String(action.blows || 0))}B</b>
        </span>
      </div>`;
  }

  if (action.type === 'final_guess') {
    const cls = action.correct ? 'code-log-entry--success' : 'code-log-entry--fail';
    return `
      <div class="code-log-entry ${cls}">
        <span class="code-log-entry__icon">${action.correct ? '💥' : '❌'}</span>
        <span class="code-log-entry__actor">${esc(action.actorName || '?')}</span>
        <span class="code-log-entry__verb">최종 추측</span>
        <span class="code-log-entry__target">${esc(action.targetName || '?')}</span>
        <span class="code-log-entry__guess">[${esc((action.guess || []).join(''))}]</span>
        <span class="code-log-entry__verdict">${action.correct ? '정답!' : `오답 (${action.exposedPosition !== undefined ? `${action.exposedPosition + 1}번째 자리 공개` : '자리 공개'})`}</span>
      </div>`;
  }

  if (action.type === 'ai_intel') {
    return `
      <div class="code-log-entry code-log-entry--intel">
        <span class="code-log-entry__icon">🔓</span>
        <span class="code-log-entry__intel-label">AI 해커 인텔</span>
        <span class="code-log-entry__intel-msg">${esc(action.message || '')}</span>
      </div>`;
  }

  return '';
}

// ─── 게임 종료 ────────────────────────────────────────────────────────────────
export function renderCodeDoneHTML(room, players, myUid) {
  const winnerUid = room.winner;
  const winner = players.find(p => p.uid === winnerUid);
  const isMyWin = winnerUid === myUid;
  const humans = players.filter(p => !p.isAI && !p.isHacker);
  const endReason = room.endReason === 'max_rounds';

  const playerCards = humans.map(p => {
    const isWinner = p.uid === winnerUid;
    const isMe = p.uid === myUid;
    const digits = p.codeDigits || [];
    const revealed = p.revealedPositions || [false, false, false, false];

    const digitHtml = digits.length
      ? digits.map((d, i) => `<span class="code-done-digit ${revealed[i] ? 'code-done-digit--was-open' : ''}">${esc(String(d))}</span>`).join('')
      : '<span class="code-done-digit code-done-digit--unknown">????</span>';

    return `
      <div class="code-done-player ${isWinner ? 'code-done-player--winner' : ''} ${p.alive === false ? 'code-done-player--eliminated' : ''}">
        <div class="code-done-player__header">
          <div class="code-done-player__avatar">${esc(String(p.name || '?').slice(0, 1).toUpperCase())}</div>
          <div class="code-done-player__info">
            <div class="code-done-player__name">
              ${esc(p.name || '?')}
              ${isMe ? '<span class="code-tag code-tag--me">나</span>' : ''}
              ${isWinner ? '<span class="code-tag code-tag--win">🏆 승리</span>' : ''}
              ${p.alive === false && !isWinner ? '<span class="code-tag code-tag--elim">탈락</span>' : ''}
            </div>
            <div class="code-done-player__score">점수: ${esc(String(p.score || 0))}</div>
          </div>
        </div>
        <div class="code-done-player__code">
          <span class="code-done-player__code-label">비밀 코드</span>
          <div class="code-done-digits">${digitHtml}</div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="code-shell">
      <section class="code-done-hero ${isMyWin ? 'code-done-hero--win' : 'code-done-hero--lose'}">
        <div class="code-done-hero__icon">${isMyWin ? '🏆' : '💀'}</div>
        <h1 class="code-done-hero__title">
          ${endReason ? '라운드 종료!' : isMyWin ? '코드 해킹 성공!' : '코드가 해킹됐어요...'}
        </h1>
        <p class="code-done-hero__desc">
          ${winner
            ? `<b>${esc(winner.name || '?')}</b>님이 최후의 생존자입니다!`
            : endReason ? '최대 라운드 도달로 게임이 종료됐습니다.' : '승자가 없이 게임이 종료됐습니다.'}
        </p>
      </section>

      <section class="code-card">
        <div class="code-card__head"><h2>최종 결과 — 코드 공개</h2></div>
        <div class="code-done-players">${playerCards}</div>
      </section>

      <div class="code-done-actions">
        <button class="btn btn--primary btn--full code-btn-glow" onclick="navigate('/game/soso-code')">다시 하기</button>
      </div>
    </div>`;
}

// ─── 로딩 ─────────────────────────────────────────────────────────────────────
export function renderCodeLoadingHTML() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

// ─── 방 없음 ──────────────────────────────────────────────────────────────────
export function renderCodeNotFoundHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🔍</div>
      <div class="empty-state__title">방을 찾을 수 없어요</div>
      <div class="empty-state__desc">방이 종료되었거나 잘못된 링크일 수 있어요.</div>
      <button class="btn btn--primary" onclick="navigate('/game/soso-code')">소소코드 방 만들기</button>
    </div>`;
}

// ─── 다른 게임 방 ─────────────────────────────────────────────────────────────
export function renderCodeWrongGameHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🚫</div>
      <div class="empty-state__title">소소코드 방이 아니에요</div>
      <div class="empty-state__desc">다른 게임 방 링크입니다.</div>
      <button class="btn btn--primary" onclick="navigate('/sosoland')">게임 목록으로</button>
    </div>`;
}
