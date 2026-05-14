import { getFeedPosts } from '../feed/feed-engine.js';
import { injectSosoStyle } from '../components/soso-style.js';

export function renderSosoHome(container) {
  injectSosoStyle();
  injectHomeStyle();
  draw(container, []);
  getFeedPosts({ pageSize: 6 }).then(items => draw(container, items || [])).catch(() => draw(container, []));
}

function draw(container, items = []) {
  container.innerHTML = `
    <main class="predict-app soso-home-v4">
      <section class="home-v4-hero">
        <div class="home-v4-stage">
          <div class="home-v4-logo-pop"><img src="/logo.svg" alt="소소킹"><i>✨</i><i>🎮</i><i>💬</i></div>
          <span class="home-v4-kicker">SOSOKING PLAY FEED</span>
          <h1>재미, 정보, 투표, 역할극이<br><em>한 피드에 모이는 소소킹</em></h1>
          <p>사진 제목학원, 밸런스게임, 퀴즈, 정보공유, AI 링크 요약, 릴레이소설, 막장드라마, 역할극까지 가볍게 올리고 같이 노는 커뮤니티입니다.</p>
          <div class="home-v4-actions"><a class="primary" href="#/feed/new">소소피드 만들기</a><a href="#/feed">피드 구경하기</a><a href="#/mission">오늘의 미션</a><button type="button" id="home-install-btn">앱 설치</button></div>
          <div class="home-v4-tags"><b>AI 요약</b><b>유튜브 링크</b><b>릴레이소설</b><b>역할극방</b><b>검색 가능</b></div>
        </div>
        <div class="home-v4-live">
          <div class="live-head"><span>LIVE BOARD</span><b>지금 만들 수 있는 것</b></div>
          <article class="live-card hot"><i>🔗</i><div><b>정보공유</b><p>유용한 링크를 AI가 핵심만 요약</p></div></article>
          <article class="live-card"><i>🎭</i><div><b>역할극방</b><p>등장인물을 고르거나 직접 역할 입력</p></div></article>
          <article class="live-card"><i>📚</i><div><b>릴레이소설</b><p>아무나 언제든 다음 장면 이어쓰기</p></div></article>
          <article class="live-card"><i>🎬</i><div><b>영상 리액션</b><p>유튜브 링크로 반응과 투표 받기</p></div></article>
        </div>
      </section>

      <section class="home-v4-quick-grid">
        ${modeCard('😂','재미','사진 제목학원, 웃참, 댓글 배틀', '#/feed/new')}
        ${modeCard('🎮','게임/투표','밸런스게임, 민심 투표, 선택지 배틀', '#/feed/new')}
        ${modeCard('🧠','퀴즈','정답 퀴즈, 센스 퀴즈, 심리 테스트', '#/feed/new')}
        ${modeCard('🎭','소설/역할극','릴레이소설, 막장드라마, 역할극방', '#/feed/new')}
        ${modeCard('🔗','정보','사이트 추천, AI 링크 요약, 꿀팁 공유', '#/feed/new')}
        ${modeCard('🔎','검색','제목, 태그, 유형으로 소소피드 찾기', '#/feed')}
      </section>

      <section class="home-v4-flow">
        <div class="section-head"><div><span>HOW IT WORKS</span><h2>소소킹은 이렇게 놀아요</h2></div><a href="#/guide">이용 안내</a></div>
        <div class="home-v4-steps">
          <article><strong>01</strong><h3>카테고리 선택</h3><p>재미, 게임, 퀴즈, 소설/역할극, 정보, 영상/이미지 중에서 고릅니다.</p></article>
          <article><strong>02</strong><h3>형식에 맞게 작성</h3><p>투표는 선택지, 퀴즈는 정답/해설, 정보는 링크/AI 요약, 역할극은 등장인물을 넣습니다.</p></article>
          <article><strong>03</strong><h3>피드에서 같이 참여</h3><p>사람들이 투표하고, 댓글로 이어쓰고, 검색해서 다시 찾아봅니다.</p></article>
        </div>
      </section>

      <section class="home-v4-recent">
        <div class="section-head"><div><span>RECENT SOSO</span><h2>최근 소소피드</h2></div><a href="#/feed">전체보기</a></div>
        <div class="recent-v4-grid">${items.length ? items.map(card).join('') : emptyCard()}</div>
      </section>
    </main>`;
  container.querySelector('#home-install-btn')?.addEventListener('click', () => {
    if (typeof window._pwaInstall === 'function') window._pwaInstall();
    else alert('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해주세요.');
  });
}

function modeCard(icon, title, text, href) {
  return `<a href="${href}" class="mode-v4-card"><i>${icon}</i><b>${e(title)}</b><span>${e(text)}</span></a>`;
}

function card(item) {
  return `<a class="recent-v4-card" href="#/feed/${encodeURIComponent(item.id)}"><span>${e(item.badge || '✨')} ${e(item.type || '소소피드')}</span><h3>${e(item.title)}</h3><p>${e(item.summary || item.content || '')}</p><small>조회 ${Number(item.stats?.views || 0).toLocaleString()} · 댓글 ${Number(item.stats?.comments || 0).toLocaleString()} · 좋아요 ${Number(item.stats?.likes || 0).toLocaleString()}</small></a>`;
}

function emptyCard() {
  return `<div class="recent-v4-card empty"><span>READY</span><h3>아직 올라온 소소피드가 없습니다</h3><p>첫 정보공유, 첫 릴레이소설, 첫 밸런스게임을 올리면 이곳에 표시됩니다.</p><small>재미 · 정보 · 투표 · 댓글</small></div>`;
}

function injectHomeStyle() {
  if (document.getElementById('sosoking-home-v4-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-home-v4-style';
  style.textContent = `
    .soso-home-v4{min-height:100vh;padding:22px var(--soso-page-pad,clamp(18px,3vw,42px)) 118px;background:radial-gradient(circle at 8% -6%,rgba(255,232,92,.42),transparent 30%),radial-gradient(circle at 92% 0%,rgba(255,92,138,.18),transparent 26%),radial-gradient(circle at 50% 18%,rgba(79,124,255,.14),transparent 38%),linear-gradient(180deg,#fffaf0 0%,#f3f7ff 46%,#f8f9ff 100%)!important;overflow:hidden}
    .home-v4-hero,.home-v4-quick-grid,.home-v4-flow,.home-v4-recent{width:var(--soso-wide,min(1320px,calc(100vw - 56px)));max-width:var(--soso-wide,min(1320px,calc(100vw - 56px)));margin-left:auto;margin-right:auto}
    .home-v4-hero{position:relative;display:grid;grid-template-columns:minmax(0,1.35fr) 410px;gap:20px;align-items:stretch;min-height:620px}.home-v4-hero:before{content:'';position:absolute;inset:-80px -120px auto auto;width:360px;height:360px;border-radius:999px;background:linear-gradient(135deg,rgba(255,232,92,.45),rgba(255,92,138,.18));filter:blur(10px);z-index:0}.home-v4-stage,.home-v4-live{position:relative;z-index:1;border:1px solid rgba(79,124,255,.15);border-radius:42px;background:rgba(255,255,255,.86);box-shadow:0 30px 100px rgba(55,90,170,.15);backdrop-filter:blur(18px) saturate(1.22)}
    .home-v4-stage{overflow:hidden;padding:clamp(28px,5vw,58px)}.home-v4-stage:after{content:'SOSO';position:absolute;right:-18px;bottom:-34px;font-size:132px;font-weight:1000;letter-spacing:-.1em;color:rgba(79,124,255,.055);transform:rotate(-9deg)}
    .home-v4-logo-pop{position:relative;display:inline-flex;align-items:center;justify-content:center;width:118px;height:118px;margin-bottom:20px;border-radius:36px;background:linear-gradient(135deg,#fff,#fff7d7);box-shadow:0 18px 55px rgba(255,122,89,.18),0 0 0 1px rgba(255,255,255,.8) inset}.home-v4-logo-pop img{width:96px;height:96px;border-radius:30px;transform:rotate(-6deg)}.home-v4-logo-pop i{position:absolute;font-style:normal;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:15px;background:#fff;box-shadow:0 10px 24px rgba(55,90,170,.14)}.home-v4-logo-pop i:nth-child(2){right:-15px;top:8px}.home-v4-logo-pop i:nth-child(3){left:-15px;bottom:12px}.home-v4-logo-pop i:nth-child(4){right:8px;bottom:-16px}
    .home-v4-kicker{display:inline-flex;padding:9px 12px;border-radius:999px;background:rgba(255,232,92,.55);color:#1b2250;font-size:11px;font-weight:1000;letter-spacing:.15em;border:1px solid rgba(255,184,0,.22)}.home-v4-stage h1{position:relative;z-index:1;margin:16px 0 14px;font-size:clamp(46px,6vw,82px);line-height:.98;letter-spacing:-.09em;color:#151a33}.home-v4-stage h1 em{font-style:normal;background:linear-gradient(135deg,#4f7cff,#7c5cff 48%,#ff5c8a);-webkit-background-clip:text;background-clip:text;color:transparent}.home-v4-stage p{position:relative;z-index:1;max-width:760px;margin:0;color:#667085;font-size:17px;line-height:1.82;word-break:keep-all}.home-v4-actions{position:relative;z-index:1;display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}.home-v4-actions a,.home-v4-actions button{display:inline-flex;align-items:center;justify-content:center;padding:15px 18px;border-radius:20px;background:rgba(79,124,255,.10);border:1px solid rgba(79,124,255,.13);color:#4f7cff;text-decoration:none;font-weight:1000;font-family:inherit}.home-v4-actions a.primary{background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff);color:#fff;border:0;box-shadow:0 18px 44px rgba(255,92,138,.26)}.home-v4-tags{position:relative;z-index:1;display:flex;gap:7px;flex-wrap:wrap;margin-top:18px}.home-v4-tags b{padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.72);border:1px solid rgba(79,124,255,.10);color:#6b7280;font-size:12px}
    .home-v4-live{padding:20px;background:linear-gradient(180deg,#151a33,#263d85 58%,#7c5cff)!important;color:#fff;display:grid;align-content:center;gap:12px;overflow:hidden}.home-v4-live:after{content:'PLAY';position:absolute;right:-12px;top:16px;font-size:74px;font-weight:1000;color:rgba(255,255,255,.06);letter-spacing:-.08em;transform:rotate(8deg)}.live-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}.live-head span{font-size:10px;letter-spacing:.15em;color:rgba(255,255,255,.6);font-weight:1000}.live-head b{font-size:16px}.live-card{position:relative;z-index:1;display:flex;gap:12px;align-items:center;padding:15px;border-radius:24px;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(12px)}.live-card.hot{background:rgba(255,255,255,.18)}.live-card i{font-style:normal;font-size:26px}.live-card b{display:block;font-size:16px}.live-card p{margin:4px 0 0;color:rgba(255,255,255,.72);font-size:13px;line-height:1.45}
    .home-v4-quick-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-top:18px}.mode-v4-card{position:relative;overflow:hidden;min-height:172px;padding:20px;border-radius:28px;background:rgba(255,255,255,.86);border:1px solid rgba(79,124,255,.13);box-shadow:0 16px 50px rgba(55,90,170,.10);text-decoration:none;color:#151a33;transition:.18s transform,.18s box-shadow}.mode-v4-card:hover{transform:translateY(-5px);box-shadow:0 26px 90px rgba(55,90,170,.16)}.mode-v4-card:after{content:'';position:absolute;right:-28px;bottom:-28px;width:86px;height:86px;border-radius:999px;background:linear-gradient(135deg,rgba(255,232,92,.32),rgba(124,92,255,.14))}.mode-v4-card i{font-style:normal;font-size:32px}.mode-v4-card b{display:block;margin:14px 0 7px;font-size:18px;letter-spacing:-.05em}.mode-v4-card span{display:block;color:#667085;font-size:13px;line-height:1.58}
    .home-v4-flow,.home-v4-recent{margin-top:26px}.home-v4-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.home-v4-steps article,.recent-v4-card{border:1px solid rgba(79,124,255,.13);border-radius:28px;background:rgba(255,255,255,.86);box-shadow:0 16px 50px rgba(55,90,170,.09);padding:20px}.home-v4-steps strong{display:inline-flex;padding:8px 10px;border-radius:14px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;font-weight:1000}.home-v4-steps h3{margin:14px 0 8px;font-size:21px;letter-spacing:-.05em;color:#151a33}.home-v4-steps p{margin:0;color:#667085;line-height:1.68;font-size:14px}
    .recent-v4-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.recent-v4-card{text-decoration:none;color:#151a33;min-height:200px;display:flex;flex-direction:column}.recent-v4-card span{color:#4f7cff;font-size:12px;font-weight:1000}.recent-v4-card h3{margin:10px 0 8px;font-size:20px;line-height:1.35;letter-spacing:-.05em}.recent-v4-card p{margin:0;color:#667085;font-size:14px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.recent-v4-card small{margin-top:auto;color:#9aa4b5;font-size:12px;font-weight:900}.recent-v4-card.empty{grid-column:1/-1;align-items:center;justify-content:center;text-align:center}
    [data-theme="dark"] .soso-home-v4{background:radial-gradient(circle at 8% -6%,rgba(124,92,255,.16),transparent 30%),#070b13!important}[data-theme="dark"] .home-v4-stage,[data-theme="dark"] .mode-v4-card,[data-theme="dark"] .home-v4-steps article,[data-theme="dark"] .recent-v4-card{background:rgba(16,23,34,.88);box-shadow:none}[data-theme="dark"] .home-v4-stage h1,[data-theme="dark"] .mode-v4-card,[data-theme="dark"] .home-v4-steps h3,[data-theme="dark"] .recent-v4-card{color:#f5f7fb}[data-theme="dark"] .home-v4-stage p,[data-theme="dark"] .mode-v4-card span,[data-theme="dark"] .home-v4-steps p,[data-theme="dark"] .recent-v4-card p{color:#a8b3c7}
    @media(max-width:1100px){.home-v4-hero{grid-template-columns:1fr;min-height:auto}.home-v4-live{grid-template-columns:repeat(2,minmax(0,1fr));align-content:start}.live-head{grid-column:1/-1}.home-v4-quick-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.recent-v4-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:680px){.soso-home-v4{padding:14px 14px 108px}.home-v4-hero,.home-v4-quick-grid,.home-v4-flow,.home-v4-recent{width:100%;max-width:100%}.home-v4-stage,.home-v4-live{border-radius:30px}.home-v4-logo-pop{width:94px;height:94px}.home-v4-logo-pop img{width:76px;height:76px}.home-v4-stage h1{font-size:42px}.home-v4-stage p{font-size:15px}.home-v4-actions a,.home-v4-actions button{flex:1;min-width:140px}.home-v4-live{grid-template-columns:1fr}.home-v4-quick-grid,.home-v4-steps,.recent-v4-grid{grid-template-columns:1fr}.mode-v4-card{min-height:auto}.recent-v4-card.empty{grid-column:auto}}
  `;
  document.head.appendChild(style);
}

function e(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}