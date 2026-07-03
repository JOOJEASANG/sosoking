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
  multi: '참여',
  general: '판결',
  anonymous: '참여',
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
  if (post.typeLabel) return String(post.typeLabel).replace(/게임/g, '참여');
  if (post.subtype && TYPE_LABEL[post.subtype]) return TYPE_LABEL[post.subtype];
  const m = post.modules || {};
  if (m.consult?.enabled) return '상담';
  if (m.drip?.enabled) return '드립';
  if (m.vote?.enabled) return m.vote.voteMode === 'judgment' ? '판결' : '토론';
  if (m.quiz?.enabled) return '상담';
  if (post.feedType && TYPE_LABEL[post.feedType]) return TYPE_LABEL[post.feedType];
  if (post.type !== 'multi') return TYPE_LABEL[post.type] || '참여';
  return '참여';
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

const CONTENT_ROOMS = [
  { key: 'judgment', icon: '⚖️', title: '판결', desc: '사소한 사건을 캐릭터에게 판정받기', nav: 'write-judgment' },
  { key: 'consult', icon: '🫠', title: '상담', desc: '웃기지만 은근 쓸모 있는 고민 상담', nav: 'write-consult' },
  { key: 'vote', icon: '🗳️', title: '토론', desc: '찬성·반대 의견으로 가볍게 나누기', nav: 'write-vote' },
  { key: 'drip', icon: '😂', title: '드립', desc: '한 줄 드립으로 댓글놀이 하기', nav: 'write-drip' },
];

function renderIntro() {
  const residents = getPublicAiResidents().slice(0, 8);
  return `
    <style>
      .home-ai-residents {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
        gap:10px;
        margin-top:14px;
      }
      .home-ai-resident-card {
        padding:12px;
        border-radius:16px;
        background:rgba(255,255,255,.86);
        border:1px solid rgba(148,163,184,.24);
        box-shadow:0 10px 24px rgba(15,23,42,.06);
      }
      .home-ai-resident-card__name {
        font-size:13px;
        font-weight:950;
        color:#111827;
        display:flex;
        gap:6px;
        align-items:center;
      }
      .home-ai-resident-card__emoji { font-size:18px; }
      .home-ai-resident-card__role {
        font-size:11px;
        font-weight:850;
        color:#64748b;
        margin-top:4px;
      }
      .home-ai-resident-card__desc {
        font-size:11px;
        color:#475569;
        margin-top:5px;
        line-height:1.4;
      }
      [data-theme="dark"] .home-ai-resident-card,
      html.dark .home-ai-resident-card,
      html[data-theme="dark"] .home-ai-resident-card {
        background:#20283b;
        border-color:rgba(255,255,255,.09);
        box-shadow:0 12px 28px rgba(0,0,0,.22);
      }
      [data-theme="dark"] .home-ai-resident-card__name,
      html.dark .home-ai-resident-card__name,
      html[data-theme="dark"] .home-ai-resident-card__name {
        color:#f8fafc;
      }
      [data-theme="dark"] .home-ai-resident-card__role,
      html.dark .home-ai-resident-card__role,
      html[data-theme="dark"] .home-ai-resident-card__role {
        color:#cbd5e1;
      }
      [data-theme="dark"] .home-ai-resident-card__desc,
      html.dark .home-ai-resident-card__desc,
      html[data-theme="dark"] .home-ai-resident-card__desc {
        color:#aeb8cc;
      }
    </style>
    <section class="home-onboard">
      <div class="home-onboard__hero">
        <div class="home-onboard__hero-text">
          <div class="home-onboard__badge">✨ AI CHARACTER COMMUNITY</div>
          <h1 class="home-onboard__title">판결 · 상담 · 토론 · 드립<br>4가지로 놀아요</h1>
          <p class="home-onboard__desc">사소한 이야기도 8명의 AI 캐릭터가 끼어들면 재미있는 참여 콘텐츠가 됩니다.</p>
        </div>
        <div class="home-onboard__hero-actions">
          <button class="home-onboard__btn-primary" type="button" id="hbtn-write">+ 글 열기</button>
          <button class="home-onboard__btn-ghost" type="button" id="hbtn-feed">둘러보기</button>
        </div>
      </div>

      <div class="home-onboard__rooms" aria-label="참여 유형 안내">
        ${CONTENT_ROOMS.map(room => `
          <a class="home-onboard__room home-onboard__room--${room.key}" href="#/write?type=multi&preset=${room.key}" data-room-nav="${room.nav}">
            <span class="home-onboard__room-icon">${room.icon}</span>
            <div class="home-onboard__room-info">
              <b>${escHtml(room.title)}</b>
              <em>${escHtml(room.desc)}</em>
            </div>
          </a>`).join('')}
      </div>

      <div class="home-ai-residents" aria-label="AI 캐릭터 소개">
        ${residents.map(r => `
          <div class="home-ai-resident-card">
            <div class="home-ai-resident-card__name"><span class="home-ai-resident-card__emoji">${r.emoji}</span>${escHtml(r.name)}</div>
            <div class="home-ai-resident-card__role">${escHtml(r.role)}</div>
            <div class="home-ai-resident-card__desc">${escHtml((r.catchphrases || ['']).slice(0, 1)[0])}</div>
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
    setMeta('소소킹 · AI 캐릭터 참여 커뮤니티');
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
          <span class="home-section-title">🔥 인기 콘텐츠</span>
          <button class="home-section-more home-section-more--button" id="hbtn-more-hot">더 보기</button>
        </div>
        <div class="home-rank-list">
          ${hotPosts.length
            ? hotPosts.map(renderPopularPost).join('')
            : '<div class="empty-state"><div class="empty-state__title">아직 인기 콘텐츠가 없어요</div></div>'}
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
