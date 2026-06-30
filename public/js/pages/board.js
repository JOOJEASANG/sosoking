import { db } from '../firebase.js?v=20260630-3';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function renderBoard(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">생활판결 게시판</span>
      </div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div style="margin-bottom:18px;">
          <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;color:var(--gold);margin-bottom:6px;">오늘의 억울함 모음</div>
          <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">AI가 자동 생성한 오늘의 사건과 공개된 판결을 게시판처럼 볼 수 있습니다.</div>
        </div>
        <div id="board-list">
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>`;

  const list = document.getElementById('board-list');
  try {
    const snap = await getDocs(query(
      collection(db, 'results'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(50)
    ));

    if (snap.empty) {
      list.innerHTML = `
        <div style="text-align:center;padding:52px 0;color:var(--cream-dim);">
          <div style="font-size:46px;margin-bottom:12px;">📭</div>
          아직 공개된 판결이 없습니다.<br>
          <a href="#/submit" style="color:var(--gold);margin-top:12px;display:inline-block;">첫 사건 접수하기</a>
        </div>`;
      return;
    }

    list.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${snap.docs.map(d => boardRow(d.id, d.data())).join('')}
      </div>`;
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div style="text-align:center;padding:52px 0;color:var(--cream-dim);">게시판을 불러오지 못했습니다.<br><span style="font-size:12px;opacity:.7;">${escapeHtml(err.message || '')}</span></div>`;
  }
}

function boardRow(id, r) {
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const isDaily = r.source === 'daily_ai';
  return `
    <div class="card" onclick="location.hash='#/result/${encodeURIComponent(id)}'" style="padding:16px 18px;cursor:pointer;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;">
        <div style="font-weight:800;font-size:15px;line-height:1.45;flex:1;">${escapeHtml(r.caseTitle || '제목 없음')}</div>
        <div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(fmtDate(r.createdAt))}</div>
      </div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.6;margin-bottom:10px;">${escapeHtml(compactText(r.sentence || r.verdict || '', 86))}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;">
        <span style="color:var(--cream-dim);">${icon} ${escapeHtml(r.judgeType || 'AI')} 판사 · 억울지수 ${escapeHtml(r.grievanceIndex || '?')}/10</span>
        <span style="color:${isDaily ? 'var(--gold)' : 'var(--cream-dim)'};font-weight:${isDaily ? '700' : '400'};white-space:nowrap;">${isDaily ? '오늘의 AI 사건' : '공개 판결'} →</span>
      </div>
    </div>`;
}
