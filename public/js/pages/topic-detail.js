import { db, auth, functions, trackEvent } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

export async function renderTopicDetail(container, topicId) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/topics" class="back-btn">‹</a>
        <span class="logo">배틀 주제</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="loading-dots" style="padding:60px 0;"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;

  let topic;
  try {
    const snap = await getDoc(doc(db, 'topics', topicId));
    if (!snap.exists() || snap.data().status !== 'active') {
      container.querySelector('.container').innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><div class="empty-state-title">주제를 찾을 수 없습니다</div><a href="#/topics" class="btn btn-secondary" style="margin-top:20px;max-width:200px;display:flex;margin-left:auto;margin-right:auto;">목록으로</a></div>`;
      return;
    }
    topic = { id: snap.id, ...snap.data() };
  } catch {
    showToast('주제를 불러오지 못했습니다', 'error');
    return;
  }

  // 랜덤 대기자 확인 + AI 모드 활성화 여부
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

  const inner = container.querySelector('.container');
  inner.innerHTML = `
    <div class="card topic-detail-card" style="margin-bottom:20px;">
      <span class="topic-card-cat" style="margin-bottom:10px;display:inline-block;">${topic.category || '생활'}</span>
      <h2 style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--cream);margin-bottom:8px;line-height:1.4;">${topic.title}</h2>
      <p style="font-size:15px;color:var(--cream-dim);line-height:1.7;margin-bottom:18px;">${topic.summary}</p>
      <div class="vs-divider"><span class="vs-text">🔥 VS 🔥</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;">
        <div style="background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#e74c3c;margin-bottom:6px;">🔴 A팀 주장</div>
          <div style="font-size:14px;color:var(--cream);line-height:1.6;">${topic.plaintiffPosition}</div>
        </div>
        <div style="background:rgba(52,152,219,0.08);border:1px solid rgba(52,152,219,0.25);border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#3498db;margin-bottom:6px;">🔵 B팀 주장</div>
          <div style="font-size:14px;color:var(--cream);line-height:1.6;">${topic.defendantPosition}</div>
        </div>
      </div>
    </div>

    <!-- 배틀 모드 선택 -->
    <div class="form-group">
      <label class="form-label">배틀 형식</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <button id="mode-debate" class="battle-format-btn active" data-format="debate">
          <span style="font-size:20px;">⚔️</span>
          <div style="font-size:13px;font-weight:700;color:var(--gold);">토론 배틀</div>
          <div style="font-size:10px;color:var(--cream-dim);">A팀 vs B팀</div>
        </button>
        <button id="mode-court" class="battle-format-btn" data-format="court">
          <span style="font-size:20px;">🏛️</span>
          <div style="font-size:13px;font-weight:700;color:var(--gold);">법정 모드</div>
          <div style="font-size:10px;color:var(--cream-dim);">원고 vs 피고</div>
        </button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">내 입장 선택</label>
      <div class="side-grid">
        <button class="side-btn" data-side="plaintiff">
          <span class="side-btn-icon">⚔️</span>
          <div class="side-btn-label side-label-p">A팀 편들기</div>
        </button>
        <button class="side-btn" data-side="defendant">
          <span class="side-btn-icon">🛡️</span>
          <div class="side-btn-label side-label-d">B팀 편들기</div>
        </button>
      </div>
    </div>

    ${!hasRandomOpponent && aiModeEnabled ? `
    <div style="background:linear-gradient(135deg,rgba(232,96,44,0.08),rgba(255,138,90,0.06));border:1.5px solid rgba(232,96,44,0.3);border-radius:12px;padding:14px 16px;margin-top:20px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:28px;flex-shrink:0;">🤖</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:2px;">랜덤 대기자가 없어요!</div>
        <div style="font-size:12px;color:var(--cream-dim);line-height:1.5;">AI 소소봇과 바로 배틀하거나 친구를 초대해보세요</div>
      </div>
    </div>
    ` : ''}

    <div class="form-group" style="margin-top:20px;">
      <label class="form-label">대결 방식</label>
      <div class="mode-grid">
        <button class="mode-btn" data-mode="friend">
          <span class="mode-btn-icon">👫</span>
          <div class="mode-btn-label">친구와 대결</div>
          <div class="mode-btn-desc">카카오톡으로 초대</div>
        </button>
        <button class="mode-btn" data-mode="random">
          <span class="mode-btn-icon">${hasRandomOpponent ? '🎲' : '⏳'}</span>
          <div class="mode-btn-label">랜덤 매칭</div>
          <div class="mode-btn-desc">${hasRandomOpponent ? '대기자 있음 · 자동 매칭' : '대기자 없음 · 먼저 기다리기'}</div>
        </button>
        ${aiModeEnabled ? `<button class="mode-btn${!hasRandomOpponent ? ' mode-btn-ai-highlight' : ''}" data-mode="ai">
          <span class="mode-btn-icon">🤖</span>
          <div class="mode-btn-label">AI 소소봇</div>
          <div class="mode-btn-desc">${!hasRandomOpponent ? '👉 바로 시작 가능!' : '혼자서 즉시 시작'}</div>
        </button>` : ''}
      </div>
    </div>

    <div class="form-group" style="margin-top:20px;">
      <label class="form-label">팀 인원 <span style="font-size:10px;color:var(--cream-dim);font-weight:400;text-transform:none;letter-spacing:0;">(각 팀당)</span></label>
      <div class="rounds-grid">
        <button class="rounds-btn active" data-team="1">
          <span class="rounds-btn-num" style="font-size:20px;">1인</span>
          <div class="rounds-btn-label">혼자</div>
          <div class="rounds-btn-desc">1 vs 1</div>
        </button>
        <button class="rounds-btn" data-team="2">
          <span class="rounds-btn-num" style="font-size:20px;">2인</span>
          <div class="rounds-btn-label">2팀</div>
          <div class="rounds-btn-desc">2 vs 2</div>
        </button>
        <button class="rounds-btn" data-team="3">
          <span class="rounds-btn-num" style="font-size:20px;">3인</span>
          <div class="rounds-btn-label">3팀</div>
          <div class="rounds-btn-desc">3 vs 3</div>
        </button>
      </div>
    </div>

    <div class="form-group" style="margin-top:20px;">
      <label class="form-label">라운드 수</label>
      <div class="rounds-grid">
        <button class="rounds-btn" data-rounds="3">
          <span class="rounds-btn-num">3</span>
          <div class="rounds-btn-label">단판</div>
          <div class="rounds-btn-desc">빠른 결판</div>
        </button>
        <button class="rounds-btn active" data-rounds="5">
          <span class="rounds-btn-num">5</span>
          <div class="rounds-btn-label">기본</div>
          <div class="rounds-btn-desc">추천</div>
        </button>
        <button class="rounds-btn" data-rounds="7">
          <span class="rounds-btn-num">7</span>
          <div class="rounds-btn-label">풀세트</div>
          <div class="rounds-btn-desc">끝장토론</div>
        </button>
      </div>
    </div>

    <div class="disclaimer" style="margin:20px 0 24px;">
      배틀 중 AI는 어느 편도 들지 않습니다.<br>
      논리가 부족하면 직접 입력한 사람도 집니다.<br>
      <strong>어디까지나 재미로!</strong>
    </div>

    <button id="start-btn" class="btn btn-primary" disabled>입장과 방식을 선택해주세요</button>
  `;

  let selectedSide = '';
  let selectedMode = '';
  let selectedRounds = 5;
  let selectedTeamSize = 1;
  let selectedCourtMode = false;

  inner.querySelectorAll('.battle-format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('.battle-format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCourtMode = btn.dataset.format === 'court';
      inner.querySelector('.side-label-p').textContent = selectedCourtMode ? '원고 (먼저 주장)' : 'A팀 편들기';
      inner.querySelector('.side-label-d').textContent = selectedCourtMode ? '피고 (반론)' : 'B팀 편들기';
    });
  });

  // Initialise court mode from localStorage
  let storedMode = 'debate';
  try { storedMode = localStorage.getItem('sosoking_game_mode') || 'debate'; } catch {}
  let selectedCourtMode = storedMode === 'court';

  // Apply initial format button state
  if (selectedCourtMode) {
    inner.querySelectorAll('.battle-format-btn').forEach(b => b.classList.remove('active'));
    inner.querySelector('[data-format="court"]')?.classList.add('active');
    inner.querySelector('.side-label-p').textContent = '원고 (먼저 주장)';
    inner.querySelector('.side-label-d').textContent = '피고 (반론)';
  }

  inner.querySelectorAll('.battle-format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('.battle-format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCourtMode = btn.dataset.format === 'court';
      try { localStorage.setItem('sosoking_game_mode', selectedCourtMode ? 'court' : 'debate'); } catch {}
      inner.querySelector('.side-label-p').textContent = selectedCourtMode ? '원고 (먼저 주장)' : 'A팀 편들기';
      inner.querySelector('.side-label-d').textContent = selectedCourtMode ? '피고 (반론)' : 'B팀 편들기';
    });
  });

  inner.querySelectorAll('.side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSide = btn.dataset.side;
      updateStartBtn();
    });
  });

  inner.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
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

  inner.querySelectorAll('.rounds-btn[data-rounds]').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('.rounds-btn[data-rounds]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRounds = Number(btn.dataset.rounds);
    });
  });

  function updateStartBtn() {
    const btn = document.getElementById('start-btn');
    if (!btn) return;
    if (selectedSide && selectedMode) {
      btn.disabled = false;
      btn.textContent = '🔥 배틀 시작하기';
    } else {
      btn.disabled = true;
      btn.textContent = '입장과 방식을 선택해주세요';
    }
  }

  document.getElementById('start-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    btn.textContent = '세션 생성 중...';

    try {
      trackEvent('session_start', { mode: selectedMode, side: selectedSide, rounds: selectedRounds, team_size: selectedTeamSize, topic_id: topicId });
      if (selectedMode === 'random') {
        await handleRandomMatch(topicId, topic, selectedSide, selectedRounds, selectedTeamSize, selectedCourtMode);
      } else if (selectedMode === 'ai') {
        const createSessionFn = httpsCallable(functions, 'createSession');
        const res = await createSessionFn({ topicId, side: selectedSide, mode: 'ai', maxRounds: selectedRounds, courtMode: selectedCourtMode });
        location.hash = `#/debate/${res.data.sessionId}`;
      } else {
        const createSessionFn = httpsCallable(functions, 'createSession');
        const res = await createSessionFn({ topicId, side: selectedSide, mode: 'friend', maxRounds: selectedRounds, teamSize: selectedTeamSize, courtMode: selectedCourtMode });
        if (selectedTeamSize > 1) {
          showTeamInviteScreen(inner, res.data.sessionId, selectedSide, selectedTeamSize, res.data.shareToken);
        } else {
          location.hash = `#/debate/${res.data.sessionId}`;
        }
      }
    } catch (err) {
      showToast(err.message || '오류가 발생했습니다', 'error');
      btn.disabled = false;
      btn.textContent = '🔥 배틀 시작하기';
    }
  });
}

async function handleRandomMatch(topicId, topic, side, maxRounds, teamSize, courtMode) {
  const queueSnap = await getDoc(doc(db, 'random_queue', topicId));

  if (queueSnap.exists() && queueSnap.data().userId !== auth.currentUser?.uid) {
    const joinSessionFn = httpsCallable(functions, 'joinSession');
    const res = await joinSessionFn({ topicId });
    location.hash = `#/debate/${res.data.sessionId}`;
  } else {
    const createSessionFn = httpsCallable(functions, 'createSession');
    const res = await createSessionFn({ topicId, side, mode: 'random', maxRounds, teamSize: teamSize || 1, courtMode: courtMode === true });
    location.hash = `#/debate/${res.data.sessionId}`;
  }
}

function showTeamInviteScreen(container, sessionId, mySide, teamSize, shareToken) {
  const teamInviteLink = `${location.origin}/#/join-team/${sessionId}/${mySide}`;
  const opponentInviteLink = shareToken ? `${location.origin}/#/join/${shareToken}` : null;
  const sideLabel = mySide === 'plaintiff' ? '🔴 A팀' : '🔵 B팀';

  container.innerHTML = `
    <div style="text-align:center;padding:40px 0 20px;">
      <div style="font-size:64px;margin-bottom:16px;">🤝</div>
      <h2 style="font-family:var(--font-serif);font-size:22px;font-weight:700;color:var(--gold);margin-bottom:8px;">팀 배틀 생성 완료!</h2>
      <p style="font-size:14px;color:var(--cream-dim);line-height:1.7;margin-bottom:28px;">
        팀원을 초대하거나 바로 배틀로 이동하세요.
      </p>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:10px;">${sideLabel} 팀원 초대 (최대 ${teamSize}명)</div>
      <div style="background:rgba(255,255,255,0.04);border:1.5px dashed var(--border);border-radius:10px;padding:12px;word-break:break-all;font-size:12px;color:var(--cream-dim);font-family:monospace;margin-bottom:10px;">${teamInviteLink}</div>
      <button id="copy-team-link" class="btn btn-secondary" style="margin-bottom:0;">👥 팀원 초대 링크 복사</button>
    </div>

    ${opponentInviteLink ? `
    <div class="card" style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:var(--cream-dim);letter-spacing:.08em;margin-bottom:10px;">상대 팀 초대 링크</div>
      <button id="copy-opp-link" class="btn btn-ghost" style="margin-bottom:0;">🔗 상대방 초대 링크 복사</button>
    </div>
    ` : ''}

    <a href="#/debate/${sessionId}" class="btn btn-primary">⚔️ 배틀 화면으로 이동</a>
  `;

  container.querySelector('#copy-team-link')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(teamInviteLink);
      showToast('팀원 초대 링크가 복사됐습니다! 팀원에게 보내세요 🤝', 'success');
    } catch {
      showToast('링크를 직접 복사해주세요', 'info');
    }
  });

  container.querySelector('#copy-opp-link')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(opponentInviteLink);
      showToast('상대방 초대 링크가 복사됐습니다!', 'success');
    } catch {
      showToast('링크를 직접 복사해주세요', 'info');
    }
  });
}
