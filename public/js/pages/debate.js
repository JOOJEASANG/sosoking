import { db, auth, functions, trackEvent } from '../firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

const JUDGE_DEFS = {
  '엄벌주의형': { icon: '👨‍⚖️', color: '#c0392b', desc: '사소해도 중범죄 수준으로' },
  '감성형':     { icon: '🥹',    color: '#8e44ad', desc: '눈물 흘리며 공감 위주 판정' },
  '현실주의형': { icon: '🤦',    color: '#7f8c8d', desc: '"그래서 어쩌라고요" 현실 직격' },
  '과몰입형':   { icon: '🔥',    color: '#e67e22', desc: '역사에 남을 대형 이슈 취급' },
  '피곤형':     { icon: '😴',    color: '#95a5a6', desc: '빨리 끝내고 싶은 번아웃 심판' },
  '논리집착형': { icon: '🧮',    color: '#2980b9', desc: '모든 걸 수치화하는 논리 괴물' },
  '드립형':     { icon: '🎭',    color: '#27ae60', desc: '진지한 척 드립 치는 유머 심판' },
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
  const roleLabel = myRole === 'plaintiff' ? '🔴 A팀' : myRole === 'defendant' ? '🔵 B팀' : '';
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
    ready_for_verdict: '주장 완료 · 판정 요청 가능',
    verdict_requested: '⚖️ 판정 요청 중 · 상대방 동의 대기',
    judging: '⚖️ AI 심판 판정 중...',
    completed: '판정 완료',
  };
  statusEl.textContent = statusMap[session.status] || '';
}

function myTurnText(session, myRole) {
  if (!myRole) return '';
  const round = session.currentRound;
  const rounds = session.rounds || [];
  const cur = rounds[round] || {};
  if (cur[myRole]) return '상대방 차례';
  if (myRole === 'defendant' && !cur.plaintiff) return 'A팀 차례';
  return '내 차례';
}

function renderWaiting(session, sessionId) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  const shareUrl = `${location.origin}${location.pathname}#/join/${session.shareToken}`;
  const shareTitle = `소소킹 토론배틀 - ${session.topicTitle}`;
  const shareText = `[소소킹 토론배틀] "${session.topicTitle}" 배틀에 초대합니다! 아래 링크를 눌러 참가해주세요 ⚖️`;
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
        친구가 링크를 누르는 순간 배틀이 자동으로 시작됩니다
      </p>

      <button id="cancel-session-btn" class="btn btn-ghost" style="margin-top:16px;color:var(--red);border-color:rgba(231,76,60,0.3);">✕ 배틀 취소하기</button>
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
    if (!confirm('배틀을 취소하시겠습니까?')) return;
    const b = document.getElementById('cancel-session-btn');
    if (b) { b.disabled = true; b.textContent = '취소 중...'; }
    try {
      const cancelSession = httpsCallable(functions, 'cancelSession');
      await cancelSession({ sessionId });
    } catch (err) {
      showToast(err.message || '오류 발생', 'error');
      if (b) { b.disabled = false; b.textContent = '✕ 배틀 취소하기'; }
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
        <div style="font-size:10px;color:var(--cream-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">이번 배틀 담당 심판</div>
        <div style="font-size:36px;margin-bottom:6px;">${judge.icon}</div>
        <div style="font-size:15px;font-weight:700;color:${judge.color};margin-bottom:3px;">${session.judgeType} 심판</div>
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
    const dState = dSubmitted ? '✓ 반박 완료' : dIsAi && session.aiGenerating ? '🤖 소소봇 생각 중...' : pSubmitted ? '✏️ 2️⃣ 반박 작성 중...' : '⏳ A팀 주장 대기';
    html += `<div class="round-status-row">
      <div class="round-status-chip ${pSubmitted ? 'submitted' : 'waiting'}">
        <div class="chip-role" style="color:#e74c3c;">🔴 A팀${pIsAi ? ' 🤖' : ' (먼저)'}</div>
        <div class="chip-state">${pState}</div>
      </div>
      <div class="round-status-chip ${dSubmitted ? 'submitted' : pSubmitted ? 'waiting' : ''}" ${!pSubmitted && !dSubmitted ? 'style="opacity:0.5;"' : ''}>
        <div class="chip-role" style="color:#3498db;">🔵 B팀${dIsAi ? ' 🤖' : ' (반박)'}</div>
        <div class="chip-state">${dState}</div>
      </div>
    </div>`;
  }

  rounds.forEach((r, i) => {
    if (i > 0) html += `<div class="round-separator">${i + 1}라운드</div>`;
    if (r.plaintiff) {
      html += `<div class="bubble-wrap bubble-left">
        <div class="argument-bubble plaintiff-side">${escHtml(r.plaintiff)}</div>
        <div class="argument-meta">⚔️ ${escHtml(session.plaintiff?.nickname || "A팀")}</div>
      </div>`;
    }
    if (r.defendant) {
      html += `<div class="bubble-wrap bubble-right">
        <div class="argument-bubble defendant-side">${escHtml(r.defendant)}</div>
        <div class="argument-meta right">🛡️ ${escHtml(session.defendant?.nickname || "B팀")}</div>
      </div>`;
    }
  });

  if (!rounds.length && !session.aiGenerating) {
    html += `<div style="text-align:center;padding:32px 0 16px;color:var(--cream-dim);font-size:14px;">
      <div style="font-size:32px;margin-bottom:12px;">⚖️</div>
      배틀이 시작되었습니다!<br>먼저 주장을 입력하세요.
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
          <button id="verdict-cancel-btn" class="btn btn-ghost" style="width:100%;">✕ 판정 요청 취소</button>`;
      } else {
        btnWrap.innerHTML = `
          <div style="text-align:center;font-size:14px;font-weight:700;color:var(--cream);margin-bottom:8px;">⚖️ 상대방이 지금 바로 판정을 요청했어요</div>
          <div style="text-align:center;font-size:12px;color:var(--cream-dim);margin-bottom:14px;">동의하면 AI 심판가 지금까지의 주장을 판정합니다</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button id="verdict-accept-btn" class="btn btn-primary">✅ 동의하기</button>
            <button id="verdict-decline-btn" class="btn btn-ghost">❌ 거부하기</button>
          </div>`;
      }
    } else if (isAllDone) {
      btnWrap.innerHTML = `
        <div style="text-align:center;font-size:13px;color:var(--gold);font-weight:700;margin-bottom:12px;">⚡ 모든 라운드 완료! 판정을 요청하세요.</div>
        <button id="verdict-request-btn" class="btn btn-primary">⚖️ AI 심판 판정 요청하기</button>`;
    } else {
      btnWrap.innerHTML = `
        <div style="text-align:center;font-size:12px;color:var(--cream-dim);margin-bottom:10px;">계속 토론하거나, 지금 바로 판정받을 수도 있어요</div>
        <button id="verdict-request-btn" class="btn btn-secondary" style="width:100%;">⚖️ 지금 바로 판정받기</button>`;
    }
    feed.appendChild(btnWrap);

    if (!isVerdictPending) {
      document.getElementById('verdict-request-btn')?.addEventListener('click', async () => {
        const b = document.getElementById('verdict-request-btn');
        if (b) { b.disabled = true; b.textContent = isAllDone ? '⏳ 심판 판정 중...' : '⏳ 요청 중...'; }
        try {
          const requestVerdict = httpsCallable(functions, 'requestVerdict');
          await requestVerdict({ sessionId });
        } catch (err) {
          showToast(err.message || '오류 발생', 'error');
          if (b) { b.disabled = false; b.textContent = isAllDone ? '⚖️ AI 심판 판정 요청하기' : '⚖️ 지금 바로 판정받기'; }
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
        if (b) { b.disabled = true; b.textContent = '⏳ 판정 중...'; }
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
          showToast('판정 요청을 거부했습니다', 'info');
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
    cancelWrap.innerHTML = `<button id="cancel-active-btn" class="btn btn-ghost" style="font-size:12px;color:var(--red);border-color:rgba(231,76,60,0.25);padding:8px 16px;">✕ 배틀 종료하기</button>`;
    feed.appendChild(cancelWrap);
    document.getElementById('cancel-active-btn')?.addEventListener('click', async () => {
      if (!confirm('배틀을 종료하시겠습니까? 취소하면 기록에 남지 않습니다.')) return;
      const b = document.getElementById('cancel-active-btn');
      if (b) { b.disabled = true; b.textContent = '종료 중...'; }
      try {
        const cancelSession = httpsCallable(functions, 'cancelSession');
        await cancelSession({ sessionId });
      } catch (err) {
        showToast(err.message || '오류 발생', 'error');
        if (b) { b.disabled = false; b.textContent = '✕ 배틀 종료하기'; }
      }
    });
  }
}

function renderCancelled(session, myRole) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  const uid = auth.currentUser?.uid;
  const iCancelled = session.cancelledBy === uid;
  const msg = iCancelled ? '배틀을 직접 종료했습니다' : '상대방이 배틀을 종료했습니다';
  const sub = iCancelled ? '원하면 새 주제로 다시 시작해보세요' : '다음에 다른 주제로 다시 도전해보세요';
  feed.innerHTML = `
    <div style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;">${iCancelled ? '🚫' : '😔'}</div>
      <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--cream);margin-bottom:8px;">배틀이 종료되었습니다</div>
      <p style="font-size:14px;color:var(--cream-dim);margin-bottom:6px;">${msg}</p>
      <p style="font-size:13px;color:var(--cream-dim);margin-bottom:28px;">${sub}</p>
      <a href="#/topics" class="btn btn-primary" style="max-width:200px;display:flex;margin:0 auto;">새 주제 찾기</a>
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
    <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;color:var(--cream);margin-bottom:6px;">${judge ? `${session.judgeType} 심판` : 'AI 심판'} 판정 중</div>
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

  document.getElementById('judging-card')?.remove();

  // 토론 내용이 없으면(직접 링크 접속 등) 먼저 대화 내역 렌더링
  if (!feed.querySelector('.argument-bubble, .waiting-screen, .round-status-row')) {
    feed.innerHTML = '';
    const rounds = session.rounds || [];
    const judge = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;
    let historyHtml = '';

    if (judge) {
      historyHtml += `
        <div style="text-align:center;padding:18px 16px 14px;margin-bottom:8px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid var(--border);">
          <div style="font-size:10px;color:var(--cream-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">이번 배틀 담당 심판</div>
          <div style="font-size:36px;margin-bottom:6px;">${judge.icon}</div>
          <div style="font-size:15px;font-weight:700;color:${judge.color};margin-bottom:3px;">${session.judgeType} 심판</div>
          <div style="font-size:11px;color:var(--cream-dim);">${judge.desc}</div>
        </div>`;
    }

    rounds.forEach((r, i) => {
      if (i > 0) historyHtml += `<div class="round-separator">${i + 1}라운드</div>`;
      if (r.plaintiff) {
        historyHtml += `<div class="bubble-wrap bubble-left">
          <div class="argument-bubble plaintiff-side">${escHtml(r.plaintiff)}</div>
          <div class="argument-meta">⚔️ ${escHtml(session.plaintiff?.nickname || "A팀")}</div>
        </div>`;
      }
      if (r.defendant) {
        historyHtml += `<div class="bubble-wrap bubble-right">
          <div class="argument-bubble defendant-side">${escHtml(r.defendant)}</div>
          <div class="argument-meta right">🛡️ ${escHtml(session.defendant?.nickname || "B팀")}</div>
        </div>`;
      }
    });

    if (historyHtml) feed.innerHTML = historyHtml;
  }

  const verdict = session.verdict;
  if (!verdict) return;

  const scores = verdict.scores || {};
  const pScore = scores.plaintiff ?? (verdict.winner === 'plaintiff' ? 60 : verdict.winner === 'defendant' ? 40 : 50);
  const dScore = scores.defendant ?? (100 - pScore);

  const isDraw = !verdict.winner || verdict.winner === 'draw';
  const pWin = verdict.winner === 'plaintiff';
  const dWin = verdict.winner === 'defendant';

  const pClass = isDraw ? 'vs-draw' : pWin ? 'vs-win' : 'vs-lose';
  const dClass = isDraw ? 'vs-draw' : dWin ? 'vs-win' : 'vs-lose';
  const pResult = isDraw ? '🤝 무승부' : pWin ? '🏆 승리' : '😔 패배';
  const dResult = isDraw ? '🤝 무승부' : dWin ? '🏆 승리' : '😔 패배';
  const isWin = (myRole === 'plaintiff' && pWin) || (myRole === 'defendant' && dWin);

  const parts = parseVerdict(verdict.text || '');
  const caseNo = verdict.caseNumber || '';
  const judge = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;

  const card = document.createElement('div');
  card.className = 'verdict-reveal';
  card.style.cssText = 'padding:0 0 20px;';
  card.innerHTML = `
    ${caseNo ? `<div class="verdict-case-no">${escHtml(caseNo)}</div>` : ''}
    ${judge ? `
      <div style="text-align:center;margin-bottom:10px;">
        <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;background:rgba(255,255,255,0.04);border:1px solid var(--border);font-size:12px;color:var(--cream-dim);">
          ${judge.icon} <span style="color:${judge.color};font-weight:700;">${session.judgeType}</span> 심판 담당
        </span>
      </div>` : ''}
    <div style="text-align:center;margin-bottom:14px;font-size:11px;color:var(--cream-dim);letter-spacing:.1em;">🏆 최종 판정</div>

    <!-- 점수 바 -->
    <div style="margin:0 0 16px;padding:0 2px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <span style="font-size:14px;font-weight:800;color:#e74c3c;">🔴 A팀 ${pScore}점</span>
        <span style="font-size:14px;font-weight:800;color:#3498db;">🔵 B팀 ${dScore}점</span>
      </div>
      <div style="height:12px;border-radius:6px;overflow:hidden;display:flex;gap:2px;background:rgba(255,255,255,0.06);">
        <div style="width:${pScore}%;background:linear-gradient(90deg,#e74c3c,#ff6b6b);border-radius:6px 0 0 6px;transition:width 1s ease;"></div>
        <div style="width:${dScore}%;background:linear-gradient(90deg,#3498db,#5dade2);border-radius:0 6px 6px 0;transition:width 1s ease;"></div>
      </div>
    </div>

    <div class="verdict-sides-row">
      <div class="verdict-side-card ${pClass}">
        <div class="vs-role-icon">🔴</div>
        <div class="vs-role-label">A팀</div>
        <div class="vs-name">${escHtml(session.plaintiff?.nickname || "A팀")}</div>
        <div class="vs-result">${pResult}</div>
        ${myRole === 'plaintiff' ? '<div class="vs-me-badge">나</div>' : ''}
      </div>
      <div class="vs-divider-col">🔥</div>
      <div class="verdict-side-card ${dClass}">
        <div class="vs-role-icon">🔵</div>
        <div class="vs-role-label">B팀</div>
        <div class="vs-name">${escHtml(session.defendant?.nickname || "B팀")}</div>
        <div class="vs-result">${dResult}</div>
        ${myRole === 'defendant' ? '<div class="vs-me-badge">나</div>' : ''}
      </div>
    </div>
    ${isWin ? `<div style="text-align:center;font-size:20px;font-weight:900;color:#27ae60;margin-bottom:14px;animation:fadeUp 0.4s both;">🎉 승리!</div>` : myRole ? `<div style="text-align:center;font-size:18px;font-weight:900;color:var(--red);margin-bottom:14px;animation:fadeUp 0.4s both;">😔 패배</div>` : ''}

    ${parts.reason ? `
      <div style="margin-bottom:8px;">
        <div class="verdict-reason-label">📝 판정 이유</div>
        <div class="verdict-text-card">${escHtml(parts.reason)}</div>
      </div>` : ''}
    ${parts.sentence ? `
      <div class="verdict-sentence">
        <div class="verdict-sentence-label">🎯 미션</div>
        <div class="verdict-sentence-text">${escHtml(parts.sentence)}</div>
      </div>` : ''}
    <div class="verdict-actions-row">
      <button id="share-verdict-btn" class="btn btn-secondary">🖼️ 이미지 카드 공유</button>
      <a href="#/topics" class="btn btn-ghost">🔥 다른 주제 보기</a>
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
    const shareBtn = card.querySelector('#share-verdict-btn');
    shareBtn.disabled = true;
    shareBtn.textContent = '⏳ 카드 생성 중...';
    trackEvent('share_card', { winner: verdict.winner || 'draw', mode: session.mode || 'friend' });
    try {
      const canvas = await generateVerdictCard(session);
      await shareVerdictCard(canvas, session);
    } catch {
      showToast('공유 실패', 'error');
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = '🖼️ 이미지 카드 공유';
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
    if (/^(판정이유|판결이유)/.test(trimmed)) {
      inReason = true;
      const content = trimmed.replace(/^(판정이유|판결이유)\s*[:\：]?\s*/, '').trim();
      if (content) reasonLines.push(content);
    } else if (/^(미션|생활형\s*처분)/.test(trimmed)) {
      inReason = false;
      sentenceLine = trimmed.replace(/^(미션|생활형\s*처분)\s*[:\：]?\s*/, '').replace(/\.$/, '').trim();
    } else if (/^(사건번호|판결|판정|A팀점수|B팀점수)\s*[:\：]/.test(trimmed)) {
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
  const roleLabel = myRole === 'plaintiff' ? '🔴 A팀' : myRole === 'defendant' ? '🔵 B팀' : '';
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
    if (myDone) waitMsg = '🔵 B팀의 반박을 기다리는 중...';
    else isMyTurn = true;
  } else if (myRole === 'defendant') {
    if (!cur.plaintiff) waitMsg = '🔴 A팀가 먼저 주장 중입니다...';
    else if (!myDone) isMyTurn = true;
    else waitMsg = '🔴 A팀의 다음 주장을 기다리는 중...';
  }

  textarea.disabled = !isMyTurn || maxReached || verdictPending;
  btn.disabled = !isMyTurn || maxReached || verdictPending;
  textarea.placeholder = isMyTurn
    ? (myRole === 'plaintiff' ? '먼저 주장을 펼치세요... (최대 200자)' : '원고 주장에 반박하세요... (최대 200자)')
    : '대기 중...';

  if (maxReached) {
    hint.textContent = '모든 라운드 완료 · 위에서 판정 요청 가능';
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
    document.fonts.load('700 58px "Noto Serif KR"'),
    document.fonts.load('700 44px "Noto Sans KR"'),
    document.fonts.load('400 34px "Noto Sans KR"'),
    document.fonts.load('700 40px "Noto Serif KR"'),
    document.fonts.ready,
  ]);

  const W = 1080;
  const PAD = 70;
  const INNER = W - PAD * 2;
  const verdict = session.verdict || {};
  const isDraw = !verdict.winner || verdict.winner === 'draw';
  const pWin = verdict.winner === 'plaintiff';
  const dWin = verdict.winner === 'defendant';
  const parts = parseVerdict(verdict.text || '');
  const judge = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;

  // 텍스트 줄 수 사전 측정 → 정확한 높이 계산
  const tmp = document.createElement('canvas').getContext('2d');
  const topicLinesM = cardWrapText(tmp, session.topicTitle || "주제", INNER, '700 44px "Noto Sans KR", sans-serif').slice(0, 2);
  const reasonFlat = parts.reason ? parts.reason.replace(/\n+/g, ' ').trim() : '';
  const reasonTrunc = reasonFlat.length > 180 ? reasonFlat.slice(0, 180) + '…' : reasonFlat;
  const reasonLinesM = reasonTrunc ? cardWrapText(tmp, reasonTrunc, INNER - 56, '400 34px "Noto Sans KR", sans-serif').slice(0, 5) : [];
  const sentLinesM = parts.sentence ? cardWrapText(tmp, parts.sentence, INNER - 56, '700 40px "Noto Serif KR", serif').slice(0, 3) : [];

  // 섹션별 높이 계산
  let yCalc = 104;
  yCalc += 60 + 48 + 54; // 제목 + 부제 + 구분선
  yCalc += topicLinesM.length * 62 + 26;
  yCalc += 40 + 44 + 128 + 36; // 구분선+판결레이블+박스+갭
  yCalc += 168 + 36; // VS 박스+갭
  if (judge) yCalc += 52;
  if (reasonLinesM.length > 0) yCalc += 44 + 50 + (reasonLinesM.length * 50 + 44) + 36;
  if (sentLinesM.length > 0) yCalc += 44 + 50 + (sentLinesM.length * 58 + 50) + 36;
  const H = Math.max(1500, yCalc + 110);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const GOLD = '#c9a84c';
  const GOLD_DIM = 'rgba(201,168,76,0.5)';
  const GOLD_BG = 'rgba(201,168,76,0.08)';
  const CREAM = '#f0e6c8';
  const CREAM_DIM = 'rgba(240,230,200,0.7)';
  const RED = '#e74c3c';
  const BLUE = '#3498db';
  const GREEN = '#27ae60';

  // 배경
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#1c1508');
  bgGrad.addColorStop(0.5, '#0d1018');
  bgGrad.addColorStop(1, '#0a0c14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 280, 0, W / 2, 280, 680);
  glow.addColorStop(0, 'rgba(201,168,76,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 테두리
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  cardRoundRect(ctx, 18, 18, W - 36, H - 36, 26); ctx.stroke();
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 1.5;
  cardRoundRect(ctx, 30, 30, W - 60, H - 60, 20); ctx.stroke();

  const sep = (yPos) => {
    ctx.strokeStyle = GOLD_DIM; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, yPos); ctx.lineTo(W - PAD, yPos); ctx.stroke();
  };

  let y = 104;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // ── 헤더 ──
  ctx.font = '700 58px "Noto Serif KR", serif';
  ctx.fillStyle = GOLD;
  ctx.fillText('🔥 소소킹 토론배틀', W / 2, y); y += 60;
  ctx.font = '400 28px "Noto Sans KR", sans-serif';
  ctx.fillStyle = GOLD_DIM;
  ctx.fillText('AI 심판 판정 결과', W / 2, y); y += 48;
  sep(y); y += 54;

  // ── 사건명 ──
  const topicFont = '700 44px "Noto Sans KR", sans-serif';
  ctx.font = topicFont; ctx.fillStyle = CREAM;
  topicLinesM.forEach(l => { ctx.fillText(l, W / 2, y); y += 62; });
  y += 26;

  // ── 최종 판정 ──
  sep(y); y += 40;
  ctx.font = '400 26px "Noto Sans KR", sans-serif';
  ctx.fillStyle = GOLD_DIM;
  ctx.fillText('🏆 최종 판정', W / 2, y); y += 44;

  const verdictColor = isDraw ? GOLD : pWin ? RED : BLUE;
  const verdictLabel = isDraw ? '🤝 무승부' : pWin ? '🔴 A팀 승리' : '🔵 B팀 승리';
  const vBoxH = 128;
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  cardRoundRect(ctx, PAD, y, INNER, vBoxH, 22); ctx.fill();
  ctx.strokeStyle = verdictColor; ctx.lineWidth = 3;
  cardRoundRect(ctx, PAD, y, INNER, vBoxH, 22); ctx.stroke();
  ctx.font = '900 64px "Noto Serif KR", serif';
  ctx.fillStyle = verdictColor;
  ctx.fillText(verdictLabel, W / 2, y + 84); y += vBoxH + 36;

  // ── VS 카드 ──
  const vsW = (INNER - 24) / 2;
  const vsH = 168;
  const drawVsBox = (x, role, nick, isWinner) => {
    const isP = role === 'plaintiff';
    ctx.fillStyle = isDraw ? GOLD_BG : isWinner ? 'rgba(39,174,96,0.09)' : 'rgba(255,255,255,0.025)';
    cardRoundRect(ctx, x, y, vsW, vsH, 18); ctx.fill();
    ctx.strokeStyle = isDraw ? GOLD_DIM : isWinner ? 'rgba(39,174,96,0.65)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    cardRoundRect(ctx, x, y, vsW, vsH, 18); ctx.stroke();
    const cx = x + vsW / 2;
    ctx.textAlign = 'center';
    ctx.font = '700 22px "Noto Sans KR", sans-serif';
    ctx.fillStyle = isP ? RED : BLUE;
    ctx.fillText(isP ? '🔴 A팀' : '🔵 B팀', cx, y + 40);
    ctx.font = '700 30px "Noto Sans KR", sans-serif';
    ctx.fillStyle = CREAM;
    ctx.fillText(nick.length > 10 ? nick.slice(0, 10) + '…' : nick, cx, y + 84);
    ctx.font = '900 34px "Noto Sans KR", sans-serif';
    ctx.fillStyle = isDraw ? GOLD : isWinner ? GREEN : RED;
    ctx.fillText(isDraw ? '무승부' : isWinner ? '🏆 승리' : '😔 패배', cx, y + 134);
  };
  drawVsBox(PAD, 'plaintiff', session.plaintiff?.nickname || "A팀", pWin);
  drawVsBox(PAD + vsW + 24, 'defendant', session.defendant?.nickname || "B팀", dWin);
  ctx.font = '900 36px "Noto Sans KR", sans-serif';
  ctx.fillStyle = GOLD_DIM; ctx.textAlign = 'center';
  ctx.fillText('VS', W / 2, y + vsH / 2 + 13); y += vsH + 36;

  // ── 판사 ──
  if (judge) {
    ctx.font = '400 27px "Noto Sans KR", sans-serif';
    ctx.fillStyle = CREAM_DIM;
    ctx.fillText(`${judge.icon} ${session.judgeType} 심판 담당`, W / 2, y); y += 52;
  }

  // ── 판정 이유 ──
  if (reasonLinesM.length > 0) {
    sep(y); y += 44;
    ctx.font = '700 34px "Noto Sans KR", sans-serif';
    ctx.fillStyle = GOLD; ctx.textAlign = 'center';
    ctx.fillText('📝 판정 이유', W / 2, y); y += 50;

    const panelH = reasonLinesM.length * 50 + 44;
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    cardRoundRect(ctx, PAD, y, INNER, panelH, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.18)'; ctx.lineWidth = 1;
    cardRoundRect(ctx, PAD, y, INNER, panelH, 16); ctx.stroke();
    ctx.fillStyle = GOLD_DIM;
    cardRoundRect(ctx, PAD, y, 5, panelH, 3); ctx.fill();

    ctx.font = '400 34px "Noto Sans KR", sans-serif';
    ctx.fillStyle = CREAM_DIM; ctx.textAlign = 'center';
    let ty = y + 32;
    reasonLinesM.forEach(line => { ctx.fillText(line, W / 2, ty); ty += 50; });
    y += panelH + 36;
  }

  // ── 미션 ──
  if (sentLinesM.length > 0) {
    sep(y); y += 44;
    ctx.font = '700 34px "Noto Sans KR", sans-serif';
    ctx.fillStyle = GOLD; ctx.textAlign = 'center';
    ctx.fillText('🎯 미션', W / 2, y); y += 50;

    const sBoxH = sentLinesM.length * 58 + 50;
    ctx.fillStyle = GOLD_BG;
    cardRoundRect(ctx, PAD, y, INNER, sBoxH, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.55)'; ctx.lineWidth = 2.5;
    cardRoundRect(ctx, PAD, y, INNER, sBoxH, 18); ctx.stroke();

    ctx.font = '700 40px "Noto Serif KR", serif';
    ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    let sy = y + 40;
    sentLinesM.forEach(line => { ctx.fillText(line, W / 2, sy); sy += 58; });
    y += sBoxH + 36;
  }

  // ── 푸터 ──
  y += 24;
  sep(y); y += 40;
  ctx.font = '700 30px "Noto Sans KR", sans-serif';
  ctx.fillStyle = GOLD; ctx.textAlign = 'center';
  ctx.fillText('🌐 sosoking.co.kr', W / 2, y);

  return canvas;
}

async function shareVerdictCard(canvas, session) {
  const isDraw = !session.verdict?.winner || session.verdict?.winner === 'draw';
  const pWin = session.verdict?.winner === 'plaintiff';
  const verdictLabel = isDraw ? '무승부' : pWin ? 'A팀 승소' : 'B팀 승소';
  const topicTitle = session.topicTitle || "주제";
  const shareTitle = `소소킹 토론배틀 - ${topicTitle}`;
  const shareText = `[소소킹 판정결과]\n📋 주제: ${topicTitle}\n⚖️ 판정: ${verdictLabel}\n\n배틀 해보기 → sosoking.co.kr`;

  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { await textFallbackShare(shareTitle, shareText); resolve(); return; }
      const file = new File([blob], 'sosoking-verdict.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: shareTitle, text: shareText });
          resolve(); return;
        } catch (err) {
          if (err.name === 'AbortError') { resolve(); return; }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sosoking-verdict.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('판정 카드가 저장되었습니다! 📸 갤러리에서 공유하세요', 'success');
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
