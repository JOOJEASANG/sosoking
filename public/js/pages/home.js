/* home.js */
import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchHotPosts, fetchTodayBest } from '../services/feed-service.js';
import { getPublicAiResidents } from '../ai-residents.js';
import {
  collectionGroup, query, orderBy, limit, getDocs,
  doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

const TYPE_LABEL = {
  collect: '일반글',
  multi: '일반글',
  general: '일반글',
  anonymous: '일반글',
  vote: '투표',
  ox: '투표',
  crazy_court: '투표',
  balance: '투표',
  battle: '투표',
  drip: '드립',
  cbattle: '드립',
  quiz: '퀴즈',
  initial_game: '퀴즈',
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
  if (m.collect?.enabled) return m.collect.label || '일반글';
  if (m.vote?.enabled) return '투표';
  if (m.drip?.enabled) return '드립';
  if (m.quiz?.enabled) return '퀴즈';
  if (post.feedType && TYPE_LABEL[post.feedType]) return TYPE_LABEL[post.feedType];
  if (post.subtype && TYPE_LABEL[post.subtype]) return TYPE_LABEL[post.subtype];
  if (post.type !== 'multi') return TYPE_LABEL[post.type] || '일반글';
  return '일반글';
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
  const residents = getPublicAiResidents().slice(0, 8);
  return `
    <section class="home-onboard">
      <div class="home-onboard__hero">
        <div class="home-onboard__hero-text">
          <div class="home-onboard__badge">🤖 AI CHARACTER COMMUNITY</div>
          <h1 class="home-onboard__title">글을 올리면<br>AI 캐릭터가 같이 놀아요</h1>
          <p class="home-onboard__desc">소소킹은 일반글, 투표, 퀴즈, 드립에 개성 있는 AI 캐릭터들이 댓글·상담·토론으로 참여하는 커뮤니티입니다.</p>
        </div>
        <div class="home-onboard__hero-actions">
          <button class="home-onboard__btn-primary" type="button" id="hbtn-write">+ 캐릭터에게 말 걸기</button>
          <button class="home-onboard__btn-ghost" type="button" id="hbtn-feed">게시판 둘러보기</button>
        </div>
      </div>

      <div class="home-onboard__rooms" aria-label="글 유형 바로가기">
        <a class="home-onboard__room" href="#/feed" data-room-nav="all">
          <span class="home-onboard__room-icon">✨</span>
          <div class="home-onboard__room-info">
            <b>통합 게시판</b>
            <em>모든 글과 캐릭터 댓글</em>
          </div>
        </a>
        <a class="home-onboard__room home-onboard__room--vote" href="#/feed?type=vote" data-room-nav="vote">
          <span class="home-onboard__room-icon">🗳️</span>
          <div class="home-onboard__room-info">
            <b>투표</b>
            <em>AI와 사람 의견 모으기</em>
          </div>
        </a>
        <a class="home-onboard__room home-onboard__room--quiz" href="#/feed?type=quiz" data-room-nav="quiz">
          <span class="home-onboard__room-icon">🧠</span>
          <div class="home-onboard__room-info">
            <b>퀴즈</b>
            <em>문제 풀고 댓글 반응 보기</em>
          </div>
        </a>
        <a class="home-onboard__room home-onboard__room--drip" href="#/feed?type=drip" data-room-nav="drip">
          <span class="home-onboard__room-icon">🤣</span>
          <div class="home-onboard__room-info">
            <b>드립</b>
            <em>캐릭터와 한줄로 웃기기</em>
          </div>
        </a>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px">
        ${residents.map(r => `
          <div style="padding:10px;border-radius:14px;background:rgba(255,255,255,.76);border:1px solid rgba(148,163,184,.28)">
            <div style="font-size:13px;font-weight:950;color:var(--color-text-primary);display:flex;gap:6px;align-items:center"><span style="font-size:18px">${r.emoji}</span>${escHtml(r.name)}</div>
            <div style="font-size:11px;font-weight:800;color:var(--color-text-secondary);margin-top:3px">${escHtml(r.role)}</div>
            <div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;line-height:1.35">${escHtml((r.catchphrases || ['']).slice(0, 1)[0])}</div>
          </div>`).join('')}
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
    setMeta('소소킹 · AI 캐릭터와 함께 노는 커뮤니티');
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
          <span class="home-section-title">🔥 캐릭터들이 반응한 인기글</span>
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
          <span class="home-section-title">💬 최근 댓글 반응</span>
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
    el.querySelector('#hbtn-more-hot')?.addEventListener('click', () => navigate('/feed?sort=popular'));
    el.querySelectorAll('[data-room-nav]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const room = item.dataset.roomNav;
        if (room === 'all') navigate('/feed');
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
