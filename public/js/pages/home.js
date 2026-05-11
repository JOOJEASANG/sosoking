import { STORY_CASE_PACK } from '../data/story-case-pack.js';

const JUDGES = [
  ['👨‍⚖️', '엄벌주의형', '소소한 일도 중대 사건처럼 판결'],
  ['🥹', '감성형', '눈물과 공감으로 판결'],
  ['🤦', '현실주의형', '팩트로 쿨하게 판결'],
  ['🔥', '과몰입형', '인류사급 대사건으로 판결'],
  ['😴', '피곤형', '빨리 끝내고 싶은 판결'],
  ['🧮', '논리집착형', '점수와 확률로 판결'],
  ['🎭', '드립형', '진지한 척 웃기게 판결'],
];

function getDailyStoryCases(count = 3) {
  const now = new Date();
  const seed = Number(`${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`);
  return STORY_CASE_PACK
    .map((item, index) => ({ item, score: ((index + 11) * 7919 + seed * 104729) % 100000 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(x => x.item);
}

export async function renderHome(container) {
  injectLobbyStyle();
  const todayCases = getDailyStoryCases(3);
  const popularCases = STORY_CASE_PACK.slice(0, 5);

  container.innerHTML = `
    <section class="courthouse-hero">
      <div class="court-sky-light"></div>
      <div class="court-building">
        <div class="court-topbar">
          <div>
            <div class="court-kicker">SOSOKING STORY COURT · ENTERTAINMENT ONLY</div>
            <div class="court-logo">⚖️ 소소킹 생활법정</div>
          </div>
          <button class="court-help-btn" onclick="location.hash='#/guide'">이용 안내</button>
        </div>

        <div class="court-facade">
          <div class="court-roof"><span>⚖️</span><strong>소소킹 생활법정</strong><small>STORY COURT</small></div>
          <div class="court-columns"><i></i><i></i><i></i><i></i></div>
          <div class="court-entrance">
            <div class="court-door" onclick="window._startCourtCase()"><div class="door-sign">대법정 입장</div><div class="door-line"></div><div class="door-knob-left"></div><div class="door-knob-right"></div></div>
            <div class="court-clerk-window" onclick="location.hash='#/case-quest'"><div class="clerk-avatar">🧑‍💼</div><div class="clerk-title">사건 접수 창구</div><div class="clerk-sub">내 사건을 접수하세요</div></div>
            <div class="court-notice-board" onclick="window._startCourtCase()"><div class="notice-pin">📋</div><div class="notice-title">오늘의 사건 게시판</div><div class="notice-sub">스토리 사건 열람</div></div>
          </div>
          <div class="court-stairs"><b></b><b></b><b></b></div>
        </div>

        <div class="court-copy">
          <h1>생활 속 작은 사건,<br><span>역할을 골라 풀어보자</span></h1>
          <p>경찰·검사·변호사·증인·예비 판사 역할을 고르고,<br>단서와 반전을 따라가며 AI 판사의 오락용 판결을 받아보세요.</p>
        </div>

        <div class="court-actions">
          <button onclick="window._startCourtCase()" class="court-primary-btn">🕵️ 오늘의 사건 보기</button>
          <button onclick="location.hash='#/case-quest'" class="court-secondary-btn">✏️ 내 사건 접수</button>
        </div>

        <div class="court-service-row">
          <div class="court-service-card"><span>🚓</span><strong>경찰 조사</strong><small>증거와 단서 확인</small></div>
          <div class="court-service-card"><span>🧑‍💼</span><strong>검사 추궁</strong><small>모순을 캐묻기</small></div>
          <div class="court-service-card"><span>⚖️</span><strong>변호 전략</strong><small>입장 방어하기</small></div>
        </div>

        <div class="court-legal-note">본 서비스는 오락용 모의법정입니다. 실제 법적 효력은 없습니다.</div>
      </div>
    </section>

    <div class="container" style="padding-top:28px;padding-bottom:80px;">
      <div id="active-session-banner"></div>
      <section class="home-story-section">
        <div class="home-section-head">
          <div>
            <div class="home-section-kicker">🌟 TODAY CASES</div>
            <h2>오늘의 스토리 사건 3개</h2>
          </div>
          <a href="#/topics">전체 보기</a>
        </div>
        <div class="home-story-grid">
          ${todayCases.map((item, idx) => storyCaseCard(item, idx, true)).join('')}
        </div>
      </section>

      <section class="home-story-section" style="margin-top:34px;">
        <div class="home-section-head">
          <div>
            <div class="home-section-kicker">🔥 STORY PACK</div>
            <h2>추천 사건</h2>
          </div>
          <a href="#/topics">사건 게시판</a>
        </div>
        <div class="home-popular-list">
          ${popularCases.map((item, idx) => compactCaseCard(item, idx)).join('')}
        </div>
      </section>

      <div style="margin-top:40px;">
        <div style="font-size:11px;font-weight:900;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">👨‍⚖️ 랜덤 AI 판사단</div>
        <div class="home-feature-grid">
          ${JUDGES.map(([icon, name, desc]) => `<div class="home-feature-item"><span class="home-feature-icon">${icon}</span><div class="home-feature-label">${name}</div><div class="home-feature-desc">${desc}</div></div>`).join('')}
        </div>
      </div>

      <div style="margin-top:32px;">
        <div style="font-size:11px;font-weight:900;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">🎮 사건 진행 절차</div>
        <div class="home-feature-grid">
          <div class="home-feature-item"><span class="home-feature-icon">📋</span><div class="home-feature-label">사건 선택</div><div class="home-feature-desc">단서와 반전이 있는 사건을 고릅니다</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">🎭</span><div class="home-feature-label">역할 선택</div><div class="home-feature-desc">경찰·검사·변호사·증인 역할을 고릅니다</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">🃏</span><div class="home-feature-label">카드 진행</div><div class="home-feature-desc">글쓰기 대신 역할 카드를 선택합니다</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">🔨</span><div class="home-feature-label">AI 판결</div><div class="home-feature-desc">AI 판사가 판결문과 미션을 선고합니다</div></div>
        </div>
      </div>

      <div style="margin-top:32px;">
        <button onclick="window._startCourtCase()" class="btn btn-primary" style="font-size:17px;padding:18px;">🔥 사건 게시판 입장</button>
        <a href="#/guide" class="btn btn-ghost" style="margin-top:10px;font-size:14px;">📖 이용 안내 보기</a>
      </div>

      <div style="margin-top:24px;padding-bottom:12px;"><div class="disclaimer" style="text-align:center;">소소킹 생활법정은 순수 오락 서비스입니다.<br>AI 판결에는 실제 법적 효력이 없으며, 재미로만 이용해주세요.</div></div>
    </div>
  `;

  bindStoryCaseButtons();
  checkActiveSessionBanner();
}

window._startCourtCase = () => {
  try { localStorage.setItem('sosoking_game_mode', 'court'); } catch {}
  location.hash = '#/topics';
};

function storyCaseCard(item, idx, large = false) {
  return `
    <article class="home-story-card ${large ? 'large' : ''}" data-story-id="${escAttr(item.id)}" style="animation-delay:${idx * .04}s;">
      <div class="home-story-top"><span>${caseIcon(item.category)}</span><b>${escHtml(item.category)} · ${escHtml(item.difficulty || '스토리')}</b></div>
      <h3>${escHtml(item.title)}</h3>
      <p>${escHtml(item.summary)}</p>
      <div class="home-story-hook"><b>사건 발단</b><span>${escHtml(item.hook || '')}</span></div>
      <div class="home-story-twist"><b>반전 포인트</b><span>${escHtml(item.twist || '')}</span></div>
      <button type="button" data-start-story="${escAttr(item.id)}">🕵️ 이 사건 시작</button>
    </article>`;
}

function compactCaseCard(item, idx) {
  return `
    <button type="button" class="home-compact-case" data-start-story="${escAttr(item.id)}" style="animation-delay:${idx * .035}s;">
      <span class="home-compact-icon">${caseIcon(item.category)}</span>
      <span class="home-compact-body"><b>${escHtml(item.title)}</b><small>${escHtml(item.summary)}</small></span>
      <i>시작 →</i>
    </button>`;
}

function bindStoryCaseButtons() {
  document.querySelectorAll('[data-start-story]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const item = STORY_CASE_PACK.find(x => x.id === btn.dataset.startStory);
      if (!item) return;
      sessionStorage.setItem('sosoking_prefill_case', JSON.stringify({
        title: item.title,
        summary: `${item.summary} ${item.hook || ''} ${item.twist || ''}`.slice(0, 120),
        plaintiffPosition: item.plaintiffPosition,
        defendantPosition: item.defendantPosition,
        category: item.category,
        storyCaseId: item.id,
        difficulty: item.difficulty,
      }));
      location.hash = '#/case-quest';
    });
  });
}

function caseIcon(category = '') {
  const c = String(category);
  if (c.includes('카톡')) return '💬';
  if (c.includes('연애')) return '💘';
  if (c.includes('음식') || c.includes('치킨')) return '🍗';
  if (c.includes('정산') || c.includes('돈')) return '💸';
  if (c.includes('직장')) return '💼';
  if (c.includes('친구')) return '👫';
  if (c.includes('가족')) return '👨‍👩‍👧';
  if (c.includes('이웃')) return '🏘️';
  if (c.includes('취미')) return '🎮';
  return '📁';
}

function checkActiveSessionBanner() {
  const el = document.getElementById('active-session-banner');
  if (!el) return;
  try {
    const stored = JSON.parse(localStorage.getItem('sosoking_active_session') || 'null');
    if (!stored || !stored.sessionId) return;
    const ageHours = (Date.now() - (stored.savedAt || 0)) / 3600000;
    if (ageHours > 48) { localStorage.removeItem('sosoking_active_session'); return; }
    const roleLabel = stored.role === 'plaintiff' ? '🔴 원고' : '🔵 피고';
    el.innerHTML = `<div style="background:linear-gradient(135deg,rgba(201,168,76,0.14),rgba(201,168,76,0.05));border:1.5px solid rgba(201,168,76,0.45);border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;"><div><div style="font-size:12px;font-weight:900;color:var(--gold);margin-bottom:3px;">🔥 진행 중인 재판</div><div style="font-size:13px;color:var(--cream);font-weight:800;">${escHtml(stored.topicTitle || '사건')} · ${roleLabel}</div></div><a href="#/debate/${stored.sessionId}" style="flex-shrink:0;padding:9px 16px;border-radius:10px;background:var(--gold);color:#0d1117;font-size:13px;font-weight:900;text-decoration:none;">이어하기 →</a></div>`;
  } catch {}
}

function injectLobbyStyle() {
  if (document.getElementById('game-lobby-style')) return;
  const style = document.createElement('style');
  style.id = 'game-lobby-style';
  style.textContent = `
    .courthouse-hero { position:relative; min-height:100vh; padding:18px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.24), transparent 52%), linear-gradient(180deg,#09101d 0%, #162036 52%, #0d1117 100%); }
    [data-theme="light"] .courthouse-hero { background:radial-gradient(ellipse at 50% 0%, rgba(232,96,44,.18), transparent 54%), linear-gradient(180deg,#fff7ef 0%, #ead6c2 58%, #fff8f2 100%); }
    .court-sky-light { position:absolute; left:50%; top:-160px; width:520px; height:360px; transform:translateX(-50%); background:radial-gradient(circle, rgba(255,232,179,.32), transparent 68%); animation:courtGlow 4s ease-in-out infinite alternate; pointer-events:none; }
    .court-building { position:relative; z-index:2; width:100%; max-width:760px; display:flex; flex-direction:column; gap:15px; }
    .court-topbar { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .court-kicker { font-size:10px; font-weight:900; letter-spacing:.14em; color:var(--gold); }
    .court-logo { margin-top:4px; font-family:var(--font-serif); font-size:21px; font-weight:900; color:var(--cream); }
    .court-help-btn { border:1px solid rgba(201,168,76,.35); background:rgba(201,168,76,.09); color:var(--gold); border-radius:999px; padding:8px 12px; font-size:12px; font-weight:900; cursor:pointer; }
    .court-facade { position:relative; height:390px; border-radius:28px; overflow:hidden; border:1.5px solid rgba(201,168,76,.4); background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.025)); box-shadow:0 24px 62px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08); }
    [data-theme="light"] .court-facade { background:rgba(255,255,255,.66); box-shadow:0 16px 42px rgba(154,112,24,.16); }
    .court-roof { position:absolute; left:50%; top:18px; transform:translateX(-50%); width:82%; height:82px; clip-path:polygon(50% 0, 100% 100%, 0 100%); background:linear-gradient(180deg, rgba(188,143,76,.82), rgba(103,64,34,.92)); border-bottom:3px solid rgba(255,231,178,.22); display:flex; align-items:center; justify-content:flex-end; flex-direction:column; padding-bottom:9px; color:var(--cream); text-align:center; }
    .court-roof span { font-size:25px; line-height:1; } .court-roof strong { font-family:var(--font-serif); font-size:17px; font-weight:900; } .court-roof small { font-size:9px; color:rgba(255,238,202,.78); font-weight:900; letter-spacing:.12em; }
    .court-columns { position:absolute; left:10%; right:10%; top:94px; bottom:86px; display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    .court-columns i { position:relative; border-radius:10px 10px 4px 4px; background:linear-gradient(90deg, rgba(255,244,218,.12), rgba(126,83,46,.45), rgba(255,244,218,.12)); border:1px solid rgba(255,231,178,.16); box-shadow:inset 0 1px 0 rgba(255,255,255,.13); }
    .court-columns i:before, .court-columns i:after { content:''; position:absolute; left:-5px; right:-5px; height:12px; border-radius:5px; background:rgba(82,49,28,.72); border:1px solid rgba(255,231,178,.12); }
    .court-columns i:before { top:-8px; } .court-columns i:after { bottom:-8px; }
    .court-entrance { position:absolute; left:0; right:0; bottom:74px; top:110px; z-index:3; }
    .court-door { position:absolute; left:50%; bottom:0; transform:translateX(-50%); width:132px; height:178px; border-radius:16px 16px 4px 4px; background:linear-gradient(90deg, #3f2416, #6f4328 48%, #3f2416 52%, #6f4328); border:2px solid rgba(255,231,178,.22); box-shadow:0 14px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.12); cursor:pointer; transition:transform .18s ease, filter .18s ease; }
    .court-door:hover { transform:translateX(-50%) translateY(-3px); filter:brightness(1.1); }
    .door-sign { position:absolute; top:18px; left:16px; right:16px; padding:7px 4px; border-radius:999px; background:rgba(201,168,76,.16); border:1px solid rgba(201,168,76,.32); color:var(--gold); font-size:11px; font-weight:900; text-align:center; }
    .door-line { position:absolute; left:50%; top:0; bottom:0; width:2px; background:rgba(0,0,0,.25); }
    .door-knob-left, .door-knob-right { position:absolute; top:94px; width:9px; height:9px; border-radius:50%; background:var(--gold); box-shadow:0 0 10px rgba(201,168,76,.55); }
    .door-knob-left { left:55px; } .door-knob-right { right:55px; }
    .court-clerk-window, .court-notice-board { position:absolute; bottom:20px; width:134px; padding:13px 12px; border-radius:16px; border:1.5px solid rgba(201,168,76,.28); background:rgba(0,0,0,.26); box-shadow:0 10px 28px rgba(0,0,0,.22); cursor:pointer; transition:transform .18s ease, border-color .18s ease; }
    [data-theme="light"] .court-clerk-window, [data-theme="light"] .court-notice-board { background:rgba(255,255,255,.82); }
    .court-clerk-window:hover, .court-notice-board:hover { transform:translateY(-3px); border-color:var(--gold); }
    .court-clerk-window { left:18px; } .court-notice-board { right:18px; }
    .clerk-avatar, .notice-pin { font-size:27px; margin-bottom:5px; } .clerk-title, .notice-title { color:var(--cream); font-size:12px; font-weight:900; line-height:1.35; } .clerk-sub, .notice-sub { margin-top:4px; color:var(--cream-dim); font-size:10px; line-height:1.4; }
    .court-stairs { position:absolute; left:6%; right:6%; bottom:18px; height:56px; display:flex; flex-direction:column; justify-content:flex-end; gap:5px; }
    .court-stairs b { display:block; height:13px; border-radius:5px; background:linear-gradient(180deg, rgba(175,119,68,.54), rgba(88,55,33,.72)); border:1px solid rgba(255,231,178,.12); box-shadow:0 6px 14px rgba(0,0,0,.18); }
    .court-stairs b:nth-child(1) { margin:0 19%; } .court-stairs b:nth-child(2) { margin:0 12%; } .court-stairs b:nth-child(3) { margin:0 5%; }
    .court-copy { text-align:center; max-width:680px; margin:0 auto; }
    .court-copy h1 { font-family:var(--font-serif); font-size:clamp(30px,8vw,54px); color:var(--cream); font-weight:900; line-height:1.13; letter-spacing:-.04em; margin:0; } .court-copy h1 span { color:var(--gold); }
    .court-copy p { margin:12px 0 0; color:var(--cream-dim); font-size:15px; line-height:1.7; }
    .court-actions { display:grid; grid-template-columns:1.4fr .9fr; gap:10px; width:100%; max-width:430px; margin:0 auto; }
    .court-primary-btn, .court-secondary-btn { border:none; border-radius:16px; padding:16px 14px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,.24); }
    .court-primary-btn { background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; } .court-secondary-btn { background:rgba(255,255,255,.07); color:var(--cream); border:1px solid rgba(201,168,76,.28); }
    [data-theme="light"] .court-secondary-btn { background:rgba(255,255,255,.75); color:#2A1F14; }
    .court-service-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; width:100%; max-width:470px; margin:0 auto; }
    .court-service-card { padding:10px 8px; border-radius:14px; border:1px solid rgba(201,168,76,.18); background:rgba(255,255,255,.045); text-align:center; }
    [data-theme="light"] .court-service-card { background:rgba(255,255,255,.62); }
    .court-service-card span { display:block; font-size:22px; margin-bottom:2px; } .court-service-card strong { display:block; font-size:12px; color:var(--cream); } .court-service-card small { display:block; font-size:10px; color:var(--cream-dim); }
    .court-legal-note { text-align:center; font-size:11px; color:var(--cream-dim); }
    .home-section-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:13px; }
    .home-section-kicker { color:var(--gold); font-size:10px; font-weight:900; letter-spacing:.12em; margin-bottom:3px; }
    .home-section-head h2 { margin:0; color:var(--cream); font-size:18px; font-family:var(--font-serif); }
    .home-section-head a { color:var(--gold); font-size:12px; font-weight:900; text-decoration:none; }
    .home-story-grid { display:grid; grid-template-columns:1fr; gap:12px; }
    .home-story-card, .home-compact-case { animation:homeCardIn .35s ease both; }
    .home-story-card { padding:16px; border-radius:20px; border:1.5px solid rgba(201,168,76,.32); background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025)); box-shadow:0 10px 24px rgba(0,0,0,.17); }
    [data-theme="light"] .home-story-card { background:rgba(255,255,255,.82); box-shadow:0 8px 20px rgba(154,112,24,.1); }
    .home-story-top { display:flex; align-items:center; gap:8px; margin-bottom:9px; color:var(--gold); font-size:11px; font-weight:900; }
    .home-story-top span { font-size:23px; }
    .home-story-card h3 { margin:0 0 5px; color:var(--cream); font-size:18px; line-height:1.35; font-family:var(--font-serif); }
    .home-story-card p { margin:0 0 10px; color:var(--cream-dim); font-size:13px; line-height:1.55; }
    .home-story-hook, .home-story-twist { padding:9px 10px; border-radius:12px; background:rgba(255,255,255,.035); border:1px solid rgba(201,168,76,.16); margin-top:7px; }
    [data-theme="light"] .home-story-hook, [data-theme="light"] .home-story-twist { background:rgba(154,112,24,.055); }
    .home-story-twist { border-color:rgba(231,76,60,.18); }
    .home-story-hook b, .home-story-twist b { display:block; color:var(--gold); font-size:10px; margin-bottom:3px; }
    .home-story-twist b { color:#e67e22; }
    .home-story-hook span, .home-story-twist span { display:block; color:var(--cream-dim); font-size:11px; line-height:1.5; }
    .home-story-card button { width:100%; margin-top:12px; border:0; border-radius:13px; padding:12px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; font-size:13px; font-weight:900; cursor:pointer; }
    .home-popular-list { display:grid; gap:8px; }
    .home-compact-case { width:100%; display:flex; align-items:center; gap:11px; text-align:left; border:1px solid rgba(201,168,76,.22); border-radius:15px; padding:12px; background:rgba(255,255,255,.04); cursor:pointer; }
    [data-theme="light"] .home-compact-case { background:rgba(255,255,255,.74); }
    .home-compact-icon { width:38px; height:38px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:12px; background:rgba(201,168,76,.1); font-size:22px; }
    .home-compact-body { flex:1; min-width:0; }
    .home-compact-body b { display:block; color:var(--cream); font-size:13px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .home-compact-body small { display:block; color:var(--cream-dim); font-size:11px; margin-top:2px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .home-compact-case i { color:var(--gold); font-size:11px; font-style:normal; font-weight:900; }
    @keyframes courtGlow { from { opacity:.5; transform:translateX(-50%) scale(.95); } to { opacity:1; transform:translateX(-50%) scale(1.05); } }
    @keyframes homeCardIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @media (min-width:760px) { .home-story-grid { grid-template-columns:repeat(3,1fr); } }
    @media (max-width:520px) { .courthouse-hero { padding:14px; align-items:flex-start; } .court-building { padding-top:6px; gap:13px; } .court-facade { height:350px; border-radius:24px; } .court-roof { width:88%; height:72px; } .court-roof strong { font-size:15px; } .court-columns { left:8%; right:8%; top:84px; bottom:78px; gap:8px; } .court-door { width:108px; height:150px; } .door-knob-left { left:43px; } .door-knob-right { right:43px; } .court-clerk-window, .court-notice-board { width:104px; padding:10px; bottom:18px; } .court-clerk-window { left:10px; } .court-notice-board { right:10px; } .clerk-sub, .notice-sub { display:none; } .court-copy p { font-size:13px; } .court-actions { grid-template-columns:1fr; max-width:320px; } .court-service-row { max-width:340px; } .court-service-card { padding:8px 4px; } .court-service-card strong { font-size:11px; } }
  `;
  document.head.appendChild(style);
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
function escAttr(s) { return escHtml(s); }
