import { db, auth, functions, trackEvent } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

export async function renderTopicDetail(container, topicId) {
  injectWaitingRoomStyle();
  try { localStorage.setItem('sosoking_game_mode', 'court'); } catch {}

  container.innerHTML = `
    <div class="waiting-room-page">
      <div class="waiting-room-header">
        <a href="#/topics" class="waiting-back-btn">‹</a>
        <div>
          <div class="waiting-header-kicker">COURTROOM ENTRY</div>
          <div class="waiting-header-title">⚖️ 재판 대기실</div>
        </div>
        <button class="waiting-mini-btn" onclick="location.hash='#/topics'">사건판</button>
      </div>
      <div class="container waiting-container">
        <div class="waiting-loading"><div>⚖️</div><strong>재판 대기실 준비 중...</strong><span>사건 기록을 불러오고 있습니다</span></div>
      </div>
    </div>
  `;

  let topic;
  try {
    const snap = await getDoc(doc(db, 'topics', topicId));
    if (!snap.exists() || snap.data().status !== 'active') {
      container.querySelector('.waiting-container').innerHTML = `<div class="waiting-empty"><div>⚠️</div><strong>사건을 찾을 수 없습니다</strong><button onclick="location.hash='#/topics'">사건판으로</button></div>`;
      return;
    }
    topic = { id: snap.id, ...snap.data() };
  } catch {
    showToast('사건을 불러오지 못했습니다', 'error');
    return;
  }

  let hasRandomOpponent = false;
  let aiModeEnabled = false;
  try {
    const [queueSnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'random_queue', topicId)),
      getDoc(doc(db, 'site_settings', 'config')),
    ]);
    hasRandomOpponent = queueSnap.exists() && queueSnap.data().userId !== auth.currentUser?.uid;
    aiModeEnabled = settingsSnap.exists() ? (settingsSnap.data().aiModeEnabled ?? false) : false;
  } catch {}

  const inner = container.querySelector('.waiting-container');
  inner.innerHTML = `
    <section class="case-waiting-stage">
      <div class="waiting-glow"></div>
      <div class="waiting-judge">
        <div class="waiting-nameplate">담당 AI 판사</div>
        <div class="waiting-avatar judge">👨‍⚖️</div>
        <div class="waiting-speech">입장을 선택하고 재판장 문을 여세요.</div>
      </div>
      <div class="waiting-side-preview plaintiff">
        <div class="waiting-desk red"></div>
        <div class="waiting-avatar player red">🙋</div>
        <div class="waiting-role red">원고석</div>
      </div>
      <div class="waiting-side-preview defendant">
        <div class="waiting-desk blue"></div>
        <div class="waiting-avatar player blue">🛡️</div>
        <div class="waiting-role blue">피고석</div>
      </div>
      <div class="waiting-door">
        <div class="waiting-door-title">재판장</div>
        <div class="waiting-door-knob"></div>
      </div>
    </section>

    <section class="case-file-panel">
      <div class="case-file-top">
        <div class="case-file-icon">${caseIcon(topic.category)}</div>
        <div>
          <div class="case-file-kicker">${escHtml(topic.category || '생활 사건')}</div>
          <h2>${escHtml(topic.title)}</h2>
        </div>
      </div>
      <p>${escHtml(topic.summary || '')}</p>
      <div class="case-issue-board">
        <div class="case-issue-side red"><span>🔴 원고 주장</span><strong>${escHtml(topic.plaintiffPosition)}</strong></div>
        <div class="case-issue-side blue"><span>🔵 피고 주장</span><strong>${escHtml(topic.defendantPosition)}</strong></div>
      </div>
    </section>

    <section class="entry-section">
      <div class="entry-section-title">1. 내 캐릭터 위치 선택</div>
      <div class="character-choice-grid">
        <button class="character-choice" data-side="plaintiff">
          <div class="choice-spotlight red"></div>
          <div class="choice-avatar">🙋</div>
          <div class="choice-label red">원고로 입장</div>
          <div class="choice-desc">억울함을 먼저 변론합니다</div>
        </button>
        <button class="character-choice" data-side="defendant">
          <div class="choice-spotlight blue"></div>
          <div class="choice-avatar">🛡️</div>
          <div class="choice-label blue">피고로 입장</div>
          <div class="choice-desc">상대 주장을 재치 있게 반론합니다</div>
        </button>
      </div>
    </section>

    ${!hasRandomOpponent && aiModeEnabled ? `
      <div class="ai-fast-banner">
        <span>🤖</span>
        <div><strong>상대가 아직 없어요!</strong><small>AI 피고/원고와 바로 재판하거나 친구를 초대해보세요.</small></div>
      </div>` : ''}

    <section class="entry-section">
      <div class="entry-section-title">2. 재판장 입장 게이트</div>
      <div class="entry-gate-grid">
        <button class="entry-gate" data-mode="friend"><span>👫</span><strong>친구 게이트</strong><small>링크로 상대 초대</small></button>
        <button class="entry-gate" data-mode="random"><span>${hasRandomOpponent ? '🎲' : '⏳'}</span><strong>랜덤 게이트</strong><small>${hasRandomOpponent ? '대기자 있음 · 자동 매칭' : '대기자 없음 · 먼저 대기'}</small></button>
        ${aiModeEnabled ? `<button class="entry-gate${!hasRandomOpponent ? ' ai-highlight' : ''}" data-mode="ai"><span>🤖</span><strong>AI 게이트</strong><small>${!hasRandomOpponent ? '바로 시작 가능' : '소소봇과 즉시 시작'}</small></button>` : ''}
      </div>
    </section>

    <section class="entry-section compact">
      <div class="entry-section-title">3. 팀 인원</div>
      <div class="difficulty-grid">
        <button class="difficulty-btn active" data-team="1"><strong>1인</strong><small>1 vs 1</small></button>
        <button class="difficulty-btn" data-team="2"><strong>2인</strong><small>2 vs 2</small></button>
        <button class="difficulty-btn" data-team="3"><strong>3인</strong><small>3 vs 3</small></button>
      </div>
    </section>

    <section class="entry-section compact">
      <div class="entry-section-title">4. 변론 라운드</div>
      <div class="difficulty-grid">
        <button class="difficulty-btn" data-rounds="3"><strong>3</strong><small>빠른 판결</small></button>
        <button class="difficulty-btn active" data-rounds="5"><strong>5</strong><small>추천</small></button>
        <button class="difficulty-btn" data-rounds="7"><strong>7</strong><small>끝장 변론</small></button>
      </div>
    </section>

    <div class="waiting-rule-card">
      <strong>⚠️ 생활법정 규칙</strong>
      <span>AI 판결은 실제 법률 판단이 아닙니다. 재치·공감·유머가 좋은 쪽이 유리합니다. 진지하면 질 수 있습니다.</span>
    </div>

    <button id="start-btn" class="court-enter-btn" disabled>입장과 게이트를 선택해주세요</button>
  `;

  let selectedSide = '';
  let selectedMode = '';
  let selectedRounds = 5;
  let selectedTeamSize = 1;

  inner.querySelectorAll('.character-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('.character-choice').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSide = btn.dataset.side;
      updateStageSide(selectedSide);
      updateStartBtn();
    });
  });

  inner.querySelectorAll('.entry-gate').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('.entry-gate').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMode = btn.dataset.mode;
      updateStartBtn();
    });
  });

  inner.querySelectorAll('[data-team]').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('[data-team]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTeamSize = Number(btn.dataset.team);
    });
  });

  inner.querySelectorAll('[data-rounds]').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('[data-rounds]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRounds = Number(btn.dataset.rounds);
    });
  });

  function updateStageSide(side) {
    inner.querySelector('.waiting-side-preview.plaintiff')?.classList.toggle('selected', side === 'plaintiff');
    inner.querySelector('.waiting-side-preview.defendant')?.classList.toggle('selected', side === 'defendant');
  }

  function updateStartBtn() {
    const btn = document.getElementById('start-btn');
    if (!btn) return;
    if (selectedSide && selectedMode) {
      btn.disabled = false;
      btn.textContent = '🚪 재판장 문 열기';
    } else {
      btn.disabled = true;
      btn.textContent = '입장과 게이트를 선택해주세요';
    }
  }

  document.getElementById('start-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    btn.textContent = '재판장 입장 중...';

    try {
      trackEvent('session_start', { mode: selectedMode, side: selectedSide, rounds: selectedRounds, team_size: selectedTeamSize, topic_id: topicId, court_mode: true });
      if (selectedMode === 'random') {
        await handleRandomMatch(topicId, selectedSide, selectedRounds, selectedTeamSize);
      } else if (selectedMode === 'ai') {
        const createSessionFn = httpsCallable(functions, 'createSession');
        const res = await createSessionFn({ topicId, side: selectedSide, mode: 'ai', maxRounds: selectedRounds, courtMode: true });
        location.hash = `#/debate/${res.data.sessionId}`;
      } else {
        const createSessionFn = httpsCallable(functions, 'createSession');
        const res = await createSessionFn({ topicId, side: selectedSide, mode: 'friend', maxRounds: selectedRounds, teamSize: selectedTeamSize, courtMode: true });
        if (selectedTeamSize > 1) {
          showTeamInviteScreen(inner, res.data.sessionId, selectedSide, selectedTeamSize, res.data.shareToken);
        } else {
          location.hash = `#/debate/${res.data.sessionId}`;
        }
      }
    } catch (err) {
      showToast(err.message || '오류가 발생했습니다', 'error');
      btn.disabled = false;
      btn.textContent = '🚪 재판장 문 열기';
    }
  });
}

async function handleRandomMatch(topicId, side, maxRounds, teamSize) {
  const queueSnap = await getDoc(doc(db, 'random_queue', topicId));

  if (queueSnap.exists() && queueSnap.data().userId !== auth.currentUser?.uid) {
    const joinSessionFn = httpsCallable(functions, 'joinSession');
    const res = await joinSessionFn({ topicId });
    location.hash = `#/debate/${res.data.sessionId}`;
  } else {
    const createSessionFn = httpsCallable(functions, 'createSession');
    const res = await createSessionFn({ topicId, side, mode: 'random', maxRounds, teamSize: teamSize || 1, courtMode: true });
    location.hash = `#/debate/${res.data.sessionId}`;
  }
}

function showTeamInviteScreen(container, sessionId, mySide, teamSize, shareToken) {
  const teamInviteLink = `${location.origin}/#/join-team/${sessionId}/${mySide}`;
  const opponentInviteLink = shareToken ? `${location.origin}/#/join/${shareToken}` : null;
  const sideLabel = mySide === 'plaintiff' ? '🔴 원고' : '🔵 피고';

  container.innerHTML = `
    <div class="team-room-complete">
      <div class="team-room-icon">🤝</div>
      <h2>팀 재판 대기실 생성 완료!</h2>
      <p>팀원을 초대하거나 바로 재판장으로 이동하세요.</p>
    </div>

    <div class="invite-card">
      <div class="invite-label">${sideLabel} 팀원 초대 (최대 ${teamSize}명)</div>
      <div class="invite-link">${teamInviteLink}</div>
      <button id="copy-team-link">👥 팀원 초대 링크 복사</button>
    </div>

    ${opponentInviteLink ? `
    <div class="invite-card secondary">
      <div class="invite-label">상대편 초대 링크</div>
      <button id="copy-opp-link">🔗 상대방 초대 링크 복사</button>
    </div>
    ` : ''}

    <a href="#/debate/${sessionId}" class="court-enter-btn link-style">⚖️ 재판장으로 이동</a>
  `;

  container.querySelector('#copy-team-link')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(teamInviteLink);
      showToast('팀원 초대 링크가 복사됐습니다!', 'success');
    } catch { showToast('링크를 직접 복사해주세요', 'info'); }
  });

  container.querySelector('#copy-opp-link')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(opponentInviteLink);
      showToast('상대방 초대 링크가 복사됐습니다!', 'success');
    } catch { showToast('링크를 직접 복사해주세요', 'info'); }
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
  return '📁';
}

function injectWaitingRoomStyle() {
  if (document.getElementById('waiting-room-style')) return;
  const style = document.createElement('style');
  style.id = 'waiting-room-style';
  style.textContent = `
    .waiting-room-page { min-height:100vh; background:radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.16), transparent 50%), var(--navy); }
    .waiting-room-header { position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; background:rgba(13,17,23,.94); border-bottom:1px solid var(--border); backdrop-filter:blur(12px); }
    [data-theme="light"] .waiting-room-header { background:rgba(255,248,242,.96); }
    .waiting-back-btn { color:var(--cream-dim); font-size:28px; text-decoration:none; line-height:1; }
    .waiting-header-kicker { font-size:9px; font-weight:900; letter-spacing:.14em; color:var(--gold); text-align:center; }
    .waiting-header-title { font-family:var(--font-serif); font-size:17px; color:var(--cream); font-weight:900; }
    .waiting-mini-btn { border:1px solid rgba(201,168,76,.32); background:rgba(201,168,76,.08); color:var(--gold); border-radius:999px; padding:8px 11px; font-size:12px; font-weight:900; cursor:pointer; }
    .waiting-container { padding-top:16px; padding-bottom:84px; }
    .waiting-loading, .waiting-empty { min-height:220px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:8px; color:var(--cream); }
    .waiting-loading div, .waiting-empty div { font-size:48px; animation:waitingBob .9s ease-in-out infinite alternate; } .waiting-loading span, .waiting-empty span { color:var(--cream-dim); font-size:13px; }
    .waiting-empty button { margin-top:14px; border:none; border-radius:12px; background:var(--gold); color:#0d1117; padding:11px 16px; font-weight:900; }
    .case-waiting-stage { position:relative; overflow:hidden; height:300px; margin-bottom:14px; border-radius:24px; border:1.5px solid rgba(201,168,76,.35); background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); box-shadow:0 16px 42px rgba(0,0,0,.3); }
    [data-theme="light"] .case-waiting-stage { background:rgba(255,255,255,.68); box-shadow:0 12px 30px rgba(154,112,24,.14); }
    .case-waiting-stage:before { content:''; position:absolute; left:8%; right:8%; bottom:0; height:44%; background:linear-gradient(180deg, rgba(201,168,76,.12), rgba(201,168,76,.04)); clip-path:polygon(12% 0,88% 0,100% 100%,0 100%); }
    .waiting-glow { position:absolute; inset:-110px -50px auto; height:200px; background:radial-gradient(circle, rgba(201,168,76,.34), transparent 68%); animation:waitingGlow 4s ease-in-out infinite alternate; }
    .waiting-judge { position:absolute; left:50%; top:18px; transform:translateX(-50%); width:170px; text-align:center; z-index:3; }
    .waiting-nameplate { display:inline-flex; padding:3px 10px; border-radius:999px; background:rgba(201,168,76,.12); color:var(--gold); font-size:10px; font-weight:900; margin-bottom:6px; }
    .waiting-avatar { display:flex; align-items:center; justify-content:center; border-radius:50%; margin:0 auto; border:2px solid rgba(201,168,76,.48); background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04)); box-shadow:0 10px 30px rgba(0,0,0,.28); }
    .waiting-avatar.judge { width:74px; height:74px; font-size:40px; animation:waitingJudge 1.1s ease-in-out infinite alternate; }
    .waiting-speech { margin-top:8px; padding:8px 10px; border-radius:14px; background:rgba(0,0,0,.2); border:1px solid rgba(201,168,76,.2); color:var(--cream); font-size:11px; line-height:1.45; }
    [data-theme="light"] .waiting-speech { background:rgba(255,255,255,.82); }
    .waiting-side-preview { position:absolute; bottom:22px; text-align:center; z-index:4; transition:transform .2s ease, filter .2s ease; }
    .waiting-side-preview.selected { transform:translateY(-8px) scale(1.04); filter:drop-shadow(0 0 16px rgba(201,168,76,.35)); }
    .waiting-side-preview.plaintiff { left:28px; } .waiting-side-preview.defendant { right:28px; }
    .waiting-desk { width:88px; height:23px; margin:0 auto -9px; border-radius:12px 12px 4px 4px; }
    .waiting-desk.red { background:linear-gradient(135deg, rgba(231,76,60,.5), rgba(231,76,60,.16)); border:1px solid rgba(231,76,60,.4); } .waiting-desk.blue { background:linear-gradient(135deg, rgba(52,152,219,.52), rgba(52,152,219,.16)); border:1px solid rgba(52,152,219,.4); }
    .waiting-avatar.player { width:68px; height:68px; font-size:36px; }
    .waiting-avatar.red { border-color:rgba(231,76,60,.68); background:linear-gradient(135deg, rgba(231,76,60,.28), rgba(231,76,60,.06)); } .waiting-avatar.blue { border-color:rgba(52,152,219,.68); background:linear-gradient(135deg, rgba(52,152,219,.28), rgba(52,152,219,.06)); }
    .waiting-role { margin-top:6px; font-size:12px; font-weight:900; } .waiting-role.red { color:#ff7b74; } .waiting-role.blue { color:#6fb8ff; }
    .waiting-door { position:absolute; left:50%; bottom:24px; transform:translateX(-50%); width:76px; height:112px; border-radius:12px 12px 4px 4px; border:2px solid rgba(201,168,76,.3); background:linear-gradient(180deg, rgba(201,168,76,.18), rgba(201,168,76,.05)); display:flex; align-items:center; justify-content:flex-start; flex-direction:column; padding-top:12px; color:var(--gold); font-size:11px; font-weight:900; }
    .waiting-door-knob { position:absolute; right:10px; top:56px; width:9px; height:9px; border-radius:50%; background:var(--gold); box-shadow:0 0 10px rgba(201,168,76,.65); }
    .case-file-panel, .entry-section, .waiting-rule-card, .invite-card { border:1.5px solid rgba(201,168,76,.24); border-radius:18px; background:linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); padding:16px; margin-bottom:14px; box-shadow:0 8px 24px rgba(0,0,0,.18); }
    [data-theme="light"] .case-file-panel, [data-theme="light"] .entry-section, [data-theme="light"] .waiting-rule-card, [data-theme="light"] .invite-card { background:rgba(255,255,255,.82); box-shadow:0 8px 22px rgba(154,112,24,.1); }
    .case-file-top { display:flex; gap:12px; align-items:flex-start; } .case-file-icon { width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:24px; background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.22); flex-shrink:0; }
    .case-file-kicker { font-size:11px; font-weight:900; color:var(--gold); letter-spacing:.06em; } .case-file-panel h2 { margin:3px 0 0; font-family:var(--font-serif); font-size:20px; line-height:1.35; color:var(--cream); } .case-file-panel p { margin:12px 0 0; color:var(--cream-dim); line-height:1.65; font-size:14px; }
    .case-issue-board { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:14px; } .case-issue-side { border-radius:13px; padding:11px; } .case-issue-side.red { background:rgba(231,76,60,.08); border:1px solid rgba(231,76,60,.22); } .case-issue-side.blue { background:rgba(52,152,219,.08); border:1px solid rgba(52,152,219,.22); }
    .case-issue-side span { display:block; font-size:11px; font-weight:900; margin-bottom:5px; } .case-issue-side.red span { color:#e74c3c; } .case-issue-side.blue span { color:#3498db; } .case-issue-side strong { display:block; color:var(--cream); font-size:13px; line-height:1.5; }
    .entry-section-title { font-size:11px; font-weight:900; color:var(--gold); letter-spacing:.08em; margin-bottom:12px; }
    .character-choice-grid, .entry-gate-grid, .difficulty-grid { display:grid; gap:10px; }
    .character-choice-grid { grid-template-columns:1fr 1fr; } .entry-gate-grid { grid-template-columns:repeat(3,1fr); } .difficulty-grid { grid-template-columns:repeat(3,1fr); }
    .character-choice, .entry-gate, .difficulty-btn { position:relative; overflow:hidden; border:1.5px solid rgba(201,168,76,.2); background:rgba(255,255,255,.04); color:var(--cream); border-radius:16px; padding:14px 10px; cursor:pointer; text-align:center; transition:transform .18s ease, border-color .18s ease, background .18s ease; }
    [data-theme="light"] .character-choice, [data-theme="light"] .entry-gate, [data-theme="light"] .difficulty-btn { background:rgba(255,255,255,.72); }
    .character-choice.active, .entry-gate.active, .difficulty-btn.active { border-color:var(--gold); background:rgba(201,168,76,.12); transform:translateY(-2px); box-shadow:0 0 0 2px rgba(201,168,76,.14); }
    .choice-spotlight { position:absolute; inset:auto 18% -28px; height:70px; border-radius:50%; filter:blur(10px); opacity:.55; } .choice-spotlight.red { background:rgba(231,76,60,.28); } .choice-spotlight.blue { background:rgba(52,152,219,.28); }
    .choice-avatar { position:relative; font-size:42px; margin-bottom:6px; } .choice-label { font-size:14px; font-weight:900; } .choice-label.red { color:#ff7b74; } .choice-label.blue { color:#6fb8ff; } .choice-desc { margin-top:4px; color:var(--cream-dim); font-size:11px; line-height:1.4; }
    .entry-gate span { display:block; font-size:28px; margin-bottom:5px; } .entry-gate strong, .difficulty-btn strong { display:block; font-size:13px; font-weight:900; } .entry-gate small, .difficulty-btn small { display:block; margin-top:3px; color:var(--cream-dim); font-size:10px; line-height:1.35; }
    .entry-gate.ai-highlight { animation:aiPulse 1.1s ease-in-out infinite alternate; }
    .difficulty-btn { padding:12px 8px; }
    .ai-fast-banner { display:flex; align-items:center; gap:12px; padding:14px 16px; margin-bottom:14px; border-radius:16px; border:1.5px solid rgba(232,96,44,.3); background:linear-gradient(135deg,rgba(232,96,44,.1),rgba(255,138,90,.06)); } .ai-fast-banner span { font-size:30px; } .ai-fast-banner strong { display:block; color:var(--gold); font-size:13px; } .ai-fast-banner small { display:block; margin-top:3px; color:var(--cream-dim); line-height:1.5; }
    .waiting-rule-card strong { display:block; color:var(--gold); font-size:12px; margin-bottom:6px; } .waiting-rule-card span { display:block; color:var(--cream-dim); font-size:13px; line-height:1.6; }
    .court-enter-btn { width:100%; border:none; border-radius:17px; padding:17px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; font-size:16px; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(201,168,76,.24); text-align:center; text-decoration:none; display:block; } .court-enter-btn:disabled { opacity:.45; cursor:not-allowed; box-shadow:none; }
    .team-room-complete { text-align:center; padding:38px 0 18px; } .team-room-icon { font-size:64px; margin-bottom:14px; } .team-room-complete h2 { font-family:var(--font-serif); font-size:22px; color:var(--gold); } .team-room-complete p { margin-top:8px; color:var(--cream-dim); line-height:1.7; }
    .invite-label { font-size:11px; font-weight:900; color:var(--gold); letter-spacing:.08em; margin-bottom:10px; } .invite-link { background:rgba(255,255,255,.04); border:1.5px dashed var(--border); border-radius:10px; padding:12px; word-break:break-all; font-size:12px; color:var(--cream-dim); font-family:monospace; margin-bottom:10px; } .invite-card button { width:100%; border:1.5px solid rgba(201,168,76,.34); border-radius:13px; padding:12px; background:rgba(201,168,76,.08); color:var(--gold); font-weight:900; }
    @keyframes waitingGlow { from { opacity:.45; transform:scale(.95); } to { opacity:1; transform:scale(1.05); } } @keyframes waitingJudge { from { transform:translateY(0) rotate(-1deg); } to { transform:translateY(-4px) rotate(1deg); } } @keyframes waitingBob { from { transform:translateY(0); } to { transform:translateY(-6px); } } @keyframes aiPulse { from { box-shadow:0 0 0 0 rgba(232,96,44,.12); } to { box-shadow:0 0 0 4px rgba(232,96,44,.16); } }
    @media (max-width:430px) { .case-waiting-stage { height:280px; } .waiting-side-preview.plaintiff { left:14px; } .waiting-side-preview.defendant { right:14px; } .waiting-avatar.player { width:58px; height:58px; font-size:31px; } .waiting-desk { width:72px; } .waiting-door { width:64px; height:98px; } .entry-gate-grid { grid-template-columns:1fr; } .case-issue-board { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
