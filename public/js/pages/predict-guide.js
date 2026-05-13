import { injectPredictStyle } from './predict-home.js';

export function renderPredictGuide(container) {
  injectPredictStyle();
  injectGuideCleanStyle();
  container.innerHTML = `
    <main class="predict-app simple-page soso-doc-page guide-page">
      <section class="doc-hero guide-hero">
        <a href="#/" class="back-link">‹</a>
        <div class="doc-hero-copy">
          <img src="/logo.svg" alt="소소킹">
          <div><span>GUIDE</span><h1>이용안내</h1><p>예측판, 소소피드, 랭킹, 소소머니를 한눈에 이해할 수 있게 정리했습니다.</p></div>
        </div>
        <b>🎮</b>
      </section>

      <section class="guide-card-clean intro">
        <div class="guide-title-row"><span>소소킹이란?</span><h2>오늘의 이슈를 내일 기준으로 맞혀보는 오락용 서비스</h2></div>
        <p>소소킹은 실제 운영 데이터로 열린 예측판에 참여하고, 소소피드에서 글·사진·투표·댓글을 남길 수 있는 가벼운 참여형 커뮤니티입니다. 소소머니는 게임 전용 포인트이며 현금 가치가 없습니다.</p>
      </section>

      <section class="guide-card-clean">
        <div class="guide-title-row"><span>HOW TO PLAY</span><h2>기본 이용 흐름</h2></div>
        <div class="clean-steps">
          <div><b>1</b><strong>오늘의 3판 확인</strong><span>실제 데이터로 열린 예측판만 표시됩니다. 없으면 준비 중 상태로 보입니다.</span></div>
          <div><b>2</b><strong>내 선택 등록</strong><span>선택지와 사용할 소소머니를 고르고, 짧은 근거 한 줄을 남깁니다.</span></div>
          <div><b>3</b><strong>결과 정산 확인</strong><span>운영 기준에 따라 결과가 정산되며, 맞히면 소소머니가 반영됩니다.</span></div>
          <div><b>4</b><strong>소소킹 랭킹 도전</strong><span>실제 운영 데이터가 쌓이면 이번 주 소소킹 순위에 표시됩니다.</span></div>
        </div>
      </section>

      <section class="guide-card-clean">
        <div class="guide-title-row"><span>SOSO FEED</span><h2>소소피드는 이렇게 씁니다</h2></div>
        <div class="clean-steps feed-steps">
          <div><b>📸</b><strong>사진/글 올리기</strong><span>웃긴 사진, 짧은 사연, 질문형 글을 등록할 수 있습니다.</span></div>
          <div><b>🗳️</b><strong>선택지 투표</strong><span>글에 붙은 선택지를 누르면 결과 퍼센트가 표시됩니다.</span></div>
          <div><b>💬</b><strong>댓글 참여</strong><span>한 줄 의견을 남기고 다른 사람의 반응을 볼 수 있습니다.</span></div>
          <div><b>🚨</b><strong>신고 기능</strong><span>문제가 있는 글은 신고할 수 있으며, 운영자가 확인합니다.</span></div>
        </div>
      </section>

      <section class="guide-card-clean warning">
        <div class="guide-title-row"><span>NOTICE</span><h2>중요 안내</h2></div>
        <p>소소머니는 게임 전용 포인트이며 현금 가치가 없습니다. 충전, 환전, 출금, 현물 보상은 제공하지 않습니다. 정치 선거, 주식·코인 가격, 실제 범죄 피해자, 재난·사망 사고 희화화, 실명 비방, 혐오·차별, 선정적 내용, 저작권 침해, 개인정보 노출 콘텐츠는 제한될 수 있습니다.</p>
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
