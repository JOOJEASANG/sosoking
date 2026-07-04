import { db } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const HALL_CATS = [
  { key: 'overall', label: '종합 랭킹', icon: '🏆', type: null, desc: '반응·댓글·조회가 고르게 높은 글', sort: 'score' },
  { key: 'funny', label: '웃김 랭킹', icon: '😂', type: null, desc: '댓글과 반응이 많이 붙은 글', sort: 'funny' },
  { key: 'debate', label: '토론소 랭킹', icon: '🗳️', type: 'vote', desc: 'VS 투표와 댓글 참여가 많은 토론소 글', sort: 'score' },
  { key: 'drip', label: '드립소 랭킹', icon: '⚡', type: 'drip', desc: '작명·번역·한 줄 드립 반응이 좋은 글', sort: 'score' },
  { key: 'comments', label: '댓글 폭발', icon: '💬', type: null, desc: '댓글이 많이 달린 글', sort: 'comments' },
  { key: 'views', label: '조회 급상승', icon: '👀', type: null, desc: '사람들이 많이 본 글', sort: 'views' },
];

function postType(post) {
  const modules = post.modules || {};
  if (post.subtype === 'drip' || post.feedType === 'drip' || modules.drip?.enabled || post.type === 'drip' || post.type === 'cbattle') return 'drip';
  if (post.subtype === 'vote' || post.feedType === 'vote' || modules.vote?.enabled || modules.vote?.ox || post.type === 'vote' || post.type === 'ox' || post.type === 'battle' || post.type === 'balance') return 'vote';
  if (post.subtype === 'judgment' || modules.vote?.voteMode === 'judgment') return 'vote';
  if (post.subtype === 'consult' || modules.consult?.enabled || modules.quiz?.enabled || post.type === 'quiz' || post.type === 'initial_game') return 'drip';
  return 'drip';
}

function typeLabel(post) {
  return postType(post) === 'vote' ? '토론소' : '드립소';
}

function voteCount(post) {
  const options = post.modules?.vote?.options;
  if (!Array.isArray(options)) return 0;
  return options.reduce((sum, item) => sum + Number(item?.votes || 0), 0);
}

function reactionCount(post) {
  return Number(post.reactions?.total || 0);
}

function commentCount(post) {
  return Number(post.commentCount || 0);
}

function viewCount(post) {
  return Number(post.viewCount || 0);
}

function score(post) {
  return Math.round((reactionCount(post) * 5) + (commentCount(post) * 4) + (voteCount(post) * 3) + (viewCount(post) * 0.2));
}

function funnyScore(post) {
  const reactions = post.reactions || {};
  return Math.round(
    Number(reactions.funny || 0) * 8 +
    Number(reactions.fire || 0) * 6 +
    reactionCount(post) * 3 +
    commentCount(post) * 5 +
    viewCount(post) * 0.1
  );
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function sortPosts(posts, sort) {
  const list = [...posts];
  if (sort === 'comments') return list.sort((a, b) => commentCount(b) - commentCount(a) || score(b) - score(a));
  if (sort === 'views') return list.sort((a, b) => viewCount(b) - viewCount(a) || score(b) - score(a));
  if (sort === 'funny') return list.sort((a, b) => funnyScore(b) - funnyScore(a) || score(b) - score(a));
  return list.sort((a, b) => score(b) - score(a));
}

function renderHallStyle() {
  return `
    <style>
      .hall-page--soso {
        max-width: 1060px;
        margin: 0 auto;
        padding: clamp(12px, 2vw, 20px) 0 32px;
      }
      .hall-hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 18px;
        align-items: end;
        padding: clamp(22px, 4vw, 32px);
        border-radius: 28px;
        background:
          radial-gradient(circle at 8% 0%, rgba(255,107,74,.20), rgba(255,107,74,0) 32%),
          linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,250,252,.92));
        border: 1px solid rgba(148,163,184,.22);
        box-shadow: 0 18px 44px rgba(15,23,42,.075);
      }
      .hall-hero__badge {
        display: inline-flex;
        align-items: center;
        height: 30px;
        padding: 0 12px;
        border-radius: 999px;
        background: rgba(255,107,74,.11);
        color: #ef4b2f;
        font-size: 12px;
        font-weight: 950;
        letter-spacing: -.02em;
      }
      .hall-hero__title {
        margin-top: 12px;
        font-size: clamp(27px, 5vw, 40px);
        font-weight: 950;
        line-height: 1.1;
        letter-spacing: -.08em;
        color: var(--color-text-primary);
      }
      .hall-hero__desc {
        max-width: 640px;
        margin-top: 10px;
        color: var(--color-text-muted);
        font-size: 14px;
        font-weight: 750;
        line-height: 1.6;
        letter-spacing: -.035em;
      }
      .hall-hero__actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .hall-hero__btn {
        min-height: 44px;
        padding: 0 16px;
        border: 0;
        border-radius: 999px;
        background: #111827;
        color: #fff;
        font-weight: 950;
        cursor: pointer;
      }
      .hall-hero__btn--ghost {
        background: rgba(255,255,255,.74);
        color: var(--color-text-primary);
        border: 1px solid rgba(148,163,184,.28);
      }
      .hall-score-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin: 14px 0;
      }
      .hall-score-card {
        padding: 16px;
        border-radius: 20px;
        background: var(--color-surface);
        border: 1px solid rgba(148,163,184,.18);
        box-shadow: 0 10px 24px rgba(15,23,42,.045);
      }
      .hall-score-card b {
        display: block;
        font-size: 22px;
        font-weight: 950;
        color: var(--color-text-primary);
      }
      .hall-score-card span {
        display: block;
        margin-top: 3px;
        font-size: 12px;
        color: var(--color-text-muted);
        font-weight: 850;
      }
      .hall-rule-box {
        margin-bottom: 14px;
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(255,107,74,.07);
        border: 1px solid rgba(255,107,74,.16);
        color: var(--color-text-muted);
        font-size: 13px;
        font-weight: 750;
        line-height: 1.55;
      }
      .hall-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .hall-section {
        border-radius: 24px;
        background: var(--color-surface);
        border: 1px solid rgba(148,163,184,.18);
        box-shadow: 0 14px 32px rgba(15,23,42,.055);
        overflow: hidden;
      }
      .hall-section__head {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 18px 18px 12px;
      }
      .hall-section__icon {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 15px;
        background: linear-gradient(135deg, rgba(255,107,74,.16), rgba(255,183,77,.12));
        font-size: 22px;
      }
      .hall-section__label {
        font-size: 17px;
        font-weight: 950;
        color: var(--color-text-primary);
        letter-spacing: -.04em;
      }
      .hall-section__desc {
        margin-top: 3px;
        color: var(--color-text-muted);
        font-size: 12px;
        font-weight: 750;
      }
      .hall-item {
        display: grid;
        grid-template-columns: 38px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        margin: 0 12px 10px;
        padding: 12px;
        border-radius: 18px;
        background: rgba(248,250,252,.76);
        border: 1px solid rgba(148,163,184,.14);
        cursor: pointer;
        transition: transform .16s ease, box-shadow .16s ease;
      }
      .hall-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(15,23,42,.08);
      }
      .hall-medal {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #111827;
        color: #fff;
        font-size: 13px;
        font-weight: 950;
      }
      .hall-medal--1 { background: linear-gradient(135deg, #ffb300, #ff6a00); }
      .hall-medal--2 { background: linear-gradient(135deg, #94a3b8, #64748b); }
      .hall-medal--3 { background: linear-gradient(135deg, #c08457, #92400e); }
      .hall-item__title {
        color: var(--color-text-primary);
        font-size: 14px;
        font-weight: 950;
        line-height: 1.38;
        letter-spacing: -.035em;
      }
      .hall-item__meta {
        margin-top: 4px;
        color: var(--color-text-muted);
        font-size: 11px;
        font-weight: 750;
        line-height: 1.45;
      }
      .hall-item__score {
        min-width: 54px;
        text-align: right;
        font-size: 13px;
        font-weight: 950;
        color: #ef4b2f;
      }
      .hall-empty {
        margin: 0 12px 14px;
        padding: 18px;
        border-radius: 18px;
        text-align: center;
        background: rgba(148,163,184,.08);
        color: var(--color-text-muted);
        font-size: 13px;
        font-weight: 800;
      }
      [data-theme="dark"] .hall-hero,
      html.dark .hall-hero,
      html[data-theme="dark"] .hall-hero {
        background: linear-gradient(135deg, rgba(31,41,55,.96), rgba(17,24,39,.90));
        border-color: rgba(255,255,255,.08);
        box-shadow: 0 18px 44px rgba(0,0,0,.28);
      }
      [data-theme="dark"] .hall-item,
      html.dark .hall-item,
      html[data-theme="dark"] .hall-item {
        background: rgba(255,255,255,.045);
        border-color: rgba(255,255,255,.08);
      }
      @media (max-width: 760px) {
        .hall-hero { grid-template-columns: 1fr; }
        .hall-hero__actions { justify-content: flex-start; }
        .hall-score-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .hall-grid { grid-template-columns: 1fr; }
      }
    </style>`;
}

function renderStats(posts = []) {
  const total = posts.length;
  const comments = posts.reduce((sum, post) => sum + commentCount(post), 0);
  const reactions = posts.reduce((sum, post) => sum + reactionCount(post), 0);
  const votes = posts.reduce((sum, post) => sum + voteCount(post), 0);
  return `
    <div class="hall-score-strip">
      <div class="hall-score-card"><b>${fmt(total)}</b><span>집계 글</span></div>
      <div class="hall-score-card"><b>${fmt(comments)}</b><span>댓글</span></div>
      <div class="hall-score-card"><b>${fmt(reactions)}</b><span>반응</span></div>
      <div class="hall-score-card"><b>${fmt(votes)}</b><span>투표</span></div>
    </div>`;
}

function renderHero() {
  return `
    <section class="hall-hero">
      <div>
        <div class="hall-hero__badge">SOSOKING RANKING</div>
        <div class="hall-hero__title">오늘 웃긴 글은 여기서 갈립니다</div>
        <div class="hall-hero__desc">토론소와 드립소의 반응, 댓글, 투표, 조회를 합산해 지금 가장 많이 참여한 글을 보여줍니다.</div>
      </div>
      <div class="hall-hero__actions">
        <button class="hall-hero__btn" type="button" onclick="navigate('/write?type=multi&preset=drip')">드립소 글쓰기</button>
        <button class="hall-hero__btn hall-hero__btn--ghost" type="button" onclick="navigate('/write?type=multi&preset=vote')">토론소 열기</button>
      </div>
    </section>`;
}

export async function renderHall() {
  const el = document.getElementById('page-content');
  setMeta('소소킹 랭킹', '토론소와 드립소 인기 글 랭킹');

  el.innerHTML = `
    <div class="hall-page hall-page--soso">
      ${renderHallStyle()}
      ${renderHero()}
      ${renderStats([])}
      <div class="hall-rule-box">랭킹 기준: 반응×5 + 댓글×4 + 투표×3 + 조회×0.2를 기본 점수로 계산합니다. 최신 공개 글 120개 기준입니다.</div>
      <div class="hall-grid">
        ${Array.from({ length: 6 }, () => `<div class="skeleton-card" style="height:230px;border-radius:24px"></div>`).join('')}
      </div>
    </div>`;

  try {
    const snap = await getDocs(query(
      collection(db, 'feeds'),
      orderBy('createdAt', 'desc'),
      limit(120),
    ));
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);

    const statMount = el.querySelector('.hall-score-strip');
    if (statMount) statMount.outerHTML = renderStats(posts);

    el.querySelector('.hall-grid').innerHTML = HALL_CATS.map(cat => {
      const pool = cat.type ? posts.filter(p => postType(p) === cat.type) : posts;
      const sorted = sortPosts(pool, cat.sort).slice(0, 3);
      return renderSection(cat, sorted);
    }).join('');
  } catch (error) {
    console.error('[hall] ranking load failed', error);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">랭킹 데이터를 불러올 수 없어요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/hall')">다시 불러오기</button>
      </div>`;
  }
}

function renderSection({ label, icon, desc }, top3) {
  const medals = ['1', '2', '3'];
  return `
    <section class="hall-section">
      <div class="hall-section__head">
        <span class="hall-section__icon">${icon}</span>
        <div>
          <div class="hall-section__label">${escHtml(label)}</div>
          <div class="hall-section__desc">${escHtml(desc)}</div>
        </div>
      </div>
      ${top3.length ? top3.map((p, i) => `
        <div class="hall-item" onclick="navigate('/detail/${p.id}')" role="button" tabindex="0">
          <span class="hall-medal hall-medal--${i + 1}">${medals[i]}</span>
          <div class="hall-item__body">
            <div class="hall-item__title">${escHtml(p.title || '(제목 없음)')}</div>
            <div class="hall-item__meta">${typeLabel(p)} · ${escHtml(p.authorName || '익명')} · 반응 ${fmt(reactionCount(p))} · 댓글 ${fmt(commentCount(p))} · 투표 ${fmt(voteCount(p))} · 조회 ${fmt(viewCount(p))}</div>
          </div>
          <div class="hall-item__score">${fmt(score(p))}점</div>
        </div>`).join('') : `
        <div class="hall-empty">아직 집계할 글이 없어요</div>`}
    </section>`;
}
