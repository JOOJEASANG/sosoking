// 명예의 전당 — 판결기록(읽는 목록)을 대신하는 '결과 구경' 재미 요소.
//
// 민심소가 사건에 참여(투표+논쟁)하는 곳이라면, 여기는 그 결과가 쌓여 만들어진
// 랭킹을 구경하는 곳이다. 세 갈래로 줄을 세운다.
//   1) 화제의 판결   — 투표+댓글이 가장 많이 붙은 사건
//   2) 논란의 판결   — 찬반이 가장 팽팽하게 갈린 사건
//   3) 억울지수 TOP  — 재판부가 인정한 체감 억울함이 가장 큰 사건
//
// 랭킹 지표는 대부분 결과 문서에 비정규화되어 있다(reactionTotal, commentCount,
// grievanceIndex). '논란'만 표 구성이 필요해서, 표가 많이 붙은 후보에 한해
// result_reactions를 읽어 갈림 정도를 계산한다.

import { db } from '../firebase.js?v=20260630-3';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';
import { loadSafePublicResults } from '../utils/public-results.js?v=20260730-public-records-2';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const SIDES = ['plaintiff', 'defendant', 'both'];
const SIDE_LABEL = { plaintiff: '원고', defendant: '피고', both: '쌍방' };
const CONTROVERSY_MIN_VOTES = 4;
const CONTROVERSY_CANDIDATES = 24;
const SECTION_SIZE = 5;

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function grievanceFor(id, r) {
  const value = Number(r.grievanceIndex);
  return Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : (hashString(`${id}:grievance`) % 10) + 1;
}

function reactionTotal(r) {
  return Math.max(0, Number(r.reactionTotal || 0));
}

function commentCount(r) {
  return Math.max(0, Number(r.commentCount || 0));
}

function buzzScore(r) {
  return reactionTotal(r) + commentCount(r);
}

function summaryText(r) {
  return r.sentence || r.publicCaseDescription || r.verdict || '';
}

function resultPath(id) {
  return `#/result/${encodeURIComponent(id)}`;
}

function judgeChip(r) {
  const icon = r.judgeIcon || '⚖️';
  const type = r.judgeType || '소소킹 AI 재판부';
  return `<span class="hall-judge-chip">${escapeHtml(icon)} ${escapeHtml(type)}</span>`;
}

function ensureHallStyle() {
  if (document.getElementById('hall-style')) return;
  const style = document.createElement('style');
  style.id = 'hall-style';
  style.textContent = `
    .hall-page{min-height:100vh;}
    .hall-intro-title{font-family:var(--font-serif);font-size:22px;font-weight:900;color:var(--gold);margin-bottom:6px;}
    .hall-intro-copy{font-size:13px;color:var(--cream-dim);line-height:1.7;margin:0 0 18px;}
    .hall-section{margin-bottom:24px;}
    .hall-section-head{display:flex;align-items:baseline;gap:8px;margin-bottom:10px;}
    .hall-section-title{font-family:var(--font-serif);font-size:17px;font-weight:900;color:var(--cream);}
    .hall-section-desc{font-size:11px;color:var(--cream-dim);}
    .hall-list{display:flex;flex-direction:column;gap:9px;}
    .hall-card{display:block;padding:13px 15px;color:inherit;text-decoration:none;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft);transition:border-color .15s ease,transform .15s ease;}
    .hall-card:hover{border-color:var(--gold);transform:translateY(-1px);}
    .hall-card-top{display:flex;gap:11px;align-items:flex-start;}
    .hall-rank{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:var(--navy);background:var(--gold);}
    .hall-rank.rank-2{background:#c9cdd6;}
    .hall-rank.rank-3{background:#d8a066;}
    .hall-rank.rank-n{background:var(--navy-light);color:var(--cream-dim);}
    .hall-card-body{flex:1;min-width:0;}
    .hall-card-title{font-weight:800;font-size:15px;line-height:1.4;color:var(--cream);margin-bottom:3px;}
    .hall-card-summary{font-size:12.5px;color:var(--cream-dim);line-height:1.55;margin-bottom:8px;}
    .hall-card-meta{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:11px;color:var(--cream-dim);}
    .hall-judge-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;border:1px solid var(--border);background:var(--navy-light);font-weight:800;color:var(--cream);}
    .hall-metric{font-weight:900;color:var(--gold);}
    .hall-split{display:flex;gap:4px;height:7px;border-radius:999px;overflow:hidden;margin-top:8px;background:var(--navy-light);}
    .hall-split i{display:block;height:100%;}
    .hall-split .seg-plaintiff{background:var(--red);}
    .hall-split .seg-defendant{background:var(--green);}
    .hall-split .seg-both{background:var(--gold);}
    .hall-split-legend{display:flex;gap:10px;margin-top:5px;font-size:10px;color:var(--cream-dim);}
    .hall-grievance-meter{display:inline-flex;gap:2px;vertical-align:middle;}
    .hall-grievance-meter i{width:5px;height:9px;border-radius:1px;background:var(--navy-light);}
    .hall-grievance-meter i.active{background:var(--gold);}
    .hall-empty{padding:16px;text-align:center;font-size:12.5px;color:var(--cream-dim);border:1px dashed var(--border);border-radius:12px;}
    .hall-cta{margin-top:6px;padding:16px;text-align:center;border:1px solid rgba(201,168,76,.4);border-radius:14px;background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.02));}
    .hall-cta p{margin:0 0 12px;font-size:13px;color:var(--cream-dim);line-height:1.6;}
    [data-theme='light'] .hall-card-title,[data-theme='light'] .hall-section-title{color:#241a0f;}
    [data-theme='light'] .hall-card{background:#fffaf1;}
  `;
  document.head.appendChild(style);
}

function grievanceMeter(score) {
  return `<span class="hall-grievance-meter" aria-label="억울지수 ${score}점">${
    Array.from({ length: 10 }, (_, index) => `<i class="${index < score ? 'active' : ''}"></i>`).join('')
  }</span>`;
}

function rankBadge(index) {
  const rank = index + 1;
  const cls = rank === 1 ? '' : rank === 2 ? ' rank-2' : rank === 3 ? ' rank-3' : ' rank-n';
  return `<span class="hall-rank${cls}">${rank}</span>`;
}

function cardHtml(index, id, r, metricHtml, extraHtml = '') {
  return `<a class="hall-card" href="${resultPath(id)}" data-public-result-link="true">
    <div class="hall-card-top">
      ${rankBadge(index)}
      <div class="hall-card-body">
        <div class="hall-card-title">${escapeHtml(r.caseTitle || '생활분쟁 사건')}</div>
        <div class="hall-card-summary">${escapeHtml(compactText(summaryText(r), 78))}</div>
        <div class="hall-card-meta">${judgeChip(r)}${metricHtml}</div>
        ${extraHtml}
      </div>
    </div>
  </a>`;
}

function sectionHtml(title, desc, cardsHtml, emptyMsg) {
  return `<section class="hall-section">
    <div class="hall-section-head">
      <span class="hall-section-title">${title}</span>
      <span class="hall-section-desc">${desc}</span>
    </div>
    <div class="hall-list">${cardsHtml || `<div class="hall-empty">${emptyMsg}</div>`}</div>
  </section>`;
}

function buzzSection(rows) {
  const ranked = rows
    .filter(([, r]) => buzzScore(r) > 0)
    .sort((a, b) => buzzScore(b[1]) - buzzScore(a[1]))
    .slice(0, SECTION_SIZE);
  const cards = ranked.map(([id, r], index) => {
    const metric = `<span class="hall-metric">🗳️ ${reactionTotal(r)}표 · 💬 ${commentCount(r)}</span>`;
    return cardHtml(index, id, r, metric);
  }).join('');
  return sectionHtml('🔥 화제의 판결', '투표·논쟁이 가장 뜨거운 사건', cards, '아직 참여가 쌓인 사건이 없습니다. 민심소에서 첫 표를 던져보세요.');
}

function grievanceSection(rows) {
  const ranked = [...rows]
    .sort((a, b) => {
      const diff = grievanceFor(b[0], b[1]) - grievanceFor(a[0], a[1]);
      return diff !== 0 ? diff : buzzScore(b[1]) - buzzScore(a[1]);
    })
    .slice(0, SECTION_SIZE);
  const cards = ranked.map(([id, r], index) => {
    const score = grievanceFor(id, r);
    const metric = `<span class="hall-metric">억울지수 ${score}/10</span>${grievanceMeter(score)}`;
    return cardHtml(index, id, r, metric);
  }).join('');
  return sectionHtml('😤 억울지수 TOP', '재판부가 인정한 체감 억울함이 큰 사건', cards, '아직 공개된 사건이 없습니다.');
}

function splitBar(counts, total) {
  const segs = SIDES.map(side => {
    const percent = total > 0 ? Math.round((Number(counts[side] || 0) / total) * 100) : 0;
    return `<i class="seg-${side}" style="width:${percent}%"></i>`;
  }).join('');
  const legend = SIDES.map(side => {
    const percent = total > 0 ? Math.round((Number(counts[side] || 0) / total) * 100) : 0;
    return `<span>${SIDE_LABEL[side]} ${percent}%</span>`;
  }).join('');
  return `<div class="hall-split" aria-hidden="true">${segs}</div><div class="hall-split-legend">${legend}</div>`;
}

// 갈림 정도: 최다 득표 비율이 낮을수록(=고르게 갈릴수록) 논란이 크다.
// 표가 어느 정도 쌓인 사건만 대상으로 삼는다.
async function controversySection(rows) {
  const candidates = rows
    .filter(([, r]) => reactionTotal(r) >= CONTROVERSY_MIN_VOTES)
    .sort((a, b) => reactionTotal(b[1]) - reactionTotal(a[1]))
    .slice(0, CONTROVERSY_CANDIDATES);

  const scored = [];
  await Promise.all(candidates.map(async ([id, r]) => {
    try {
      const snap = await getDoc(doc(db, `result_reactions/${id}`));
      if (!snap.exists()) return;
      const counts = snap.data()?.counts || {};
      const total = SIDES.reduce((sum, side) => sum + Number(counts[side] || 0), 0);
      if (total < CONTROVERSY_MIN_VOTES) return;
      const maxShare = Math.max(...SIDES.map(side => Number(counts[side] || 0))) / total;
      // 갈림 점수: 팽팽할수록(=maxShare 낮을수록) 높고, 표가 많을수록 가산.
      const score = (1 - maxShare) * Math.log2(total + 1);
      scored.push({ id, r, counts, total, score });
    } catch (error) {
      console.warn('controversy reaction load failed:', error?.code || error);
    }
  }));

  scored.sort((a, b) => b.score - a.score);
  const cards = scored.slice(0, SECTION_SIZE).map((item, index) => {
    const metric = `<span class="hall-metric">🗳️ ${item.total}표</span>`;
    const extra = splitBar(item.counts, item.total);
    return cardHtml(index, item.id, item.r, metric, extra);
  }).join('');
  return sectionHtml('⚖️ 논란의 판결', '찬반이 가장 팽팽하게 갈린 사건', cards, '아직 표가 팽팽하게 갈린 사건이 없습니다. 민심소에서 판정에 참여해보세요.');
}

export async function renderHall(container) {
  ensureHallStyle();
  container.innerHTML = `
    <div class="hall-page">
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">명예의 전당</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div class="hall-intro-title">명예의 전당</div>
        <p class="hall-intro-copy">민심소에 쌓인 판정과 논쟁으로 줄 세운 랭킹입니다. 참여는 민심소에서, 결과 구경은 여기에서.</p>
        <div id="hall-slot"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  const slot = container.querySelector('#hall-slot');
  if (!slot) return;

  let rows;
  try {
    rows = await loadSafePublicResults(db, { maxRows: 100, fallbackRows: 200 });
  } catch (error) {
    console.error('hall load failed:', error);
    slot.innerHTML = `<div class="hall-empty">명예의 전당을 불러오지 못했습니다.<br><button type="button" id="hall-retry" class="btn btn-secondary" style="margin-top:12px;">다시 시도</button></div>`;
    slot.querySelector('#hall-retry')?.addEventListener('click', () => renderHall(container));
    return;
  }
  if (!container.isConnected) return;

  if (!rows.length) {
    slot.innerHTML = `<div class="hall-empty" style="padding:52px 16px;"><div style="font-size:44px;margin-bottom:12px;">🏆</div>아직 전당에 오른 사건이 없습니다.<br><a href="#/submit" style="color:var(--gold);margin-top:12px;display:inline-block;">첫 사건 접수하기</a></div>`;
    return;
  }

  const controversy = await controversySection(rows);
  if (!container.isConnected) return;

  slot.innerHTML = `
    ${buzzSection(rows)}
    ${controversy}
    ${grievanceSection(rows)}`;
}
