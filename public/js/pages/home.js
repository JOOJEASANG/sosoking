import { navigate } from '../router.js';
import { renderFeedCard } from '../components/feed-card.js';
import { fetchHotPosts } from '../services/feed-service.js';
import { db } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CAT_INFO = {
  golra: { label: '골라봐', icon: '🎯', desc: '선택·투표·퀴즈', color: '--color-cat-golra' },
  usgyo: { label: '웃겨봐', icon: '😂', desc: '드립·삼행시·작명', color: '--color-cat-usgyo' },
  malhe: { label: '말해봐', icon: '💬', desc: '경험·노하우·고민', color: '--color-cat-malhe' },
};

export async function renderHome() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
  try {
    const [hotPosts, todayMission] = await Promise.all([
      fetchHotPosts(),
      fetchTodayMission(),
    ]);

    el.innerHTML = `
      <div class="layout-cols">
        <div class="layout-main">
          ${renderHero()}
          ${renderCategoryCards()}
          <div class="section-header">
            <h2 class="section-title">지금 인기</h2>
            <a href="#/feed" class="btn btn--ghost btn--sm">더 보기</a>
          </div>
          <div id="hot-feed-list">
            ${hotPosts.length
              ? hotPosts.map(p => renderFeedCard(p)).join('')
              : '<div class="empty-state"><div class="empty-state__icon">🌱</div><div class="empty-state__title">아직 글이 없어요</div><div class="empty-state__desc">첫 번째 놀이판의 주인공이 되어보세요!</div><button class="btn btn--primary" style="margin-top:16px" onclick="navigate(\'/write\')">첫 글 올리기</button></div>'}
          </div>
        </div>
        <aside class="layout-sidebar">
          ${todayMission ? renderMissionWidget(todayMission) : ''}
          ${renderGuideWidget()}
        </aside>
      </div>
    `;

    // 카테고리 카드 클릭
    document.querySelectorAll('[data-cat-nav]').forEach(el => {
      el.addEventListener('click', () => navigate(`/feed?cat=${el.dataset.catNav}`));
    });
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">로딩 중 오류가 발생했어요</div><div class="empty-state__desc">잠시 후 다시 시도해주세요</div><button class="btn btn--primary" style="margin-top:16px" onclick="location.reload()">새로고침</button></div>`;
  }
}

function renderHero() {
  return `
    <div class="home-hero">
      <div class="home-hero__title">소소킹에서<br>놀이판을 열어보세요</div>
      <div class="home-hero__sub">글과 사진으로 즐기는 게임형 커뮤니티</div>
      <div class="home-hero__chips">
        <span class="home-hero__chip">🎯 투표·퀴즈</span>
        <span class="home-hero__chip">😂 드립·삼행시</span>
        <span class="home-hero__chip">💬 경험·고민</span>
      </div>
      <div class="home-hero__action">
        <button class="btn" onclick="navigate('/write')">놀이판 만들기</button>
        <button class="btn--ghost-white" onclick="navigate('/feed')">구경하기</button>
      </div>
    </div>`;
}

function renderCategoryCards() {
  return `
    <div class="home-cats">
      ${Object.entries(CAT_INFO).map(([key, c]) => `
        <div class="home-cat-card home-cat-card--${key}" data-cat-nav="${key}" role="button" tabindex="0">
          <div class="home-cat-card__icon">${c.icon}</div>
          <div class="home-cat-card__name">${c.label}</div>
          <div class="home-cat-card__desc">${c.desc}</div>
        </div>`).join('')}
    </div>`;
}

function renderMissionWidget(mission) {
  return `
    <div class="sidebar-widget sidebar-mission" onclick="navigate('/mission')">
      <div class="sidebar-widget__title">🎯 오늘의 미션</div>
      <div class="sidebar-mission__badge">진행 중</div>
      <div class="sidebar-mission__text">${mission.title || '오늘의 미션을 확인해보세요!'}</div>
    </div>`;
}

function renderGuideWidget() {
  return `
    <div class="sidebar-widget">
      <div class="sidebar-widget__title">📖 소소킹 이용 가이드</div>
      <ul style="font-size:13px;color:var(--color-text-secondary);line-height:2;padding-left:4px;">
        <li>🎯 <b>골라봐</b> — 투표·퀴즈·밸런스게임</li>
        <li>😂 <b>웃겨봐</b> — 드립·삼행시·작명소</li>
        <li>💬 <b>말해봐</b> — 경험·노하우·고민</li>
      </ul>
      <button class="btn btn--ghost btn--sm btn--full" style="margin-top:12px" onclick="navigate('/guide')">가이드 보기</button>
    </div>
    <div class="sidebar-widget" style="background:linear-gradient(135deg,#FF6B4A,#FF9E4A);color:#fff;border:none;">
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;">✍️ 지금 놀이판 만들기</div>
      <div style="font-size:12px;opacity:0.9;margin-bottom:12px;">내가 만든 퀴즈에 친구들이 참여해요!</div>
      <button class="btn btn--sm btn--full" style="background:#fff;color:var(--color-primary);font-weight:700;" onclick="navigate('/write')">시작하기</button>
    </div>`;
}

// fetchHotPosts는 feed-service.js에서 import해서 사용

async function fetchTodayMission() {
  try {
    const q = query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch {
    return null;
  }
}
