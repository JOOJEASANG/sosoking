import { db } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { fetchHotPosts, fetchTodayBest } from '../services/feed-service.js';
import { getPublicAiResidents } from '../ai-residents.js';
import { collectionGroup, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

const COMMUNITY_ROOMS = [
  { key: 'judgment', icon: '⚖️', title: '판결', desc: '사소한 갈등을 AI 캐릭터와 회원에게 판정받아요.' },
  { key: 'consult', icon: '🫠', title: '상담', desc: '공감과 현실 조언을 여러 관점으로 받아요.' },
  { key: 'vote', icon: '🗳️', title: '토론', desc: '찬성과 반대의 기준을 가볍게 나눠요.' },
  { key: 'drip', icon: '😂', title: '드립', desc: '짧은 한 줄을 이어가며 웃어요.' },
];

function numberText(value) {
  const number = Number(value || 0);
  return number >= 1000 ? `${(number / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(number);
}

function typeLabel(post) {
  if (post.typeLabel) return post.typeLabel;
  if (post.subtype === 'consult' || post.modules?.consult?.enabled) return '상담';
  if (post.subtype === 'drip' || post.modules?.drip?.enabled) return '드립';
  if (post.subtype === 'vote' || post.modules?.vote?.voteMode === 'pros_cons') return '토론';
  return '판결';
}

function commentScore(comment) {
  const reactions = comment.reactions || {};
  return Number(reactions.funny || 0) * 3 + Number(reactions.fire || 0) * 2 + Number(reactions.like || 0);
}

async function fetchPopularComments(max = 8) {
  try {
    const snap = await getDocs(query(collectionGroup(db, 'comments'), orderBy('createdAt', 'desc'), limit(80)));
    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      postId: docSnap.ref.parent?.parent?.id || '',
      ...docSnap.data(),
    })).filter(item => item.postId && item.text && !item.hidden)
      .map(item => ({ ...item, score: commentScore(item) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, max);
  } catch (error) {
    console.warn('[home comments]', error);
    return [];
  }
}

function renderIntro() {
  const residents = getPublicAiResidents().slice(0, 8);
  return `
    <section class="home-onboard">
      <div class="home-onboard__hero">
        <div class="home-onboard__hero-text">
          <div class="home-onboard__badge">🎭 AI CHARACTER COMMUNITY</div>
          <h1 class="home-onboard__title">판결 · 상담 · 토론 · 드립</h1>
          <p class="home-onboard__desc">글을 올리면 AI 캐릭터와 회원들이 각 유형에 맞춰 공감, 반박, 판정, 드립으로 참여합니다.</p>
        </div>
        <div class="home-onboard__hero-actions">
          <button class="home-onboard__btn-primary" type="button" data-home-write>+ 글쓰기</button>
          <button class="home-onboard__btn-ghost" type="button" data-home-feed>둘러보기</button>
        </div>
      </div>
      <div class="home-onboard__rooms" aria-label="소소킹 커뮤니티 유형">
        ${COMMUNITY_ROOMS.map(room => `
          <button class="home-onboard__room home-onboard__room--${room.key}" type="button" data-home-room="${room.key}">
            <span class="home-onboard__room-icon">${room.icon}</span>
            <span class="home-onboard__room-info"><b>${room.title}</b><em>${room.desc}</em></span>
          </button>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px">
        ${residents.map(resident => `
          <div style="padding:10px;border-radius:14px;background:rgba(255,255,255,.76);border:1px solid rgba(148,163,184,.28)">
            <div style="font-size:13px;font-weight:900"><span style="font-size:18px">${resident.emoji}</span> ${escHtml(resident.name)}</div>
            <div style="font-size:11px;font-weight:800;color:var(--color-text-secondary);margin-top:3px">${escHtml(resident.role)}</div>
          </div>`).join('')}
      </div>
    </section>`;
}

function renderBest(post) {
  if (!post) return '';
  return `
    <section>
      <div class="home-section-header"><span class="home-section-title">⭐ 오늘의 베스트</span></div>
      <button class="home-today-best" type="button" data-home-post="${escHtml(post.id)}">
        <div class="home-today-best__label">${typeLabel(post)}</div>
        <div class="home-today-best__title">${escHtml(post.title || '제목 없음')}</div>
        <div class="home-today-best__meta">
          <span>❤️ ${numberText(post.reactions?.total)}</span><span>💬 ${numberText(post.commentCount)}</span>
        </div>
      </button>
    </section>`;
}

function renderHot(posts) {
  return `
    <section>
      <div class="home-section-header"><span class="home-section-title">🔥 인기 글</span><button class="home-section-more" type="button" data-home-more>더 보기</button></div>
      <div class="home-rank-list">
        ${posts.length ? posts.map((post, index) => `
          <button class="home-rank-item" type="button" data-home-post="${escHtml(post.id)}">
            <span class="home-rank-item__num home-rank-item__num--${index < 3 ? index + 1 : 'rest'}">${index + 1}</span>
            <span class="home-rank-item__body"><span class="home-rank-item__type">${typeLabel(post)}</span><span class="home-rank-item__title">${escHtml(post.title || '제목 없음')}</span></span>
            <span class="home-rank-item__stats">❤️ ${numberText(post.reactions?.total)} · 💬 ${numberText(post.commentCount)}</span>
          </button>`).join('') : '<div class="empty-state"><div class="empty-state__title">아직 인기 글이 없어요.</div></div>'}
      </div>
    </section>`;
}

function renderComments(comments) {
  return `
    <section>
      <div class="home-section-header"><span class="home-section-title">💬 인기 댓글</span></div>
      <div class="home-compact-feed-list">
        ${comments.length ? comments.map((comment, index) => `
          <button class="home-compact-feed-item" type="button" data-home-post="${escHtml(comment.postId)}">
            <span class="home-compact-feed-item__badge">댓글 ${index + 1}</span>
            <span class="home-compact-feed-item__title">${escHtml(comment.text || '').slice(0, 120)}</span>
            <span class="home-compact-feed-item__meta">${escHtml(comment.authorName || '익명')} · ${formatTime(comment.createdAt?.toDate?.() || comment.createdAt)}</span>
          </button>`).join('') : '<div class="empty-state"><div class="empty-state__title">아직 댓글이 없어요.</div></div>'}
      </div>
    </section>`;
}

export async function renderHome() {
  const root = document.getElementById('page-content');
  if (!root) return;
  setMeta('소소킹 · AI 캐릭터 참여형 커뮤니티');
  root.innerHTML = '<div class="home-dash"><div class="skeleton" style="height:260px;border-radius:18px"></div></div>';
  const [hotPosts, comments, todayBest] = await Promise.all([fetchHotPosts(8), fetchPopularComments(8), fetchTodayBest()]);
  root.innerHTML = `<div class="home-dash page-enter home-dash--v2">${renderIntro()}${renderBest(todayBest)}${renderHot(hotPosts)}${renderComments(comments)}</div>`;
  root.querySelector('[data-home-write]')?.addEventListener('click', () => navigate('/write?type=multi&preset=judgment'));
  root.querySelector('[data-home-feed]')?.addEventListener('click', () => navigate('/feed'));
  root.querySelector('[data-home-more]')?.addEventListener('click', () => navigate('/feed?sort=popular'));
  root.querySelectorAll('[data-home-room]').forEach(button => button.addEventListener('click', () => navigate(`/write?type=multi&preset=${button.dataset.homeRoom}`)));
  root.querySelectorAll('[data-home-post]').forEach(button => button.addEventListener('click', () => navigate(`/detail/${button.dataset.homePost}`)));
}
