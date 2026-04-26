import { db, auth, functions, trackEvent } from '../firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

const JUDGE_DEFS = {
  '엄벌주의형': { icon: '👨‍⚖️', color: '#c0392b', desc: '사소해도 중범죄 수준으로' },
  '감성형':     { icon: '🥹',    color: '#8e44ad', desc: '눈물 흘리며 공감 위주 판결' },
  '현실주의형': { icon: '🤦',    color: '#7f8c8d', desc: '"그래서 어쩌라고요" 현실 직격' },
  '과몰입형':   { icon: '🔥',    color: '#e67e22', desc: '역사에 남을 대형 사건 취급' },
  '피곤형':     { icon: '😴',    color: '#95a5a6', desc: '빨리 끝내고 싶은 번아웃 판사' },
  '논리집착형': { icon: '🧮',    color: '#2980b9', desc: '모든 걸 수치화하는 논리 괴물' },
  '드립형':     { icon: '🎭',    color: '#27ae60', desc: '진지한 척 드립 치는 유머 판사' },
};

export async function renderDebate(container, sessionId, shareToken) {
  container.innerHTML = `
    <div id="debate-root">
      <div class="debate-header">
        <div class="debate-round-bar" id="round-bar">
          <div class="debate-round-dot"></div>
          <div class="debate-round-dot"></div>
        </div>
        <div class="debate-status" id="debate-status-text">연결 중...</div>
      </div>
      <div id="debate-topic-bar"></div>
      <div class="debate-feed" id="debate-feed" style="padding-bottom:160px;">
        <div class="loading-dots" style="padding:60px 0;"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;

  if (shareToken && !sessionId) {
    try {
      const joinSession = httpsCallable(functions, 'joinSession');
      const res = await joinSession({ shareToken });
      sessionId = res.data.sessionId;
      history.replaceState(null, '', `#/debate/${sessionId}`);
    } catch (err) {
      showToast(err.message || '세션 참가 실패', 'error');
      location.hash = '#/';
      return;
    }
  }

  if (!sessionId) {
    location.hash = '#/';
    return;
  }

  let myRole = null;
  let lastRenderedStatus = null;
  let inputAttached = false;

  const unsub = onSnapshot(doc(db, 'debate_sessions', sessionId), (snap) => {
    if (!snap.exists()) {
      showToast('세션을 찾을 수 없습니다', 'error');
      clearActiveSession(sessionId);
      setTimeout(() => { location.hash = '#/'; }, 1500);
      return;
    }
    const session = snap.data();
    const uid = auth.currentUser?.uid;

    if (!myRole) {
      if (session.plaintiff?.userId === uid) myRole = 'plaintiff';
      else if (session.defendant?.userId === uid) myRole = 'defendant';
    }

    if (session.status === lastRenderedStatus && session.status !== 'active' && session.status !== 'ready_for_verdict' && session.status !== 'verdict_requested') return;
    lastRenderedStatus = session.status;

    if (['completed', 'cancelled'].includes(session.status)) {
      clearActiveSession(sessionId);
    } else if (myRole) {
      saveActiveSession(sessionId, session.topicTitle, myRole);
    }

    updateHeader(session, myRole);
    updateTopicBar(session, myRole);

    if (session.status === 'waiting') {
      renderWaiting(session, sessionId);
      removeInputArea();
    } else if (session.status === 'active' || session.status === 'ready_for_verdict' || session.status === 'verdict_requested') {
      renderActive(session, myRole, sessionId);
      if (!inputAttached) { attachInput(sessionId, session, myRole); inputAttached = true; }
      else updateInput(session, myRole);
    } else if (session.status === 'judging') {
      renderJudging(session);
      removeInputArea();
    } else if (session.status === 'completed') {
      renderCompleted(session, myRole);
      removeInputArea();
    } else if (session.status === 'cancelled') {
      renderCancelled(session, myRole);
      removeInputArea();
    }
  }, (err) => {
    console.error('Firestore listener error:', err);
    const feed = document.getElementById('debate-feed');
    if (feed) {
      feed.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <div style="font-size:44px;margin-bottom:14px;">📡</div>
          <div style="font-size:17px;font-weight:700;color:var(--cream);margin-bottom:8px;">연결이 끊어졌습니다</div>
          <p style="font-size:14px;color:var(--cream-dim);margin-bottom:24px;">네트워크를 확인하고 다시 시도해주세요</p>
          <button onclick="location.reload()" class="btn btn-primary" style="max-width:200px;display:flex;margin:0 auto;">🔄 새로고침</button>
        </div>`;
    }
  });

  window._pageCleanup = () => unsub();
}

function saveActiveSession(sessionId, topicTitle, role) {
  try {
    localStorage.setItem('sosoking_active_session', JSON.stringify({ sessionId, topicTitle, role, savedAt: Date.now() }));
  } catch {}
}

function clearActiveSession(sessionId) {
  try {
    const stored = JSON.parse(localStorage.getItem('sosoking_active_session') || 'null');
    if (!stored || stored.sessionId === sessionId) localStorage.removeItem('sosoking_active_session');
  } catch {}
}

function updateTopicBar(session, myRole) {
  const el = document.getElementById('debate-topic-bar');
  if (!el || !session.topicTitle) return;
  if (session.status === 'waiting') { el.innerHTML = ''; return; }
  const roleClass = myRole === 'plaintiff' ? 'plaintiff' : 'defendant';
  const roleLabel = myRole === 'plaintiff' ? '⚔️ 원고' : myRole === 'defendant' ? '🛡️ 피고' : '';
  el.innerHTML = `<div class="debate-topic-bar-inner">
    <span class="debate-topic-name">📋 ${escHtml(session.topicTitle)}</span>
    ${roleLabel ? `<span class="debate-my-role ${roleClass}">${roleLabel}</span>` : ''}
  </div>`;
}

function updateHeader(session, myRole) {
  const bar = document.getElementById('round-bar');
  const statusEl = document.getElementById('debate-status-text');
  if (!bar || !statusEl) return;

  const maxRounds = session.maxRounds || 10;
  while (bar.children.length < maxRounds) {
    const d = document.createElement('div'); d.className = 'debate-round-dot'; bar.appendChild(d);
  }
  while (bar.children.length > maxRounds) bar.removeChild(bar.lastChild);

  const dots = bar.querySelectorAll('.debate-round-dot');
  dots.forEach((d, i) => {
    d.classList.remove('done', 'active');
    if (i < session.currentRound) d.classList.add('done');
    else if (i === session.currentRound && session.status === 'active') d.classList.add('active');
  });

  if (session.status === 'active' && session.aiGenerating) {
    statusEl.textContent = `${session.currentRound + 1}라운드 · 🤖 소소봇 생각 중...`;
    return;
  }
  const statusMap = {
    waiting: '상대방 대기 중...',
    active: myRole ? `${session.currentRound + 1}라운드 · ${myTurnText(session, myRole)}` : `${session.currentRound + 1}라운드 진행 중`,
    ready_for_verdict: '주장 완료 · 판결 요청 가능',
    verdict_requested: '⚖️ 판결 요청 중 · 상대방 동의 대기',
    judging: '⚖️ AI 판사 심리 중...',
    completed: '판결 완료',
  };
  statusEl.textContent = statusMap[session.status] || '';
}

function myTurnText(session, myRole) {
  if (!myRole) return '';
  const round = session.currentRound;
  const rounds = session.rounds || [];
  const cur = rounds[round] || {};
  if (cur[myRole]) return '상대방 차례';
  if (myRole === 'defendant' && !cur.plaintiff) return '원고 차례';
  return '내 차례';
}

function renderWaiting(session, sessionId) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  const shareUrl = `${location.origin}${location.pathname}#/join/${session.shareToken}`;
  const shareTitle = `소소킹 생활법정 - ${session.topicTitle}`;
  const shareText = `[소소킹 생활법정] "${session.topicTitle}" 재판에 초대합니다! 아래 링크를 눌러 참가해주세요 ⚖️`;
  const canShare = typeof navigator.share === 'function';

  feed.innerHTML = `
    <div class="waiting-screen">
      <span class="waiting-icon">⏳</span>
      <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;color:var(--cream);margin-bottom:6px;">친구를 초대하세요!</div>
      <p style="font-size:15px;color:var(--cream-dim);line-height:1.7;margin-bottom:24px;">${escHtml(session.topicTitle)}</p>

      <button id="kakao-share-btn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:17px;border-radius:14px;border:none;background:#FEE500;color:#191919;font-size:17px;font-weight:900;cursor:pointer;margin-bottom:12px;-webkit-tap-highlight-color:transparent;">
        <span style="font-size:22px;">💬</span> 카카오톡으로 공유
      </button>

      ${canShare ? `<button id="native-share-btn" class="btn btn-secondary" style="margin-bottom:12px;">📤 다른 앱으로 공유</button>` : ''}

      <div style="display:flex;align-items:center;gap:8px;margin:4px 0 12px;">
        <div style="flex:1;height:1px;background:var(--border);"></div>
        <span style="font-size:12px;color:var(--cream-dim);">또는 링크 직접 복사</span>
        <div style="flex:1;height:1px;background:var(--border);"></div>
      </div>

      <div class="waiting-link-box" id="share-link" style="cursor:pointer;" title="탭하여 복사">${shareUrl}</div>
      <button id="copy-link-btn" class="btn btn-ghost" style="margin-top:8px;">🔗 링크 복사</button>

      <p style="margin-top:24px;font-size:13px;color:var(--cream-dim);line-height:1.7;">
        친구가 링크를 누르는 순간 재판이 자동으로 시작됩니다
      </p>

      <button id="cancel-session-btn" class="btn btn-ghost" style="margin-top:16px;color:var(--red);border-color:rgba(231,76,60,0.3);">✕ 재판 취소하기</button>
    </div>
  `;

  document.getElementById('kakao-share-btn')?.addEventListener('click', async () => {
    if (canShare) {
      try { await navigator.share({ title: shareTitle, text: shareText, url: shareUrl }); return; }
      catch { /* fall through to copy */ }
    }
    try { await navigator.clipboard.writeText(shareUrl); showToast('링크가 복사되었습니다! 카카오톡에 붙여넣기하세요 💬', 'success'); }
    catch { showToast('링크를 직접 복사해주세요.', 'error'); }
  });

  document.getElementById('native-share-btn')?.addEventListener('click', async () => {
    try { await navigator.share({ title: shareTitle, text: shareText, url: shareUrl }); }
    catch { /* cancelled */ }
  });

  const copyFn = async () => {
    try { await navigator.clipboard.writeText(shareUrl); showToast('링크가 복사되었습니다!', 'success'); }
    catch { showToast('복사 실패. 직접 복사해주세요.', 'error'); }
  };
  document.getElementById('copy-link-btn')?.addEventListener('click', copyFn);
  document.getElementById('share-link')?.addEventListener('click', copyFn);

  document.getElementById('cancel-session-btn')?.addEventListener('click', async () => {
    if (!confirm('재판을 취소하시겠습니까?')) return;
    const b = document.getElementById('cancel-session-btn');
    if (b) { b.disabled = true; b.textContent = '취소 중...'; }
    try {
      const cancelSession = httpsCallable(functions, 'cancelSession');
      await cancelSession({ sessionId });
    } catch (err) {
      showToast(err.message || '오류 발생', 'error');
      if (b) { b.disabled = false; b.textContent = '✕ 재판 취소하기'; }
    }
  });
}

function renderActive(session, myRole, sessionId) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;

  const rounds = session.rounds || [];
  const judge = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;
  let html = '';

  if (judge) {
    html += `
      <div style="text-align:center;padding:18px 16px 14px;margin-bottom:8px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid var(--border);">
        <div style="font-size:10px;color:var(--cream-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">이번 사건 담당 판사</div>
        <div style="font-size:36px;margin-bottom:6px;">${judge.icon}</div>
        <div style="font-size:15px;font-weight:700;color:${judge.color};margin-bottom:3px;">${session.judgeType} 판사</div>
        <div style="font-size:11px;color:var(--cream-dim);">${judge.desc}</div>
      </div>`;
  }

  const isAiMode = session.mode === 'ai';
  const aiRole = isAiMode ? (session.plaintiff?.userId === 'AI' ? 'plaintiff' : 'defendant') : null;

  if (session.status !== 'ready_for_verdict') {
    const curRound = session.currentRound || 0;
    const curData = rounds[curRound] || {};
    const pSubmitted = !!curData.plaintiff;
    const dSubmitted = !!curData.defendant;
    const pIsAi = isAiMode && aiRole === 'plaintiff';
    const dIsAi = isAiMode && aiRole === 'defendant';
    const pState = pSubmitted ? '✓ 주장 완료' : pIsAi && session.aiGenerating ? '🤖 소소봇 생각 중...' : '✏️ 1️⃣ 주장 작성 중...';
    const dState = dSubmitted ? '✓ 반박 완료' : dIsAi && session.aiGenerating ? '🤖 소소봇 생각 중...' : pSubmitted ? '✏️ 2️⃣ 반박 작성 중...' : '⏳ 원고 주장 대기';
    html += `<div class="round-status-row">
      <div class="round-status-chip ${pSubmitted ? 'submitted' : 'waiting'}">
        <div class="chip-role" style="color:#e74c3c;">⚔️ 원고${pIsAi ? ' 🤖' : ' (먼저)'}</div>
        <div class="chip-state">${pState}</div>
      </div>
      <div class="round-status-chip ${dSubmitted ? 'submitted' : pSubmitted ? 'waiting' : ''}" ${!pSubmitted && !dSubmitted ? 'style="opacity:0.5;"' : ''}>
        <div class="chip-role" style="color:#3498db;">🛡️ 피고${dIsAi ? ' 🤖' : ' (반박)'}</div>
        <div class="chip-state">${dState}</div>
      </div>
    </div>`;
  }

  rounds.forEach((r, i) => {
    if (i > 0) html += `<div class="round-separator">${i + 1}라운드</div>`;
    if (r.plaintiff) {
      html += `<div class="bubble-wrap bubble-left">
        <div class="argument-bubble plaintiff-side">${escHtml(r.plaintiff)}</div>
        <div class="argument-meta">⚔️ ${escHtml(session.plaintiff?.nickname || '원고')}</div>
      </div>`;
    }
    if (r.defendant) {
      html += `<div class="bubble-wrap bubble-right">
        <div class="argument-bubble defendant-side">${escHtml(r.defendant)}</div>
        <div class="argument-meta right">🛡️ ${escHtml(session.defendant?.nickname || '피고')}</div>
      </div>`;
    }
  });

  if (!rounds.length && !session.aiGenerating) {
    html += `<div style="text-align:center;padding:32px 0 16px;color:var(--cream-dim);font-size:14px;">
      <div style="font-size:32px;margin-bottom:12px;">⚖️</div>
      재판이 시작되었습니다!<br>먼저 주장을 입력하세요.
    </div>`;
  }

  if (session.aiGenerating && aiRole) {
    const wrapClass = aiRole === 'plaintiff' ? 'bubble-wrap bubble-left' : 'bubble-wrap bubble-right';
    const bubbleClass = aiRole === 'plaintiff' ? 'plaintiff-side' : 'defendant-side';
    const metaClass = aiRole === 'defendant' ? 'right' : '';
    const roleIcon = aiRole === 'plaintiff' ? '⚔️' : '🛡️';
    html += `<div class="${wrapClass}">
      <div class="argument-bubble ${bubbleClass}" style="opacity:0.75;min-width:80px;">
        <div class="loading-dots" style="display:inline-flex;padding:0;"><span></span><span></span><span></span></div>
      </div>
      <div class="argument-meta ${metaClass}">${roleIcon} 🤖 소소봇</div>
    </div>`;
  }

  feed.innerHTML = html;
  feed.scrollTop = feed.scrollHeight;

  const hasCompleteRound = rounds.some(r => r.plaintiff && r.defendant);
  if (hasCompleteRound) {
    const isAllDone = session.status === 'ready_for_verdict';
    const isVerdictPending = session.status === 'verdict_requested';
    const uid = auth.currentUser?.uid;
    const iAmRequester = isVerdictPending && session.verdictRequestedBy === uid;

    const btnWrap = document.createElement('div');
    btnWrap.id = 'verdict-btn-wrap';
    btnWrap.style.cssText = 'padding:8px 0 16px;';

    if (isVerdictPending) {
      if (iAmRequester) {
        btnWrap.innerHTML = `
          <div style="text-align:center;font-size:13px;color:var(--gold);font-weight:700;margin-bottom:12px;">⏳ 상대방의 동의를 기다리는 중...</div>
          <button id="verdict-cancel-btn" class="btn btn-ghost" style="width:100%;">✕ 판결 요청 취소</button>`;
      } else {
        btnWrap.innerHTML = `
          <div style="text-align:center;font-size:14px;font-weight:700;color:var(--cream);margin-bottom:8px;">⚖️ 상대방이 지금 바로 판결을 요청했어요</div>
          <div style="text-align:center;font-size:12px;color:var(--cream-dim);margin-bottom:14px;">동의하면 AI 판사가 지금까지의 주장을 판결합니다</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button id="verdict-accept-btn" class="btn btn-primary">✅ 동의하기</button>
            <button id="verdict-decline-btn" class="btn btn-ghost">❌ 거부하기</button>
          </div>`;
      }
    } else if (isAllDone) {
      btnWrap.innerHTML = `
        <div style="text-align:center;font-size:13px;color:var(--gold);font-weight:700;margin-bottom:12px;">⚡ 모든 라운드 완료! 판결을 요청하세요.</div>
        <button id="verdict-request-btn" class="btn btn-primary">⚖️ AI 판사 판결 요청하기</button>`;
    } else {
      btnWrap.innerHTML = `
        <div style="text-align:center;font-size:12px;color:var(--cream-dim);margin-bottom:10px;">계속 토론하거나, 지금 바로 판결받을 수도 있어요</div>
        <button id="verdict-request-btn" class="btn btn-secondary" style="width:100%;">⚖️ 지금 바로 판결받기</button>`;
    }
    feed.appendChild(btnWrap);

    if (!isVerdictPending) {
      document.getElementById('verdict-request-btn')?.addEventListener('click', async () => {
        const b = document.getElementById('verdict-request-btn');
        if (b) { b.disabled = true; b.textContent = isAllDone ? '⏳ 판사 심리 중...' : '⏳ 요청 중...'; }
        try {
          const requestVerdict = httpsCallable(functions, 'requestVerdict');
          await requestVerdict({ sessionId });
        } catch (err) {
          showToast(err.message || '오류 발생', 'error');
          if (b) { b.disabled = false; b.textContent = isAllDone ? '⚖️ AI 판사 판결 요청하기' : '⚖️ 지금 바로 판결받기'; }
        }
      });
    } else if (iAmRequester) {
      document.getElementById('verdict-cancel-btn')?.addEventListener('click', async () => {
        const b = document.getElementById('verdict-cancel-btn');
        if (b) b.disabled = true;
        try {
          const declineVerdictRequest = httpsCallable(functions, 'declineVerdictRequest');
          await declineVerdictRequest({ sessionId });
        } catch (err) {
          showToast(err.message || '오류 발생', 'error');
          if (b) b.disabled = false;
        }
      });
    } else {
      document.getElementById('verdict-accept-btn')?.addEventListener('click', async () => {
        const b = document.getElementById('verdict-accept-btn');
        if (b) { b.disabled = true; b.textContent = '⏳ 심리 중...'; }
        try {
          const requestVerdict = httpsCallable(functions, 'requestVerdict');
          await requestVerdict({ sessionId });
        } catch (err) {
          showToast(err.message || '오류 발생', 'error');
          if (b) { b.disabled = false; b.textContent = '✅ 동의하기'; }
        }
      });
      document.getElementById('verdict-decline-btn')?.addEventListener('click', async () => {
        const b = document.getElementById('verdict-decline-btn');
        if (b) b.disabled = true;
        try {
          const declineVerdictRequest = httpsCallable(functions, 'declineVerdictRequest');
          await declineVerdictRequest({ sessionId });
          showToast('판결 요청을 거부했습니다', 'info');
        } catch (err) {
          showToast(err.message || '오류 발생', 'error');
          if (b) b.disabled = false;
        }
      });
    }
  }

  // 세션 종료 버튼 (진행 중 상태에서)
  if (!feed.querySelector('#cancel-active-wrap') && session.status !== 'judging') {
    const cancelWrap = document.createElement('div');
    cancelWrap.id = 'cancel-active-wrap';
    cancelWrap.style.cssText = 'padding:4px 0 20px;text-align:center;';
    cancelWrap.innerHTML = `<button id="cancel-active-btn" class="btn btn-ghost" style="font-size:12px;color:var(--red);border-color:rgba(231,76,60,0.25);padding:8px 16px;">✕ 재판 종료하기</button>`;
    feed.appendChild(cancelWrap);
    document.getElementById('cancel-active-btn')?.addEventListener('click', async () => {
      if (!confirm('재판을 종료하시겠습니까? 취소하면 기록에 남지 않습니다.')) return;
      const b = document.getElementById('cancel-active-btn');
      if (b) { b.disabled = true; b.textContent = '종료 중...'; }
      try {
        const cancelSession = httpsCallable(functions, 'cancelSession');
        await cancelSession({ sessionId });
      } catch (err) {
        showToast(err.message || '오류 발생', 'error');
        if (b) { b.disabled = false; b.textContent = '✕ 재판 종료하기'; }
      }
    });
  }
}

function renderCancelled(session, myRole) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  const uid = auth.currentUser?.uid;
  const iCancelled = session.cancelledBy === uid;
  const msg = iCancelled ? '재판을 직접 종료했습니다' : '상대방이 재판을 종료했습니다';
  const sub = iCancelled ? '원하면 새 사건으로 다시 시작해보세요' : '다음에 다른 사건으로 다시 도전해보세요';
  feed.innerHTML = `
    <div style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;">${iCancelled ? '🚫' : '😔'}</div>
      <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--cream);margin-bottom:8px;">재판이 종료되었습니다</div>
      <p style="font-size:14px;color:var(--cream-dim);margin-bottom:6px;">${msg}</p>
      <p style="font-size:13px;color:var(--cream-dim);margin-bottom:28px;">${sub}</p>
      <a href="#/topics" class="btn btn-primary" style="max-width:200px;display:flex;margin:0 auto;">새 사건 찾기</a>
    </div>
  `;
}

function renderJudging(session) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  const existing = feed.querySelector('#judging-card');
  if (existing) return;
  const judge = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;
  const card = document.createElement('div');
  card.id = 'judging-card';
  card.style.cssText = 'text-align:center;padding:40px 20px;';
  card.innerHTML = `
    <div style="font-size:52px;margin-bottom:16px;animation:waitingPulse 1.5s ease-in-out infinite;">${judge ? judge.icon : '⚖️'}</div>
    <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;color:var(--cream);margin-bottom:6px;">${judge ? `${session.judgeType} 판사` : 'AI 판사'} 심리 중</div>
    ${judge ? `<div style="font-size:12px;color:var(--cream-dim);margin-bottom:8px;">${judge.desc}</div>` : ''}
    <div class="loading-dots" style="padding:16px 0;"><span></span><span></span><span></span></div>
    <p style="font-size:13px;color:var(--cream-dim);">양측 주장을 꼼꼼히 검토하고 있습니다</p>
  `;
  feed.appendChild(card);
  feed.scrollTop = feed.scrollHeight;
}

function renderCompleted(session, myRole) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  if (feed.querySelector('.verdict-reveal')) return;

  // 판결 중 로딩 카드 제거
  document.getElementById('judging-card')?.remove();

  // 초기 로딩 스피너만 있는 상태(아직 토론 내용 없음)라면 제거
  if (!feed.querySelector('.argument-bubble, .waiting-screen, .round-status-row')) {
    feed.innerHTML = '';
  }

  const verdict = session.verdict;
  if (!verdict) return;

  const isDraw = !verdict.winner || verdict.winner === 'draw';
  const pWin = verdict.winner === 'plaintiff';
  const dWin = verdict.winner === 'defendant';

  const pClass = isDraw ? 'vs-draw' : pWin ? 'vs-win' : 'vs-lose';
  const dClass = isDraw ? 'vs-draw' : dWin ? 'vs-win' : 'vs-lose';
  const pResult = isDraw ? '🤝 무승부' : pWin ? '✅ 승소' : '❌ 패소';
  const dResult = isDraw ? '🤝 무승부' : dWin ? '✅ 승소' : '❌ 패소';
  const isWin = (myRole === 'plaintiff' && pWin) || (myRole === 'defendant' && dWin);

  const parts = parseVerdict(verdict.text || '');
  const caseNo = verdict.caseNumber || '';
  const topicTitle = session.topicTitle || '사건';
  const judge = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;

  const card = document.createElement('div');
  card.className = 'verdict-reveal';
  card.style.cssText = 'padding:0 0 20px;';
  card.innerHTML = `
    ${caseNo ? `<div class="verdict-case-no">${escHtml(caseNo)}</div>` : ''}
    ${judge ? `
      <div style="text-align:center;margin-bottom:10px;">
        <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;background:rgba(255,255,255,0.04);border:1px solid var(--border);font-size:12px;color:var(--cream-dim);">
          ${judge.icon} <span style="color:${judge.color};font-weight:700;">${session.judgeType}</span> 판사 담당
        </span>
      </div>` : ''}
    <div style="text-align:center;margin-bottom:10px;font-size:11px;color:var(--cream-dim);letter-spacing:.1em;">⚖️ 최종 판결</div>

    <div class="verdict-sides-row">
      <div class="verdict-side-card ${pClass}">
        <div class="vs-role-icon">⚔️</div>
        <div class="vs-role-label">원고</div>
        <div class="vs-name">${escHtml(session.plaintiff?.nickname || '원고')}</div>
        <div class="vs-result">${pResult}</div>
        ${myRole === 'plaintiff' ? '<div class="vs-me-badge">나</div>' : ''}
      </div>
      <div class="vs-divider-col">⚖️</div>
      <div class="verdict-side-card ${dClass}">
        <div class="vs-role-icon">🛡️</div>
        <div class="vs-role-label">피고</div>
        <div class="vs-name">${escHtml(session.defendant?.nickname || '피고')}</div>
        <div class="vs-result">${dResult}</div>
        ${myRole === 'defendant' ? '<div class="vs-me-badge">나</div>' : ''}
      </div>
    </div>
    ${isWin ? `<div style="text-align:center;font-size:20px;font-weight:900;color:#27ae60;margin-bottom:14px;animation:fadeUp 0.4s both;">🎉 승소!</div>` : myRole ? `<div style="text-align:center;font-size:18px;font-weight:900;color:var(--red);margin-bottom:14px;animation:fadeUp 0.4s both;">😔 패소</div>` : ''}

    ${parts.reason ? `
      <div style="margin-bottom:8px;">
        <div class="verdict-reason-label">📝 판결 이유</div>
        <div class="verdict-text-card">${escHtml(parts.reason)}</div>
      </div>` : ''}
    ${parts.sentence ? `
      <div class="verdict-sentence">
        <div class="verdict-sentence-label">📜 생활형 처분</div>
        <div class="verdict-sentence-text">${escHtml(parts.sentence)}</div>
      </div>` : ''}
    <div class="verdict-actions-row">
      <button id="share-verdict-btn" class="btn btn-secondary">🖼️ 이미지 카드 공유</button>
      <a href="#/topics" class="btn btn-ghost">⚖️ 다른 사건 보기</a>
    </div>
  `;
  feed.appendChild(card);
  feed.scrollTop = feed.scrollHeight;

  trackEvent('verdict_complete', {
    mode: session.mode || 'friend',
    judge_type: session.judgeType || 'unknown',
    winner: verdict.winner || 'draw',
    rounds: (session.rounds || []).length,
    my_result: myRole ? (isWin ? 'win' : 'lose') : 'spectator',
  });

  card.querySelector('#share-verdict-btn')?.addEventListener('click', async () => {
    const btn = card.querySelector('#share-verdict-btn');
    btn.disabled = true;
    btn.textContent = '🎨 카드 생성 중...';
    try {
      const cardCanvas = await generateVerdictCard(session);
      await shareVerdictCard(cardCanvas, session);
      trackEvent('share_card', { winner: verdict.winner || 'draw', mode: session.mode || 'friend' });
    } catch {
      showToast('공유 중 오류가 발생했습니다', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🖼️ 이미지 카드 공유';
    }
  });
}

function parseVerdict(text) {
  const lines = text.split('\n');
  const reasonLines = [];
  let sentenceLine = '';
  let inReason = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { if (inReason) reasonLines.push(''); continue; }
    if (/^판결이유/.test(trimmed)) {
      inReason = true;
      const content = trimmed.replace(/^판결이유\s*[:\：]?\s*/, '').trim();
      if (content) reasonLines.push(content);
    } else if (/^생활형\s*처분/.test(trimmed)) {
      inReason = false;
      sentenceLine = trimmed.replace(/^생활형\s*처분\s*[:\：]?\s*/, '').replace(/\.$/, '').trim();
    } else if (/^(사건번호|판결)\s*[:\：]/.test(trimmed)) {
      inReason = false;
    } else if (inReason) {
      reasonLines.push(trimmed);
    }
  }

  const reason = reasonLines.join('\n').trim();
  return {
    reason: reason || text.trim(),
    sentence: sentenceLine,
  };
}

function attachInput(sessionId, session, myRole) {
  removeInputArea();
  const area = document.createElement('div');
  area.className = 'debate-input-area';
  area.id = 'debate-input-area';
  if (myRole) area.dataset.role = myRole;
  const roleColor = myRole === 'plaintiff' ? '#e74c3c' : myRole === 'defendant' ? '#3498db' : 'var(--gold)';
  const roleLabel = myRole === 'plaintiff' ? '⚔️ 원고' : myRole === 'defendant' ? '🛡️ 피고' : '';
  area.innerHTML = `
    ${roleLabel ? `<div style="font-size:11px;font-weight:700;color:${roleColor};margin-bottom:6px;${myRole==='defendant'?'text-align:right;':''}">${roleLabel}</div>` : ''}
    <div class="debate-input-row">
      <textarea class="debate-textarea" id="arg-input" placeholder="주장을 입력하세요... (최대 200자)" maxlength="200" rows="1"></textarea>
      <button class="debate-send-btn" id="send-btn">↑</button>
    </div>
    <div style="font-size:11px;color:var(--cream-dim);margin-top:4px;${myRole==='defendant'?'text-align:left;':'text-align:right;'}"><span id="char-count">0</span>/200 · <span id="input-hint"></span></div>
  `;
  document.body.appendChild(area);

  updateInput(session, myRole);

  const textarea = document.getElementById('arg-input');
  textarea?.addEventListener('input', function () {
    document.getElementById('char-count').textContent = this.value.length;
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  document.getElementById('send-btn')?.addEventListener('click', () => submitArgument(sessionId, myRole));
  textarea?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitArgument(sessionId, myRole); }
  });
}

function updateInput(session, myRole) {
  const hint = document.getElementById('input-hint');
  const btn = document.getElementById('send-btn');
  const textarea = document.getElementById('arg-input');
  if (!hint || !btn || !textarea) return;

  if (session.aiGenerating) {
    textarea.disabled = true;
    btn.disabled = true;
    hint.textContent = '🤖 소소봇이 생각 중입니다...';
    return;
  }

  const round = session.currentRound;
  const rounds = session.rounds || [];
  const cur = rounds[round] || {};
  const myDone = !!cur[myRole];
  const maxReached = session.status === 'ready_for_verdict';
  const verdictPending = session.status === 'verdict_requested';

  // 순서: 원고 먼저 주장 → 피고 반박
  let isMyTurn = false;
  let waitMsg = '';
  if (myRole === 'plaintiff') {
    if (myDone) waitMsg = '🛡️ 피고의 반박을 기다리는 중...';
    else isMyTurn = true;
  } else if (myRole === 'defendant') {
    if (!cur.plaintiff) waitMsg = '⚔️ 원고가 먼저 주장 중입니다...';
    else if (!myDone) isMyTurn = true;
    else waitMsg = '⚔️ 원고의 다음 주장을 기다리는 중...';
  }

  textarea.disabled = !isMyTurn || maxReached || verdictPending;
  btn.disabled = !isMyTurn || maxReached || verdictPending;
  textarea.placeholder = isMyTurn
    ? (myRole === 'plaintiff' ? '먼저 주장을 펼치세요... (최대 200자)' : '원고 주장에 반박하세요... (최대 200자)')
    : '대기 중...';

  if (maxReached) {
    hint.textContent = '모든 라운드 완료 · 위에서 판결 요청 가능';
  } else if (verdictPending) {
    hint.textContent = '⚖️ 판결 요청 처리 중...';
  } else if (!isMyTurn) {
    hint.textContent = waitMsg;
  } else {
    const turnLabel = myRole === 'plaintiff' ? '원고가 먼저 주장' : '피고 반박';
    hint.textContent = `${round + 1}라운드 · ${turnLabel}`;
  }
}

async function submitArgument(sessionId, myRole) {
  const textarea = document.getElementById('arg-input');
  const btn = document.getElementById('send-btn');
  const arg = textarea?.value.trim();
  if (!arg || arg.length < 5) { showToast('5자 이상 입력해주세요', 'error'); return; }

  textarea.disabled = true;
  btn.disabled = true;

  try {
    const submitArg = httpsCallable(functions, 'submitArgument');
    await submitArg({ sessionId, argument: arg });
    textarea.value = '';
    textarea.style.height = 'auto';
    document.getElementById('char-count').textContent = '0';
  } catch (err) {
    showToast(err.message || '제출 실패', 'error');
    textarea.disabled = false;
    btn.disabled = false;
  }
}

function removeInputArea() {
  document.getElementById('debate-input-area')?.remove();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function cardRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
  ctx.closePath();
}

function cardWrapText(ctx, text, maxWidth, font) {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const lines = [];
  let line = '';
  for (const ch of [...text]) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth) {
      if (line) lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function generateVerdictCard(session) {
  await Promise.all([
    document.fonts.load('700 52px "Noto Serif KR"'),
    document.fonts.load('700 40px "Noto Sans KR"'),
    document.fonts.load('400 26px "Noto Sans KR"'),
    document.fonts.ready,
  ]);

  const W = 1080;
  const MAX_ROUNDS = 3;
  const debateRounds = (session.rounds || []).filter(r => r.plaintiff || r.defendant);
  const numShown = Math.min(debateRounds.length, MAX_ROUNDS);
  const hasDebate = numShown > 0;
  const moreRounds = debateRounds.length - numShown;

  // 높이 계산 전에 먼저 파싱
  const verdict = session.verdict || {};
  const isDraw = !verdict.winner || verdict.winner === 'draw';
  const pWin = verdict.winner === 'plaintiff';
  const dWin = verdict.winner === 'defendant';
  const parts = parseVerdict(verdict.text || '');
  const judge = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;

  const REASON_H = parts.reason ? 155 : 0;
  const DEBATE_H = hasDebate ? 80 + numShown * 280 + (moreRounds > 0 ? 40 : 0) : 0;
  const H = Math.max(1080, 940 + DEBATE_H + REASON_H + 40);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const GOLD = '#c9a84c';
  const GOLD_DIM = 'rgba(201,168,76,0.45)';
  const CREAM = '#f0e6c8';
  const CREAM_DIM = 'rgba(240,230,200,0.6)';
  const RED = '#e74c3c';
  const BLUE = '#3498db';
  const GREEN = '#2ecc71';

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#1c1508');
  bgGrad.addColorStop(1, '#0a0e16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.7);
  glow.addColorStop(0, 'rgba(201,168,76,0.06)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Borders
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  cardRoundRect(ctx, 22, 22, W - 44, H - 44, 22);
  ctx.stroke();
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 1.5;
  cardRoundRect(ctx, 34, 34, W - 68, H - 68, 16);
  ctx.stroke();

  let y = 95;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Header
  ctx.font = '700 52px "Noto Serif KR", serif';
  ctx.fillStyle = GOLD;
  ctx.fillText('⚖️ 소소킹 생활법정', W / 2, y);
  y += 48;

  ctx.font = '400 24px "Noto Sans KR", sans-serif';
  ctx.fillStyle = GOLD_DIM;
  ctx.fillText('AI 판사 판결 결과', W / 2, y);
  y += 42;

  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(W - 70, y); ctx.stroke();
  y += 46;

  // Topic title
  const topicFont = '700 40px "Noto Sans KR", sans-serif';
  const topicLines = cardWrapText(ctx, session.topicTitle || '사건', W - 140, topicFont);
  ctx.font = topicFont;
  ctx.fillStyle = CREAM;
  topicLines.slice(0, 2).forEach(line => { ctx.fillText(line, W / 2, y); y += 54; });
  y += 16;

  // ── 토론 내용 섹션 ──
  if (hasDebate) {
    ctx.strokeStyle = GOLD_DIM;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(W - 70, y); ctx.stroke();
    y += 34;

    ctx.font = '700 24px "Noto Sans KR", sans-serif';
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText('📋 토론 내용', W / 2, y);
    y += 46;

    const pNick = session.plaintiff?.nickname || '원고';
    const dNick = session.defendant?.nickname || '피고';
    const TRUNC = 50;
    const argFont = '400 24px "Noto Sans KR", sans-serif';
    const textAreaW = W - 140 - 32; // bubble inner text width

    const drawDebateBubble = (text, role) => {
      const isP = role === 'plaintiff';
      const nick = isP ? pNick : dNick;
      const accent = isP ? RED : BLUE;
      const truncated = text.length > TRUNC ? text.slice(0, TRUNC) + '…' : text;
      const lines = cardWrapText(ctx, truncated, textAreaW, argFont);
      const lineCount = Math.min(lines.length, 2);
      const bubbleH = 22 + 26 + 8 + lineCount * 30 + 16;
      const bx = 70, bw = W - 140;

      ctx.fillStyle = isP ? 'rgba(231,76,60,0.08)' : 'rgba(52,152,219,0.08)';
      cardRoundRect(ctx, bx, y, bw, bubbleH, 10);
      ctx.fill();
      ctx.strokeStyle = isP ? 'rgba(231,76,60,0.28)' : 'rgba(52,152,219,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // accent bar
      ctx.fillStyle = accent;
      cardRoundRect(ctx, bx, y, 4, bubbleH, 2);
      ctx.fill();

      // role label
      ctx.font = '700 20px "Noto Sans KR", sans-serif';
      ctx.fillStyle = accent;
      ctx.textAlign = 'left';
      const shortNick = nick.length > 8 ? nick.slice(0, 8) + '…' : nick;
      ctx.fillText(`${isP ? '⚔️ 원고' : '🛡️ 피고'} · ${shortNick}`, bx + 18, y + 22 + 18);

      // argument text
      ctx.font = argFont;
      ctx.fillStyle = CREAM;
      lines.slice(0, 2).forEach((line, li) => {
        ctx.fillText(line, bx + 18, y + 22 + 26 + 8 + (li + 1) * 30);
      });

      y += bubbleH + 10;
    };

    debateRounds.slice(0, MAX_ROUNDS).forEach((round, i) => {
      ctx.font = '700 20px "Noto Sans KR", sans-serif';
      ctx.fillStyle = GOLD_DIM;
      ctx.textAlign = 'center';
      ctx.fillText(`— ${i + 1}라운드 —`, W / 2, y + 14);
      y += 36;
      if (round.plaintiff) drawDebateBubble(round.plaintiff, 'plaintiff');
      if (round.defendant) drawDebateBubble(round.defendant, 'defendant');
      y += 16;
    });

    if (moreRounds > 0) {
      ctx.font = '400 21px "Noto Sans KR", sans-serif';
      ctx.fillStyle = GOLD_DIM;
      ctx.textAlign = 'center';
      ctx.fillText(`···  외 ${moreRounds}라운드 더`, W / 2, y + 12);
      y += 40;
    }

    y += 10;
  }

  // ── 판결 섹션 ──
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(W - 70, y); ctx.stroke();
  y += 34;

  ctx.font = '400 20px "Noto Sans KR", sans-serif';
  ctx.fillStyle = GOLD_DIM;
  ctx.textAlign = 'center';
  ctx.fillText('⚖️ 최종 판결', W / 2, y);
  y += 36;

  // Verdict box
  const verdictColor = isDraw ? GOLD : pWin ? RED : BLUE;
  const verdictLabel = isDraw ? '🤝 무승부' : pWin ? '⚔️ 원고 승소' : '🛡️ 피고 승소';
  const boxTop = y;
  const boxH = 100;
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  cardRoundRect(ctx, 70, boxTop, W - 140, boxH, 18);
  ctx.fill();
  ctx.strokeStyle = verdictColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.font = '900 56px "Noto Serif KR", serif';
  ctx.fillStyle = verdictColor;
  ctx.fillText(verdictLabel, W / 2, boxTop + 66);
  y = boxTop + boxH + 28;

  // VS section
  const vsBoxW = 360, vsBoxH = 132;
  const leftX = 70, rightX = W - 70 - vsBoxW;

  const drawVsBox = (x, role, nick, isWinner) => {
    const isP = role === 'plaintiff';
    const bg = isDraw ? 'rgba(201,168,76,0.08)' : isWinner ? 'rgba(46,204,113,0.08)' : 'rgba(255,255,255,0.03)';
    const border = isDraw ? GOLD_DIM : isWinner ? 'rgba(46,204,113,0.6)' : 'rgba(255,255,255,0.12)';
    ctx.fillStyle = bg;
    cardRoundRect(ctx, x, y, vsBoxW, vsBoxH, 14);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '700 20px "Noto Sans KR", sans-serif';
    ctx.fillStyle = isP ? RED : BLUE;
    ctx.fillText(isP ? '⚔️ 원고' : '🛡️ 피고', x + vsBoxW / 2, y + 34);

    ctx.font = '700 26px "Noto Sans KR", sans-serif';
    ctx.fillStyle = CREAM;
    const n = nick.length > 10 ? nick.slice(0, 10) + '…' : nick;
    ctx.fillText(n, x + vsBoxW / 2, y + 70);

    ctx.font = '900 28px "Noto Sans KR", sans-serif';
    ctx.fillStyle = isDraw ? GOLD : isWinner ? GREEN : RED;
    ctx.fillText(isDraw ? '무승부' : isWinner ? '✅ 승소' : '❌ 패소', x + vsBoxW / 2, y + 108);
  };

  drawVsBox(leftX, 'plaintiff', session.plaintiff?.nickname || '원고', pWin);
  drawVsBox(rightX, 'defendant', session.defendant?.nickname || '피고', dWin);

  ctx.font = '900 30px "Noto Sans KR", sans-serif';
  ctx.fillStyle = GOLD_DIM;
  ctx.textAlign = 'center';
  ctx.fillText('VS', W / 2, y + vsBoxH / 2 + 10);

  y += vsBoxH + 28;

  // Judge
  if (judge) {
    ctx.font = '400 24px "Noto Sans KR", sans-serif';
    ctx.fillStyle = CREAM_DIM;
    ctx.textAlign = 'center';
    ctx.fillText(`${judge.icon} ${session.judgeType} 판사 담당`, W / 2, y);
    y += 40;
  }

  // 판결 이유
  if (parts.reason) {
    ctx.strokeStyle = GOLD_DIM;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(W - 70, y); ctx.stroke();
    y += 28;

    ctx.font = '700 22px "Noto Sans KR", sans-serif';
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText('📝 판결 이유', W / 2, y);
    y += 32;

    const reasonFont = '400 21px "Noto Sans KR", sans-serif';
    const flat = parts.reason.replace(/\n+/g, ' ').trim();
    const reasonTrunc = flat.length > 90 ? flat.slice(0, 90) + '…' : flat;
    const reasonLines = cardWrapText(ctx, reasonTrunc, W - 140, reasonFont);
    ctx.font = reasonFont;
    ctx.fillStyle = CREAM_DIM;
    reasonLines.slice(0, 3).forEach(line => { ctx.fillText(line, W / 2, y); y += 30; });
  }

  // 생활형 처분
  if (parts.sentence) {
    ctx.strokeStyle = GOLD_DIM;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(W - 70, y); ctx.stroke();
    y += 28;

    ctx.font = '700 22px "Noto Sans KR", sans-serif';
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText('📜 생활형 처분', W / 2, y);
    y += 32;

    const sentFont = '400 21px "Noto Sans KR", sans-serif';
    const sentLines = cardWrapText(ctx, parts.sentence, W - 140, sentFont);
    ctx.font = sentFont;
    ctx.fillStyle = CREAM_DIM;
    sentLines.slice(0, 2).forEach(line => { ctx.fillText(line, W / 2, y); y += 30; });
  }

  // Footer
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(70, H - 56); ctx.lineTo(W - 70, H - 56); ctx.stroke();

  ctx.font = '700 26px "Noto Sans KR", sans-serif';
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.fillText('🌐 sosoking.co.kr', W / 2, H - 24);

  return canvas;
}

async function shareVerdictCard(canvas, session) {
  const isDraw = !session.verdict?.winner || session.verdict?.winner === 'draw';
  const pWin = session.verdict?.winner === 'plaintiff';
  const verdictLabel = isDraw ? '무승부' : pWin ? '원고 승소' : '피고 승소';
  const topicTitle = session.topicTitle || '사건';
  const shareTitle = `소소킹 생활법정 - ${topicTitle}`;
  const shareText = `[소소킹 판결결과]\n📋 사건: ${topicTitle}\n⚖️ 판결: ${verdictLabel}\n\n재판 받아보기 → sosoking.co.kr`;

  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        await textFallbackShare(shareTitle, shareText);
        resolve();
        return;
      }
      const file = new File([blob], 'sosoking-verdict.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: shareTitle, text: shareText });
          resolve();
          return;
        } catch (err) {
          if (err.name === 'AbortError') { resolve(); return; }
        }
      }
      // Download fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sosoking-verdict.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('판결 카드가 저장되었습니다! 📸 갤러리에서 공유하세요', 'success');
      resolve();
    }, 'image/png');
  });
}

async function textFallbackShare(title, text) {
  const url = `${location.origin}${location.pathname}`;
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; } catch { /* fall through */ }
  }
  try { await navigator.clipboard.writeText(text + '\n' + url); showToast('결과가 복사되었습니다!', 'success'); }
  catch { showToast('공유 실패', 'error'); }
}
