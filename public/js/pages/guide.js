export async function renderGuide(container) {
  injectGuideStyle();
  container.innerHTML = `
    <div class="guide-page">
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">📖 이용 안내</span>
      </div>
      <div class="container guide-container">
        <section class="guide-hero">
          <div class="guide-hero-icon">🧠</div>
          <div class="guide-hero-kicker">SOSOKING AI HUNT</div>
          <h1>소소킹 AI 수사망 이용안내</h1>
          <p>AI가 생성한 사건과 도주 계획을 추적하는 30분 제한 브레인 수사게임입니다. 단서, 로그, 진술의 모순을 연결해 AI 용의자를 검거하세요.</p>
          <div class="guide-hero-actions">
            <a href="#/hunt">🚨 AI 사건 생성</a>
            <a href="#/hunt/play">🔎 수사 계속하기</a>
          </div>
        </section>

        <section class="guide-section">
          <div class="guide-section-title">🎮 플레이 순서</div>
          <div class="guide-steps">
            ${[
              ['🚨', 'AI 사건 생성', 'AI가 생활 속 지능형 사건, 첫 진술, 도주 계획, 단서, 모순 구조를 즉석으로 만듭니다.'],
              ['⏱️', '30분 타이머 시작', '수사가 시작되면 제한시간이 흐릅니다. 시간 안에 수사망을 좁혀야 합니다.'],
              ['🔎', '현장 조사', '출입기록, 접속로그, 알림 시간, 삭제 흔적 같은 조사 지점을 선택해 단서를 확보합니다.'],
              ['🤖', 'AI 심문', 'AI 용의자는 시스템 오류, 자동 연결, 동기화 지연, 기억 오류 같은 핑계로 빠져나가려 합니다.'],
              ['⚡', '모순 제기', 'AI 진술과 확보한 단서를 연결해 알리바이의 빈틈을 찌릅니다.'],
              ['🚨', '최종 검거', '결정적 단서 2개를 선택해 검거를 시도합니다. 결과는 검거 성공 또는 검거 실패입니다.'],
            ].map(([icon, title, desc], i) => `
              <div class="guide-step">
                <div class="guide-step-num">${i + 1}</div>
                <div class="guide-step-body">
                  <strong>${icon} ${title}</strong>
                  <span>${desc}</span>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <section class="guide-section">
          <div class="guide-section-title">📊 핵심 지표</div>
          <div class="metric-grid">
            ${[
              ['수사망 압박도', 'AI의 도주 계획을 얼마나 좁혔는지 나타냅니다. 높을수록 검거에 유리합니다.'],
              ['AI 회피력', 'AI가 수사망을 빠져나갈 수 있는 힘입니다. 낮출수록 검거 가능성이 높아집니다.'],
              ['단서 확보율', '조사 지점에서 확보한 단서 비율입니다.'],
              ['모순 발견률', 'AI 진술과 단서의 충돌을 얼마나 찾아냈는지 나타냅니다.'],
            ].map(([name, desc]) => `<div class="metric-card"><b>${name}</b><span>${desc}</span></div>`).join('')}
          </div>
        </section>

        <section class="guide-section">
          <div class="guide-section-title">❓ 자주 묻는 질문</div>
          <div class="guide-faq-list">
            ${[
              ['실제 수사 게임인가요?', '아니요. 소소킹 AI 수사망은 순수 오락용 추리 게임입니다. 실제 수사, 범죄 판단, 법률 자문이 아닙니다.'],
              ['AI 판결이 있나요?', '없습니다. 새 버전의 결과는 검거 성공 또는 검거 실패입니다.'],
              ['사건은 미리 정해져 있나요?', '기본 안전장치용 사건은 있지만, AI 생성 함수가 연결되면 AI가 매번 사건, 도주 계획, 단서, 모순을 새로 만듭니다.'],
              ['유치한 생활사건인가요?', '아닙니다. 방향은 생활법정 유머가 아니라 출입기록, 삭제 로그, 접속기록, 알림 시간 같은 단서를 추적하는 브레인 수사게임입니다.'],
              ['로그인이 필요한가요?', '기본 플레이는 익명으로 가능합니다. 일부 기록 저장이나 계정 기능은 로그인 상태와 연결될 수 있습니다.'],
              ['실제 인물이나 실제 사건을 넣어도 되나요?', '권장하지 않습니다. 실명, 연락처, 주소, 직장, 학교, 실제 분쟁 자료, 민감한 개인정보는 입력하지 마세요.'],
            ].map(([q, a]) => `
              <details class="guide-faq">
                <summary>Q. ${q}<span>+</span></summary>
                <div>A. ${a}</div>
              </details>`).join('')}
          </div>
        </section>

        <section class="guide-disclaimer">
          <strong>⚠️ 오락용 AI 추리게임 안내</strong>
          <span>소소킹 AI 수사망의 사건, 단서, AI 진술, 검거 성공/실패 결과는 모두 게임용 콘텐츠입니다. 실제 범죄 판단, 수사, 법률 상담, 증거, 권리 주장 근거로 사용할 수 없습니다.</span>
        </section>

        <a href="#/hunt" class="guide-start-btn">🚨 AI 수사 시작하기</a>
      </div>
    </div>`;
}

function injectGuideStyle() {
  if (document.getElementById('ai-hunt-guide-style')) return;
  const style = document.createElement('style');
  style.id = 'ai-hunt-guide-style';
  style.textContent = `
    .guide-page { min-height:100vh; background:radial-gradient(ellipse at 50% 0%, rgba(0,229,255,.15), transparent 50%), #05070d; color:#ecf6ff; }
    .guide-container { padding-top:26px; padding-bottom:88px; }
    .guide-hero { text-align:center; border:1.5px solid rgba(102,234,255,.26); border-radius:24px; padding:28px 18px; background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02)); box-shadow:0 14px 36px rgba(0,0,0,.22); margin-bottom:28px; }
    .guide-hero-icon { font-size:54px; margin-bottom:10px; }
    .guide-hero-kicker { font-size:10px; font-weight:900; color:#66eaff; letter-spacing:.14em; }
    .guide-hero h1 { margin:6px 0 8px; font-size:25px; color:#ecf6ff; }
    .guide-hero p { margin:0 auto; max-width:560px; color:rgba(236,246,255,.72); font-size:14px; line-height:1.75; }
    .guide-hero-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:18px; }
    .guide-hero-actions a, .guide-start-btn { text-decoration:none; border-radius:15px; padding:13px 12px; font-size:14px; font-weight:900; text-align:center; }
    .guide-hero-actions a:first-child, .guide-start-btn { background:linear-gradient(135deg,#66eaff,#d7fbff); color:#02050a; box-shadow:0 8px 24px rgba(0,229,255,.18); }
    .guide-hero-actions a:last-child { background:rgba(255,255,255,.06); border:1px solid rgba(102,234,255,.24); color:#ecf6ff; }
    .guide-section { margin-bottom:32px; }
    .guide-section-title { font-size:12px; font-weight:900; color:#66eaff; letter-spacing:.08em; margin-bottom:14px; }
    .guide-step { display:flex; align-items:stretch; }
    .guide-step-num { width:36px; height:36px; flex-shrink:0; border-radius:50%; background:linear-gradient(135deg,#66eaff,#d7fbff); color:#02050a; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; z-index:1; }
    .guide-step-body { flex:1; padding:6px 0 24px 35px; border-left:2px solid rgba(102,234,255,.18); margin-left:-19px; }
    .guide-step:last-child .guide-step-body { border-left-color:transparent; }
    .guide-step-body strong { display:block; color:#66eaff; font-size:14px; margin-bottom:5px; }
    .guide-step-body span { display:block; color:rgba(236,246,255,.66); font-size:13px; line-height:1.7; }
    .metric-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
    .metric-card { padding:14px; border-radius:15px; border:1px solid rgba(102,234,255,.18); background:rgba(255,255,255,.035); }
    .metric-card b { display:block; color:#ecf6ff; font-size:13px; margin-bottom:5px; }
    .metric-card span { display:block; color:rgba(236,246,255,.66); font-size:12px; line-height:1.6; }
    .guide-faq-list { display:flex; flex-direction:column; gap:8px; }
    .guide-faq { border:1px solid rgba(102,234,255,.18); border-radius:13px; overflow:hidden; background:rgba(255,255,255,.025); }
    .guide-faq summary { padding:14px 15px; font-weight:900; font-size:13px; color:#ecf6ff; cursor:pointer; list-style:none; display:flex; justify-content:space-between; gap:12px; }
    .guide-faq summary span { color:#66eaff; }
    .guide-faq div { padding:12px 15px 14px; border-top:1px solid rgba(102,234,255,.14); color:rgba(236,246,255,.66); font-size:13px; line-height:1.75; }
    .guide-disclaimer { margin-bottom:22px; padding:15px 16px; border-radius:16px; border:1.5px solid rgba(255,55,95,.28); background:rgba(255,55,95,.06); }
    .guide-disclaimer strong { display:block; color:#ff6f8a; font-size:13px; margin-bottom:7px; }
    .guide-disclaimer span { display:block; color:rgba(236,246,255,.66); font-size:13px; line-height:1.7; }
    .guide-start-btn { display:block; }
    @media (max-width:430px) { .guide-hero h1 { font-size:22px; } .guide-hero-actions, .metric-grid { grid-template-columns:1fr; } .guide-step-body { padding-left:31px; } }
  `;
  document.head.appendChild(style);
}
