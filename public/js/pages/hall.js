import { db } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const HALL_CATS = [
  { key: 'popular',  label: '인기글',      icon: '🔥', type: null,       desc: '반응과 댓글이 많은 글', scoreKey: null },
  { key: 'comment',  label: '댓글 많은 글', icon: '💬', type: null,       desc: '댓글 참여가 많은 글', scoreKey: 'comment' },
  { key: 'naming',   label: '작명 통계',   icon: '✏️', type: 'naming',   desc: '미친작명소 인기글', scoreKey: null },
  { key: 'acrostic', label: '삼행시 통계', icon: '📝', type: 'acrostic', desc: '삼행시 인기글', scoreKey: null },
  { key: 'quiz',     label: '퀴즈 통계',   icon: '🧠', type: 'quiz',     desc: '퀴즈 인기글', scoreKey: null },
];

function postType(post) {
  if (post.subtype) return post.subtype;
  const modules = post.modules || {};
  if (modules.vote?.ox) return 'ox';
  if (modules.vote?.enabled) return 'vote';
  if (modules.fill?.enabled) return 'fill';
  if (modules.naming?.enabled) return 'naming';
  if (modules.acrostic?.enabled) return 'acrostic';
  if (modules.quiz?.enabled) return 'quiz';
  if (modules.anonymous?.enabled || post.anonymous) return 'anonymous';
  return post.type === 'multi' ? 'general' : post.type;
}

function score(p) {
  return (p.reactions?.total || 0) * 2 + (p.commentCount || 0) * 3 + (p.viewCount || 0) * 0.1;
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

export async function renderHall() {
  const el = document.getElementById('page-content');
  setMeta('통계', '피드 인기글과 참여 통계');

  el.innerHTML = `
    <div class="hall-page">
      <div class="section-header">
        <h1 class="section-header__title">📊 통계</h1>
        <div class="section-header__sub">최근 100개 게시글 기준 · 인기/참여 TOP 3</div>
      </div>
      <div class="hall-grid">
        ${Array.from({ length: 5 }, () => `<div class="skeleton-card" style="height:200px"></div>`).join('')}
      </div>
    </div>`;

  try {
    const snap = await getDocs(query(
      collection(db, 'feeds'),
      orderBy('createdAt', 'desc'),
      limit(100),
    ));
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);

    el.querySelector('.hall-grid').innerHTML = HALL_CATS.map(cat => {
      const pool = cat.type ? posts.filter(p => postType(p) === cat.type) : [...posts];
      const sorted = (cat.scoreKey === 'comment'
        ? [...pool].sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0))
        : [...pool].sort((a, b) => score(b) - score(a))
      ).slice(0, 3);
      return renderSection(cat, sorted);
    }).join('');

  } catch {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">데이터를 불러올 수 없어요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="location.reload()">새로고침</button>
      </div>`;
  }
}

function renderSection({ label, icon, desc }, top3) {
  const medals = ['1', '2', '3'];
  return `
    <div class="hall-section">
      <div class="hall-section__head">
        <span class="hall-section__icon">${icon}</span>
        <div>
          <div class="hall-section__label">${label}</div>
          <div class="hall-section__desc">${desc}</div>
        </div>
      </div>
      ${top3.length ? top3.map((p, i) => `
        <div class="hall-item" onclick="navigate('/detail/${p.id}')" role="button">
          <span class="hall-medal">${medals[i]}</span>
          <div class="hall-item__body">
            <div class="hall-item__title">${escHtml(p.title || '(제목 없음)')}</div>
            <div class="hall-item__meta">${escHtml(p.authorName || '')} · 좋아요 ${fmt(p.reactions?.total)} · 댓글 ${fmt(p.commentCount)} · 조회 ${fmt(p.viewCount)}</div>
          </div>
        </div>`).join('') : `
        <div class="hall-empty">아직 집계할 데이터가 없어요</div>`}
    </div>`;
}
