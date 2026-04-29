import { db, auth } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const functions = getFunctions(undefined, 'asia-northeast3');
const deleteMySessionFn = httpsCallable(functions, 'deleteMySession');

export async function renderMyHistory(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">📋 내 기록</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="loading-dots" style="padding:60px 0;"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;

  const inner = container.querySelector('.container');
  const user = auth.currentUser;
  const uid = user?.uid;
  if (!uid) {
    inner.innerHTML = `<div class="empty-state"><span class="empty-state-icon">👤</span><div class="empty-state-title">로그인이 필요합니다</div></div>`;
    return;
  }

  const loginBanner = user.isAnonymous ? `
    <div class="login-nudge-banner">
      <div style="font-size:13px;font-weight:700;color:var(--cream);margin-bottom:4px;">📱 다른 기기에서도 보고 싶다면?</div>
      <div style="font-size:12px;color:var(--cream-dim);margin-bottom:10px;">로그인하면 어디서든 내 배틀 기록을 볼 수 있어요</div>
      <a href="#/login" class="btn btn-secondary" style="font-size:13px;padding:8px 18px;max-width:180px;display:flex;margin:0 auto;">로그인 / 회원가입</a>
    </div>
  ` : '';

  try {
    const snap = await getDocs(query(
      collection(db, 'debate_sessions'),
      where('plaintiff.userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    ));
    const snap2 = await getDocs(query(
      collection(db, 'debate_sessions'),
      where('defendant.userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    ));

    const all = [...snap.docs, ...snap2.docs]
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 30);

    if (!all.length) {
      inner.innerHTML = loginBanner + `<div class="empty-state">
        <span class="empty-state-icon">🔥</span>
        <div class="empty-state-title">아직 참가한 배틀이 없습니다</div>
        <div class="empty-state-sub">주제를 선택해 첫 배틀을 시작해보세요</div>
        <a href="#/topics" class="btn btn-primary" style="margin-top:20px;max-width:200px;display:flex;margin-left:auto;margin-right:auto;">주제 목록 보기</a>
      </div>`;
      return;
    }

    inner.innerHTML = loginBanner + all.map(s => {
      const myRole = s.plaintiff?.userId === uid ? 'plaintiff' : 'defendant';
      const roleLabel = myRole === 'plaintiff' ? '🔴 A팀' : '🔵 B팀';
      const date = s.createdAt?.toDate?.()?.toLocaleDateString('ko') || '-';
      const statusMap = { waiting: '대기 중', active: '진행 중', ready_for_verdict: "판정 대기", verdict_requested: "판정 요청 중", judging: "판정 중", completed: "판정 완료", cancelled: '종료됨' };
      const statusColor = s.status === 'completed' ? 'var(--gold)' : s.status === 'active' ? '#27ae60' : 'var(--cream-dim)';

      let resultBadge = '';
      if (s.status === 'completed' && s.verdict) {
        const won = s.verdict.winner === myRole;
        const draw = s.verdict.winner === 'draw';
        resultBadge = draw
          ? `<span style="color:var(--gold);font-weight:700;font-size:12px;">🤝 무승부</span>`
          : won
            ? `<span style="color:#27ae60;font-weight:700;font-size:12px;">🏆 승리</span>`
            : `<span style="color:var(--red);font-weight:700;font-size:12px;">😔 패배</span>`;
      }

      return `<div class="card" id="session-card-${s.id}" style="margin-bottom:10px;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <span style="font-size:10px;font-weight:700;color:var(--gold);">${roleLabel}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:10px;color:${statusColor};font-weight:700;">${statusMap[s.status] || s.status}</span>
            <button class="delete-session-btn" data-id="${s.id}" style="background:none;border:none;cursor:pointer;color:var(--cream-dim);font-size:16px;padding:0;line-height:1;opacity:0.6;" title="기록 삭제">🗑️</button>
          </div>
        </div>
        <div style="font-weight:700;font-size:15px;color:var(--cream);margin-bottom:4px;cursor:pointer;" onclick="location.hash='#/debate/${s.id}'">${s.topicTitle || "주제"}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;cursor:pointer;" onclick="location.hash='#/debate/${s.id}'">
          <span style="font-size:12px;color:var(--cream-dim);">${date} · ${s.mode === 'random' ? '랜덤 대결' : s.mode === 'ai' ? 'AI 대결' : '친구 대결'}</span>
          ${resultBadge}
        </div>
      </div>`;
    }).join('');

    inner.querySelectorAll('.delete-session-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sessionId = btn.dataset.id;
        if (!confirm('이 배틀 기록을 삭제할까요?\n삭제하면 복구할 수 없습니다.')) return;
        btn.disabled = true;
        btn.textContent = '⏳';
        try {
          await deleteMySessionFn({ sessionId });
          const card = document.getElementById(`session-card-${sessionId}`);
          if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(20px)';
            setTimeout(() => card.remove(), 300);
          }
        } catch (err) {
          btn.disabled = false;
          btn.textContent = '🗑️';
          alert('삭제 실패: ' + (err.message || '다시 시도해주세요'));
        }
      });
    });
  } catch {
    inner.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><div class="empty-state-title">불러오기 실패</div></div>`;
  }
}
