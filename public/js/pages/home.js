/* home.js — 홈 피드 페이지 (새 단일 컬럼 레이아웃) */
import { auth, db } from '../firebase.js';
import { fetchHotPosts } from '../services/feed-service.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
  where, Timestamp, getDoc, doc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

/* ── 게임 타입 퀵필 ── */
const QUICK_TYPES = [
  { key: 'balance',      icon: '⚖️', label: '밸런스게임' },
  { key: 'vote',         icon: '🗳️', label: '민심투표'   },
  { key: 'naming',       icon: '😜', label: '미친작명소' },
  { key: 'acrostic',     icon: '✍️', label: '삼행시짓기' },
  { key: 'drip',         icon: '🎤', label: '한줄드립'   },
  { key: 'ox',           icon: '❓', label: 'OX퀴즈'     },
  { key: 'random_battle',icon: '🎰', label: '랜덤대결'   },
  { key: 'relay',        icon: '🎭', label: '막장릴레이' },
];

/* ── 출석 스트릭 갱신 (non-blocking) ── */
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

/* ── 최신 글 조회 ── */
async function fetchRecentPosts(n = 10) {
  try {
    const q = query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n + 5));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden).slice(0, n);
  } catch { return []; }
}

/* ── 빈 피드 ── */
function emptyFeedHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🌱</div>
      <div class="empty-state__title">아직 글이 없어요</div>
      <div class="empty-state__desc">첫 번째 놀이판의 주인공이 되어보세요!</div>
      <button class="btn btn--primary" style="margin-top:16px" id="btn-first-write">첫 글 올리기</button>
    </div>`;
}

/* ── 메인 렌더 ── */
export async function renderHome() {
  const el = document.getElementById('page-content');
  if (!el) return;

  /* 스켈레톤 */
  el.innerHTML = `
    <div class="home-layout page-enter">
      <div class="home-pills-scroll">
        ${Array.from({ length: 8 }, () =>
          `<div class="skeleton" style="width:90px;height:36px;border-radius:999px;flex-shrink:0"></div>`
        ).join('')}
      </div>
      <div style="margin-top:28px">${renderSkeletonCards(3)}</div>
      <div style="margin-top:28px">${renderSkeletonCards(5)}</div>
    </div>`;

  try {
    setMeta();

    const user = auth.currentUser;
    /* 스트릭은 UI를 블로킹하지 않음 */
    if (user) checkStreak(user.uid);

    /* 병렬 데이터 페치 */
    const [hotPosts, recentPosts] = await Promise.all([
      fetchHotPosts(5),
      fetchRecentPosts(10),
    ]);

    /* 스트릭 배너 */
    const streak = appState.streak || 0;
    const streakBanner = (user && streak > 0)
      ? `<div class="home-streak-banner">🔥 ${streak}일 연속 출석 중!</div>`
      : '';

    /* 퀵타입 필 */
    const pillsHTML = QUICK_TYPES.map(t => `
      <button class="home-type-pill" data-type-quick="${escHtml(t.key)}" aria-label="${escHtml(t.label)} 놀이판 만들기">
        <span>${t.icon}</span>
        <span>${escHtml(t.label)}</span>
      </button>`).join('');

    /* 인기글 섹션 */
    const hotHTML = hotPosts.length
      ? hotPosts.map(p => renderFeedCard(p)).join('')
      : emptyFeedHTML();

    /* 최신글 섹션 */
    const recentHTML = recentPosts.length
      ? recentPosts.map(p => renderFeedCard(p)).join('')
      : emptyFeedHTML();

    el.innerHTML = `
      <div class="home-layout page-enter">

        ${streakBanner}

        <!-- ── 게임 타입 퀵필 ── -->
        <div class="home-pills-scroll" role="list" aria-label="게임 유형 선택">
          ${pillsHTML}
        </div>

        <!-- ── 🔥 지금 인기 ── -->
        <section class="home-section" aria-label="지금 인기">
          <div class="home-section__header">
            <h2 class="home-section__title">🔥 지금 인기</h2>
          </div>
          <div id="home-hot-list">
            ${hotHTML}
          </div>
        </section>

        <!-- ── ✨ 최신 글 ── -->
        <section class="home-section" aria-label="최신 글">
          <div class="home-section__header">
            <h2 class="home-section__title">✨ 최신 글</h2>
            <a href="#/feed" class="home-section__more">더 보기 →</a>
          </div>
          <div id="home-recent-list">
            ${recentHTML}
          </div>
        </section>

      </div>`;

    /* ── 이벤트 ── */
    el.querySelectorAll('[data-type-quick]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/write?type=${btn.dataset.typeQuick}`));
    });

    el.querySelector('#btn-first-write')?.addEventListener('click', () => navigate('/write'));

    el.querySelector('.home-section__more')?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/feed');
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
