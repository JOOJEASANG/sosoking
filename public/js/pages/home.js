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
  ai_judge: '🏛️ 재판기록',
};

const QUICK_ACTIONS = [
  { path: '/republic',             emoji: '🏛️', name: '공화국',    desc: '정당·대선·국회' },
  { path: '/battle',               emoji: '⚔️', name: '배틀',      desc: '오늘의 정쟁 투표' },
  { path: '/election',             emoji: '👑', name: '대선',      desc: '대통령 선출' },
  { path: '/news',                 emoji: '📰', name: '소소신문',  desc: '오늘의 뉴스' },
  { path: '/constitutional-court', emoji: '⚖️', name: '헌법재판소', desc: 'AI 탄핵 심판' },
  { path: '/congress',             emoji: '📜', name: '국회',      desc: '법안 발의·표결' },
  { path: '/ranking',              emoji: '🏆', name: '랭킹',      desc: '출세 순위' },
  { path: '/feed',                 emoji: '💬', name: '피드',      desc: '시민 토론·이슈' },
  { path: '/guide',                emoji: '📖', name: '가이드',    desc: '게임 안내' },
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
    if (data && data.newsPoints > 0) toast.success(`📰 소소신문 읽기 +${data.newsPoints}P 획득!`);
    return (data && data.headline) ? data : null;
  } catch { return null; }
}

async function loadRepublicStatus(slot, presidentData, newsData) {
  if (!slot) return;
  try {
    const overviewData = await fetchPoliticsOverview();
    const html = renderRepublicStatus(presidentData, overviewData, newsData);
    if (html) slot.innerHTML = html;
  } catch { /* non-critical */ }
}

async function fetchPoliticsOverview() {
  try {
    const { data } = await httpsCallable(functions, 'getPoliticsOverview')();
    return data || null;
  } catch { return null; }
}

function rsCalcMetrics(president, parties) {
  const approve = Number(president?.decreeApprove || 0);
  const disapprove = Number(president?.decreeDisapprove || 0);
  const total = approve + disapprove;
  const approval = total > 0
    ? Math.max(1, Math.min(99, Math.round((approve / total) * 100)))
    : (president?.candidateName ? 52 : 0);
  const topPower = Number(parties?.[0]?.totalPower || 0);
  const secondPower = Number(parties?.[1]?.totalPower || 0);
  const competition = topPower > 0 ? Math.round(Math.min(30, (secondPower / topPower) * 30)) : 15;
  const base = president?.candidateName ? 50 : 42;
  const stability = Math.max(25, Math.min(95, base + Math.round(approval * 0.25) + (topPower > secondPower ? 8 : 0)));
  const economy = Math.max(30, Math.min(92, 56 + Math.round(approval * 0.18) + Math.round(competition * 0.2)));
  const welfare = Math.max(30, Math.min(92, 52 + Math.round(approval * 0.15) + (parties?.length ? 4 : 0)));
  const order = Math.max(30, Math.min(92, 58 + Math.round(stability * 0.18)));
  const media = Math.max(30, Math.min(92, 50 + Math.round(competition * 0.8)));
  const avg = Math.round((stability + economy + welfare + order + media) / 5);
  const grade = avg >= 85 ? 'A+' : avg >= 75 ? 'A' : avg >= 65 ? 'B+' : avg >= 55 ? 'B' : avg >= 45 ? 'C' : 'D';
  return { approval, stability, economy, welfare, order, media, grade };
}

function rsMetricBar(label, value) {
  return `<div class="home-rs__metric">
    <span class="home-rs__metric-l">${label}</span>
    <span class="home-rs__metric-t"><i class="home-rs__metric-f" style="width:${value}%"></i></span>
    <b class="home-rs__metric-v">${value}</b>
  </div>`;
}

function renderRepublicStatus(presidentData, overviewData, newsData) {
  if (!presidentData && !overviewData) return '';
  const parties = Array.isArray(overviewData?.parties) ? overviewData.parties : [];
  const rulingPartyId = presidentData?.partyId || parties[0]?.id || '';
  const rulingParty = parties.find(p => p.id === rulingPartyId) || parties[0];
  const opposition = parties.find(p => p.id !== rulingPartyId);
  const metrics = rsCalcMetrics(presidentData, parties);
  const headline = newsData?.headline || '오늘의 정세가 곧 갱신됩니다';
  const presidentName = presidentData?.candidateName || '공석';
  const presidentPartyName = presidentData?.partyName || rulingParty?.name || '미정';

  const partyRowsHtml = parties.slice(0, 3).map((p, idx) => {
    const role = p.id === rulingPartyId ? '여당' : idx === 0 ? '제1당' : '야당';
    return `<div class="home-rs__party-row">
      <span class="home-rs__party-num">${idx + 1}</span>
      <b class="home-rs__party-name">${escHtml(p.emoji)} ${escHtml(p.name)}</b>
      <em class="home-rs__party-role">${role}</em>
    </div>`;
  }).join('') || `<div class="home-rs__party-empty">정당 집계 대기중</div>`;

  return `
    <section class="home-rs">
      <div class="home-rs__header">
        <div>
          <div class="home-rs__eyebrow">SOSO REPUBLIC STATUS</div>
          <div class="home-rs__title">🏛️ 소소공화국 국가 현황</div>
          <div class="home-rs__headline">${escHtml(headline)}</div>
        </div>
        <div class="home-rs__grade-box">
          <div class="home-rs__grade-label">국가등급</div>
          <div class="home-rs__grade-value">${metrics.grade}</div>
        </div>
      </div>
      <div class="home-rs__tiles">
        <div class="home-rs__tile"><span class="home-rs__tile-l">대통령</span><b class="home-rs__tile-v">${escHtml(presidentName)}</b><small class="home-rs__tile-s">${escHtml(presidentPartyName)}</small></div>
        <div class="home-rs__tile"><span class="home-rs__tile-l">대통령 지지율</span><b class="home-rs__tile-v">${metrics.approval ? `${metrics.approval}%` : '대기중'}</b><small class="home-rs__tile-s">${metrics.approval < 30 && metrics.approval ? '탄핵 위험권' : '국정 평가 반영'}</small></div>
        <div class="home-rs__tile"><span class="home-rs__tile-l">여당</span><b class="home-rs__tile-v">${escHtml(rulingParty?.emoji || '')} ${escHtml(rulingParty?.name || '미정')}</b><small class="home-rs__tile-s">${escHtml(rulingParty?.leader?.nickname || '당대표 집계중')}</small></div>
        <div class="home-rs__tile"><span class="home-rs__tile-l">제1야당</span><b class="home-rs__tile-v">${escHtml(opposition?.emoji || '')} ${escHtml(opposition?.name || '미정')}</b><small class="home-rs__tile-s">견제 세력</small></div>
      </div>
      <div class="home-rs__lower">
        <div class="home-rs__metrics">
          ${rsMetricBar('국정 안정도', metrics.stability)}
          ${rsMetricBar('경제 체감도', metrics.economy)}
          ${rsMetricBar('복지 만족도', metrics.welfare)}
          ${rsMetricBar('치안 질서', metrics.order)}
          ${rsMetricBar('언론 신뢰도', metrics.media)}
        </div>
        <div class="home-rs__parties">
          <div class="home-rs__parties-title">정당 판세</div>
          ${partyRowsHtml}
        </div>
      </div>
    </section>`;
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

  const crisisHTML = (() => {
    if (approvePct === null || totalRatings < 5 || !p.decree) return '';
    if (approvePct < 30) return `<div class="home-prez-crisis home-prez-crisis--danger">🔴 탄핵 경보 — 지지율 ${approvePct}%</div>`;
    if (approvePct < 45) return `<div class="home-prez-crisis home-prez-crisis--warning">⚠️ 지지율 위기 — ${approvePct}%</div>`;
    if (approvePct >= 80) return `<div class="home-prez-crisis home-prez-crisis--high">⭐ 높은 지지 — ${approvePct}%</div>`;
    return '';
  })();

  const impeachCount = Number(p.impeachCount || 0);
  const impeachThreshold = Number(p.impeachThreshold || 5);
  const impeachTriggered = !!p.impeachTriggered;
  const impeachPct = Math.min(100, Math.round((impeachCount / impeachThreshold) * 100));
  const impeachHTML = impeachCount > 0 ? (() => {
    if (impeachTriggered) return `<div class="home-prez-impeach home-prez-impeach--triggered">✍️ 탄핵 청원 가결 — ${impeachCount}/${impeachThreshold}명 서명 완료</div>`;
    const urgencyClass = impeachPct >= 60 ? ' home-prez-impeach--urgent' : '';
    return `<div class="home-prez-impeach${urgencyClass}" data-path="/election">
      <div class="home-prez-impeach__label">✍️ 탄핵 청원 진행 중 ${impeachCount}/${impeachThreshold}명</div>
      <div class="home-prez-impeach__bar-wrap"><div class="home-prez-impeach__bar" style="width:${impeachPct}%"></div></div>
    </div>`;
  })() : '';

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
      ${crisisHTML}
      ${impeachHTML}
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
  const winnerChar = isEnded && battle.king ? chars.find(c => c.id === battle.king) : null;
  const miniVoteBars = chars.length > 0 && (hasVoted || isEnded || totalVotes > 0) ? `
    <div class="home-battle-mini-bars">
      ${chars.map(c => {
        const count = votes[c.id] || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isVoted = battle.userVote === c.id;
        const isWinner = isEnded && c.id === battle.king;
        return `<div class="home-battle-mini-bar${isVoted ? ' home-battle-mini-bar--voted' : ''}${isWinner ? ' home-battle-mini-bar--winner' : ''}">
          <span class="home-battle-mini-bar__emoji">${c.emoji}</span>
          <div class="home-battle-mini-bar__track">
            <div class="home-battle-mini-bar__fill" style="width:${pct}%;background:${c.color}"></div>
          </div>
          <span class="home-battle-mini-bar__pct">${pct}%${isWinner ? ' 👑' : ''}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  const decreeHTML = isEnded && battle.aftermath?.decree
    ? `<div class="home-battle-card__decree">${winnerChar ? `${winnerChar.emoji} ` : ''}집권 선언: "${escHtml(battle.aftermath.decree.slice(0, 50))}${battle.aftermath.decree.length > 50 ? '…' : ''}"</div>`
    : '';

  return `
    <div class="home-battle-card" data-path="/battle">
      <div class="home-battle-card__head">
        <span class="home-battle-card__king">🏛️ ${escHtml(kingText)}</span>
        <span class="home-battle-card__status${isEnded ? ' home-battle-card__status--ended' : ''}">${isEnded ? `종료 · ${fmtNum(totalVotes)}표` : battle.exists ? (totalVotes > 0 ? `${fmtNum(totalVotes)}표` : '🔴 투표중') : '준비중'}</span>
      </div>
      <div class="home-battle-card__topic">${escHtml(battle.topic || '오늘의 정치 스캔들')}</div>
      ${!isEnded ? `<div class="home-battle-card__preview">
        ${previewTurns.map(t =>
          `<div class="home-battle-card__line">${t.emoji} <b>${escHtml(t.charName || '')}</b> ${escHtml((t.text || '').slice(0, 35))}…</div>`
        ).join('')}
      </div>` : ''}
      ${miniVoteBars}
      ${decreeHTML}
      <div class="home-battle-card__cta">${isEnded ? '결과 자세히 보기 →' : hasVoted ? '✅ 투표 완료 · 자세히 보기 →' : '토론 보고 한 표 던지기 →'}</div>
    </div>`;
}

// 비로그인 게스트용 히어로
function renderGuestHero(presidentData, battleData) {
  const liveItems = [];
  if (presidentData) {
    liveItems.push(`👑 현직 대통령: ${escHtml(presidentData.candidateName)} · ${escHtml(presidentData.partyName)}`);
  }
  if (battleData && battleData.totalVotes > 0) {
    liveItems.push(`⚔️ 오늘 배틀 ${fmtNum(battleData.totalVotes)}명 참여 중`);
  }
  const liveHTML = liveItems.length
    ? `<div class="home-landing-hero__live">${liveItems.map(t => `<span>${t}</span>`).join('<span class="home-landing-hero__live-sep">·</span>')}</div>`
    : '';

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
        ${liveHTML}
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
    ? `<div class="home-id-card__party-row-inner">
        <span class="home-id-card__party${status.isLeader ? ' home-id-card__party--leader' : ''}" style="--party-color:${status.partyColor}">${status.partyEmoji} ${escHtml(status.partyName)}${status.isLeader ? ' 👑 당대표' : ''}${rulingBadge}</span>
        ${!status.isLeader && status.partyRank ? `<span class="home-id-card__party-rank">당내 ${status.partyRank}위</span>` : ''}
      </div>`
    : `<button class="home-id-card__join" data-path="/republic" type="button">🏛️ 입당하고 대통령 도전하기</button>`;

  const nextLine = rank.isMax
    ? `<span class="home-id-card__next">최고 등급 달성! 🎉</span>`
    : `<span class="home-id-card__next">${rank.next.emoji} ${rank.next.title}까지 <b>${fmtNum(rank.remain)}P</b></span>`;

  const leaderChaseHTML = !status.isLeader && status.partyId && status.pointsToLeader > 0 && status.pointsToLeader <= 1000
    ? `<div class="home-id-card__chase">🎯 당대표까지 <b>${fmtNum(status.pointsToLeader)}P</b> — 당대표 → 대통령 후보 출마!</div>`
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

  const nearNext = !rank.isMax && rank.progress >= 70;
  const approval = status.approvalRating;
  const approvalColor = approval >= 70 ? '#16a34a' : approval >= 50 ? '#2563eb' : '#dc2626';
  const approvalLabel = approval >= 80 ? '높은 지지' : approval >= 60 ? '안정적' : approval >= 45 ? '보통' : '위기';

  return `
    <section class="home-id-card page-enter" style="--rank-c:${rank.color}">
      <div class="home-id-card__top">
        <div class="home-id-card__emoji">${rank.emoji}</div>
        <div class="home-id-card__info">
          <div class="home-id-card__title">${escHtml(nick)}</div>
          <div class="home-id-card__rank">${rank.title} · ${fmtNum(rank.power)}P${streak >= 2 ? ` · 🔥${streak}일` : ''}${status.weeklyGain > 0 ? ` · <span style="color:#16a34a">+${fmtNum(status.weeklyGain)}P↑</span>` : ''}</div>
        </div>
        <button class="home-id-card__more" data-path="/ranking" type="button">랭킹 →</button>
      </div>
      ${approval !== undefined ? `
      <div class="home-id-card__approval-row">
        <span class="home-id-card__approval-lbl">📊 시민 지지율</span>
        <div class="home-id-card__approval-track">
          <div class="home-id-card__approval-fill" style="width:${approval}%;background:${approvalColor}"></div>
        </div>
        <span class="home-id-card__approval-num" style="color:${approvalColor}">${approval}% <em>${approvalLabel}</em></span>
      </div>` : ''}
      <div class="home-id-card__progress">
        <div class="home-id-card__bar"><div class="home-id-card__fill${nearNext ? ' home-id-card__fill--near' : ''}" style="width:${rank.progress}%"></div></div>
        ${nextLine}${nearNext ? ` <span style="color:var(--rank-c);font-size:11px;font-weight:900">▲ 승급 임박!</span>` : ''}
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
// 어제의 결과 리워드 — 재방문 시 내가 투표한 배틀의 승패를 보여주고 오늘로 연결.
function renderYesterdayResult(yr) {
  if (!yr || !yr.myParty || !yr.winner) return '';
  try {
    const seenKey = `battleResultSeen_${yr.date}`;
    if (localStorage.getItem(seenKey)) return '';
    localStorage.setItem(seenKey, '1'); // 하루 한 번만 노출
  } catch {}
  const won = !!yr.won;
  const mp = yr.myParty;
  const wn = yr.winner;
  const title = won ? '🎉 어제의 승전보!' : '🥊 어제는 아쉬웠어요';
  const body = won
    ? `당신이 민 <b>${escHtml(mp.emoji)} ${escHtml(mp.name)}</b>이(가) 어제 논쟁에서 <b>승리</b>했어요!`
    : `<b>${escHtml(mp.emoji)} ${escHtml(mp.name)}</b>이(가) ${escHtml(wn.emoji)} ${escHtml(wn.name)}에게 밀렸어요.`;
  const cta = won ? '오늘도 연승 이어가기' : '오늘 배틀에서 설욕하기';
  return `
    <section class="home-yresult home-yresult--${won ? 'win' : 'lose'}">
      <button class="home-yresult__close" aria-label="닫기" type="button">✕</button>
      <div class="home-yresult__title">${title}</div>
      <div class="home-yresult__body">${body}</div>
      ${yr.topic ? `<div class="home-yresult__topic">📰 ${escHtml(yr.topic)}</div>` : ''}
      <button class="home-yresult__cta" data-path="/battle" type="button">⚔️ ${cta} →</button>
    </section>`;
}

// 오늘의 국정 브리핑 — 홈 최상단. "오늘 왜 들어왔나"에 즉답하는 일일 앵커.
function renderDailyBriefing(status, battleData, presidentData, newsData) {
  const kstHour = new Date(Date.now() + 9 * 3600000).getUTCHours();
  const greet = kstHour < 6 ? '늦은 밤이네요' : kstHour < 12 ? '좋은 아침이에요' : kstHour < 18 ? '오늘도 수고 많아요' : '좋은 저녁이에요';
  const nick = appState.nickname || status.nickname || '시민';
  const streak = appState.streak || 0;

  // 오늘 남은 핵심 행동(우선순위) — 첫 미완료를 메인 CTA로
  const focus = [
    { done: !!(battleData && battleData.userVote), label: '오늘의 배틀 투표', sub: battleData?.topic ? `쟁점: ${battleData.topic}` : '세 정당의 격돌', path: '/battle', reward: '+5P', icon: '🗳️' },
    { done: !!status.readNewsToday, label: '소소신문 읽기', sub: newsData?.headline || '오늘의 정세 확인', path: '/news', reward: '+3P', icon: '📰' },
    { done: !!status.votedElection || !status.electionEndKey, label: '대통령 선거 투표', sub: '한 표가 공화국을 바꿉니다', path: '/election', reward: '+5P', icon: '👑' },
    { done: !!status.votedCrisis, label: '이번 주 위기 투표', sub: '국가 위기에 한 표', path: '/news?scroll=crisis', reward: '+5P', icon: '🚨' },
  ];
  const pending = focus.filter(f => !f.done);
  const next = pending[0] || null;
  const doneCount = focus.filter(f => f.done).length;

  // 헤드라인: 오늘의 배틀 쟁점 우선, 없으면 신문 헤드라인
  const headline = (battleData && battleData.topic)
    ? `오늘의 쟁점 — ${escHtml(battleData.topic)}`
    : escHtml(newsData?.headline || '오늘의 정세가 곧 갱신됩니다');

  const ctaHTML = next
    ? `<button class="home-brief__cta" data-path="${next.path}" type="button">
         <span class="home-brief__cta-icon">${next.icon}</span>
         <span class="home-brief__cta-body">
           <span class="home-brief__cta-label">${escHtml(next.label)}</span>
           <span class="home-brief__cta-sub">${escHtml(next.sub)}</span>
         </span>
         <span class="home-brief__cta-reward">${next.reward}</span>
         <span class="home-brief__cta-go">→</span>
       </button>`
    : `<div class="home-brief__done">🎉 오늘의 핵심 국정을 모두 완수했어요! 내일도 만나요</div>`;

  return `
    <section class="home-brief">
      <div class="home-brief__top">
        <div class="home-brief__greet">${greet}, <b>${escHtml(nick)}</b>님 👋</div>
        ${streak >= 1 ? `<div class="home-brief__streak">🔥 ${streak}일 연속</div>` : ''}
      </div>
      <div class="home-brief__headline">📢 ${headline}</div>
      ${ctaHTML}
      <div class="home-brief__progress">오늘 핵심 미션 ${doneCount}/${focus.length} 완료${pending.length ? ` · ${pending.length}개 남음` : ' 🎉'}</div>
    </section>`;
}

function renderMissions(status, battleData, isRulingParty = false) {
  const votedBattle = !!(battleData && battleData.userVote);
  const votedElection = !!status.votedElection;
  const votedCrisis = !!status.votedCrisis;
  const readNewsToday = !!status.readNewsToday;
  const campaignsToday = Number(status.campaignsToday || 0);
  const streak = appState.streak || 0;
  const attended = streak >= 1;

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

  const askedQA = !!status.askedQAThisWeek;

  const missions = [
    { done: attended,       label: '오늘 출석',        path: '/',         cta: '완료',       reward: dailyReward, icon: '📅' },
    { done: readNewsToday,  label: '소소신문 읽기',     path: '/news',     cta: '읽으러 가기', reward: '+3P',      icon: '📰' },
    { done: votedBattle,    label: '정치배틀 투표',     path: '/battle',   cta: '투표하기',   reward: '+5P',       icon: '🗳️' },
    { done: votedElection,  label: elecLabel,           path: '/election', cta: '투표하기',   reward: '+5P',       icon: '👑' },
    { done: votedCrisis,    label: '이번 주 위기 투표', path: '/news?scroll=crisis', cta: '참여하기', reward: '+5P', icon: '🚨' },
    { done: askedQA,        label: '대통령에게 질문',   path: '/election', cta: '질문하기',   reward: '+3P',       icon: '🎙️' },
    ...(status.partyId ? [{ done: campaignsToday >= 1, label: `유세 캠페인 (${campaignsToday}/3)`, path: '/republic', cta: '유세하기', reward: '-20P → 당 +15P', icon: '📢' }] : []),
    ...(isRulingParty ? [{ done: true, label: '집권당 일일 특전', path: '/', cta: '수령 완료', reward: '+3P 🔑', icon: '🏛️' }] : []),
  ];
  const doneCount = missions.filter(m => m.done).length;
  const allDone = doneCount === missions.length;
  const totalRewardLabel = `최대 ${status.isLeader ? '71' : '61'}P 획득 가능`;

  // 스트릭 위기: 밤 9시 이후 아직 출석 안 했으면 경고
  const kstHour = new Date(Date.now() + 9 * 3600000).getUTCHours();
  const streakWarningHTML = (!attended && streak >= 2 && kstHour >= 21)
    ? `<div class="home-streak-warning">
        <span class="home-streak-warning__flame">🔥</span>
        <span><b>${streak}일 연속 스트릭 위기!</b> 자정 전에 출석 체크하세요!</span>
      </div>`
    : '';

  return `
    <section class="home-missions${allDone ? ' home-missions--all-done' : ''}">
      ${streakWarningHTML}
      <div class="home-missions__head">
        <span class="home-missions__title">📋 오늘의 정치 일정</span>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          <span class="home-missions__count${allDone ? ' home-missions__count--all' : ''}">${doneCount}/${missions.length} 완료${allDone ? ' 🎉' : ''}</span>
          <span style="font-size:10px;color:var(--color-text-muted);font-weight:600">${totalRewardLabel}</span>
        </div>
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
          <button class="home-missions__bonus-item" data-path="/republic" type="button">🏛️ 공화국 허브 <em>확인</em></button>
        </div>
      </div>` : ''}
    </section>`;
}

// 소소공화국 속보 티커
function renderNewsTicker(presidentData, battleData, newsData) {
  const items = [];

  if (presidentData) {
    const approveCount = Number(presidentData.decreeApprove || 0);
    const disapproveCount = Number(presidentData.decreeDisapprove || 0);
    const total = approveCount + disapproveCount;
    const pct = total >= 3 ? Math.round((approveCount / total) * 100) : null;
    const approval = pct !== null ? ` · 지지율 ${pct}%` : '';
    items.push({ text: `🏛️ ${escHtml(presidentData.candidateName)} 대통령 재임 중${approval}`, path: '/election' });

    const impeachCount = Number(presidentData.impeachCount || 0);
    if (impeachCount > 0) {
      const impeachThreshold = Number(presidentData.impeachThreshold || 5);
      if (presidentData.impeachTriggered) {
        items.push({ text: `✍️ 탄핵 청원 가결 — ${impeachCount}/${impeachThreshold}명 서명`, path: '/election' });
      } else {
        items.push({ text: `✍️ 탄핵 청원 진행 중 — ${impeachCount}/${impeachThreshold}명 서명`, path: '/election' });
      }
    }
  }

  if (battleData && battleData.totalVotes > 0) {
    const king = battleData.currentKing;
    const kingText = king ? `${king.emoji} ${escHtml(king.name)} 집권 중` : '집권자 미정';
    items.push({ text: `⚔️ 정치배틀 ${fmtNum(battleData.totalVotes)}명 참여 — ${kingText}`, path: '/battle' });
  }

  if (newsData && newsData.headline) {
    items.push({ text: `📰 ${escHtml(newsData.headline.slice(0, 50))}${newsData.headline.length > 50 ? '…' : ''}`, path: '/news' });
  }

  if (items.length === 0) return '';

  const dupItems = [...items, ...items];
  const tickerContent = dupItems.map((item, i) =>
    `<span class="home-ticker__item" data-path="${item.path}">🔴 속보 &nbsp; ${item.text}</span><span class="home-ticker__sep" aria-hidden="true"> ▪ </span>`
  ).join('');

  return `<div class="home-ticker" role="marquee" aria-label="소소공화국 속보">
    <span class="home-ticker__badge">속보</span>
    <div class="home-ticker__track"><div class="home-ticker__inner">${tickerContent}</div></div>
  </div>`;
}

// 전체 기능 바로가기 그리드
function renderQuickActions() {
  return `
    <div class="home-section-header" style="margin-bottom:8px">
      <span class="home-section-title">🗺️ 전체 기능</span>
    </div>
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

    const [hotPosts, battleData, presidentData, newsData, myStatus] = await Promise.all([
      fetchHotPosts(4),
      fetchTodayBattle(),
      fetchPresident(),
      fetchDailyNews(),
      fetchMyStatus(),
      user ? checkStreak(user.uid) : Promise.resolve(),
    ]);

    if (user && myStatus?.loggedIn) checkRankUp(user.uid, myStatus.power);

    const isRulingParty = !!(myStatus?.loggedIn && myStatus.partyId && presidentData?.partyId && presidentData.partyId === myStatus.partyId);

    const newPrezHTML = renderPresidentAnnouncement(presidentData);
    const battleHTML = renderBattleCard(battleData);

    const hotHTML = hotPosts.length ? `
      <div class="home-hot-section">
        <div class="home-section-header">
          <span class="home-section-title">🔥 인기글</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-hot">더 보기</button>
        </div>
        <div class="home-rank-list">
          ${hotPosts.map(renderPopularPost).join('')}
        </div>
      </div>` : '';

    if (myStatus && myStatus.loggedIn) {
      // 로그인: 신분증 → 국가현황(비동기) → 미션 → 배틀 → 인기글
      el.innerHTML = `
        <div class="home-dash page-enter home-dash--v2">
          <div id="home-notif-slot"></div>
          ${newPrezHTML}
          ${renderYesterdayResult(battleData?.yesterdayResult)}
          ${renderDailyBriefing(myStatus, battleData, presidentData, newsData)}
          ${renderRankCard(myStatus, isRulingParty)}
          <div id="home-rs-slot"></div>
          ${renderMissions(myStatus, battleData, isRulingParty)}
          <div id="home-campaign-slot"></div>
          ${battleHTML}
          <div id="home-crisis-slot"></div>
          ${hotHTML}
        </div>`;
    } else {
      // 비로그인: 히어로 → 국가현황(비동기) → 배틀 → 인기글
      el.innerHTML = `
        <div class="home-dash page-enter home-dash--v2">
          ${renderGuestHero(presidentData, battleData)}
          <div id="home-rs-slot"></div>
          ${battleHTML}
          ${hotHTML}
        </div>`;
    }

    el.querySelector('.home-new-prez-announce__close')?.addEventListener('click', () => {
      el.querySelector('#home-new-prez-announce')?.remove();
    });

    el.querySelector('.home-yresult__close')?.addEventListener('click', () => {
      el.querySelector('.home-yresult')?.remove();
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

    // 국가현황 비동기 로드 (메인 렌더 완료 후 별도 fetch)
    loadRepublicStatus(el.querySelector('#home-rs-slot'), presidentData, newsData);

    // 유세 카드 + 세력도 + 위기 이벤트 비동기 로드
    if (user) loadNotifications(user.uid, el.querySelector('#home-notif-slot'), myStatus?.partyId || null);
    if (user && myStatus?.loggedIn && myStatus.partyId) loadCampaignCard(el.querySelector('#home-campaign-slot'), myStatus);
    if (user && myStatus?.loggedIn && myStatus.partyId) loadHomeManifesto(el.querySelector('#home-manifesto-slot'), myStatus);
    loadPartyPowerChart(el.querySelector('#home-party-power-slot'), battleData);
    loadWeeklyCrisis(el.querySelector('#home-crisis-slot'));
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

function renderCampaignSlot(slot, status, count, MAX, COST, BOOST, totalToday = 0) {
  const canCampaign = count < MAX && (status.power || 0) >= COST;
  const pips = Array.from({ length: MAX }, (_, i) =>
    `<span class="home-campaign-pip${i < count ? ' home-campaign-pip--done' : ''}"></span>`
  ).join('');
  const totalLine = totalToday > 0
    ? `<span class="home-campaign-card__total">🗺️ 오늘 공화국 전체 ${totalToday}회 유세</span>`
    : '';
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
        <span class="home-campaign-card__desc">-${COST}P 소모 → 당 정치력 +${BOOST}${totalLine}</span>
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
        renderCampaignSlot(slot, status, data.campaignsToday, data.maxCampaigns, COST, BOOST, (totalToday || 0) + 1);
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
    const [campSnap, totalsSnap] = await Promise.all([
      getDoc(doc(db, 'campaign_records', `${uid}_${today}`)),
      getDoc(doc(db, 'campaign_totals', today)),
    ]);
    const count = campSnap.exists() ? Number(campSnap.data().count || 0) : 0;
    const totalToday = totalsSnap.exists() ? Number(totalsSnap.data().total || 0) : 0;
    renderCampaignSlot(slot, status, count, MAX, COST, BOOST, totalToday);
  } catch { /* non-critical */ }
}

async function loadHomeManifesto(slot, status) {
  if (!slot || !status?.partyId) return;
  try {
    const call = httpsCallable(functions, 'getPartyManifesto');
    const { data } = await call({ partyId: status.partyId });
    if (!data?.manifesto) return;
    slot.innerHTML = `
      <div class="home-manifesto-card" style="--party-c:${status.partyColor || '#7c3aed'}">
        <div class="home-manifesto-card__header">
          <span class="home-manifesto-card__party">${status.partyEmoji} ${escHtml(status.partyName)}</span>
          <span class="home-manifesto-card__tag">📜 이번 주 당론</span>
        </div>
        <p class="home-manifesto-card__text">"${escHtml(data.manifesto)}"</p>
      </div>`;
    slot.querySelector('[data-path]')?.addEventListener('click', () => navigate('/parties'));
  } catch { /* non-critical */ }
}

async function loadPartyPowerChart(slot, battleData) {
  if (!slot) return;
  const battleWinPartyId = battleData?.currentKing?.partyId || null;
  try {
    const { PARTY_COLORS } = await import('../utils/party-badge.js');
    const snap = await getDocs(collection(db, 'parties'));
    const parties = snap.docs
      .map(d => {
        const meta = PARTY_COLORS[d.id];
        if (!meta) return null;
        const totalPower = Number(d.data().totalPower || 0);
        const prevDayPower = Number(d.data().prevDayPower || 0);
        const diff = prevDayPower > 0 ? totalPower - prevDayPower : 0;
        return { id: d.id, ...meta, totalPower, memberCount: Number(d.data().memberCount || 0), diff };
      })
      .filter(Boolean)
      .sort((a, b) => b.totalPower - a.totalPower);

    const total = parties.reduce((s, p) => s + p.totalPower, 0);
    if (!total) return;

    const bars = parties.map(p => {
      const pct = Math.round((p.totalPower / total) * 100);
      const width = Math.max(2, pct);
      const trendHTML = p.diff !== 0
        ? `<span class="home-power-row__trend home-power-row__trend--${p.diff > 0 ? 'up' : 'down'}">${p.diff > 0 ? '▲' : '▼'}${fmtNum(Math.abs(p.diff))}</span>`
        : '';
      const battleBadge = battleWinPartyId === p.id
        ? `<span class="home-power-row__battle-win">⚔️</span>`
        : '';
      return `
        <div class="home-power-row" style="--party-c:${p.color}">
          <span class="home-power-row__emoji">${p.emoji}</span>
          <span class="home-power-row__name">${escHtml(p.name)}${battleBadge}</span>
          <div class="home-power-row__track">
            <div class="home-power-row__fill" style="width:${width}%"></div>
          </div>
          <span class="home-power-row__pct">${pct}%${trendHTML}</span>
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
    const [elecRes, momentumRes] = await Promise.all([
      httpsCallable(functions, 'getElection')(),
      httpsCallable(functions, 'getCampaignMomentum')().catch(() => ({ data: { totalToday: 0, byParty: [] } })),
    ]);
    const election = elecRes.data && elecRes.data.election;
    if (!election || election.status === 'closed') return;

    const cands = [...(election.candidates || [])].sort((a, b) => b.votes - a.votes || b.power - a.power);
    if (!cands.length) return;

    const total = election.totalVotes || 0;
    const topCands = cands.slice(0, 3);
    const leader = topCands[0];
    const second = topCands[1];
    const end = new Date(`${election.endKey}T23:59:59+09:00`).getTime();
    const msLeft = end - Date.now();
    const daysLeft = Math.ceil(msLeft / 86400000);
    const ddayLabel = msLeft <= 0 ? '집계 중' : daysLeft <= 0 ? '⚡ D-DAY' : `D-${daysLeft}`;
    const urgent = msLeft > 0 && daysLeft <= 1;

    // 박빙 경보: 1위-2위 차이가 투표 수의 10% 이내이거나 절대 표수 5표 이내
    const gapVotes = total > 1 && second ? leader.votes - second.votes : Infinity;
    const gapPct = total > 0 && second ? Math.round((gapVotes / total) * 100) : 100;
    const isTight = total >= 4 && (gapVotes <= 5 || gapPct <= 10);

    const { totalToday = 0, byParty: campaignParties = [] } = momentumRes.data || {};

    const myVote = election.myVote || null;

    const barsHTML = topCands.map((c, i) => {
      const pct = total > 0 ? Math.round((c.votes / total) * 100) : 0;
      const medals = ['🥇', '🥈', '🥉'];
      const isMyPick = myVote === c.partyId;
      const gapTag = i === 0 && isTight
        ? `<span class="home-race-tight-tag">⚡ 박빙 ${gapVotes}표 차</span>`
        : i === 1 && isTight
          ? `<span class="home-race-chase-tag">↑ ${gapVotes}표 추격</span>`
          : '';
      return `
        <div class="home-race-row${i === 0 && isTight ? ' home-race-row--tight' : ''}${isMyPick ? ' home-race-row--mypick' : ''}" style="--party-c:${c.color}">
          <span class="home-race-row__medal">${medals[i] || ''}</span>
          <span class="home-race-row__emoji">${c.emoji}</span>
          <div class="home-race-row__center">
            <div class="home-race-row__name-row">
              <span class="home-race-row__name">${escHtml(c.candidateName)}</span>
              ${isMyPick ? '<span class="home-race-row__mypick-tag">✓ 내 선택</span>' : gapTag}
            </div>
            <div class="home-race-bar">
              <div class="home-race-bar__fill" style="width:${Math.max(4, pct)}%"></div>
            </div>
          </div>
          <span class="home-race-row__pct">${total > 0 ? pct + '%' : '-'}</span>
        </div>`;
    }).join('');

    const ctaHTML = !myVote && election.status === 'open'
      ? `<button class="home-race-vote-cta" data-path="/election">🗳️ 지금 투표하기 (+5P)</button>`
      : '';

    const campaignHTML = campaignParties.length > 0
      ? `<div class="home-race-campaign">
          <span class="home-race-campaign__label">🎤 오늘 유세</span>
          ${campaignParties.slice(0, 3).map(p => `
            <span class="home-race-campaign__party" style="color:${p.color}">${p.emoji} <b>${p.count}</b></span>`).join('')}
          <span class="home-race-campaign__total">총 ${totalToday}회</span>
        </div>`
      : '';

    const tightBannerHTML = isTight
      ? `<div class="home-race-tight-banner">⚡ 대선 박빙! ${leader.emoji} ${escHtml(leader.candidateName)} vs ${second.emoji} ${escHtml(second.candidateName)} — 단 ${gapVotes}표 차이</div>`
      : '';

    slot.innerHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🗳️ 이번 주 대선 경쟁</span>
          <button class="home-section-more home-section-more--button${urgent ? ' home-section-more--urgent' : ''}" data-path="/election">${ddayLabel} →</button>
        </div>
        <div class="home-race-card${isTight ? ' home-race-card--tight' : ''}" data-path="/election">
          ${tightBannerHTML}
          ${total > 0
            ? `<div class="home-race-leader">선두: <b>${leader.emoji} ${escHtml(leader.candidateName)}</b> · ${fmtNum(total)}표 집계</div>`
            : `<div class="home-race-leader">아직 투표가 없어요 — 첫 번째로 투표해보세요!</div>`}
          <div class="home-race-rows">${barsHTML}</div>
          ${campaignHTML}
          ${ctaHTML}
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
        <span class="home-crisis-btn__label">🔵 ${escHtml(crisis.optionA)}</span>
        ${crisis.optionADesc ? `<span class="home-crisis-btn__desc">${escHtml(crisis.optionADesc)}</span>` : ''}
      </button>
      <button class="home-crisis-btn home-crisis-btn--b" data-option="B">
        <span class="home-crisis-btn__label">🔴 ${escHtml(crisis.optionB)}</span>
        ${crisis.optionBDesc ? `<span class="home-crisis-btn__desc">${escHtml(crisis.optionBDesc)}</span>` : ''}
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

async function loadNotifications(uid, slot, myPartyId = null) {
  if (!uid || !slot) return;
  try {
    const today = getKstDateString();
    const yesterday = getKstDateString(new Date(Date.now() - 86400000));

    const [snap, evtSnap] = await Promise.all([
      getDocs(query(collection(db, 'notifications'), where('userId', '==', uid), limit(15))),
      myPartyId
        ? getDocs(query(collection(db, 'global_events'), where('partyId', '==', myPartyId), limit(5)))
        : Promise.resolve(null),
    ]);

    const unread = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(n => !n.read)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    // 최근 2일치 글로벌 배틀 승리 이벤트 (로컬 dismissed 체크)
    const dismissedEvents = (() => { try { return JSON.parse(localStorage.getItem('sosoking_dismissed_events') || '{}'); } catch { return {}; } })();
    const battleEvents = evtSnap
      ? evtSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(e => (e.date === today || e.date === yesterday) && !dismissedEvents[d.id])
          .map(e => ({
            id: `evt_${e.id}`,
            isGlobalEvent: true,
            title: `⚔️ 우리 당 배틀 집권!`,
            body: `${e.charEmoji} ${e.charName} 집권 대표 당선 → 당 정치력 +${e.bonus}`,
            eventDocId: e.id,
          }))
      : [];

    const allNotifs = [...battleEvents, ...unread];
    if (!allNotifs.length) return;

    const latest = allNotifs[0];
    const moreCount = allNotifs.length - 1;
    const isBattleWin = !!latest.isGlobalEvent;

    slot.innerHTML = `
      <div class="home-notif-banner${isBattleWin ? ' home-notif-banner--battle-win' : ''}">
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
        if (isBattleWin && latest.eventDocId) {
          const dismissed = (() => { try { return JSON.parse(localStorage.getItem('sosoking_dismissed_events') || '{}'); } catch { return {}; } })();
          dismissed[latest.eventDocId] = true;
          localStorage.setItem('sosoking_dismissed_events', JSON.stringify(dismissed));
        }
        const now = Date.now();
        await Promise.all(unread.map(n =>
          updateDoc(doc(db, 'notifications', n.id), { read: true, readAtMs: now })
        ));
      } catch {}
    });
  } catch { /* non-critical */ }
}
