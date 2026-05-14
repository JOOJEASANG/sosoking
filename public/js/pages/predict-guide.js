import { injectSosoStyle } from '../components/soso-style.js';

export function renderPredictGuide(container) {
  injectSosoStyle();
  injectGuideCleanStyle();
  container.innerHTML = `
    <main class="predict-app simple-page soso-doc-page guide-page">
      <section class="doc-hero guide-hero">
        <a href="#/" class="back-link">‹</a>
        <div class="doc-hero-copy">
          <img src="/logo.svg" alt="소소킹">
          <div><span>GUIDE</span><h1>이용안내</h1><p>소소피드에서 글, 사진, 투표, 댓글로 가볍게 노는 방법을 정리했습니다.</p></div>
        </div>
        <b>✨</b>
      </section>

      <section class="guide-card-clean intro">
        <div class="guide-title-row"><span>소소킹이란?</span><h2>소소한 웃음과 선택 게임이 모이는 피드형 커뮤니티</h2></div>
        <p>소소킹은 사진 제목학원, 밸런스게임, 소소토론, 퀴즈, AI놀이를 한 피드에서 즐기는 참여형 커뮤니티입니다. 게임머니, 예측 정산, 랭킹 경쟁 없이 글·사진·투표·댓글 중심으로 운영됩니다.</p>
      </section>

      <section class="guide-card-clean">
        <div class="guide-title-row"><span>HOW TO PLAY</span><h2>기본 이용 흐름</h2></div>
        <div class="clean-steps">
          <div><b>1</b><strong>피드 구경하기</strong><span>홈과 피드에서 최근 글, 인기 글, 댓글 많은 글을 확인합니다.</span></div>
          <div><b>2</b><strong>글 유형 고르기</strong><span>사진 제목학원, 밸런스게임, 소소토론, 퀴즈, AI놀이 중 하나를 선택합니다.</span></div>
          <div><b>3</b><strong>선택지 만들기</strong><span>참여 질문과 선택지를 넣으면 다른 사용자가 투표할 수 있습니다.</span></div>
          <div><b>4</b><strong>댓글로 놀기</strong><span>투표 결과를 보고 한 줄 댓글로 가볍게 의견을 나눕니다.</span></div>
        </div>
      </section>

      <section class="guide-card-clean">
        <div class="guide-title-row"><span>SOSO FEED</span><h2>소소피드 유형</h2></div>
        <div class="clean-steps feed-steps">
          <div><b>📸</b><strong>사진 제목학원</strong><span>사진 한 장에 가장 웃긴 제목을 붙이는 글입니다.</span></div>
          <div><b>⚖️</b><strong>밸런스게임</strong><span>둘 중 하나를 고르는 가벼운 선택 게임입니다.</span></div>
          <div><b>💬</b><strong>소소토론</strong><span>사소하지만 은근히 갈리는 주제로 의견을 나눕니다.</span></div>
          <div><b>🧠</b><strong>퀴즈 / AI놀이</strong><span>문제, 센스 답변, AI 밈으로 함께 노는 유형입니다.</span></div>
        </div>
      </section>

      <section class="guide-card-clean warning">
        <div class="guide-title-row"><span>NOTICE</span><h2>중요 안내</h2></div>
        <p>저작권 문제 없는 이미지, 개인정보 없는 글, 혐오·성인·비방 없는 콘텐츠만 허용합니다. 정치 선거, 주식·코인 가격, 실제 범죄 피해자, 재난·사망 사고 희화화, 실명 비방, 혐오·차별, 선정적 내용, 저작권 침해, 개인정보 노출 콘텐츠는 제한될 수 있습니다.</p>
      </section>
    </main>`;
}

function injectGuideCleanStyle() {
  if (document.getElementById('predict-guide-clean-style')) return;
  const style = document.createElement('style');
  style.id = 'predict-guide-clean-style';
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
