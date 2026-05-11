let styleInjected = false;
let observer = null;
let timer = null;

export function syncSoloGameFlow(hash) {
  injectStyle();
  document.body.classList.toggle('solo-first-flow', true);
  clearTimeout(timer);
  timer = setTimeout(() => enhance(hash || location.hash || '#/'), 80);

  if (!observer) {
    observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => enhance(location.hash || '#/'), 60);
    });
    observer.observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
  }
}

function enhance(hash) {
  if (hash === '#/' || hash === '' || hash === '#') enhanceHome();
  if (String(hash).startsWith('#/topic/')) enhanceTopicDetail();
  if (String(hash).startsWith('#/topics')) enhanceTopics();
}

function enhanceHome() {
  const actions = document.querySelector('.court-actions');
  if (actions && !actions.dataset.soloEnhanced) {
    actions.dataset.soloEnhanced = '1';
    actions.innerHTML = `
      <button onclick="location.hash='#/town'" class="court-primary-btn">🏙️ 소소킹 거리 입장</button>
      <button onclick="window._startCourtCase && window._startCourtCase()" class="court-secondary-btn">🤖 혼자 재판 시작</button>
      <button onclick="location.hash='#/submit-topic'" class="court-secondary-btn court-wide-btn">✏️ 사건 접수하기</button>
    `;
  }

  const service = document.querySelector('.court-service-row');
  if (service && !service.dataset.soloEnhanced) {
    service.dataset.soloEnhanced = '1';
    service.innerHTML = `
      <div class="court-service-card"><span>🚓</span><strong>경찰서</strong><small>사건 상황 정리</small></div>
      <div class="court-service-card"><span>📚</span><strong>법률사무소</strong><small>입장 정리</small></div>
      <div class="court-service-card"><span>🤖</span><strong>혼자 재판</strong><small>AI 상대 즉시 시작</small></div>
    `;
  }

  const ctaArea = Array.from(document.querySelectorAll('.container button.btn-primary')).find(btn => (btn.textContent || '').includes('사건 게시판'));
  if (ctaArea && !ctaArea.dataset.soloEnhanced) {
    ctaArea.dataset.soloEnhanced = '1';
    ctaArea.textContent = '🏙️ 소소킹 가상거리 입장';
    ctaArea.onclick = () => { location.hash = '#/town'; };
    const quick = document.createElement('button');
    quick.className = 'btn btn-secondary solo-quick-btn';
    quick.style.cssText = 'margin-top:10px;font-size:15px;';
    quick.textContent = '🤖 혼자 재판 바로가기';
    quick.onclick = () => { window._startCourtCase && window._startCourtCase(); };
    ctaArea.insertAdjacentElement('afterend', quick);
  }

  document.querySelectorAll('.home-feature-item').forEach(item => {
    const label = item.querySelector('.home-feature-label');
    const desc = item.querySelector('.home-feature-desc');
    if (!label || !desc) return;
    if (label.textContent.includes('사건 접수')) {
      item.querySelector('.home-feature-icon').textContent = '🚓';
      label.textContent = '사건 상황 정리';
      desc.textContent = '경찰서에서 사건의 핵심을 정리합니다';
    }
    if (label.textContent.includes('입정')) {
      item.querySelector('.home-feature-icon').textContent = '📚';
      label.textContent = '입장 정리';
      desc.textContent = '법률사무소에서 원고·피고 입장을 나눕니다';
    }
  });
}

function enhanceTopics() {
  const header = document.querySelector('.case-board-sign .sign-sub, .submit-topic-tip');
  if (header && !header.dataset.soloEnhanced) {
    header.dataset.soloEnhanced = '1';
    header.textContent = '처음엔 혼자 AI 상대와 바로 재판해보세요';
  }
}

function enhanceTopicDetail() {
  const aiGate = document.querySelector('.entry-gate[data-mode="ai"]');
  const plaintiff = document.querySelector('.character-choice[data-side="plaintiff"]');
  const start = document.getElementById('start-btn');

  if (aiGate && plaintiff && start && !document.body.dataset.topicSoloDefaulted) {
    document.body.dataset.topicSoloDefaulted = '1';
    setTimeout(() => {
      plaintiff.click();
      aiGate.click();
      aiGate.classList.add('solo-recommended');
      if (!start.disabled) start.textContent = '🤖 혼자 AI 재판 바로 시작';
    }, 120);
  }

  const gateTitle = Array.from(document.querySelectorAll('.entry-section-title')).find(el => el.textContent.includes('재판장 입장'));
  if (gateTitle && !gateTitle.dataset.soloEnhanced) {
    gateTitle.dataset.soloEnhanced = '1';
    gateTitle.textContent = '2. 재판 방식 선택 · 처음엔 혼자 AI 재판 추천';
  }

  const aiBanner = document.querySelector('.ai-fast-banner');
  if (aiBanner && !aiBanner.dataset.soloEnhanced) {
    aiBanner.dataset.soloEnhanced = '1';
    aiBanner.innerHTML = `<span>🤖</span><div><strong>혼자서 바로 플레이 가능!</strong><small>사람을 기다리지 않고 AI 상대와 즉시 재판을 시작합니다. 재미있으면 친구에게 공유하세요.</small></div>`;
  }

  if (!aiGate && start && !document.querySelector('.solo-ai-disabled-note')) {
    const note = document.createElement('div');
    note.className = 'solo-ai-disabled-note';
    note.innerHTML = `<strong>🤖 혼자 재판 안내</strong><span>AI 상대 모드가 관리자 설정에서 꺼져 있습니다. 관리자 페이지에서 AI 모드를 켜면 혼자 재판이 기본으로 활성화됩니다.</span>`;
    start.insertAdjacentElement('beforebegin', note);
  }
}

function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.id = 'solo-game-flow-style';
  style.textContent = `
    .court-wide-btn { grid-column: 1 / -1; }
    .solo-quick-btn { width:100%; }
    .entry-gate.solo-recommended { border-color: var(--gold) !important; background: linear-gradient(135deg, rgba(201,168,76,.18), rgba(255,255,255,.04)) !important; box-shadow: 0 0 0 3px rgba(201,168,76,.14), 0 10px 26px rgba(0,0,0,.18); }
    .entry-gate.solo-recommended::after { content:'추천'; position:absolute; top:8px; right:8px; padding:2px 7px; border-radius:999px; background:var(--gold); color:#0d1117; font-size:10px; font-weight:900; }
    .solo-ai-disabled-note { margin-bottom:14px; padding:14px 16px; border-radius:16px; border:1.5px solid rgba(201,168,76,.28); background:linear-gradient(135deg,rgba(201,168,76,.1),rgba(255,255,255,.03)); }
    .solo-ai-disabled-note strong { display:block; color:var(--gold); font-size:13px; margin-bottom:4px; }
    .solo-ai-disabled-note span { display:block; color:var(--cream-dim); font-size:12px; line-height:1.55; }
    @media (max-width:520px) { .court-wide-btn { grid-column:auto; } }
  `;
  document.head.appendChild(style);
}
