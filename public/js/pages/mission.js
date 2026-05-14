import { injectSosoStyle } from '../components/soso-style.js';

const MISSIONS = [
  { icon:'📸', type:'사진 제목학원', title:'이 사진 제목 뭐가 제일 웃김?', hint:'웃긴 사진이나 짤을 올리고 제목 후보 4개를 만들어보세요.', options:['현실 부정 중','퇴근 1분 전','아무 일도 없었다','댓글로 제목 달기'] },
  { icon:'⚖️', type:'밸런스게임', title:'평생 하나만 먹는다면?', hint:'너무 어렵지 않고 바로 고를 수 있는 A/B 선택을 만들어보세요.', options:['라면','치킨','떡볶이','댓글로 다른 선택'] },
  { icon:'💬', type:'소소토론', title:'친구 카톡 답장 3시간 뒤면 서운하다?', hint:'사소하지만 갈리는 주제를 올리면 댓글이 잘 붙습니다.', options:['서운하다','괜찮다','상황마다 다르다','읽씹보다 낫다'] },
  { icon:'🧠', type:'퀴즈', title:'이 상황에서 제일 센스 있는 답은?', hint:'정답형보다 센스형 퀴즈가 댓글 반응을 만들기 좋습니다.', options:['1번','2번','3번','댓글이 정답'] },
  { icon:'🤖', type:'AI놀이', title:'AI가 만든 최악의 변명 고르기', hint:'AI 문장, 이상한 답변, 상황극을 올리고 가장 웃긴 선택지를 고르게 해보세요.', options:['너무 진지함','말이 안 됨','오히려 설득됨','댓글로 이어가기'] },
  { icon:'🎬', type:'영상 리액션', title:'이 영상 한 줄 요약하면?', hint:'유튜브/쇼츠 링크를 올리고 사람들이 한 줄 리액션을 남기게 해보세요.', options:['웃김','킹받음','공감됨','댓글로 요약'] },
  { icon:'🔥', type:'댓글 배틀', title:'이 상황에서 제일 킹받는 한마디는?', hint:'본문은 짧게, 댓글이 주인공이 되게 만들어보세요.', options:['참는다','받아친다','읽씹한다','댓글로 배틀'] },
  { icon:'📚', type:'릴레이소설', title:'첫 문장 하나로 이야기 시작하기', hint:'누구든 댓글로 다음 장면을 이어갈 수 있는 시작 문장을 올려보세요.', options:['반전','감동','공포','개그'] }
];

export function renderMission(container) {
  injectSosoStyle();
  injectMissionStyle();
  const today = MISSIONS[new Date().getDate() % MISSIONS.length];
  container.innerHTML = `
    <main class="predict-app mission-page-v1 mission-dashboard">
      <section class="mission-hero mission-dash-hero">
        <div class="mission-copy">
          <span>TODAY MISSION</span>
          <h1>뭘 올릴지 모르겠다면<br><em>오늘의 미션으로 시작</em></h1>
          <p>소소킹은 피드 안에서 재미, 정보, 퀴즈, 투표, 릴레이소설, 역할극을 자연스럽게 즐기는 공간입니다. 미션을 골라 바로 소소피드를 만들어보세요.</p>
          <div class="mission-today"><i>${today.icon}</i><div><b>${escapeHtml(today.title)}</b><small>${escapeHtml(today.hint)}</small></div></div>
          <a class="mission-primary" href="#/feed/new">오늘 미션으로 만들기</a>
        </div>
        <div class="mission-card-live">
          <b>추천 선택지</b>
          ${today.options.map((option, index) => `<div><span>${index + 1}</span>${escapeHtml(option)}</div>`).join('')}
          <small>${escapeHtml(today.type)} · 참여형 소소피드</small>
        </div>
      </section>
      <section class="mission-grid">
        ${MISSIONS.map(card).join('')}
      </section>
      <section class="mission-note">
        <b>미션 활용 팁</b>
        <p>미션 카드를 누르면 만들기 화면으로 이동합니다. 정보공유, 영상 리액션, 릴레이소설, 역할극방 같은 유형을 섞으면 소소킹만의 재미있는 피드가 만들어집니다.</p>
      </section>
    </main>
  `;
}

function card(item) {
  return `<a class="mission-mini-card" href="#/feed/new"><i>${item.icon}</i><span>${escapeHtml(item.type)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.hint)}</p></a>`;
}

function injectMissionStyle() {
  if (document.getElementById('mission-page-v1-style')) return;
  const style = document.createElement('style');
  style.id = 'mission-page-v1-style';
  style.textContent = `
    .mission-page-v1{padding:18px clamp(16px,4vw,36px) 112px;background:radial-gradient(circle at 8% -10%,rgba(255,232,92,.30),transparent 28%),radial-gradient(circle at 94% 0%,rgba(255,92,138,.16),transparent 30%),linear-gradient(180deg,#fffaf0,#f5f7ff)}
    .mission-hero,.mission-grid,.mission-note{max-width:1040px;margin-left:auto;margin-right:auto}.mission-hero{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:stretch}.mission-copy,.mission-card-live,.mission-mini-card,.mission-note{border:1px solid var(--soso-line,rgba(91,112,255,.15));border-radius:34px;background:var(--soso-card,rgba(255,255,255,.88));box-shadow:var(--soso-shadow,0 22px 70px rgba(55,90,170,.13));backdrop-filter:blur(18px)}.mission-copy{padding:clamp(24px,5vw,44px)}.mission-copy>span{display:inline-flex;padding:8px 11px;border-radius:999px;background:rgba(255,232,92,.48);color:#1b2250;font-size:11px;font-weight:1000;letter-spacing:.14em}.mission-copy h1{margin:14px 0 12px;font-size:clamp(38px,7vw,68px);line-height:1;letter-spacing:-.08em}.mission-copy h1 em{font-style:normal;color:#ff5c8a}.mission-copy p{margin:0;color:var(--soso-muted,#6d7588);line-height:1.75}.mission-today{display:flex;gap:12px;align-items:center;margin-top:22px;padding:16px;border-radius:24px;background:linear-gradient(135deg,rgba(255,122,89,.10),rgba(124,92,255,.10));border:1px solid rgba(255,122,89,.14)}.mission-today i{font-style:normal;font-size:34px}.mission-today b{display:block;font-size:18px;letter-spacing:-.04em}.mission-today small{display:block;margin-top:5px;color:var(--soso-muted,#6d7588);line-height:1.55}.mission-primary{display:inline-flex;margin-top:18px;padding:14px 17px;border-radius:18px;background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff);color:#fff;text-decoration:none;font-weight:1000;box-shadow:0 16px 42px rgba(255,92,138,.24)}.mission-card-live{padding:22px;display:grid;gap:10px;align-content:center;background:linear-gradient(135deg,#151a33,#283b88 56%,#7c5cff);color:#fff}.mission-card-live>b{font-size:20px}.mission-card-live div{display:flex;align-items:center;gap:10px;padding:12px;border-radius:18px;background:rgba(255,255,255,.12)}.mission-card-live span{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:10px;background:#fff;color:#7c5cff;font-weight:1000}.mission-card-live small{color:rgba(255,255,255,.72);line-height:1.6}.mission-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}.mission-mini-card{padding:18px;text-decoration:none;color:var(--soso-ink,#151a33);transition:.18s transform,.18s box-shadow}.mission-mini-card:hover{transform:translateY(-4px);box-shadow:0 24px 80px rgba(55,90,170,.17)}.mission-mini-card i{font-style:normal;font-size:30px}.mission-mini-card span{display:inline-flex;margin-left:8px;padding:6px 9px;border-radius:999px;background:rgba(79,124,255,.10);color:#4f7cff;font-size:11px;font-weight:1000}.mission-mini-card h3{margin:14px 0 8px;font-size:19px;line-height:1.35;letter-spacing:-.05em}.mission-mini-card p{margin:0;color:var(--soso-muted,#6d7588);font-size:13px;line-height:1.6}.mission-note{margin-top:16px;padding:20px}.mission-note b{display:block;margin-bottom:8px;font-size:18px}.mission-note p{margin:0;color:var(--soso-muted,#6d7588);line-height:1.75}[data-theme="dark"] .mission-page-v1{background:#070b13}[data-theme="dark"] .mission-copy,[data-theme="dark"] .mission-mini-card,[data-theme="dark"] .mission-note{box-shadow:none}@media(max-width:900px){.mission-hero{grid-template-columns:1fr}.mission-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.mission-page-v1{padding:14px 14px 108px}.mission-grid{grid-template-columns:1fr}.mission-copy,.mission-card-live,.mission-mini-card,.mission-note{border-radius:28px}.mission-copy h1{font-size:40px}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
