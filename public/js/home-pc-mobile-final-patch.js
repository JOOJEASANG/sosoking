import './write-category-options-patch.js';

const STYLE_ID = 'sosoking-responsive-master-patch-v2';
let scheduled = false;
let lastHeaderState = '';
let lastRouteState = '';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root { --soso-wide: 1780px; --soso-page: 1680px; --soso-doc: 1320px; }

    @media (min-width: 901px) {
      body.soso-mode-pc { background:#f7f9ff!important; overflow-x:hidden!important; padding-top:78px!important; }
      body.soso-mode-pc #app, body.soso-mode-pc #page-content { width:100%!important; max-width:none!important; overflow:visible!important; }
      body.soso-mode-pc #bottom-nav, body.soso-mode-pc .bottom-nav, body.soso-mode-pc nav.bottom-nav { display:none!important; visibility:hidden!important; pointer-events:none!important; }
      body.soso-mode-pc #site-footer { padding-bottom:32px!important; }

      body.soso-mode-pc .soso-dashboard-header {
        display:flex!important; left:0!important; right:0!important; padding-left:max(clamp(24px,2.5vw,56px),calc((100vw - var(--soso-wide))/2))!important; padding-right:max(clamp(24px,2.5vw,56px),calc((100vw - var(--soso-wide))/2))!important; box-sizing:border-box!important;
      }
      body.soso-mode-pc:not(.soso-route-home) .soso-dashboard-header { padding-left:max(clamp(28px,3vw,56px),calc((100vw - var(--soso-page))/2))!important; padding-right:max(clamp(28px,3vw,56px),calc((100vw - var(--soso-page))/2))!important; }
      body.soso-mode-pc .soso-dashboard-header .soso-top-links a[href="#/account"] { display:none!important; }
      body.soso-mode-pc .soso-dashboard-header .soso-top-brand { min-width:clamp(190px,15vw,250px)!important; }
      body.soso-mode-pc .soso-dashboard-header .soso-top-tools { min-width:clamp(310px,24vw,430px)!important; }
      body.soso-mode-pc .soso-dashboard-header .soso-top-avatar { min-width:112px!important; height:48px!important; padding:0 10px 0 4px!important; border-radius:999px!important; background:rgba(255,255,255,.72)!important; border:1px solid rgba(79,124,255,.12)!important; box-shadow:0 10px 24px rgba(55,90,170,.08)!important; }
      body.soso-mode-pc .soso-dashboard-header .soso-top-avatar small { display:inline-flex!important; color:#151a33!important; font-size:13px!important; font-weight:1000!important; letter-spacing:-.04em!important; white-space:nowrap!important; }
      body.soso-mode-pc .soso-dashboard-header .soso-top-avatar i { width:42px!important; height:42px!important; font-size:20px!important; }
      body.soso-mode-pc .soso-dashboard-header .soso-top-avatar.is-active { background:linear-gradient(135deg,rgba(255,232,92,.45),rgba(124,92,255,.13))!important; border-color:rgba(124,92,255,.28)!important; }

      body.soso-mode-pc main.predict-app, body.soso-mode-pc .soso-feed-page, body.soso-mode-pc .account-page, body.soso-mode-pc .mission-page, body.soso-mode-pc .guide-page, body.soso-mode-pc .feedback-page {
        width:100vw!important; max-width:none!important; margin-left:calc(50% - 50vw)!important; margin-right:calc(50% - 50vw)!important; box-sizing:border-box!important; background:radial-gradient(circle at 12% 0%,rgba(255,232,92,.16),transparent 24%),radial-gradient(circle at 78% 0%,rgba(124,92,255,.12),transparent 30%),linear-gradient(180deg,#fbfcff 0%,#f5f7ff 100%)!important; color:#10172f!important;
      }
      body.soso-mode-pc main.predict-app:not(.pc-home-like-shot):not(.simple-auth-page) { padding:24px max(clamp(28px,3vw,56px),calc((100vw - var(--soso-page))/2)) 64px!important; }

      /* HOME */
      body.soso-mode-pc.soso-route-home .pc-home-like-shot { width:100vw!important; max-width:none!important; margin-left:calc(50% - 50vw)!important; margin-right:calc(50% - 50vw)!important; padding:18px max(clamp(24px,2.5vw,56px),calc((100vw - var(--soso-wide))/2)) 56px!important; box-sizing:border-box!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-shell { width:100%!important; max-width:var(--soso-wide)!important; margin:0 auto!important; display:grid!important; grid-template-columns:minmax(0,1fr) clamp(320px,22vw,380px)!important; gap:clamp(16px,1.4vw,24px)!important; align-items:start!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-main { display:grid!important; gap:16px!important; min-width:0!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-hero { min-height:clamp(340px,25vw,430px)!important; display:grid!important; grid-template-columns:minmax(0,1.1fr) minmax(360px,.62fr)!important; border-radius:34px!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-category-row { display:grid!important; grid-template-columns:repeat(6,minmax(0,1fr))!important; gap:14px!important; overflow:visible!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-feed-grid { display:grid!important; grid-template-columns:repeat(4,minmax(0,1fr))!important; gap:16px!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-bottom-banners { display:grid!important; grid-template-columns:1fr 1fr 1.08fr!important; gap:16px!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-sidebar { position:sticky!important; top:96px!important; display:grid!important; gap:16px!important; }

      /* AUTH */
      body.soso-mode-pc .simple-auth-page { min-height:calc(100vh - 78px)!important; padding:34px max(clamp(28px,3vw,56px),calc((100vw - 1500px)/2)) 70px!important; }
      body.soso-mode-pc .simple-auth-page .auth-simple-shell { width:100%!important; max-width:1500px!important; min-height:min(720px,calc(100vh - 160px))!important; margin:0 auto!important; display:grid!important; grid-template-columns:minmax(0,1fr) clamp(410px,32vw,520px)!important; gap:clamp(26px,3vw,56px)!important; align-items:stretch!important; position:relative!important; }
      body.soso-mode-pc .simple-auth-page .auth-simple-shell:before { content:''; display:block; border-radius:38px; background:linear-gradient(135deg,rgba(255,255,255,.90),rgba(255,255,255,.60)),radial-gradient(circle at 28% 25%,rgba(255,232,92,.42),transparent 28%),radial-gradient(circle at 72% 65%,rgba(124,92,255,.20),transparent 30%); border:1px solid rgba(104,121,255,.13); box-shadow:0 22px 70px rgba(43,61,130,.10); grid-column:1; grid-row:1; }
      body.soso-mode-pc .simple-auth-page .auth-simple-shell:after { content:'소소한 재미를\A함께 만드는 공간'; white-space:pre-line; position:absolute; left:clamp(38px,4vw,70px); top:clamp(44px,5vw,84px); width:min(520px,42vw); color:#0b1240; font-size:clamp(46px,4.4vw,76px); line-height:1.04; letter-spacing:-.09em; font-weight:1000; pointer-events:none; }
      body.soso-mode-pc .simple-auth-page .auth-simple-card { grid-column:2!important; grid-row:1!important; align-self:center!important; width:100%!important; margin:0!important; padding:clamp(24px,2.2vw,34px)!important; border-radius:34px!important; }
      body.soso-mode-pc .simple-auth-page .auth-simple-brand { text-align:left!important; margin-bottom:20px!important; }
      body.soso-mode-pc .simple-auth-page .auth-simple-brand img { width:72px!important; height:72px!important; border-radius:24px!important; }
      body.soso-mode-pc .simple-auth-page .auth-simple-brand h1 { font-size:clamp(34px,2.7vw,46px)!important; }
      body.soso-mode-pc .simple-auth-page .auth-form-v2 input, body.soso-mode-pc .simple-auth-page .google-btn-v2, body.soso-mode-pc .simple-auth-page .guest-btn-v2, body.soso-mode-pc .simple-auth-page .auth-form-v2>button { min-height:52px!important; font-size:15px!important; }

      /* FEED / WRITE / DETAIL */
      body.soso-mode-pc .soso-feed-page .feed-hero, body.soso-mode-pc .soso-feed-page .feed-dashboard, body.soso-mode-pc .soso-feed-page .feed-search-panel, body.soso-mode-pc .soso-feed-page .feed-layout, body.soso-mode-pc .soso-feed-page .feed-detail-layout, body.soso-mode-pc .soso-feed-page .comments-section, body.soso-mode-pc .soso-feed-page .write-layout, body.soso-mode-pc .feed-write-header { width:100%!important; max-width:var(--soso-page)!important; margin-left:auto!important; margin-right:auto!important; box-sizing:border-box!important; }
      body.soso-mode-pc .soso-feed-page .feed-layout { display:grid!important; grid-template-columns:minmax(0,1fr) clamp(300px,21vw,360px)!important; gap:20px!important; align-items:start!important; }
      body.soso-mode-pc .soso-feed-page .feed-list { display:grid!important; grid-template-columns:repeat(3,minmax(0,1fr))!important; gap:18px!important; }
      body.soso-mode-pc .soso-feed-page .feed-card { width:auto!important; max-width:none!important; min-width:0!important; border-radius:26px!important; }
      body.soso-mode-pc .soso-feed-page .feed-side, body.soso-mode-pc .soso-feed-page .detail-side, body.soso-mode-pc .soso-feed-page .write-preview { position:sticky!important; top:96px!important; }
      body.soso-mode-pc .soso-feed-page .feed-detail-layout { display:grid!important; grid-template-columns:minmax(0,1fr) clamp(300px,22vw,380px)!important; gap:20px!important; align-items:start!important; }
      body.soso-mode-pc .soso-feed-page .write-layout { display:grid!important; grid-template-columns:minmax(0,1fr) clamp(360px,28vw,500px)!important; gap:22px!important; align-items:start!important; margin-top:18px!important; }
      body.soso-mode-pc .soso-feed-page .category-grid { display:grid!important; grid-template-columns:repeat(4,minmax(0,1fr))!important; gap:12px!important; }
      body.soso-mode-pc .soso-feed-page .option-editor { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:10px!important; }

      /* MISSION / ACCOUNT / DOC */
      body.soso-mode-pc .mission-page .mission-hero, body.soso-mode-pc .mission-page .mission-layout, body.soso-mode-pc .mission-page .mission-grid, body.soso-mode-pc .mission-page .mission-section { width:100%!important; max-width:var(--soso-page)!important; margin-left:auto!important; margin-right:auto!important; }
      body.soso-mode-pc .mission-page .mission-layout, body.soso-mode-pc .mission-page .mission-grid { display:grid!important; grid-template-columns:repeat(3,minmax(0,1fr))!important; gap:18px!important; }
      body.soso-mode-pc .account-page .account-hero, body.soso-mode-pc .account-page .account-layout { width:100%!important; max-width:1500px!important; margin-left:auto!important; margin-right:auto!important; }
      body.soso-mode-pc .account-page .account-layout { display:grid!important; grid-template-columns:clamp(280px,22vw,340px) minmax(0,1fr)!important; gap:20px!important; }
      body.soso-mode-pc .account-page .account-panels { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:16px!important; }
      body.soso-mode-pc .guide-page>section, body.soso-mode-pc .feedback-page>section, body.soso-mode-pc .policy-page>section, body.soso-mode-pc .doc-page>section, body.soso-mode-pc .predict-policy-page>section { width:100%!important; max-width:var(--soso-doc)!important; margin-left:auto!important; margin-right:auto!important; }
    }

    @media (min-width:901px) and (max-width:1280px) {
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-shell { grid-template-columns:minmax(0,1fr) 320px!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-feed-grid, body.soso-mode-pc .soso-feed-page .feed-list { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
      body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-category-row, body.soso-mode-pc .soso-feed-page .category-grid, body.soso-mode-pc .mission-page .mission-layout, body.soso-mode-pc .mission-page .mission-grid, body.soso-mode-pc .account-page .account-panels { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
      body.soso-mode-pc .simple-auth-page .auth-simple-shell { grid-template-columns:minmax(0,.9fr) 430px!important; }
      body.soso-mode-pc .simple-auth-page .auth-simple-shell:after { font-size:clamp(38px,4.1vw,56px)!important; }
    }

    @media (max-width:900px) {
      body.soso-mode-mobile { padding-top:0!important; overflow-x:hidden!important; }
      body.soso-mode-mobile .soso-dashboard-header { display:none!important; }
      body.soso-mode-mobile #bottom-nav { display:flex!important; }
      body.soso-mode-mobile #site-footer { padding-bottom:72px!important; }
      body.soso-mode-mobile main.predict-app, body.soso-mode-mobile .soso-feed-page, body.soso-mode-mobile .account-page, body.soso-mode-mobile .mission-page, body.soso-mode-mobile .guide-page, body.soso-mode-mobile .feedback-page { width:100%!important; max-width:560px!important; margin:0 auto!important; padding:14px 14px 108px!important; box-sizing:border-box!important; }
      body.soso-mode-mobile .pc-home-like-shot .dash-shell, body.soso-mode-mobile .soso-feed-page .feed-layout, body.soso-mode-mobile .soso-feed-page .feed-detail-layout, body.soso-mode-mobile .soso-feed-page .write-layout, body.soso-mode-mobile .account-page .account-layout { display:grid!important; grid-template-columns:1fr!important; gap:14px!important; width:100%!important; max-width:100%!important; }
      body.soso-mode-mobile .pc-home-like-shot .dash-hero { grid-template-columns:1fr!important; min-height:auto!important; border-radius:30px!important; }
      body.soso-mode-mobile .pc-home-like-shot .dash-category-row { display:flex!important; overflow-x:auto!important; gap:10px!important; scroll-snap-type:x mandatory!important; }
      body.soso-mode-mobile .pc-home-like-shot .dash-category { flex:0 0 210px!important; min-width:210px!important; }
      body.soso-mode-mobile .pc-home-like-shot .dash-feed-grid, body.soso-mode-mobile .pc-home-like-shot .dash-sidebar, body.soso-mode-mobile .pc-home-like-shot .dash-bottom-banners { display:grid!important; grid-template-columns:1fr!important; gap:13px!important; }
      body.soso-mode-mobile .simple-auth-page .auth-simple-shell { width:min(398px,100%)!important; display:block!important; }
    }

    .home-empty-feed { grid-column:1/-1; min-height:210px; display:grid; place-items:center; text-align:center; padding:30px 18px; border:1px dashed rgba(124,92,255,.25); border-radius:24px; background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(244,240,255,.75)); color:#151a33; }
    .home-empty-feed i { font-style:normal; display:grid; place-items:center; width:62px; height:62px; margin:0 auto 12px; border-radius:22px; background:linear-gradient(135deg,#fff7d7,#eef3ff); font-size:30px; box-shadow:0 12px 30px rgba(55,90,170,.10); }
    .home-empty-feed b { display:block; font-size:21px; letter-spacing:-.055em; margin-bottom:6px; }
    .home-empty-feed p { margin:0 0 14px; color:#667085; font-size:13px; line-height:1.6; font-weight:850; }
    .home-empty-feed a { display:inline-flex; align-items:center; justify-content:center; height:42px; padding:0 16px; border-radius:999px; background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff); color:#fff; text-decoration:none; font-size:13px; font-weight:1000; }
    .home-empty-popular, .home-real-stats-note { display:block; color:#667085; font-size:13px; line-height:1.6; font-weight:850; text-align:center; }

    [data-theme="dark"] body.soso-mode-pc .soso-dashboard-header .soso-top-avatar { background:rgba(255,255,255,.08)!important; border-color:rgba(255,255,255,.12)!important; }
    [data-theme="dark"] body.soso-mode-pc .soso-dashboard-header .soso-top-avatar small { color:#f5f7fb!important; }
    [data-theme="dark"] body .home-empty-feed { background:linear-gradient(135deg,rgba(16,23,34,.92),rgba(35,28,58,.72)); border-color:rgba(255,255,255,.12); color:#f5f7fb; }
    [data-theme="dark"] body .home-empty-feed p, [data-theme="dark"] body .home-empty-popular, [data-theme="dark"] body .home-real-stats-note { color:#a8b3c7; }
  `;
  document.head.appendChild(style);
}

function getRouteName() {
  const hash = location.hash || '#/';
  if (hash === '#/' || hash === '' || hash === '#') return 'home';
  if (hash === '#/login') return 'auth';
  if (hash === '#/feed/new') return 'write';
  if (hash.startsWith('#/feed/') && hash !== '#/feed/top') return 'feed-detail';
  if (hash.startsWith('#/feed')) return 'feed';
  if (hash === '#/mission') return 'mission';
  if (hash === '#/account') return 'account';
  if (hash === '#/feedback') return 'feedback';
  if (hash === '#/guide' || hash.startsWith('#/policy/')) return 'doc';
  return 'page';
}

function patchHeader() {
  const header = document.querySelector('.soso-dashboard-header');
  if (!header) return;
  header.querySelectorAll('.soso-top-links a[href="#/account"]').forEach(link => link.remove());
  const avatar = header.querySelector('.soso-top-avatar');
  if (!avatar) return;
  const user = window.firebaseAuthUser || null;
  const realUser = Boolean(user && !user.isAnonymous);
  const route = getRouteName();
  const state = `${realUser ? 'in' : 'out'}:${route}`;
  if (lastHeaderState !== state || avatar.dataset.masterState !== state) {
    lastHeaderState = state;
    avatar.dataset.masterState = state;
    avatar.classList.toggle('is-active', route === 'account');
    avatar.setAttribute('aria-label', realUser ? '내 정보로 이동' : '로그인으로 이동');
    avatar.innerHTML = `<i>${realUser ? '🧑' : '🔐'}</i><small>${realUser ? '내정보' : '로그인'}</small><span>⌄</span>`;
  }
  if (avatar.dataset.masterClick !== '1') {
    avatar.dataset.masterClick = '1';
    avatar.addEventListener('click', () => {
      location.hash = window.firebaseAuthUser && !window.firebaseAuthUser.isAnonymous ? '#/account' : '#/login';
    });
  }
}

function isDemoHomeState() {
  const grid = document.querySelector('.pc-home-like-shot .dash-feed-grid');
  if (!grid) return false;
  const cards = [...grid.querySelectorAll('.dash-feed-card')];
  if (!cards.length) return true;
  return cards.every(card => (card.getAttribute('href') || '') === '#/feed/new');
}

function cleanupHomeDemoData() {
  const home = document.querySelector('.pc-home-like-shot');
  if (!home || !isDemoHomeState()) return;
  const grid = home.querySelector('.dash-feed-grid');
  if (grid && grid.dataset.realEmptyPatched !== '1') {
    grid.dataset.realEmptyPatched = '1';
    grid.innerHTML = `<section class="home-empty-feed"><div><i>📝</i><b>아직 등록된 게시글이 없습니다</b><p>첫 소소피드를 올리면 이 영역에 실제 게시글이 표시됩니다.<br>가상 샘플 게시글은 노출하지 않습니다.</p><a href="#/feed/new">첫 게시글 작성하기</a></div></section>`;
  }
  const popular = home.querySelector('.dash-side-card.popular');
  if (popular && popular.dataset.realEmptyPatched !== '1') {
    popular.dataset.realEmptyPatched = '1';
    popular.querySelectorAll('.top-item').forEach(item => item.remove());
    popular.insertAdjacentHTML('beforeend', '<div class="home-empty-popular">실제 게시글이 쌓이면 인기글 순위가 표시됩니다.</div>');
  }
  home.querySelectorAll('.dash-more').forEach(link => { link.textContent = '첫 게시글 작성하기'; link.setAttribute('href', '#/feed/new'); });
  const stats = home.querySelector('.dash-bottom-banners .stats');
  if (stats && stats.dataset.realStatsPatched !== '1') {
    stats.dataset.realStatsPatched = '1';
    stats.innerHTML = `<b>소소킹 활동 통계</b><span class="home-real-stats-note">실제 회원, 게시글, 댓글 데이터가 쌓이면 이곳에 집계해서 표시됩니다.</span>`;
  }
}

function applyResponsiveState() {
  injectStyle();
  const isPc = window.matchMedia('(min-width: 901px)').matches;
  const route = getRouteName();
  const state = `${isPc ? 'pc' : 'mobile'}:${route}`;
  if (lastRouteState !== state) {
    const remove = [...document.body.classList].filter(c => c.startsWith('soso-route-'));
    document.body.classList.remove(...remove);
    document.body.classList.toggle('soso-mode-pc', isPc);
    document.body.classList.toggle('soso-mode-mobile', !isPc);
    document.body.classList.add(`soso-route-${route}`);
    lastRouteState = state;
  }
  patchHeader();
  cleanupHomeDemoData();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; applyResponsiveState(); });
}

window.firebaseAuthUser = window.firebaseAuthUser || null;
const pageContent = document.getElementById('page-content') || document.body;
new MutationObserver(schedule).observe(pageContent, { childList:true, subtree:true });
new MutationObserver(schedule).observe(document.body, { childList:true, subtree:false });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
else schedule();
window.addEventListener('hashchange', schedule);
window.addEventListener('resize', () => setTimeout(schedule, 80));
setTimeout(schedule, 0);
setTimeout(schedule, 250);
setTimeout(schedule, 1000);
