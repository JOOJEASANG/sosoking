import { injectPredictStyle } from './predict-home.js';

export function renderPredictGuide(container) {
  injectPredictStyle();
  container.innerHTML = `
    <main class="predict-app simple-page">
      <div class="simple-header">
        <a href="#/" class="back-link">‹</a>
        <div><span>GUIDE</span><h1>이용안내</h1></div>
        <b>소소킹</b>
      </div>
      <section class="guide-card-clean">
        <h2>소소킹은 어떤 서비스인가요?</h2>
        <p>소소킹은 오늘 뜨거운 이슈가 내일 어떻게 될지 예측하는 오락용 게임입니다. 유저는 소소머니를 사용해 선택하고, 다음날 결과가 맞으면 소소머니를 얻습니다.</p>
        <div class="clean-steps">
          <div><b>1</b><strong>오늘의 예측판 확인</strong><span>핫이슈 생존, 카테고리 예측, 역전 예측 같은 판을 확인합니다.</span></div>
          <div><b>2</b><strong>내 선택 등록</strong><span>소소머니 금액과 근거 댓글을 남깁니다.</span></div>
          <div><b>3</b><strong>다음날 결과 정산</strong><span>자동 수집 데이터 기준으로 결과를 확인하고 소소머니가 정산됩니다.</span></div>
          <div><b>4</b><strong>랭킹 도전</strong><span>연속 적중, 최고 수익, 성지 댓글로 이번 주 소소킹에 도전합니다.</span></div>
        </div>
      </section>
      <section class="guide-card-clean warning">
        <h2>중요 안내</h2>
        <p>소소머니는 게임 전용 포인트이며 현금 가치가 없습니다. 충전, 환전, 출금, 현물 보상은 제공하지 않습니다. 정치, 주식·코인 가격, 실제 범죄 피해자, 재난·사망 사고 희화화, 실명 비방 이슈는 예측판에서 제외합니다.</p>
      </section>
    </main>`;
  injectGuideCleanStyle();
}

function injectGuideCleanStyle() {
  if (document.getElementById('predict-guide-clean-style')) return;
  const style = document.createElement('style');
  style.id = 'predict-guide-clean-style';
  style.textContent = `
    .guide-card-clean { max-width:820px; margin:0 auto 14px; border:1px solid var(--predict-line); border-radius:24px; padding:20px; background:var(--predict-card); }
    .guide-card-clean h2 { margin:0 0 10px; font-size:22px; letter-spacing:-.04em; }
    .guide-card-clean p { margin:0; color:var(--predict-muted); line-height:1.75; }
    .clean-steps { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
    .clean-steps div { padding:14px; border-radius:18px; border:1px solid var(--predict-line); background:var(--predict-bg); }
    .clean-steps b { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:10px; background:var(--predict-main); color:#fff; margin-bottom:10px; }
    .clean-steps strong { display:block; font-size:14px; } .clean-steps span { display:block; margin-top:5px; color:var(--predict-muted); font-size:13px; line-height:1.6; }
    .guide-card-clean.warning { border-color:rgba(255,92,122,.28); }
    @media(max-width:640px){ .clean-steps{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(style);
}
