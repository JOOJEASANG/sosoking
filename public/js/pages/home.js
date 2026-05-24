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

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
}
function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function renderInstallBanner() {
  if (isStandalone()) return '';
  if (!appState.installPrompt && !isIOS()) return '';
  return `
    <div class="home-install-banner" id="home-install-banner">
      <span class="home-install-banner__icon">📲</span>
      <div class="home-install-banner__text">
        <b>앱으로 설치하면 더 빠르게!</b>
        <span>홈 화면에서 바로 소소킹을 열 수 있어요</span>
      </div>
      <button class="btn btn--primary btn--sm" id="home-install-btn">설치</button>
      <button class="home-install-banner__close" id="home-install-close" aria-label="닫기">×</button>
    </div>`;
}

function bindInstallBanner() {
  document.getElementById('home-install-close')?.addEventListener('click', () => {
    document.getElementById('home-install-banner')?.remove();
  });
  document.getElementById('home-install-btn')?.addEventListener('click', async () => {
    const prompt = appState.installPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        appState.installPrompt = null;
        document.getElementById('home-install-banner')?.remove();
      }
    } else if (isIOS()) {
      alert('Safari 하단 공유 버튼(⬆)을 탭한 뒤 "홈 화면에 추가"를 선택하세요.');
    }
  });
}

const TYPE_LABEL = {
  multi: '일반',
  general: '일반',
  vote: '투표',
  ox: '투표',
  crazy_court: '투표',
  balance: '투표',
  battle: '투표',
  naming: '작명',
  drip: '드립',
  cbattle: '드립',
  quiz: '퀴즈',
  initial_game: '퀴즈',
  acrostic: '행시',
  relay: '릴레이',
  anonymous: '일반',
  fill: '빈칸',
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
  if (m.vote?.enabled) return '투표';
  if (m.naming?.enabled) return '작명';
  if (m.drip?.enabled) return '드립';
  if (m.quiz?.enabled) return '퀴즈';
  if (post.subtype && TYPE_LABEL[post.subtype]) return TYPE_LABEL[post.subtype];
  if (post.type !== 'multi') return TYPE_LABEL[post.type] || '일반';
  return '일반';
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
    setMeta('소소킹 · 소소함의 재미');
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
            ${user ? `${escHtml(nickname)}님, 오늘도 소소하게 놀아볼까요?` : '소소한데 은근히 재밌는 곳, 소소킹 👋'}
          </div>
          <div class="home-greeting__sub">일반 · 투표 · 작명 · 드립 · 퀴즈로 짧게 놀고 피식 웃는 커뮤니티</div>
        </div>
        <button class="btn btn--primary btn--sm home-greeting__write" id="hbtn-write">+ 글쓰기</button>
      </div>`;

    const hotHTML = hotPosts.length ? `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🔥 지금 소소하게 뜨는 글</span>
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
          <span class="home-section-title">🕐 방금 올라온 소소한 재미</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-recent">피드 가기</button>
        </div>
        <div class="home-compact-feed-list">${recentPosts.map(renderCompactPost).join('')}</div>
      </div>` : '';

    const quickLinksHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🚀 바로가기</span>
        </div>
        <div class="home-quick-links">
          <button class="home-quick-link-card" data-nav="/write?type=multi&preset=drip">
            <span class="home-quick-link-card__icon">🤣</span>
            <span class="home-quick-link-card__label">드립</span>
            <span class="home-quick-link-card__sub">한 줄로 웃기기</span>
          </button>
          <button class="home-quick-link-card" data-nav="/write?type=multi&preset=vote">
            <span class="home-quick-link-card__icon">🗳️</span>
            <span class="home-quick-link-card__label">투표</span>
            <span class="home-quick-link-card__sub">가볍게 판정받기</span>
          </button>
          <button class="home-quick-link-card" data-nav="/write?type=multi&preset=naming">
            <span class="home-quick-link-card__icon">😜</span>
            <span class="home-quick-link-card__label">작명</span>
            <span class="home-quick-link-card__sub">웃긴 이름 붙이기</span>
          </button>
          <button class="home-quick-link-card" data-nav="/feed?sort=popular">
            <span class="home-quick-link-card__icon">🔥</span>
            <span class="home-quick-link-card__label">인기</span>
            <span class="home-quick-link-card__sub">반응 높은 글</span>
          </button>
        </div>
      </div>`;

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2">${greetingHTML}${hotHTML}${quickLinksHTML}${recentHTML}</div>`;

    el.querySelector('#hbtn-write')?.addEventListener('click',        () => navigate('/write?type=multi'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click',     () => navigate('/feed?sort=popular'));
    el.querySelector('#hbtn-more-recent')?.addEventListener('click',  () => navigate('/feed'));
    el.querySelectorAll('[data-nav]').forEach(btn =>
      btn.addEventListener('click', () => navigate(btn.dataset.nav))
    );
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