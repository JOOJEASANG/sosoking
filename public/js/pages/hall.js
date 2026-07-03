import { db } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const HALL_CATS = [
  { key: 'popular',  label: '인기 게임', icon: '🔥', type: null,       desc: '반응과 댓글이 많은 게임', scoreKey: null },
  { key: 'comment',  label: '댓글 많은 게임', icon: '💬', type: null,  desc: '캐릭터와 유저 댓글이 많은 게임', scoreKey: 'comment' },
  { key: 'judgment', label: '판결 랭킹', icon: '⚖️', type: 'judgment', desc: '판결 참여가 많은 게임', scoreKey: null },
  { key: 'consult',  label: '상담 랭킹', icon: '🫠', type: 'consult',  desc: '상담 반응이 좋은 게임', scoreKey: null },
  { key: 'vote',     label: '토론 랭킹', icon: '🗳️', type: 'vote',    desc: '토론 참여가 많은 게임', scoreKey: null },
  { key: 'drip',     label: '드립 랭킹', icon: '😂', type: 'drip',    desc: '한 줄 드립 반응이 좋은 게임', scoreKey: null },
];

function postType(post) {
  const modules = post.modules || {};
  if (post.subtype === 'judgment' || modules.vote?.voteMode === 'judgment') return 'judgment';
  if (post.subtype === 'consult' || modules.consult?.enabled || modules.quiz?.enabled || post.type === 'quiz' || post.type === 'initial_game') return 'consult';
  if (post.subtype === 'drip' || post.feedType === 'drip' || modules.drip?.enabled) return 'drip';
  if (post.subtype === 'vote' || post.feedType === 'vote' || modules.vote?.enabled || modules.vote?.ox || post.type === 'vote' || post.type === 'ox') return 'vote';
  return 'judgment';
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
        <span>📌 게임 현황과 산정기준</span>
        <small>기본 접힘</small>
      </summary>
      <div class="hall-info-accordion__body">
        <div class="hall-info-stats">
          <div><b>${fmt(total)}</b><span>집계 게임</span></div>
          <div><b>${fmt(comments)}</b><span>댓글 합계</span></div>
          <div><b>${fmt(reactions)}</b><span>좋아요 합계</span></div>
          <div><b>${fmt(Math.round(views))}</b><span>조회 합계</span></div>
        </div>
        <div class="hall-info-rule-grid">
          <div class="hall-info-rule">
            <b>집계 범위</b>
            <p>최신 게임 100개 중 숨김 처리되지 않은 공개 게임만 기준으로 계산합니다.</p>
          </div>
          <div class="hall-info-rule">
            <b>인기 게임 산정</b>
            <p>좋아요×2 + 댓글×3 + 조회×0.1 점수로 정렬합니다.</p>
          </div>
          <div class="hall-info-rule">
            <b>댓글 많은 게임</b>
            <p>캐릭터와 유저 댓글 수가 많은 순서로 TOP 3를 보여줍니다.</p>
          </div>
          <div class="hall-info-rule">
            <b>4게임 유형별 현황</b>
            <p>${counts.map(item => `${item.label} ${fmt(item.count)}개`).join(' · ') || '유형별 데이터 없음'}</p>
          </div>
        </div>
      </div>
    </details>`;
}

export async function renderHall() {
  const el = document.getElementById('page-content');
  setMeta('랭킹', '판결·상담·토론·드립 인기 게임 랭킹');

  el.innerHTML = `
    <div class="hall-page">
      <div class="section-header">
        <h1 class="section-header__title">🏆 게임 랭킹</h1>
      </div>
      <div id="hall-info-box">${renderHallInfo([])}</div>
      <div class="hall-grid">
        ${Array.from({ length: 6 }, () => `<div class="skeleton-card" style="height:200px"></div>`).join('')}
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
        <div class="empty-state__title">랭킹 데이터를 불러올 수 없어요</div>
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
        <div class="hall-empty">아직 집계할 게임이 없어요</div>`}
    </div>`;
}
