import { db } from '../firebase.js?v=20260630-3';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';
import { loadSafePublicResults } from '../utils/public-results.js?v=20260730-public-records-2';

const JUDGE_ICON = {
  '엄벌주의형': '👨‍⚖️',
  '감성형': '🥹',
  '현실주의형': '🤦',
  '과몰입형': '🔥',
  '피곤형': '😴',
  '논리집착형': '🧮',
  '드립형': '🎭',
  '소소킹 AI 재판부': '⚖️'
};

const JUDGE_TYPES = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function judgeTypeFor(id, r) {
  return r.judgeType || JUDGE_TYPES[hashString(id) % JUDGE_TYPES.length];
}

function grievanceFor(id, r) {
  const value = Number(r.grievanceIndex);
  return Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : (hashString(`${id}:grievance`) % 10) + 1;
}

function grievanceMeter(score) {
  return `<span class="board-grievance-meter" aria-label="억울지수 ${score}점">${Array.from({ length: 10 }, (_, index) => `<i class="${index < score ? 'active' : ''}"></i>`).join('')}</span>`;
}

function totalComments(r) {
  return Number(r.commentCount || 0);
}

function resultPath(id) {
  return `#/result/${encodeURIComponent(id)}`;
}

function discussionPath(id) {
  return `#/discussion/${encodeURIComponent(id)}`;
}

function summaryText(r) {
  return r.sentence || r.publicCaseDescription || r.verdict || '';
}

export async function renderBoard(container) {
  container.innerHTML = `
    <div class="court-board-page">
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">판결기록</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div style="margin-bottom:18px;">
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:900;color:var(--gold);margin-bottom:6px;">공개 판결기록</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">공개된 생활판결을 읽고 원고측·피고측·쌍방 중 하나를 선택해 사건별 토론에 참여할 수 있습니다.</div>
        </div>
        <div id="today-pick"></div>
        <div id="board-list"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  await loadBoardRecords(container);
}

async function loadBoardRecords(container) {
  const list = container.querySelector('#board-list');
  const todayPickElement = container.querySelector('#today-pick');
  if (!list || !todayPickElement) return;
  list.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  try {
    const rows = await loadSafePublicResults(db, { maxRows: 40, fallbackRows: 100 });
    if (!container.isConnected) return;

    if (!rows.length) {
      todayPickElement.innerHTML = '';
      list.innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);"><div style="font-size:46px;margin-bottom:12px;">📭</div>아직 공개된 판결기록이 없습니다.<br><a href="#/submit" style="color:var(--gold);margin-top:12px;display:inline-block;">첫 사건 접수하기</a></div>`;
      return;
    }

    const top = [...rows].sort((a, b) => totalComments(b[1]) - totalComments(a[1]))[0];
    todayPickElement.innerHTML = top ? todayPick(top) : '';
    list.innerHTML = `<div style="font-size:13px;color:var(--cream-dim);margin:18px 0 8px;">📜 최근 공개 판결기록</div><div style="display:flex;flex-direction:column;gap:10px;">${rows.map(row => boardRow(...row)).join('')}</div>`;
  } catch (err) {
    console.error('public board load failed:', err);
    todayPickElement.innerHTML = '';
    list.innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);">판결기록을 불러오지 못했습니다.<br><span style="font-size:12px;opacity:.7;">${escapeHtml(err.message || '')}</span><br><button type="button" id="board-retry" class="btn btn-secondary" style="margin-top:14px;">다시 불러오기</button></div>`;
    container.querySelector('#board-retry')?.addEventListener('click', () => loadBoardRecords(container));
  }
}

function todayPick([id, r]) {
  const judgeType = judgeTypeFor(id, r);
  const icon = r.judgeIcon || JUDGE_ICON[judgeType] || '⚖️';
  const grievance = grievanceFor(id, r);

  return `<div class="card board-featured-card" style="margin-bottom:16px;overflow:hidden;padding:0;border-color:rgba(201,168,76,.65);background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.03));">
    <a href="${resultPath(id)}" data-public-result-link="true" class="board-featured-link" style="display:block;padding:18px;color:inherit;text-decoration:none;">
      <div style="font-size:12px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:7px;">오늘의 판결기록</div>
      <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.42;margin-bottom:7px;">${escapeHtml(r.caseTitle || '제목 없음')}</div>
      <div class="board-featured-summary" style="font-size:14px;color:var(--cream-dim);line-height:1.6;margin-bottom:11px;">${escapeHtml(compactText(summaryText(r), 96))}</div>
      <div class="board-record-meta">
        <span class="board-judge-chip">${icon} ${escapeHtml(judgeType)} 판사</span>
        <span class="board-grievance-chip">억울지수 <strong>${grievance}/10</strong>${grievanceMeter(grievance)}</span>
      </div>
    </a>
    <div class="board-card-actions" style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--border);">
      <a href="${resultPath(id)}" style="padding:10px 8px;text-align:center;color:var(--cream-dim);text-decoration:none;font-size:12px;font-weight:800;">판결문 보기</a>
      <a href="${discussionPath(id)}" data-discussion-record-link="true" style="padding:10px 8px;text-align:center;color:var(--gold);text-decoration:none;font-size:12px;font-weight:900;border-left:1px solid var(--border);">💬 토론장 · ${totalComments(r)}개</a>
    </div>
  </div>`;
}

function boardRow(id, r) {
  const judgeType = judgeTypeFor(id, r);
  const icon = r.judgeIcon || JUDGE_ICON[judgeType] || '⚖️';
  const grievance = grievanceFor(id, r);
  const isDaily = r.source === 'daily_ai';

  return `<div class="card" style="overflow:hidden;padding:0;">
    <a href="${resultPath(id)}" data-public-result-link="true" class="board-row-link" style="display:block;padding:10px 16px 12px;color:inherit;text-decoration:none;">
      <div class="board-row-heading" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:4px;">
        <div class="board-row-title" style="font-weight:800;font-size:15px;line-height:1.42;flex:1;">${escapeHtml(r.caseTitle || '제목 없음')}</div>
        <div class="board-row-date" style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(fmtDate(r.createdAt))}</div>
      </div>
      <div class="board-row-summary" style="font-size:13px;color:var(--cream-dim);line-height:1.55;margin-bottom:9px;">${escapeHtml(compactText(summaryText(r), 86))}</div>
      <div class="board-record-meta board-record-meta-row">
        <span class="board-judge-chip">${icon} ${escapeHtml(judgeType)} 판사</span>
        <span class="board-grievance-chip">억울지수 <strong>${grievance}/10</strong>${grievanceMeter(grievance)}</span>
      </div>
      <div class="board-record-kind" style="margin-top:7px;font-size:11px;color:var(--cream-dim);">${isDaily ? '오늘의 AI 사건' : '생활사건 기록'}</div>
    </a>
    <div class="board-card-actions" style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--border);">
      <a href="${resultPath(id)}" style="padding:10px 8px;text-align:center;color:var(--cream-dim);text-decoration:none;font-size:12px;font-weight:800;">판결문 보기</a>
      <a href="${discussionPath(id)}" data-discussion-record-link="true" style="padding:10px 8px;text-align:center;color:var(--gold);text-decoration:none;font-size:12px;font-weight:900;border-left:1px solid var(--border);">💬 토론장 · ${totalComments(r)}개</a>
    </div>
  </div>`;
}
