/* home.js */
import { auth, db, functions } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchHotPosts, fetchTodayBest } from '../services/feed-service.js';
import {
  collection, collectionGroup, query, orderBy, limit, getDocs, where,
  doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { getPoliticalRank } from '../utils/political-rank.js';
import { showPointPopup } from '../utils/point-popup.js';
import { checkRankUp } from '../utils/rank-up.js';
import { renderPartyBadge } from '../utils/party-badge.js';
import { toast } from '../components/toast.js';

const TYPE_LABEL = {
  ai_judge:     '⚖️ 판결소',
  ai_translate: '✨ 창작소',
  ai_naming:    '✨ 창작소',
};

const QUICK_ACTIONS = [
  { path: '/battle',   emoji: '🗳️', name: '정치배틀', desc: '오늘의 정쟁 투표' },
  { path: '/parties',  emoji: '🏛️', name: '정당',     desc: '입당·정치력' },
  { path: '/election', emoji: '👑', name: '대선',     desc: '대통령 선출' },
  { path: '/ranking',  emoji: '🏆', name: '랭킹',     desc: '출세 순위' },
];

function getKstDateString(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}


async function checkStreak(uid) {
  try {
    const today     = getKstDateString();
    const yesterday = getKstDateString(new Date(Date.now() - 86400000));
    const userRef   = doc(db, 'users', uid);
    const snap      = await getDoc(userRef);
    if (!snap.exists()) return;
    const { lastVisit = '', streak = 0 } = snap.data();
    if (lastVisit === today) {
      appState.streak = streak;
      return;
    }
    const newStreak = lastVisit === yesterday ? streak + 1 : 1;
    const maxStreak = Math.max(newStreak, Number(snap.data().maxStreak || 0));
    await updateDoc(userRef, { lastVisit: today, streak: newStreak, maxStreak });
    appState.streak = newStreak;
    httpsCallable(functions, 'claimDailyBonus')({}).then(res => showPointPopup(res?.data?.points || 20)).catch(() => {});
  } catch { /* non-critical */ }
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

function commentScore(comment) {
  const r = comment.reactions || {};
  return Number(r.funny || 0) * 3 + Number(r.fire || 0) * 2 + Number(r.like || 0) + Number(comment.likes || 0);
}

function moduleLabel(post) {
  return TYPE_LABEL[post.type] || TYPE_LABEL[post.feedType] || TYPE_LABEL[post.subtype] || '';
}

async function fetchPopularComments(n = 6) {
  try {
    const q = query(collectionGroup(db, 'comments'), orderBy('createdAt', 'desc'), limit(80));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => {
        const data = d.data();
        return { id: d.id, postId: d.ref.parent?.parent?.id || data.postId || '', ...data, _score: commentScore(data) };
      })
      .filter(c => c.text && c.postId && !c.hidden)
      .sort((a, b) => b._score !== a._score ? b._score - a._score : (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, n);
  } catch { return []; }
}

async function fetchTodayBattle() {
  try {
    const getBattleStatus = httpsCallable(functions, 'getBattleStatus');
    const { data } = await getBattleStatus();
    return data;
  } catch { return null; }
}

async function fetchPresident() {
  try {
    const getPresident = httpsCallable(functions, 'getPresident');
    const { data } = await getPresident();
    return data.president || null;
  } catch { return null; }
}

async function fetchDailyNews() {
  try {
    const getDailyNews = httpsCallable(functions, 'getDailyNews');
    const { data } = await getDailyNews();
    return (data && data.headline) ? data : null;
  } catch { return null; }
}

async function fetchMyStatus() {
  if (!auth.currentUser) return { loggedIn: false };
  try {
    const getMyStatus = httpsCallable(functions, 'getMyStatus');
    const { data } = await getMyStatus();
    return data || { loggedIn: false };
  } catch { return { loggedIn: false }; }
}

function generateFallbackNews(battleData, presidentData) {
  const d = new Date();
  const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  if (presidentData) {
    const p = presidentData;
    return {
      headline: `대통령 ${escHtml(p.candidateName)} "${p.decree ? escHtml(p.decree.slice(0, 30)) : '국민과 함께 나아가겠다'}"`,
      body: `현직 대통령 ${escHtml(p.candidateName)}(${escHtml(p.partyName)})이 ${day}요일 국정 운영 방침을 밝혔다. 소소공화국 시민들의 이목이 집중되고 있다.`,
    };
  }
  if (battleData && battleData.currentKing) {
    const k = battleData.currentKing;
    return {
      headline: `"${escHtml(k.name)}" 연일 집권 — 소소공화국 정치판 뒤흔들어`,
      body: `오늘의 정치 배틀 결과 ${escHtml(k.name)}(${escHtml(k.party || k.title)})이 집권 대표 지위를 유지하고 있다. ${battleData.totalVotes || 0}명이 참여한 이번 배틀은 공화국 역사에 기록될 전망이다.`,
    };
  }
  return {
    headline: `소소공화국 ${d.getMonth() + 1}월 ${d.getDate()}일 — 오늘의 정치는 당신이 만듭니다`,
    body: `정치배틀 투표, 대선 지지, 정당 활동으로 정치력을 쌓으세요. 당내 1위는 당대표가 되어 대통령 후보로 출마합니다.`,
  };
}

function renderNewsCard(news) {
  if (!news) return '';
  const d = new Date();
  const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `
    <div class="home-news-card" data-path="/news">
      <div class="home-news-card__header">
        <span class="home-news-card__masthead">📰 소소신문</span>
        <span class="home-news-card__date">${dateStr}자</span>
      </div>
      <div class="home-news-card__headline">${escHtml(news.headline)}</div>
      ${news.body ? `<div class="home-news-card__body">${escHtml(news.body)}</div>` : ''}
    </div>`;
}

function renderPresidentAnnouncement(p) {
  if (!p || !p.periodId) return '';
  try {
    const lastSeen = localStorage.getItem('sosoking_last_prez_period');
    if (lastSeen === p.periodId) return '';
    localStorage.setItem('sosoking_last_prez_period', p.periodId);
  } catch { return ''; }
  return `
    <div class="home-new-prez-announce" id="home-new-prez-announce">
      <div class="home-new-prez-announce__confetti" aria-hidden="true">🎊🎉🎊🎉🎊</div>
      <div class="home-new-prez-announce__title">🏛️ 신임 대통령 취임!</div>
      <div class="home-new-prez-announce__name">${p.emoji} ${escHtml(p.candidateName)}</div>
      <div class="home-new-prez-announce__party">${escHtml(p.partyName)}${p.isAI ? ' · AI 정치인' : ' · 당대표'} 당선</div>
      <button class="home-new-prez-announce__close" type="button">확인 ✓</button>
    </div>`;
}

function renderPresidentCard(p) {
  if (!p) return '';
  const approveCount = Number(p.decreeApprove || 0);
  const disapproveCount = Number(p.decreeDisapprove || 0);
  const totalRatings = approveCount + disapproveCount;
  const approvePct = totalRatings > 0 ? Math.round((approveCount / totalRatings) * 100) : null;

  const approvalHTML = p.decree && totalRatings > 0
    ? `<div class="home-prez-card__approval">
        <div class="home-prez-card__approval-bar">
          <div class="home-prez-card__approval-fill" style="width:${approvePct}%"></div>
        </div>
        <span class="home-prez-card__approval-label">지지 ${approvePct}% · ${totalRatings}명 평가</span>
      </div>`
    : '';

  const rateHTML = p.decree
    ? `<div class="home-prez-card__rate-row" id="prez-rate-row">
        <span class="home-prez-card__rate-label">포고령 평가</span>
        <button class="home-prez-rate-btn${p.myDecreeRating === true ? ' home-prez-rate-btn--active' : ''}" data-approve="true" id="prez-rate-approve">👍 찬성</button>
        <button class="home-prez-rate-btn${p.myDecreeRating === false ? ' home-prez-rate-btn--active' : ''}" data-approve="false" id="prez-rate-disapprove">👎 반대</button>
      </div>`
    : '';

  return `
    <div class="home-prez-card" style="--party-color:${p.color}">
      <div class="home-prez-card__top" data-path="/election" style="cursor:pointer">
        <span class="home-prez-card__label">👑 현직 대통령</span>
        <span class="home-prez-card__party">${p.emoji} ${escHtml(p.partyName)}</span>
      </div>
      <div class="home-prez-card__name" data-path="/election" style="cursor:pointer">${escHtml(p.candidateName)}</div>
      ${p.decree ? `<div class="home-prez-card__decree">"${escHtml(p.decree)}"</div>` : ''}
      ${approvalHTML}
      ${rateHTML}
    </div>`;

function renderBattleCard(battle) {
  if (!battle) return '';
  const king = battle.currentKing;
  const kingText = king
    ? `${king.emoji} ${king.name}${king.streak > 1 ? ` · 🔥${king.streak}일 연속` : ''}`
    : '오늘의 당선자 미정';
  const previewTurns = (battle.turns || []).slice(0, 2);
  const totalVotes = battle.totalVotes || 0;
  const isEnded = battle.status === 'ended';
  const hasVoted = !!battle.userVote;

  const chars = battle.chars || [];
  const votes = battle.votes || {};
  const miniVoteBars = chars.length > 0 && (hasVoted || isEnded || totalVotes > 0) ? `
    <div class="home-battle-mini-bars">
      ${chars.map(c => {
        const count = votes[c.id] || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isVoted = battle.userVote === c.id;
        return `<div class="home-battle-mini-bar${isVoted ? ' home-battle-mini-bar--voted' : ''}">
          <span class="home-battle-mini-bar__emoji">${c.emoji}</span>
          <div class="home-battle-mini-bar__track">
            <div class="home-battle-mini-bar__fill" style="width:${pct}%;background:${c.color}"></div>
          </div>
          <span class="home-battle-mini-bar__pct">${pct}%</span>
        </div>`;
      }).join('')}
    </div>` : '';

  return `
    <div class="home-battle-card" data-path="/battle">
      <div class="home-battle-card__head">
        <span class="home-battle-card__king">🏛️ ${escHtml(kingText)}</span>
        <span class="home-battle-card__status${isEnded ? ' home-battle-card__status--ended' : ''}">${isEnded ? '종료' : battle.exists ? (totalVotes > 0 ? `${totalVotes}표` : '🔴 투표중') : '준비중'}</span>
      </div>
      <div class="home-battle-card__topic">${escHtml(battle.topic || '오늘의 정치 스캔들')}</div>
      <div class="home-battle-card__preview">
        ${previewTurns.map(t =>
          `<div class="home-battle-card__line">${t.emoji} <b>${escHtml(t.charName || '')}</b> ${escHtml((t.text || '').slice(0, 35))}…</div>`
        ).join('')}
      </div>
      ${miniVoteBars}
      <div class="home-battle-card__cta">${hasVoted ? '✅ 투표 완료 · 자세히 보기 →' : '토론 보고 한 표 던지기 →'}</div>
    </div>`;
}

// 비로그인 게스트용 히어로
function renderGuestHero() {
  return `
    <section class="home-landing-hero page-enter">
      <div class="home-landing-hero__bg home-landing-hero__bg--one"></div>
      <div class="home-landing-hero__bg home-landing-hero__bg--two"></div>
      <div class="home-landing-hero__content">
        <div class="home-landing-hero__badge">
          <span>🏛️</span>
          <b>소소공화국</b>
          <small>정치 게임</small>
        </div>
        <h1>무명 시민에서<br>거물 정치인까지 👑</h1>
        <p>AI 정치인들의 매일 정쟁에 참여해 정치력을 쌓고,<br>당대표로 선출된 뒤 대통령에 도전하세요</p>
        <div class="home-landing-hero__actions">
          <button class="home-landing-hero__primary" data-path="/signup">정치 인생 시작하기 →</button>
          <button class="home-landing-hero__secondary" data-path="/battle">오늘의 배틀 구경 →</button>
        </div>
        <div class="home-landing-hero__chips">
          <span>🗳️ 매일 배틀 투표</span>
          <span>🏛️ 정당 입당</span>
          <span>👑 대통령 선거</span>
          <span>📰 AI 신문</span>
        </div>
      </div>
    </section>`;
}

// 로그인 유저용 정치 신분증 카드 (출세 사다리 진행)
function renderRankCard(status, isRulingParty = false) {
  const nick = appState.nickname || auth.currentUser?.displayName || '시민';
  const rank = getPoliticalRank(status.power || 0);
  const streak = appState.streak || 0;

  const rulingBadge = isRulingParty
    ? ` <span class="home-id-card__ruling-badge">🔑 집권당</span>`
    : '';

  const partyLine = status.partyId
    ? `<span class="home-id-card__party${status.isLeader ? ' home-id-card__party--leader' : ''}" style="--party-color:${status.partyColor}">${status.partyEmoji} ${escHtml(status.partyName)}${status.isLeader ? ' 👑 당대표' : (status.partyRank ? ` · 당내 ${status.partyRank}위` : '')}${rulingBadge}</span>`
    : `<button class="home-id-card__join" data-path="/parties" type="button">+ 입당하고 정치력 쌓기</button>`;

  const nextLine = rank.isMax
    ? `<span class="home-id-card__next">최고 등급 달성! 🎉</span>`
    : `<span class="home-id-card__next">${rank.next.emoji} ${rank.next.title}까지 <b>${fmtNum(rank.remain)}P</b></span>`;

  const leaderChaseHTML = status.pointsToLeader && status.pointsToLeader <= 200
    ? `<div class="home-id-card__chase">🎯 당대표까지 <b>${fmtNum(status.pointsToLeader)}P</b> — 활동하면 따라잡을 수 있어요!</div>`
    : '';

  // 즉시 계산 가능한 마이크로 업적
  const badges = [
    status.partyId         && { icon: '🏛️', label: '당원' },
    status.isLeader        && { icon: '👑', label: '당대표' },
    isRulingParty          && { icon: '🔑', label: '집권당' },
    status.votedElection   && { icon: '🗳️', label: '선거 투표' },
    streak >= 7            && { icon: '🔥', label: `${streak}일 연속` },
    streak >= 3 && streak < 7 && { icon: '🔥', label: `${streak}일 연속` },
    (status.power || 0) >= 10000 && { icon: '👔', label: '거물 정치인' },
    (status.power || 0) >= 3000  && (status.power || 0) < 10000 && { icon: '⚖️', label: '국회의원' },
  ].filter(Boolean).slice(0, 5);

  const badgesHTML = badges.length
    ? `<div class="home-id-card__badges">${badges.map(b => `<span class="home-id-card__badge-chip">${b.icon} ${b.label}</span>`).join('')}</div>`
    : '';

  return `
    <section class="home-id-card page-enter" style="--rank-c:${rank.color}">
      <div class="home-id-card__top">
        <div class="home-id-card__emoji">${rank.emoji}</div>
        <div class="home-id-card__info">
          <div class="home-id-card__title">${escHtml(nick)}</div>
          <div class="home-id-card__rank">${rank.title} · ${fmtNum(rank.power)}P${streak >= 2 ? ` · 🔥${streak}일` : ''}</div>
        </div>
        <button class="home-id-card__more" data-path="/ranking" type="button">랭킹 →</button>
      </div>
      <div class="home-id-card__progress">
        <div class="home-id-card__bar"><div class="home-id-card__fill" style="width:${rank.progress}%"></div></div>
        ${nextLine}
      </div>
      <div class="home-id-card__party-row">${partyLine}</div>
      ${badgesHTML}
      ${leaderChaseHTML}
    </section>`;
}

// 당대표 전용 특전 카드
function renderLeaderCard(status) {
  if (!status.isLeader) return '';
  return `
    <section class="home-leader-card" data-path="/election">
      <div class="home-leader-card__top">
        <span class="home-leader-card__crown">👑</span>
        <div class="home-leader-card__info">
          <div class="home-leader-card__title">${status.partyEmoji} ${escHtml(status.partyName)} 당대표</div>
          <div class="home-leader-card__sub">대선 후보로 자동 등록되었습니다</div>
        </div>
      </div>
      <div class="home-leader-card__perks">
        <div class="home-leader-card__perk">🗳️ 이번 주 대통령 선거 출마 중</div>
        <div class="home-leader-card__perk">⚡ 리더 보너스 — 매일 출석 보너스 +30P (일반 +20P)</div>
        <div class="home-leader-card__perk">📢 당원들이 당신의 활동을 주목합니다</div>
      </div>
      <div class="home-leader-card__cta">대선 현황 확인 →</div>
    </section>`;
}

// 오늘의 정치 일정 (일일 미션 체크리스트)
function renderMissions(status, battleData, isRulingParty = false) {
  const votedBattle = !!(battleData && battleData.userVote);
  const votedElection = !!status.votedElection;
  const attended = (appState.streak || 0) >= 1;

  const dailyReward = status.isLeader ? '+30P 👑' : '+20P';

  // 선거 마감 D-day 계산
  let elecLabel = '대선 투표';
  if (status.electionEndKey && !votedElection) {
    const end = new Date(`${status.electionEndKey}T23:59:59+09:00`).getTime();
    const ms = end - Date.now();
    if (ms > 0) {
      const days = Math.ceil(ms / 86400000);
      if (days <= 1) elecLabel = '대선 투표 · 오늘 마감!';
      else elecLabel = `대선 투표 · D-${days}`;
    }
  }

  const missions = [
    { done: attended,       label: '오늘 출석',     path: '/',         cta: '완료',       reward: dailyReward, icon: '📅' },
    { done: votedBattle,    label: '정치배틀 투표', path: '/battle',   cta: '투표하기',   reward: '+5P',  icon: '🗳️' },
    { done: votedElection,  label: elecLabel,       path: '/election', cta: '투표하기',   reward: '+5P',  icon: '👑' },
    ...(isRulingParty ? [{ done: true, label: '집권당 일일 특전', path: '/', cta: '수령 완료', reward: '+3P 🔑', icon: '🏛️' }] : []),
  ];
  const doneCount = missions.filter(m => m.done).length;
  const allDone = doneCount === missions.length;

  return `
    <section class="home-missions">
      <div class="home-missions__head">
        <span class="home-missions__title">📋 오늘의 정치 일정</span>
        <span class="home-missions__count${allDone ? ' home-missions__count--all' : ''}">${doneCount}/${missions.length} 완료${allDone ? ' 🎉' : ''}</span>
      </div>
      <div class="home-missions__list">
        ${missions.map(m => `
          <button class="home-mission${m.done ? ' home-mission--done' : ''}" data-path="${m.path}" type="button">
            <span class="home-mission__icon">${m.icon}</span>
            <span class="home-mission__label">${m.label}</span>
            <span class="home-mission__reward">${m.reward}</span>
            <span class="home-mission__cta">${m.done ? '완료 ✓' : m.cta}</span>
          </button>`).join('')}
      </div>
      ${allDone ? `
      <div class="home-missions__bonus">
        <span class="home-missions__bonus-title">추가 정치력 획득 방법</span>
        <div class="home-missions__bonus-list">
          <button class="home-missions__bonus-item" data-path="/battle" type="button">💬 배틀 토론 <em>+20P</em></button>
          <button class="home-missions__bonus-item" data-path="/feed" type="button">✍️ 글·댓글 <em>+10~20P</em></button>
          <button class="home-missions__bonus-item" data-path="/parties" type="button">🏛️ 정당 랭킹 <em>확인</em></button>
        </div>
      </div>` : ''}
    </section>`;
}

// 빠른 이동 (정치 시스템 4종)
function renderQuickActions() {
  return `
    <div class="home-aiking-grid">
      ${QUICK_ACTIONS.map(k => `
        <button class="home-aiking-card" data-path="${k.path}" type="button">
          <span class="home-aiking-card__emoji">${k.emoji}</span>
          <span class="home-aiking-card__name">${k.name}</span>
          <span class="home-aiking-card__desc">${k.desc}</span>
        </button>`).join('')}
    </div>`;
}

function renderPopularPost(post, index) {
  const label = moduleLabel(post);
  return `
    <div class="home-rank-item" data-id="${post.id}">
      <div class="home-rank-item__num home-rank-item__num--${index < 3 ? index + 1 : 'rest'}">${index + 1}</div>
      <div class="home-rank-item__body">
        <div class="home-rank-item__type">${label}</div>
        <div class="home-rank-item__title">${escHtml(post.title || '제목 없음')}</div>
      </div>
      <div class="home-rank-item__stats">
        ${post.reactions?.total ? `<span>❤️ ${fmtNum(post.reactions.total)}</span>` : ''}
        ${post.commentCount    ? `<span>💬 ${fmtNum(post.commentCount)}</span>`    : ''}
      </div>
    </div>`;
}

function renderTodayBest(post) {
  if (!post) return '';
  return `
    <div class="home-today-best" data-id="${post.id}">
      <div class="home-today-best__label">⭐ 오늘의 베스트</div>
      <div class="home-today-best__title">${escHtml(post.title || '제목 없음')}</div>
      <div class="home-today-best__meta">
        <span class="home-today-best__room">${moduleLabel(post)}</span>
        ${post.reactions?.total ? `<span>❤️ ${fmtNum(post.reactions.total)}</span>` : ''}
        ${post.commentCount  ? `<span>💬 ${fmtNum(post.commentCount)}</span>` : ''}
      </div>
    </div>`;
}

function renderPopularComment(comment, index) {
  const timeStr = formatTime(comment.createdAt?.toDate?.() || comment.createdAt);
  const score = comment._score || 0;
  const rankEmoji = comment.rankEmoji || '';
  const partyBadge = comment.partyId ? renderPartyBadge(comment.partyId) : '';
  return `
    <button class="home-compact-feed-item" type="button" data-id="${comment.postId}">
      <span class="home-compact-feed-item__badge">💬 ${index + 1}</span>
      <span class="home-compact-feed-item__title">${escHtml(comment.text || '').slice(0, 100)}</span>
      <span class="home-compact-feed-item__meta">${partyBadge}${rankEmoji ? `<span class="comment-rank-emoji">${escHtml(rankEmoji)}</span>` : ''}${escHtml(comment.authorName || '익명')} · ${timeStr}${score ? ` · 반응 ${fmtNum(score)}` : ''}</span>
    </button>`;
}

export async function renderHome() {
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `<div class="home-dash page-enter home-dash--v2">
    <div class="skeleton" style="height:280px;border-radius:18px"></div>
    <div class="skeleton" style="height:200px;border-radius:18px;margin-top:16px"></div>
  </div>`;

  try {
    setMeta('소소킹 · 가상 정치 공화국');
    const user = auth.currentUser;
    if (user) {
      httpsCallable(functions, 'syncPartyMemberPower')({}).catch(() => {});
    }

    const [hotPosts, popularComments, todayBest, battleData, presidentData, newsData, myStatus] = await Promise.all([
      fetchHotPosts(8),
      fetchPopularComments(6),
      fetchTodayBest(),
      fetchTodayBattle(),
      fetchPresident(),
      fetchDailyNews(),
      fetchMyStatus(),
      user ? checkStreak(user.uid) : Promise.resolve(),
    ]);

    if (user && myStatus?.loggedIn) checkRankUp(user.uid, myStatus.power);

    const isRulingParty = !!(myStatus?.loggedIn && myStatus.partyId && presidentData?.partyId && presidentData.partyId === myStatus.partyId);

    // 로그인 유저: 정치 신분증 + 당대표 특전 + 오늘의 정치 일정 / 게스트: 가입 유도 히어로
    const headerHTML = (myStatus && myStatus.loggedIn)
      ? `${renderRankCard(myStatus, isRulingParty)}${renderLeaderCard(myStatus)}${renderMissions(myStatus, battleData, isRulingParty)}${renderQuickActions()}`
      : `${renderGuestHero()}${renderQuickActions()}`;

    const newsHTML = renderNewsCard(newsData || generateFallbackNews(battleData, presidentData));
    const prezHTML = renderPresidentCard(presidentData);
    const battleHTML = renderBattleCard(battleData);
    const newPrezHTML = renderPresidentAnnouncement(presidentData);

    const bestHTML = todayBest ? `
      <div class="home-section-header" style="margin-bottom:8px">
        <span class="home-section-title">⭐ 오늘의 베스트</span>
      </div>
      ${renderTodayBest(todayBest)}` : '';

    const hotHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🔥 인기 모음</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-hot">더 보기</button>
        </div>
        <div class="home-rank-list">
          ${hotPosts.length
            ? hotPosts.map(renderPopularPost).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 없어요. 첫 번째가 되어보세요!</div></div>'}
        </div>
      </div>`;

    const commentsHTML = popularComments.length ? `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">💬 따끈한 댓글</span>
        </div>
        <div class="home-compact-feed-list">
          ${popularComments.map(renderPopularComment).join('')}
        </div>
      </div>` : '';

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2"><div id="home-notif-slot"></div>${newPrezHTML}${headerHTML}<div id="home-campaign-slot"></div>${battleHTML}${newsHTML}${prezHTML}<div id="home-crisis-slot"></div>${bestHTML}${hotHTML}${commentsHTML}<div id="home-party-power-slot"></div><div id="home-election-race-slot"></div><div id="home-party-activity-slot"></div></div>`;

    el.querySelector('.home-new-prez-announce__close')?.addEventListener('click', () => {
      el.querySelector('#home-new-prez-announce')?.remove();
    });

    el.querySelector('#hbtn-more-hot')?.addEventListener('click', () => navigate('/feed'));
    el.querySelectorAll('[data-path]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.path));
    });
    el.querySelectorAll('[data-id]').forEach(item =>
      item.addEventListener('click', () => navigate(`/detail/${item.dataset.id}`))
    );

    // 포고령 찬반 버튼
    el.querySelectorAll('.home-prez-rate-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!auth.currentUser) { navigate('/login'); return; }
        const approve = btn.dataset.approve === 'true';
        btn.disabled = true;
        try {
          const { data: rData } = await httpsCallable(functions, 'ratePresidentDecree')({ approve });
          // 버튼 상태 업데이트
          el.querySelectorAll('.home-prez-rate-btn').forEach(b => {
            b.classList.toggle('home-prez-rate-btn--active', b.dataset.approve === String(rData.approve));
            b.disabled = false;
          });
          // 지지율 표시 업데이트
          const total = rData.approveCount + rData.disapproveCount;
          const pct = total > 0 ? Math.round((rData.approveCount / total) * 100) : 0;
          let approvalEl = el.querySelector('.home-prez-card__approval');
          if (!approvalEl && total > 0) {
            const decreeEl = el.querySelector('.home-prez-card__decree');
            if (decreeEl) {
              approvalEl = document.createElement('div');
              approvalEl.className = 'home-prez-card__approval';
              decreeEl.insertAdjacentElement('afterend', approvalEl);
            }
          }
          if (approvalEl) {
            approvalEl.innerHTML = `
              <div class="home-prez-card__approval-bar">
                <div class="home-prez-card__approval-fill" style="width:${pct}%"></div>
              </div>
              <span class="home-prez-card__approval-label">지지 ${pct}% · ${total}명 평가</span>`;
          }
          if (rData.firstRating) {
            showPointPopup(3);
          }
        } catch (e) {
          btn.disabled = false;
        }
      });
    });

    // 집권당 보너스 (fire-and-forget — 포인트 팝업 표시)
    if (isRulingParty && user) {
      httpsCallable(functions, 'claimRulingBonus')({})
        .then(({ data }) => { if (data.awarded) showPointPopup(3); })
        .catch(() => {});
    }

    // 유세 카드 + 세력도 + 대선 경쟁 + 위기 이벤트 + 정당 활동 피드 비동기 로드
    if (user) loadNotifications(user.uid, el.querySelector('#home-notif-slot'));
    if (user && myStatus?.loggedIn && myStatus.partyId) loadCampaignCard(el.querySelector('#home-campaign-slot'), myStatus);
    loadPartyPowerChart(el.querySelector('#home-party-power-slot'));
    loadElectionRace(el.querySelector('#home-election-race-slot'));
    loadWeeklyCrisis(el.querySelector('#home-crisis-slot'));
    loadHomePartyActivity(el.querySelector('#home-party-activity-slot'));
  } catch (err) {
    console.error('[home] renderHome error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">홈을 불러오지 못했어요</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-reload">다시 불러오기</button>
      </div>`;
    el.querySelector('#btn-reload')?.addEventListener('click', () => location.reload());
  }
}

function renderCampaignSlot(slot, status, count, MAX, COST, BOOST) {
  const canCampaign = count < MAX && (status.power || 0) >= COST;
  const pips = Array.from({ length: MAX }, (_, i) =>
    `<span class="home-campaign-pip${i < count ? ' home-campaign-pip--done' : ''}"></span>`
  ).join('');
  slot.innerHTML = `
    <div class="home-campaign-card">
      <div class="home-campaign-card__top">
        <span class="home-campaign-card__icon">🎤</span>
        <div class="home-campaign-card__info">
          <span class="home-campaign-card__title">유세 활동</span>
          <span class="home-campaign-card__sub">${status.partyEmoji} ${escHtml(status.partyName)} 정치력 부스트</span>
        </div>
        <div class="home-campaign-pips">${pips}</div>
      </div>
      <div class="home-campaign-card__body">
        <span class="home-campaign-card__desc">-${COST}P 소모 → 당 정치력 +${BOOST}</span>
        <button class="home-campaign-btn${!canCampaign ? ' home-campaign-btn--disabled' : ''}" id="home-campaign-btn" ${!canCampaign ? 'disabled' : ''}>
          ${count >= MAX ? '오늘 유세 완료 ✓' : (status.power || 0) < COST ? `포인트 부족 (${COST}P 필요)` : `유세하기 · -${COST}P`}
        </button>
      </div>
    </div>`;
  slot.querySelector('#home-campaign-btn')?.addEventListener('click', async () => {
    const btn = slot.querySelector('#home-campaign-btn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '유세 중...';
    try {
      const { data } = await httpsCallable(functions, 'campaignForParty')({});
      if (data?.ok) {
        status.power = Math.max(0, (status.power || 0) - data.cost);
        renderCampaignSlot(slot, status, data.campaignsToday, data.maxCampaigns, COST, BOOST);
        showPointPopup(data.boost);
        toast.success(`${status.partyEmoji} ${escHtml(status.partyName)} 정치력 +${data.boost}! 🎤`);
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = `유세하기 · -${COST}P`;
      toast.error(e?.message || '유세 실패. 다시 시도해주세요.');
    }
  });
}

async function loadCampaignCard(slot, status) {
  if (!slot || !status?.partyId || !auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const today = getKstDateString();
  const COST = 20;
  const BOOST = 15;
  const MAX = 3;
  try {
    const campSnap = await getDoc(doc(db, 'campaign_records', `${uid}_${today}`));
    const count = campSnap.exists() ? Number(campSnap.data().count || 0) : 0;
    renderCampaignSlot(slot, status, count, MAX, COST, BOOST);
  } catch { /* non-critical */ }
}

async function loadPartyPowerChart(slot) {
  if (!slot) return;
  try {
    const { PARTY_COLORS } = await import('../utils/party-badge.js');
    const snap = await getDocs(collection(db, 'parties'));
    const parties = snap.docs
      .map(d => {
        const meta = PARTY_COLORS[d.id];
        if (!meta) return null;
        return { id: d.id, ...meta, totalPower: Number(d.data().totalPower || 0), memberCount: Number(d.data().memberCount || 0) };
      })
      .filter(Boolean)
      .sort((a, b) => b.totalPower - a.totalPower);

    const total = parties.reduce((s, p) => s + p.totalPower, 0);
    if (!total) return;

    const bars = parties.map(p => {
      const pct = Math.round((p.totalPower / total) * 100);
      const width = Math.max(2, pct);
      return `
        <div class="home-power-row" style="--party-c:${p.color}">
          <span class="home-power-row__emoji">${p.emoji}</span>
          <span class="home-power-row__name">${escHtml(p.name)}</span>
          <div class="home-power-row__track">
            <div class="home-power-row__fill" style="width:${width}%"></div>
          </div>
          <span class="home-power-row__pct">${pct}%</span>
        </div>`;
    }).join('');

    let rivalryHTML = '';
    if (parties.length >= 2) {
      const gap = parties[0].totalPower - parties[1].totalPower;
      const gapPct = total > 0 ? Math.round((gap / total) * 100) : 100;
      if (gapPct <= 5) {
        rivalryHTML = `<div class="home-rivalry-badge home-rivalry-badge--tight">⚡ ${escHtml(parties[0].emoji)} ${escHtml(parties[0].name)} vs ${escHtml(parties[1].emoji)} ${escHtml(parties[1].name)} — 초박빙!</div>`;
      } else if (gapPct <= 12) {
        rivalryHTML = `<div class="home-rivalry-badge">🔥 ${escHtml(parties[0].emoji)} ${escHtml(parties[0].name)} vs ${escHtml(parties[1].emoji)} ${escHtml(parties[1].name)} — 라이벌 대결</div>`;
      }
    }

    slot.innerHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🗺️ 공화국 세력도</span>
          <button class="home-section-more home-section-more--button" data-path="/ranking">랭킹 →</button>
        </div>
        ${rivalryHTML}
        <div class="home-power-chart">${bars}</div>
      </div>`;
    slot.querySelectorAll('[data-path]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.path));
    });
  } catch { /* non-critical */ }
}

async function loadElectionRace(slot) {
  if (!slot) return;
  try {
    const call = httpsCallable(functions, 'getElection');
    const { data } = await call();
    const election = data && data.election;
    if (!election || election.status === 'closed') return;

    const cands = [...(election.candidates || [])].sort((a, b) => b.votes - a.votes || b.power - a.power);
    if (!cands.length) return;

    const total = election.totalVotes || 0;
    const topCands = cands.slice(0, 3);
    const leader = topCands[0];
    const end = new Date(`${election.endKey}T23:59:59+09:00`).getTime();
    const msLeft = end - Date.now();
    const daysLeft = Math.ceil(msLeft / 86400000);
    const ddayLabel = msLeft <= 0 ? '집계 중' : daysLeft <= 0 ? '⚡ D-DAY' : `D-${daysLeft}`;
    const urgent = msLeft > 0 && daysLeft <= 1;

    const barsHTML = topCands.map((c, i) => {
      const pct = total > 0 ? Math.round((c.votes / total) * 100) : 0;
      const medals = ['🥇', '🥈', '🥉'];
      return `
        <div class="home-race-row" style="--party-c:${c.color}">
          <span class="home-race-row__medal">${medals[i] || ''}</span>
          <span class="home-race-row__emoji">${c.emoji}</span>
          <div class="home-race-row__center">
            <span class="home-race-row__name">${escHtml(c.candidateName)}</span>
            <div class="home-race-bar">
              <div class="home-race-bar__fill" style="width:${Math.max(4, pct)}%"></div>
            </div>
          </div>
          <span class="home-race-row__pct">${total > 0 ? pct + '%' : '-'}</span>
        </div>`;
    }).join('');

    slot.innerHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🗳️ 이번 주 대선 경쟁</span>
          <button class="home-section-more home-section-more--button${urgent ? ' home-section-more--urgent' : ''}" data-path="/election">${ddayLabel} →</button>
        </div>
        <div class="home-race-card" data-path="/election">
          ${total > 0
            ? `<div class="home-race-leader">현재 선두: <b>${leader.emoji} ${escHtml(leader.candidateName)}</b> (${escHtml(leader.partyName)}) · ${fmtNum(total)}표 집계</div>`
            : `<div class="home-race-leader">아직 투표가 없어요 — 첫 번째로 투표해보세요!</div>`}
          <div class="home-race-rows">${barsHTML}</div>
        </div>
      </div>`;
    slot.querySelectorAll('[data-path]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.path));
    });
  } catch { /* non-critical */ }
}

function buildCrisisCardHTML(crisis, myVote, prevCrisis) {
  const total = (crisis.votesA || 0) + (crisis.votesB || 0);
  const pctA = total > 0 ? Math.round((crisis.votesA / total) * 100) : 50;
  const pctB = 100 - pctA;
  const voted = myVote != null;

  let prevCrisisHTML = '';
  if (prevCrisis && (prevCrisis.votesA + prevCrisis.votesB) > 0) {
    const pt = prevCrisis.votesA + prevCrisis.votesB;
    const ppA = Math.round((prevCrisis.votesA / pt) * 100);
    const winnerLabel = ppA >= 50 ? escHtml(prevCrisis.optionA) : escHtml(prevCrisis.optionB);
    const winPct = ppA >= 50 ? ppA : 100 - ppA;
    prevCrisisHTML = `
      <div class="home-prev-crisis">
        <span class="home-prev-crisis__label">📋 지난 주</span>
        <span class="home-prev-crisis__title">${escHtml(prevCrisis.title)}</span>
        <span class="home-prev-crisis__sep">→</span>
        <span class="home-prev-crisis__winner">${winnerLabel} ${winPct}%</span>
        ${prevCrisis.consequence ? `<span class="home-prev-crisis__consequence">${escHtml(prevCrisis.consequence)}</span>` : ''}
      </div>`;
  }

  const resultsHTML = (voted || total > 0) ? `
    <div class="home-crisis-results">
      <div class="home-crisis-opt-bar" style="--pct:${pctA}%;--clr:#2563eb">
        <span class="home-crisis-opt-label">🔵 ${escHtml(crisis.optionA)}</span>
        <span class="home-crisis-opt-pct">${pctA}%</span>
      </div>
      <div class="home-crisis-opt-bar" style="--pct:${pctB}%;--clr:#dc2626">
        <span class="home-crisis-opt-label">🔴 ${escHtml(crisis.optionB)}</span>
        <span class="home-crisis-opt-pct">${pctB}%</span>
      </div>
      <div class="home-crisis-votes">${total}명 참여 · 이번 주 시민 투표</div>
    </div>` : '';

  const btnsHTML = !voted ? `
    <div class="home-crisis-btns">
      <button class="home-crisis-btn home-crisis-btn--a" data-option="A">
        🔵 ${escHtml(crisis.optionA)}
      </button>
      <button class="home-crisis-btn home-crisis-btn--b" data-option="B">
        🔴 ${escHtml(crisis.optionB)}
      </button>
    </div>` : `<div class="home-crisis-voted">✅ 투표 완료 — ${myVote === 'A' ? escHtml(crisis.optionA) : escHtml(crisis.optionB)} 선택</div>`;

  return `
    <div class="home-crisis-card">
      ${prevCrisisHTML}
      <div class="home-crisis-card__header">
        <span class="home-crisis-card__badge">🚨 이번 주 정치 위기</span>
        ${!voted ? '<span class="home-crisis-card__reward">+5P</span>' : ''}
      </div>
      <div class="home-crisis-card__title">${escHtml(crisis.title)}</div>
      <div class="home-crisis-card__desc">${escHtml(crisis.desc)}</div>
      ${resultsHTML}
      ${btnsHTML}
    </div>`;
}

async function loadWeeklyCrisis(slot) {
  if (!slot) return;
  try {
    const call = httpsCallable(functions, 'getWeeklyCrisis');
    const { data } = await call();
    const { crisis, myVote, prevCrisis } = data;
    if (!crisis || !crisis.title) return;

    slot.innerHTML = buildCrisisCardHTML(crisis, myVote, prevCrisis || null);

    slot.querySelectorAll('.home-crisis-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!auth.currentUser) { navigate('/login'); return; }
        const option = btn.dataset.option;
        slot.querySelectorAll('.home-crisis-btn').forEach(b => b.disabled = true);
        try {
          const { data: vData } = await httpsCallable(functions, 'voteOnCrisis')({ option });
          if (vData.firstVote) showPointPopup(5);
          slot.innerHTML = buildCrisisCardHTML(
            { ...crisis, votesA: vData.votesA, votesB: vData.votesB },
            option,
            prevCrisis || null,
          );
        } catch {
          slot.querySelectorAll('.home-crisis-btn').forEach(b => b.disabled = false);
        }
      });
    });
  } catch { /* non-critical */ }
}

async function loadHomePartyActivity(slot) {
  if (!slot) return;
  try {
    const call = httpsCallable(functions, 'getPartyActivities');
    const { data } = await call();
    const activities = (data.activities || []).slice(0, 4);
    if (!activities.length) return;
    slot.innerHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🏛️ 오늘의 정치판</span>
          <button class="home-section-more home-section-more--button" data-path="/parties">정당 보기</button>
        </div>
        <div class="home-party-activity-list">
          ${activities.map(a => `
            <div class="home-party-activity-item" style="--party-c:${a.color}">
              <span class="home-party-activity-item__emoji">${a.emoji}</span>
              <div class="home-party-activity-item__body">
                <span class="home-party-activity-item__name">${escHtml(a.charName)} <em>${escHtml(a.partyName)}</em></span>
                <p class="home-party-activity-item__text">${escHtml(a.text)}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    slot.querySelectorAll('[data-path]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.path));
    });
  } catch { /* non-critical */ }
}

async function loadNotifications(uid, slot) {
  if (!uid || !slot) return;
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      limit(15)
    );
    const snap = await getDocs(q);
    const unread = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(n => !n.read)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    if (!unread.length) return;

    const latest = unread[0];
    const moreCount = unread.length - 1;

    slot.innerHTML = `
      <div class="home-notif-banner">
        <div class="home-notif-banner__content">
          <span class="home-notif-banner__title">${escHtml(latest.title || '')}</span>
          ${latest.body ? `<span class="home-notif-banner__body">${escHtml(latest.body)}</span>` : ''}
          ${moreCount > 0 ? `<span class="home-notif-count">+${moreCount}개</span>` : ''}
        </div>
        <button class="home-notif-banner__close" type="button">✕</button>
      </div>`;

    slot.querySelector('.home-notif-banner__close')?.addEventListener('click', async () => {
      slot.innerHTML = '';
      try {
        const now = Date.now();
        await Promise.all(unread.map(n =>
          updateDoc(doc(db, 'notifications', n.id), { read: true, readAtMs: now })
        ));
      } catch {}
    });
  } catch { /* non-critical */ }
}
