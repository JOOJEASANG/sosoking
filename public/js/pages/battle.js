/* battle.js — 소소킹 정치 배틀 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { renderPartyBadge } from '../utils/party-badge.js';
import { getPoliticalRank } from '../utils/political-rank.js';
import { appState } from '../state.js';
import { showPointPopup } from '../utils/point-popup.js';
import { checkRankUp } from '../utils/rank-up.js';

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

function getKstMidnight() {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() + 1, -9, 0, 0, 0);
}

function fmtDeadline(deadline) {
  const ms = deadline - Date.now();
  if (ms <= 0) return '투표 마감';
  const totalSecs = Math.ceil(ms / 1000);
  if (totalSecs <= 3600) {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `⚡ ${m}:${String(s).padStart(2, '0')} 남음`;
  }
  const h = Math.floor(ms / 3600000);
  const m2 = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `⏰ 마감 ${m2}분 전`;
  return `⏰ 마감 ${h}시간 ${m2}분 전`;
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
        <span class="battle-vote-row__count">${fmtNum(count)}표 · ${pct}%</span>
      </div>
      <div class="battle-vote-row__bar-wrap">
        <div class="battle-vote-row__bar" style="width:${pct}%;background:${char.color}"></div>
      </div>
    </div>`;
}

const BATTLE_PARTY_INFO = {
  national: { name: '국민안정당', emoji: '🎙️', color: '#8B7355' },
  youth:    { name: '청년혁명당', emoji: '📱', color: '#E84393' },
  center:   { name: '중도민주당', emoji: '📊', color: '#00CEC9' },
};

function renderPartyVoteSummary(partyVotes, chars, partyId) {
  if (!partyVotes || !partyId || !partyVotes[partyId]) return '';
  const pVotes = partyVotes[partyId];
  const partyTotal = Object.values(pVotes).reduce((s, v) => s + Number(v || 0), 0);
  if (partyTotal === 0) return '';
  const sorted = [...chars].sort((a, b) => (Number(pVotes[b.id] || 0)) - (Number(pVotes[a.id] || 0)));
  const top = sorted[0];
  const topPct = Math.round((Number(pVotes[top.id] || 0) / partyTotal) * 100);
  return `
    <div class="battle-party-vote">
      <div class="battle-party-vote__title">🏛️ 우리 당 지지 현황</div>
      <div class="battle-party-vote__list">
        ${sorted.map(c => {
          const cnt = Number(pVotes[c.id] || 0);
          const pct = partyTotal > 0 ? Math.round((cnt / partyTotal) * 100) : 0;
          return `<div class="battle-party-vote__row">
            <span class="battle-party-vote__emoji">${c.emoji}</span>
            <span class="battle-party-vote__name">${escHtml(c.name)}</span>
            <div class="battle-party-vote__bar-wrap">
              <div class="battle-party-vote__bar" style="width:${pct}%;background:${c.color}"></div>
            </div>
            <span class="battle-party-vote__pct">${pct}%</span>
          </div>`;
        }).join('')}
      </div>
      <div class="battle-party-vote__hint">우리 당 ${partyTotal}명 투표 · ${top.emoji} ${escHtml(top.name)} ${topPct}% 지지</div>
    </div>`;
}

function renderAllPartyVoteSummary(partyVotes, chars) {
  if (!partyVotes) return '';
  const partyIds = Object.keys(partyVotes).filter(pid => {
    const pv = partyVotes[pid];
    return Object.values(pv).some(v => Number(v) > 0);
  });
  if (partyIds.length < 2) return '';

  const rows = partyIds.map(pid => {
    const pInfo = BATTLE_PARTY_INFO[pid];
    if (!pInfo) return '';
    const pVotes = partyVotes[pid];
    const partyTotal = Object.values(pVotes).reduce((s, v) => s + Number(v || 0), 0);
    if (!partyTotal) return '';
    const topChar = [...chars].sort((a, b) => Number(pVotes[b.id] || 0) - Number(pVotes[a.id] || 0))[0];
    const topPct = Math.round((Number(pVotes[topChar.id] || 0) / partyTotal) * 100);
    return `<div class="battle-all-party-row" style="--party-c:${pInfo.color}">
      <span class="battle-all-party-row__party">${pInfo.emoji} ${escHtml(pInfo.name)}</span>
      <span class="battle-all-party-row__arrow">→</span>
      <span class="battle-all-party-row__pick">${topChar.emoji} ${escHtml(topChar.name)}</span>
      <span class="battle-all-party-row__pct">${topPct}%</span>
      <span class="battle-all-party-row__total">(${partyTotal}명)</span>
    </div>`;
  }).filter(Boolean);

  if (!rows.length) return '';
  return `
    <div class="battle-all-party-summary">
      <div class="battle-all-party-summary__title">📊 정당별 지지 성향</div>
      ${rows.join('')}
    </div>`;
}

function renderVoteButtons(chars, userVote, status) {
  if (status === 'ended') return '';
  if (userVote) return '';
  return `
    <div class="battle-vote-grid">
      ${chars.map(c => `
        <button class="battle-vote-btn" data-char-id="${c.id}" type="button" style="--char-color:${c.color}">
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

const BATTLE_REACTIONS = [
  { key: 'like',  label: '👍', title: '공감' },
  { key: 'fire',  label: '🔥', title: '뜨거워' },
  { key: 'funny', label: '🤣', title: '웃겨' },
];

function renderComments(comments) {
  if (!comments.length) {
    return `<div class="battle-comment-empty">첫 번째 토론 의견을 남겨보세요!</div>`;
  }
  return comments.map(c => {
    const rank = getPoliticalRank(c.power || 0);
    const partyBadge = c.partyId ? renderPartyBadge(c.partyId) : '';
    const reactions = c.reactions || {};
    const myReaction = c.myReaction || null;
    const reactBtns = BATTLE_REACTIONS.map(r => {
      const count = reactions[r.key] || 0;
      const isActive = myReaction === r.key;
      return `<button class="battle-comment-react${isActive ? ' battle-comment-react--active' : ''}" data-comment-id="${escHtml(c.id)}" data-reaction="${r.key}" title="${r.title}" type="button">${r.label}${count > 0 ? ` <span class="battle-comment-react__count">${count}</span>` : ''}</button>`;
    }).join('');
    return `
    <div class="battle-comment" data-comment-id="${escHtml(c.id)}">
      <div class="battle-comment__head">
        <span class="battle-comment__author">${partyBadge}<span class="comment-rank-emoji" title="${escHtml(rank.title)}">${escHtml(rank.emoji)}</span>${escHtml(c.authorName)}</span>
        <span class="battle-comment__time">${fmtTime(c.createdAt)}</span>
      </div>
      <div class="battle-comment__text">${escHtml(c.text)}</div>
      <div class="battle-comment__reactions">${reactBtns}</div>
    </div>`;
  }).join('');
}

function commentReactionScore(c) {
  const r = c.reactions || {};
  return (r.like || 0) + (r.fire || 0) * 2 + (r.funny || 0);
}

function renderBestComment(comments) {
  if (!comments || comments.length < 3) return '';
  const best = [...comments].sort((a, b) => commentReactionScore(b) - commentReactionScore(a))[0];
  if (!best || commentReactionScore(best) === 0) return '';
  const rank = getPoliticalRank(best.power || 0);
  const partyBadge = best.partyId ? renderPartyBadge(best.partyId) : '';
  return `
    <div class="battle-best-comment">
      <div class="battle-best-comment__label">✨ 오늘의 토론 명장면</div>
      <div class="battle-best-comment__text">"${escHtml(best.text)}"</div>
      <div class="battle-best-comment__author">${partyBadge}<span class="comment-rank-emoji">${escHtml(rank.emoji)}</span>${escHtml(best.authorName)}</div>
    </div>`;
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
      recentComments = [], partyVotes = null } = data;

    const rulingBanner = renderRulingBanner(currentKing);

    if (!exists) {
      el.innerHTML = `
        <div class="battle-page page-enter">
          ${rulingBanner}
          <div class="battle-topic-card">
            <div class="battle-topic-card__header">
              <div class="battle-topic-card__badge">⚔️ 오늘의 정치 스캔들</div>
            </div>
            <div class="battle-topic-card__body">
              <div class="battle-topic-card__title">이슈 생성 중...</div>
              <div class="battle-topic-card__desc">매일 자정 새로운 정치 스캔들이 터집니다</div>
            </div>
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

        <div class="battle-game-bar">
          <span class="battle-game-bar__label">📋 데일리 퀘스트</span>
          <span class="battle-game-bar__rewards">투표 <b>+5P</b></span>
          <span class="battle-game-bar__sep">·</span>
          <span class="battle-game-bar__rewards">댓글 <b>+10P</b></span>
          <span class="battle-game-bar__sep">·</span>
          <span class="battle-game-bar__rewards">집권 정당에 <b>보너스</b></span>
        </div>

        <div class="battle-topic-card">
          <div class="battle-topic-card__header">
            <div class="battle-topic-card__badge">⚔️ 오늘의 정치 스캔들${isEnded ? ' · 종료' : ''}</div>
            ${!isEnded ? '<span class="battle-topic-card__live">🔴 LIVE</span>' : ''}
          </div>
          <div class="battle-topic-card__body">
            <div class="battle-topic-card__title">${escHtml(topic)}</div>
            ${topicDesc ? `<div class="battle-topic-card__desc">${escHtml(topicDesc)}</div>` : ''}
          </div>
          <div class="battle-topic-card__footer">
            <span class="battle-live-counter">
              <span class="battle-live-counter__dot"></span>
              총 ${fmtNum(totalVotes)}명 참여
            </span>
            ${!isEnded ? `<span class="battle-deadline-timer" id="battle-deadline-timer">${fmtDeadline(getKstMidnight())}</span>` : `<span class="battle-deadline-timer battle-deadline-timer--ended">투표 마감</span>`}
          </div>
        </div>

        <div class="battle-turns">
          ${turns.map((t, i) => renderTurnBubble(t, i)).join('')}
        </div>

        <div class="battle-vote-section">
          <div class="battle-vote-section__title">
            ${isEnded
              ? (winnerChar ? `🏛️ 오늘의 집권 대표: ${winnerChar.emoji} ${escHtml(winnerChar.name)}` : '⚔️ 오늘의 투표 결과')
              : (userVote ? `✅ 투표 완료 · 총 ${fmtNum(totalVotes)}표` : `⚔️ 오늘 논쟁의 승자는 누구? (1표 +5P)`)}
          </div>

          ${!votedOrEnded ? renderVoteButtons(chars, userVote, status) : ''}

          <div class="battle-vote-bars" id="vote-bars">
            ${chars.map(c => renderVoteBar(c, votes, totalVotes, userVote)).join('')}
          </div>

          ${userVote ? `<div class="battle-power-hint">⚡ 배틀 투표 완료 · 정치력 +5P 획득!</div>` : ''}
          ${userVote ? `
            <div class="battle-next-actions">
              <button class="battle-next-btn battle-next-btn--primary" id="btn-next-home" type="button">📋 오늘 미션 이어서 완료하기</button>
              <button class="battle-next-btn" id="btn-next-republic" type="button">🏛️ 공화국 현황 보기</button>
            </div>` : ''}
          ${votedOrEnded && appState.partyId ? renderPartyVoteSummary(partyVotes, chars, appState.partyId) : ''}
          ${votedOrEnded ? renderAllPartyVoteSummary(partyVotes, chars) : ''}
          ${votedOrEnded ? `<button class="battle-share-btn" id="btn-share-battle" type="button">📤 결과 공유하기</button>` : ''}
          ${!auth.currentUser && !isEnded ? `
            <div class="battle-login-hint">
              <a href="#/login" class="btn btn--outline" style="width:100%">로그인하고 투표하기</a>
            </div>` : ''}
        </div>

        ${isEnded && aftermath ? renderAftermath(aftermath) : ''}

        <button class="battle-judge-cta battle-judge-cta--secondary" id="btn-to-judge" type="button">⚖️ AI 판결소에서 판결받기</button>

        ${renderBestComment(recentComments)}

        <!-- 토론 댓글 -->
        <div class="battle-discuss">
          <div class="battle-discuss__title">💬 토론 참여하기 <span class="battle-discuss__reward">첫 의견 +10P</span></div>
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
    el.querySelector('#btn-to-judge')?.addEventListener('click', () => navigate('/constitutional-court'));
    el.querySelector('#btn-next-home')?.addEventListener('click', () => navigate('/'));
    el.querySelector('#btn-next-republic')?.addEventListener('click', () => navigate('/republic'));

    if (!votedOrEnded && auth.currentUser) {
      el.querySelectorAll('.battle-vote-btn').forEach(btn => {
        btn.addEventListener('click', () => handleVote(btn.dataset.charId, data, el));
      });
    }

    el.querySelector('#btn-discuss-submit')?.addEventListener('click', () => handleComment(el));

    el.querySelector('#comment-list')?.addEventListener('click', async e => {
      const btn = e.target.closest('.battle-comment-react');
      if (!btn) return;
      if (!auth.currentUser) { navigate('/login'); return; }
      const commentId = btn.dataset.commentId;
      const reaction = btn.dataset.reaction;
      if (!commentId || !reaction) return;
      btn.disabled = true;
      try {
        const { data: rData } = await httpsCallable(functions, 'reactToBattleComment')({ commentId, reaction });
        const commentEl = el.querySelector(`.battle-comment[data-comment-id="${commentId}"]`);
        if (!commentEl) return;
        commentEl.querySelectorAll('.battle-comment-react').forEach(b => {
          const isThis = b.dataset.reaction === reaction;
          const wasActive = b.classList.contains('battle-comment-react--active');
          const countEl = b.querySelector('.battle-comment-react__count');
          const reactionLabel = BATTLE_REACTIONS.find(r => r.key === b.dataset.reaction)?.label || '';
          if (isThis) {
            b.classList.toggle('battle-comment-react--active', !!rData.active);
            const prev = countEl ? parseInt(countEl.textContent) || 0 : 0;
            const newCount = rData.active ? prev + 1 : Math.max(0, prev - 1);
            b.innerHTML = `${reactionLabel}${newCount > 0 ? ` <span class="battle-comment-react__count">${newCount}</span>` : ''}`;
          } else if (wasActive) {
            b.classList.remove('battle-comment-react--active');
            const prev = countEl ? parseInt(countEl.textContent) || 0 : 0;
            const newCount = Math.max(0, prev - 1);
            b.innerHTML = `${reactionLabel}${newCount > 0 ? ` <span class="battle-comment-react__count">${newCount}</span>` : ''}`;
          }
          b.disabled = false;
        });
      } catch {
        btn.disabled = false;
      }
    });

    el.querySelector('#btn-share-battle')?.addEventListener('click', async () => {
      const votedChar = userVote ? chars.find(c => c.id === userVote) : null;
      const winChar = king ? chars.find(c => c.id === king) : null;
      const shareText = isEnded && winChar
        ? `🏛️ 소소공화국 오늘의 정치배틀 결과\n👑 집권 대표: ${winChar.emoji} ${winChar.name}\n📰 "${topic}"\n총 ${fmtNum(totalVotes)}명 참여\nhttps://sosoking.co.kr`
        : `🗳️ 소소공화국 정치배틀\n"${topic}"\n${votedChar ? `나는 ${votedChar.emoji} ${votedChar.name} 지지!` : ''}\nhttps://sosoking.co.kr`;
      try {
        if (navigator.share) {
          await navigator.share({ title: '소소공화국 정치배틀', text: shareText, url: 'https://sosoking.co.kr' });
        } else {
          await navigator.clipboard.writeText(shareText);
          toast.success('결과가 클립보드에 복사됐어요! 📋');
        }
      } catch { /* user cancelled or unsupported */ }
    });

    if (!isEnded) {
      const timerEl = el.querySelector('#battle-deadline-timer');
      if (timerEl) {
        const deadline = getKstMidnight();
        let usingSeconds = false;
        let tickTimer = null;
        const tick = () => {
          if (!document.contains(timerEl)) { clearInterval(tickTimer); return; }
          const label = fmtDeadline(deadline);
          timerEl.textContent = label;
          timerEl.dataset.urgent = label.startsWith('⚡') ? 'true' : 'false';
          const nowSubHour = (deadline - Date.now()) <= 3600000;
          if (nowSubHour && !usingSeconds) {
            clearInterval(tickTimer);
            usingSeconds = true;
            tickTimer = setInterval(tick, 1000);
          }
        };
        usingSeconds = (deadline - Date.now()) <= 3600000;
        tickTimer = setInterval(tick, usingSeconds ? 1000 : 60000);
        window.addEventListener('hashchange', () => clearInterval(tickTimer), { once: true });
      }
    }

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

    const barsSection = el.querySelector('.battle-vote-section');
    if (barsSection && !barsSection.querySelector('.battle-power-hint')) {
      const hint = document.createElement('div');
      hint.className = 'battle-power-hint';
      hint.textContent = '⚡ 배틀 투표 완료 · 정치력 +5P 획득!';
      barsSection.appendChild(hint);

      const nextActions = document.createElement('div');
      nextActions.className = 'battle-next-actions';
      nextActions.innerHTML = `
        <button class="battle-next-btn battle-next-btn--primary" id="btn-next-home" type="button">📋 오늘 미션 이어서 완료하기</button>
        <button class="battle-next-btn" id="btn-next-republic" type="button">🏛️ 공화국 현황 보기</button>`;
      barsSection.appendChild(nextActions);
      nextActions.querySelector('#btn-next-home').addEventListener('click', () => navigate('/'));
      nextActions.querySelector('#btn-next-republic').addEventListener('click', () => navigate('/republic'));
    }

    const char = prevData.chars.find(c => c.id === charId);
    toast.success(`${char?.emoji || ''} ${char?.name || ''} 지지!`);
    appState.points = (appState.points || 0) + 5;
    showPointPopup(5);
    if (auth.currentUser) checkRankUp(auth.currentUser.uid, appState.points);
    httpsCallable(functions, 'syncPartyMemberPower')({}).catch(() => {});
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
    const { data: res } = await addBattleComment({ text });

    const listEl = el.querySelector('#comment-list');
    if (listEl) {
      const newComment = {
        authorName: appState.nickname || auth.currentUser?.displayName || '익명',
        text,
        partyId: appState.partyId || null,
        power: appState.points || 0,
        createdAt: Date.now(),
      };
      const emptyEl = listEl.querySelector('.battle-comment-empty');
      if (emptyEl) emptyEl.remove();
      listEl.insertAdjacentHTML('afterbegin', renderComments([newComment]));
    }

    input.value = '';
    if (res?.pointsAwarded) {
      showPointPopup(res.pointsAwarded);
      toast.success(`의견을 남겼어요! +${res.pointsAwarded}P 🎉`);
    } else {
      toast.success('의견을 남겼어요!');
    }
  } catch (err) {
    toast.error(err?.message || '댓글 등록에 실패했어요');
  } finally {
    btn.disabled = false;
  }
}
