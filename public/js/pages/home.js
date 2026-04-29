import { db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const DEMO_STEPS = [
  {
    tab: '주제 고르기',
    render: () => `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:14px;">📋 공감 100% 사건 중 하나를 고르세요</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[
          ['카톡 읽씹 무죄 주장', '읽었으면 답해야 vs 내 자유다', true],
          ['치킨 마지막 조각 독식 사건', '맛있는 건 먼저 먹는 게 당연 vs 나눠 먹어야지', false],
          ['더치페이 거부 사건', '각자 내는 게 공평 vs 사준 사람이 쏴야지', false],
        ].map(([t, s, active]) => `
          <div style="padding:12px 14px;border-radius:10px;border:1.5px solid ${active ? 'rgba(201,168,76,0.5)' : 'var(--border)'};background:${active ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.02)'};cursor:pointer;">
            <div style="font-size:13px;font-weight:700;color:${active ? 'var(--gold)' : 'var(--cream)'};margin-bottom:3px;">${t}</div>
            <div style="font-size:11px;color:var(--cream-dim);">${s}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:14px;text-align:center;font-size:12px;color:var(--cream-dim);">또는 직접 사건 등록도 가능해요 ✏️</div>`,
  },
  {
    tab: '대결 방식',
    render: () => `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:14px;">🎮 원하는 방식으로 시작하세요</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="padding:12px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,0.4);background:rgba(201,168,76,0.07);">
          <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:2px;">👫 친구와 대결</div>
          <div style="font-size:11px;color:var(--cream-dim);">링크 공유 → 친구가 가입 없이 바로 입장</div>
        </div>
        <div style="padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.02);">
          <div style="font-size:13px;font-weight:700;color:var(--cream);margin-bottom:2px;">🎲 랜덤 매칭</div>
          <div style="font-size:11px;color:var(--cream-dim);">같은 주제 대기자와 자동 연결</div>
        </div>
        <div style="padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.02);">
          <div style="font-size:13px;font-weight:700;color:var(--cream);margin-bottom:2px;">🤖 AI와 대결 (소소봇)</div>
          <div style="font-size:11px;color:var(--cream-dim);">혼자서 즉시 시작 · AI가 논리적으로 반박</div>
        </div>
      </div>
      <div style="margin-top:12px;text-align:center;font-size:11px;color:var(--cream-dim);">라운드는 3 · 5 · 7 중 선택 ⚖️</div>`,
  },
  {
    tab: '토론',
    render: () => `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">💬 A팀(왼쪽) vs B팀(오른쪽) 실시간 토론</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div class="demo-msg demo-msg-p" style="animation-delay:0s;">
          <div class="demo-bubble demo-bubble-p">읽었으면 답하는 게 기본 예의 아닌가요? 🙁</div>
          <div style="font-size:10px;color:rgba(231,76,60,0.7);margin-top:3px;">⚔️ 원고</div>
        </div>
        <div class="demo-msg demo-msg-d" style="animation-delay:.6s;">
          <div class="demo-bubble demo-bubble-d">내가 언제 답할지는 제가 결정해요. 카톡이 법은 아니잖아요.</div>
          <div style="font-size:10px;color:rgba(52,152,219,0.7);margin-top:3px;text-align:right;">🛡️ 피고</div>
        </div>
        <div class="demo-msg demo-msg-p" style="animation-delay:1.2s;">
          <div class="demo-bubble demo-bubble-p">그건 상대방을 무시하는 행동이에요!</div>
          <div style="font-size:10px;color:rgba(231,76,60,0.7);margin-top:3px;">⚔️ 원고</div>
        </div>
        <div class="demo-msg demo-msg-d" style="animation-delay:1.8s;">
          <div class="demo-bubble demo-bubble-d">바쁠 수도 있죠. 상황을 모르면서 단정하지 마세요.</div>
          <div style="font-size:10px;color:rgba(52,152,219,0.7);margin-top:3px;text-align:right;">🛡️ 피고</div>
        </div>
      </div>
      <div style="margin-top:12px;text-align:center;font-size:11px;color:var(--cream-dim);">1라운드 완료 후 언제든 판정 요청 가능 🔥</div>`,
  },
  {
    tab: 'AI 판정',
    render: () => `
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:10px;color:var(--cream-dim);letter-spacing:.1em;margin-bottom:6px;">이번 사건 담당 심판</div>
        <div style="font-size:32px;margin-bottom:4px;">🥹</div>
        <div style="font-size:13px;font-weight:700;color:#8e44ad;">감성형 판사</div>
      </div>
      <div style="padding:14px;border-radius:12px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.25);margin-bottom:10px;">
        <div style="text-align:center;font-size:11px;color:var(--cream-dim);letter-spacing:.1em;margin-bottom:8px;">⚖️ 최종 판결</div>
        <div style="text-align:center;font-size:20px;font-weight:900;color:var(--gold);margin-bottom:4px;">⚔️ 원고 승소</div>
        <div style="font-size:12px;color:var(--cream-dim);text-align:center;line-height:1.6;margin-top:8px;">"원고여... 읽씹의 고통이 고스란히 느껴집니다 (목이 메어) 당신의 억울함은 이 법정이 기억할 것입니다 (흑흑)"</div>
      </div>
      <div style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);">
        <div style="font-size:10px;color:var(--gold);font-weight:700;margin-bottom:4px;">📜 생활형 처분</div>
        <div style="font-size:12px;color:var(--cream);line-height:1.6;">피고는 원고에게 따뜻한 국밥 한 그릇을 사주고, 눈을 마주치며 '미안해'라고 말할 것을 명한다</div>
      </div>`,
  },
];

export async function renderHome(container) {
  container.innerHTML = `
    <section class="battle-hero">
      <span class="battle-gavel">⚖️</span>
      <span class="battle-badge">소소킹 토론배틀</span>
      <h1 class="battle-title">사소한 갈등,<br><span>배틀로 끝냅시다</span></h1>
      <p class="battle-sub">친구와 직접 토론하고<br>AI 심판에게 공정한 판정을 받으세요</p>

      <div class="hero-preview">
        <div class="hero-preview-label">📋 예시 — 카톡 읽씹 무죄 주장 사건</div>
        <div class="hero-preview-card">
          <div class="hero-preview-vs">
            <div class="hero-preview-side p">
              <div class="hero-preview-role" style="color:#e88;">🔴 A팀</div>
              <div class="hero-preview-text">"읽었으면 바로 답장이 기본 예의다"</div>
            </div>
            <div class="hero-preview-side d">
              <div class="hero-preview-role" style="color:#7ac;">🔵 B팀</div>
              <div class="hero-preview-text">"나중에 답할 자유가 있다"</div>
            </div>
          </div>
          <div class="hero-preview-footer">누가 맞을까요? → AI 판사가 판결합니다</div>
        </div>
      </div>

      <div class="battle-cta-wrap">
        <a href="#/topics" class="battle-cta-main">⚖️ 🔥 지금 바로 배틀하기</a>
        <a href="#/submit-topic" class="battle-cta-sub">✏️ ✏️ 주제 직접 등록하기</a>
      </div>
      <p class="battle-disclaimer">오락 목적 · AI 판정에 법적 효력 없음 · 무료 · 익명</p>
      <div class="battle-scroll-hint"><span>↓</span><span>오늘의 주제</span></div>
    </section>

    <div class="container" style="padding-top:32px;padding-bottom:80px;">
      <div id="active-session-banner"></div>
      <div id="today-section"></div>
      <div id="popular-section" style="margin-top:32px;"></div>

      <!-- 이용 방법 데모 -->
      <div style="margin-top:40px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;">📺 이렇게 이용해요</div>
          <a href="#/guide" style="font-size:12px;color:var(--cream-dim);text-decoration:none;display:flex;align-items:center;gap:4px;">자세한 안내 <span style="color:var(--gold);">→</span></a>
        </div>
        <div class="demo-carousel" id="demo-carousel">
          <div class="demo-tabs" id="demo-tabs"></div>
          <div class="demo-screen" id="demo-screen"></div>
          <div class="demo-progress" id="demo-progress"></div>
        </div>
      </div>

      <div style="margin-top:24px;">
        <div class="home-feature-grid">
          <div class="home-feature-item">
            <span class="home-feature-icon">🔗</span>
            <div class="home-feature-label">링크 초대</div>
            <div class="home-feature-desc">가입 없이 링크 하나로 친구 초대</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">🎲</span>
            <div class="home-feature-label">랜덤 매칭</div>
            <div class="home-feature-desc">모르는 사람과 즉석 대결도 가능</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">🤖</span>
            <div class="home-feature-label">AI 상대</div>
            <div class="home-feature-desc">소소봇과 1인 즉시 시작 가능</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">👨‍⚖️</span>
            <div class="home-feature-label">7인 랜덤 판사</div>
            <div class="home-feature-desc">매번 다른 성향의 AI 판사 배정</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">✏️</span>
            <div class="home-feature-label">직접 등록</div>
            <div class="home-feature-desc">내 억울한 일을 사건으로 등록</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">📋</span>
            <div class="home-feature-label">내 기록</div>
            <div class="home-feature-desc">지난 재판과 판결 결과 모아보기</div>
          </div>
        </div>
      </div>

      <div style="margin-top:32px;">
        <a href="#/topics" class="btn btn-primary" style="font-size:17px;padding:18px;">⚖️ 지금 재판 시작하기</a>
        <a href="#/guide" class="btn btn-ghost" style="margin-top:10px;font-size:14px;">📖 이용 안내 보기</a>
      </div>

      <div id="pwa-install-banner"></div>

      <div style="margin-top:24px;padding-bottom:12px;">
        <div class="disclaimer" style="text-align:center;">
          소소킹 토론배틀은 순수 오락 서비스입니다.<br>AI 판정에는 법적 효력이 없으며, 익명으로 운영됩니다.
        </div>
      </div>
    </div>
  `;

  loadTodayCase();
  loadPopularTopics();
  setupInstallBanner();
  setupDemo();
  checkActiveSessionBanner();
}

function setupDemo() {
  const tabsEl = document.getElementById('demo-tabs');
  const screenEl = document.getElementById('demo-screen');
  const progressEl = document.getElementById('demo-progress');
  if (!tabsEl || !screenEl) return;

  let current = 0;
  let timer = null;

  const progressDots = DEMO_STEPS.map((_, i) => {
    const d = document.createElement('div');
    d.className = 'demo-dot';
    progressEl.appendChild(d);
    return d;
  });

  DEMO_STEPS.forEach((step, i) => {
    const btn = document.createElement('button');
    btn.className = 'demo-tab' + (i === 0 ? ' active' : '');
    btn.textContent = step.tab;
    btn.addEventListener('click', () => { clearInterval(timer); goTo(i); startTimer(); });
    tabsEl.appendChild(btn);
  });

  function goTo(idx) {
    current = (idx + DEMO_STEPS.length) % DEMO_STEPS.length;
    tabsEl.querySelectorAll('.demo-tab').forEach((b, i) => b.classList.toggle('active', i === current));
    progressDots.forEach((d, i) => d.classList.toggle('active', i === current));
    screenEl.innerHTML = `<div class="demo-step-content">${DEMO_STEPS[current].render()}</div>`;
  }

  function startTimer() {
    timer = setInterval(() => goTo(current + 1), 4000);
  }

  goTo(0);
  startTimer();

  // Pause auto-advance when carousel is not visible
  const obs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) { clearInterval(timer); timer = null; }
    else if (!timer) { startTimer(); }
  }, { threshold: 0.3 });
  const carousel = document.getElementById('demo-carousel');
  if (carousel) obs.observe(carousel);
}

function setupInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  function showBanner() {
    if (!window._pwaInstall) return;
    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.04));border:1.5px solid rgba(201,168,76,0.4);border-radius:14px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:28px;">📲</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--cream);">앱으로 설치하기</div>
            <div style="font-size:12px;color:var(--cream-dim);margin-top:2px;">홈 화면에 추가하면 더 빠르게 접속</div>
          </div>
        </div>
        <button id="pwa-install-btn" style="flex-shrink:0;padding:10px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--gold),var(--gold-light));color:#0d1117;font-size:14px;font-weight:700;cursor:pointer;">설치</button>
      </div>`;
    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
      if (!window._pwaInstall) return;
      window._pwaInstall.prompt();
      const { outcome } = await window._pwaInstall.userChoice;
      if (outcome === 'accepted') banner.innerHTML = '';
      window._pwaInstall = null;
    });
  }

  showBanner();
  document.addEventListener('pwa-installable', showBanner);
  document.addEventListener('pwa-installed', () => { banner.innerHTML = ''; });
}

async function loadTodayCase() {
  const el = document.getElementById('today-section');
  if (!el) return;
  try {
    let snap = await getDocs(query(
      collection(db, 'topics'),
      where('status', '==', 'active'),
      where('isOfficial', '==', true),
      orderBy('playCount', 'desc'),
      limit(1)
    ));
    if (snap.empty) {
      snap = await getDocs(query(
        collection(db, 'topics'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(1)
      ));
    }
    if (!snap.empty) renderTodayCard(el, snap.docs[0].id, snap.docs[0].data());
  } catch { /* no topics yet */ }
}

function renderTodayCard(el, topicId, t) {
  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">🌟 오늘의 주제</div>
    <div class="today-case-card" onclick="location.hash='#/topic/${topicId}'">
      <div class="today-label">📋 ${t.category || '생활'} · 재판 ${(t.playCount||0).toLocaleString()}회</div>
      <div class="today-title">${t.title}</div>
      <div class="today-summary">${t.summary}</div>
      <div class="today-vs">
        <div class="today-pos" style="border-left:2px solid rgba(231,76,60,0.5);">
          <div class="today-pos-label">⚔️ 원고</div>
          <div class="today-pos-text">${t.plaintiffPosition}</div>
        </div>
        <div class="today-pos" style="border-left:2px solid rgba(52,152,219,0.5);">
          <div class="today-pos-label">🛡️ 피고</div>
          <div class="today-pos-text">${t.defendantPosition}</div>
        </div>
      </div>
      <div class="today-footer"><span style="color:var(--gold);font-weight:700;">탭해서 재판 시작 →</span></div>
    </div>
  `;
}

async function loadPopularTopics() {
  const el = document.getElementById('popular-section');
  if (!el) return;
  try {
    const snap = await getDocs(query(
      collection(db, 'topics'),
      where('status', '==', 'active'),
      orderBy('playCount', 'desc'),
      limit(5)
    ));
    if (snap.empty) return;
    const cards = snap.docs.map(d => {
      const t = d.data();
      return `<div class="topic-card" onclick="location.hash='#/topic/${d.id}'" style="margin-bottom:8px;">
        <div class="topic-card-title">${t.title}</div>
        <div class="topic-card-summary">${t.summary}</div>
        <div class="topic-card-footer">
          <span class="topic-card-cat">${t.category || '생활'}</span>
          <span>재판 ${(t.playCount||0).toLocaleString()}회</span>
          ${t.isOfficial ? '<span style="color:var(--gold);font-size:10px;font-weight:700;">공식</span>' : ''}
        </div>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">🔥 인기 사건</div>
      ${cards}
      <a href="#/topics" style="display:block;text-align:center;margin-top:12px;color:var(--gold);font-size:13px;font-weight:700;text-decoration:none;">전체 사건 보기 →</a>
    `;
  } catch { /* silent */ }
}

function checkActiveSessionBanner() {
  const el = document.getElementById('active-session-banner');
  if (!el) return;
  try {
    const stored = JSON.parse(localStorage.getItem('sosoking_active_session') || 'null');
    if (!stored || !stored.sessionId) return;
    const ageHours = (Date.now() - (stored.savedAt || 0)) / 3600000;
    if (ageHours > 48) { localStorage.removeItem('sosoking_active_session'); return; }
    const roleLabel = stored.role === 'plaintiff' ? '⚔️ 원고' : '🛡️ 피고';
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(201,168,76,0.14),rgba(201,168,76,0.05));border:1.5px solid rgba(201,168,76,0.45);border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:3px;">⚖️ 진행 중인 재판</div>
          <div style="font-size:13px;color:var(--cream);font-weight:600;">${escHtml(stored.topicTitle || '재판')} · ${roleLabel}</div>
        </div>
        <a href="#/debate/${stored.sessionId}" style="flex-shrink:0;padding:9px 16px;border-radius:10px;background:var(--gold);color:#0d1117;font-size:13px;font-weight:700;text-decoration:none;">이어하기 →</a>
      </div>
    `;
  } catch {}
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
