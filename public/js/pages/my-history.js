import { db, auth } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

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
    inner.innerHTML = `<div class="empty-state"><span class="empty-state-icon">👤</span><div class="empty-state-title">로그인이 필요합니다</div><a href="#/login" class="btn btn-primary" style="margin-top:20px;max-width:200px;display:flex;margin-left:auto;margin-right:auto;">로그인 / 회원가입</a></div>`;
    return;
  }

  try {
    const [debateSnap1, debateSnap2, newsSnap, dealSnap] = await Promise.all([
      getDocs(query(collection(db, 'debate_sessions'), where('plaintiff.userId', '==', uid), orderBy('createdAt', 'desc'), limit(20))),
      getDocs(query(collection(db, 'debate_sessions'), where('defendant.userId', '==', uid), orderBy('createdAt', 'desc'), limit(20))),
      getDocs(query(collection(db, 'sosonews'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(10))),
      getDocs(query(collection(db, 'devil_deals'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(10))),
    ]);

    const debates = [...debateSnap1.docs, ...debateSnap2.docs]
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 30);

    const newsList = newsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const dealList = dealSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const hasAny = debates.length || newsList.length || dealList.length;
    if (!hasAny) {
      inner.innerHTML = `<div class="empty-state">
        <span class="empty-state-icon">👑</span>
        <div class="empty-state-title">아직 플레이 기록이 없습니다</div>
        <div class="empty-state-sub">세 가지 게임 중 하나를 골라 시작해보세요!</div>
        <a href="#/" class="btn btn-primary" style="margin-top:20px;max-width:200px;display:flex;margin-left:auto;margin-right:auto;">게임 선택하기</a>
      </div>`;
      return;
    }

    let html = '';

    if (debates.length) {
      html += `<div class="sk-section-title" style="color:var(--court);">⚖️ 사소한 재판 기록</div>`;
      html += debates.map(s => {
        const myRole = s.plaintiff?.userId === uid ? 'plaintiff' : 'defendant';
        const roleLabel = myRole === 'plaintiff' ? '⚔️ 원고' : '🛡️ 피고';
        const date = s.createdAt?.toDate?.()?.toLocaleDateString('ko') || '-';
        const statusMap = { waiting: '대기 중', active: '진행 중', ready_for_verdict: '판결 대기', verdict_requested: '판결 요청 중', judging: '심리 중', completed: '판결 완료', cancelled: '종료됨' };
        const statusColor = s.status === 'completed' ? 'var(--court)' : s.status === 'active' ? '#27ae60' : 'var(--text-dim)';

        let resultBadge = '';
        if (s.status === 'completed' && s.verdict) {
          const won = s.verdict.winner === myRole;
          const draw = s.verdict.winner === 'draw';
          resultBadge = draw
            ? `<span style="color:var(--lime);font-weight:700;font-size:12px;">🤝 무승부</span>`
            : won
              ? `<span style="color:#27ae60;font-weight:700;font-size:12px;">🏆 승소</span>`
              : `<span style="color:var(--red);font-weight:700;font-size:12px;">😔 패소</span>`;
        }

        return `<div class="card" style="margin-bottom:10px;cursor:pointer;border-color:rgba(168,85,247,0.2);" onclick="location.hash='#/debate/${s.id}'">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <span style="font-size:10px;font-weight:700;color:var(--court);">${roleLabel}</span>
            <span style="font-size:10px;color:${statusColor};font-weight:700;">${statusMap[s.status] || s.status}</span>
          </div>
          <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px;">${s.topicTitle || '사건'}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
            <span style="font-size:12px;color:var(--text-dim);">${date} · ${s.mode === 'random' ? '랜덤 대결' : s.mode === 'ai' ? 'AI 대결' : '친구 대결'}</span>
            ${resultBadge}
          </div>
        </div>`;
      }).join('');
    }

    if (newsList.length) {
      html += `<div class="sk-section-title" style="color:var(--news);margin-top:20px;">📺 소소뉴스 기록</div>`;
      html += newsList.map(n => {
        const date = n.createdAt?.toDate?.()?.toLocaleDateString('ko') || '-';
        const chMap = { mbc: '📻 MBC', yt: '▶️ 유튜브', cnn: '🌐 CNN' };
        return `<div class="card" style="margin-bottom:10px;cursor:pointer;border-color:rgba(251,146,60,0.2);" onclick="location.hash='#/sosonews/${n.id}'">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:10px;font-weight:700;color:var(--news);">${chMap[n.channel] || '🌐 CNN'}</span>
            <span style="font-size:10px;color:var(--text-dim);">${date}</span>
          </div>
          <div style="font-weight:700;font-size:14px;color:var(--text);line-height:1.4;">${n.headline || '긴급 속보'}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${n.event || ''}</div>
        </div>`;
      }).join('');
    }

    if (dealList.length) {
      html += `<div class="sk-section-title" style="color:var(--devil);margin-top:20px;">😈 악마와의 거래 기록</div>`;
      html += dealList.map(d => {
        const date = d.createdAt?.toDate?.()?.toLocaleDateString('ko') || '-';
        const totalVotes = Object.keys(d.votes || {}).length;
        return `<div class="card" style="margin-bottom:10px;cursor:pointer;border-color:rgba(239,68,68,0.2);" onclick="location.hash='#/devil-deal/${d.id}'">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:10px;font-weight:700;color:var(--devil);">😈 거래 기록</span>
            <span style="font-size:10px;color:var(--text-dim);">${date}</span>
          </div>
          <div style="font-weight:700;font-size:14px;color:var(--text);line-height:1.4;">${d.wish || '소원'}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">투표 ${totalVotes}명 참여</div>
        </div>`;
      }).join('');
    }

    inner.innerHTML = html;
  } catch {
    inner.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><div class="empty-state-title">불러오기 실패</div></div>`;
  }
}
