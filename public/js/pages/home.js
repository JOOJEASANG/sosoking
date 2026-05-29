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
    <section class="home-top-strip" aria-label="소소킹">
      <div class="home-top-strip__left">
        <div class="home-top-strip__brand">
          <span class="home-top-strip__crown">👑</span>
          <div>
            <div class="home-top-strip__title">소소킹</div>
            <div class="home-top-strip__sub">짧게 올리고 짧게 반응하는 모음방</div>
          </div>
        </div>
      </div>
      <button class="home-top-strip__cta" type="button" id="hbtn-write">+ 올리기</button>
    </section>

    <nav class="home-room-nav" aria-label="방 바로가기">
      <button class="home-room-btn home-room-btn--collect" type="button" data-home-write-preset="collect">
        <span class="home-room-btn__icon">📌</span>
        <span class="home-room-btn__label">모음방</span>
      </button>
      <button class="home-room-btn home-room-btn--vote" type="button" data-home-write-preset="vote">
        <span class="home-room-btn__icon">🗳️</span>
        <span class="home-room-btn__label">토론방</span>
      </button>
      <button class="home-room-btn home-room-btn--quiz" type="button" data-home-write-preset="quiz">
        <span class="home-room-btn__icon">🧠</span>
        <span class="home-room-btn__label">퀴즈방</span>
      </button>
      <button class="home-room-btn home-room-btn--drip" type="button" id="hbtn-drip">
        <span class="home-room-btn__icon">🤣</span>
        <span class="home-room-btn__label">드립방</span>
      </button>
      <button class="home-room-btn home-room-btn--feed" type="button" id="hbtn-feed">
        <span class="home-room-btn__icon">📋</span>
        <span class="home-room-btn__label">전체보기</span>
      </button>
    </nav>

    <section class="home-room-cards" aria-label="방 소개">
      <button class="home-room-card home-room-card--collect" type="button" data-home-write-preset="collect">
        <span class="home-room-card__icon">📌</span>
        <div class="home-room-card__body">
          <b>모음방</b>
          <em>유튜브·이미지·링크를 짧게 모아요</em>
        </div>
        <span class="home-room-card__arrow">→</span>
      </button>
      <button class="home-room-card home-room-card--vote" type="button" data-home-write-preset="vote">
        <span class="home-room-card__icon">🗳️</span>
        <div class="home-room-card__body">
          <b>토론방</b>
          <em>선택지로 빠르게 의견을 모아요</em>
        </div>
        <span class="home-room-card__arrow">→</span>
      </button>
      <button class="home-room-card home-room-card--quiz" type="button" data-home-write-preset="quiz">
        <span class="home-room-card__icon">🧠</span>
        <div class="home-room-card__body">
          <b>퀴즈방</b>
          <em>짧은 문제를 보고 바로 맞혀요</em>
        </div>
        <span class="home-room-card__arrow">→</span>
      </button>
      <button class="home-room-card home-room-card--drip" type="button" id="hbtn-drip2">
        <span class="home-room-card__icon">🤣</span>
        <div class="home-room-card__body">
          <b>드립방</b>
          <em>제목 없이 한줄만 올리는 공간</em>
        </div>
        <span class="home-room-card__arrow">→</span>
      </button>
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
    setMeta('소소킹 · 짧게 모아보는 유튜브·그림·퀴즈·드립방');
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

    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write?type=multi&preset=collect'));
    el.querySelector('#hbtn-feed')?.addEventListener('click', () => navigate('/feed'));
    el.querySelector('#hbtn-drip')?.addEventListener('click', () => navigate('/drip'));
    el.querySelector('#hbtn-drip2')?.addEventListener('click', () => navigate('/drip'));
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
