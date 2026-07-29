import { db } from '../firebase.js?v=20260630-3';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

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

function totalVotes(r) {
  return Number(r.reactionTotal || r.totalVotes || 0);
}

function totalComments(r) {
  return Number(r.commentCount || 0);
}

function publicResultPath(id) {
  return `/result/${encodeURIComponent(id)}`;
}

export async function renderBoard(container) {
  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">판결기록</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div style="margin-bottom:18px;">
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:900;color:var(--gold);margin-bottom:6px;">공개 판결기록</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">다른 사람들이 공개한 생활판결 기록입니다. 판사 성향과 랜덤 억울지수를 확인하고 판결문에 투표와 방청석 한마디를 남길 수 있습니다.</div>
        </div>
        <div id="today-pick"></div>
        <div id="board-list"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  const list = document.getElementById('board-list');
  try {
    const snap = await getDocs(query(
      collection(db, 'results'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(40)
    ));

    if (snap.empty) {
      list.innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);"><div style="font-size:46px;margin-bottom:12px;">📭</div>아직 공개된 판결기록이 없습니다.<br><a href="#/submit" style="color:var(--gold);margin-top:12px;display:inline-block;">첫 사건 접수하기</a></div>`;
      return;
    }

    const rows = snap.docs.map(d => [d.id, d.data()]);
    const top = [...rows].sort((a, b) => (totalVotes(b[1]) + totalComments(b[1])) - (totalVotes(a[1]) + totalComments(a[1])))[0];
    document.getElementById('today-pick').innerHTML = top ? todayPick(top) : '';
    list.innerHTML = `<div style="font-size:13px;color:var(--cream-dim);margin:18px 0 8px;">📜 최근 공개 판결기록</div><div style="display:flex;flex-direction:column;gap:10px;">${rows.map(row => boardRow(...row)).join('')}</div>`;
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);">판결기록을 불러오지 못했습니다.<br><span style="font-size:12px;opacity:.7;">${escapeHtml(err.message || '')}</span></div>`;
  }
}

function todayPick([id, r]) {
  const judgeType = judgeTypeFor(id, r);
  const icon = r.judgeIcon || JUDGE_ICON[judgeType] || '⚖️';
  const grievance = grievanceFor(id, r);

  return `<a href="${publicResultPath(id)}" class="card board-featured-card" style="display:block;padding:20px;margin-bottom:16px;cursor:pointer;border-color:rgba(201,168,76,.65);background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.03));color:inherit;text-decoration:none;">
    <div style="font-size:12px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:8px;">오늘의 판결기록</div>
    <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;margin-bottom:8px;">${escapeHtml(r.caseTitle || '제목 없음')}</div>
    <div style="font-size:14px;color:var(--cream-dim);line-height:1.65;margin-bottom:13px;">${escapeHtml(compactText(r.sentence || r.caseDescription || r.verdict || '', 96))}</div>
    <div class="board-record-meta">
      <span class="board-judge-chip">${icon} ${escapeHtml(judgeType)} 판사</span>
      <span class="board-grievance-chip">억울지수 <strong>${grievance}/10</strong>${grievanceMeter(grievance)}</span>
    </div>
    <div style="margin-top:10px;text-align:right;font-size:12px;color:var(--cream-dim);">🧑‍⚖️ ${totalVotes(r)}표 · 💬 ${totalComments(r)}</div>
  </a>`;
}

function boardRow(id, r) {
  const judgeType = judgeTypeFor(id, r);
  const icon = r.judgeIcon || JUDGE_ICON[judgeType] || '⚖️';
  const grievance = grievanceFor(id, r);
  const isDaily = r.source === 'daily_ai';

  return `<a href="${publicResultPath(id)}" class="card" style="display:block;padding:16px 18px;cursor:pointer;color:inherit;text-decoration:none;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;"><div style="font-weight:800;font-size:15px;line-height:1.45;flex:1;">${escapeHtml(r.caseTitle || '제목 없음')}</div><div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(fmtDate(r.createdAt))}</div></div>
    <div style="font-size:13px;color:var(--cream-dim);line-height:1.6;margin-bottom:11px;">${escapeHtml(compactText(r.sentence || r.caseDescription || r.verdict || '', 86))}</div>
    <div class="board-record-meta board-record-meta-row">
      <span class="board-judge-chip">${icon} ${escapeHtml(judgeType)} 판사</span>
      <span class="board-grievance-chip">억울지수 <strong>${grievance}/10</strong>${grievanceMeter(grievance)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;font-size:12px;">
      <span style="color:var(--cream-dim);">${isDaily ? '오늘의 AI 사건' : '생활사건 기록'}</span>
      <span style="color:var(--gold);white-space:nowrap;">🧑‍⚖️ ${totalVotes(r)} · 💬 ${totalComments(r)} →</span>
    </div>
  </a>`;
}
