import { db, auth, functions, trackEvent } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

export async function renderTopicDetail(container, topicId) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/topics" class="back-btn">‹</a>
        <span class="logo">⚖️ 재판 신청</span>
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
      container.querySelector('.container').innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚠️</span><div class="empty-state-title">사건을 찾을 수 없습니다</div><a href="#/topics" class="btn btn-secondary" style="margin-top:20px;max-width:200px;display:flex;margin-left:auto;margin-right:auto;">목록으로</a></div>`;
      return;
    }
    topic = { id: snap.id, ...snap.data() };
  } catch {
    showToast('사건을 불러오지 못했습니다', 'error');
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
      <span style="display:inline-block;background:var(--court-dim);color:var(--court);border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;margin-bottom:10px;">${topic.category || '생활'}</span>
      <h2 style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--text);margin-bottom:8px;line-height:1.4;">${topic.title}</h2>
      <p style="font-size:15px;color:var(--text-dim);line-height:1.7;margin-bottom:18px;">${topic.summary}</p>
      <div class="vs-divider"><span class="vs-text">⚖️ VS ⚖️</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;">
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#f87171;margin-bottom:6px;">⚔️ 원고 측 주장</div>
          <div style="font-size:14px;color:var(--text);line-height:1.6;">${topic.plaintiffPosition}</div>
        </div>
        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#93c5fd;margin-bottom:6px;">🛡️ 피고 측 주장</div>
          <div style="font-size:14px;color:var(--text);line-height:1.6;">${topic.defendantPosition}</div>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">내 입장 선택</label>
      <div class="side-grid">
        <button class="side-btn" data-side="plaintiff">
          <span class="side-btn-icon">⚔️</span>
          <div class="side-btn-label">원고 편들기</div>
        </button>
        <button class="side-btn" data-side="defendant">
          <span class="side-btn-icon">🛡️</span>
          <div class="side-btn-label">피고 편들기</div>
        </button>
      </div>
    </div>

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
          <div class="mode-btn-label">모르는 사람과</div>
          <div class="mode-btn-desc">${hasRandomOpponent ? '대기자 있음 · 자동 매칭' : '대기자 없음 · 먼저 기다리기'}</div>
        </button>
        ${aiModeEnabled ? `<button class="mode-btn" data-mode="ai">
          <span class="mode-btn-icon">🤖</span>
          <div class="mode-btn-label">AI와 대결</div>
          <div class="mode-btn-desc">소소봇 · 혼자서 바로 시작</div>
        </button>` : ''}
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
      AI 판사는 어느 편도 안 듭니다.<br>
      논리 없으면 진짜 집니다 ㅋㅋ<br>
      <strong>⚠️ 어디까지나 재미로!</strong>
    </div>

    <button id="start-btn" class="btn btn-primary" disabled>입장과 방식을 선택해주세요</button>
  `;

  let selectedSide = '';
  let selectedMode = '';
  let selectedRounds = 5;

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

  inner.querySelectorAll('.rounds-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inner.querySelectorAll('.rounds-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRounds = Number(btn.dataset.rounds);
    });
  });

  function updateStartBtn() {
    const btn = document.getElementById('start-btn');
    if (!btn) return;
    if (selectedSide && selectedMode) {
      btn.disabled = false;
      btn.textContent = '⚖️ 재판 시작하기';
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
      trackEvent('session_start', { mode: selectedMode, side: selectedSide, rounds: selectedRounds, topic_id: topicId });
      if (selectedMode === 'random') {
        await handleRandomMatch(topicId, topic, selectedSide, selectedRounds);
      } else if (selectedMode === 'ai') {
        const createSession = httpsCallable(functions, 'createSession');
        const res = await createSession({ topicId, side: selectedSide, mode: 'ai', maxRounds: selectedRounds });
        location.hash = `#/debate/${res.data.sessionId}`;
      } else {
        const createSession = httpsCallable(functions, 'createSession');
        const res = await createSession({ topicId, side: selectedSide, mode: 'friend', maxRounds: selectedRounds });
        location.hash = `#/debate/${res.data.sessionId}`;
      }
    } catch (err) {
      showToast(err.message || '오류가 발생했습니다', 'error');
      btn.disabled = false;
      btn.textContent = '⚖️ 재판 시작하기';
    }
  });
}

async function handleRandomMatch(topicId, topic, side, maxRounds) {
  const queueSnap = await getDoc(doc(db, 'random_queue', topicId));

  if (queueSnap.exists() && queueSnap.data().userId !== auth.currentUser?.uid) {
    const joinSession = httpsCallable(functions, 'joinSession');
    const res = await joinSession({ topicId });
    location.hash = `#/debate/${res.data.sessionId}`;
  } else {
    const createSession = httpsCallable(functions, 'createSession');
    const res = await createSession({ topicId, side, mode: 'random', maxRounds });
    location.hash = `#/debate/${res.data.sessionId}`;
  }
}
