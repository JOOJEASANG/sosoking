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
  { key: 'acrostic', label: '행시 통계',   icon: '📝', type: 'acrostic', desc: '이행시·삼행시·사행시·오행시 인기글', scoreKey: null },
  { key: 'quiz',     label: '퀴즈 통계',   icon: '🧠', type: 'quiz',     desc: '퀴즈 인기글', scoreKey: null },
];

function postType(post) {
  if (post.feedType) return post.feedType;
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

function renderHallInfo(posts = []) {
  const counts = HALL_CATS
    .filter(cat => cat.type)
    .map(cat => ({ ...cat, count: posts.filter(p => postType(p) === cat.type).length }));
  const total = posts.length;
  const comments = posts.reduce((sum, post) => sum + Number(post.commentCount || 0), 0);
  const reactions = posts.reduce((sum, post) => sum + Number(post.reactions?.total || 0), 0);
  const views = posts.reduce((sum, post) => sum + Number(post.viewCount || 0), 0);

  return `
    <details class="hall-info-accordion">
      <summary>
        <span>📌 현황과 산정기준 확인</span>
        <small>기본 접힘</small>
      </summary>
      <div class="hall-info-accordion__body">
        <div class="hall-info-stats">
          <div><b>${fmt(total)}</b><span>집계 게시글</span></div>
          <div><b>${fmt(comments)}</b><span>댓글 합계</span></div>
          <div><b>${fmt(reactions)}</b><span>좋아요 합계</span></div>
          <div><b>${fmt(Math.round(views))}</b><span>조회 합계</span></div>
        </div>
        <div class="hall-info-rule-grid">
          <div class="hall-info-rule">
            <b>집계 범위</b>
            <p>최신 게시글 100개 중 숨김 처리되지 않은 공개 게시글만 기준으로 계산합니다.</p>
          </div>
          <div class="hall-info-rule">
            <b>인기글 산정</b>
            <p>좋아요×2 + 댓글×3 + 조회×0.1 점수로 정렬합니다.</p>
          </div>
          <div class="hall-info-rule">
            <b>댓글 많은 글</b>
            <p>댓글 수가 많은 순서로 TOP 3를 보여줍니다.</p>
          </div>
          <div class="hall-info-rule">
            <b>유형별 통계</b>
            <p>${counts.map(item => `${item.label} ${fmt(item.count)}개`).join(' · ') || '유형별 데이터 없음'}</p>
          </div>
        </div>
      </div>
    </details>`;
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
      <div id="hall-info-box">${renderHallInfo([])}</div>
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

    const infoBox = el.querySelector('#hall-info-box');
    if (infoBox) infoBox.innerHTML = renderHallInfo(posts);

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
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/hall')">다시 불러오기</button>
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