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
  collect: '모음방',
  multi: '모음방',
  general: '모음방',
  anonymous: '모음방',
  vote: '토론방',
  ox: '토론방',
  crazy_court: '토론방',
  balance: '토론방',
  battle: '토론방',
  drip: '드립방',
  cbattle: '드립방',
  quiz: '퀴즈방',
  initial_game: '퀴즈방',
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
  if (m.collect?.enabled) return m.collect.label || '모음방';
  if (m.vote?.enabled) return '토론방';
  if (m.drip?.enabled) return '드립방';
  if (m.quiz?.enabled) return '퀴즈방';
  if (post.subtype && TYPE_LABEL[post.subtype]) return TYPE_LABEL[post.subtype];
  if (post.type !== 'multi') return TYPE_LABEL[post.type] || '모음방';
  return '모음방';
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
          <small>짧은 모음방</small>
        </div>
        <h1>쇼츠처럼 짧게 보고<br>웃긴 것만 모아보는 곳.</h1>
        <p>유튜브, 웃긴그림, 퀴즈, 토론, 오늘의 한줄을 방별로 모읍니다. 길게 쓰는 게시판보다 짧게 올리고 짧게 반응하는 소소한 모음 서비스입니다.</p>
        <div class="home-landing-hero__actions">
          <button class="home-landing-hero__primary" type="button" id="hbtn-write">바로 올리기</button>
          <button class="home-landing-hero__secondary" type="button" id="hbtn-feed">모음 둘러보기</button>
        </div>
        <div class="home-landing-hero__chips" aria-label="소소킹 방 구성">
          <span>📌 모음방</span>
          <span>🗳️ 토론방</span>
          <span>🧠 퀴즈방</span>
          <span>🤣 드립방</span>
        </div>
      </div>
      <div class="home-landing-hero__mock" aria-hidden="true">
        <div class="home-mock-card home-mock-card--main">
          <div class="home-mock-card__top"><span>오늘의 웃긴 쇼츠</span><b>SHORT</b></div>
          <strong>3초 보고 피식하는 영상 모음</strong>
          <div class="home-mock-vote"><span style="width:72%">웃김 72%</span></div>
          <div class="home-mock-vote home-mock-vote--sub"><span style="width:44%">저장각 44%</span></div>
        </div>
        <div class="home-mock-card home-mock-card--float home-mock-card--drip">🤣 오늘의 한줄</div>
        <div class="home-mock-card home-mock-card--float home-mock-card--quiz">🧠 짧은 퀴즈</div>
      </div>
    </section>

    <section class="home-feature-panel" aria-label="소소킹 방 바로가기">
      <div class="home-feature-panel__head">
        <div>
          <span>방별로 짧게 모아보기</span>
          <h2>일반글은 줄이고, 바로 볼 수 있는 콘텐츠만 남깁니다.</h2>
        </div>
      </div>
      <div class="home-feature-grid home-feature-grid--rooms">
        <button class="home-feature-card home-feature-card--vote" type="button" data-home-write-preset="collect">
          <span class="home-feature-card__icon">📌</span>
          <b>모음방</b>
          <em>유튜브 쇼츠, 웃긴그림, 링크를 짧게 모아 올립니다.</em>
          <small>모음 올리기 →</small>
        </button>
        <button class="home-feature-card home-feature-card--vote" type="button" data-home-write-preset="vote">
          <span class="home-feature-card__icon">🗳️</span>
          <b>토론방</b>
          <em>찬성/반대, 밸런스 선택지로 바로 의견을 모읍니다.</em>
          <small>토론 만들기 →</small>
        </button>
        <button class="home-feature-card home-feature-card--quiz" type="button" data-home-write-preset="quiz">
          <span class="home-feature-card__icon">🧠</span>
          <b>퀴즈방</b>
          <em>짧은 문제를 올리고 사람들이 바로 맞힙니다.</em>
          <small>퀴즈 만들기 →</small>
        </button>
        <button class="home-feature-card home-feature-card--drip" type="button" data-home-write-preset="drip">
          <span class="home-feature-card__icon">🤣</span>
          <b>드립방</b>
          <em>제목 없이 오늘의 한줄만 리스트로 올립니다.</em>
          <small>한줄 올리기 →</small>
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
    setMeta('소소킹 · 짧게 모아보는 유튜브·그림·퀴즈·드립방');
    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [hotPosts, popularComments] = await Promise.all([
      fetchHotPosts(8),
      fetchPopularComments(8),
    ]);

    const hotHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">🔥 최근 인기 모음</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-hot">더 보기</button>
        </div>
        <div class="home-rank-list">
          ${hotPosts.length
            ? hotPosts.map(renderPopularPost).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 모음이 없어요</div></div>'}
        </div>
      </div>`;

    const commentsHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">💬 최근 반응 댓글</span>
        </div>
        <div class="home-compact-feed-list">
          ${popularComments.length
            ? popularComments.map(renderPopularComment).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 댓글이 없어요</div></div>'}
        </div>
      </div>`;

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2">${renderIntro()}${hotHTML}${commentsHTML}</div>`;

    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write?type=multi&preset=collect'));
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
        <button class="btn btn--primary" style="margin-top:16px" id="btn-reload">다시 불러오기</button>
      </div>`;
    el.querySelector('#btn-reload')?.addEventListener('click', () => location.reload());
  }
}
