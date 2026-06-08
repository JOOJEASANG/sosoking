import { db } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const AI_TYPES = ['ai_judge', 'ai_translate', 'ai_naming', 'ai_debate'];

const HALL_CATS = [
  { key: 'popular',      label: '인기글',  icon: '🔥', type: null,          desc: '반응과 댓글이 많은 글', scoreKey: null },
  { key: 'comment',      label: '댓글많음', icon: '💬', type: null,          desc: '댓글 참여가 많은 글',   scoreKey: 'comment' },
  { key: 'ai_judge',     label: '판결소',  icon: '⚖️', type: 'ai_judge',    desc: '판결 인기글',           scoreKey: null },
  { key: 'ai_translate', label: '창작소',  icon: '✨', type: 'ai_translate', desc: '번역·작명 인기글',      scoreKey: null },
  { key: 'ai_debate',    label: '티격태격', icon: '🗣️', type: 'ai_debate',   desc: '티격태격 인기글',        scoreKey: null },
];

function score(p) {
  return (p.reactions?.total || 0) * 2 + (p.commentCount || 0) * 3 + (p.viewCount || 0) * 0.1;
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function postType(post) {
  if (post.feedType) return post.feedType;
  if (post.subtype) return post.subtype;
  return post.type === 'multi' ? 'general' : post.type;
}

function aiResultSnippet(post) {
  switch (post.type) {
    case 'ai_judge': {
      const v = (post.verdicts || [])[0];
      return v ? `<span class="hall-ai-snippet">${escHtml(v.charName || v.judgeName || '')}: "${escHtml((v.verdict || '').slice(0, 50))}..."</span>` : '';
    }
    case 'ai_translate': {
      const firstT = Array.isArray(post.translations) ? post.translations[0] : null;
      const label = firstT ? escHtml(firstT.charName) : escHtml(post.styleName || '');
      return label ? `<span class="hall-ai-snippet">${label} 번역</span>` : '';
    }
    case 'ai_naming': {
      const names = (post.names || []).slice(0, 2).map(n => escHtml(n.name)).join(', ');
      return names ? `<span class="hall-ai-snippet">${names}</span>` : '';
    }
    default:
      return '';
  }
}

function renderLegendSection(top5) {
  if (!top5.length) return '';
  const [first, ...rest] = top5;
  return `
    <div class="hall-legend">
      <div class="hall-legend__head">
        <span class="hall-legend__crown">👑</span>
        <div>
          <div class="hall-legend__title">AI킹 명예의 전당</div>
          <div class="hall-legend__sub">좋아요·댓글·조회 기준 역대 베스트</div>
        </div>
      </div>
      <div class="hall-legend__first" onclick="navigate('/detail/${first.id}')" role="button">
        <div class="hall-legend__first-rank">🥇</div>
        <div class="hall-legend__first-body">
          <div class="hall-legend__first-title">${escHtml(first.title || '(제목 없음)')}</div>
          ${aiResultSnippet(first)}
          <div class="hall-legend__first-meta">❤️ ${fmt(first.reactions?.total)} · 💬 ${fmt(first.commentCount)} · 👁 ${fmt(first.viewCount)}</div>
        </div>
      </div>
      ${rest.length ? `<div class="hall-legend__rest">${rest.map((p, i) => `
        <div class="hall-legend__rest-item" onclick="navigate('/detail/${p.id}')" role="button">
          <span class="hall-legend__rest-rank">${['🥈','🥉','4️⃣','5️⃣'][i]}</span>
          <div class="hall-legend__rest-body">
            <div class="hall-legend__rest-title">${escHtml(p.title || '(제목 없음)')}</div>
            ${aiResultSnippet(p)}
          </div>
          <div class="hall-legend__rest-score">❤️${fmt(p.reactions?.total)}</div>
        </div>`).join('')}</div>` : ''}
    </div>`;
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
            <p>최신 게시글 200개 중 숨김 처리되지 않은 공개 게시글 기준입니다.</p>
          </div>
          <div class="hall-info-rule">
            <b>인기글 산정</b>
            <p>좋아요×2 + 댓글×3 + 조회×0.1 점수로 정렬합니다.</p>
          </div>
          <div class="hall-info-rule">
            <b>AI킹 유형별</b>
            <p>${counts.map(item => `${item.label} ${fmt(item.count)}개`).join(' · ') || '유형별 데이터 없음'}</p>
          </div>
        </div>
      </div>
    </details>`;
}

export async function renderHall() {
  const el = document.getElementById('page-content');
  setMeta('통계', 'AI킹 인기글·유형별 랭킹 통계');

  el.innerHTML = `
    <div class="hall-page">
      <div id="hall-legend-box"></div>
      <div id="hall-info-box">${renderHallInfo([])}</div>
      <div class="hall-grid" id="hall-grid">
        ${Array.from({ length: 4 }, () => `<div class="skeleton-card" style="height:200px"></div>`).join('')}
      </div>
    </div>`;

  try {
    const recentSnap = await getDocs(query(
      collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(200),
    ));

    const posts = recentSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
    const legendPosts = [...posts]
      .filter(p => AI_TYPES.includes(postType(p)))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 5);

    document.getElementById('hall-legend-box').innerHTML = renderLegendSection(legendPosts);
    document.getElementById('hall-info-box').innerHTML = renderHallInfo(posts);

    document.getElementById('hall-grid').innerHTML = HALL_CATS.map(cat => {
      const pool = cat.type ? posts.filter(p => postType(p) === cat.type) : [...posts];
      const sorted = (cat.scoreKey === 'comment'
        ? [...pool].sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0))
        : [...pool].sort((a, b) => score(b) - score(a))
      ).slice(0, 3);
      return renderSection(cat, sorted);
    }).join('');

  } catch (e) {
    console.error(e);
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">데이터를 불러올 수 없어요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/hall')">다시 불러오기</button>
      </div>`;
  }
}

function renderSection({ label, icon, desc, type }, top3) {
  const medals = ['🥇', '🥈', '🥉'];
  return `
    <div class="hall-section">
      <div class="hall-section__head">
        <span class="hall-section__icon">${icon}</span>
        <div>
          <div class="hall-section__label">${label}</div>
          <div class="hall-section__desc">${desc}</div>
        </div>
        ${type ? `<a href="#/feed?type=${type}" class="hall-section__more">전체보기 →</a>` : ''}
      </div>
      ${top3.length ? top3.map((p, i) => `
        <div class="hall-item" onclick="navigate('/detail/${p.id}')" role="button">
          <span class="hall-medal">${medals[i]}</span>
          <div class="hall-item__body">
            <div class="hall-item__title">${escHtml(p.title || '(제목 없음)')}</div>
            ${aiResultSnippet(p)}
            <div class="hall-item__meta">❤️ ${fmt(p.reactions?.total)} · 💬 ${fmt(p.commentCount)} · 👁 ${fmt(p.viewCount)}</div>
          </div>
        </div>`).join('') : `
        <div class="hall-empty">아직 집계할 데이터가 없어요</div>`}
    </div>`;
}
