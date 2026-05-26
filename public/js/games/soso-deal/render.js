import { buildGameInviteUrl, esc } from '../common.js';
import { CARD_EMOJI, calcSetPoints, countCards } from './actions.js';

// ─── 카드 타입별 CSS 클래스 매핑 ─────────────────────────────────────────────
const CARD_TYPE_CLASS = {
  금: 'gold',
  은: 'silver',
  식량: 'food',
  목재: 'wood',
  철: 'iron',
  보석: 'gem',
};

const DIFFICULTY_LABELS = {
  easy: '😊 쉬움',
  normal: '😐 보통',
  hard: '😈 어려움',
};

// ─── 카드 뱃지 렌더 ──────────────────────────────────────────────────────────
function _cardBadge(type, count) {
  const emoji = CARD_EMOJI[type] || '?';
  const cls = CARD_TYPE_CLASS[type] || '';
  if (count !== undefined) {
    return `<span class="deal-card-visual deal-card-visual--${cls}">${emoji} ${esc(type)} ×${count}</span>`;
  }
  return `<span class="deal-card-visual deal-card-visual--${cls}">${emoji} ${esc(type)}</span>`;
}

// ─── 점수표 렌더 (공통) ──────────────────────────────────────────────────────
function _renderScoreboard(players, myUid, currentTurnUid) {
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  return `
    <div class="deal-scoreboard">
      <div class="deal-scoreboard__head">점수표</div>
      <div class="deal-scoreboard__list">
        ${sorted.map((p, idx) => {
          const isMe = p.uid === myUid;
          const isTurn = p.uid === currentTurnUid;
          return `
            <div class="deal-scoreboard__row ${isMe ? 'deal-scoreboard__row--me' : ''} ${isTurn ? 'deal-scoreboard__row--turn' : ''}">
              <span class="deal-scoreboard__rank">${idx + 1}</span>
              <span class="deal-scoreboard__name">
                ${p.isAI ? '🤖 ' : ''}${esc(p.name || '참가자')}
                ${isMe ? '<span class="deal-tag">나</span>' : ''}
                ${isTurn ? '<span class="deal-tag deal-tag--turn">턴</span>' : ''}
              </span>
              <span class="deal-scoreboard__score">${p.score || 0}점</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── 액션 로그 렌더 ──────────────────────────────────────────────────────────
function _renderActionLog(actions) {
  if (!actions || actions.length === 0) {
    return `<div class="deal-log"><div class="deal-log-empty">아직 행동 기록이 없습니다.</div></div>`;
  }
  const recent = [...actions].slice(-10).reverse();
  return `
    <div class="deal-log">
      <div class="deal-log__head">행동 기록</div>
      ${recent.map(a => {
        let cls = '';
        let text = '';
        if (a.type === 'market_swap') {
          cls = 'swap';
          text = `${esc(a.actorName || '?')}이(가) ${CARD_EMOJI[a.offer] || ''}${esc(a.offer)}→시장, ${CARD_EMOJI[a.take] || ''}${esc(a.take)} 획득`;
        } else if (a.type === 'draw') {
          cls = 'draw';
          text = `${esc(a.actorName || '?')}이(가) 덱에서 카드를 드로우했습니다`;
        } else if (a.type === 'cash_in') {
          cls = 'cashin';
          text = `${esc(a.actorName || '?')}이(가) ${CARD_EMOJI[a.cardType] || ''}${esc(a.cardType)} ${a.count}장 제출 → +${a.points}점`;
        } else if (a.type === 'trade') {
          cls = 'trade';
          const offerStr = (a.offerCards || []).map(c => `${CARD_EMOJI[c] || ''}${esc(c)}`).join(', ');
          const reqStr = (a.requestCards || []).map(c => `${CARD_EMOJI[c] || ''}${esc(c)}`).join(', ');
          text = `${esc(a.actorName || '?')} ↔ ${esc(a.targetName || '?')} 거래 (${offerStr} / ${reqStr})`;
        } else if (a.type === 'ai_turn' || a.type === 'ai_action') {
          cls = 'ai';
          text = `🤖 ${esc(a.actorName || 'AI')} — ${esc(a.message || a.detail || '행동함')}`;
        } else {
          cls = 'draw';
          text = esc(a.actorName || '?') + ' 행동';
        }
        return `<div class="deal-log-entry deal-log-entry--${cls}">${text}</div>`;
      }).join('')}
    </div>`;
}

// ─── 세트 현황 요약 ──────────────────────────────────────────────────────────
function _renderSetStatus(hand) {
  const counts = countCards(hand);
  const sets = Object.entries(counts).filter(([, c]) => c >= 3);
  if (sets.length === 0) return '';
  return `
    <div class="deal-set-status">
      <div class="deal-set-status__head">세트 가능!</div>
      <div class="deal-set-status__items">
        ${sets.map(([type, count]) => {
          const pts = calcSetPoints(count);
          const cls = CARD_TYPE_CLASS[type] || '';
          return `<div class="deal-set-status__item deal-set-status__item--${cls}">
            ${CARD_EMOJI[type] || ''}${esc(type)} ${count}장 → +${pts}점
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── 수신 거래 제안 렌더 ────────────────────────────────────────────────────
function _renderIncomingProposals(proposals, myUid) {
  const mine = (proposals || []).filter(p => p.toUid === myUid && p.status === 'pending');
  if (mine.length === 0) return '';
  return `
    <div class="deal-proposals-section">
      <div class="deal-proposals-section__head">📩 거래 제안 수신 (${mine.length})</div>
      ${mine.map(p => {
        const offerStr = (p.offerCards || []).map(c => `${CARD_EMOJI[c] || ''}${esc(c)}`).join(', ');
        const reqStr = (p.requestCards || []).map(c => `${CARD_EMOJI[c] || ''}${esc(c)}`).join(', ');
        return `
          <div class="deal-proposal-card">
            <div class="deal-proposal-card__from">
              <span class="deal-proposal-card__name">${esc(p.fromName || '?')}</span>의 제안
            </div>
            <div class="deal-proposal-card__exchange">
              <div class="deal-proposal-card__offer">
                <span class="deal-proposal-card__label">제공</span>
                <span class="deal-proposal-card__cards">${offerStr}</span>
              </div>
              <div class="deal-proposal-card__arrow">⇄</div>
              <div class="deal-proposal-card__request">
                <span class="deal-proposal-card__label">요청</span>
                <span class="deal-proposal-card__cards">${reqStr}</span>
              </div>
            </div>
            <div class="deal-proposal-card__actions">
              <button class="btn btn--success btn--sm" data-accept-proposal="${esc(p.id)}">✓ 수락</button>
              <button class="btn btn--danger btn--sm" data-reject-proposal="${esc(p.id)}">✕ 거절</button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ─── 거래 제안 폼 (숨김 상태 포함) ─────────────────────────────────────────
function _renderProposeForm(players, myUid) {
  const targets = players.filter(p => p.uid !== myUid);
  return `
    <div class="deal-propose-form" id="deal-propose-form" hidden>
      <div class="deal-propose-form__head">거래 제안 작성</div>
      <div class="form-group">
        <label class="form-label">대상 선택</label>
        <select id="deal-propose-target" class="form-select">
          <option value="">-- 대상을 선택하세요 --</option>
          ${targets.map(p => `<option value="${esc(p.uid)}">${p.isAI ? '🤖 ' : ''}${esc(p.name || '참가자')}</option>`).join('')}
        </select>
      </div>
      <div class="deal-propose-form__cards">
        <div class="form-group">
          <label class="form-label">내가 제공할 카드 <small>(쉼표 구분, 예: 금,은)</small></label>
          <input id="deal-propose-offer" class="form-input" maxlength="60" placeholder="예: 금, 은">
        </div>
        <div class="form-group">
          <label class="form-label">내가 요청할 카드 <small>(쉼표 구분)</small></label>
          <input id="deal-propose-request" class="form-input" maxlength="60" placeholder="예: 보석, 식량">
        </div>
      </div>
      <div class="deal-propose-form__footer">
        <button class="btn btn--secondary btn--sm" id="deal-propose-cancel">취소</button>
        <button class="btn btn--primary" id="deal-propose-submit">제안 보내기</button>
      </div>
    </div>`;
}

// ─── 세트 점수 안내표 ────────────────────────────────────────────────────────
function _renderSetGuide() {
  return `
    <div class="deal-set-guide">
      <div class="deal-set-guide__head">세트 점수표</div>
      <div class="deal-set-guide__items">
        <div class="deal-set-guide__item"><span>3장</span><b>+1점</b></div>
        <div class="deal-set-guide__item"><span>4장</span><b>+3점</b></div>
        <div class="deal-set-guide__item"><span>5장↑</span><b>+6점</b></div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  1. 로비 화면
// ════════════════════════════════════════════════════════════════════════════
export function renderDealLobbyHTML() {
  return `
    <div class="deal-shell">
      <div class="deal-hero">
        <button class="deal-back-btn" id="deal-back" type="button" aria-label="뒤로">←</button>
        <div class="deal-hero__eyebrow">🎴 SOSO DEAL · 카드 거래 게임</div>
        <h1 class="deal-hero__title">소소딜</h1>
        <p class="deal-hero__desc">
          시장에서 자원을 교환하고 세트를 완성해 최고 상인이 되세요!<br>
          2~5명 + AI 브로커와 함께하는 실시간 카드 거래 게임
        </p>
        <div class="deal-hero__chips">
          <span>💰 6종 자원</span>
          <span>🔄 시장 교환</span>
          <span>🤝 플레이어 거래</span>
          <span>🏆 6라운드</span>
        </div>
      </div>

      <div class="deal-guide">
        <div class="deal-guide__head">HOW TO PLAY</div>
        <div class="deal-guide__steps">
          <div class="deal-guide-step">
            <div class="deal-guide-step__num">1</div>
            <div class="deal-guide-step__body">
              <b><span class="deal-guide-step__icon">🃏</span> 카드 배분</b>
              <span>게임 시작 시 5장의 자원 카드를 받습니다. 금💰 은🥈 식량🌾 목재🪵 철⚙️ 보석💎 중 랜덤 배분.</span>
            </div>
          </div>
          <div class="deal-guide-step">
            <div class="deal-guide-step__num">2</div>
            <div class="deal-guide-step__body">
              <b><span class="deal-guide-step__icon">🔄</span> 내 턴 행동</b>
              <span>시장 교환(내 카드 ↔ 시장 카드), 덱 드로우, 세트 제출(같은 카드 3장↑), 다른 플레이어에게 거래 제안 중 하나를 선택하세요.</span>
            </div>
          </div>
          <div class="deal-guide-step">
            <div class="deal-guide-step__num">3</div>
            <div class="deal-guide-step__body">
              <b><span class="deal-guide-step__icon">🤝</span> 거래 & 협상</b>
              <span>내 차례에 다른 플레이어에게 거래를 제안할 수 있습니다. 상대방은 내 차례가 아니어도 수락/거절 가능!</span>
            </div>
          </div>
          <div class="deal-guide-step">
            <div class="deal-guide-step__num">4</div>
            <div class="deal-guide-step__body">
              <b><span class="deal-guide-step__icon">🏆</span> 세트 제출 & 승리</b>
              <span>같은 카드 3장=+1점, 4장=+3점, 5장↑=+6점. 6라운드 종료 후 점수 합산 — 최고점 플레이어가 승리!</span>
            </div>
          </div>
        </div>
      </div>

      <div class="deal-create-form">
        <h2>방 만들기</h2>
        <div class="form-group">
          <label class="form-label">방 제목</label>
          <input id="deal-title" class="form-input" maxlength="40" value="소소딜" placeholder="방 제목">
        </div>
        <div class="deal-create-form__options">
          <div class="form-group">
            <label class="form-label">최대 인원</label>
            <select id="deal-max" class="form-select">
              <option value="2">2명</option>
              <option value="3">3명</option>
              <option value="4" selected>4명</option>
              <option value="5">5명</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">AI 난이도</label>
            <select id="deal-difficulty" class="form-select">
              <option value="easy">😊 쉬움</option>
              <option value="normal" selected>😐 보통</option>
              <option value="hard">😈 어려움</option>
            </select>
          </div>
        </div>
        <button class="btn btn--primary btn--full deal-btn-glow" id="deal-create-btn" style="margin-top:10px">방 만들기</button>
      </div>

      <div class="deal-divider">또는</div>

      <div class="deal-join-form">
        <h2>초대 코드로 참가</h2>
        <div class="deal-join-row">
          <input id="deal-join-code" class="form-input" maxlength="8"
            placeholder="초대 코드 (예: AB1234)"
            style="text-transform:uppercase;letter-spacing:2px">
          <button class="btn btn--secondary" id="deal-join-btn">참가</button>
        </div>
      </div>

      ${_renderSetGuide()}

      <div class="game-tip-v2">AI 브로커는 <b>어려움</b> 난이도일수록 더 정교하게 거래합니다. 방심하면 점수를 빼앗겨요!</div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  2. 대기실 화면
// ════════════════════════════════════════════════════════════════════════════
export function renderDealRoomHTML(room, players, myUid) {
  const url = buildGameInviteUrl('soso-deal', room.id);
  const isHost = myUid === room.hostId;
  const humanPlayers = players.filter(p => !p.isAI);
  const hasAI = players.some(p => p.isAI);
  const canStart = isHost && humanPlayers.length >= 2;
  const diff = DIFFICULTY_LABELS[room.difficulty] || '보통';

  return `
    <div class="deal-shell">
      <div class="deal-hero deal-hero--room">
        <button class="deal-back-btn" id="deal-back" type="button" aria-label="뒤로">←</button>
        <div class="deal-hero__eyebrow">방 코드 <span class="deal-code-badge">${esc(room.code || '')}</span></div>
        <h1 class="deal-hero__title">${esc(room.title || '소소딜')}</h1>
        <div class="deal-hero__chips">
          <span>대기중</span>
          <span>${players.length} / ${room.maxPlayers || 4}명</span>
          <span>${diff}</span>
        </div>
      </div>

      <div class="deal-invite-bar">
        <input class="form-input deal-invite-input" value="${esc(url)}" readonly>
        <button class="btn btn--secondary btn--sm" data-copy-invite>링크 복사</button>
      </div>

      <div class="deal-card">
        <div class="deal-card__head">
          <h2>참가자 <span class="deal-badge">${players.length}명</span></h2>
        </div>
        <div class="deal-player-list">
          ${humanPlayers.map(p => _renderRoomPlayer(p, room, myUid)).join('')}
          ${hasAI ? `
            <div class="deal-player-item deal-player-item--ai">
              <div class="deal-player-avatar deal-player-avatar--ai">🤖</div>
              <div class="deal-player-info">
                <div class="deal-player-name">AI 브로커 <span class="deal-tag deal-tag--ai">AI</span></div>
                <div class="deal-player-sub">전략적으로 거래 중...</div>
              </div>
            </div>` : ''}
        </div>

        ${isHost ? `
          <div class="deal-host-actions">
            ${!hasAI ? `<button class="btn btn--ghost btn--sm" id="deal-add-ai-btn">🤖 AI 브로커 추가</button>` : ''}
            <button class="btn btn--primary btn--full deal-btn-glow" id="deal-start-btn" ${canStart ? '' : 'disabled'}>
              ${canStart ? '🎴 게임 시작' : '최소 2명 필요'}
            </button>
          </div>` : `
          <div class="deal-waiting-msg">방장이 게임을 시작할 때까지 기다려주세요.</div>`}
      </div>

      <div class="game-tip-v2">초대 링크를 공유하거나 방 코드 <b>${esc(room.code || '')}</b>를 알려주세요!</div>
    </div>`;
}

function _renderRoomPlayer(player, room, myUid) {
  const isHost = player.uid === room.hostId;
  const isMe = player.uid === myUid;
  const initial = String(player.name || '?').slice(0, 1).toUpperCase();
  return `
    <div class="deal-player-item ${isMe ? 'deal-player-item--me' : ''}">
      <div class="deal-player-avatar ${isHost ? 'deal-player-avatar--host' : ''}">${esc(initial)}</div>
      <div class="deal-player-info">
        <div class="deal-player-name">
          ${esc(player.name || '참가자')}
          ${isHost ? '<span class="deal-tag deal-tag--host">방장</span>' : ''}
          ${isMe ? '<span class="deal-tag deal-tag--me">나</span>' : ''}
        </div>
        <div class="deal-player-sub">대기중</div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  3. 플레이 중 화면
// ════════════════════════════════════════════════════════════════════════════
export function renderDealPlayingHTML(room, players, actions, proposals, myUid) {
  const currentTurnUid = room.currentTurnUid;
  const isMyTurn = currentTurnUid === myUid;
  const myPlayer = players.find(p => p.uid === myUid);
  const currentPlayer = players.find(p => p.uid === currentTurnUid);
  const hand = myPlayer?.hand || [];
  const market = room.market || [];
  const round = room.round || 1;
  const maxRounds = room.maxRounds || 6;
  const counts = countCards(hand);

  // 같은 카드 3장↑ 있는지 확인 (세트 제출 버튼 활성화용)
  const hasSet = Object.values(counts).some(c => c >= 3);

  return `
    <div class="deal-shell">
      <div class="deal-header">
        <button class="deal-back-btn" id="deal-back" type="button" aria-label="뒤로">←</button>
        <div class="deal-header__center">
          <div class="deal-round-badge">ROUND ${round} / ${maxRounds}</div>
          <div class="deal-turn-info">
            ${isMyTurn
              ? '<span class="deal-turn-info--mine">🎯 내 차례입니다!</span>'
              : `<span class="deal-turn-info--other">${esc(currentPlayer?.name || '?')}의 차례</span>`}
          </div>
        </div>
        <div class="deal-header__right"></div>
      </div>

      ${_renderScoreboard(players, myUid, currentTurnUid)}

      <!-- 시장 -->
      <div class="deal-market-section">
        <div class="deal-market-section__head">
          🏪 시장 카드 <small>클릭하여 선택</small>
        </div>
        <div class="deal-market">
          ${market.map((card, idx) => {
            const emoji = CARD_EMOJI[card] || '?';
            const cls = CARD_TYPE_CLASS[card] || '';
            return `
              <div class="deal-market-card deal-card--${cls}" data-market-card="${esc(card)}" data-market-idx="${idx}">
                <div class="deal-market-card__emoji">${emoji}</div>
                <div class="deal-market-card__name">${esc(card)}</div>
              </div>`;
          }).join('')}
          ${market.length === 0 ? '<div class="deal-market-empty">시장 카드 없음</div>' : ''}
        </div>
      </div>

      <!-- 내 손패 -->
      <div class="deal-hand-section">
        <div class="deal-hand-section__head">
          🃏 내 손패 (${hand.length}장) <small>클릭하여 선택</small>
        </div>
        ${_renderSetStatus(hand)}
        <div class="deal-hand">
          ${hand.length === 0
            ? '<div class="deal-hand-empty">손패가 없습니다.</div>'
            : hand.map((card, idx) => {
                const emoji = CARD_EMOJI[card] || '?';
                const cls = CARD_TYPE_CLASS[card] || '';
                const isSetCard = counts[card] >= 3;
                return `
                  <div class="deal-card deal-card--${cls} ${isSetCard ? 'deal-card--set-ready' : ''}"
                    data-card="${esc(card)}" data-hand-idx="${idx}" title="${esc(card)}">
                    <div class="deal-card__emoji">${emoji}</div>
                    <div class="deal-card__name">${esc(card)}</div>
                    ${counts[card] > 1 ? `<div class="deal-card__count">×${counts[card]}</div>` : ''}
                  </div>`;
              }).join('')}
        </div>
      </div>

      <!-- 내 완성 세트 -->
      ${myPlayer?.setsCompleted?.length > 0 ? `
        <div class="deal-completed-sets">
          <div class="deal-completed-sets__head">완성한 세트</div>
          <div class="deal-completed-sets__list">
            ${(myPlayer.setsCompleted || []).map(s => {
              const cls = CARD_TYPE_CLASS[s.type] || '';
              return `<div class="deal-completed-set deal-completed-set--${cls}">
                ${CARD_EMOJI[s.type] || ''}${esc(s.type)} ${s.count}장 (+${s.points}점)
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

      <!-- 수신 거래 제안 (항상 표시) -->
      ${_renderIncomingProposals(proposals, myUid)}

      <!-- 내 차례 액션 패널 -->
      ${isMyTurn ? `
        <div class="deal-action-panel">
          <div class="deal-action-panel__head">🎮 행동 선택</div>
          <div class="deal-action-panel__hint">손패 카드와 시장 카드를 클릭하여 선택 후 행동하세요.</div>
          <div class="deal-action-panel__btns">
            <button class="btn btn--secondary deal-action-btn" id="deal-btn-swap">
              🔄 시장 교환
              <span>손패↔시장</span>
            </button>
            <button class="btn btn--secondary deal-action-btn" id="deal-btn-draw">
              📦 덱 드로우
              <span>덱에서 1장</span>
            </button>
            <button class="btn deal-action-btn deal-action-btn--cashin ${hasSet ? 'btn--primary deal-btn-glow' : 'btn--secondary'}"
              id="deal-btn-cashin" ${hasSet ? '' : 'disabled'}>
              💎 세트 제출
              <span>${hasSet ? '3장↑ 선택됨!' : '3장 이상 필요'}</span>
            </button>
            <button class="btn btn--secondary deal-action-btn" id="deal-btn-propose">
              🤝 거래 제안
              <span>플레이어와 교환</span>
            </button>
          </div>
          ${_renderProposeForm(players, myUid)}
          <button class="btn btn--ghost deal-end-turn-btn" id="deal-btn-end-turn">턴 종료 →</button>
        </div>` : `
        <div class="deal-waiting-panel">
          <div class="deal-waiting-panel__icon">⏳</div>
          <div class="deal-waiting-panel__text">${esc(currentPlayer?.name || '?')}의 차례입니다. 잠시 기다려주세요.</div>
        </div>`}

      <!-- 다른 플레이어 손패 수 표시 -->
      <div class="deal-other-players">
        <div class="deal-other-players__head">다른 플레이어</div>
        <div class="deal-other-players__list">
          ${players.filter(p => p.uid !== myUid).map(p => {
            const isTurn = p.uid === currentTurnUid;
            const cls = CARD_TYPE_CLASS['금'] || '';
            return `
              <div class="deal-other-player ${isTurn ? 'deal-other-player--turn' : ''}">
                <div class="deal-other-player__avatar">${p.isAI ? '🤖' : esc(String(p.name || '?').slice(0, 1))}</div>
                <div class="deal-other-player__info">
                  <div class="deal-other-player__name">
                    ${p.isAI ? '🤖 ' : ''}${esc(p.name || '?')}
                    ${isTurn ? '<span class="deal-tag deal-tag--turn">턴</span>' : ''}
                  </div>
                  <div class="deal-other-player__meta">손패 ${(p.hand || []).length}장 · ${p.score || 0}점</div>
                </div>
                ${(p.setsCompleted || []).length > 0 ? `
                  <div class="deal-other-player__sets">
                    ${p.setsCompleted.map(s => `<span class="deal-set-badge">${CARD_EMOJI[s.type] || ''}${s.count}장</span>`).join('')}
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>

      ${_renderActionLog(actions)}
      ${_renderSetGuide()}
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  4. 게임 종료 화면
// ════════════════════════════════════════════════════════════════════════════
export function renderDealDoneHTML(room, players, myUid) {
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = sorted[0];
  const isIWin = winner?.uid === myUid;

  return `
    <div class="deal-shell">
      <div class="deal-done-hero">
        <div class="deal-done-hero__icon">${isIWin ? '🏆' : '🎴'}</div>
        <h1 class="deal-done-hero__title">
          ${isIWin ? '🎉 축하해요! 당신이 승리했습니다!' : `${esc(winner?.name || '?')} 승리!`}
        </h1>
        <p class="deal-done-hero__desc">
          ${isIWin
            ? '탁월한 거래 감각으로 시장을 지배했어요!'
            : `${esc(winner?.name || '?')}이(가) ${winner?.score || 0}점으로 최고 상인이 됐습니다.`}
        </p>
      </div>

      <div class="deal-final-scores">
        <div class="deal-final-scores__head">최종 순위</div>
        ${sorted.map((p, idx) => {
          const isMe = p.uid === myUid;
          const isWinner = idx === 0;
          return `
            <div class="deal-final-score-row ${isWinner ? 'deal-final-score-row--winner' : ''} ${isMe ? 'deal-final-score-row--me' : ''}">
              <div class="deal-final-score-row__rank">
                ${isWinner ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}위`}
              </div>
              <div class="deal-final-score-row__info">
                <div class="deal-final-score-row__name">
                  ${p.isAI ? '🤖 ' : ''}${esc(p.name || '참가자')}
                  ${isMe ? '<span class="deal-tag deal-tag--me">나</span>' : ''}
                </div>
                ${(p.setsCompleted || []).length > 0 ? `
                  <div class="deal-final-score-row__sets">
                    ${p.setsCompleted.map(s =>
                      `<span class="deal-set-badge">${CARD_EMOJI[s.type] || ''}${esc(s.type)} ${s.count}장 (+${s.points}점)</span>`
                    ).join('')}
                  </div>` : '<div class="deal-final-score-row__sets">완성한 세트 없음</div>'}
              </div>
              <div class="deal-final-score-row__score">${p.score || 0}점</div>
            </div>`;
        }).join('')}
      </div>

      ${_renderSetGuide()}

      <div class="deal-done-actions">
        <button class="btn btn--primary btn--full deal-btn-glow"
          onclick="navigate('/game/soso-deal')">다시 하기</button>
        <button class="btn btn--ghost btn--full"
          onclick="navigate('/sosoland')">게임 목록으로</button>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  5. 유틸 화면들
// ════════════════════════════════════════════════════════════════════════════
export function renderDealLoadingHTML() {
  return `<div class="loading-center"><div class="spinner"></div></div>`;
}

export function renderDealNotFoundHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🔍</div>
      <div class="empty-state__title">방을 찾을 수 없어요</div>
      <div class="empty-state__desc">방이 종료되었거나 잘못된 링크일 수 있어요.</div>
      <button class="btn btn--primary" onclick="navigate('/game/soso-deal')">소소딜 방 만들기</button>
    </div>`;
}

export function renderDealWrongGameHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🚫</div>
      <div class="empty-state__title">소소딜 방이 아니에요</div>
      <div class="empty-state__desc">다른 게임 방 링크입니다.</div>
      <button class="btn btn--primary" onclick="navigate('/sosoland')">게임 목록으로</button>
    </div>`;
}
