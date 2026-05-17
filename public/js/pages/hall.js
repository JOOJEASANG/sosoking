import { db } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const HALL_CATS = [
  { key: 'naming',       label: '작명왕',  icon: '✏️', type: 'naming',       desc: '미친 작명 실력자',       scoreKey: null },
  { key: 'acrostic',     label: '삼행시왕', icon: '📝', type: 'acrostic',     desc: '삼행시의 달인',          scoreKey: null },
  { key: 'comment',      label: '댓글왕',  icon: '💬', type: null,            desc: '댓글을 가장 많이 받은 글', scoreKey: 'comment' },
  { key: 'drip',         label: '드립왕',  icon: '🎤', type: 'drip',          desc: '한 줄 드립의 달인',       scoreKey: null },
  { key: 'random_battle',label: '대결왕',  icon: '🎰', type: 'random_battle', desc: '랜덤대결 최고 인기글',    scoreKey: null },
];

function score(p) {
  return (p.reactions?.total || 0) * 2 + (p.commentCount || 0) * 3 + (p.viewCount || 0) * 0.1;
}

export async function renderHall() {
  const el = document.getElementById('page-content');
  setMeta('명예의 전당', '분야별 TOP 3 — 작명·삼행시·드립·댓글·대결');

  el.innerHTML = `
    <div class="hall-page">
      <div class="section-header">
        <h1 class="section-header__title">🏆 명예의 전당</h1>
        <div class="section-header__sub">최근 100개 게시글 기준 · 분야별 TOP 3</div>
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
      const pool = cat.type ? posts.filter(p => p.type === cat.type) : [...posts];
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
  const medals = ['🥇', '🥈', '🥉'];
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
            <div class="hall-item__meta">${escHtml(p.authorName || '')} · ❤️${p.reactions?.total || 0} 💬${p.commentCount || 0}</div>
          </div>
        </div>`).join('') : `
        <div class="hall-empty">아직 왕좌가 비어 있어요 👑</div>`}
    </div>`;
}
