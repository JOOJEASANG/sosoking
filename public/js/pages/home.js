/* home.js */
import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchHotPosts, fetchTodayBest } from '../services/feed-service.js';
import {
  collection, collectionGroup, query, orderBy, limit, getDocs,
  doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

const TYPE_LABEL = {
  tournament: '대결방',
  collect: '일반방',
  multi: '일반방',
  general: '일반방',
  anonymous: '일반방',
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
  if (m.tournament?.enabled) return '대결방';
  if (m.collect?.enabled) return m.collect.label || '일반방';
  if (m.vote?.enabled) return '토론방';
  if (m.drip?.enabled) return '드립방';
  if (m.quiz?.enabled) return '퀴즈방';
  if (post.feedType && TYPE_LABEL[post.feedType]) return TYPE_LABEL[post.feedType];
  if (post.subtype && TYPE_LABEL[post.subtype]) return TYPE_LABEL[post.subtype];
  if (post.type !== 'multi') return TYPE_LABEL[post.type] || '일반방';
  return '일반방';
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
    <section class="home-onboard">
      <div class="home-onboard__hero">
        <div class="home-onboard__hero-text">
          <div class="home-onboard__badge">👑 SOSOKING</div>
          <h1 class="home-onboard__title">짧게 올리고<br>짧게 반응하는 곳</h1>
          <p class="home-onboard__desc">토너먼트 대결·토론·퀴즈·드립을 방별로 즐겨요</p>
        </div>
        <div class="home-onboard__hero-actions">
          <button class="home-onboard__btn-primary" type="button" id="hbtn-write">+ 지금 올리기</button>
          <button class="home-onboard__btn-ghost" type="button" id="hbtn-feed">전체 둘러보기</button>
        </div>
      </div>

      <div class="home-onboard__rooms" aria-label="방 바로가기">
        <a class="home-onboard__room home-onboard__room--tournament" href="#/feed?type=tournament" data-room-nav="tournament">
          <span class="home-onboard__room-icon">⚔️</span>
          <div class="home-onboard__room-info">
            <b>대결방</b>
            <em>토너먼트 대결</em>
          </div>
        </a>
        <a class="home-onboard__room home-onboard__room--vote" href="#/feed?type=vote" data-room-nav="vote">
          <span class="home-onboard__room-icon">🗳️</span>
          <div class="home-onboard__room-info">
            <b>토론방</b>
            <em>찬반 토론·선택지 투표</em>
          </div>
        </a>
        <a class="home-onboard__room home-onboard__room--quiz" href="#/feed?type=quiz" data-room-nav="quiz">
          <span class="home-onboard__room-icon">🧠</span>
          <div class="home-onboard__room-info">
            <b>퀴즈방</b>
            <em>짧은 문제 바로 풀기</em>
          </div>
        </a>
        <a class="home-onboard__room home-onboard__room--drip" href="#/drip" data-room-nav="drip">
          <span class="home-onboard__room-icon">🤣</span>
          <div class="home-onboard__room-info">
            <b>드립방</b>
            <em>제목 없이 한줄만</em>
          </div>
        </a>
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

function renderTodayBest(post) {
  if (!post) return '';
  const label = moduleLabel(post);
  const reactions = post.reactions?.total || 0;
  const comments = post.commentCount || 0;
  return `
    <div class="home-today-best" data-id="${post.id}">
      <div class="home-today-best__label">⭐ 오늘의 베스트</div>
      <div class="home-today-best__title">${escHtml(post.title || '제목 없음')}</div>
      <div class="home-today-best__meta">
        <span class="home-today-best__room">${label}</span>
        ${reactions ? `<span>❤️ ${fmtNum(reactions)}</span>` : ''}
        ${comments  ? `<span>💬 ${fmtNum(comments)}</span>`  : ''}
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
    setMeta('소소킹 · 토너먼트 대결·퀴즈·토론·드립방');
    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [hotPosts, popularComments, todayBest] = await Promise.all([
      fetchHotPosts(8),
      fetchPopularComments(8),
      fetchTodayBest(),
    ]);

    const bestHTML = todayBest ? `
      <div class="home-section-header" style="margin-bottom:8px">
        <span class="home-section-title">⭐ 오늘의 베스트</span>
      </div>
      ${renderTodayBest(todayBest)}` : '';

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

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2">${renderIntro()}${bestHTML}${hotHTML}${commentsHTML}</div>`;

    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write?type=multi&preset=tournament'));
    el.querySelector('#hbtn-feed')?.addEventListener('click', () => navigate('/feed'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click', () => navigate('/feed?sort=popular'));
    el.querySelectorAll('[data-room-nav]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const room = item.dataset.roomNav;
        if (room === 'drip') navigate('/drip');
        else navigate(`/feed?type=${room}`);
      });
    });
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
