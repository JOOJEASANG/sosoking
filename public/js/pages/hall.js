// 명예의 전당 — 판결소·상담소·번역소 각 분야 TOP 기록을 탭으로 분리해 보여준다.
// 판결 내용·승패·민심 분포·결과성 지표는 판결소 탭에서 보여주지 않고,
// 카드를 누르면 민심소의 같은 사건으로 이동한다.

import { db } from '../firebase.js?v=20260729-auth-session-1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { loadSafePublicResults } from '../utils/public-results.js?v=20260730-public-records-2';
import {
  doc, getDoc, collection, query, where, orderBy, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const JURY_TARGET_KEY = 'sosoking-jury-target-case';
const SIDES = ['plaintiff', 'defendant', 'both'];
const SECTION_SIZE = 5;
const CONTROVERSY_MIN_VOTES = 4;
const CONTROVERSY_CANDIDATES = 24;
const LIKE_TOP = 10;

const COUNSELOR_EMOJI = {
  musok: '🔮', uju: '🛸', halmae: '👵',
  tbal: '🤖', bungeo: '🐟', baeu: '🎭'
};

function reactionTotal(record = {}) {
  return Math.max(0, Number(record.reactionTotal || 0));
}

function commentCount(record = {}) {
  return Math.max(0, Number(record.commentCount || 0));
}

function buzzScore(record = {}) {
  return reactionTotal(record) + commentCount(record);
}

function judgeChip(record = {}) {
  const icon = String(record.judgeIcon || '⚖️');
  const type = String(record.judgeType || '소소킹 AI 재판부');
  return `<span class="hall-judge-chip">${escapeHtml(icon)} ${escapeHtml(type)}</span>`;
}

function ensureHallStyle() {
  if (document.getElementById('hall-style')) return;
  const style = document.createElement('style');
  style.id = 'hall-style';
  style.textContent = `
    .hall-page{min-height:100vh;}
    .hall-tabs{display:flex;gap:6px;margin:0 0 20px;border-bottom:1px solid var(--border);padding-bottom:0;}
    .hall-tab{flex:1;padding:10px 4px;font-size:13px;font-weight:800;color:var(--cream-dim);background:none;border:none;border-bottom:2.5px solid transparent;cursor:pointer;font-family:inherit;transition:color .15s,border-color .15s;}
    .hall-tab.active{color:var(--gold);border-bottom-color:var(--gold);}
    .hall-tab-panel[hidden]{display:none!important;}
    .hall-intro-title{font-family:var(--font-serif);font-size:22px;font-weight:900;color:var(--gold);margin-bottom:6px;}
    .hall-intro-copy{font-size:13px;color:var(--cream-dim);line-height:1.75;margin:0 0 20px;}
    .hall-section{margin-bottom:26px;}
    .hall-section-head{display:flex;align-items:baseline;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
    .hall-section-title{font-family:var(--font-serif);font-size:17px;font-weight:900;color:var(--cream);}
    .hall-section-desc{font-size:11px;color:var(--cream-dim);}
    .hall-list{display:flex;flex-direction:column;gap:9px;}
    .hall-card{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:11px;align-items:center;padding:14px 15px;text-align:left;color:inherit;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft);cursor:pointer;transition:border-color .15s ease,transform .15s ease;}
    .hall-card:hover,.hall-card:focus-visible{border-color:var(--gold);transform:translateY(-1px);outline:none;}
    .hall-rank{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:var(--navy);background:var(--gold);}
    .hall-rank.rank-2{background:#c9cdd6;}.hall-rank.rank-3{background:#d8a066;}.hall-rank.rank-n{background:var(--navy-light);color:var(--cream-dim);}
    .hall-card-body{min-width:0;}
    .hall-card-title{font-weight:850;font-size:15px;line-height:1.42;color:var(--cream);margin-bottom:7px;overflow-wrap:anywhere;}
    .hall-card-meta{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:11px;color:var(--cream-dim);}
    .hall-judge-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;border:1px solid var(--border);background:var(--navy-light);font-weight:800;color:var(--cream);}
    .hall-metric{font-weight:850;color:var(--gold);}
    .hall-card-cta{font-size:11px;font-weight:900;color:var(--gold);white-space:nowrap;padding:6px 9px;border:1px solid rgba(201,168,76,.3);border-radius:999px;background:rgba(201,168,76,.08);}
    .hall-empty{padding:18px;text-align:center;font-size:12.5px;color:var(--cream-dim);border:1px dashed var(--border);border-radius:12px;line-height:1.7;}
    .hall-cta{margin-top:6px;padding:17px;text-align:center;border:1px solid rgba(201,168,76,.4);border-radius:14px;background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.02));}
    .hall-cta p{margin:0 0 12px;font-size:13px;color:var(--cream-dim);line-height:1.65;}
    .hall-like-card{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 14px;text-align:left;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft);}
    .hall-like-body{min-width:0;}
    .hall-like-title{font-weight:800;font-size:14px;line-height:1.45;color:var(--cream);margin-bottom:5px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .hall-like-sub{font-size:11px;color:var(--cream-dim);}
    .hall-like-metric{font-size:12px;font-weight:900;color:var(--gold);white-space:nowrap;}
    [data-theme='light'] .hall-card-title,[data-theme='light'] .hall-section-title{color:#241a0f;}
    [data-theme='light'] .hall-card,[data-theme='light'] .hall-like-card{background:#fffaf1;}
    @media(max-width:520px){.hall-card{grid-template-columns:auto minmax(0,1fr);}.hall-card-cta{grid-column:2;justify-self:start;}}
  `;
  document.head.appendChild(style);
}

function rankBadge(index) {
  const rank = index + 1;
  const cls = rank === 1 ? '' : rank === 2 ? ' rank-2' : rank === 3 ? ' rank-3' : ' rank-n';
  return `<span class="hall-rank${cls}" aria-label="${rank}위">${rank}</span>`;
}

function cardHtml(index, caseId, record, metric) {
  return `<button type="button" class="hall-card" data-jury-case-id="${escapeHtml(caseId)}">
    ${rankBadge(index)}
    <span class="hall-card-body">
      <span class="hall-card-title">${escapeHtml(record.caseTitle || '생활분쟁 사건')}</span>
      <span class="hall-card-meta">${judgeChip(record)}<span class="hall-metric">${metric}</span></span>
    </span>
    <span class="hall-card-cta">블라인드 판정 ›</span>
  </button>`;
}

function likeCardHtml(index, d, href) {
  return `<a href="${escapeHtml(href)}" class="hall-like-card">
    ${rankBadge(index)}
    <span class="hall-like-body">
      <span class="hall-like-title">${escapeHtml(d.title || '')}</span>
      <span class="hall-like-sub">${escapeHtml(d.sub || '')}</span>
    </span>
    <span class="hall-like-metric">❤️ ${d.likes}</span>
  </a>`;
}

function sectionHtml(title, description, cards, emptyMessage) {
  return `<section class="hall-section">
    <div class="hall-section-head"><span class="hall-section-title">${title}</span><span class="hall-section-desc">${description}</span></div>
    <div class="hall-list">${cards || `<div class="hall-empty">${emptyMessage}</div>`}</div>
  </section>`;
}

function buzzSection(rows) {
  const ranked = rows
    .filter(([, record]) => buzzScore(record) > 0)
    .sort((a, b) => buzzScore(b[1]) - buzzScore(a[1]))
    .slice(0, SECTION_SIZE);
  const cards = ranked.map(([caseId, record], index) => cardHtml(
    index, caseId, record,
    `🗳️ ${reactionTotal(record)} · 💬 ${commentCount(record)}`
  )).join('');
  return sectionHtml('🔥 화제의 사건', '투표와 댓글 참여가 많이 쌓인 공개 사건', cards, '아직 참여 기록이 충분한 사건이 없습니다.');
}

function discussionSection(rows) {
  const ranked = rows
    .filter(([, record]) => commentCount(record) > 0)
    .sort((a, b) => commentCount(b[1]) - commentCount(a[1]) || reactionTotal(b[1]) - reactionTotal(a[1]))
    .slice(0, SECTION_SIZE);
  const cards = ranked.map(([caseId, record], index) => cardHtml(
    index, caseId, record, `💬 댓글 ${commentCount(record)}개`
  )).join('');
  return sectionHtml('💬 토론 활발 사건', '어느 쪽이 이겼는지는 숨기고 댓글 참여만 집계', cards, '아직 댓글 토론이 쌓인 사건이 없습니다.');
}

async function controversySection(rows) {
  const candidates = rows
    .filter(([, record]) => reactionTotal(record) >= CONTROVERSY_MIN_VOTES)
    .sort((a, b) => reactionTotal(b[1]) - reactionTotal(a[1]))
    .slice(0, CONTROVERSY_CANDIDATES);

  const scored = [];
  await Promise.all(candidates.map(async ([caseId, record]) => {
    try {
      const snapshot = await getDoc(doc(db, `result_reactions/${caseId}`));
      if (!snapshot.exists()) return;
      const counts = snapshot.data()?.counts || {};
      const total = SIDES.reduce((sum, side) => sum + Math.max(0, Number(counts[side] || 0)), 0);
      if (total < CONTROVERSY_MIN_VOTES) return;
      const largest = Math.max(...SIDES.map(side => Math.max(0, Number(counts[side] || 0))));
      const balance = 1 - (largest / total);
      scored.push({ caseId, record, total, score: balance * Math.log2(total + 1) });
    } catch (error) {
      console.warn('controversy reaction load failed:', error?.code || error);
    }
  }));

  scored.sort((a, b) => b.score - a.score);
  const cards = scored.slice(0, SECTION_SIZE)
    .map((item, index) => cardHtml(index, item.caseId, item.record, `🗳️ ${item.total}표 · 접전도 높음`))
    .join('');
  return sectionHtml('⚖️ 접전의 사건', '어느 쪽이 우세한지는 숨기고 팽팽함만 표시', cards, '아직 접전 랭킹을 만들 만큼 표가 쌓이지 않았습니다.');
}

async function loadLikeTop(colName) {
  try {
    const snap = await getDocs(query(
      collection(db, colName),
      where('isPublic', '==', true),
      orderBy('likeCount', 'desc'),
      limit(LIKE_TOP)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

function adviceCards(items) {
  if (!items.length) return '';
  return items.map((d, i) => likeCardHtml(i, {
    title: d.worry || '',
    sub: `${COUNSELOR_EMOJI[d.counselorId] || '🔮'} ${d.counselorName || ''}`,
    likes: d.likeCount || 0
  }, '#/clinic-list')).join('');
}

function translateCards(items) {
  if (!items.length) return '';
  return items.map((d, i) => likeCardHtml(i, {
    title: d.translated || '',
    sub: `${d.modeEmoji || '💥'} ${d.modeLabel || ''} — 원문: ${(d.originalText || '').slice(0, 30)}`,
    likes: d.likeCount || 0
  }, '#/translate-list')).join('');
}

function bindJuryLinks(container) {
  container.querySelectorAll('[data-jury-case-id]').forEach(button => {
    button.addEventListener('click', () => {
      const caseId = String(button.dataset.juryCaseId || '');
      if (!caseId) return;
      try { sessionStorage.setItem(JURY_TARGET_KEY, caseId); } catch {}
      location.hash = '#/jury';
    });
  });
}

function bindTabs(container, panels) {
  container.querySelectorAll('.hall-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.hall-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      panels.forEach(([id, el]) => { el.hidden = id !== target; });
    });
  });
}

export async function renderHall(container) {
  ensureHallStyle();
  container.innerHTML = `
    <div class="hall-page">
      <div class="page-header"><a href="#/" class="back-btn" aria-label="홈으로 돌아가기">‹</a><span class="logo">명예의 전당</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div class="hall-intro-title">명예의 전당</div>
        <nav class="hall-tabs" aria-label="분야 탭">
          <button type="button" class="hall-tab active" data-tab="verdict">⚖️ 판결소</button>
          <button type="button" class="hall-tab" data-tab="clinic">🔮 상담소</button>
          <button type="button" class="hall-tab" data-tab="translate">💥 번역소</button>
        </nav>
        <div id="hall-verdict-panel">
          <p class="hall-intro-copy">민심소에 쌓인 <strong style="color:var(--gold);">참여량과 접전도처럼 결론을 드러내지 않는 기록</strong>으로 만든 랭킹입니다. 판결 내용·승패·우세 방향은 여기서 미리 공개하지 않습니다.</p>
          <div id="hall-slot"><div class="loading-dots"><span></span><span></span><span></span></div></div>
        </div>
        <div id="hall-clinic-panel" hidden>
          <p class="hall-intro-copy" style="margin-bottom:14px;">좋아요가 많이 쌓인 처방전 TOP ${LIKE_TOP}</p>
          <div id="hall-clinic-slot"><div class="loading-dots"><span></span><span></span><span></span></div></div>
          <div style="margin-top:14px;text-align:right;"><a href="#/clinic-list" style="font-size:12px;color:var(--gold);">전체 처방전 보기 →</a></div>
        </div>
        <div id="hall-translate-panel" hidden>
          <p class="hall-intro-copy" style="margin-bottom:14px;">좋아요가 많이 쌓인 번역 명작 TOP ${LIKE_TOP}</p>
          <div id="hall-translate-slot"><div class="loading-dots"><span></span><span></span><span></span></div></div>
          <div style="margin-top:14px;text-align:right;"><a href="#/translate-list" style="font-size:12px;color:var(--gold);">전체 번역 보기 →</a></div>
        </div>
      </div>
    </div>`;

  const verdictPanel = container.querySelector('#hall-verdict-panel');
  const clinicPanel = container.querySelector('#hall-clinic-panel');
  const translatePanel = container.querySelector('#hall-translate-panel');

  const panels = [
    ['verdict', verdictPanel],
    ['clinic', clinicPanel],
    ['translate', translatePanel]
  ];
  bindTabs(container, panels);

  // 판결소 탭 로드
  const slot = container.querySelector('#hall-slot');
  let rows;
  try {
    rows = await loadSafePublicResults(db, { maxRows: 100, fallbackRows: 200 });
  } catch (error) {
    console.error('hall load failed:', error);
    slot.innerHTML = '<div class="hall-empty">명예의 전당을 불러오지 못했습니다.<br><button type="button" id="hall-retry" class="btn btn-secondary" style="margin-top:10px;">다시 불러오기</button></div>';
    slot.querySelector('#hall-retry')?.addEventListener('click', () => renderHall(container));
    return;
  }

  if (!container.isConnected) return;
  if (!rows.length) {
    slot.innerHTML = '<div class="hall-empty">아직 공개된 사건이 없습니다.<br><a href="#/submit" style="display:inline-block;margin-top:8px;color:var(--gold);">첫 사건 접수하기 →</a></div>';
  } else {
    const controversy = await controversySection(rows);
    if (!container.isConnected) return;
    slot.innerHTML = `
      ${buzzSection(rows)}
      ${controversy}
      ${discussionSection(rows)}
      <div class="hall-cta">
        <p>랭킹만 보고 결론 내리기는 금지입니다.<br>판결을 가린 채 사건부터 읽고 직접 한 표를 정해보세요.</p>
        <a href="#/jury" class="btn btn-primary">🗳️ 민심소에서 판정하기</a>
      </div>`;
    bindJuryLinks(container);
  }

  // 상담소/번역소 탭: 탭 클릭 시 지연 로드
  let clinicLoaded = false;
  let translateLoaded = false;

  container.querySelectorAll('.hall-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      const t = tab.dataset.tab;
      if (t === 'clinic' && !clinicLoaded) {
        clinicLoaded = true;
        const cs = container.querySelector('#hall-clinic-slot');
        const items = await loadLikeTop('advice_results');
        cs.innerHTML = items.length
          ? `<div class="hall-list">${adviceCards(items)}</div>`
          : '<div class="hall-empty">아직 좋아요 기록이 없습니다.<br><a href="#/clinic" style="color:var(--gold);">상담소에서 처방 받기 →</a></div>';
      }
      if (t === 'translate' && !translateLoaded) {
        translateLoaded = true;
        const ts = container.querySelector('#hall-translate-slot');
        const items = await loadLikeTop('translation_results');
        ts.innerHTML = items.length
          ? `<div class="hall-list">${translateCards(items)}</div>`
          : '<div class="hall-empty">아직 좋아요 기록이 없습니다.<br><a href="#/translate" style="color:var(--gold);">번역소에서 번역하기 →</a></div>';
      }
    });
  });
}
