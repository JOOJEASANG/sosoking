import { injectSosoStyle } from '../components/soso-style.js';

export function renderGuide(container) {
  injectSosoStyle();
  injectGuideCleanStyle();
  container.innerHTML = `
    <main class="predict-app simple-page soso-doc-page guide-page">
      <section class="doc-hero guide-hero">
        <a href="#/" class="back-link">‹</a>
        <div class="doc-hero-copy">
          <img src="/logo.svg" alt="소소킹">
          <div><span>GUIDE</span><h1>이용안내</h1><p>소소피드에서 재미, 정보, 퀴즈, 투표, 릴레이소설, 역할극으로 참여하는 방법입니다.</p></div>
        </div>
        <b>✨</b>
      </section>

      <section class="guide-card-clean intro">
        <div class="guide-title-row"><span>소소킹이란?</span><h2>재미와 정보가 모이는 피드형 커뮤니티</h2></div>
        <p>소소킹은 미친작명소, 밸런스게임, 퀴즈, 영상 리액션, 정보공유, AI 링크 요약, 릴레이소설, 막장드라마, 역할극방을 한 피드에서 즐기는 참여형 커뮤니티입니다. 가볍게 올리고, 검색하고, 투표하고, 댓글로 이어갈 수 있습니다.</p>
      </section>

      <section class="guide-card-clean">
        <div class="guide-title-row"><span>HOW TO PLAY</span><h2>기본 이용 흐름</h2></div>
        <div class="clean-steps">
          <div><b>1</b><strong>피드 구경하기</strong><span>홈과 피드에서 최근 글, 인기 글, 정보공유, 역할극, 댓글 많은 글을 확인합니다.</span></div>
          <div><b>2</b><strong>카테고리 고르기</strong><span>재미, 게임/투표, 퀴즈, 소설/역할극, 정보, 영상/이미지 중 하나를 선택합니다.</span></div>
          <div><b>3</b><strong>형식에 맞게 작성</strong><span>투표는 선택지, 퀴즈는 정답/해설, 정보는 링크/AI 요약, 역할극은 등장인물을 넣습니다.</span></div>
          <div><b>4</b><strong>피드에서 참여하기</strong><span>투표 결과를 보고 댓글로 의견을 남기거나, 릴레이소설과 역할극을 이어갑니다.</span></div>
        </div>
      </section>

      <section class="guide-card-clean">
        <div class="guide-title-row"><span>SOSO FEED</span><h2>소소피드 유형</h2></div>
        <div class="clean-steps feed-steps">
          <div><b>📸</b><strong>미친작명소</strong><span>사진 한 장에 가장 웃긴 제목을 붙이는 글입니다.</span></div>
          <div><b>⚖️</b><strong>게임/투표</strong><span>밸런스게임, 민심 투표, 선택지 배틀처럼 고르는 재미를 만듭니다.</span></div>
          <div><b>🧠</b><strong>퀴즈</strong><span>정답 퀴즈, 센스 퀴즈, 심리 테스트를 만들 수 있습니다.</span></div>
          <div><b>📚</b><strong>소설/역할극</strong><span>릴레이소설, 막장드라마, 역할극방을 댓글로 이어갈 수 있습니다.</span></div>
          <div><b>🔗</b><strong>정보공유</strong><span>유용한 사이트 링크를 AI 요약 카드로 정리할 수 있습니다.</span></div>
          <div><b>🎬</b><strong>영상/이미지</strong><span>유튜브 링크, 이미지 링크, 영상 리액션을 피드로 공유합니다.</span></div>
        </div>
      </section>

      <section class="guide-card-clean mode-guide">
        <div class="guide-title-row"><span>PC / MOBILE</span><h2>접속 환경별 이용 방법</h2></div>
        <div class="clean-steps">
          <div><b>PC</b><strong>상단 헤더 중심</strong><span>홈, 피드, 만들기, 미션은 상단 메뉴에서 이동하고, 내정보/로그인은 오른쪽 아이콘에서 관리합니다.</span></div>
          <div><b>MO</b><strong>하단바 중심</strong><span>모바일에서는 하단바로 홈, 피드, 만들기, 미션, 내정보를 빠르게 이동합니다.</span></div>
        </div>
      </section>

      <section class="guide-card-clean warning">
        <div class="guide-title-row"><span>NOTICE</span><h2>중요 안내</h2></div>
        <p>저작권 문제 없는 이미지와 링크, 개인정보 없는 글, 혐오·성인·비방 없는 콘텐츠만 허용합니다. 정치 선거 조작, 금융 투자 권유, 실제 범죄 피해자, 재난·사망 사고 희화화, 실명 비방, 혐오·차별, 선정적 내용, 저작권 침해, 개인정보 노출 콘텐츠는 제한될 수 있습니다.</p>
      </section>
    </main>`;
}

function injectGuideCleanStyle() {
  if (document.getElementById('soso-guide-clean-style')) return;
  const style = document.createElement('style');
  style.id = 'soso-guide-clean-style';
  style.textContent = `
    .guide-card-clean { max-width:880px; margin:0 auto 14px; border:1px solid rgba(79,124,255,.14); border-radius:30px; padding:22px; background:rgba(255,255,255,.86); box-shadow:0 18px 54px rgba(55,90,170,.10); }
    .guide-title-row span{display:inline-flex;padding:7px 9px;border-radius:999px;background:rgba(79,124,255,.09);color:var(--predict-main);font-size:11px;font-weight:1000;letter-spacing:.12em;margin-bottom:9px}.guide-title-row h2 { margin:0 0 10px; font-size:24px; letter-spacing:-.05em; line-height:1.25; }
    .guide-card-clean p { margin:0; color:var(--predict-muted); line-height:1.8; word-break:keep-all; }
    .clean-steps { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
    .clean-steps div { padding:15px; border-radius:20px; border:1px solid rgba(79,124,255,.12); background:rgba(79,124,255,.04); }
    .clean-steps b { min-width:32px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:13px; background:linear-gradient(135deg,#4f7cff,#7c5cff); color:#fff; margin-bottom:10px; font-size:13px; }
    .feed-steps b{font-size:18px;background:linear-gradient(135deg,rgba(79,124,255,.16),rgba(255,92,138,.14));color:var(--predict-main)}
    .clean-steps strong { display:block; font-size:15px; letter-spacing:-.02em; } .clean-steps span { display:block; margin-top:5px; color:var(--predict-muted); font-size:13px; line-height:1.65; }
    .guide-card-clean.warning { border-color:rgba(255,92,122,.28); background:linear-gradient(135deg,rgba(255,255,255,.88),rgba(255,92,122,.05)); }
    @media(max-width:640px){ .clean-steps{grid-template-columns:1fr;} .guide-card-clean{padding:18px;border-radius:26px} }
    [data-theme="dark"] .guide-card-clean{background:rgba(16,23,34,.88);box-shadow:none}[data-theme="dark"] .guide-card-clean.warning{background:linear-gradient(135deg,rgba(16,23,34,.9),rgba(255,92,122,.08))}
  `;
  document.head.appendChild(style);
}