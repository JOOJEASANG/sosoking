/* home.js — 대시보드형 홈 */
import { auth, db } from '../firebase.js';
import { renderFeedCard } from '../components/feed-card.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
  getCountFromServer, where, doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

const CATEGORIES = [
  {
    key: 'golra', icon: '🗳️', label: '골라봐', color: '#6366f1',
    desc: '골라야 사는 사람들의 광장. 밸런스게임·민심투표·선택지배틀',
    types: ['balance', 'vote', 'battle'],
  },
  {
    key: 'usgyo', icon: '😂', label: '웃겨봐', color: '#f59e0b',
    desc: '웃기지 않으면 살아남지 못하는 개그 아레나. 작명소·삼행시·드립',
    types: ['naming', 'acrostic', 'drip'],
  },
  {
    key: 'malhe', icon: '🎯', label: '도전봐', color: '#10b981',
    desc: '틀려도 좋고 막장이어도 좋다. OX퀴즈·릴레이소설·랜덤대결',
    types: ['ox', 'relay', 'random_battle'],
  },
];

const QUICK_TYPES = [
  { key: 'balance',      icon: '⚖️', label: '밸런스게임' },
  { key: 'vote',         icon: '🗳️', label: '민심투표'   },
  { key: 'battle',       icon: '⚔️', label: '선택지배틀' },
  { key: 'naming',       icon: '😜', label: '미친작명소' },
  { key: 'acrostic',     icon: '✍️', label: '삼행시짓기' },
  { key: 'drip',         icon: '🎤', label: '한줄드립'   },
  { key: 'ox',           icon: '❓', label: 'OX퀴즈'     },
  { key: 'relay',        icon: '🎭', label: '막장릴레이' },
  { key: 'random_battle',icon: '🎰', label: '랜덤대결'   },
];

const WEEKLY_WORDS = ['소소킹', '월요일', '킹받네', '라면왕', '퇴근길', '대반전', '웃참패'];

function getWeeklyWord() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(kst.getUTCFullYear(), 0, 1));
  const week = Math.floor(Math.floor((kst - start) / 86400000) / 7);
  return WEEKLY_WORDS[week % WEEKLY_WORDS.length];
}

async function checkStreak(uid) {
  try {
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const userRef   = doc(db, 'users', uid);
    const snap      = await getDoc(userRef);
    if (!snap.exists()) return;
    const { lastVisit = '', streak = 0 } = snap.data();
    if (lastVisit === today) return;
    const newStreak = lastVisit === yesterday ? streak + 1 : 1;
    await updateDoc(userRef, { lastVisit: today, streak: newStreak });
    appState.streak = newStreak;
  } catch { /* non-critical */ }
}

async function fetchStats() {
  try {
    const [totalSnap, todaySnap] = await Promise.all([
      getCountFromServer(collection(db, 'feeds')),
      getCountFromServer(query(
        collection(db, 'feeds'),
        where('createdAt', '>=', new Date(new Date().setHours(0, 0, 0, 0))),
      )),
    ]);
    return { total: totalSnap.data().count, today: todaySnap.data().count };
  } catch { return { total: 0, today: 0 }; }
}

async function fetchHotPosts(n = 3) {
  try {
    const since = new Date(Date.now() - 7 * 86400000);
    const q = query(
      collection(db, 'feeds'),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'desc'),
      limit(30),
    );
    const snap = await getDocs(q);
    const posts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.hidden)
      .sort((a, b) => (b.reactions?.total || 0) - (a.reactions?.total || 0));
    return posts.slice(0, n);
  } catch { return []; }
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export async function renderHome() {
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="home-dash page-enter">
      <div class="home-hero skeleton" style="height:160px;border-radius:16px"></div>
      <div class="home-stat-row">
        ${[1,2,3].map(() => `<div class="skeleton" style="height:72px;border-radius:12px;flex:1"></div>`).join('')}
      </div>
      <div class="skeleton" style="height:100px;border-radius:12px"></div>
      <div class="home-cat-grid">
        ${[1,2,3].map(() => `<div class="skeleton" style="height:130px;border-radius:12px"></div>`).join('')}
      </div>
    </div>`;

  try {
    setMeta();
    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [stats, hotPosts] = await Promise.all([fetchStats(), fetchHotPosts(3)]);
    const streak = appState.streak || 0;
    const weeklyWord = getWeeklyWord();

    /* ── 히어로 섹션 ── */
    const heroHTML = user ? `
      <div class="home-hero home-hero--user">
        <div class="home-hero__left">
          ${streak > 1 ? `<div class="home-hero__streak">🔥 ${streak}일 연속 출석 중!</div>` : ''}
          <div class="home-hero__title">오늘도 소소하게, 재미있게 👋</div>
          <div class="home-hero__sub">새로운 놀이판을 열거나 다른 사람 글에 참여해보세요.</div>
        </div>
        <div class="home-hero__actions">
          <button class="btn btn--primary" id="hbtn-write">놀이판 만들기</button>
          <button class="btn btn--ghost" id="hbtn-feed">탐색하기</button>
        </div>
      </div>` : `
      <div class="home-hero home-hero--guest">
        <div class="home-hero__badge">✨ 소소킹에 오신 걸 환영해요!</div>
        <div class="home-hero__title">골라봐, 웃겨봐, 도전봐</div>
        <div class="home-hero__sub">9가지 게임형 커뮤니티. 가입하면 바로 참여할 수 있어요.</div>
        <div class="home-hero__actions">
          <button class="btn btn--primary" id="hbtn-join">지금 시작하기</button>
          <button class="btn btn--ghost" id="hbtn-feed">둘러보기</button>
        </div>
      </div>`;

    /* ── 통계 바 ── */
    const statsHTML = `
      <div class="home-stat-row">
        <div class="home-stat-card">
          <div class="home-stat-card__num">${fmtNum(stats.total)}</div>
          <div class="home-stat-card__label">총 놀이판</div>
        </div>
        <div class="home-stat-card">
          <div class="home-stat-card__num">${fmtNum(stats.today)}</div>
          <div class="home-stat-card__label">오늘 새 글</div>
        </div>
        <div class="home-stat-card">
          <div class="home-stat-card__num">${QUICK_TYPES.length}가지</div>
          <div class="home-stat-card__label">게임 유형</div>
        </div>
      </div>`;

    /* ── 이번 주 미션 배너 ── */
    const missionHTML = `
      <div class="home-mission-banner" id="hbtn-mission">
        <div class="home-mission-banner__left">
          <div class="home-mission-banner__eyebrow">✍️ 이번 주 삼행시 챌린지</div>
          <div class="home-mission-banner__word">${escHtml(weeklyWord)}</div>
          <div class="home-mission-banner__desc">제시어로 삼행시 왕좌에 도전해보세요</div>
        </div>
        <div class="home-mission-banner__right">
          <button class="btn btn--primary btn--sm" id="hbtn-acrostic">도전하기</button>
          <div class="home-mission-banner__more" id="hbtn-mission-link">미션 더보기 →</div>
        </div>
      </div>`;

    /* ── 카테고리 카드 ── */
    const catsHTML = `
      <div class="home-section-header">
        <span class="home-section-title">3가지 카테고리</span>
      </div>
      <div class="home-cat-grid">
        ${CATEGORIES.map(c => `
          <div class="home-cat-card" data-cat="${c.key}" style="--cat-color:${c.color}">
            <div class="home-cat-card__icon">${c.icon}</div>
            <div class="home-cat-card__label">${c.label}</div>
            <div class="home-cat-card__desc">${c.desc}</div>
            <div class="home-cat-card__count">${c.types.length}가지 게임</div>
          </div>`).join('')}
      </div>`;

    /* ── 빠른 시작 ── */
    const quickHTML = `
      <div class="home-section-header">
        <span class="home-section-title">⚡ 빠른 시작</span>
        <span class="home-section-sub">유형을 골라 바로 놀이판을 만들어봐요</span>
      </div>
      <div class="home-quick-grid">
        ${QUICK_TYPES.map(t => `
          <button class="home-quick-btn" data-type-quick="${escHtml(t.key)}">
            <span class="home-quick-btn__icon">${t.icon}</span>
            <span class="home-quick-btn__label">${escHtml(t.label)}</span>
          </button>`).join('')}
      </div>`;

    /* ── 인기 글 ── */
    const hotHTML = hotPosts.length ? `
      <div class="home-section-header">
        <span class="home-section-title">🔥 지금 인기</span>
        <a class="home-section-more" id="hbtn-more-hot">더 보기 →</a>
      </div>
      <div class="home-hot-list">
        ${hotPosts.map(p => renderFeedCard(p)).join('')}
      </div>` : '';

    el.innerHTML = `
      <div class="home-dash page-enter">
        ${heroHTML}
        ${statsHTML}
        ${missionHTML}
        ${catsHTML}
        ${quickHTML}
        ${hotHTML}
      </div>`;

    /* ── 이벤트 바인딩 ── */
    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write'));
    el.querySelector('#hbtn-join')?.addEventListener('click',  () => navigate('/login'));
    el.querySelector('#hbtn-feed')?.addEventListener('click',  () => navigate('/feed'));
    el.querySelector('#hbtn-acrostic')?.addEventListener('click', () => navigate(`/write?type=acrostic&keyword=${encodeURIComponent(weeklyWord)}`));
    el.querySelector('#hbtn-mission-link')?.addEventListener('click', () => navigate('/mission'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click', (e) => { e.preventDefault(); navigate('/feed'); });

    el.querySelectorAll('[data-type-quick]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/write?type=${btn.dataset.typeQuick}`));
    });
    el.querySelectorAll('[data-cat]').forEach(card => {
      card.addEventListener('click', () => navigate('/feed'));
    });

  } catch (err) {
    console.error('[home] renderHome error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">로딩 중 오류가 발생했어요</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-reload">새로고침</button>
      </div>`;
    el.querySelector('#btn-reload')?.addEventListener('click', () => location.reload());
  }
}
