import { db, auth } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const STATUS = {
  pending:    { label: '접수 완료',   color: '#c9a84c', dot: '🟡' },
  processing: { label: '재판 진행 중', color: '#4a9eff', dot: '🔵' },
  completed:  { label: '판결 완료',   color: '#27ae60', dot: '🟢' },
  error:      { label: '오류',        color: '#e74c3c', dot: '🔴' },
  blocked:    { label: '접수 차단',   color: '#e74c3c', dot: '⛔' },
};

function _fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function renderMyCases(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">📋 내 사건 내역</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="loading-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;

  const user = auth.currentUser;
  if (!user) {
    container.querySelector('.container').innerHTML = `
      <div style="text-align:center;padding:60px 0;color:var(--cream-dim);">
        로그인이 필요합니다.<br>
        <a href="#/" style="color:var(--gold);margin-top:12px;display:inline-block;">처음으로</a>
      </div>`;
    return;
  }

  let docs = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'cases'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20))
    );
    docs = snap.docs;
  } catch (e) {
    console.error(e);
  }

  const inner = container.querySelector('.container');

  if (docs.length === 0) {
    inner.innerHTML = `
      <div style="text-align:center;padding:60px 0;">
        <div style="font-size:52px;margin-bottom:16px;">😤</div>
        <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;margin-bottom:8px;">아직 접수한 사건이 없어요</div>
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:28px;">억울한 일이 없으신가요?<br>그렇다면… 축하드립니다.</div>
        <a href="#/submit" class="btn btn-primary" style="display:inline-flex;width:auto;padding:14px 32px;">⚖️ 첫 사건 접수하기</a>
      </div>`;
    return;
  }

  inner.innerHTML = `
    <div style="font-size:13px;color:var(--cream-dim);margin-bottom:16px;">
      총 ${docs.length}건의 사건이 있습니다
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${docs.map(d => _caseRow(d.id, d.data())).join('')}
    </div>`;
}

function _caseRow(id, c) {
  const st = STATUS[c.status] || STATUS.pending;
  const href = c.status === 'completed'
    ? `#/result/${encodeURIComponent(id)}`
    : (c.status === 'processing' || c.status === 'pending')
      ? `#/trial/${encodeURIComponent(id)}`
      : null;
  const clickable = href ? `onclick="location.hash='${href}'"` : '';
  const cursor = href ? 'cursor:pointer;' : 'opacity:0.6;';

  return `
    <div class="card" style="${cursor}border-left:3px solid ${st.color};" ${clickable}>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <div style="font-weight:700;font-size:15px;flex:1;">${c.caseTitle || '제목 없음'}</div>
        <div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${_fmtDate(c.createdAt)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:${st.color};font-weight:700;">${st.dot} ${st.label}</span>
        <span style="font-size:12px;color:var(--cream-dim);">억울지수 ${c.grievanceIndex || '?'}/10</span>
      </div>
      ${href ? `<div style="font-size:12px;color:var(--gold);margin-top:6px;text-align:right;">${c.status === 'completed' ? '판결문 보기 →' : '재판장 입장 →'}</div>` : ''}
    </div>`;
}
