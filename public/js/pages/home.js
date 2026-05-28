/* home.js */
import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchHotPosts } from '../services/feed-service.js';
import {
  collection, collectionGroup, query, orderBy, limit, getDocs,
  doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

const TYPE_LABEL = {
  multi: '일반',
  general: '일반',
  vote: '투표',
  ox: '투표',
  crazy_court: '투표',
  balance: '투표',
  battle: '투표',
  naming: '일반',
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

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

function commentScore(comment) {
  const r = comment.reactions || {};
  return Number(r.funny || 0) * 3 + Number(r.fire || 0) * 2 + Number(r.like || 0) + Number(comment.likes || 0);
}

function moduleLabel(post) {
  const m = post.modules || {};
  if (m.vote?.enabled) return '투표';
  if (m.drip?.enabled) return '드립';
  if (m.quiz?.enabled) return '퀴즈';
  if (post.subtype && TYPE_LABEL[post.subtype]) return TYPE_LABEL[post.subtype];
  if (post.type !== 'multi') return TYPE_LABEL[post.type] || '일반';
  return '일반';
}

async function fetchPopularComments(n = 8) {
  try {
    const q = query(collectionGroup(db, 'comments'), orderBy('createdAt', 'desc'), limit(80));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          postId: d.ref.parent?.parent?.id || data.postId || '',
          ...data,
          _score: commentScore(data),
        };
      })
      .filter(c => c.text && c.postId && !c.hidden)
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        const bt = b.createdAt?.toMillis?.() || 0;
        const at = a.createdAt?.toMillis?.() || 0;
        return bt - at;
      })
      .slice(0, n);
  } catch (error) {
    console.warn('[home] popular comments failed', error);
    return [];
  }
}

function renderIntro() {
  return `
    <section class="home-landing-hero" aria-label="소소킹 소개">
      <div class="home-landing-hero__bg home-landing-hero__bg--one"></div>
      <div class="home-landing-hero__bg home-landing-hero__bg--two"></div>
      <div class="home-landing-hero__content">
        <div class="home-landing-hero__badge">
          <span>👑</span>
          <b>SOSOKING</b>
          <small>10초 참여 피드</small>
        </div>
        <h1>소소한 질문 하나로<br>투표하고, 드립치고, 퀴즈까지.</h1>
        <p>긴 글보다 짧은 반응이 어울리는 곳. 사진, 상황, 질문을 올리고 사람들이 바로 선택하고 댓글로 참여하는 가벼운 소통 공간입니다.</p>
        <div class="home-landing-hero__actions">
          <button class="home-landing-hero__primary" type="button" id="hbtn-write">바로 글쓰기</button>
          <button class="home-landing-hero__secondary" type="button" id="hbtn-feed">피드 둘러보기</button>
        </div>
        <div class="home-landing-hero__chips" aria-label="소소킹 사용 방식">
          <span>🗳️ 투표</span>
          <span>🤣 한줄드립</span>
          <span>🧠 퀴즈</span>
          <span>💬 댓글반응</span>
        </div>
      </div>
      <div class="home-landing-hero__mock" aria-hidden="true">
        <div class="home-mock-card home-mock-card--main">
          <div class="home-mock-card__top"><span>오늘의 소소질문</span><b>LIVE</b></div>
          <strong>친구 사이 돈거래, 가능?</strong>
          <div class="home-mock-vote"><span style="width:62%">가능 62%</span></div>
          <div class="home-mock-vote home-mock-vote--sub"><span style="width:38%">불가능 38%</span></div>
        </div>
        <div class="home-mock-card home-mock-card--float home-mock-card--drip">🤣 한줄드립 대기중</div>
        <div class="home-mock-card home-mock-card--float home-mock-card--quiz">🧠 퀴즈 정답률 74%</div>
      </div>
    </section>

    <section class="home-feature-panel" aria-label="소소킹 특별 기능">
      <div class="home-feature-panel__head">
        <div>
          <span>소소킹만의 참여 방식</span>
          <h2>게시판만 보이지 않게, 바로 참여할 판을 만듭니다.</h2>
        </div>
      </div>
      <div class="home-feature-grid">
        <button class="home-feature-card home-feature-card--vote" type="button" data-home-write-preset="vote">
          <span class="home-feature-card__icon">🗳️</span>
          <b>소소투표</b>
          <em>찬성/반대, 밸런스 선택지를 바로 붙여 의견을 모읍니다.</em>
          <small>투표 만들기 →</small>
        </button>
        <button class="home-feature-card home-feature-card--drip" type="button" data-home-write-preset="drip">
          <span class="home-feature-card__icon">🤣</span>
          <b>한줄드립</b>
          <em>사진이나 상황을 올리고 짧은 드립 댓글을 받습니다.</em>
          <small>드립 주제 만들기 →</small>
        </button>
        <button class="home-feature-card home-feature-card--quiz" type="button" data-home-write-preset="quiz">
          <span class="home-feature-card__icon">🧠</span>
          <b>소소퀴즈</b>
          <em>주관식/객관식 문제를 올리고 사람들이 바로 맞힙니다.</em>
          <small>퀴즈 만들기 →</small>
        </button>
      </div>
    </section>`;
}

function renderPopularPost(post, index) {
  return `
    <div class="home-rank-item" data-id="${post.id}">
      <div class="home-rank-item__num home-rank-item__num--${index < 3 ? index + 1 : 'rest'}">${index + 1}</div>
      <div class="home-rank-item__body">
        <div class="home-rank-item__type">${moduleLabel(post)}</div>
        <div class="home-rank-item__title">${escHtml(post.title || '제목 없음')}</div>
      </div>
      <div class="home-rank-item__stats">
        ${post.reactions?.total ? `<span>❤️ ${fmtNum(post.reactions.total)}</span>` : ''}
        ${post.commentCount    ? `<span>💬 ${fmtNum(post.commentCount)}</span>`    : ''}
      </div>
    </div>`;
}

function renderPopularComment(comment, index) {
  const timeStr = formatTime(comment.createdAt?.toDate?.() || comment.createdAt);
  const score = comment._score || 0;
  return `
    <button class="home-compact-feed-item" type="button" data-id="${comment.postId}">
      <span class="home-compact-feed-item__badge">댓글 ${index + 1}</span>
      <span class="home-compact-feed-item__title">${escHtml(comment.text || '').slice(0, 120)}</span>
      <span class="home-compact-feed-item__meta">${escHtml(comment.authorName || '익명')} · ${timeStr}${score ? ` · 반응 ${fmtNum(score)}` : ''}</span>
    </button>`;
}

export async function renderHome() {
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="home-dash page-enter home-dash--v2">
      <div class="skeleton" style="height:260px;border-radius:18px"></div>
      <div class="skeleton" style="height:220px;border-radius:18px"></div>
    </div>`;

  try {
    setMeta('소소킹 · 짧게 즐기는 질문과 드립 피드');
    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [hotPosts, popularComments] = await Promise.all([
      fetchHotPosts(8),
      fetchPopularComments(8),
    ]);

    const hotHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🔥 최근 인기글</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-hot">더 보기</button>
        </div>
        <div class="home-rank-list">
          ${hotPosts.length
            ? hotPosts.map(renderPopularPost).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 인기글이 없어요</div></div>'}
        </div>
      </div>`;

    const commentsHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">💬 최근 인기 댓글</span>
        </div>
        <div class="home-compact-feed-list">
          ${popularComments.length
            ? popularComments.map(renderPopularComment).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 인기 댓글이 없어요</div></div>'}
        </div>
      </div>`;

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2">${renderIntro()}${hotHTML}${commentsHTML}</div>`;

    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write?type=multi'));
    el.querySelector('#hbtn-feed')?.addEventListener('click', () => navigate('/feed'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click', () => navigate('/feed?sort=popular'));
    el.querySelectorAll('[data-home-write-preset]').forEach(item =>
      item.addEventListener('click', () => navigate(`/write?type=multi&preset=${item.dataset.homeWritePreset}`))
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
