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
  collect: '상담',
  multi: '게임',
  general: '판결',
  anonymous: '게임',
  judgment: '판결',
  vote: '토론',
  ox: '토론',
  crazy_court: '판결',
  balance: '토론',
  battle: '토론',
  consult: '상담',
  drip: '드립',
  quiz: '상담',
  initial_game: '상담',
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
  if (post.typeLabel) return post.typeLabel;
  if (post.subtype && TYPE_LABEL[post.subtype]) return TYPE_LABEL[post.subtype];
  const m = post.modules || {};
  if (m.consult?.enabled) return '상담';
  if (m.drip?.enabled) return '드립';
  if (m.vote?.enabled) return m.vote.voteMode === 'judgment' ? '판결' : '토론';
  if (m.quiz?.enabled) return '상담';
  if (post.feedType && TYPE_LABEL[post.feedType]) return TYPE_LABEL[post.feedType];
  if (post.type !== 'multi') return TYPE_LABEL[post.type] || '게임';
  return '게임';
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

const GAME_ROOMS = [
  { key: 'judgment', icon: '⚖️', title: '판결', desc: '누가 예민한지 AI 배심원단에게 판정받기', nav: 'write-judgment' },
  { key: 'consult', icon: '🫠', title: '상담', desc: '공감·현실조언·분위기 완충까지 받기', nav: 'write-consult' },
  { key: 'vote', icon: '🗳️', title: '토론', desc: '찬성·반대·제3기준으로 가볍게 붙기', nav: 'write-vote' },
  { key: 'drip', icon: '😂', title: '드립', desc: '짧은 한 줄로 캐릭터와 유저가 이어치기', nav: 'write-drip' },
];

function renderIntro() {
  const residents = getPublicAiResidents().slice(0, 8);
  return `
    <section class="home-onboard">
      <div class="home-onboard__hero">
        <div class="home-onboard__hero-text">
          <div class="home-onboard__badge">🎭 AI CHARACTER PARTICIPATION</div>
          <h1 class="home-onboard__title">판결 · 상담 · 토론 · 드립<br>4가지 방식으로 참여해요</h1>
          <p class="home-onboard__desc">글을 올리면 8명의 AI 캐릭터가 방 성격에 맞춰 공감, 반박, 판정, 드립으로 댓글에 끼어듭니다.</p>
        </div>
        <div class="home-onboard__hero-actions">
          <button class="home-onboard__btn-primary" type="button" id="hbtn-write">+ 참여글 쓰기</button>
          <button class="home-onboard__btn-ghost" type="button" id="hbtn-feed">둘러보기</button>
        </div>
      </div>

      <div class="home-onboard__rooms" aria-label="소소킹 방 안내">
        ${GAME_ROOMS.map(room => `
          <a class="home-onboard__room home-onboard__room--${room.key}" href="#/write?type=multi&preset=${room.key}" data-room-nav="${room.nav}">
            <span class="home-onboard__room-icon">${room.icon}</span>
            <div class="home-onboard__room-info">
              <b>${escHtml(room.title)}</b>
              <em>${escHtml(room.desc)}</em>
            </div>
          </a>`).join('')}
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
    setMeta('소소킹 · 판결 상담 토론 드립 AI 캐릭터 커뮤니티');
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
          <span class="home-section-title">🔥 인기 참여글</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-hot">더 보기</button>
        </div>
        <div class="home-rank-list">
          ${hotPosts.length
            ? hotPosts.map(renderPopularPost).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 인기 참여글이 없어요</div></div>'}
        </div>
      </div>`;

    const commentsHTML = `
      <div>
        <div class="home-section-header">
          <span class="home-section-title">💬 캐릭터·유저 댓글 반응</span>
        </div>
        <div class="home-compact-feed-list">
          ${popularComments.length
            ? popularComments.map(renderPopularComment).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 댓글이 없어요</div></div>'}
        </div>
      </div>`;

    el.innerHTML = `<div class="home-dash page-enter home-dash--v2">${renderIntro()}${bestHTML}${hotHTML}${commentsHTML}</div>`;

    el.querySelector('#hbtn-write')?.addEventListener('click', () => navigate('/write?type=multi&preset=judgment'));
    el.querySelector('#hbtn-feed')?.addEventListener('click', () => navigate('/feed'));
    el.querySelector('#hbtn-more-hot')?.addEventListener('click', () => navigate('/feed?sort=popular'));
    el.querySelectorAll('[data-room-nav]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const room = item.dataset.roomNav;
        if (room === 'write-judgment') navigate('/write?type=multi&preset=judgment');
        else if (room === 'write-consult') navigate('/write?type=multi&preset=consult');
        else if (room === 'write-vote') navigate('/write?type=multi&preset=vote');
        else if (room === 'write-drip') navigate('/write?type=multi&preset=drip');
        else navigate('/feed');
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
