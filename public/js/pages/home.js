/* home.js — 회원/접속자 관점의 간결한 홈 */
import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchHotPosts } from '../services/feed-service.js';
import {
  collection, query, orderBy, limit, getDocs,
  getCountFromServer, where, doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

const FEATURE_CARDS = [
  { icon:'🧩', title:'피드 참여', desc:'투표, 빈칸 채우기, 작명, 삼행시, 퀴즈, 댓글로 바로 참여합니다.', path:'/feed' },
  { icon:'✍️', title:'피드 만들기', desc:'사진과 글을 올리고 사람들이 참여할 놀이형 글을 만들 수 있습니다.', path:'/write?type=multi' },
  { icon:'🎮', title:'소소랜드', desc:'가볍게 즐기는 실시간 게임과 놀이방입니다.', path:'/sosoland' },
];

const WRITE_CHIPS = [
  { icon:'📝', label:'일반글', path:'/write?type=multi' },
  { icon:'🗳️', label:'투표/판정', path:'/write?type=multi&preset=vote' },
  { icon:'🧩', label:'빈칸 채우기', path:'/write?type=multi&preset=fill' },
  { icon:'😜', label:'미친작명소', path:'/write?type=multi&preset=naming' },
  { icon:'✍️', label:'삼행시', path:'/write?type=multi&preset=acrostic' },
  { icon:'🎭', label:'막장릴레이', path:'/write?type=multi&preset=relay' },
  { icon:'🧠', label:'미친퀴즈', path:'/write?type=multi&preset=quiz' },
];

const TYPE_LABEL = {
  multi:'일반글', general:'일반글', vote:'투표/판정', ox:'투표/판정', crazy_court:'투표/판정',
  fill:'빈칸 채우기', naming:'미친작명소', acrostic:'삼행시', quiz:'미친퀴즈', initial_game:'미친퀴즈',
  relay:'막장릴레이', anonymous:'일반글', balance:'투표/판정', battle:'투표/판정',
};

function getKstDateString(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function checkStreak(uid) {
  try {
    const today = getKstDateString();
    const yesterday = getKstDateString(new Date(Date.now() - 86400000));
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
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
    const [totalSnap, todaySnap, gameSnap] = await Promise.all([
      getCountFromServer(collection(db, 'feeds')),
      getCountFromServer(query(collection(db, 'feeds'), where('createdAt', '>=', new Date(new Date().setHours(0, 0, 0, 0))))),
      getCountFromServer(collection(db, 'game_rooms')).catch(() => null),
    ]);
    return { total: totalSnap.data().count, today: todaySnap.data().count, games: gameSnap?.data?.().count || 0 };
  } catch { return { total: 0, today: 0, games: 0 }; }
}

async function fetchRecentPosts(n = 6) {
  try {
    const q = query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n + 8));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden).slice(0, n);
  } catch { return []; }
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

function moduleLabel(post) {
  const m = post.modules || {};
  if (m.fill?.enabled) return '빈칸 채우기';
  if (m.naming?.enabled) return '미친작명소';
  if (m.acrostic?.enabled) return '삼행시';
  if (m.relay?.enabled) return '막장릴레이';
  if (m.quiz?.enabled) return '미친퀴즈';
  if (m.vote?.enabled) return '투표/판정';
  if (post.subtype && TYPE_LABEL[post.subtype]) return TYPE_LABEL[post.subtype];
  if (post.type !== 'multi') return TYPE_LABEL[post.type] || '피드 글';
  return '일반글';
}

function renderCompactPost(post) {
  return `
    <button class="home-compact-feed-item" type="button" data-id="${post.id}">
      <span class="home-compact-feed-item__badge">${escHtml(moduleLabel(post))}</span>
      <span class="home-compact-feed-item__title">${escHtml(post.title || '제목 없음')}</span>
      <span class="home-compact-feed-item__meta">${formatTime(post.createdAt?.toDate?.() || post.createdAt)} · 💬 ${Number(post.commentCount || 0)}</span>
    </button>`;
}

export async function renderHome() {
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="home-dash page-enter">
      <div class="skeleton" style="height:180px;border-radius:22px"></div>
      <div class="home-stat-row">${[1,2,3].map(()=>`<div class="skeleton" style="height:78px;border-radius:16px"></div>`).join('')}</div>
      <div class="skeleton" style="height:120px;border-radius:18px"></div>
    </div>`;

  try {
    setMeta('소소킹 · 피드와 게임');
    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [stats, hotPosts, recentPosts] = await Promise.all([fetchStats(), fetchHotPosts(5), fetchRecentPosts(6)]);
    const streak = appState.streak || 0;
    const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '';

    const heroHTML = `
      <section class="home-hero home-hero--clean">
        ${user && streak > 1 ? `<div class="home-hero__streak">🔥 ${streak}일 연속 출석 중</div>` : ''}
        <div class="home-hero__badge">소소킹</div>
        <h1 class="home-hero__title">${user ? `${escHtml(nickname)}님, 오늘은 뭐 하고 놀까요?` : '짧게 보고, 바로 참여하는 놀이형 피드'}</h1>
        <p class="home-hero__sub">투표/판정, 빈칸 채우기, 작명, 삼행시, 퀴즈, 댓글 토론까지 한 곳에서 가볍게 즐깁니다.</p>
        <div class="home-hero__actions">
          <button class="btn btn--primary" id="hbtn-feed">피드 둘러보기</button>
          <button class="btn btn--ghost home-hero__ghost-btn" id="hbtn-write">피드 만들기</button>
        </div>
      </section>`;

    const statsHTML = `
      <div class="home-stat-row">
        <div class="home-stat-card"><div class="home-stat-card__num">${fmtNum(stats.total)}</div><div class="home-stat-card__label">전체 피드</div></div>
        <div class="home-stat-card"><div class="home-stat-card__num">${fmtNum(stats.today)}</div><div class="home-stat-card__label">오늘 새 글</div></div>
        <div class="home-stat-card"><div class="home-stat-card__num">${fmtNum(stats.games)}</div><div class="home-stat-card__label">게임방</div></div>
      </div>`;

    const featureHTML = `
      <div class="home-feature-grid home-feature-grid--compact">
        ${FEATURE_CARDS.map(card => `
          <button class="home-feature-card" data-home-path="${card.path}">
            <span class="home-feature-card__icon">${card.icon}</span>
            <span class="home-feature-card__body"><b>${card.title}</b><small>${card.desc}</small></span>
            <span class="home-feature-card__arrow">›</span>
          </button>`).join('')}
      </div>`;

    const writeHTML = `
      <div class="home-section-header home-section-header--compact">
        <span class="home-section-title">바로 만들기</span>
        <button class="home-section-more home-section-more--button" id="hbtn-write-all">전체 글쓰기</button>
      </div>
      <div class="home-write-chip-row">
        ${WRITE_CHIPS.map(chip => `<button class="home-write-chip" data-home-path="${chip.path}">${chip.icon} ${chip.label}</button>`).join('')}
      </div>`;

    const rankHTML = hotPosts.length ? `
      <div class="home-section-header">
        <span class="home-section-title">지금 반응 좋은 피드</span>
        <button class="home-section-more home-section-more--button" id="hbtn-more-hot">피드 보기</button>
      </div>
      <div class="home-rank-list">
        ${hotPosts.map((p, i) => `
          <div class="home-rank-item" data-id="${p.id}">
            <div class="home-rank-item__num home-rank-item__num--${i < 3 ? i+1 : 'rest'}">${i + 1}</div>
            <div class="home-rank-item__body"><div class="home-rank-item__type">${moduleLabel(p)}</div><div class="home-rank-item__title">${escHtml(p.title || '제목 없음')}</div></div>
            <div class="home-rank-item__stats">${p.reactions?.total ? `<span>❤️ ${p.reactions.total}</span>` : ''}${p.commentCount ? `<span>💬 ${p.commentCount}</span>` : ''}</div>
          </div>`).join('')}
      </div>` : '';

    const recentHTML = recentPosts.length ? `
      <div class="home-section-header">
        <span class="home-section-title">최근 올라온 피드</span>
        <button class="home-section-more home-section-more--button" id="hbtn-more-recent">더 보기</button>
      </div>
      <div class="home-compact-feed-list">${recentPosts.map(renderCompactPost).join('')}</div>` : '';

    el.innerHTML = `<div class="home-dash page-enter home-dash--clean">${heroHTML}${statsHTML}${featureHTML}${writeHTML}${rankHTML}${recentHTML}</div>`;

    el.querySelector('#hbtn-feed')?.addEventListener('click', () => navigate('/feed'));
    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write?type=multi'));
    el.querySelector('#hbtn-write-all')?.addEventListener('click', () => navigate('/write?type=multi'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click', () => navigate('/feed?sort=popular'));
    el.querySelector('#hbtn-more-recent')?.addEventListener('click', () => navigate('/feed'));
    el.querySelectorAll('[data-home-path]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.homePath)));
    el.querySelectorAll('[data-id]').forEach(item => item.addEventListener('click', () => navigate(`/detail/${item.dataset.id}`)));
  } catch (err) {
    console.error('[home] renderHome error', err);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">홈을 불러오지 못했어요</div>
        <div class="empty-state__desc">잠시 후 다시 시도해주세요.</div>
        <button class="btn btn--primary" style="margin-top:16px" id="btn-reload">다시 불러오기</button>
      </div>`;
    el.querySelector('#btn-reload')?.addEventListener('click', () => location.reload());
  }
}
