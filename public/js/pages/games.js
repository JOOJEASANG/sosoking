import { injectSosoStyle } from '../components/soso-style.js';

const GAMES = [
  { icon: '⚖️', title: '밸런스 아레나', tag: '선택 배틀', desc: '둘 중 하나를 고르고 댓글로 가볍게 겨루는 대표 게임입니다.', example: '평생 치킨만 먹기 vs 라면만 먹기', cta: '밸런스게임 만들기' },
  { icon: '📸', title: '사진 제목 배틀', tag: '제목학원', desc: '사진 한 장을 올리고 가장 웃긴 제목을 투표로 뽑습니다.', example: '이 사진 제목 뭐가 제일 웃김?', cta: '사진 제목 올리기' },
  { icon: '🧠', title: '센스 퀴즈', tag: '퀴즈', desc: '정답형도 좋고, 가장 센스 있는 답을 고르는 놀이도 좋습니다.', example: '친구가 갑자기 조용해진 이유는?', cta: '퀴즈 만들기' },
  { icon: '🤖', title: 'AI 웃참 챌린지', tag: 'AI놀이', desc: 'AI가 만든 이상한 답변, 밈, 상황극을 올리고 반응을 모읍니다.', example: 'AI가 만든 최악의 사과문 고르기', cta: 'AI놀이 만들기' },
  { icon: '💬', title: '댓글 배틀', tag: '댓글놀이', desc: '본문보다 댓글이 주인공인 한 줄 드립 대결입니다.', example: '이 상황에서 제일 킹받는 한마디는?', cta: '댓글판 만들기' },
  { icon: '🔥', title: '오늘의 인기판', tag: '랭킹', desc: '반응이 많이 붙은 글을 인기 페이지에서 랭킹처럼 보여줍니다.', example: '조회·댓글·좋아요·투표로 인기 결정', cta: '인기글 보기', href: '#/feed/top' }
];

export function renderGames(container) {
  injectSosoStyle();
  injectGamesStyle();
  container.innerHTML = `
    <main class="predict-app games-page-v1">
      <section class="games-hero">
        <div class="games-copy">
          <img src="/logo.svg" alt="소소킹">
          <span>GAME COMMUNITY</span>
          <h1>소소하게 붙고<br><em>댓글로 터지는 게임판</em></h1>
          <p>돈이나 정산 없이, 사진·선택지·퀴즈·댓글만으로 놀 수 있는 커뮤니티형 게임 메뉴입니다.</p>
          <div class="games-actions"><a href="#/feed/new">게임 만들기</a><a href="#/feed/top">인기 게임 보기</a></div>
        </div>
        <div class="games-comic-card">
          <b>오늘의 추천 조합</b>
          <div><i>📸</i><span>사진 제목 배틀</span></div>
          <div><i>⚖️</i><span>밸런스 아레나</span></div>
          <div><i>💬</i><span>댓글 배틀</span></div>
          <small>가볍게 올리고, 사람들이 고르고, 댓글로 완성됩니다.</small>
        </div>
      </section>

      <section class="games-grid">
        ${GAMES.map(gameCard).join('')}
      </section>

      <section class="games-roadmap">
        <div class="section-head"><div><span>NEXT GAME IDEAS</span><h2>다음에 확장하기 좋은 메뉴</h2></div></div>
        <div class="roadmap-grid">
          <article><b>🏆 주간 소소왕</b><p>한 주 동안 댓글·투표 반응이 가장 좋은 유저/글을 보여주는 랭킹.</p></article>
          <article><b>🎲 랜덤 질문 상자</b><p>버튼을 누르면 오늘 올릴 만한 주제를 자동 추천하는 기능.</p></article>
          <article><b>🧩 이어쓰기 게임</b><p>한 사람이 상황을 올리면 댓글로 다음 장면을 이어가는 놀이.</p></article>
        </div>
      </section>
    </main>
  `;
}

function gameCard(game) {
  const href = game.href || '#/feed/new';
  return `<a class="game-card" href="${href}"><div><i>${game.icon}</i><span>${game.tag}</span></div><h3>${game.title}</h3><p>${game.desc}</p><small>${game.example}</small><b>${game.cta}</b></a>`;
}

function injectGamesStyle() {
  if (document.getElementById('sosoking-games-v1-style')) return;
  const style = document.createElement('style');
  style.id = 'sosoking-games-v1-style';
  style.textContent = `
    .games-page-v1{padding:18px clamp(16px,4vw,36px) 112px;background:radial-gradient(circle at 8% 0%,rgba(255,232,92,.35),transparent 30%),radial-gradient(circle at 94% 4%,rgba(124,92,255,.18),transparent 30%),linear-gradient(180deg,#fff8dc,#f5f7ff)}
    .games-hero,.games-grid,.games-roadmap{max-width:1040px;margin-left:auto;margin-right:auto}.games-hero{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:stretch}.games-copy,.games-comic-card,.game-card,.games-roadmap article{border:3px solid #1b2250;border-radius:34px;background:#fff;box-shadow:8px 8px 0 #1b2250}.games-copy{position:relative;overflow:hidden;padding:clamp(24px,5vw,44px)}.games-copy:after{content:'BAM!';position:absolute;right:20px;bottom:18px;transform:rotate(-12deg);font-size:54px;font-weight:1000;color:rgba(255,122,89,.14)}.games-copy img{width:72px;height:72px;border-radius:24px;background:#fff;margin-bottom:18px;transform:rotate(-7deg)}.games-copy span{display:inline-flex;padding:8px 11px;border-radius:999px;background:#ffe85c;color:#1b2250;font-size:11px;font-weight:1000;letter-spacing:.14em}.games-copy h1{position:relative;z-index:1;margin:14px 0 12px;font-size:clamp(40px,7vw,72px);line-height:1;letter-spacing:-.08em}.games-copy h1 em{font-style:normal;color:#ff5c8a}.games-copy p{position:relative;z-index:1;max-width:620px;margin:0;color:#4b5565;line-height:1.75}.games-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.games-actions a{display:inline-flex;padding:14px 17px;border-radius:18px;border:3px solid #1b2250;background:#ff7a59;color:#fff;text-decoration:none;font-weight:1000;box-shadow:4px 4px 0 #1b2250}.games-actions a:nth-child(2){background:#7c5cff}.games-comic-card{padding:22px;background:linear-gradient(180deg,#7c5cff,#4f7cff);color:#fff;display:grid;gap:12px;align-content:center}.games-comic-card>b{font-size:20px}.games-comic-card div{display:flex;align-items:center;gap:10px;border-radius:22px;padding:13px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.2)}.games-comic-card i{font-style:normal;font-size:26px}.games-comic-card span{font-weight:1000}.games-comic-card small{color:rgba(255,255,255,.76);line-height:1.6}
    .games-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.game-card{padding:20px;color:#1b2250;text-decoration:none;transition:.16s transform,.16s box-shadow}.game-card:hover{transform:translate(-2px,-2px);box-shadow:12px 12px 0 #1b2250}.game-card>div{display:flex;align-items:center;justify-content:space-between}.game-card i{font-style:normal;font-size:32px}.game-card span{padding:7px 9px;border-radius:999px;background:#ffe85c;font-size:11px;font-weight:1000}.game-card h3{margin:16px 0 8px;font-size:22px;letter-spacing:-.05em}.game-card p{margin:0;color:#5c6578;font-size:14px;line-height:1.65}.game-card small{display:block;margin-top:12px;padding:10px;border-radius:16px;background:#f3f6ff;color:#6b7280;font-weight:800}.game-card>b{display:inline-flex;margin-top:14px;color:#ff5c8a;font-size:14px}
    .games-roadmap{margin-top:24px}.roadmap-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.games-roadmap article{padding:18px}.games-roadmap b{display:block;font-size:18px;margin-bottom:8px}.games-roadmap p{margin:0;color:#5c6578;line-height:1.65;font-size:14px}
    [data-theme="dark"] .games-page-v1{background:#070b13}[data-theme="dark"] .games-copy,[data-theme="dark"] .game-card,[data-theme="dark"] .games-roadmap article{background:#101722;color:#f5f7fb}[data-theme="dark"] .game-card p,[data-theme="dark"] .games-roadmap p{color:#a8b3c7}[data-theme="dark"] .game-card small{background:rgba(255,255,255,.07);color:#a8b3c7}
    @media(max-width:900px){.games-hero{grid-template-columns:1fr}.games-grid{grid-template-columns:repeat(2,1fr)}.roadmap-grid{grid-template-columns:1fr}}
    @media(max-width:560px){.games-page-v1{padding:14px 14px 108px}.games-grid{grid-template-columns:1fr}.games-copy,.games-comic-card,.game-card,.games-roadmap article{border-radius:28px;box-shadow:5px 5px 0 #1b2250}.games-copy h1{font-size:42px}}
  `;
  document.head.appendChild(style);
}
