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

function renderPresidentCard(p) {
  if (!p) return '';
  return `
    <div class="home-prez-card" data-path="/election" style="--party-color:${p.color}">
      <div class="home-prez-card__top">
        <span class="home-prez-card__label">👑 현직 대통령</span>
        <span class="home-prez-card__party">${p.emoji} ${escHtml(p.partyName)}</span>
      </div>
      <div class="home-prez-card__name">${escHtml(p.candidateName)}</div>
      ${p.decree ? `<div class="home-prez-card__decree">"${escHtml(p.decree)}"</div>` : ''}
    </div>`;
}

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
function renderRankCard(status) {
  const nick = appState.nickname || auth.currentUser?.displayName || '시민';
  const rank = getPoliticalRank(status.power || 0);
  const streak = appState.streak || 0;

  const partyLine = status.partyId
    ? `<span class="home-id-card__party${status.isLeader ? ' home-id-card__party--leader' : ''}" style="--party-color:${status.partyColor}">${status.partyEmoji} ${escHtml(status.partyName)}${status.isLeader ? ' 👑 당대표' : (status.partyRank ? ` · 당내 ${status.partyRank}위` : '')}</span>`
    : `<button class="home-id-card__join" data-path="/parties" type="button">+ 입당하고 정치력 쌓기</button>`;

  const nextLine = rank.isMax
    ? `<span class="home-id-card__next">최고 등급 달성! 🎉</span>`
    : `<span class="home-id-card__next">${rank.next.emoji} ${rank.next.title}까지 <b>${fmtNum(rank.remain)}P</b></span>`;

  const leaderChaseHTML = status.pointsToLeader && status.pointsToLeader <= 200
    ? `<div class="home-id-card__chase">🎯 당대표까지 <b>${fmtNum(status.pointsToLeader)}P</b> — 활동하면 따라잡을 수 있어요!</div>`
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
function renderMissions(status, battleData) {
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

    // 로그인 유저: 정치 신분증 + 당대표 특전 + 오늘의 정치 일정 / 게스트: 가입 유도 히어로
    const headerHTML = (myStatus && myStatus.loggedIn)
      ? `${renderRankCard(myStatus)}${renderLeaderCard(myStatus)}${renderMissions(myStatus, battleData)}${renderQuickActions()}`
      : `${renderGuestHero()}${renderQuickActions()}`;

    const newsHTML = renderNewsCard(newsData || generateFallbackNews(battleData, presidentData));
    const prezHTML = renderPresidentCard(presidentData);
    const battleHTML = renderBattleCard(battleData);

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

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2">${headerHTML}${battleHTML}${newsHTML}${prezHTML}${bestHTML}${hotHTML}${commentsHTML}<div id="home-party-power-slot"></div><div id="home-party-activity-slot"></div></div>`;

    el.querySelector('#hbtn-more-hot')?.addEventListener('click', () => navigate('/feed'));
    el.querySelectorAll('[data-path]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.path));
    });
    el.querySelectorAll('[data-id]').forEach(item =>
      item.addEventListener('click', () => navigate(`/detail/${item.dataset.id}`))
    );

    // 세력도 + 정당 활동 피드 비동기 로드
    loadPartyPowerChart(el.querySelector('#home-party-power-slot'));
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

    slot.innerHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🗺️ 공화국 세력도</span>
          <button class="home-section-more home-section-more--button" data-path="/ranking">랭킹 →</button>
        </div>
        <div class="home-power-chart">${bars}</div>
      </div>`;
    slot.querySelectorAll('[data-path]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.path));
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
