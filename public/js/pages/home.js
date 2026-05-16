import { navigate } from '../router.js';
import { renderFeedCard } from '../components/feed-card.js';
import { fetchHotPosts } from '../services/feed-service.js';
import { db } from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs,
  getCountFromServer, where, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CAT_QUICK_TYPES = [
  { key: 'balance',  icon: '⚖️', label: '밸런스게임',   cat: 'golra' },
  { key: 'ox',       icon: '❓', label: 'OX퀴즈',       cat: 'golra' },
  { key: 'acrostic', icon: '✍️', label: '삼행시짓기',   cat: 'usgyo' },
  { key: 'naming',   icon: '😜', label: '미친작명소',   cat: 'usgyo' },
  { key: 'howto',    icon: '💡', label: '나만의노하우', cat: 'malhe' },
  { key: 'concern',  icon: '🤔', label: '고민/질문',    cat: 'malhe' },
];

export async function renderHome() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [hotPosts, recentPosts, todayMission, totalSnap, todaySnap] = await Promise.all([
      fetchHotPosts(6),
      fetchRecentPosts(6),
      fetchTodayMission(),
      getCountFromServer(collection(db, 'feeds')).catch(() => null),
      getDocs(query(
        collection(db, 'feeds'),
        where('createdAt', '>=', Timestamp.fromDate(todayStart)),
        limit(99),
      )).catch(() => null),
    ]);

    const totalPosts = totalSnap?.data?.().count ?? 0;
    const todayCount = todaySnap?.size ?? 0;

    el.innerHTML = `
      <div class="home-layout">

        <!-- ── 히어로 ── -->
        <div class="home-hero">
          <div class="home-hero__content">
            <div class="home-hero__eyebrow">🔥 게임형 놀이 커뮤니티</div>
            <div class="home-hero__title">소소킹에서<br>신나게 놀아봐요!</div>
            <div class="home-hero__sub">투표·퀴즈·드립·고민, 뭐든 다 가능한<br>한국 최고의 놀이판 커뮤니티</div>
            <div class="home-hero__action">
              <button class="btn-hero-primary" onclick="navigate('/write')">✏️ 놀이판 만들기</button>
              <button class="btn-hero-secondary" onclick="navigate('/feed')">둘러보기 →</button>
            </div>
          </div>
          <div class="home-hero__stats">
            <div class="home-hero__stat">
              <div class="home-hero__stat-num">${totalPosts.toLocaleString()}</div>
              <div class="home-hero__stat-label">총 놀이판</div>
            </div>
            <div class="home-hero__stat-divider"></div>
            <div class="home-hero__stat">
              <div class="home-hero__stat-num">${todayCount > 0 ? todayCount : '-'}</div>
              <div class="home-hero__stat-label">오늘 새 글</div>
            </div>
            <div class="home-hero__stat-divider"></div>
            <div class="home-hero__stat">
              <div class="home-hero__stat-num" style="font-size:14px">🟢 Live</div>
              <div class="home-hero__stat-label">실시간 운영중</div>
            </div>
          </div>
        </div>

        <!-- ── 카테고리 카드 ── -->
        ${renderCategoryCards()}

        <!-- ── 바로 시작하기 ── -->
        <div class="home-quick-section">
          <div class="home-quick-section__title">⚡ 바로 시작하기</div>
          <div class="home-quick-grid">
            ${CAT_QUICK_TYPES.map(t => `
              <button class="quick-type-card quick-type-card--${t.cat}" data-type-quick="${t.key}">
                <span class="quick-type-card__icon">${t.icon}</span>
                <span class="quick-type-card__label">${t.label}</span>
              </button>`).join('')}
          </div>
        </div>

        <!-- ── 메인 2컬럼 ── -->
        <div class="layout-cols">
          <div class="layout-main">
            <div class="home-feed-header">
              <div class="home-feed-tabs" id="home-feed-tabs">
                <button class="home-feed-tab active" data-feed-tab="hot">🔥 인기글</button>
                <button class="home-feed-tab" data-feed-tab="recent">✨ 최신글</button>
              </div>
              <a href="#/feed" class="btn btn--ghost btn--sm">전체 보기 →</a>
            </div>
            <div id="home-feed-list">
              ${hotPosts.length ? hotPosts.map(p => renderFeedCard(p)).join('') : emptyFeedHTML()}
            </div>
          </div>

          <!-- ── 사이드바 ── -->
          <aside class="layout-sidebar">
            ${todayMission ? renderMissionWidget(todayMission) : renderMissionEmptyWidget()}
            ${renderStatsWidget(totalPosts, todayCount)}
            ${renderHotRankingWidget(hotPosts)}
            ${renderWriteCTAWidget()}
            ${renderGuideWidget()}
          </aside>
        </div>

      </div>`;

    // 카테고리 카드 클릭
    document.querySelectorAll('[data-cat-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/feed?cat=${btn.dataset.catNav}`));
    });
    // 바로 시작하기 클릭
    document.querySelectorAll('[data-type-quick]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/write?type=${btn.dataset.typeQuick}`));
    });
    // 피드 탭 전환
    const hotPostsCached   = hotPosts;
    const recentPostsCached = recentPosts;
    document.querySelectorAll('[data-feed-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-feed-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const list = document.getElementById('home-feed-list');
        if (!list) return;
        const posts = btn.dataset.feedTab === 'hot' ? hotPostsCached : recentPostsCached;
        list.innerHTML = posts.length ? posts.map(p => renderFeedCard(p)).join('') : emptyFeedHTML();
      });
    });

  } catch (e) {
    console.error(e);
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <div class="empty-state__title">로딩 중 오류가 발생했어요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="location.reload()">새로고침</button>
      </div>`;
  }
}

/* ── 렌더 헬퍼 ── */

function renderCategoryCards() {
  const cats = [
    { key: 'golra', emoji: '🎯', badge: 'VOTE', name: '골라봐',  desc: '선택하고 판단해봐요',   types: ['밸런스게임','민심투표','OX퀴즈','퀴즈'] },
    { key: 'usgyo', emoji: '😂', badge: 'FUN',  name: '웃겨봐',  desc: '웃기고 유쾌하게 즐겨요', types: ['미친작명소','삼행시','한줄드립','댓글배틀'] },
    { key: 'malhe', emoji: '💬', badge: 'TALK', name: '말해봐',  desc: '경험과 생각을 나눠요',   types: ['나만의노하우','경험담','고민/질문','막장릴레이'] },
  ];
  return `
    <div class="home-cats">
      ${cats.map(c => `
        <div class="home-cat-card home-cat-card--${c.key}" data-cat-nav="${c.key}" data-emoji="${c.emoji}" role="button" tabindex="0">
          <div class="home-cat-card__badge">${c.badge}</div>
          <div class="home-cat-card__icon">${c.emoji}</div>
          <div class="home-cat-card__name">${c.name}</div>
          <div class="home-cat-card__desc">${c.desc}</div>
          <div class="home-cat-card__types">
            ${c.types.map(t => `<span class="home-cat-card__type-pill">${t}</span>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function renderMissionWidget(mission) {
  return `
    <div class="sidebar-widget sidebar-mission" onclick="navigate('/mission')" role="button" tabindex="0">
      <div class="sidebar-widget__title">🎯 오늘의 미션</div>
      <div class="sidebar-mission__badge">✅ 진행 중</div>
      <div class="sidebar-mission__text">${escHtml(mission.title || '미션을 확인해보세요!')}</div>
      ${mission.desc ? `<div class="sidebar-mission__desc">${escHtml(mission.desc)}</div>` : ''}
      <div class="sidebar-mission__cta">참여하기 →</div>
    </div>`;
}

function renderMissionEmptyWidget() {
  return `
    <div class="sidebar-widget sidebar-mission" onclick="navigate('/mission')" role="button" tabindex="0">
      <div class="sidebar-widget__title">🎯 오늘의 미션</div>
      <div style="font-size:13px;color:var(--color-text-muted);margin-top:8px">아직 오늘 미션이 없어요<br>내일 다시 확인해보세요!</div>
    </div>`;
}

function renderStatsWidget(total, today) {
  return `
    <div class="sidebar-widget">
      <div class="sidebar-widget__title">📊 소소킹 현황</div>
      <div class="sidebar-stats-grid">
        <div class="sidebar-stats-item">
          <div class="sidebar-stats-num">${total.toLocaleString()}</div>
          <div class="sidebar-stats-label">총 놀이판</div>
        </div>
        <div class="sidebar-stats-item">
          <div class="sidebar-stats-num" style="color:var(--color-malhe)">${today}</div>
          <div class="sidebar-stats-label">오늘 새 글</div>
        </div>
      </div>
    </div>`;
}

function renderHotRankingWidget(hotPosts) {
  if (!hotPosts.length) return '';
  return `
    <div class="sidebar-widget">
      <div class="sidebar-widget__title">🏆 인기 순위</div>
      <div style="margin-top:8px">
        ${hotPosts.slice(0, 5).map((p, i) => `
          <div class="sidebar-rank-item" onclick="navigate('/detail/${p.id}')" role="button">
            <span class="sidebar-rank-num">${i + 1}</span>
            <span class="sidebar-rank-title">${escHtml(p.title || '')}</span>
            <span class="sidebar-rank-meta">${p.reactions?.total || 0}❤️</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderWriteCTAWidget() {
  return `
    <div class="sidebar-cta" role="button" tabindex="0">
      <div class="sidebar-cta__title">✍️ 놀이판 만들기</div>
      <div class="sidebar-cta__desc">내 퀴즈에 친구들이 참여하고<br>내 드립에 다들 웃어요!</div>
      <button class="btn btn--sm btn--full" onclick="navigate('/write')" style="background:rgba(255,255,255,0.2);color:#fff;border:1.5px solid rgba(255,255,255,0.4);margin-top:12px">시작하기 →</button>
    </div>`;
}

function renderGuideWidget() {
  const items = [
    { icon: '🎯', label: '골라봐', desc: '투표·퀴즈·밸런스게임', cat: 'golra' },
    { icon: '😂', label: '웃겨봐', desc: '드립·삼행시·작명소',   cat: 'usgyo' },
    { icon: '💬', label: '말해봐', desc: '경험·노하우·고민',     cat: 'malhe' },
  ];
  return `
    <div class="sidebar-widget">
      <div class="sidebar-widget__title">📖 이용 가이드</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${items.map(it => `
          <div class="sidebar-guide-item" onclick="navigate('/feed?cat=${it.cat}')" role="button">
            <span style="font-size:18px;flex-shrink:0">${it.icon}</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:800;color:var(--color-${it.cat}-dark)">${it.label}</div>
              <div style="font-size:11px;color:var(--color-text-muted);margin-top:1px">${it.desc}</div>
            </div>
            <span style="color:var(--color-text-muted);font-size:14px">›</span>
          </div>`).join('')}
      </div>
      <button class="btn btn--ghost btn--sm btn--full" style="margin-top:12px" onclick="navigate('/guide')">상세 가이드 보기</button>
    </div>`;
}

function emptyFeedHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🌱</div>
      <div class="empty-state__title">아직 글이 없어요</div>
      <div class="empty-state__desc">첫 번째 놀이판의 주인공이 되어보세요!</div>
      <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write')">첫 글 올리기</button>
    </div>`;
}

/* ── 데이터 ── */
async function fetchRecentPosts(n = 6) {
  try {
    const q = query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function fetchTodayMission() {
  try {
    const q = query(
      collection(db, 'missions'),
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch { return null; }
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
