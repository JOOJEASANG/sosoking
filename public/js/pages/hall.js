import { db } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const RANK_SECTIONS = [
  { key: 'week-drip', title: '이주의 드립왕', icon: '😂', type: 'drip', period: 'week', desc: '이번 주 드립소에서 가장 반응이 좋았던 유저' },
  { key: 'week-vote', title: '이주의 토론왕', icon: '🗳️', type: 'vote', period: 'week', desc: '이번 주 토론소에서 참여를 많이 만든 유저' },
  { key: 'month-drip', title: '이달의 드립왕', icon: '👑', type: 'drip', period: 'month', desc: '이번 달 드립소 누적 점수가 높은 유저' },
  { key: 'month-vote', title: '이달의 토론왕', icon: '🏆', type: 'vote', period: 'month', desc: '이번 달 토론소 누적 점수가 높은 유저' },
];

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function periodStart(period) {
  return period === 'week' ? startOfWeek() : startOfMonth();
}

function postType(post) {
  const modules = post.modules || {};
  if (post.subtype === 'drip' || post.feedType === 'drip' || modules.drip?.enabled || post.type === 'drip' || post.type === 'cbattle') return 'drip';
  if (post.subtype === 'vote' || post.feedType === 'vote' || modules.vote?.enabled || modules.vote?.ox || post.type === 'vote' || post.type === 'ox' || post.type === 'battle' || post.type === 'balance') return 'vote';
  if (post.subtype === 'judgment' || modules.vote?.voteMode === 'judgment') return 'vote';
  if (post.subtype === 'consult' || modules.consult?.enabled || modules.quiz?.enabled || post.type === 'quiz' || post.type === 'initial_game') return 'drip';
  return 'drip';
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

function postScore(post) {
  return Math.round((reactionCount(post) * 5) + (commentCount(post) * 4) + (voteCount(post) * 3) + (viewCount(post) * 0.2));
}

function authorKey(post) {
  return String(post.authorId || post.authorEmail || post.authorName || 'anonymous');
}

function authorName(post) {
  if (post.anonymous) return '익명 유저';
  return String(post.authorName || post.authorEmail?.split('@')[0] || '익명 유저');
}

function rankUsers(posts, { type, period }) {
  const from = periodStart(period).getTime();
  const grouped = new Map();
  posts.forEach(post => {
    const created = toDate(post.createdAt);
    if (!created || created.getTime() < from) return;
    if (postType(post) !== type) return;

    const key = authorKey(post);
    const current = grouped.get(key) || {
      key,
      name: authorName(post),
      score: 0,
      posts: 0,
      reactions: 0,
      comments: 0,
      votes: 0,
      views: 0,
      topPost: null,
      topPostScore: -1,
    };
    const score = postScore(post);
    current.score += score;
    current.posts += 1;
    current.reactions += reactionCount(post);
    current.comments += commentCount(post);
    current.votes += voteCount(post);
    current.views += viewCount(post);
    if (score > current.topPostScore) {
      current.topPostScore = score;
      current.topPost = post;
    }
    grouped.set(key, current);
  });

  return [...grouped.values()]
    .sort((a, b) => b.score - a.score || b.posts - a.posts || b.comments - a.comments)
    .slice(0, 3);
}

function renderHallStyle() {
  return `
    <style>
      .hall-page--kings{max-width:980px;margin:0 auto;padding:clamp(12px,2vw,20px) 0 34px}
      .hall-kings-hero{padding:clamp(24px,5vw,38px);border-radius:30px;background:radial-gradient(circle at 10% 0%,rgba(255,107,74,.22),rgba(255,107,74,0) 34%),linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,250,252,.92));border:1px solid rgba(148,163,184,.22);box-shadow:0 18px 44px rgba(15,23,42,.075)}
      .hall-kings-hero__badge{display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:999px;background:rgba(255,107,74,.11);color:#ef4b2f;font-size:12px;font-weight:950;letter-spacing:-.02em}
      .hall-kings-hero__title{margin-top:12px;font-size:clamp(30px,6vw,44px);font-weight:950;line-height:1.08;letter-spacing:-.08em;color:var(--color-text-primary)}
      .hall-kings-hero__desc{max-width:680px;margin-top:10px;color:var(--color-text-muted);font-size:14px;font-weight:750;line-height:1.6;letter-spacing:-.035em}
      .hall-kings-hero__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
      .hall-kings-btn{min-height:44px;padding:0 16px;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:950;cursor:pointer}
      .hall-kings-btn--ghost{background:rgba(255,255,255,.74);color:var(--color-text-primary);border:1px solid rgba(148,163,184,.28)}
      .hall-rule-box{margin:14px 0;padding:14px 16px;border-radius:18px;background:rgba(255,107,74,.07);border:1px solid rgba(255,107,74,.16);color:var(--color-text-muted);font-size:13px;font-weight:750;line-height:1.55}
      .hall-king-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .hall-king-section{border-radius:26px;background:var(--color-surface);border:1px solid rgba(148,163,184,.18);box-shadow:0 14px 32px rgba(15,23,42,.055);overflow:hidden}
      .hall-king-section__head{display:flex;gap:12px;align-items:center;padding:18px 18px 12px}
      .hall-king-section__icon{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:16px;background:linear-gradient(135deg,rgba(255,107,74,.16),rgba(255,183,77,.12));font-size:23px}
      .hall-king-section__title{font-size:18px;font-weight:950;color:var(--color-text-primary);letter-spacing:-.045em}
      .hall-king-section__desc{margin-top:3px;color:var(--color-text-muted);font-size:12px;font-weight:750;line-height:1.45}
      .hall-king-item{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;margin:0 12px 10px;padding:12px;border-radius:18px;background:rgba(248,250,252,.76);border:1px solid rgba(148,163,184,.14);cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
      .hall-king-item:hover{transform:translateY(-1px);box-shadow:0 12px 24px rgba(15,23,42,.08)}
      .hall-crown{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#111827;color:#fff;font-size:13px;font-weight:950}
      .hall-crown--1{background:linear-gradient(135deg,#ffb300,#ff6a00)}
      .hall-crown--2{background:linear-gradient(135deg,#94a3b8,#64748b)}
      .hall-crown--3{background:linear-gradient(135deg,#c08457,#92400e)}
      .hall-king-item__name{font-size:15px;font-weight:950;color:var(--color-text-primary);letter-spacing:-.04em;line-height:1.35}
      .hall-king-item__meta{margin-top:4px;color:var(--color-text-muted);font-size:11px;font-weight:750;line-height:1.45}
      .hall-king-item__score{min-width:62px;text-align:right;color:#ef4b2f;font-size:13px;font-weight:950}
      .hall-king-toppost{display:block;margin-top:4px;color:var(--color-text-muted);font-size:11px;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .hall-empty{margin:0 12px 14px;padding:18px;border-radius:18px;text-align:center;background:rgba(148,163,184,.08);color:var(--color-text-muted);font-size:13px;font-weight:800}
      [data-theme="dark"] .hall-kings-hero,html.dark .hall-kings-hero,html[data-theme="dark"] .hall-kings-hero{background:linear-gradient(135deg,rgba(31,41,55,.96),rgba(17,24,39,.90));border-color:rgba(255,255,255,.08);box-shadow:0 18px 44px rgba(0,0,0,.28)}
      [data-theme="dark"] .hall-king-item,html.dark .hall-king-item,html[data-theme="dark"] .hall-king-item{background:rgba(255,255,255,.045);border-color:rgba(255,255,255,.08)}
      @media(max-width:760px){.hall-king-grid{grid-template-columns:1fr}.hall-king-item{grid-template-columns:34px minmax(0,1fr)}.hall-king-item__score{grid-column:2;text-align:left}.hall-kings-hero__actions{flex-direction:column}.hall-kings-btn{width:100%}}
    </style>`;
}

function renderHero() {
  return `
    <section class="hall-kings-hero">
      <div class="hall-kings-hero__badge">SOSOKING KINGS</div>
      <div class="hall-kings-hero__title">이번 주와 이번 달의 왕</div>
      <div class="hall-kings-hero__desc">토론소와 드립소에서 가장 많은 참여를 만든 유저를 뽑습니다. 글 반응, 댓글, 투표, 조회를 합산해 드립왕과 토론왕을 선정합니다.</div>
      <div class="hall-kings-hero__actions">
        <button class="hall-kings-btn" type="button" onclick="navigate('/write?type=multi&preset=drip')">드립소 글쓰기</button>
        <button class="hall-kings-btn hall-kings-btn--ghost" type="button" onclick="navigate('/write?type=multi&preset=vote')">토론소 열기</button>
      </div>
    </section>`;
}

export async function renderHall() {
  const el = document.getElementById('page-content');
  setMeta('소소킹 랭킹', '이주의 드립왕과 토론왕, 이달의 드립왕과 토론왕');

  el.innerHTML = `
    <div class="hall-page hall-page--kings">
      ${renderHallStyle()}
      ${renderHero()}
      <div class="hall-rule-box">선정 기준: 반응×5 + 댓글×4 + 투표×3 + 조회×0.2를 유저별로 합산합니다. 이주의 왕은 월요일부터 오늘까지, 이달의 왕은 매월 1일부터 오늘까지 기준입니다.</div>
      <div class="hall-king-grid">
        ${Array.from({ length: 4 }, () => `<div class="skeleton-card" style="height:240px;border-radius:26px"></div>`).join('')}
      </div>
    </div>`;

  try {
    const snap = await getDocs(query(
      collection(db, 'feeds'),
      orderBy('createdAt', 'desc'),
      limit(500),
    ));
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
    el.querySelector('.hall-king-grid').innerHTML = RANK_SECTIONS.map(section => {
      const ranked = rankUsers(posts, section);
      return renderSection(section, ranked);
    }).join('');
  } catch (error) {
    console.error('[hall] king ranking load failed', error);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">랭킹 데이터를 불러올 수 없어요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/hall')">다시 불러오기</button>
      </div>`;
  }
}

function renderSection(section, ranked) {
  return `
    <section class="hall-king-section">
      <div class="hall-king-section__head">
        <span class="hall-king-section__icon">${section.icon}</span>
        <div>
          <div class="hall-king-section__title">${escHtml(section.title)}</div>
          <div class="hall-king-section__desc">${escHtml(section.desc)}</div>
        </div>
      </div>
      ${ranked.length ? ranked.map((user, index) => renderKingItem(user, index)).join('') : `<div class="hall-empty">아직 선정할 왕이 없어요</div>`}
    </section>`;
}

function renderKingItem(user, index) {
  const post = user.topPost;
  const target = post?.id ? `/detail/${post.id}` : '/hall';
  return `
    <div class="hall-king-item" onclick="navigate('${target}')" role="button" tabindex="0">
      <span class="hall-crown hall-crown--${index + 1}">${index + 1}</span>
      <div class="hall-king-item__body">
        <div class="hall-king-item__name">${escHtml(user.name)}</div>
        <div class="hall-king-item__meta">글 ${fmt(user.posts)} · 반응 ${fmt(user.reactions)} · 댓글 ${fmt(user.comments)} · 투표 ${fmt(user.votes)} · 조회 ${fmt(user.views)}</div>
        ${post?.title ? `<span class="hall-king-toppost">대표글: ${escHtml(post.title)}</span>` : ''}
      </div>
      <div class="hall-king-item__score">${fmt(user.score)}점</div>
    </div>`;
}
