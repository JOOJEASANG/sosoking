import { navigate } from '../router.js';
import { renderFeedCard, renderSkeletonCards } from '../components/feed-card.js';
import { fetchHotPosts } from '../services/feed-service.js';
import { auth, db, functions } from '../firebase.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, computeTitle } from '../utils/helpers.js';
import {
  collection, query, orderBy, limit, getDocs,
  getCountFromServer, where, Timestamp, doc, getDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { appState } from '../state.js';

const ALL_TYPES = [
  'balance','vote','battle',
  'naming','acrostic','drip',
  'ox','relay','random_battle',
];

const PARTICIPATORY_TYPES = ['balance', 'vote', 'battle', 'naming', 'ox', 'random_battle'];

const THRONE_CATS = [
  { key: 'naming',       label: '작명왕',  icon: '✏️', type: 'naming',       scoreKey: null },
  { key: 'acrostic',     label: '삼행시왕', icon: '📝', type: 'acrostic',     scoreKey: null },
  { key: 'comment',      label: '댓글왕',  icon: '💬', type: null,            scoreKey: 'comment' },
  { key: 'drip',         label: '드립왕',  icon: '🎤', type: 'drip',          scoreKey: null },
  { key: 'random_battle',label: '대결왕',  icon: '🎰', type: 'random_battle', scoreKey: null },
];

function throneScore(p) {
  return (p.reactions?.total || 0) * 2 + (p.commentCount || 0) * 3 + (p.viewCount || 0) * 0.1;
}

function pickRandomPost(posts) {
  const pool = posts.filter(p => PARTICIPATORY_TYPES.includes(p.type));
  const src = pool.length ? pool : posts;
  return src.length ? src[Math.floor(Math.random() * src.length)] : null;
}


async function checkStreak(uid) {
  try {
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const userRef   = doc(db, 'users', uid);
    const snap      = await getDoc(userRef);
    if (!snap.exists()) return;
    const { lastVisit = '', streak = 0 } = snap.data();
    if (lastVisit === today) return;
    const newStreak = lastVisit === yesterday ? streak + 1 : 1;
    await updateDoc(userRef, { lastVisit: today, streak: newStreak });
    appState.streak = newStreak;
  } catch { /* non-critical */ }
}

const CAT_QUICK_TYPES = [
  { key: 'balance', icon: '⚖️', label: '밸런스게임', cat: 'golra' },
  { key: 'battle',  icon: '⚔️', label: '선택지배틀', cat: 'golra' },
  { key: 'naming',  icon: '😜', label: '미친작명소', cat: 'usgyo' },
  { key: 'acrostic',icon: '✍️', label: '삼행시짓기', cat: 'usgyo' },
  { key: 'ox',      icon: '❓', label: 'OX퀴즈',     cat: 'malhe' },
  { key: 'random_battle', icon: '🎰', label: '랜덤대결', cat: 'malhe' },
];

export async function renderHome() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="home-layout">
      <div class="skeleton-card" style="height:220px;border-radius:var(--radius-lg)"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0">
        ${Array.from({length:3},()=>`<div class="skeleton" style="height:80px;border-radius:var(--radius-md)"></div>`).join('')}
      </div>
      <div class="layout-cols">
        <div>${renderSkeletonCards(4)}</div>
        <div class="layout-sidebar">
          <div class="skeleton-card" style="height:120px"></div>
          <div class="skeleton-card" style="height:160px"></div>
        </div>
      </div>
    </div>`;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    setMeta();

    const user = auth.currentUser;
    if (user) checkStreak(user.uid);

    const [hotPosts, recentPosts, todayMission, totalSnap, todaySnap, weeklyHot, thronePosts] = await Promise.all([
      fetchHotPosts(6),
      fetchRecentPosts(6),
      fetchTodayMission(),
      getCountFromServer(collection(db, 'feeds')).catch(() => null),
      getDocs(query(
        collection(db, 'feeds'),
        where('createdAt', '>=', Timestamp.fromDate(todayStart)),
        limit(99),
      )).catch(() => null),
      fetchWeeklyHot(5),
      fetchThronePosts(80),
    ]);

    const totalPosts = totalSnap?.data?.().count ?? 0;
    const todayCount = todaySnap?.size ?? 0;

    el.innerHTML = `
      <div class="home-layout">

        <!-- ── 히어로 ── -->
        <div class="home-hero">
          <div class="home-hero__content">
            <div class="home-hero__eyebrow">🔥 게임형 놀이 커뮤니티</div>
            <div class="home-hero__title">고르거나 웃기거나<br>한마디만 던져도 시작!</div>
            <div class="home-hero__sub">선택형 · 드립형 · 도전형 — 9가지 게임, 짧게 참여하고 바로 결과 확인</div>
            <div class="home-hero__action">
              <button class="btn-hero-primary" onclick="navigate('/write')">✏️ 놀이판 만들기</button>
              <button class="btn-hero-secondary" id="btn-random-challenge">🎲 랜덤으로 놀기</button>
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
          <div class="home-hero__visual" aria-hidden="true">
            <div class="home-hero__mini-card"><b>⚖️ 밸런스게임</b><span>둘 중 하나만 고르면 끝</span></div>
            <div class="home-hero__mini-card"><b>🗳️ 민심투표</b><span>지금 민심은 어디로?</span></div>
            <div class="home-hero__mini-card"><b>✍️ 삼행시짓기</b><span>제시어로 삼행시 도전</span></div>
            <div class="home-hero__mini-card"><b>🎰 랜덤대결</b><span>같은 주제 누가 더 재밌어</span></div>
          </div>
        </div>

        <!-- ── 카테고리 카드 ── -->
        ${renderCategoryCards()}

        <!-- ── 오늘의 왕좌 ── -->
        ${renderThroneSection(thronePosts.slice(0, 60))}

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

        <!-- ── 지금 바로 한 판 놀기 ── -->
        ${renderRandomBox(thronePosts)}

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
            ${user && appState.streak > 0 ? renderStreakWidget(appState.streak) : ''}
            ${todayMission ? renderMissionWidget(todayMission) : renderMissionEmptyWidget()}
            ${renderSidebarRandomCTA(thronePosts)}
            <div id="weekly-best-placeholder"></div>
            ${weeklyHot.length ? renderHallOfFameWidget(weeklyHot) : ''}
            ${renderStatsWidget(totalPosts, todayCount)}
            ${renderHotRankingWidget(hotPosts)}
            ${renderWriteCTAWidget()}
            ${renderBestCommentWidget()}
            ${renderGuideWidget()}
          </aside>
        </div>

      </div>`;

    // 주간 결선: 페이지 렌더 후 비동기 로드 (CF cold-start가 렌더를 블로킹하지 않도록)
    callGetWeeklyBest().then(weeklyBest => {
      if (!weeklyBest) return;
      const placeholder = document.getElementById('weekly-best-placeholder');
      if (placeholder) placeholder.outerHTML = renderWeeklyBestWidget(weeklyBest);
    }).catch(() => {});

    // 랜덤으로 놀기
    const doRandom = () => {
      try {
        const post = pickRandomPost(thronePosts);
        if (post) navigate(`/detail/${post.id}`);
        else navigate('/write');
      } catch { navigate('/feed'); }
    };
    document.getElementById('btn-random-challenge')?.addEventListener('click', doRandom);
    document.getElementById('btn-random-box')?.addEventListener('click', doRandom);
    document.getElementById('btn-sidebar-random')?.addEventListener('click', doRandom);
    document.getElementById('btn-throne-random')?.addEventListener('click', () => navigate('/hall'));
    // 카테고리 카드 클릭
    document.querySelectorAll('[data-cat-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/feed?cat=${btn.dataset.catNav}`));
    });
    // 바로 시작하기 클릭
    document.querySelectorAll('[data-type-quick]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/write?type=${btn.dataset.typeQuick}`));
    });
    // 베스트 댓글 비동기 로드
    (async () => {
      try {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const allSnap = await getDocs(query(collection(db,'feeds'),orderBy('createdAt','desc'),limit(20)));
        const postIds = allSnap.docs.map(d=>d.id);
        const commentSnaps = await Promise.all(
          postIds.slice(0,8).map(pid => getDocs(query(collection(db,'feeds',pid,'comments'),orderBy('createdAt','desc'),limit(5))))
        );
        const allComments = [];
        commentSnaps.forEach((snap,i) => {
          snap.docs.forEach(d => {
            const c = d.data();
            const score = (c.reactions?.funny||0)*3+(c.reactions?.fire||0)*2+(c.reactions?.like||0)+(c.likes||0);
            if (score > 0) allComments.push({...c, id:d.id, postId:postIds[i], score});
          });
        });
        allComments.sort((a,b)=>b.score-a.score);
        const top = allComments.slice(0,4);
        const el = document.getElementById('best-comment-list');
        if (!el) return;
        if (!top.length) { el.innerHTML = '<div style="font-size:12px;color:var(--color-text-muted)">아직 베스트 댓글이 없어요</div>'; return; }
        el.innerHTML = top.map(c=>`
          <div class="best-comment-item" onclick="navigate('/detail/${c.postId}')">
            <div class="best-comment-item__text">"${escHtml(c.text||'')}"</div>
            <div class="best-comment-item__meta">${escHtml(c.authorName||'익명')} · 😂${c.reactions?.funny||0} 🔥${c.reactions?.fire||0}</div>
          </div>`).join('');
      } catch {}
    })();

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
    {
      key: 'golra', emoji: '🎯', badge: '선택형', name: '골라봐',
      hook: '선택은 빠르게, 이유는 댓글로',
      desc: '밸런스게임·민심투표·선택지배틀 — 누르자마자 참여하는 선택형 놀이판이에요.',
      types: ['밸런스게임', '민심투표', '선택지배틀'],
      cta: '선택하러 가기',
    },
    {
      key: 'usgyo', emoji: '😂', badge: '드립형', name: '웃겨봐',
      hook: '드립 한 줄이면 분위기 반전',
      desc: '미친작명소·삼행시짓기·한줄드립으로 센스와 유머를 겨뤄요.',
      types: ['미친작명소', '삼행시짓기', '한줄드립'],
      cta: '웃기러 가기',
    },
    {
      key: 'malhe', emoji: '🎮', badge: '도전형', name: '도전봐',
      hook: '퀴즈부터 릴레이까지 도전하세요',
      desc: 'OX퀴즈·막장릴레이·랜덤대결로 두뇌와 창의력을 겨뤄요.',
      types: ['OX퀴즈', '막장릴레이', '랜덤대결'],
      cta: '도전하러 가기',
    },
  ];
  return `
    <div class="home-cats-header">
      <div class="home-cats-header__title">오늘 뭐 하고 놀까요?</div>
      <div class="home-cats-header__sub">세 가지 놀이판 중 하나만 골라 바로 시작</div>
    </div>
    <div class="home-cats">
      ${cats.map(c => `
        <div class="home-cat-card home-cat-card--${c.key}" data-cat-nav="${c.key}" data-emoji="${c.emoji}" role="button" tabindex="0">
          <div class="home-cat-card__top">
            <div class="home-cat-card__badge">${c.badge}</div>
            <div class="home-cat-card__icon-wrap"><span class="home-cat-card__icon">${c.emoji}</span></div>
          </div>
          <div class="home-cat-card__name">${c.name}</div>
          <div class="home-cat-card__hook">${c.hook}</div>
          <div class="home-cat-card__desc">${c.desc}</div>
          <div class="home-cat-card__types">
            ${c.types.map(t => `<span class="home-cat-card__type-pill">${t}</span>`).join('')}
          </div>
          <div class="home-cat-card__cta">${c.cta} <span>→</span></div>
        </div>`).join('')}
    </div>`;
}

function formatCountdown(endDate) {
  const ms = endDate.toDate().getTime() - Date.now();
  if (ms <= 0) return '마감됨';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}일 남음`;
  if (h > 0)   return `${h}시간 ${m}분 남음`;
  return `${m}분 남음`;
}

function renderMissionWidget(mission) {
  const countdown = mission.endDate ? formatCountdown(mission.endDate) : null;
  return `
    <div class="sidebar-widget sidebar-mission" onclick="navigate('/mission')" role="button" tabindex="0">
      <div class="sidebar-widget__title">🎯 오늘의 미션</div>
      <div class="sidebar-mission__badge">✅ 진행 중${countdown ? ` · ⏰ ${countdown}` : ''}</div>
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

function renderBestCommentWidget() {
  return `
    <div class="sidebar-widget best-comment-widget">
      <div class="sidebar-widget__title">😂 오늘의 베스트 댓글</div>
      <div id="best-comment-list" style="margin-top:8px">
        <div style="font-size:12px;color:var(--color-text-muted)">로딩 중...</div>
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
    { icon: '🎮', label: '도전봐', desc: '퀴즈·릴레이·랜덤대결', cat: 'malhe' },
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

function renderStreakWidget(streak) {
  const fire = streak >= 7 ? '🔥🔥' : streak >= 3 ? '🔥' : '✨';
  return `
    <div class="sidebar-widget sidebar-streak">
      <div class="sidebar-widget__title">출석 스트릭</div>
      <div class="streak-display">
        <span class="streak-fire">${fire}</span>
        <span class="streak-num">${streak}일</span>
        <span class="streak-label">연속 출석 중!</span>
      </div>
      ${streak >= 7 ? '<div class="streak-msg">🏆 7일 달성! 주간 챌린저</div>' : ''}
    </div>`;
}

function renderWeeklyBestWidget({ topAcrostics, topDrips }) {
  const acrosticHtml = topAcrostics.map((a, i) => `
    <div class="weekly-best-item" onclick="navigate('/detail/${a.postId}')" role="button">
      <span class="weekly-best-rank">${i + 1}</span>
      <div class="weekly-best-body">
        <div class="weekly-best-text">${escHtml(a.lines?.map(l => `${l.char}: ${l.line}`).join(' / ') || a.text)}</div>
        <div class="weekly-best-meta">${escHtml(a.authorName)} · 제시어: ${escHtml(a.keyword)} · ❤️${a.total}</div>
      </div>
    </div>`).join('');

  const dripHtml = topDrips.map((d, i) => `
    <div class="weekly-best-item" onclick="navigate('/detail/${d.postId}')" role="button">
      <span class="weekly-best-rank">${i + 1}</span>
      <div class="weekly-best-body">
        <div class="weekly-best-text">${escHtml(d.text)}</div>
        <div class="weekly-best-meta">${escHtml(d.authorName)} · 👍${d.likes}</div>
      </div>
    </div>`).join('');

  return `
    <div class="sidebar-widget">
      <div class="sidebar-widget__title">🏅 주간 결선</div>
      ${topAcrostics.length ? `
        <div class="weekly-best-section">
          <div class="weekly-best-section__label">✍️ 삼행시 TOP</div>
          ${acrosticHtml}
        </div>` : ''}
      ${topDrips.length ? `
        <div class="weekly-best-section" style="margin-top:12px">
          <div class="weekly-best-section__label">🎤 드립 TOP</div>
          ${dripHtml}
        </div>` : ''}
    </div>`;
}

function renderHallOfFameWidget(posts) {
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  return `
    <div class="sidebar-widget">
      <div class="sidebar-widget__title">🏆 주간 명예의 전당</div>
      <div style="margin-top:8px">
        ${posts.map((p, i) => `
          <div class="sidebar-rank-item" onclick="navigate('/detail/${p.id}')" role="button">
            <span class="sidebar-rank-num">${medals[i] || i + 1}</span>
            <span class="sidebar-rank-title">${escHtml(p.title || '')}</span>
            <span class="sidebar-rank-meta">${p.reactions?.total || 0}❤️</span>
          </div>`).join('')}
      </div>
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

/* ── 오늘의 왕좌 ── */
function renderThroneSection(posts) {
  const thrones = THRONE_CATS.map(cat => {
    const pool = cat.type ? posts.filter(p => p.type === cat.type) : [...posts];
    const top = (cat.scoreKey === 'comment'
      ? [...pool].sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0))
      : [...pool].sort((a, b) => throneScore(b) - throneScore(a))
    )[0] || null;
    return { ...cat, top };
  });

  return `
    <div class="throne-section">
      <div class="throne-section__head">
        <div class="throne-section__title">👑 오늘의 왕좌</div>
        <button class="btn btn--ghost btn--sm" id="btn-throne-random">🎲 랜덤 도전 →</button>
      </div>
      <div class="throne-grid">
        ${thrones.map(t => t.top ? `
          <div class="throne-card" onclick="navigate('/detail/${t.top.id}')" role="button">
            <div class="throne-card__crown">${t.icon}</div>
            <div class="throne-card__label">${t.label}</div>
            <div class="throne-card__title">${escHtml(t.top.title || '(제목 없음)')}</div>
            <div class="throne-card__author">${escHtml(t.top.authorName || '')}</div>
            <div class="throne-card__score">❤️${t.top.reactions?.total || 0} 💬${t.top.commentCount || 0}</div>
          </div>` : `
          <div class="throne-card throne-card--empty">
            <div class="throne-card__crown">${t.icon}</div>
            <div class="throne-card__label">${t.label}</div>
            <div class="throne-card__empty-msg">아직 비어 있어요</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ── 지금 바로 한 판 놀기 ── */
function renderRandomBox(posts) {
  const post = pickRandomPost(posts);
  if (!post) return '';
  return `
    <div class="random-box">
      <div class="random-box__badge">🎲 지금 바로 한 판 놀기</div>
      <div class="random-box__title">${escHtml(post.title || '놀이판에 참여해보세요!')}</div>
      <div class="random-box__meta">${escHtml(post.authorName || '')} · ❤️${post.reactions?.total || 0}</div>
      <div class="random-box__actions">
        <button class="btn btn--primary btn--sm" id="btn-random-box">지금 참여하기 →</button>
        <span class="random-box__sub">랜덤으로 선택됐어요</span>
      </div>
    </div>`;
}

/* ── 사이드바 랜덤 CTA ── */
function renderSidebarRandomCTA(posts) {
  return `
    <div class="sidebar-widget sidebar-random" role="button" tabindex="0" id="btn-sidebar-random">
      <div class="sidebar-widget__title">🎲 랜덤으로 놀기</div>
      <div style="font-size:13px;color:var(--color-text-muted);margin:8px 0">참여형 글 중 랜덤 선택!<br>어떤 놀이판이 나올까요?</div>
      <button class="btn btn--sm btn--full" style="background:var(--color-primary);color:#fff;margin-top:4px">도전하기 →</button>
    </div>`;
}

/* ── 데이터 ── */
async function fetchRecentPosts(n = 6) {
  try {
    const q = query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n + 5));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden).slice(0, n);
  } catch { return []; }
}

async function fetchThronePosts(n = 80) {
  try {
    const q = query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(n + 10));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden).slice(0, n);
  } catch { return []; }
}

async function fetchWeeklyHot(n = 5) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const q = query(
      collection(db, 'feeds'),
      where('createdAt', '>=', Timestamp.fromDate(weekAgo)),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.hidden)
      .sort((a, b) => (b.reactions?.total || 0) - (a.reactions?.total || 0))
      .slice(0, n);
  } catch { return []; }
}

async function callGetWeeklyBest() {
  try {
    const fn = httpsCallable(functions, 'getWeeklyBest');
    const { data } = await fn();
    const { topAcrostics = [], topDrips = [] } = data || {};
    if (!topAcrostics.length && !topDrips.length) return null;
    return { topAcrostics, topDrips };
  } catch { return null; }
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

