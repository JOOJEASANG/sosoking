import { buildGameInviteUrl, esc } from '../common.js';
import { auth } from '../../firebase.js';

const CATEGORY_LABELS = {
  food: '음식', place: '장소', thing: '물건', animal: '동물', job: '직업', random: '랜덤',
};

const DIFFICULTY_LABELS = {
  easy: '😊 쉬움', normal: '😐 보통', hard: '😈 어려움',
};

// ─── 로비 화면 ────────────────────────────────────────────────────────────────
export function renderSpyLobbyHTML() {
  return `
    <div class="game-ai-shell spy-shell">
      <section class="spy-hero">
        <button class="game-back-btn" id="spy-back" type="button" aria-label="뒤로">←</button>
        <div class="spy-hero__eyebrow">🕵 SOSOSPY · AI HIDDEN WORD GAME</div>
        <h1 class="spy-hero__title">소소스파이</h1>
        <p class="spy-hero__desc">AI 스파이가 살짝 다른 단어를 받았습니다.<br>힌트를 나누고 AI를 찾아내세요!</p>
        <div class="game-hero-chips">
          <span>🤖 AI 스파이</span><span>💡 힌트 추리</span><span>🗳 투표 공개</span>
        </div>
      </section>

      <section class="spy-guide">
        <div class="spy-guide__head">HOW TO PLAY</div>
        <div class="spy-guide__steps">
          <div class="spy-guide-step">
            <div class="spy-guide-step__num">1</div>
            <div class="spy-guide-step__body">
              <b><span class="spy-guide-step__icon">🚪</span>입장</b>
              <span>방을 만들고 초대 링크로 친구들을 불러오세요. AI 스파이가 자동 참가합니다.</span>
            </div>
          </div>
          <div class="spy-guide-step">
            <div class="spy-guide-step__num">2</div>
            <div class="spy-guide-step__body">
              <b><span class="spy-guide-step__icon">💡</span>힌트 입력</b>
              <span>시민은 같은 단어를 받습니다. AI 스파이는 살짝 다른 단어를 받아요. 각자 힌트를 30초 내에 입력하세요.</span>
            </div>
          </div>
          <div class="spy-guide-step">
            <div class="spy-guide-step__num">3</div>
            <div class="spy-guide-step__body">
              <b><span class="spy-guide-step__icon">🗣 </span>토론</b>
              <span>공개된 힌트 카드를 보며 AI를 찾아내세요. 어색한 힌트를 남긴 스파이가 누구인지 토론하세요.</span>
            </div>
          </div>
          <div class="spy-guide-step">
            <div class="spy-guide-step__num">4</div>
            <div class="spy-guide-step__body">
              <b><span class="spy-guide-step__icon">🗳</span>투표</b>
              <span>AI라고 생각하는 플레이어에게 투표하세요. 최다 득표자가 탈락합니다. AI를 지목하면 시민 승리!</span>
            </div>
          </div>
        </div>
      </section>

      <section class="spy-create-form">
        <h2>방 만들기</h2>
        <div class="form-group">
          <label class="form-label">방 제목</label>
          <input id="spy-title" class="form-input" maxlength="40" value="소소스파이" placeholder="방 제목">
        </div>
        <div class="form-group">
          <label class="form-label">카테고리</label>
          <select id="spy-category" class="form-select">
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
            <select id="spy-max" class="form-select">
              <option value="4">4명</option>
              <option value="5">5명</option>
              <option value="6" selected>6명</option>
              <option value="8">8명</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">AI 난이도</label>
            <select id="spy-difficulty" class="form-select">
              <option value="easy">😊 쉬움</option>
              <option value="normal" selected>😐 보통</option>
              <option value="hard">😈 어려움</option>
            </select>
          </div>
        </div>
        <button class="btn btn--primary btn--full spy-btn-glow" id="spy-create-btn" style="margin-top:8px">방 만들기</button>
      </section>

      <div class="spy-divider">또는</div>

      <section class="spy-join-form">
        <h2>초대 코드로 참가</h2>
        <div class="spy-join-row">
          <input id="spy-join-code" class="form-input" maxlength="8" placeholder="초대 코드 입력 (예: AB1234)" style="text-transform:uppercase;letter-spacing:2px">
          <button class="btn btn--secondary" id="spy-join-btn">참가</button>
        </div>
      </section>

      <div class="game-tip-v2">AI 난이도 <b>어려움</b>은 매우 그럴듯한 힌트를 내 구별이 어렵습니다. 집중해서 관찰하세요!</div>
    </div>`;
}

// ─── 대기실 화면 ──────────────────────────────────────────────────────────────
export function renderSpyRoomHTML(room, players, myUid) {
  const url = buildGameInviteUrl('soso-spy', room.id);
  const isHost = myUid === room.hostId;
  const alivePlayers = players.filter(p => !p.isAI);
  const canStart = isHost && room.status === 'waiting' && alivePlayers.length >= 3;
  const hasAI = players.some(p => p.isAI);
  const diff = DIFFICULTY_LABELS[room.difficulty] || '보통';
  const categoryLabel = CATEGORY_LABELS[room.category] || room.category || '-';

  return `
    <div class="game-ai-shell spy-shell">
      <section class="spy-hero spy-hero--room">
        <button class="game-back-btn" id="spy-back" type="button" aria-label="뒤로">←</button>
        <div class="spy-hero__eyebrow">방 코드 <span class="spy-code-badge">${esc(room.code || '')}</span></div>
        <h1 class="spy-hero__title">${esc(room.title || '소소스파이')}</h1>
        <div class="game-hero-chips">
          <span>대기중</span>
          <span>${esc(categoryLabel)}</span>
          <span>${players.length}/${room.maxPlayers || 6}명</span>
          <span>${diff}</span>
        </div>
      </section>

      <div class="spy-invite-bar">
        <input class="form-input spy-invite-input" value="${esc(url)}" readonly>
        <button class="btn btn--secondary btn--sm" data-copy-invite>링크 복사</button>
      </div>

      <section class="spy-card">
        <div class="spy-card__head">
          <h2>참가자 <span class="spy-badge">${players.length}명</span></h2>
        </div>
        <div class="spy-player-list">
          ${players.filter(p => !p.isAI).map(p => _renderWaitingPlayer(p, room, myUid)).join('')}
          ${hasAI ? `
            <div class="spy-player-item spy-player-item--ai">
              <div class="spy-player-avatar spy-player-avatar--ai">🤖</div>
              <div class="spy-player-info">
                <div class="spy-player-name">AI 스파이 <span class="spy-tag spy-tag--ai">AI</span></div>
                <div class="spy-player-sub">숨어있는 중...</div>
              </div>
            </div>` : ''}
        </div>

        ${isHost ? `
          <div class="spy-host-actions">
            ${!hasAI ? `<button class="btn btn--ghost btn--sm" id="spy-add-ai-btn">🤖 AI 스파이 추가</button>` : ''}
            <button class="btn btn--primary btn--full spy-btn-glow" id="spy-start-btn" ${canStart ? '' : 'disabled'}>
              ${canStart ? '🎮 게임 시작' : alivePlayers.length < 3 ? '3명 이상 필요' : '대기중...'}
            </button>
          </div>` : `
          <div class="spy-waiting-msg">방장이 게임을 시작할 때까지 기다려주세요.</div>`}
      </section>

      <div class="game-tip-v2">초대 링크를 공유해 친구들을 불러오세요. AI 스파이가 함께 위장 참가합니다.</div>
    </div>`;
}

function _renderWaitingPlayer(player, room, myUid) {
  const isHost = player.uid === room.hostId;
  const isMe = player.uid === myUid;
  const initial = String(player.name || '?').slice(0, 1).toUpperCase();
  return `
    <div class="spy-player-item ${isMe ? 'spy-player-item--me' : ''}">
      <div class="spy-player-avatar ${isHost ? 'spy-player-avatar--host' : ''}">${esc(initial)}</div>
      <div class="spy-player-info">
        <div class="spy-player-name">
          ${esc(player.name || '참가자')}
          ${isHost ? '<span class="spy-tag">방장</span>' : ''}
          ${isMe ? '<span class="spy-tag spy-tag--me">나</span>' : ''}
        </div>
        <div class="spy-player-sub">대기중</div>
      </div>
    </div>`;
}

// ─── 힌트 입력 단계 ───────────────────────────────────────────────────────────
export function renderSpyHintPhaseHTML(room, players, myUid, myHint, submittedCount) {
  const isHost = myUid === room.hostId;
  const myPlayer = players.find(p => p.uid === myUid);
  const myKeyword = myPlayer?.isAI ? room.aiKeyword : room.keyword;
  const alreadySubmitted = !!myHint;
  const totalAlive = players.filter(p => p.alive !== false).length;
  const timerEnd = room.timerEnd?.toDate ? room.timerEnd.toDate() : room.timerEnd ? new Date(room.timerEnd) : null;

  return `
    <div class="game-ai-shell spy-shell">
      <section class="spy-phase-header">
        <div class="spy-round-badge">ROUND ${room.round || 1} / ${room.totalRounds || 3}</div>
        <h2 class="spy-phase-title">힌트를 입력하세요</h2>
        ${timerEnd ? renderSpyTimerBar(timerEnd, 35) : ''}
      </section>

      <div class="spy-keyword-card ${myPlayer?.isAI ? 'spy-keyword-card--ai' : ''}">
        <div class="spy-keyword-card__label">${myPlayer?.isAI ? '당신은 AI 스파이' : '당신의 단어'}</div>
        <div class="spy-keyword-card__word">${esc(myKeyword || '???')}</div>
        <div class="spy-keyword-card__hint">
          ${myPlayer?.isAI
            ? '이 단어로 시민인 척 힌트를 작성하세요. 너무 어색하면 들킵니다!'
            : '이 단어와 관련된 힌트를 작성하세요. 너무 직접적으로 말하면 AI가 베낄 수 있어요.'}
        </div>
      </div>

      <section class="spy-card">
        <div class="spy-card__head"><h2>힌트 입력</h2></div>
        ${alreadySubmitted ? `
          <div class="spy-submitted-banner">
            <span class="spy-submitted-icon">✅</span>
            <div>
              <div class="spy-submitted-title">제출 완료!</div>
              <div class="spy-submitted-text">"${esc(myHint)}"</div>
            </div>
          </div>` : `
          <div class="spy-hint-input-row">
            <input id="spy-hint-input" class="form-input" maxlength="40" placeholder="단어와 관련된 힌트 (40자 이내)">
            <button class="btn btn--primary spy-btn-glow" id="spy-hint-submit-btn">제출</button>
          </div>
          <div class="form-hint" style="margin-top:6px">최대 40자, 단어를 직접 쓰지 마세요.</div>`}

        <div class="spy-submit-status">
          <div class="spy-submit-status__bar">
            <div class="spy-submit-status__fill" style="width:${totalAlive > 0 ? Math.round((submittedCount / totalAlive) * 100) : 0}%"></div>
          </div>
          <div class="spy-submit-status__text">${submittedCount} / ${totalAlive}명 제출 완료</div>
        </div>
      </section>

      ${isHost ? `
        <div class="spy-host-bar">
          <button class="btn btn--secondary btn--full" id="spy-reveal-hints-btn"
            ${submittedCount >= totalAlive ? '' : 'disabled'}>
            ${submittedCount >= totalAlive ? '힌트 공개하기 →' : `${totalAlive - submittedCount}명 제출 대기중`}
          </button>
        </div>` : ''}
    </div>`;
}

// ─── 토론 단계 ────────────────────────────────────────────────────────────────
export function renderSpyDiscussionHTML(room, players, myUid, hints) {
  const isHost = myUid === room.hostId;
  const timerEnd = room.timerEnd?.toDate ? room.timerEnd.toDate() : room.timerEnd ? new Date(room.timerEnd) : null;
  const alivePlayers = players.filter(p => !room.eliminated?.includes(p.uid));

  return `
    <div class="game-ai-shell spy-shell">
      <section class="spy-phase-header">
        <div class="spy-round-badge">ROUND ${room.round || 1} / ${room.totalRounds || 3} · 토론</div>
        <h2 class="spy-phase-title">스파이를 찾아내세요!</h2>
        ${timerEnd ? renderSpyTimerBar(timerEnd, 95) : ''}
      </section>

      <section class="spy-card">
        <div class="spy-card__head"><h2>힌트 카드</h2><span>카테고리: ${esc(CATEGORY_LABELS[room.category] || room.category || '-')}</span></div>
        <div class="spy-hint-cards">
          ${alivePlayers.map(p => {
            const hint = hints?.[p.uid];
            const isMe = p.uid === myUid;
            return `
              <div class="spy-hint-card ${isMe ? 'spy-hint-card--me' : ''}">
                <div class="spy-hint-card__avatar">${esc(String(p.name || '?').slice(0, 1).toUpperCase())}</div>
                <div class="spy-hint-card__body">
                  <div class="spy-hint-card__name">
                    ${esc(p.name || '참가자')}
                    ${isMe ? '<span class="spy-tag spy-tag--me">나</span>' : ''}
                  </div>
                  <div class="spy-hint-card__text">${hint ? esc(hint.text || '(힌트 없음)') : '<span class="spy-hint-pending">힌트 없음</span>'}</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>

      ${isHost ? `
        <div class="spy-host-bar">
          <button class="btn btn--primary btn--full spy-btn-glow" id="spy-to-vote-btn">🗳 투표 시작하기</button>
        </div>` : `
        <div class="spy-waiting-msg">방장이 투표를 시작할 때까지 토론하세요.</div>`}
    </div>`;
}

// ─── 투표 단계 ────────────────────────────────────────────────────────────────
export function renderSpyVoteHTML(room, players, myUid, myVote) {
  const isHost = myUid === room.hostId;
  const timerEnd = room.timerEnd?.toDate ? room.timerEnd.toDate() : room.timerEnd ? new Date(room.timerEnd) : null;
  const eliminated = room.eliminated || [];
  const votablePlayers = players.filter(p => p.uid !== myUid && !eliminated.includes(p.uid) && !p.isAI);

  return `
    <div class="game-ai-shell spy-shell">
      <section class="spy-phase-header">
        <div class="spy-round-badge">ROUND ${room.round || 1} / ${room.totalRounds || 3} · 투표</div>
        <h2 class="spy-phase-title">AI 스파이를 지목하세요</h2>
        ${timerEnd ? renderSpyTimerBar(timerEnd, 35) : ''}
      </section>

      <div class="spy-vote-guide">스파이라고 생각하는 플레이어에게 투표하세요. 최다 득표자가 탈락합니다.</div>

      <section class="spy-card">
        <div class="spy-card__head"><h2>투표 대상</h2></div>
        <div class="spy-vote-list">
          ${votablePlayers.length === 0
            ? '<div class="spy-empty">투표할 수 있는 플레이어가 없습니다.</div>'
            : votablePlayers.map(p => {
                const isVoted = myVote === p.uid;
                return `
                  <button class="spy-vote-card ${isVoted ? 'spy-vote-card--selected' : ''}" data-vote-uid="${esc(p.uid)}" id="spy-vote-${esc(p.uid)}">
                    <div class="spy-vote-card__avatar">${esc(String(p.name || '?').slice(0, 1).toUpperCase())}</div>
                    <div class="spy-vote-card__name">${esc(p.name || '참가자')}</div>
                    ${isVoted ? '<div class="spy-vote-card__check">✓ 선택됨</div>' : '<div class="spy-vote-card__action">지목</div>'}
                  </button>`;
              }).join('')}
        </div>

        ${myVote ? `
          <div class="spy-voted-confirm">
            <span>✅ 투표 완료 — 결과를 기다리세요.</span>
          </div>` : ''}
      </section>

      ${isHost ? `
        <div class="spy-host-bar">
          <button class="btn btn--primary btn--full spy-btn-glow" id="spy-resolve-vote-btn">결과 보기</button>
        </div>` : ''}
    </div>`;
}

// ─── 결과 공개 화면 ───────────────────────────────────────────────────────────
export function renderSpyRevealHTML(room, players, revealedUid, wasAI) {
  const isHost = room.hostId === auth.currentUser?.uid;
  const revealedPlayer = players.find(p => p.uid === revealedUid);
  const revealedName = revealedPlayer?.name || '(알 수 없음)';
  const hasWinner = !!room.winner;
  const isTied = room.voteTied;

  return `
    <div class="game-ai-shell spy-shell">
      <section class="spy-reveal-hero ${wasAI ? 'spy-reveal-hero--win' : 'spy-reveal-hero--lose'}">
        <div class="spy-reveal-hero__icon">${isTied ? '🤝' : wasAI ? '🎉' : '❌'}</div>
        <div class="spy-reveal-hero__title">
          ${isTied
            ? '동점 — 탈락자 없음!'
            : wasAI
              ? 'AI 스파이를 찾았어요!'
              : '시민이 탈락했어요...'}
        </div>
        ${!isTied && revealedUid ? `
          <div class="spy-reveal-hero__sub">
            <b>${esc(revealedName)}</b>이(가) 탈락했습니다.
            ${wasAI ? '<br>이 플레이어가 AI 스파이였습니다! 🤖' : '<br>억울하지만 그는 시민이었어요 😢'}
          </div>` : ''}
        ${isTied ? '<div class="spy-reveal-hero__sub">득표수가 같아 탈락자가 없습니다.</div>' : ''}
      </section>

      ${!isTied && revealedUid ? `
        <div class="spy-reveal-card">
          <div class="spy-reveal-card__avatar">${esc(String(revealedName).slice(0, 1).toUpperCase())}</div>
          <div class="spy-reveal-card__info">
            <div class="spy-reveal-card__name">${esc(revealedName)}</div>
            <div class="spy-reveal-card__role">${wasAI ? '🤖 AI 스파이' : '🙋 시민'}</div>
          </div>
        </div>` : ''}

      ${isHost ? `
        <div class="spy-host-bar">
          ${hasWinner
            ? `<button class="btn btn--primary btn--full spy-btn-glow" id="spy-done-btn">게임 결과 보기</button>`
            : `<button class="btn btn--primary btn--full spy-btn-glow" id="spy-next-round-btn">다음 라운드 →</button>`}
        </div>` : `
        <div class="spy-waiting-msg">방장이 다음 단계를 진행할 때까지 기다려주세요.</div>`}
    </div>`;
}

// ─── 최종 결과 화면 ───────────────────────────────────────────────────────────
export function renderSpyDoneHTML(room, players, myUid) {
  const isCitizensWin = room.winner === 'citizens';
  const isAIWin = room.winner === 'ai';
  const eliminated = room.eliminated || [];
  const aiPlayer = players.find(p => p.isAI);
  const diffLabel = DIFFICULTY_LABELS[room.difficulty] || '보통';
  const categoryLabel = CATEGORY_LABELS[room.category] || room.category || '-';

  return `
    <div class="game-ai-shell spy-shell">
      <section class="spy-done-hero ${isCitizensWin ? 'spy-done-hero--citizens' : 'spy-done-hero--ai'}">
        <div class="spy-done-hero__icon">${isCitizensWin ? '🏆' : '🤖'}</div>
        <h1 class="spy-done-hero__title">${isCitizensWin ? '시민 승리!' : 'AI 스파이 승리!'}</h1>
        <p class="spy-done-hero__desc">
          ${isCitizensWin
            ? 'AI 스파이의 정체를 밝혀냈습니다! 훌륭한 추리력이에요.'
            : 'AI 스파이가 끝까지 들키지 않았습니다! 다음엔 더 잘 찾을 수 있어요.'}
        </p>
      </section>

      ${aiPlayer ? `
        <div class="spy-ai-reveal">
          <div class="spy-ai-reveal__icon">🤖</div>
          <div class="spy-ai-reveal__body">
            <div class="spy-ai-reveal__title">AI 스파이의 정체</div>
            <div class="spy-ai-reveal__name">${esc(aiPlayer.name || 'AI')}</div>
            <div class="spy-ai-reveal__meta">난이도: ${esc(diffLabel)} · 카테고리: ${esc(categoryLabel)}</div>
            <div class="spy-ai-reveal__words">
              <div>시민 단어: <b>${esc(room.keyword || '-')}</b></div>
              <div>AI 단어: <b>${esc(room.aiKeyword || '-')}</b></div>
            </div>
          </div>
        </div>` : ''}

      <section class="spy-card">
        <div class="spy-card__head"><h2>라운드 요약</h2></div>
        <div class="spy-round-summary">
          <div class="spy-summary-row">
            <span>진행 라운드</span>
            <b>${room.round || 0} / ${room.totalRounds || 3}</b>
          </div>
          <div class="spy-summary-row">
            <span>탈락자 수</span>
            <b>${eliminated.length}명</b>
          </div>
          <div class="spy-summary-row">
            <span>최종 결과</span>
            <b>${isCitizensWin ? '시민 승리 🏆' : 'AI 승리 🤖'}</b>
          </div>
        </div>

        <div class="spy-final-players">
          ${players.filter(p => !p.isAI).map(p => {
            const isElim = eliminated.includes(p.uid);
            const isMe = p.uid === myUid;
            return `
              <div class="spy-final-player ${isElim ? 'spy-final-player--elim' : ''}">
                <div class="spy-final-player__avatar">${esc(String(p.name || '?').slice(0, 1).toUpperCase())}</div>
                <div class="spy-final-player__name">
                  ${esc(p.name || '참가자')}
                  ${isMe ? '<span class="spy-tag spy-tag--me">나</span>' : ''}
                  ${isElim ? '<span class="spy-tag spy-tag--elim">탈락</span>' : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>

      <div class="spy-host-bar">
        <button class="btn btn--primary btn--full spy-btn-glow" onclick="navigate('/game/soso-spy')">다시 하기</button>
      </div>
    </div>`;
}

// ─── 방 없음 화면 ─────────────────────────────────────────────────────────────
export function renderSpyNotFoundHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🔍</div>
      <div class="empty-state__title">방을 찾을 수 없어요</div>
      <div class="empty-state__desc">방이 종료되었거나 잘못된 링크일 수 있어요.</div>
      <button class="btn btn--primary" onclick="navigate('/game/soso-spy')">소소스파이 방 만들기</button>
    </div>`;
}

// ─── 다른 게임 방 화면 ────────────────────────────────────────────────────────
export function renderSpyWrongGameHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🚫</div>
      <div class="empty-state__title">소소스파이 방이 아니에요</div>
      <div class="empty-state__desc">다른 게임 방 링크입니다.</div>
      <button class="btn btn--primary" onclick="navigate('/sosoland')">게임 목록으로</button>
    </div>`;
}

// ─── 로딩 화면 ────────────────────────────────────────────────────────────────
export function renderSpyLoadingHTML() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

// ─── 타이머 프로그레스바 ──────────────────────────────────────────────────────
export function renderSpyTimerBar(timerEnd, totalSeconds) {
  const now = Date.now();
  const end = timerEnd instanceof Date ? timerEnd.getTime() : Number(timerEnd);
  const remaining = Math.max(0, Math.ceil((end - now) / 1000));
  const percent = totalSeconds > 0 ? Math.min(100, Math.round((remaining / totalSeconds) * 100)) : 0;
  const isUrgent = remaining <= 10;

  return `
    <div class="spy-timer-wrap">
      <div class="spy-timer-bar ${isUrgent ? 'spy-timer-bar--urgent' : ''}">
        <div class="spy-timer-bar__fill" style="width:${percent}%"></div>
      </div>
      <div class="spy-timer-text ${isUrgent ? 'spy-timer-text--urgent' : ''}">${remaining}초</div>
    </div>`;
}
