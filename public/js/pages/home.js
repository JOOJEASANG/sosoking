import { db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const JUDGES = [
  ['👨‍⚖️', '엄벌주의형', '소소한 일도 중대 사건처럼 판결'],
  ['🥹', '감성형', '눈물과 공감으로 판결'],
  ['🤦', '현실주의형', '팩트로 쿨하게 판결'],
  ['🔥', '과몰입형', '인류사급 대사건으로 판결'],
  ['😴', '피곤형', '빨리 끝내고 싶은 판결'],
  ['🧮', '논리집착형', '점수와 확률로 판결'],
  ['🎭', '드립형', '진지한 척 웃기게 판결'],
];

export async function renderHome(container) {
  injectLobbyStyle();

  container.innerHTML = `
    <section class="game-lobby-hero">
      <div class="lobby-bg-glow"></div>
      <div class="lobby-floating audience-a">👥</div>
      <div class="lobby-floating audience-b">👀</div>
      <div class="lobby-floating audience-c">👏</div>

      <div class="lobby-top-ui">
        <div>
          <div class="lobby-kicker">SOSOKING VIRTUAL COURT</div>
          <div class="lobby-logo">⚖️ 소소킹 생활법정</div>
        </div>
        <button class="lobby-small-btn" onclick="location.hash='#/guide'">도움말</button>
      </div>

      <div class="lobby-stage-card">
        <div class="lobby-case-board" onclick="window._startCourtCase()">
          <div class="board-pin">📋</div>
          <div class="board-title">오늘의 사건 게시판</div>
          <div class="board-sub">억울한 사건을 고르고 법정에 입장하세요</div>
          <div class="board-action">사건 보러가기 →</div>
        </div>

        <div class="lobby-judge-area">
          <div class="lobby-nameplate">AI 판사석</div>
          <div class="lobby-avatar lobby-judge"><span>👨‍⚖️</span></div>
          <div class="lobby-judge-speech">진지하면 질 수 있습니다. 재치 있게 변론하세요.</div>
        </div>

        <div class="lobby-character lobby-plaintiff">
          <div class="lobby-desk red"></div>
          <div class="lobby-avatar player red"><span>🙋</span></div>
          <div class="lobby-role red">원고</div>
          <div class="lobby-role-sub">억울함을 변론</div>
        </div>

        <div class="lobby-character lobby-defendant">
          <div class="lobby-desk blue"></div>
          <div class="lobby-avatar player blue"><span>🛡️</span></div>
          <div class="lobby-role blue">피고</div>
          <div class="lobby-role-sub">재치 있게 반론</div>
        </div>

        <div class="lobby-host">
          <div class="lobby-avatar host"><span>🎙️</span></div>
          <div class="lobby-role">진행자</div>
        </div>

        <div class="lobby-floor-seal">⚖️</div>
      </div>

      <div class="lobby-copy">
        <h1>소소한 억울함,<br><span>가상 법정에서 판결받자</span></h1>
        <p>친구와 다툰 일, 애매한 상황, 사소한 논쟁까지<br>원고와 피고 캐릭터가 되어 웃기게 겨루는 AI 재판 게임</p>
      </div>

      <div class="lobby-actions">
        <button onclick="window._startCourtCase()" class="lobby-primary-btn">🏛️ 생활법정 입장하기</button>
        <button onclick="location.hash='#/submit-topic'" class="lobby-secondary-btn">✏️ 내 사건 등록</button>
      </div>

      <div class="lobby-mode-row">
        <div class="lobby-mode-card"><span>👫</span><strong>친구 재판</strong><small>링크 초대</small></div>
        <div class="lobby-mode-card"><span>🎲</span><strong>랜덤 재판</strong><small>즉석 매칭</small></div>
        <div class="lobby-mode-card"><span>🤖</span><strong>AI 재판</strong><small>소소봇 상대</small></div>
      </div>

      <p class="lobby-disclaimer">오락 목적 · 실제 법적 효력 없음 · 무료 · 익명 가능</p>
    </section>

    <div class="container" style="padding-top:28px;padding-bottom:80px;">
      <div id="active-session-banner"></div>
      <div id="today-section"></div>
      <div id="popular-section" style="margin-top:32px;"></div>

      <div style="margin-top:40px;">
        <div style="font-size:11px;font-weight:900;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">👨‍⚖️ 랜덤 AI 판사단</div>
        <div class="home-feature-grid">
          ${JUDGES.map(([icon, name, desc]) => `
            <div class="home-feature-item">
              <span class="home-feature-icon">${icon}</span>
              <div class="home-feature-label">${name}</div>
              <div class="home-feature-desc">${desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div style="margin-top:32px;">
        <div style="font-size:11px;font-weight:900;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">🎮 게임 진행 방식</div>
        <div class="home-feature-grid">
          <div class="home-feature-item"><span class="home-feature-icon">📋</span><div class="home-feature-label">사건 선택</div><div class="home-feature-desc">공감되는 생활 사건을 고릅니다</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">🙋</span><div class="home-feature-label">캐릭터 입장</div><div class="home-feature-desc">원고 또는 피고 역할을 선택합니다</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">💬</span><div class="home-feature-label">변론 진행</div><div class="home-feature-desc">말풍선처럼 변론과 반론을 주고받습니다</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">🏆</span><div class="home-feature-label">AI 판결</div><div class="home-feature-desc">판사가 점수·이유·미션을 선고합니다</div></div>
        </div>
      </div>

      <div style="margin-top:32px;">
        <button onclick="window._startCourtCase()" class="btn btn-primary" style="font-size:17px;padding:18px;">🔥 사건 게시판 입장</button>
        <a href="#/guide" class="btn btn-ghost" style="margin-top:10px;font-size:14px;">📖 이용 안내 보기</a>
      </div>

      <div style="margin-top:24px;padding-bottom:12px;">
        <div class="disclaimer" style="text-align:center;">
          소소킹 생활법정은 순수 오락 서비스입니다.<br>AI 판결에는 실제 법적 효력이 없으며, 재미로만 이용해주세요.
        </div>
      </div>
    </div>
  `;

  loadTodayCase();
  loadPopularTopics();
  checkActiveSessionBanner();
}

window._startCourtCase = () => {
  try { localStorage.setItem('sosoking_game_mode', 'court'); } catch {}
  location.hash = '#/topics';
};

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
  } catch { /* no cases yet */ }
}

function renderTodayCard(el, topicId, t) {
  el.innerHTML = `
    <div style="font-size:11px;font-weight:900;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">🌟 오늘의 사건</div>
    <div class="today-case-card" onclick="location.hash='#/topic/${encodeURIComponent(topicId)}'">
      <div class="today-label">📋 ${escHtml(t.category || '생활')} · 재판 ${(t.playCount||0).toLocaleString()}회</div>
      <div class="today-title">${escHtml(t.title)}</div>
      <div class="today-summary">${escHtml(t.summary)}</div>
      <div class="today-vs">
        <div class="today-pos" style="border-left:2px solid rgba(231,76,60,0.5);">
          <div class="today-pos-label">🔴 원고 입장</div>
          <div class="today-pos-text">${escHtml(t.plaintiffPosition)}</div>
        </div>
        <div class="today-pos" style="border-left:2px solid rgba(52,152,219,0.5);">
          <div class="today-pos-label">🔵 피고 입장</div>
          <div class="today-pos-text">${escHtml(t.defendantPosition)}</div>
        </div>
      </div>
      <div class="today-footer"><span style="color:var(--gold);font-weight:900;">탭해서 재판 시작 →</span></div>
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
      return `<div class="topic-card" onclick="location.hash='#/topic/${encodeURIComponent(d.id)}'" style="margin-bottom:8px;">
        <div class="topic-card-title">${escHtml(t.title)}</div>
        <div class="topic-card-summary">${escHtml(t.summary)}</div>
        <div class="topic-card-footer">
          <span class="topic-card-cat">${escHtml(t.category || '생활')}</span>
          <span>재판 ${(t.playCount||0).toLocaleString()}회</span>
          ${t.isOfficial ? '<span style="color:var(--gold);font-size:10px;font-weight:900;">공식</span>' : ''}
        </div>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div style="font-size:11px;font-weight:900;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">🔥 인기 사건</div>
      ${cards}
      <a href="#/topics" style="display:block;text-align:center;margin-top:12px;color:var(--gold);font-size:13px;font-weight:900;text-decoration:none;">전체 사건 보기 →</a>
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
    const roleLabel = stored.role === 'plaintiff' ? '🔴 원고' : '🔵 피고';
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(201,168,76,0.14),rgba(201,168,76,0.05));border:1.5px solid rgba(201,168,76,0.45);border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:12px;font-weight:900;color:var(--gold);margin-bottom:3px;">🔥 진행 중인 재판</div>
          <div style="font-size:13px;color:var(--cream);font-weight:800;">${escHtml(stored.topicTitle || '사건')} · ${roleLabel}</div>
        </div>
        <a href="#/debate/${stored.sessionId}" style="flex-shrink:0;padding:9px 16px;border-radius:10px;background:var(--gold);color:#0d1117;font-size:13px;font-weight:900;text-decoration:none;">이어하기 →</a>
      </div>
    `;
  } catch {}
}

function injectLobbyStyle() {
  if (document.getElementById('game-lobby-style')) return;
  const style = document.createElement('style');
  style.id = 'game-lobby-style';
  style.textContent = `
    .game-lobby-hero { position:relative; min-height:100vh; padding:18px 18px 28px; overflow:hidden; background:radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.24), transparent 54%), linear-gradient(180deg,#0b101a 0%, #11182b 50%, #0d1117 100%); display:flex; flex-direction:column; justify-content:center; gap:16px; }
    [data-theme="light"] .game-lobby-hero { background:radial-gradient(ellipse at 50% 0%, rgba(232,96,44,.22), transparent 55%), linear-gradient(180deg,#fff7ef 0%, #ffe7d6 65%, #fff8f2 100%); }
    .lobby-bg-glow { position:absolute; inset:-120px -80px auto; height:260px; background:radial-gradient(circle, rgba(201,168,76,.32), transparent 70%); animation:lobbyGlow 4s ease-in-out infinite alternate; pointer-events:none; }
    .lobby-floating { position:absolute; z-index:1; opacity:.35; font-size:34px; filter:blur(.1px); animation:lobbyFloat 3.2s ease-in-out infinite alternate; }
    .audience-a { left:14px; top:120px; } .audience-b { right:18px; top:150px; animation-delay:.7s; } .audience-c { right:34px; bottom:210px; animation-delay:1.2s; }
    .lobby-top-ui { position:relative; z-index:4; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; max-width:720px; width:100%; margin:0 auto; }
    .lobby-kicker { font-size:10px; font-weight:900; letter-spacing:.14em; color:var(--gold); }
    .lobby-logo { margin-top:4px; font-family:var(--font-serif); font-size:20px; font-weight:900; color:var(--cream); }
    .lobby-small-btn { border:1px solid rgba(201,168,76,.32); background:rgba(201,168,76,.08); color:var(--gold); border-radius:999px; padding:8px 12px; font-size:12px; font-weight:900; cursor:pointer; }
    .lobby-stage-card { position:relative; z-index:3; width:100%; max-width:720px; height:360px; margin:0 auto; border:1.5px solid rgba(201,168,76,.38); border-radius:26px; overflow:hidden; background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); box-shadow:0 22px 58px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.06); }
    [data-theme="light"] .lobby-stage-card { background:rgba(255,255,255,.64); box-shadow:0 16px 40px rgba(154,112,24,.16); }
    .lobby-stage-card:before { content:''; position:absolute; left:8%; right:8%; bottom:0; height:48%; background:linear-gradient(180deg, rgba(201,168,76,.12), rgba(201,168,76,.04)); clip-path:polygon(12% 0,88% 0,100% 100%,0 100%); border-radius:22px 22px 0 0; }
    .lobby-case-board { position:absolute; left:16px; top:18px; width:132px; padding:12px; border-radius:16px; border:1px solid rgba(201,168,76,.32); background:rgba(0,0,0,.22); z-index:5; cursor:pointer; transition:transform .18s ease, border-color .18s ease; }
    .lobby-case-board:hover { transform:translateY(-2px); border-color:var(--gold); }
    [data-theme="light"] .lobby-case-board { background:rgba(255,255,255,.8); }
    .board-pin { font-size:24px; margin-bottom:5px; } .board-title { font-size:12px; font-weight:900; color:var(--cream); line-height:1.3; } .board-sub { margin-top:4px; font-size:10px; color:var(--cream-dim); line-height:1.4; } .board-action { margin-top:8px; font-size:10px; font-weight:900; color:var(--gold); }
    .lobby-judge-area { position:absolute; left:50%; top:28px; transform:translateX(-50%); width:158px; text-align:center; z-index:4; }
    .lobby-nameplate { display:inline-flex; padding:3px 10px; border-radius:999px; background:rgba(201,168,76,.12); color:var(--gold); font-size:10px; font-weight:900; margin-bottom:7px; }
    .lobby-avatar { display:flex; align-items:center; justify-content:center; border-radius:50%; margin:0 auto; border:2px solid rgba(201,168,76,.48); background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04)); box-shadow:0 10px 30px rgba(0,0,0,.28); transform-origin:bottom center; }
    .lobby-avatar span { line-height:1; filter:drop-shadow(0 3px 8px rgba(0,0,0,.25)); }
    .lobby-judge { width:82px; height:82px; font-size:44px; animation:lobbyJudge 1.2s ease-in-out infinite alternate; }
    .lobby-judge-speech { position:relative; margin:10px auto 0; max-width:180px; padding:8px 10px; border-radius:14px; background:rgba(0,0,0,.22); border:1px solid rgba(201,168,76,.22); color:var(--cream); font-size:11px; line-height:1.45; }
    [data-theme="light"] .lobby-judge-speech { background:rgba(255,255,255,.82); }
    .lobby-character { position:absolute; z-index:4; text-align:center; bottom:30px; }
    .lobby-plaintiff { left:42px; } .lobby-defendant { right:42px; }
    .lobby-desk { width:96px; height:25px; margin:0 auto -10px; border-radius:13px 13px 4px 4px; box-shadow:0 8px 20px rgba(0,0,0,.2); }
    .lobby-desk.red { background:linear-gradient(135deg, rgba(231,76,60,.5), rgba(231,76,60,.16)); border:1px solid rgba(231,76,60,.4); }
    .lobby-desk.blue { background:linear-gradient(135deg, rgba(52,152,219,.52), rgba(52,152,219,.16)); border:1px solid rgba(52,152,219,.4); }
    .lobby-avatar.player { width:74px; height:74px; font-size:40px; animation:lobbyTalk 1.1s ease-in-out infinite alternate; }
    .lobby-avatar.player.blue { animation-delay:.45s; }
    .lobby-avatar.red { border-color:rgba(231,76,60,.68); background:linear-gradient(135deg, rgba(231,76,60,.28), rgba(231,76,60,.06)); }
    .lobby-avatar.blue { border-color:rgba(52,152,219,.68); background:linear-gradient(135deg, rgba(52,152,219,.28), rgba(52,152,219,.06)); }
    .lobby-role { margin-top:6px; font-size:12px; font-weight:900; color:var(--cream); } .lobby-role.red { color:#ff7b74; } .lobby-role.blue { color:#6fb8ff; }
    .lobby-role-sub { margin-top:1px; font-size:10px; color:var(--cream-dim); font-weight:700; }
    .lobby-host { position:absolute; left:50%; bottom:78px; transform:translateX(-50%); z-index:5; text-align:center; }
    .lobby-avatar.host { width:48px; height:48px; font-size:27px; opacity:.94; }
    .lobby-floor-seal { position:absolute; left:50%; bottom:26px; transform:translateX(-50%); width:82px; height:82px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:40px; opacity:.18; border:2px solid rgba(201,168,76,.38); }
    .lobby-copy { position:relative; z-index:4; text-align:center; max-width:680px; margin:0 auto; }
    .lobby-copy h1 { font-family:var(--font-serif); font-size:clamp(30px,8vw,52px); color:var(--cream); font-weight:900; line-height:1.15; letter-spacing:-.04em; margin:0; }
    .lobby-copy h1 span { color:var(--gold); }
    .lobby-copy p { margin:12px 0 0; color:var(--cream-dim); font-size:15px; line-height:1.7; }
    .lobby-actions { position:relative; z-index:4; display:grid; grid-template-columns:1.4fr .9fr; gap:10px; width:100%; max-width:420px; margin:0 auto; }
    .lobby-primary-btn, .lobby-secondary-btn { border:none; border-radius:16px; padding:16px 14px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,.24); }
    .lobby-primary-btn { background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; }
    .lobby-secondary-btn { background:rgba(255,255,255,.07); color:var(--cream); border:1px solid rgba(201,168,76,.28); }
    [data-theme="light"] .lobby-secondary-btn { background:rgba(255,255,255,.75); color:#2A1F14; }
    .lobby-mode-row { position:relative; z-index:4; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; width:100%; max-width:460px; margin:0 auto; }
    .lobby-mode-card { padding:10px 8px; border-radius:14px; border:1px solid rgba(201,168,76,.18); background:rgba(255,255,255,.045); text-align:center; }
    [data-theme="light"] .lobby-mode-card { background:rgba(255,255,255,.62); }
    .lobby-mode-card span { display:block; font-size:22px; margin-bottom:2px; } .lobby-mode-card strong { display:block; font-size:12px; color:var(--cream); } .lobby-mode-card small { display:block; font-size:10px; color:var(--cream-dim); }
    .lobby-disclaimer { position:relative; z-index:4; text-align:center; margin:0; font-size:11px; color:var(--cream-dim); }
    @keyframes lobbyGlow { from { opacity:.45; transform:scale(.95); } to { opacity:1; transform:scale(1.05); } }
    @keyframes lobbyFloat { from { transform:translateY(0); } to { transform:translateY(-12px); } }
    @keyframes lobbyJudge { from { transform:translateY(0) rotate(-1deg); } to { transform:translateY(-5px) rotate(1deg); } }
    @keyframes lobbyTalk { from { transform:translateY(0) scale(1); } to { transform:translateY(-6px) scale(1.03); } }
    @media (max-width:520px) { .game-lobby-hero { min-height:calc(100vh - 10px); padding:14px 14px 24px; gap:13px; } .lobby-stage-card { height:330px; border-radius:22px; } .lobby-case-board { width:108px; left:10px; top:12px; padding:10px; } .board-sub { display:none; } .lobby-judge-area { top:22px; } .lobby-judge { width:74px; height:74px; font-size:40px; } .lobby-judge-speech { max-width:158px; font-size:10.5px; } .lobby-plaintiff { left:18px; } .lobby-defendant { right:18px; } .lobby-avatar.player { width:64px; height:64px; font-size:34px; } .lobby-desk { width:78px; height:22px; } .lobby-host { bottom:72px; } .lobby-copy p { font-size:13px; } .lobby-actions { grid-template-columns:1fr; max-width:320px; } .lobby-mode-row { max-width:340px; } .lobby-mode-card { padding:8px 4px; } .lobby-mode-card strong { font-size:11px; } }
  `;
  document.head.appendChild(style);
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
