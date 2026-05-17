import { db } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

const WEEKLY_WORDS = ['소소킹', '월요일', '킹받네', '라면왕', '퇴근길', '대반전', '웃참패'];

export async function renderMission() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const missions = await fetchMissions();
  const weeklyWord = getWeeklyAcrosticWord();

  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="section-header">
        <h1 class="section-title">오늘의 미션 🎯</h1>
      </div>
      <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:18px">
        매일 새로운 미션이 올라와요. 미션에 참여하고 리액션을 받아보세요!
      </p>
      ${renderWeeklyAcrosticChallenge(weeklyWord)}
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

function renderWeeklyAcrosticChallenge(word) {
  return `
    <div class="card" style="padding:18px;margin-bottom:18px;background:linear-gradient(135deg,#fff7ed,#eef2ff);border:1px solid rgba(249,115,22,.18)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <div style="font-size:12px;font-weight:900;color:#f97316;margin-bottom:5px">✍️ 이번 주 삼행시 챌린지</div>
          <div style="font-size:24px;font-weight:950;letter-spacing:-.04em;color:var(--color-text)">${escHtml(word)}</div>
          <div style="font-size:13px;color:var(--color-text-secondary);margin-top:5px">이번 주 제시어로 삼행시 왕좌에 도전해보세요.</div>
        </div>
        <button class="btn btn--primary btn--sm" onclick="navigate('/write?type=acrostic')">삼행시 만들기</button>
      </div>
      <div style="display:grid;gap:6px;margin-top:14px">
        ${[...word].map(ch => `<div style="display:flex;align-items:center;gap:8px"><span style="width:28px;height:28px;border-radius:8px;background:#f97316;color:#fff;display:grid;place-items:center;font-weight:900">${escHtml(ch)}</span><span style="font-size:13px;color:var(--color-text-muted)">: 센스 있는 한 줄을 채워보세요</span></div>`).join('')}
      </div>
    </div>`;
}

function renderMissionCard(mission) {
  const typeLabels = {
    balance:'밸런스게임', vote:'민심투표', battle:'선택지배틀',
    naming:'미친작명소', acrostic:'삼행시짓기', drip:'한줄드립',
    ox:'OX퀴즈', relay:'막장릴레이', random_battle:'랜덤대결',
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
          <button class="btn btn--primary btn--sm" onclick="navigate('/write?type=${mission.type || ''}')">이 미션 참여하기</button>
        </div>
      </div>
    </div>`;
}

async function fetchMissions() {
  try {
    const q = query(collection(db, 'missions'), where('active', '==', true), orderBy('createdAt', 'desc'), limit(5));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

function getWeeklyAcrosticWord() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(kst.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((kst - start) / 86400000);
  const week = Math.floor(diffDays / 7);
  return WEEKLY_WORDS[week % WEEKLY_WORDS.length];
}
