import { getFeedPosts } from '../feed/feed-engine.js';
import { injectSosoStyle } from '../components/soso-style.js';

export function renderSosoHome(container) {
  injectSosoStyle();
  injectHomeStyle();
  draw(container, []);
  getFeedPosts({ pageSize: 4 }).then(items => draw(container, items || [])).catch(() => draw(container, []));
}

function draw(container, items = []) {
  container.innerHTML = `
    <main class="predict-app soso-home-v3">
      <section class="home-v3-hero">
        <div class="home-v3-copy">
          <div class="home-v3-brand"><img src="/logo.svg" alt="소소킹"><div><b>소소킹</b><small>사진 · 글 · 퀴즈 · 게임 피드</small></div></div>
          <span class="home-v3-kicker">SOSO FEED PLAYGROUND</span>
          <h1>심심할 때 여는<br><em>소소한 놀이터</em></h1>
          <p>사진 제목학원, 밸런스게임, 소소토론, 퀴즈, AI놀이를 한 피드에서 올리고 고르고 댓글 다는 복합형 커뮤니티입니다.</p>
          <div class="home-v3-actions"><a class="primary" href="#/feed/new">지금 만들기</a><a href="#/feed">피드 둘러보기</a></div>
          <div class="home-v3-mini"><b>게임머니 없음</b><b>가벼운 투표</b><b>댓글 놀이</b><b>사진 업로드</b></div>
        </div>
        <div class="home-v3-phone" aria-label="소소피드 미리보기">
          <div class="phone-top"><span>LIVE SOSO</span><b>오늘의 놀거리</b></div>
          <article class="phone-card main"><i>📸</i><b>이 사진 제목 뭐가 제일 웃김?</b><p>월요일 아침 내 표정 vs 퇴근 1분 전</p><div><span style="--w:72%"></span></div></article>
          <article class="phone-card"><i>⚖️</i><b>평생 하나만 먹는다면?</b><p>라면 · 치킨 · 떡볶이 · 댓글 선택</p></article>
          <article class="phone-card"><i>🧠</i><b>센스 퀴즈</b><p>정답보다 댓글이 더 웃긴 판</p></article>
        </div>
      </section>

      <section class="home-v3-mode-grid">
        ${modeCard('📸','사진 제목학원','사진 한 장에 가장 웃긴 제목을 붙이고 투표받는 피드')}
        ${modeCard('⚖️','밸런스게임','둘 중 하나를 고르고 댓글로 가볍게 싸우는 피드')}
        ${modeCard('💬','소소토론','사소하지만 은근히 갈리는 주제를 올리는 피드')}
        ${modeCard('🧠','퀴즈','문제 내고 선택지로 정답 또는 센스를 고르는 피드')}
        ${modeCard('🤖','AI놀이','AI 문장, 상황극, 선택지를 가져와 같이 노는 피드')}
      </section>

      <section class="home-v3-flow">
        <div class="section-head"><div><span>HOW TO PLAY</span><h2>소소킹 이용 흐름</h2></div><a href="#/guide">이용 안내</a></div>
        <div class="flow-grid">
          <article><b>1</b><h3>주제 고르기</h3><p>사진, 선택게임, 토론, 퀴즈, AI놀이 중 하나를 고릅니다.</p></article>
          <article><b>2</b><h3>글·사진 올리기</h3><p>제목, 상황 설명, 질문, 선택지를 넣어 하나의 피드를 만듭니다.</p></article>
          <article><b>3</b><h3>투표·댓글 받기</h3><p>사람들이 고르고, 웃고, 반박하고, 인기글로 올립니다.</p></article>
        </div>
      </section>

      <section class="home-v3-recent">
        <div class="section-head"><div><span>RECENT SOSO</span><h2>최근 올라온 소소피드</h2></div><a href="#/feed">전체보기</a></div>
        <div class="recent-v3-grid">${items.length ? items.map(card).join('') : emptyCard()}</div>
      </section>
    </main>`;
}

function modeCard(icon, title, text) {
  return `<a href="#/feed/new" class="mode-card"><i>${icon}</i><b>${e(title)}</b><span>${e(text)}</span></a>`;
}

function card(item) {
  return `<a class="recent-v3-card" href="#/feed/${encodeURIComponent(item.id)}"><span>${e(item.badge || '✨')} ${e(item.type || '소소피드')}</span><h3>${e(item.title)}</h3><p>${e(item.summary || item.content || '')}</p><small>조회 ${Number(item.stats?.views || 0).toLocaleString()} · 댓글 ${Number(item.stats?.comments || 0).toLocaleString()} · 좋아요 ${Number(item.stats?.likes || 0).toLocaleString()}</small></a>`;
}

function emptyCard() {
  return `<div class="recent-v3-card empty"><span>READY</span><h3>아직 올라온 소소피드가 없습니다</h3><p>첫 사진, 첫 퀴즈, 첫 밸런스게임을 올리면 이곳에 표시됩니다.</p><small>사진 · 글 · 투표 · 댓글</small></div>`;
}

function injectHomeStyle() {
  if (document.getElementById('sosoking-home-v3-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-home-v3-style';
  style.textContent = `
    .soso-home-v3{padding:18px clamp(16px,4vw,36px) 112px;background:radial-gradient(circle at 8% 0%,rgba(79,124,255,.18),transparent 34%),radial-gradient(circle at 90% 4%,rgba(255,92,138,.14),transparent 30%),linear-gradient(180deg,#f7f9ff 0%,#eef3ff 48%,#f7f8fb 100%)}
    .home-v3-hero,.home-v3-mode-grid,.home-v3-flow,.home-v3-recent{max-width:1040px;margin-left:auto;margin-right:auto}
    .home-v3-hero{display:grid;grid-template-columns:minmax(0,1.05fr) 360px;gap:18px;align-items:stretch;min-height:560px}
    .home-v3-copy{position:relative;overflow:hidden;border:1px solid rgba(79,124,255,.14);border-radius:38px;padding:clamp(24px,5vw,44px);background:rgba(255,255,255,.86);box-shadow:0 28px 90px rgba(55,90,170,.16);backdrop-filter:blur(14px)}
    .home-v3-copy:after{content:'✨';position:absolute;right:24px;bottom:-42px;font-size:140px;opacity:.08;transform:rotate(-12deg)}
    .home-v3-brand{display:flex;align-items:center;gap:13px;margin-bottom:26px}.home-v3-brand img{width:66px;height:66px;border-radius:24px;background:#fff;box-shadow:0 16px 40px rgba(79,124,255,.18);transform:rotate(-7deg)}.home-v3-brand b{display:block;font-size:22px;letter-spacing:-.05em}.home-v3-brand small{display:block;color:var(--predict-muted);font-size:13px;margin-top:3px}
    .home-v3-kicker{display:inline-flex;padding:8px 11px;border-radius:999px;background:rgba(79,124,255,.09);color:var(--predict-main);font-size:11px;font-weight:1000;letter-spacing:.14em}.home-v3-copy h1{position:relative;z-index:1;margin:14px 0 14px;font-size:clamp(42px,8vw,78px);line-height:.98;letter-spacing:-.09em}.home-v3-copy h1 em{font-style:normal;background:linear-gradient(135deg,#4f7cff,#7c5cff 54%,#ff5c8a);-webkit-background-clip:text;background-clip:text;color:transparent}.home-v3-copy p{position:relative;z-index:1;max-width:620px;margin:0;color:var(--predict-muted);font-size:16px;line-height:1.8;word-break:keep-all}.home-v3-actions{position:relative;z-index:1;display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.home-v3-actions a{display:inline-flex;align-items:center;justify-content:center;border-radius:20px;padding:15px 18px;background:rgba(79,124,255,.09);color:var(--predict-main);font-weight:1000;text-decoration:none}.home-v3-actions a.primary{background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff;box-shadow:0 16px 40px rgba(79,124,255,.26)}.home-v3-mini{position:relative;z-index:1;display:flex;gap:7px;flex-wrap:wrap;margin-top:18px}.home-v3-mini b{padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.75);border:1px solid rgba(79,124,255,.10);font-size:12px;color:var(--predict-muted)}
    .home-v3-phone{border-radius:38px;padding:18px;background:linear-gradient(180deg,#111a33,#263d85);box-shadow:0 28px 90px rgba(20,34,74,.28);color:#fff;display:grid;align-content:start;gap:12px;overflow:hidden}.phone-top{display:flex;align-items:center;justify-content:space-between;padding:8px 4px 4px}.phone-top span{font-size:10px;letter-spacing:.14em;color:rgba(255,255,255,.62);font-weight:1000}.phone-top b{font-size:14px}.phone-card{border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:16px;background:rgba(255,255,255,.10);backdrop-filter:blur(12px)}.phone-card.main{background:rgba(255,255,255,.18)}.phone-card i{font-style:normal;font-size:22px}.phone-card b{display:block;margin:8px 0 6px;font-size:17px;line-height:1.3}.phone-card p{margin:0;color:rgba(255,255,255,.72);font-size:13px;line-height:1.5}.phone-card div{height:10px;margin-top:12px;border-radius:999px;background:rgba(255,255,255,.13);overflow:hidden}.phone-card div span{display:block;width:var(--w);height:100%;border-radius:999px;background:linear-gradient(135deg,#fff,#8fb0ff)}
    .home-v3-mode-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:16px}.mode-card{min-height:154px;padding:18px;border-radius:26px;background:rgba(255,255,255,.88);border:1px solid rgba(79,124,255,.12);box-shadow:0 14px 45px rgba(55,90,170,.10);text-decoration:none;color:var(--predict-ink);transition:.18s transform,.18s box-shadow}.mode-card:hover{transform:translateY(-3px);box-shadow:0 20px 60px rgba(55,90,170,.16)}.mode-card i{font-style:normal;font-size:28px}.mode-card b{display:block;margin:12px 0 7px;font-size:17px;letter-spacing:-.04em}.mode-card span{display:block;color:var(--predict-muted);font-size:13px;line-height:1.55}
    .home-v3-flow,.home-v3-recent{margin-top:22px}.flow-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.flow-grid article{padding:20px;border-radius:26px;background:rgba(255,255,255,.86);border:1px solid rgba(79,124,255,.12);box-shadow:0 14px 45px rgba(55,90,170,.09)}.flow-grid b{display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:14px;background:linear-gradient(135deg,#4f7cff,#7c5cff);color:#fff}.flow-grid h3{margin:12px 0 7px;font-size:19px;letter-spacing:-.04em}.flow-grid p{margin:0;color:var(--predict-muted);font-size:13px;line-height:1.65}
    .recent-v3-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.recent-v3-card{min-height:190px;padding:18px;border-radius:26px;background:rgba(255,255,255,.88);border:1px solid rgba(79,124,255,.12);box-shadow:0 14px 45px rgba(55,90,170,.09);text-decoration:none;color:var(--predict-ink);display:flex;flex-direction:column}.recent-v3-card span{color:var(--predict-main);font-size:12px;font-weight:1000}.recent-v3-card h3{margin:10px 0 8px;font-size:18px;line-height:1.35;letter-spacing:-.04em}.recent-v3-card p{margin:0;color:var(--predict-muted);font-size:13px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.recent-v3-card small{margin-top:auto;color:#9aa4b5;font-size:12px;font-weight:800}.recent-v3-card.empty{grid-column:1/-1;text-align:center;align-items:center;justify-content:center}
    [data-theme="dark"] .soso-home-v3{background:radial-gradient(circle at 8% 0%,rgba(79,124,255,.16),transparent 34%),radial-gradient(circle at 90% 4%,rgba(255,92,138,.10),transparent 30%),#070b13}[data-theme="dark"] .home-v3-copy,[data-theme="dark"] .mode-card,[data-theme="dark"] .flow-grid article,[data-theme="dark"] .recent-v3-card{background:rgba(16,23,34,.88);box-shadow:none}[data-theme="dark"] .home-v3-mini b{background:rgba(255,255,255,.06)}
    @media(max-width:920px){.home-v3-hero{grid-template-columns:1fr;min-height:auto}.home-v3-phone{min-height:360px}.home-v3-mode-grid{grid-template-columns:repeat(2,1fr)}.recent-v3-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:620px){.soso-home-v3{padding:14px 14px 108px}.home-v3-copy,.home-v3-phone{border-radius:30px}.home-v3-brand img{width:56px;height:56px}.home-v3-actions a{flex:1;min-width:140px}.home-v3-mode-grid,.flow-grid,.recent-v3-grid{grid-template-columns:1fr}.mode-card{min-height:auto}.home-v3-copy h1{font-size:44px}}
  `;
  document.head.appendChild(style);
}

function e(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
