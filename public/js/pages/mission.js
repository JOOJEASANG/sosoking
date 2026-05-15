import { db } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';

export async function renderMission() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const missions = await fetchMissions();

  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="section-header">
        <h1 class="section-title">오늘의 미션 🎯</h1>
      </div>
      <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:24px">
        매일 새로운 미션이 올라와요. 미션에 참여하고 리액션을 받아보세요!
      </p>
      ${missions.length
        ? missions.map(m => renderMissionCard(m)).join('')
        : `<div class="empty-state">
            <div class="empty-state__icon">🌙</div>
            <div class="empty-state__title">오늘의 미션이 없어요</div>
            <div class="empty-state__desc">내일 다시 확인해보세요!</div>
          </div>`}
      <div class="card" style="margin-top:24px;padding:20px;text-align:center">
        <div style="font-size:24px;margin-bottom:8px">✍️</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:4px">미션과 관련 없이 글을 올려도 좋아요</div>
        <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px">놀이판은 언제든 만들 수 있어요!</div>
        <button class="btn btn--primary" onclick="navigate('/write')">놀이판 만들기</button>
      </div>
    </div>`;
}

function renderMissionCard(mission) {
  const typeLabels = {
    balance:'밸런스게임', vote:'민심투표', naming:'미친작명소',
    acrostic:'삼행시짓기', howto:'나만의노하우', story:'경험담',
  };
  const typeLabel = typeLabels[mission.type] || '자유';
  return `
    <div class="mission-card card">
      <div class="mission-card__header">
        <div class="mission-card__date">오늘의 미션</div>
        <div class="mission-card__title">${escHtml(mission.title || '')}</div>
      </div>
      <div class="mission-card__body">
        ${mission.desc ? `<p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:12px">${escHtml(mission.desc)}</p>` : ''}
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge badge--primary">${typeLabel}</span>
          <button class="btn btn--primary btn--sm" onclick="navigate('/write')">이 미션 참여하기</button>
        </div>
      </div>
    </div>`;
}

async function fetchMissions() {
  try {
    const q = query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(5));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
