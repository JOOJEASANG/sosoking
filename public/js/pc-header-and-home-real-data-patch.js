const HEADER_HOME_CLEANUP_STYLE_ID = 'sosoking-pc-header-home-cleanup-patch';

function injectHeaderAndHomeCleanupStyle() {
  if (document.getElementById(HEADER_HOME_CLEANUP_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HEADER_HOME_CLEANUP_STYLE_ID;
  style.textContent = `
    @media (min-width: 901px) {
      html body.soso-pc-home-active .soso-dashboard-header {
        padding-left: max(clamp(24px, 2.35vw, 48px), calc((100vw - 1780px) / 2)) !important;
        padding-right: max(clamp(24px, 2.35vw, 48px), calc((100vw - 1780px) / 2)) !important;
        box-sizing: border-box !important;
      }

      html body.soso-desktop-page-active .soso-dashboard-header {
        padding-left: max(clamp(28px, 3vw, 56px), calc((100vw - 1680px) / 2)) !important;
        padding-right: max(clamp(28px, 3vw, 56px), calc((100vw - 1680px) / 2)) !important;
        box-sizing: border-box !important;
      }

      html body .soso-dashboard-header .soso-top-brand {
        min-width: clamp(190px, 15vw, 250px) !important;
      }

      html body .soso-dashboard-header .soso-top-tools {
        min-width: clamp(310px, 25vw, 430px) !important;
      }
    }

    .home-empty-feed {
      grid-column: 1 / -1;
      min-height: 210px;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 30px 18px;
      border: 1px dashed rgba(124,92,255,.25);
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(255,255,255,.92), rgba(244,240,255,.75));
      color: #151a33;
    }

    .home-empty-feed i {
      font-style: normal;
      display: grid;
      place-items: center;
      width: 62px;
      height: 62px;
      margin: 0 auto 12px;
      border-radius: 22px;
      background: linear-gradient(135deg, #fff7d7, #eef3ff);
      font-size: 30px;
      box-shadow: 0 12px 30px rgba(55,90,170,.10);
    }

    .home-empty-feed b {
      display: block;
      font-size: 21px;
      letter-spacing: -.055em;
      margin-bottom: 6px;
    }

    .home-empty-feed p {
      margin: 0 0 14px;
      color: #667085;
      font-size: 13px;
      line-height: 1.6;
      font-weight: 850;
    }

    .home-empty-feed a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 42px;
      padding: 0 16px;
      border-radius: 999px;
      background: linear-gradient(135deg, #ff7a59, #ff5c8a, #7c5cff);
      color: #fff;
      text-decoration: none;
      font-size: 13px;
      font-weight: 1000;
    }

    .home-empty-popular {
      padding: 18px 8px 6px;
      color: #667085;
      font-size: 13px;
      line-height: 1.6;
      font-weight: 850;
      text-align: center;
    }

    .home-real-stats-note {
      display: block;
      margin-top: 12px;
      color: #667085;
      font-size: 13px;
      line-height: 1.6;
      font-weight: 850;
    }

    [data-theme="dark"] .home-empty-feed {
      background: linear-gradient(135deg, rgba(16,23,34,.92), rgba(35,28,58,.72));
      border-color: rgba(255,255,255,.12);
      color: #f5f7fb;
    }

    [data-theme="dark"] .home-empty-feed p,
    [data-theme="dark"] .home-empty-popular,
    [data-theme="dark"] .home-real-stats-note {
      color: #a8b3c7;
    }
  `;
  document.head.appendChild(style);
}

function isDemoHomeState() {
  const grid = document.querySelector('.pc-home-like-shot .dash-feed-grid');
  if (!grid) return false;
  const cards = [...grid.querySelectorAll('.dash-feed-card')];
  if (!cards.length) return true;
  return cards.length > 0 && cards.every(card => {
    const href = card.getAttribute('href') || '';
    return href === '#/feed/new' || href.endsWith('#/feed/new');
  });
}

function cleanupHomeDemoData() {
  injectHeaderAndHomeCleanupStyle();
  const home = document.querySelector('.pc-home-like-shot');
  if (!home) return;

  if (isDemoHomeState()) {
    const grid = home.querySelector('.dash-feed-grid');
    if (grid && grid.dataset.realEmptyPatched !== '1') {
      grid.dataset.realEmptyPatched = '1';
      grid.innerHTML = `
        <section class="home-empty-feed">
          <div><i>📝</i><b>아직 등록된 게시글이 없습니다</b><p>첫 소소피드를 올리면 이 영역에 실제 게시글이 표시됩니다.<br>가상 샘플 게시글은 더 이상 노출하지 않습니다.</p><a href="#/feed/new">첫 게시글 작성하기</a></div>
        </section>`;
    }

    const popular = home.querySelector('.dash-side-card.popular');
    if (popular && popular.dataset.realEmptyPatched !== '1') {
      popular.dataset.realEmptyPatched = '1';
      popular.querySelectorAll('.top-item').forEach(item => item.remove());
      popular.insertAdjacentHTML('beforeend', '<div class="home-empty-popular">실제 게시글이 쌓이면 인기글 순위가 표시됩니다.</div>');
    }

    home.querySelectorAll('.dash-more').forEach(link => {
      link.textContent = '첫 게시글 작성하기';
      link.setAttribute('href', '#/feed/new');
    });
  }

  const stats = home.querySelector('.dash-bottom-banners .stats');
  if (stats && stats.dataset.realStatsPatched !== '1') {
    stats.dataset.realStatsPatched = '1';
    stats.innerHTML = `<b>소소킹 활동 통계</b><span class="home-real-stats-note">실제 회원, 게시글, 댓글 데이터가 쌓이면 이곳에 집계해서 표시됩니다.</span>`;
  }
}

const observer = new MutationObserver(cleanupHomeDemoData);
observer.observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cleanupHomeDemoData);
else cleanupHomeDemoData();

setTimeout(cleanupHomeDemoData, 0);
setTimeout(cleanupHomeDemoData, 250);
setTimeout(cleanupHomeDemoData, 1000);
window.addEventListener('hashchange', () => setTimeout(cleanupHomeDemoData, 50));
window.addEventListener('resize', () => setTimeout(cleanupHomeDemoData, 80));
