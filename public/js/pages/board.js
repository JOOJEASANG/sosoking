import { db } from '../firebase.js?v=20260630-3';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦','과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};
const SORTS = [
  ['latest', '최신', '방금 선고'],
  ['popular', '인기', '투표+댓글'],
  ['masterpiece', '명판결', '웃겼다 반응'],
];

let boardRows = [];
let activeSort = 'latest';

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function timestampOf(r) {
  const value = r.createdAt;
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const d = value.toDate ? value.toDate() : new Date(value);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}
function totalVotes(r) { return Number(r.reactionTotal || r.totalVotes || 0); }
function totalComments(r) { return Number(r.commentCount || 0); }
function funnyVotes(r) { return Number(r.reactionCounts?.funny || 0); }
function engagement(r) { return totalVotes(r) + totalComments(r) * 2; }
function titleOf(r) { return r.absurdityTitle || r.caseTitle || '제목 없음'; }
function previewOf(r) { return compactText(r.closingComment || r.sentence || r.verdict || r.courtOpinion || '', 110); }
function casePreviewOf(r) { return compactText(r.caseDescription || '', 86); }
function casePreviewHtml(r) {
  const text = casePreviewOf(r);
  return text ? `<div style="font-size:12px;color:var(--cream-dim);line-height:1.55;margin:2px 0 8px;opacity:.92;">사건내용 · ${escapeHtml(text)}</div>` : '';
}
function sortedRows() {
  const rows = [...boardRows];
  if (activeSort === 'popular') {
    return rows.sort((a, b) => engagement(b[1]) - engagement(a[1]) || timestampOf(b[1]) - timestampOf(a[1]));
  }
  if (activeSort === 'masterpiece') {
    return rows.sort((a, b) => funnyVotes(b[1]) - funnyVotes(a[1]) || engagement(b[1]) - engagement(a[1]) || timestampOf(b[1]) - timestampOf(a[1]));
  }
  return rows.sort((a, b) => timestampOf(b[1]) - timestampOf(a[1]));
}
function tabDescription() {
  if (activeSort === 'popular') return '투표 1점, 댓글 2점으로 계산한 참여 순위입니다.';
  if (activeSort === 'masterpiece') return '방청객의 “웃겼다” 반응을 가장 많이 받은 순위입니다.';
  return '최근 공개된 황당판결부터 표시합니다.';
}

export async function renderBoard(container) {
  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">황당판결 기록</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div style="margin-bottom:18px;">
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:900;color:var(--gold);margin-bottom:6px;">공개 황당판결 기록</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">다른 사람들이 공개한 사소하고 황당한 재판 기록입니다. 판결문을 열람하고 원고 편·피고 편 투표와 방청석 한마디를 남길 수 있습니다.</div>
        </div>
        <div class="arena-rank-tabs" id="board-rank-tabs">
          ${SORTS.map(([id, label, sub]) => `<button type="button" data-sort="${id}" class="${id === activeSort ? 'active' : ''}"><strong>${label}</strong><span>${sub}</span></button>`).join('')}
        </div>
        <div id="board-sort-note" style="font-size:11px;color:var(--cream-dim);line-height:1.6;margin:-4px 0 14px;text-align:center;">${tabDescription()}</div>
        <div id="today-pick"></div>
        <div id="board-list"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  document.getElementById('board-rank-tabs')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-sort]');
    if (!button || button.dataset.sort === activeSort) return;
    activeSort = button.dataset.sort;
    document.querySelectorAll('#board-rank-tabs button').forEach(el => el.classList.toggle('active', el === button));
    const note = document.getElementById('board-sort-note');
    if (note) note.textContent = tabDescription();
    renderRows();
  });

  try {
    const snap = await getDocs(query(collection(db, 'results'), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(100)));
    if (snap.empty) {
      document.getElementById('board-list').innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);"><div style="font-size:46px;margin-bottom:12px;">📭</div>아직 공개된 황당판결 기록이 없습니다.<br><a href="#/submit" style="color:var(--gold);margin-top:12px;display:inline-block;">첫 황당사건 접수하기</a></div>`;
      return;
    }
    boardRows = snap.docs.map(d => [d.id, d.data()]);
    renderRows();
  } catch (err) {
    console.error(err);
    document.getElementById('board-list').innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);">황당판결 기록을 불러오지 못했습니다.<br><span style="font-size:12px;opacity:.7;">${escapeHtml(err.message || '')}</span></div>`;
  }
}

function renderRows() {
  const rows = sortedRows();
  const pick = rows[0];
  const pickEl = document.getElementById('today-pick');
  const list = document.getElementById('board-list');
  if (!pickEl || !list) return;
  pickEl.innerHTML = pick ? popularPick(pick) : '';
  const heading = activeSort === 'latest' ? '최근 공개 황당판결' : activeSort === 'popular' ? '방청석 참여 순위' : '웃겼다 명판결 순위';
  list.innerHTML = `<div style="font-size:13px;color:var(--cream-dim);margin:18px 0 8px;">📜 ${heading} <span style="font-size:11px;opacity:.72;">최근 ${rows.length}건 기준</span></div><div style="display:flex;flex-direction:column;gap:10px;">${rows.map((row, index) => boardRow(row[0], row[1], index)).join('')}</div>`;
}

function popularPick([id, r]) {
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const label = activeSort === 'latest' ? '방금 선고된 황당판결' : activeSort === 'popular' ? '방청석 인기 황당판결' : '웃겼다 명판결 1위';
  return `<div class="card" onclick="location.hash='#/result/${encodeURIComponent(id)}'" style="padding:20px;margin-bottom:16px;cursor:pointer;border-color:rgba(201,168,76,.65);background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.03));">
    <div style="font-size:12px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:8px;">${label}</div>
    <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;margin-bottom:8px;">${escapeHtml(titleOf(r))}</div>
    ${casePreviewHtml(r)}
    <div style="font-size:14px;color:var(--cream-dim);line-height:1.65;margin-bottom:12px;">${escapeHtml(previewOf(r))}</div>
    <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--cream-dim);"><span>${icon} ${escapeHtml(r.judgeType || 'AI')} 재판부</span><span>😂 ${funnyVotes(r)} · 🧑‍⚖️ ${totalVotes(r)} · 💬 ${totalComments(r)}</span></div>
  </div>`;
}
function boardRow(id, r, index) {
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const isDaily = r.source === 'daily_ai';
  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : String(index + 1);
  return `<div class="card court-board-row" onclick="location.hash='#/result/${encodeURIComponent(id)}'" style="padding:16px 18px;cursor:pointer;position:relative;border-left:3px solid rgba(201,168,76,.5);">
    <div class="court-kicker" style="margin-bottom:7px;"><span class="rank-medal">${medal}</span> ABSURD RECORD</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;"><div style="font-weight:800;font-size:15px;line-height:1.45;flex:1;">${escapeHtml(titleOf(r))}</div><div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(fmtDate(r.createdAt))}</div></div>
    ${casePreviewHtml(r)}
    <div style="font-size:13px;color:var(--cream-dim);line-height:1.6;margin-bottom:10px;">${escapeHtml(previewOf(r))}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;"><span style="color:var(--cream-dim);">${icon} ${escapeHtml(r.judgeType || 'AI')} · 억울지수 ${escapeHtml(r.grievanceIndex || '?')}/10</span><span style="color:var(--gold);white-space:nowrap;">😂 ${funnyVotes(r)} · 🧑‍⚖️ ${totalVotes(r)} · 💬 ${totalComments(r)} →</span></div>
    ${isDaily ? `<div style="margin-top:8px;font-size:11px;color:var(--gold);font-weight:800;">오늘의 AI 황당사건</div>` : ''}
  </div>`;
}
