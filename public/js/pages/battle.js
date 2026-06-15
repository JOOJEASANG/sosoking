/* battle.js — 소소공화국 정당 대항전 */
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

// 가벼운 컨페티 — 역전 선두 등 큰 순간에만 (의존성 없음)
function confettiBurst(anchor) {
  try {
    const host = document.createElement('div');
    host.className = 'battle-confetti-host';
    host.setAttribute('aria-hidden', 'true');
    const colors = ['#f7971e', '#ff512f', '#38ef7d', '#4e54c8', '#f7b733', '#00cec9'];
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('i');
      p.style.cssText = `left:${10 + Math.random() * 80}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.25).toFixed(2)}s;transform:rotate(${Math.random() * 360}deg)`;
      host.appendChild(p);
    }
    (anchor || document.body).appendChild(host);
    setTimeout(() => host.remove(), 1600);
  } catch {}
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

// 집권 정당 배너
function renderRulingBanner(king) {
  if (!king) {
    return `<div class="battle-king-banner battle-king-banner--empty">
      <span class="battle-king-banner__crown">🏛️</span>
      <span class="battle-king-banner__text">현재 집권 정당 없음 — 첫 논쟁을 기다리는 중</span>
    </div>`;
  }
  const streakText = king.streak > 1 ? ` <span class="battle-king-banner__streak">🔥 ${king.streak}일 연속</span>` : '';
  return `<div class="battle-king-banner" style="--king-color:${king.color || '#8B7355'}">
    <span class="battle-king-banner__crown">🏛️</span>
    <span class="battle-king-banner__emoji">${king.emoji}</span>
    <span class="battle-king-banner__info">
      <span class="battle-king-banner__label">어제의 논쟁 승리 정당</span>
      <span class="battle-king-banner__name">${escHtml(king.name)}${streakText}</span>
    </span>
  </div>`;
}

// 정당 토론 카드
function renderPartyDebateCard(partyId, partyInfo, debate, votes, totalVotes, userVote, isEnded, myPartyId) {
  if (!debate) return '';
  const count = votes[partyId] || 0;
  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
  const isVoted = userVote === partyId;
  const isMyParty = myPartyId === partyId;
  const isWinner = isEnded && userVote !== null && count === Math.max(...Object.values(votes));

  const stmtsHTML = (debate.statements || []).map(s => `
    <div class="battle-party-stmt">
      <span class="battle-party-stmt__emoji">${s.emoji}</span>
      <div class="battle-party-stmt__body">
        <span class="battle-party-stmt__name">${escHtml(s.charName)}</span>
        <p class="battle-party-stmt__text">${escHtml(s.text)}</p>
      </div>
    </div>`).join('');

  const barHTML = (userVote !== null || isEnded) ? `
    <div class="battle-party-card__result">
      <div class="battle-party-card__bar-wrap">
        <div class="battle-party-card__bar" style="width:${pct}%;background:${partyInfo.color}"></div>
      </div>
      <span class="battle-party-card__pct">${pct}% · ${fmtNum(count)}표</span>
    </div>` : '';

  const voteBtn = (!userVote && !isEnded) ? `
    <button class="battle-party-vote-btn" data-party-id="${partyId}" type="button" style="--party-color:${partyInfo.color}">
      ${partyInfo.emoji} 이 정당 지지 (+5P)
    </button>` : '';

  return `
    <div class="battle-party-card${isVoted ? ' battle-party-card--voted' : ''}${isMyParty ? ' battle-party-card--mine' : ''}${isWinner && count >= Math.max(...Object.values(votes)) && isEnded ? ' battle-party-card--winner' : ''}" data-party-id="${partyId}" style="--party-color:${partyInfo.color}">
      <div class="battle-party-card__head">
        <div class="battle-party-card__party-info">
          <span class="battle-party-card__emoji">${partyInfo.emoji}</span>
          <div>
            <div class="battle-party-card__name">${escHtml(partyInfo.name)}</div>
            ${debate.stance ? `<div class="battle-party-card__stance">"${escHtml(debate.stance)}"</div>` : ''}
          </div>
        </div>
        ${isMyParty ? `<span class="battle-party-card__my-badge">내 당</span>` : ''}
        ${isVoted ? `<span class="battle-party-card__voted-badge">✓ 지지</span>` : ''}
        ${isEnded && userVote !== null && count === Math.max(...Object.values(votes)) ? `<span class="battle-party-card__win-badge">🏆 승리</span>` : ''}
      </div>
      <div class="battle-party-stmts">${stmtsHTML}</div>
      ${barHTML}
      ${voteBtn}
    </div>`;
}

// aftermath (논쟁 결과)
function renderAftermath(aftermath, winningParty, partyInfo) {
  if (!aftermath) return '';
  const { decree, reactions = [] } = aftermath;
  const wInfo = winningParty && partyInfo ? partyInfo[winningParty] : null;
  return `
    <div class="battle-aftermath">
      <div class="battle-aftermath__title">🏛️ 집권 선언${wInfo ? ` — ${wInfo.emoji} ${wInfo.name}` : ''}</div>
      <div class="battle-aftermath__decree">${escHtml(decree)}</div>
      ${reactions.length ? `
        <div class="battle-aftermath__reactions-title">📣 패배 정당들의 반응</div>
        <div class="battle-aftermath__reactions">
          ${reactions.map(r => `
            <div class="battle-aftermath__reaction">
              <span class="battle-aftermath__reaction-emoji">${r.emoji || ''}</span>
              <div class="battle-aftermath__reaction-body">
                <span class="battle-aftermath__reaction-name">${escHtml(r.partyName || r.charName || '')}</span>
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
  setMeta('소소공화국 · 정당 대항전');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="battle-page page-enter">
      <div class="skeleton" style="height:64px;border-radius:16px;margin-bottom:12px"></div>
      <div class="skeleton" style="height:120px;border-radius:16px;margin-bottom:12px"></div>
      <div class="skeleton" style="height:400px;border-radius:16px"></div>
    </div>`;

  try {
    const getBattleStatus = httpsCallable(functions, 'getBattleStatus');
    const { data } = await getBattleStatus();

    const { exists, topic, topicDesc, partyDebates = {}, votes = {}, totalVotes = 0,
      status, userVote, currentKing, winningParty, aftermath,
      recentComments = [], partyInfo = {} } = data;

    const rulingBanner = renderRulingBanner(currentKing);
    const myPartyId = appState.partyId || null;

    if (!exists) {
      el.innerHTML = `
        <div class="battle-page page-enter">
          ${rulingBanner}
          <div class="battle-topic-card">
            <div class="battle-topic-card__header">
              <div class="battle-topic-card__badge">⚔️ 오늘의 정당 대항전</div>
            </div>
            <div class="battle-topic-card__body">
              <div class="battle-topic-card__title">오늘의 논쟁 생성 중...</div>
              <div class="battle-topic-card__desc">매일 자정 새로운 정치 이슈로 3당이 맞붙습니다</div>
            </div>
          </div>
          <button class="btn btn--primary" id="btn-history" style="margin-top:16px">🏛️ 논쟁 기록 보기</button>
        </div>`;
      el.querySelector('#btn-history')?.addEventListener('click', () => navigate('/king-history'));
      return;
    }

    const isEnded = status === 'ended';
    const votedOrEnded = userVote !== null || isEnded;
    const winnerPartyInfo = winningParty && partyInfo ? partyInfo[winningParty] : null;

    const partyOrder = ['national', 'youth', 'center'];
    const partyCardsHTML = partyOrder.map(pid => {
      const info = partyInfo[pid];
      const debate = partyDebates[pid];
      if (!info || !debate) return '';
      return renderPartyDebateCard(pid, info, debate, votes, totalVotes, userVote, isEnded, myPartyId);
    }).join('');

    el.innerHTML = `
      <div class="battle-page page-enter">

        ${rulingBanner}

        <div class="battle-game-bar">
          <span class="battle-game-bar__label">📋 데일리 퀘스트</span>
          <span class="battle-game-bar__rewards">투표 <b>+5P</b></span>
          <span class="battle-game-bar__sep">·</span>
          <span class="battle-game-bar__rewards">댓글 <b>+10P</b></span>
          <span class="battle-game-bar__sep">·</span>
          <span class="battle-game-bar__rewards">승리 정당에 <b>정치력 보너스</b></span>
        </div>

        <div class="battle-topic-card">
          <div class="battle-topic-card__header">
            <div class="battle-topic-card__badge">⚔️ 오늘의 정당 대항전${isEnded ? ' · 종료' : ''}</div>
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

        <div class="battle-vote-section">
          <div class="battle-vote-section__title">
            ${isEnded
              ? (winnerPartyInfo ? `🏆 논쟁 승리: ${winnerPartyInfo.emoji} ${escHtml(winnerPartyInfo.name)}` : '⚔️ 논쟁 결과')
              : (userVote ? `✅ 투표 완료 · 총 ${fmtNum(totalVotes)}명` : `⚔️ 어느 정당의 입장이 맞다고 생각하세요? (+5P)`)}
          </div>

          <div class="battle-party-cards" id="party-cards">
            ${partyCardsHTML}
          </div>

          ${userVote ? `<div class="battle-power-hint">⚡ 투표 완료 · 정치력 +5P 획득!</div>` : ''}
          ${userVote ? `
            <div class="battle-next-actions">
              <button class="battle-next-btn battle-next-btn--primary" id="btn-next-home" type="button">📋 오늘 미션 이어서 완료하기</button>
              <button class="battle-next-btn" id="btn-next-republic" type="button">🏛️ 공화국 현황 보기</button>
            </div>` : ''}
          ${votedOrEnded ? `<button class="battle-share-btn" id="btn-share-battle" type="button">📤 결과 공유하기</button>` : ''}
          ${!auth.currentUser && !isEnded ? `
            <div class="battle-login-hint">
              <a href="#/login" class="btn btn--outline" style="width:100%">로그인하고 투표하기</a>
            </div>` : ''}
        </div>

        ${isEnded && aftermath ? renderAftermath(aftermath, winningParty, partyInfo) : ''}

        ${renderBestComment(recentComments)}

        <!-- 토론 댓글 -->
        <div class="battle-discuss">
          <div class="battle-discuss__title">💬 토론 참여하기 <span class="battle-discuss__reward">첫 의견 +10P</span></div>
          ${auth.currentUser ? `
            <div class="battle-discuss__form">
              <textarea class="battle-discuss__input" id="discuss-input" placeholder="이 논쟁에 대한 당신의 한마디..." rows="2" maxlength="300"></textarea>
              <button class="btn btn--primary btn--sm" id="btn-discuss-submit" style="margin-top:8px;width:100%">의견 남기기</button>
            </div>` : `
            <div style="margin-bottom:12px">
              <a href="#/login" class="btn btn--outline btn--sm" style="width:100%">로그인하고 토론 참여하기</a>
            </div>`}
          <div class="battle-comment-list" id="comment-list">
            ${renderComments(recentComments)}
          </div>
        </div>

        <button class="btn btn--ghost btn--sm" id="btn-history" style="margin-top:8px;width:100%">🏛️ 논쟁 기록 보기 →</button>
      </div>`;

    el.querySelector('#btn-history')?.addEventListener('click', () => navigate('/king-history'));
    el.querySelector('#btn-next-home')?.addEventListener('click', () => navigate('/'));
    el.querySelector('#btn-next-republic')?.addEventListener('click', () => navigate('/republic'));

    if (!votedOrEnded && auth.currentUser) {
      el.querySelectorAll('.battle-party-vote-btn').forEach(btn => {
        btn.addEventListener('click', () => handleVote(btn.dataset.partyId, data, el));
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

    el.querySelector('#btn-share-battle')?.addEventListener('click', () =>
      shareBattle(topic, {
        myParty: userVote && partyInfo[userVote] ? `${partyInfo[userVote].emoji} ${partyInfo[userVote].name}` : null,
        winnerName: isEnded && winnerPartyInfo ? `${winnerPartyInfo.emoji} ${winnerPartyInfo.name}` : null,
      }));

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
        <div class="empty-state__title">정당 대항전을 불러오지 못했어요</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-retry">다시 시도</button>
      </div>`;
    el.querySelector('#btn-retry')?.addEventListener('click', renderBattle);
  }
}

// 배틀 결과 공유 — 유입 루프. navigator.share → 카카오 SDK → 클립보드 폴백
async function shareBattle(topic, opts = {}) {
  const { myParty = null, winnerName = null } = opts;
  const url = 'https://sosoking.co.kr/#/battle';
  const title = '소소킹 · 오늘의 정치 배틀';
  const text = winnerName
    ? `🏆 오늘의 정당 대항전 승리: ${winnerName}\n📰 쟁점 "${topic || '정치 배틀'}"\n너의 선택은 달랐을까? 👉 ${url}`
    : myParty
      ? `🗳️ 오늘의 쟁점 "${topic || '정치 배틀'}"\n나는 ${myParty}에 한 표! 너의 선택은?\n👉 ${url}`
      : `🗳️ 오늘의 쟁점 "${topic || '정치 배틀'}" — 세 정당의 격돌!\n너의 한 표를 던져봐 👉 ${url}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  try {
    const K = window.Kakao;
    if (K?.Share?.sendDefault && K.isInitialized()) {
      K.Share.sendDefault({
        objectType: 'feed',
        content: { title: topic || title, description: '소소킹 정치 배틀에 참여해보세요!', link: { mobileWebUrl: url, webUrl: url } },
        buttons: [{ title: '배틀 참여하기', link: { mobileWebUrl: url, webUrl: url } }],
      });
      return;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast.success('공유 문구를 복사했어요! 친구에게 붙여넣기 하세요 📤');
}

async function handleVote(partyId, prevData, el) {
  if (!auth.currentUser) { navigate('/login'); return; }

  const btns = el.querySelectorAll('.battle-party-vote-btn');
  btns.forEach(b => { b.disabled = true; });

  try {
    const voteForParty = httpsCallable(functions, 'voteForParty');
    const { data: res } = await voteForParty({ partyId });

    const partyInfo = prevData.partyInfo || {};
    // 서버가 돌려준 실제 집계 우선, 없으면 낙관적 +1
    const newVotes = res?.votes ? { ...res.votes } : (() => {
      const v = { ...prevData.votes }; v[partyId] = (v[partyId] || 0) + 1; return v;
    })();
    const newTotal = res?.totalVotes != null
      ? res.totalVotes
      : (prevData.totalVotes || 0) + 1;

    // 카드 업데이트
    const cardsEl = el.querySelector('#party-cards');
    if (cardsEl) {
      const partyOrder = ['national', 'youth', 'center'];
      cardsEl.innerHTML = partyOrder.map(pid => {
        const info = partyInfo[pid];
        const debate = (prevData.partyDebates || {})[pid];
        if (!info || !debate) return '';
        return renderPartyDebateCard(pid, info, debate, newVotes, newTotal, partyId, false, appState.partyId || null);
      }).join('');
    }

    const titleEl = el.querySelector('.battle-vote-section__title');
    if (titleEl) titleEl.textContent = `✅ 투표 완료 · 총 ${fmtNum(newTotal)}명`;

    const voteSection = el.querySelector('.battle-vote-section');

    // 내 한 표의 임팩트 — 판세 변화 연출
    if (voteSection && res?.kind && !voteSection.querySelector('.battle-vote-impact')) {
      const myName = partyInfo[partyId]?.name || '내 정당';
      const leadName = partyInfo[res.leader]?.name || '선두';
      const pct = newTotal > 0 ? Math.round((newVotes[partyId] / newTotal) * 100) : 0;
      const copy = {
        takeLead: { t: `🔥 역전 선두 등극!`, s: `당신의 한 표로 <b>${myName}</b>이(가) 1위로 올라섰어요!` },
        lead:     { t: `👑 ${myName} 선두 굳히기`, s: `당신의 한 표가 1위에 힘을 보탰어요 (${pct}%)` },
        closing:  { t: `⚔️ 추격 ${res.gapToLead}표 차!`, s: `${leadName}을(를) 거의 따라잡았어요. 친구를 불러 뒤집어요!` },
        joined:   { t: `🗳️ ${myName}에 한 표!`, s: `판세가 움직이기 시작했어요 (현재 ${pct}%)` },
      }[res.kind] || { t: `🗳️ 투표 완료`, s: `현재 ${pct}%` };
      const banner = document.createElement('div');
      banner.className = `battle-vote-impact battle-vote-impact--${res.kind}`;
      banner.style.setProperty('--impact-w', `${Math.max(8, Math.min(100, pct))}%`);
      banner.innerHTML = `
        <div class="battle-vote-impact__title">${copy.t}</div>
        <div class="battle-vote-impact__sub">${copy.s}</div>
        <div class="battle-vote-impact__bar"><i></i></div>`;
      voteSection.appendChild(banner);
      if (res.kind === 'takeLead') confettiBurst(voteSection);
    }

    if (voteSection && !voteSection.querySelector('.battle-power-hint')) {
      const hint = document.createElement('div');
      hint.className = 'battle-power-hint';
      hint.textContent = '⚡ 투표 완료 · 정치력 +5P 획득!';
      voteSection.appendChild(hint);

      const nextActions = document.createElement('div');
      nextActions.className = 'battle-next-actions';
      nextActions.innerHTML = `
        <button class="battle-next-btn battle-next-btn--share" id="btn-share-battle" type="button">📤 결과 공유하고 친구 부르기</button>
        <button class="battle-next-btn battle-next-btn--primary" id="btn-next-home2" type="button">📋 오늘 미션 이어서 완료하기</button>
        <button class="battle-next-btn" id="btn-next-republic2" type="button">🏛️ 공화국 현황 보기</button>`;
      voteSection.appendChild(nextActions);
      voteSection.querySelector('#btn-share-battle')?.addEventListener('click', () =>
        shareBattle(prevData.topic, {
          myParty: partyInfo[partyId] ? `${partyInfo[partyId].emoji} ${partyInfo[partyId].name}` : null,
        }));
      voteSection.querySelector('#btn-next-home2')?.addEventListener('click', () => navigate('/'));
      voteSection.querySelector('#btn-next-republic2')?.addEventListener('click', () => navigate('/republic'));
    }

    showPointPopup(5);
    appState.points = (appState.points || 0) + 5;
    checkRankUp(auth.currentUser?.uid, appState.points);

  } catch (err) {
    btns.forEach(b => { b.disabled = false; });
    if (err.code === 'already-exists') {
      toast.error('오늘은 이미 투표했어요');
    } else {
      toast.error('투표 중 오류가 발생했어요');
      console.error('[battle] vote error', err);
    }
  }
}

async function handleComment(el) {
  if (!auth.currentUser) { navigate('/login'); return; }
  const input = el.querySelector('#discuss-input');
  const text = input?.value?.trim() || '';
  if (text.length < 2) { toast.error('댓글은 2자 이상 입력해주세요'); return; }

  const btn = el.querySelector('#btn-discuss-submit');
  if (btn) btn.disabled = true;

  try {
    const addBattleComment = httpsCallable(functions, 'addBattleComment');
    const { data } = await addBattleComment({ text });

    if (input) input.value = '';

    const listEl = el.querySelector('#comment-list');
    if (listEl) {
      const rank = getPoliticalRank(appState.points || 0);
      const partyBadge = appState.partyId ? renderPartyBadge(appState.partyId) : '';
      const reactBtns = BATTLE_REACTIONS.map(r =>
        `<button class="battle-comment-react" data-comment-id="${escHtml(data.id)}" data-reaction="${r.key}" title="${r.title}" type="button">${r.label}</button>`
      ).join('');
      const newItem = document.createElement('div');
      newItem.className = 'battle-comment';
      newItem.dataset.commentId = data.id;
      newItem.innerHTML = `
        <div class="battle-comment__head">
          <span class="battle-comment__author">${partyBadge}<span class="comment-rank-emoji">${escHtml(rank.emoji)}</span>${escHtml(appState.nickname || '나')}</span>
          <span class="battle-comment__time">방금</span>
        </div>
        <div class="battle-comment__text">${escHtml(text)}</div>
        <div class="battle-comment__reactions">${reactBtns}</div>`;
      listEl.insertBefore(newItem, listEl.firstChild);

      const emptyEl = listEl.querySelector('.battle-comment-empty');
      if (emptyEl) emptyEl.remove();
    }

    if (data.pointsAwarded > 0) {
      showPointPopup(data.pointsAwarded);
      appState.points = (appState.points || 0) + data.pointsAwarded;
      checkRankUp(auth.currentUser?.uid, appState.points);
    } else {
      toast.success('의견을 남겼어요!');
    }
  } catch (err) {
    toast.error('댓글 작성 중 오류가 발생했어요');
    console.error('[battle] comment error', err);
  } finally {
    if (btn) btn.disabled = false;
  }
}
