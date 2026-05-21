/* home.js */
import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchHotPosts } from '../services/feed-service.js';
import {
  collection, query, orderBy, limit, getDocs,
  doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

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
    const today     = getKstDateString();
    const yesterday = getKstDateString(new Date(Date.now() - 86400000));
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

async function fetchRecentPosts(n = 8) {
  try {
    const q    = query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n + 8));
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
  if (m.fill?.enabled)     return '빈칸 채우기';
  if (m.naming?.enabled)   return '미친작명소';
  if (m.acrostic?.enabled) return '삼행시';
  if (m.relay?.enabled)    return '막장릴레이';
  if (m.quiz?.enabled)     return '미친퀴즈';
  if (m.vote?.enabled)     return '투표/판정';
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
    <div class="home-dash page-enter home-dash--v2">
      <div class="skeleton" style="height:88px;border-radius:22px"></div>
      <div class="skeleton" style="height:260px;border-radius:18px;margin-top:4px"></div>
      <div class="skeleton" style="height:200px;border-radius:18px"></div>
    </div>`;

  try {
    setMeta('소소킹 · 피드와 게임');
    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [hotPosts, recentPosts] = await Promise.all([fetchHotPosts(5), fetchRecentPosts(8)]);
    const streak   = appState.streak || 0;
    const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '';

    const greetingHTML = `
      <div class="home-greeting">
        <div class="home-greeting__left">
          ${streak > 1 ? `<div class="home-greeting__streak">🔥 ${streak}일 연속 출석 중</div>` : ''}
          <div class="home-greeting__name">
            ${user ? `${escHtml(nickname)}님, 반가워요 👋` : '소소킹에 오신 걸 환영해요 👋'}
          </div>
          <div class="home-greeting__sub">투표 · 작명 · 삼행시 · 퀴즈 · 빈칸 채우기</div>
        </div>
        <button class="btn btn--primary btn--sm home-greeting__write" id="hbtn-write">+ 글쓰기</button>
      </div>`;

    const hotHTML = hotPosts.length ? `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🔥 지금 인기</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-hot">더 보기</button>
        </div>
        <div class="home-rank-list">
          ${hotPosts.map((p, i) => `
            <div class="home-rank-item" data-id="${p.id}">
              <div class="home-rank-item__num home-rank-item__num--${i < 3 ? i + 1 : 'rest'}">${i + 1}</div>
              <div class="home-rank-item__body">
                <div class="home-rank-item__type">${moduleLabel(p)}</div>
                <div class="home-rank-item__title">${escHtml(p.title || '제목 없음')}</div>
              </div>
              <div class="home-rank-item__stats">
                ${p.reactions?.total ? `<span>❤️ ${fmtNum(p.reactions.total)}</span>` : ''}
                ${p.commentCount    ? `<span>💬 ${fmtNum(p.commentCount)}</span>`    : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>` : '';

    const recentHTML = recentPosts.length ? `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🕐 최근 피드</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-recent">피드 가기</button>
        </div>
        <div class="home-compact-feed-list">${recentPosts.map(renderCompactPost).join('')}</div>
      </div>` : '';

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2">${greetingHTML}${hotHTML}${recentHTML}</div>`;

    el.querySelector('#hbtn-write')?.addEventListener('click',        () => navigate('/write?type=multi'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click',     () => navigate('/feed?sort=popular'));
    el.querySelector('#hbtn-more-recent')?.addEventListener('click',  () => navigate('/feed'));
    el.querySelectorAll('[data-id]').forEach(item =>
      item.addEventListener('click', () => navigate(`/detail/${item.dataset.id}`))
    );
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
