import { getFeedPosts } from '../feed/feed-engine.js';
import { injectSosoStyle } from '../components/soso-style.js';

export function renderSosoHome(container) {
  injectSosoStyle();
  injectHomeStyle();
  draw(container, []);
  getFeedPosts({ pageSize: 12 }).then(items => draw(container, items || [])).catch(() => draw(container, []));
}

function draw(container, items = []) {
  const popular = [...items].sort((a, b) => score(b) - score(a)).slice(0, 5);
  const recent = items.slice(0, 6);
  container.innerHTML = `
    <main class="predict-app soso-home-dashboard">
      <section class="dash-shell">
        <div class="dash-main">
          <section class="dash-hero">
            <div class="dash-hero-copy">
              <span>좋아하는 모든 재미를 한 곳에! ✨</span>
              <h1>소소한 즐거움이<br><em>모여 커다란 재미로!</em></h1>
              <p>피드, 퀴즈, 투표, 정보공유, 릴레이소설, 역할극까지. 소소킹에서 함께 즐기고, 소통하고, 성장해요.</p>
              <div class="dash-hero-actions"><a class="primary" href="#/feed/new">👑 지금 가입하고 즐기기</a><a href="#/feed">▶ 서비스 둘러보기</a></div>
            </div>
            <div class="dash-mascot-stage">
              <div class="dash-orbit icon-a">💬</div><div class="dash-orbit icon-b">🎮</div><div class="dash-orbit icon-c">⭐</div><div class="dash-orbit icon-d">📚</div>
              <div class="dash-mascot"><img src="/logo.svg" alt="소소킹"><b>소소킹</b></div>
              <div class="dash-pedestal"></div>
            </div>
          </section>

          <section class="dash-category-row">
            ${categoryCard('정보공유','새로운 정보와 꿀팁을 나눠요','📋','#/feed/new','blue')}
            ${categoryCard('퀴즈','지식도 즐거움도 퀴즈로 해결!','❓','#/feed/new','purple')}
            ${categoryCard('밸런스게임','당신의 선택은? 재미있는 밸런스!','⚖️','#/feed/new','orange')}
            ${categoryCard('릴레이소설','이야기를 이어 함께 소설을 완성!','📗','#/feed/new','green')}
            ${categoryCard('역할극방','나만의 캐릭터로 몰입하는 세계!','🎭','#/feed/new','pink')}
            ${categoryCard('영상 리액션','보고, 웃고, 리액션을 공유!','🎬','#/feed/new','navy')}
          </section>

          <section class="dash-feed-panel">
            <div class="dash-section-head"><div><span>⚡ 실시간 피드</span><h2>지금 올라온 소소피드</h2></div><div class="dash-tabs"><b>최신</b><a href="#/feed/top">인기</a><a href="#/feed">전체</a></div></div>
            <div class="dash-feed-grid">${recent.length ? recent.map(feedCard).join('') : emptyFeedCards()}</div>
            <a class="dash-more" href="#/feed">더 많은 피드 보기⌄</a>
          </section>

          <section class="dash-bottom-banners">
            <article><div><b>모바일에서도 완벽한 소소킹</b><p>PWA 지원으로 앱처럼 빠르고 간편하게 사용할 수 있어요.</p><button id="home-install-btn" type="button">앱처럼 추가하기 ›</button></div><i>📱</i></article>
            <article><div><b>함께 만들어가는 소소킹</b><p>여러분의 아이디어가 새로운 기능이 됩니다.</p><a href="#/feedback">의견 제안하기 ›</a></div><i>💬</i></article>
            <article class="stats"><b>지금 이 순간에도, 소소킹은 성장 중!</b><div><span>👥<strong>커뮤니티</strong><small>함께 참여</small></span><span>⚡<strong>${num(items.length)}</strong><small>최근 피드</small></span><span>📝<strong>만들기</strong><small>카테고리형</small></span><span>👑<strong>소소킹</strong><small>피드형 공간</small></span></div></article>
          </section>
        </div>

        <aside class="dash-sidebar">
          <section class="dash-side-card popular"><div class="side-title"><b>🔥 인기글 TOP 5</b><a href="#/feed/top">더보기 ›</a></div>${popular.length ? popular.map((item, index) => topItem(item, index)).join('') : emptyTopItems()}</section>
          <section class="dash-side-card mission"><div class="side-title"><b>🎯 오늘의 미션</b><a href="#/mission">더보기 ›</a></div><p>피드에 댓글 3개 남기기</p><div class="mission-bar"><i style="width:60%"></i><span>3 / 5</span></div><small>완료하면 참여 배지가 표시됩니다</small><a class="side-cta" href="#/mission">미션 보러가기</a></section>
          <section class="dash-side-card install"><div><b>📱 소소킹 앱 설치하고 더 편하게!</b><p>언제 어디서나 앱처럼 빠르게 접속해보세요.</p><button id="side-install-btn" type="button">Android</button><button id="side-install-btn2" type="button">iOS</button></div><img src="/logo.svg" alt="소소킹"></section>
          <section class="dash-side-card rules"><div class="side-title"><b>📜 커뮤니티 규칙</b><a href="#/guide">더보기 ›</a></div><ol><li>서로 존중하며 배려하는 문화를 만들어요.</li><li>혐오, 비방, 개인정보 노출은 금지!</li><li>창작과 정보는 출처를 함께 적어주세요.</li><li>재미있는 콘텐츠로 소소한 행복을 나눠요.</li></ol></section>
        </aside>
      </section>
    </main>`;
  const install = () => { if (typeof window._pwaInstall === 'function') window._pwaInstall(); else alert('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해주세요.'); };
  container.querySelector('#home-install-btn')?.addEventListener('click', install);
  container.querySelector('#side-install-btn')?.addEventListener('click', install);
  container.querySelector('#side-install-btn2')?.addEventListener('click', install);
}

function categoryCard(title, text, icon, href, tone) {
  return `<a href="${href}" class="dash-category ${tone}"><div><b>${e(title)}</b><span>${e(text)}</span></div><i>${icon}</i></a>`;
}

function feedCard(item) {
  const title = item.title || '제목 없는 소소피드';
  const summary = item.summary || item.content || '';
  const img = item.imageUrl ? `<img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(title)}">` : `<div class="feed-thumb fake">${e(item.badge || '✨')}</div>`;
  return `<a class="dash-feed-card" href="#/feed/${encodeURIComponent(item.id)}"><div class="feed-badge">${e(item.badge || '✨')} ${e(item.type || '소소피드')}</div>${img}<h3>${e(title)}</h3><p>${e(summary)}</p><footer><span>🧑 ${e(item.authorName || '소소러')}</span><span>♡ ${num(item.stats?.likes || 0)}</span><span>💬 ${num(item.stats?.comments || 0)}</span></footer></a>`;
}

function topItem(item, index) {
  const title = item.title || '소소피드';
  const thumb = item.imageUrl ? `<img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(title)}">` : `<i>${e(item.badge || '✨')}</i>`;
  return `<a href="#/feed/${encodeURIComponent(item.id)}" class="top-item"><strong>${index + 1}</strong>${thumb}<div><b>${e(title)}</b><small>♡ ${num(item.stats?.likes || 0)} · 💬 ${num(item.stats?.comments || 0)}</small></div></a>`;
}

function emptyTopItems() {
  return [1,2,3,4,5].map(i => `<div class="top-item empty"><strong>${i}</strong><i>✨</i><div><b>인기글을 기다리는 중</b><small>첫 소소피드를 올려보세요</small></div></div>`).join('');
}

function emptyFeedCards() {
  return `<div class="dash-empty"><b>아직 피드가 없습니다</b><p>첫 정보공유, 퀴즈, 릴레이소설을 올리면 이곳에 표시됩니다.</p><a href="#/feed/new">첫 소소피드 만들기</a></div>`;
}

function score(item) { return Number(item.stats?.views || 0) + Number(item.stats?.likes || 0) * 5 + Number(item.stats?.comments || 0) * 8 + Number(item.stats?.votes || 0) * 3; }
function num(value) { return Number(value || 0).toLocaleString(); }
function e(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function escapeAttr(s){return e(s).replace(/"/g,'&quot;').replace(/'/g,'&#039;')}

function injectHomeStyle() {
  if (document.getElementById('sosoking-home-dashboard-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-home-dashboard-style';
  style.textContent = `
    .soso-home-dashboard{min-height:100vh;padding:26px clamp(20px,3vw,46px) 118px;background:radial-gradient(circle at 8% 0%,rgba(255,232,92,.34),transparent 28%),radial-gradient(circle at 70% 2%,rgba(124,92,255,.20),transparent 31%),radial-gradient(circle at 95% 22%,rgba(255,92,138,.13),transparent 25%),linear-gradient(180deg,#fffaf5 0%,#f6f8ff 42%,#fbfcff 100%)!important;color:#10172f}.dash-shell{width:min(1540px,calc(100vw - 72px));margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:20px;align-items:start}.dash-main{display:grid;gap:18px}.dash-hero{position:relative;min-height:390px;display:grid;grid-template-columns:minmax(0,1.08fr) 460px;gap:16px;align-items:stretch;border:1px solid rgba(79,124,255,.13);border-radius:36px;background:linear-gradient(118deg,rgba(255,255,255,.96),rgba(244,239,255,.90) 50%,rgba(255,244,236,.94));box-shadow:0 26px 88px rgba(55,90,170,.15);overflow:hidden}.dash-hero:before{content:'';position:absolute;inset:auto auto -100px -80px;width:300px;height:300px;border-radius:999px;background:radial-gradient(circle,rgba(255,232,92,.55),transparent 68%)}.dash-hero:after{content:'SOSO';position:absolute;right:380px;bottom:-28px;font-size:102px;font-weight:1000;letter-spacing:-.1em;color:rgba(79,124,255,.055);transform:rotate(-8deg)}.dash-hero-copy{position:relative;z-index:1;padding:46px 42px}.dash-hero-copy span{display:inline-flex;color:#6d38ff;font-weight:1000;font-size:14px}.dash-hero-copy h1{margin:15px 0 14px;font-size:clamp(58px,5.1vw,86px);line-height:1.01;letter-spacing:-.092em;color:#080d35}.dash-hero-copy h1 em{font-style:normal;background:linear-gradient(135deg,#4f7cff 0%,#6d38ff 38%,#ff5c8a 68%,#ff7a59);-webkit-background-clip:text;background-clip:text;color:transparent}.dash-hero-copy p{max-width:680px;margin:0;color:#667085;line-height:1.74;font-weight:800;font-size:16px}.dash-hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.dash-hero-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 21px;border-radius:999px;text-decoration:none;font-weight:1000;border:1px solid rgba(79,124,255,.14);background:#fff;color:#111936;box-shadow:0 10px 26px rgba(55,90,170,.08)}.dash-hero-actions a.primary{border:0;background:linear-gradient(135deg,#ff7a59,#ff5c8a,#6d38ff);color:#fff;box-shadow:0 16px 38px rgba(255,92,138,.28)}.dash-mascot-stage{position:relative;display:grid;place-items:center;min-height:390px;background:radial-gradient(circle at 50% 48%,rgba(255,255,255,.78),rgba(124,92,255,.15) 52%,transparent 73%)}.dash-mascot-stage:before{content:'';position:absolute;width:330px;height:330px;border-radius:999px;background:linear-gradient(135deg,rgba(255,232,92,.25),rgba(255,92,138,.16),rgba(124,92,255,.12));filter:blur(.4px)}.dash-mascot{position:relative;z-index:3;display:grid;place-items:center;width:205px;height:205px;border-radius:68px;background:linear-gradient(135deg,#fff,#fff7d7);box-shadow:0 28px 82px rgba(124,92,255,.27),0 0 0 12px rgba(255,255,255,.48);transform:rotate(-3deg)}.dash-mascot img{width:148px;height:148px;border-radius:44px}.dash-mascot b{position:absolute;bottom:-42px;padding:9px 15px;border-radius:999px;background:#fff;color:#6d38ff;box-shadow:0 10px 24px rgba(55,90,170,.12)}.dash-pedestal{position:absolute;z-index:1;bottom:44px;width:285px;height:58px;border-radius:999px;background:linear-gradient(135deg,rgba(255,122,89,.24),rgba(124,92,255,.20));filter:blur(.2px)}.dash-orbit{position:absolute;z-index:2;display:grid;place-items:center;width:62px;height:62px;border-radius:24px;background:#fff;box-shadow:0 16px 36px rgba(55,90,170,.16);font-size:30px}.icon-a{left:34px;top:86px}.icon-b{right:54px;top:60px}.icon-c{right:72px;bottom:106px}.icon-d{left:76px;bottom:94px}.dash-category-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:13px}.dash-category{min-height:126px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:18px;border-radius:26px;text-decoration:none;border:1px solid rgba(79,124,255,.11);box-shadow:0 16px 44px rgba(55,90,170,.10);color:#10172f;overflow:hidden;transition:.16s transform,.16s box-shadow}.dash-category:hover{transform:translateY(-5px);box-shadow:0 24px 68px rgba(55,90,170,.16)}.dash-category b{display:block;margin-bottom:6px;font-size:18px;letter-spacing:-.055em}.dash-category span{display:block;color:#6b7280;font-size:12px;line-height:1.45;font-weight:800}.dash-category i{font-style:normal;font-size:42px;filter:drop-shadow(0 8px 12px rgba(55,90,170,.13))}.dash-category.blue{background:linear-gradient(135deg,#eaf3ff,#fff)}.dash-category.purple{background:linear-gradient(135deg,#f0e9ff,#fff)}.dash-category.orange{background:linear-gradient(135deg,#fff0df,#fff)}.dash-category.green{background:linear-gradient(135deg,#e7fff3,#fff)}.dash-category.pink{background:linear-gradient(135deg,#ffeaf4,#fff)}.dash-category.navy{background:linear-gradient(135deg,#eaf0ff,#fff)}.dash-feed-panel,.dash-side-card,.dash-bottom-banners article{border:1px solid rgba(79,124,255,.13);border-radius:30px;background:rgba(255,255,255,.94);box-shadow:0 17px 54px rgba(55,90,170,.10)}.dash-feed-panel{padding:22px}.dash-section-head,.side-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.dash-section-head span{font-weight:1000;color:#6d38ff}.dash-section-head h2{margin:6px 0 0;font-size:28px;letter-spacing:-.065em}.dash-tabs{display:flex;gap:8px}.dash-tabs a,.dash-tabs b{padding:10px 14px;border-radius:999px;background:#f3f5ff;color:#6b7280;text-decoration:none;font-size:12px;font-weight:1000}.dash-tabs b{background:#efe9ff;color:#6d38ff}.dash-feed-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-top:17px}.dash-feed-card{position:relative;display:flex;flex-direction:column;min-height:280px;padding:13px;border-radius:24px;background:#fff;border:1px solid rgba(79,124,255,.11);box-shadow:0 12px 34px rgba(55,90,170,.07);text-decoration:none;color:#10172f;transition:.16s transform,.16s box-shadow}.dash-feed-card:hover{transform:translateY(-4px);box-shadow:0 24px 60px rgba(55,90,170,.14)}.dash-feed-card img,.feed-thumb{width:100%;height:142px;border-radius:18px;object-fit:cover;background:linear-gradient(135deg,#eef3ff,#fff4e8);display:grid;place-items:center;font-size:44px}.feed-badge{position:absolute;left:19px;top:19px;z-index:1;padding:6px 9px;border-radius:999px;background:rgba(109,56,255,.86);color:#fff;font-size:11px;font-weight:1000}.dash-feed-card h3{margin:13px 2px 7px;font-size:19px;line-height:1.33;letter-spacing:-.055em}.dash-feed-card p{margin:0 2px;color:#667085;font-size:13px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.dash-feed-card footer{display:flex;gap:9px;align-items:center;margin-top:auto;padding-top:12px;color:#8a94a8;font-size:12px;font-weight:900}.dash-more{display:flex;justify-content:center;width:260px;margin:17px auto 0;padding:12px;border:1px solid rgba(79,124,255,.13);border-radius:999px;background:#fff;color:#6b7280;text-decoration:none;font-weight:1000}.dash-sidebar{display:grid;gap:16px;position:sticky;top:98px}.dash-side-card{padding:19px}.side-title b{font-size:19px}.side-title a{color:#8a94a8;text-decoration:none;font-size:12px;font-weight:900}.top-item{display:grid;grid-template-columns:25px 58px 1fr;gap:11px;align-items:center;padding:11px 0;border-top:1px solid rgba(79,124,255,.09);text-decoration:none;color:#10172f}.top-item:first-of-type{border-top:0}.top-item strong{font-size:21px}.top-item img,.top-item i{width:58px;height:45px;border-radius:12px;object-fit:cover;background:#eef3ff;display:grid;place-items:center;font-style:normal}.top-item b{display:block;font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.top-item small{color:#8a94a8;font-size:11px}.mission{background:linear-gradient(135deg,#fff,#f4efff)!important}.mission p{margin:12px 0;color:#10172f;font-weight:1000}.mission-bar{display:flex;align-items:center;gap:10px;height:10px;border-radius:999px;background:#edf1ff;overflow:visible}.mission-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#4f7cff,#ff5c8a)}.mission-bar span{font-size:12px;color:#667085;font-weight:1000}.mission small{display:block;margin:15px 0;color:#667085;font-weight:900}.side-cta,.install button{display:inline-flex;justify-content:center;align-items:center;height:39px;padding:0 13px;border:1px solid rgba(79,124,255,.15);border-radius:14px;background:#fff;color:#6d38ff;text-decoration:none;font-weight:1000}.install{display:grid;grid-template-columns:1fr 90px;gap:8px;align-items:center;background:linear-gradient(135deg,#fff,#f8f0ff)!important}.install p{margin:8px 0;color:#667085;font-size:13px;line-height:1.45}.install img{width:88px;height:88px;border-radius:26px;background:#fff;box-shadow:0 12px 28px rgba(55,90,170,.12)}.rules ol{margin:12px 0 0;padding-left:18px;color:#667085;font-size:12px;line-height:1.8;font-weight:800}.dash-bottom-banners{display:grid;grid-template-columns:1.05fr 1.05fr 1.1fr;gap:15px}.dash-bottom-banners article{padding:21px;display:flex;align-items:center;justify-content:space-between;gap:14px}.dash-bottom-banners b{font-size:20px;letter-spacing:-.055em}.dash-bottom-banners p{margin:8px 0;color:#667085;line-height:1.55}.dash-bottom-banners i{font-style:normal;font-size:76px}.dash-bottom-banners button,.dash-bottom-banners a{border:0;border-radius:999px;padding:11px 15px;background:linear-gradient(135deg,#ff7a59,#ff5c8a,#6d38ff);color:#fff;text-decoration:none;font-weight:1000}.dash-bottom-banners .stats{display:block}.stats>div{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:18px}.stats span{display:grid;gap:4px;text-align:center;color:#667085}.stats strong{font-size:18px;color:#10172f}.stats small{font-size:11px}.dash-empty{grid-column:1/-1;display:grid;place-items:center;text-align:center;min-height:220px;border-radius:22px;background:#fff;border:1px dashed rgba(79,124,255,.2)}.dash-empty a{color:#6d38ff;font-weight:1000}
    @media(max-width:1220px){.dash-shell{grid-template-columns:1fr}.dash-sidebar{position:static;grid-template-columns:repeat(2,minmax(0,1fr))}.dash-category-row{grid-template-columns:repeat(3,minmax(0,1fr))}.dash-feed-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:860px){.soso-home-dashboard{padding:14px 14px 108px}.dash-shell{width:100%;display:block}.dash-main{gap:13px}.dash-hero{grid-template-columns:1fr;border-radius:30px;min-height:auto}.dash-hero-copy{padding:26px 22px}.dash-hero-copy h1{font-size:42px}.dash-mascot-stage{min-height:250px}.dash-category-row{display:flex;overflow-x:auto;padding-bottom:4px;scroll-snap-type:x mandatory}.dash-category{min-width:210px;scroll-snap-align:start;min-height:112px}.dash-feed-grid{grid-template-columns:1fr}.dash-sidebar{display:grid;grid-template-columns:1fr;margin-top:14px}.dash-bottom-banners{grid-template-columns:1fr}.stats>div{grid-template-columns:repeat(2,1fr)}.dash-tabs{display:none}.dash-bottom-banners i{font-size:54px}.dash-hero:after{display:none}}
    [data-theme="dark"] .soso-home-dashboard{background:radial-gradient(circle at 8% -6%,rgba(124,92,255,.16),transparent 30%),#070b13!important}[data-theme="dark"] .dash-hero,[data-theme="dark"] .dash-category,[data-theme="dark"] .dash-feed-panel,[data-theme="dark"] .dash-side-card,[data-theme="dark"] .dash-bottom-banners article,[data-theme="dark"] .dash-feed-card{background:rgba(16,23,34,.88)!important;box-shadow:none}[data-theme="dark"] .dash-hero-copy h1,[data-theme="dark"] .dash-feed-card,[data-theme="dark"] .top-item,[data-theme="dark"] .stats strong{color:#f5f7fb}[data-theme="dark"] .dash-hero-copy p,[data-theme="dark"] .dash-feed-card p,[data-theme="dark"] .rules ol,[data-theme="dark"] .install p{color:#a8b3c7}
  `;
  document.head.appendChild(style);
}
