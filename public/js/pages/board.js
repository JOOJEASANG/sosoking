import { db } from '../firebase.js?v=20260630-3';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const JUDGE_ICON = {
  '엄벌주의형':'🚨','감성형':'🥹','현실주의형':'🧊','과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function totalVotes(r) { return Number(r.reactionTotal || r.totalVotes || 0); }
function kingVotes(r) { return Number(r.kingCount || 0); }
function totalComments(r) { return Number(r.commentCount || 0); }
function funAvg(r) { return Number(r.funScoreAvg || 0); }
function funCount(r) { return Number(r.funScoreCount || 0); }
function rankScore(r) {
  const avg = funAvg(r);
  const count = funCount(r);
  return avg * 100 + Math.min(count, 20) * 8 + kingVotes(r) * 5 + totalComments(r);
}
function summaryOf(r, max = 96) {
  return compactText(r.breakingNews || r.finalDecision || r.sentence || r.verdict || '', max);
}
function scoreLabel(r) {
  return funCount(r) ? `${funAvg(r).toFixed(1)}점 · ${funCount(r)}명` : '평가 대기';
}

export async function renderBoard(container) {
  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">공개 기록</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div style="margin-bottom:18px;">
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:900;color:var(--gold);margin-bottom:6px;">소소킹 공개 기록</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">모기, 라면, 리모컨 같은 한 줄 소소사건 기록입니다. 유저들이 <b style="color:var(--gold);">웃김 점수 1~10점</b>을 매기면 평균 점수 순으로 소소킹 후보가 올라갑니다.</div>
        </div>
        <div id="today-pick"></div>
        <div id="king-list"></div>
        <div id="board-list"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  const list = document.getElementById('board-list');
  try {
    const snap = await getDocs(query(collection(db, 'results'), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(50)));
    if (snap.empty) {
      list.innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);"><div style="font-size:46px;margin-bottom:12px;">📭</div>아직 공개된 긴급 기록이 없습니다.<br><a href="#/submit" style="color:var(--gold);margin-top:12px;display:inline-block;">첫 소소사건 접수하기</a></div>`;
      return;
    }
    const rows = snap.docs.map(d => [d.id, d.data()]);
    const ranked = [...rows].sort((a, b) => rankScore(b[1]) - rankScore(a[1]));
    const top = ranked[0];
    document.getElementById('today-pick').innerHTML = top ? todayPick(top) : '';
    document.getElementById('king-list').innerHTML = ranked.length ? kingList(ranked.slice(0, 5)) : '';
    list.innerHTML = `<div style="font-size:13px;color:var(--cream-dim);margin:18px 0 8px;">📡 최근 공개 긴급기록</div><div style="display:flex;flex-direction:column;gap:10px;">${rows.map((row, idx) => boardRow(row[0], row[1], idx)).join('')}</div>`;
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);">공개 기록을 불러오지 못했습니다.<br><span style="font-size:12px;opacity:.7;">${escapeHtml(err.message || '')}</span></div>`;
  }
}

function todayPick([id, r]) {
  const icon = JUDGE_ICON[r.judgeType] || '📡';
  return `<div class="card" onclick="location.hash='#/result/${encodeURIComponent(id)}'" style="padding:20px;margin-bottom:16px;cursor:pointer;border-color:rgba(201,168,76,.75);background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(231,76,60,.12),rgba(255,255,255,.03));">
    <div style="font-size:12px;color:var(--gold);font-weight:900;letter-spacing:.12em;margin-bottom:8px;">👑 현재 소소킹 1위</div>
    <div style="font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;margin-bottom:8px;">${escapeHtml(r.caseTitle || '제목 없음')}</div>
    <div style="font-size:14px;color:var(--cream-dim);line-height:1.65;margin-bottom:12px;">${escapeHtml(summaryOf(r, 100))}</div>
    <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--cream-dim);"><span>${icon} ${escapeHtml(r.judgeType || 'AI')} 위원</span><span>😂 ${scoreLabel(r)} · 👑 ${kingVotes(r)} · 💬 ${totalComments(r)}</span></div>
  </div>`;
}

function kingList(rows) {
  return `<div style="margin-bottom:16px;">
    <div style="font-size:13px;color:var(--cream-dim);margin:0 0 8px;">😂 웃김 점수 TOP 5</div>
    <div style="display:grid;grid-template-columns:1fr;gap:8px;">
      ${rows.map(([id, r], idx) => `<div class="card" onclick="location.hash='#/result/${encodeURIComponent(id)}'" style="padding:13px 14px;cursor:pointer;display:flex;gap:10px;align-items:center;">
        <div style="min-width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ffdf7a,#ff7166);color:#151515;font-weight:900;">${idx + 1}</div>
        <div style="flex:1;min-width:0;"><div style="font-weight:900;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.caseTitle || '제목 없음')}</div><div style="font-size:12px;color:var(--cream-dim);margin-top:2px;">😂 ${scoreLabel(r)} · ${escapeHtml(summaryOf(r, 44))}</div></div>
      </div>`).join('')}
    </div>
  </div>`;
}

function boardRow(id, r, idx = 0) {
  const icon = JUDGE_ICON[r.judgeType] || '📡';
  const isDaily = r.source === 'daily_ai';
  const rank = funAvg(r) >= 9 && funCount(r) >= 3 ? '소소킹 후보' : '긴급기록';
  return `<div class="card" onclick="location.hash='#/result/${encodeURIComponent(id)}'" style="padding:16px 18px;cursor:pointer;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;"><div style="font-weight:800;font-size:15px;line-height:1.45;flex:1;">${idx < 3 ? '👑 ' : ''}${escapeHtml(r.caseTitle || '제목 없음')}</div><div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(fmtDate(r.createdAt))}</div></div>
    <div style="font-size:13px;color:var(--cream-dim);line-height:1.6;margin-bottom:10px;">${escapeHtml(summaryOf(r, 90))}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;"><span style="color:var(--cream-dim);">${icon} ${escapeHtml(r.judgeType || 'AI')} 위원 · ${rank}</span><span style="color:var(--gold);white-space:nowrap;">😂 ${scoreLabel(r)} →</span></div>
    ${isDaily ? `<div style="margin-top:8px;font-size:11px;color:var(--gold);font-weight:800;">오늘의 AI 소소사건</div>` : ''}
  </div>`;
}
