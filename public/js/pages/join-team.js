import { db, auth, functions } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

export async function renderJoinTeam(container, sessionId, side) {
  const sideLabel = side === 'plaintiff' ? '🔴 A팀' : '🔵 B팀';
  const sideColor = side === 'plaintiff' ? '#e74c3c' : '#3498db';

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">🤝 팀 합류</span>
      </div>
      <div class="container" style="padding-top:48px;padding-bottom:80px;text-align:center;">
        <div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;

  const inner = container.querySelector('.container');

  try {
    const snap = await getDoc(doc(db, 'debate_sessions', sessionId));
    if (!snap.exists()) {
      inner.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><div class="empty-state-title">배틀을 찾을 수 없습니다</div></div>`;
      return;
    }
    const session = snap.data();
    const teamKey = side === 'plaintiff' ? 'plaintiffTeam' : 'defendantTeam';
    const currentTeam = session[teamKey] || [];
    const teamSize = session.teamSize || 1;
    const isFull = currentTeam.length >= teamSize;
    const alreadyIn = auth.currentUser &&
      (currentTeam.some(m => m.userId === auth.currentUser.uid) ||
       (session.plaintiffTeam || []).some(m => m.userId === auth.currentUser.uid) ||
       (session.defendantTeam || []).some(m => m.userId === auth.currentUser.uid));

    inner.innerHTML = `
      <div style="font-size:56px;margin-bottom:20px;">🤝</div>
      <div style="font-size:11px;font-weight:700;color:${sideColor};letter-spacing:.1em;margin-bottom:8px;">${sideLabel} 팀원 초대</div>
      <h2 style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--cream);margin-bottom:8px;line-height:1.4;">${session.topicTitle || '배틀'}</h2>
      <p style="font-size:13px;color:var(--cream-dim);margin-bottom:24px;">현재 팀원: ${currentTeam.length}/${teamSize}명</p>

      ${isFull ? `
        <div class="card" style="margin-bottom:20px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">😅</div>
          <div style="font-weight:700;color:var(--cream);margin-bottom:4px;">팀이 꽉 찼어요!</div>
          <div style="font-size:13px;color:var(--cream-dim);">더 이상 팀원을 받을 수 없습니다</div>
        </div>
        <a href="#/debate/${sessionId}" class="btn btn-secondary">배틀 구경하기</a>
      ` : alreadyIn ? `
        <div class="card" style="margin-bottom:20px;">
          <div style="font-size:13px;color:var(--cream-dim);text-align:center;">이미 이 배틀에 참가 중이에요!</div>
        </div>
        <a href="#/debate/${sessionId}" class="btn btn-primary">⚔️ 배틀로 이동</a>
      ` : `
        <p style="font-size:14px;color:var(--cream-dim);line-height:1.7;margin-bottom:28px;">
          <strong style="color:${sideColor};">${sideLabel}</strong> 팀원으로 이 배틀에 합류합니다.
        </p>
        <button id="join-team-btn" class="btn btn-primary">🤝 팀원으로 합류하기</button>
      `}
    `;

    if (!isFull && !alreadyIn) {
      document.getElementById('join-team-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('join-team-btn');
        btn.disabled = true;
        btn.textContent = '합류 중...';
        try {
          const joinTeamFn = httpsCallable(functions, 'joinTeamSession');
          await joinTeamFn({ sessionId, side });
          showToast(`${sideLabel} 팀원으로 합류했습니다!`, 'success');
          location.hash = `#/debate/${sessionId}`;
        } catch (err) {
          showToast(err.message || '합류 실패', 'error');
          btn.disabled = false;
          btn.textContent = '🤝 팀원으로 합류하기';
        }
      });
    }
  } catch {
    inner.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><div class="empty-state-title">불러오기 실패</div></div>`;
  }
}
