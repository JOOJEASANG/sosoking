/* battle.js — 소소킹 왕좌전쟁 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

function renderKingBanner(king) {
  if (!king) {
    return `<div class="battle-king-banner battle-king-banner--empty">
      <span class="battle-king-banner__crown">👑</span>
      <span class="battle-king-banner__text">아직 왕좌가 비어 있습니다</span>
    </div>`;
  }
  const streakText = king.streak > 1 ? ` <span class="battle-king-banner__streak">🔥 ${king.streak}연속</span>` : '';
  return `<div class="battle-king-banner">
    <span class="battle-king-banner__crown">👑</span>
    <span class="battle-king-banner__emoji">${king.emoji}</span>
    <span class="battle-king-banner__info">
      <span class="battle-king-banner__label">현재 왕</span>
      <span class="battle-king-banner__name">${escHtml(king.name)} · ${escHtml(king.title)}${streakText}</span>
    </span>
  </div>`;
}

function renderTurnBubble(turn, index) {
  const isUmmoja = turn.charId === 'ummoja';
  return `
    <div class="battle-turn${isUmmoja ? ' battle-turn--ummoja' : ''}" style="--i:${index}">
      <div class="battle-turn__avatar">${turn.emoji}</div>
      <div class="battle-turn__body">
        <div class="battle-turn__name">${escHtml(turn.charName)}</div>
        <div class="battle-turn__text">${escHtml(turn.text)}</div>
      </div>
    </div>`;
}

function renderVoteBar(char, votes, totalVotes, userVote) {
  const count = votes[char.id] || 0;
  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
  const isVoted = userVote === char.id;
  return `
    <div class="battle-vote-row${isVoted ? ' battle-vote-row--voted' : ''}" data-char-id="${char.id}">
      <div class="battle-vote-row__head">
        <span class="battle-vote-row__emoji">${char.emoji}</span>
        <span class="battle-vote-row__name">${escHtml(char.name)}</span>
        ${isVoted ? '<span class="battle-vote-row__check">✓ 내 선택</span>' : ''}
        <span class="battle-vote-row__count">${fmtNum(count)}표 (${pct}%)</span>
      </div>
      <div class="battle-vote-row__bar-wrap">
        <div class="battle-vote-row__bar" style="width:${pct}%;background:${char.color}"></div>
      </div>
    </div>`;
}

function renderAftermath(aftermath) {
  if (!aftermath) return '';
  const { decree, reactions = [] } = aftermath;
  return `
    <div class="battle-aftermath">
      <div class="battle-aftermath__title">👑 왕의 즉위 칙령</div>
      <div class="battle-aftermath__decree">${escHtml(decree)}</div>
      ${reactions.length ? `
        <div class="battle-aftermath__reactions-title">📣 낙선 귀족들의 반응</div>
        <div class="battle-aftermath__reactions">
          ${reactions.map(r => `
            <div class="battle-aftermath__reaction">
              <span class="battle-aftermath__reaction-emoji">${r.emoji}</span>
              <div class="battle-aftermath__reaction-body">
                <span class="battle-aftermath__reaction-name">${escHtml(r.charName)}</span>
                <span class="battle-aftermath__reaction-text">${escHtml(r.text)}</span>
              </div>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
}

function renderVoteButtons(chars, userVote, status) {
  if (status === 'ended') return '';
  if (userVote) return '';
  return `
    <div class="battle-vote-grid">
      ${chars.map(c => `
        <button class="battle-vote-btn" data-char-id="${c.id}" type="button">
          <span class="battle-vote-btn__emoji">${c.emoji}</span>
          <span class="battle-vote-btn__name">${escHtml(c.name)}</span>
        </button>`).join('')}
    </div>`;
}

export async function renderBattle() {
  setMeta('소소킹 · 왕좌전쟁');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="battle-page page-enter">
      <div class="skeleton" style="height:64px;border-radius:16px;margin-bottom:12px"></div>
      <div class="skeleton" style="height:120px;border-radius:16px;margin-bottom:12px"></div>
      <div class="skeleton" style="height:360px;border-radius:16px"></div>
    </div>`;

  try {
    const getBattleStatus = httpsCallable(functions, 'getBattleStatus');
    const { data } = await getBattleStatus();

    const { exists, topic, topicDesc, turns = [], votes = {}, totalVotes = 0,
      status, userVote, currentKing, chars = [], king, aftermath } = data;

    const kingBanner = renderKingBanner(currentKing);

    if (!exists) {
      el.innerHTML = `
        <div class="battle-page page-enter">
          ${kingBanner}
          <div class="battle-topic-card">
            <div class="battle-topic-card__badge">⚔️ 오늘의 왕좌전쟁</div>
            <div class="battle-topic-card__title">전쟁 준비 중...</div>
            <div class="battle-topic-card__desc">매일 자정 새로운 왕국 사건이 발생합니다</div>
          </div>
          <button class="btn btn--primary" id="btn-history" style="margin-top:16px">👑 역대 왕 기록 보기</button>
        </div>`;
      el.querySelector('#btn-history')?.addEventListener('click', () => navigate('/king-history'));
      return;
    }

    const isEnded = status === 'ended';
    const votedOrEnded = !!userVote || isEnded;

    el.innerHTML = `
      <div class="battle-page page-enter">

        ${kingBanner}

        <div class="battle-topic-card">
          <div class="battle-topic-card__badge">⚔️ 오늘의 왕국 사건${isEnded ? ' · 종료' : ' · 진행 중'}</div>
          <div class="battle-topic-card__title">${escHtml(topic)}</div>
          ${topicDesc ? `<div class="battle-topic-card__desc">${escHtml(topicDesc)}</div>` : ''}
        </div>

        <div class="battle-turns">
          ${turns.map((t, i) => renderTurnBubble(t, i)).join('')}
        </div>

        <div class="battle-vote-section">
          <div class="battle-vote-section__title">
            ${isEnded
              ? (king ? `👑 오늘의 왕: ${chars.find(c => c.id === king)?.emoji || ''} ${escHtml(chars.find(c => c.id === king)?.name || '')}` : '⚔️ 오늘의 투표 결과')
              : (userVote ? `✅ 투표 완료 · 총 ${fmtNum(totalVotes)}표` : `⚔️ 누구에게 한 표? (오늘 1회)`)}
          </div>

          ${!votedOrEnded ? renderVoteButtons(chars, userVote, status) : ''}

          <div class="battle-vote-bars" id="vote-bars">
            ${chars.map(c => renderVoteBar(c, votes, totalVotes, userVote)).join('')}
          </div>

          ${!auth.currentUser && !isEnded ? `
            <div class="battle-login-hint">
              <a href="#/login" class="btn btn--outline" style="width:100%">로그인하고 투표하기</a>
            </div>` : ''}
        </div>

        ${isEnded && aftermath ? renderAftermath(aftermath) : ''}

        <button class="btn btn--ghost btn--sm" id="btn-history" style="margin-top:8px;width:100%">👑 역대 왕 기록 →</button>
      </div>`;

    el.querySelector('#btn-history')?.addEventListener('click', () => navigate('/king-history'));

    if (!votedOrEnded && auth.currentUser) {
      el.querySelectorAll('.battle-vote-btn').forEach(btn => {
        btn.addEventListener('click', () => handleVote(btn.dataset.charId, data, el));
      });
    }

  } catch (err) {
    console.error('[battle] load error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚔️</div>
        <div class="empty-state__title">왕좌전쟁을 불러오지 못했어요</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-retry">다시 시도</button>
      </div>`;
    el.querySelector('#btn-retry')?.addEventListener('click', renderBattle);
  }
}

async function handleVote(charId, prevData, el) {
  if (!auth.currentUser) { navigate('/login'); return; }

  const btns = el.querySelectorAll('.battle-vote-btn');
  btns.forEach(b => { b.disabled = true; });

  try {
    const voteForChar = httpsCallable(functions, 'voteForChar');
    await voteForChar({ charId });

    // 낙관적 업데이트
    const newVotes = { ...prevData.votes };
    newVotes[charId] = (newVotes[charId] || 0) + 1;
    const newTotal = (prevData.totalVotes || 0) + 1;

    const voteGrid = el.querySelector('.battle-vote-grid');
    if (voteGrid) voteGrid.remove();

    const barsEl = el.querySelector('#vote-bars');
    if (barsEl) {
      barsEl.innerHTML = prevData.chars.map(c =>
        renderVoteBar(c, newVotes, newTotal, charId)
      ).join('');
    }

    const titleEl = el.querySelector('.battle-vote-section__title');
    if (titleEl) titleEl.textContent = `✅ 투표 완료 · 총 ${fmtNum(newTotal)}표`;

    const char = prevData.chars.find(c => c.id === charId);
    toast.success(`${char?.emoji || ''} ${char?.name || ''} 에게 한 표!`);
  } catch (err) {
    btns.forEach(b => { b.disabled = false; });
    if (err?.code === 'already-exists') {
      toast.warn('오늘은 이미 투표했어요');
    } else {
      toast.error(err?.message || '투표에 실패했어요');
    }
  }
}
