import { db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const DEMO_STEPS = [
  {
    tab: '주제 고르기',
    render: () => `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:14px;">📋 공감 100% 주제 중 하나를 고르세요</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[
          ['카톡 읽씹 배틀', '읽었으면 답해야 vs 내 자유다', true],
          ['치킨 마지막 조각 배틀', '맛있는 건 먼저 먹는 게 당연 vs 나눠 먹어야지', false],
          ['더치페이 배틀', '각자 내는 게 공평 vs 부른 사람이 쏴야지', false],
        ].map(([t, s, active]) => `
          <div style="padding:12px 14px;border-radius:10px;border:1.5px solid ${active ? 'rgba(201,168,76,0.5)' : 'var(--border)'};background:${active ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.02)'};cursor:pointer;">
            <div style="font-size:13px;font-weight:700;color:${active ? 'var(--gold)' : 'var(--cream)'};margin-bottom:3px;">${t}</div>
            <div style="font-size:11px;color:var(--cream-dim);">${s}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:14px;text-align:center;font-size:12px;color:var(--cream-dim);">또는 나만의 억울한 주제 직접 등록 ✏️</div>`,
  },
  {
    tab: '대결 방식',
    render: () => `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:14px;">🎮 원하는 방식으로 시작하세요</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="padding:12px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,0.4);background:rgba(201,168,76,0.07);">
          <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:2px;">👫 친구와 대결</div>
          <div style="font-size:11px;color:var(--cream-dim);">링크 공유 → 가입 없이 바로 입장</div>
        </div>
        <div style="padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.02);">
          <div style="font-size:13px;font-weight:700;color:var(--cream);margin-bottom:2px;">🎲 랜덤 매칭</div>
          <div style="font-size:11px;color:var(--cream-dim);">같은 주제 대기자와 자동 연결</div>
        </div>
        <div style="padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.02);">
          <div style="font-size:13px;font-weight:700;color:var(--cream);margin-bottom:2px;">🤖 AI와 대결 (소소봇)</div>
          <div style="font-size:11px;color:var(--cream-dim);">혼자서 즉시 시작 · 소소봇이 재치있게 반박</div>
        </div>
      </div>
      <div style="margin-top:12px;text-align:center;font-size:11px;color:var(--cream-dim);">라운드는 3 · 5 · 7 중 선택 🔥</div>`,
  },
  {
    tab: '토론',
    render: () => `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">💬 친구 사이 소소한 배틀 예시</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div class="demo-msg demo-msg-p" style="animation-delay:0s;">
          <div class="demo-bubble demo-bubble-p">읽고 3시간 후에 답장하는 거 맞죠? ㅋㅋ 👀</div>
          <div style="font-size:10px;color:rgba(231,76,60,0.7);margin-top:3px;">🔴 A팀</div>
        </div>
        <div class="demo-msg demo-msg-d" style="animation-delay:.6s;">
          <div class="demo-bubble demo-bubble-d">그 3시간이 신중하게 고민한 숙성의 시간이에요 😌</div>
          <div style="font-size:10px;color:rgba(52,152,219,0.7);margin-top:3px;text-align:right;">🔵 B팀</div>
        </div>
        <div class="demo-msg demo-msg-p" style="animation-delay:1.2s;">
          <div class="demo-bubble demo-bubble-p">3시간 숙성한 답장이 '응' 한 글자면요? 😂</div>
          <div style="font-size:10px;color:rgba(231,76,60,0.7);margin-top:3px;">🔴 A팀</div>
        </div>
        <div class="demo-msg demo-msg-d" style="animation-delay:1.8s;">
          <div class="demo-bubble demo-bubble-d">명작을 쓰다가 심플하게 간 거예요 ✍️ 그게 예술이죠</div>
          <div style="font-size:10px;color:rgba(52,152,219,0.7);margin-top:3px;text-align:right;">🔵 B팀</div>
        </div>
      </div>
      <div style="margin-top:12px;padding:8px 12px;border-radius:8px;background:rgba(201,168,76,0.07);border:1px solid rgba(201,168,76,0.2);text-align:center;font-size:11px;color:var(--gold);font-weight:700;">핵심 법칙: 진지하면 진다 😄 재치 있을수록 고득점!</div>`,
  },
  {
    tab: 'AI 판정',
    render: () => `
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:10px;color:var(--cream-dim);letter-spacing:.1em;margin-bottom:6px;">이번 배틀 담당 심판</div>
        <div style="font-size:28px;margin-bottom:4px;">🥹</div>
        <div style="font-size:13px;font-weight:700;color:#8e44ad;">감성형 심판</div>
      </div>
      <div style="margin:0 0 10px;padding:0 2px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
          <span style="font-size:12px;font-weight:800;color:#e74c3c;">🔴 A팀 72점</span>
          <span style="font-size:12px;font-weight:800;color:#3498db;">🔵 B팀 28점</span>
        </div>
        <div style="height:10px;border-radius:5px;overflow:hidden;display:flex;gap:2px;">
          <div style="width:72%;background:linear-gradient(90deg,#e74c3c,#ff6b6b);border-radius:5px 0 0 5px;"></div>
          <div style="width:28%;background:linear-gradient(90deg,#3498db,#5dade2);border-radius:0 5px 5px 0;"></div>
        </div>
        <div style="font-size:10px;color:var(--cream-dim);text-align:center;margin-top:4px;">재치·공감·유머 종합 점수</div>
      </div>
      <div style="padding:10px 12px;border-radius:10px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);margin-bottom:8px;">
        <div style="text-align:center;font-size:14px;font-weight:900;color:var(--gold);margin-bottom:6px;">🏆 A팀 승리</div>
        <div style="font-size:11px;color:var(--cream-dim);line-height:1.6;">"투명인간·선비 드립이 절묘했습니다 (눈물을 닦으며). 재치 하나로 승부가 갈렸습니다 (흑흑)"</div>
      </div>
      <div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);">
        <div style="font-size:10px;color:var(--gold);font-weight:700;margin-bottom:4px;">🎯 B팀 미션</div>
        <div style="font-size:11px;color:var(--cream);line-height:1.6;">A팀에게 따뜻한 국밥 한 그릇을 사주고, 눈을 마주치며 '미안해'라고 말할 것</div>
      </div>`,
  },
];

export async function renderHome(container) {
  container.innerHTML = `
    <section class="battle-hero">
      <span class="battle-gavel">🔥</span>
      <span class="battle-badge">소소킹 토론배틀</span>
      <h1 class="battle-title">진지하면 진다 😄<br><span>소소한 배틀의 법칙</span></h1>
      <p class="battle-sub">재치 있을수록 유리한<br>친구와의 AI 토론배틀</p>

      <div class="hero-preview">
        <div class="hero-preview-label">📋 예시 — 카톡 읽씹 무죄 주장 배틀</div>
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
          <div class="hero-preview-footer">누가 맞을까요? → AI 심판이 판정합니다</div>
        </div>
      </div>

      <div class="battle-cta-wrap">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:360px;margin:0 auto 10px;">
          <button onclick="window._startMode('debate')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 10px;border-radius:14px;background:linear-gradient(135deg,rgba(231,76,60,0.15),rgba(231,76,60,0.05));border:1.5px solid rgba(231,76,60,0.4);cursor:pointer;color:var(--cream);">
            <span style="font-size:28px;">⚔️</span>
            <span style="font-size:14px;font-weight:800;color:#e74c3c;">토론 모드</span>
            <span style="font-size:10px;color:var(--cream-dim);text-align:center;">A팀 vs B팀</span>
          </button>
          <button onclick="window._startMode('court')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 10px;border-radius:14px;background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05));border:1.5px solid rgba(201,168,76,0.4);cursor:pointer;color:var(--cream);">
            <span style="font-size:28px;">🏛️</span>
            <span style="font-size:14px;font-weight:800;color:var(--gold);">법정 모드</span>
            <span style="font-size:10px;color:var(--cream-dim);text-align:center;">원고 vs 피고</span>
          </button>
        </div>
        <a href="#/submit-topic" class="battle-cta-sub">✏️ 주제 직접 등록하기</a>
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
            <div class="home-feature-label">7인 랜덤 심판</div>
            <div class="home-feature-desc">매번 다른 성향의 AI 심판 배정</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">✏️</span>
            <div class="home-feature-label">직접 등록</div>
            <div class="home-feature-desc">내 억울한 일을 주제로 등록</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">📋</span>
            <div class="home-feature-label">내 기록</div>
            <div class="home-feature-desc">지난 배틀과 판정 결과 모아보기</div>
          </div>
        </div>
      </div>

      <div style="margin-top:32px;">
        <a href="#/topics" class="btn btn-primary" style="font-size:17px;padding:18px;">🔥 지금 배틀 시작하기</a>
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

window._startMode = (mode) => {
  try { localStorage.setItem('sosoking_game_mode', mode); } catch {}
  location.hash = '#/topics';
};

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
      <div class="today-label">📋 ${t.category || '생활'} · 배틀 ${(t.playCount||0).toLocaleString()}회</div>
      <div class="today-title">${t.title}</div>
      <div class="today-summary">${t.summary}</div>
      <div class="today-vs">
        <div class="today-pos" style="border-left:2px solid rgba(231,76,60,0.5);">
          <div class="today-pos-label">🔴 A팀</div>
          <div class="today-pos-text">${t.plaintiffPosition}</div>
        </div>
        <div class="today-pos" style="border-left:2px solid rgba(52,152,219,0.5);">
          <div class="today-pos-label">🔵 B팀</div>
          <div class="today-pos-text">${t.defendantPosition}</div>
        </div>
      </div>
      <div class="today-footer"><span style="color:var(--gold);font-weight:700;">탭해서 배틀 시작 →</span></div>
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
          <span>배틀 ${(t.playCount||0).toLocaleString()}회</span>
          ${t.isOfficial ? '<span style="color:var(--gold);font-size:10px;font-weight:700;">공식</span>' : ''}
        </div>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">🔥 인기 주제</div>
      ${cards}
      <a href="#/topics" style="display:block;text-align:center;margin-top:12px;color:var(--gold);font-size:13px;font-weight:700;text-decoration:none;">전체 주제 보기 →</a>
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
    const roleLabel = stored.role === 'plaintiff' ? '🔴 A팀' : '🔵 B팀';
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(201,168,76,0.14),rgba(201,168,76,0.05));border:1.5px solid rgba(201,168,76,0.45);border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:3px;">🔥 진행 중인 배틀</div>
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
