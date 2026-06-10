/* battle.js — 소소킹 정치 배틀 */
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

function fmtTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function renderRulingBanner(king) {
  if (!king) {
    return `<div class="battle-king-banner battle-king-banner--empty">
      <span class="battle-king-banner__crown">🏛️</span>
      <span class="battle-king-banner__text">현재 집권 대표 없음 — 첫 배틀을 기다리는 중</span>
    </div>`;
  }
  const streakText = king.streak > 1 ? ` <span class="battle-king-banner__streak">🔥 ${king.streak}일 연속</span>` : '';
  return `<div class="battle-king-banner">
    <span class="battle-king-banner__crown">🏛️</span>
    <span class="battle-king-banner__emoji">${king.emoji}</span>
    <span class="battle-king-banner__info">
      <span class="battle-king-banner__label">현재 집권 대표</span>
      <span class="battle-king-banner__name">${escHtml(king.name)} · ${escHtml(king.party || king.title)}${streakText}</span>
    </span>
  </div>`;
}

function renderTurnBubble(turn, index) {
  const isProsecutor = turn.charId === 'prosecutor';
  return `
    <div class="battle-turn${isProsecutor ? ' battle-turn--ummoja' : ''}" style="--i:${index}">
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

function renderAftermath(aftermath) {
  if (!aftermath) return '';
  const { decree, reactions = [] } = aftermath;
  return `
    <div class="battle-aftermath">
      <div class="battle-aftermath__title">🏛️ 집권 선언</div>
      <div class="battle-aftermath__decree">${escHtml(decree)}</div>
      ${reactions.length ? `
        <div class="battle-aftermath__reactions-title">📣 낙선 정치인들의 반응</div>
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

function renderComments(comments) {
  if (!comments.length) {
    return `<div class="battle-comment-empty">첫 번째 토론 의견을 남겨보세요!</div>`;
  }
  return comments.map(c => `
    <div class="battle-comment">
      <div class="battle-comment__head">
        <span class="battle-comment__author">${escHtml(c.authorName)}</span>
        <span class="battle-comment__time">${fmtTime(c.createdAt)}</span>
      </div>
      <div class="battle-comment__text">${escHtml(c.text)}</div>
    </div>`).join('');
}

export async function renderBattle() {
  setMeta('소소킹 · 정치 배틀');
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
      status, userVote, currentKing, chars = [], king, aftermath,
      recentComments = [] } = data;

    const rulingBanner = renderRulingBanner(currentKing);

    if (!exists) {
      el.innerHTML = `
        <div class="battle-page page-enter">
          ${rulingBanner}
          <div class="battle-topic-card">
            <div class="battle-topic-card__badge">⚔️ 오늘의 정치 배틀</div>
            <div class="battle-topic-card__title">이슈 생성 중...</div>
            <div class="battle-topic-card__desc">매일 자정 새로운 정치 스캔들이 터집니다</div>
          </div>
          <button class="btn btn--primary" id="btn-history" style="margin-top:16px">🏛️ 집권 기록 보기</button>
        </div>`;
      el.querySelector('#btn-history')?.addEventListener('click', () => navigate('/king-history'));
      return;
    }

    const isEnded = status === 'ended';
    const votedOrEnded = !!userVote || isEnded;
    const winnerChar = king ? chars.find(c => c.id === king) : null;

    el.innerHTML = `
      <div class="battle-page page-enter">

        ${rulingBanner}

        <div class="battle-topic-card">
          <div class="battle-topic-card__badge">⚔️ 오늘의 정치 스캔들${isEnded ? ' · 종료' : ' · 진행 중'}</div>
          <div class="battle-topic-card__title">${escHtml(topic)}</div>
          ${topicDesc ? `<div class="battle-topic-card__desc">${escHtml(topicDesc)}</div>` : ''}
        </div>

        <div class="battle-turns">
          ${turns.map((t, i) => renderTurnBubble(t, i)).join('')}
        </div>

        <div class="battle-vote-section">
          <div class="battle-vote-section__title">
            ${isEnded
              ? (winnerChar ? `🏛️ 오늘의 집권 대표: ${winnerChar.emoji} ${escHtml(winnerChar.name)}` : '⚔️ 오늘의 투표 결과')
              : (userVote ? `✅ 투표 완료 · 총 ${fmtNum(totalVotes)}표` : `⚔️ 누구를 지지합니까? (오늘 1표)`)}
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

        <!-- 토론 댓글 -->
        <div class="battle-discuss">
          <div class="battle-discuss__title">💬 토론 참여하기</div>
          ${auth.currentUser ? `
            <div class="battle-discuss__form">
              <textarea class="battle-discuss__input" id="discuss-input" placeholder="이 사건에 대한 당신의 한마디..." rows="2" maxlength="300"></textarea>
              <button class="btn btn--primary btn--sm" id="btn-discuss-submit" style="margin-top:8px;width:100%">의견 남기기</button>
            </div>` : `
            <div style="margin-bottom:12px">
              <a href="#/login" class="btn btn--outline btn--sm" style="width:100%">로그인하고 토론 참여하기</a>
            </div>`}
          <div class="battle-comment-list" id="comment-list">
            ${renderComments(recentComments)}
          </div>
        </div>

        <button class="btn btn--ghost btn--sm" id="btn-history" style="margin-top:8px;width:100%">🏛️ 집권 기록 보기 →</button>
      </div>`;

    el.querySelector('#btn-history')?.addEventListener('click', () => navigate('/king-history'));

    if (!votedOrEnded && auth.currentUser) {
      el.querySelectorAll('.battle-vote-btn').forEach(btn => {
        btn.addEventListener('click', () => handleVote(btn.dataset.charId, data, el));
      });
    }

    el.querySelector('#btn-discuss-submit')?.addEventListener('click', () => handleComment(el));

  } catch (err) {
    console.error('[battle] load error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚔️</div>
        <div class="empty-state__title">배틀을 불러오지 못했어요</div>
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
    toast.success(`${char?.emoji || ''} ${char?.name || ''} 지지!`);
  } catch (err) {
    btns.forEach(b => { b.disabled = false; });
    if (err?.code === 'already-exists') {
      toast.warn('오늘은 이미 투표했어요');
    } else {
      toast.error(err?.message || '투표에 실패했어요');
    }
  }
}

async function handleComment(el) {
  const input = el.querySelector('#discuss-input');
  const btn = el.querySelector('#btn-discuss-submit');
  if (!input || !btn) return;

  const text = input.value.trim();
  if (!text) return;

  btn.disabled = true;
  try {
    const addBattleComment = httpsCallable(functions, 'addBattleComment');
    await addBattleComment({ text });

    const listEl = el.querySelector('#comment-list');
    if (listEl) {
      const newComment = {
        authorName: auth.currentUser?.displayName || '익명',
        text,
        createdAt: Date.now(),
      };
      const emptyEl = listEl.querySelector('.battle-comment-empty');
      if (emptyEl) emptyEl.remove();
      listEl.insertAdjacentHTML('beforeend', renderComments([newComment]));
    }

    input.value = '';
    toast.success('의견을 남겼어요!');
  } catch (err) {
    toast.error(err?.message || '댓글 등록에 실패했어요');
  } finally {
    btn.disabled = false;
  }
}
