import { db, auth, functions, trackEvent } from '../firebase.js';
import { doc, onSnapshot, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
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
  let isSpectator = false;
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

    if (!myRole && !isSpectator) {
      if (session.plaintiff?.userId === uid) myRole = 'plaintiff';
      else if (session.defendant?.userId === uid) myRole = 'defendant';
      else if (uid) isSpectator = true;
    }

    if (session.status === lastRenderedStatus && session.status !== 'active' && session.status !== 'ready_for_verdict' && session.status !== 'verdict_requested') return;

    if (lastRenderedStatus === 'waiting' && session.status === 'active') {
      showBattleStart(session);
    }

    lastRenderedStatus = session.status;

    if (['completed', 'cancelled'].includes(session.status)) {
      clearActiveSession(sessionId);
    } else if (myRole) {
      saveActiveSession(sessionId, session.topicTitle, myRole);
    }

    updateHeader(session, myRole, isSpectator);
    updateTopicBar(session, myRole, isSpectator);

    if (session.status === 'waiting') {
      if (myRole) renderWaiting(session, sessionId);
      else renderSpectatorWaiting(session);
      removeInputArea();
    } else if (session.status === 'active' || session.status === 'ready_for_verdict' || session.status === 'verdict_requested') {
      renderActive(session, myRole, sessionId, isSpectator);
      if (isSpectator) attachSpectatorVote(sessionId, session);
      if (!inputAttached && myRole) { attachInput(sessionId, session, myRole); inputAttached = true; }
      else if (myRole) updateInput(session, myRole);
    } else if (session.status === 'judging') {
      renderJudging(session);
      removeInputArea();
    } else if (session.status === 'completed') {
      renderCompleted(session, myRole, isSpectator);
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

function updateTopicBar(session, myRole, isSpectator) {
  const el = document.getElementById('debate-topic-bar');
  if (!el || !session.topicTitle) return;
  if (session.status === 'waiting') { el.innerHTML = ''; return; }
  const roleClass = myRole === 'plaintiff' ? 'plaintiff' : myRole === 'defendant' ? 'defendant' : '';
  const roleLabel = myRole === 'plaintiff' ? '🔴 A팀' : myRole === 'defendant' ? '🔵 B팀' : isSpectator ? '👀 관전 중' : '';
  const spectatorStyle = isSpectator ? 'background:rgba(255,255,255,0.06);color:var(--cream-dim);' : '';
  el.innerHTML = `<div class="debate-topic-bar-inner">
    <span class="debate-topic-name">📋 ${escHtml(session.topicTitle)}</span>
    ${roleLabel ? `<span class="debate-my-role ${roleClass}" style="${spectatorStyle}">${roleLabel}</span>` : ''}
  </div>`;
}

function updateHeader(session, myRole, isSpectator) {
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
    active: myRole ? `${session.currentRound + 1}라운드 · ${myTurnText(session, myRole)}` : isSpectator ? `👀 ${session.currentRound + 1}라운드 관전 중` : `${session.currentRound + 1}라운드 진행 중`,
    ready_for_verdict: '주장 완료 · 판정 요청 가능',
    verdict_requested: '🔥 판정 요청 중 · 상대방 동의 대기',
    judging: '🔥 AI 심판 판정 중...',
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

function renderSpectatorWaiting(session) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  feed.innerHTML = `
    <div style="text-align:center;padding:60px 20px;">
      <div style="font-size:52px;margin-bottom:16px;">⏳</div>
      <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--cream);margin-bottom:8px;">배틀 시작 전입니다</div>
      <p style="font-size:14px;color:var(--cream-dim);margin-bottom:6px;">${escHtml(session.topicTitle || '')}</p>
      <p style="font-size:13px;color:var(--cream-dim);margin-bottom:24px;">상대방 참가를 기다리는 중...</p>
      <div style="font-size:12px;color:var(--cream-dim);padding:12px 16px;border-radius:10px;border:1px solid var(--border);display:inline-block;">
        👀 참가자가 들어오면 실시간으로 배틀을 관전할 수 있어요
      </div>
    </div>
  `;
}

function renderWaiting(session, sessionId) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  const shareUrl = `${location.origin}${location.pathname}#/join/${session.shareToken}`;
  const shareTitle = `소소킹 토론배틀 - ${session.topicTitle}`;
  const shareText = `[소소킹 토론배틀] "${session.topicTitle}" 배틀에 초대합니다! 아래 링크를 눌러 참가해주세요 🔥`;
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

function renderActive(session, myRole, sessionId, isSpectator) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;

  const rounds = session.rounds || [];
  const judge = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;
  let html = '';
  if (isSpectator) {
    const mySpecVote = getSpecVote(sessionId);
    const sVotesA = session.spectatorVotesA || 0;
    const sVotesB = session.spectatorVotesB || 0;
    const sTotal = sVotesA + sVotesB;
    if (mySpecVote) {
      const pct = sTotal > 0 ? Math.round((sVotesA / sTotal) * 100) : 50;
      html += `
        <div style="padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);margin-bottom:12px;">
          <div style="font-size:11px;color:var(--cream-dim);text-align:center;margin-bottom:8px;">🔮 관중 예측 현황 (${sTotal.toLocaleString()}명)</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:5px;">
            <span style="color:#e74c3c;">🔴 A팀 ${pct}%</span>
            <span style="color:#3498db;">🔵 B팀 ${100 - pct}%</span>
          </div>
          <div style="height:8px;border-radius:4px;overflow:hidden;display:flex;background:rgba(255,255,255,0.06);">
            <div style="width:${pct}%;background:linear-gradient(90deg,#e74c3c,#ff6b6b);"></div>
            <div style="width:${100 - pct}%;background:linear-gradient(90deg,#3498db,#5dade2);"></div>
          </div>
          <div style="text-align:center;font-size:10px;color:var(--cream-dim);margin-top:5px;">내 예측: ${mySpecVote === 'A' ? '🔴 A팀' : '🔵 B팀'} 승리</div>
        </div>`;
    } else {
      html += `
        <div style="padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);margin-bottom:12px;text-align:center;">
          <div style="font-size:12px;color:var(--cream-dim);margin-bottom:10px;">🔮 누가 이길 것 같나요?</div>
          <div style="display:flex;gap:8px;">
            <button id="spec-vote-a" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid rgba(231,76,60,0.5);background:rgba(231,76,60,0.08);color:#e74c3c;font-size:13px;font-weight:700;cursor:pointer;">🔴 A팀 승리 예측</button>
            <button id="spec-vote-b" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid rgba(52,152,219,0.5);background:rgba(52,152,219,0.08);color:#3498db;font-size:13px;font-weight:700;cursor:pointer;">🔵 B팀 승리 예측</button>
          </div>
        </div>`;
    }
  }

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
  if (hasCompleteRound && myRole) {
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

  // 세션 종료 버튼 (참가자에게만 표시)
  if (!feed.querySelector('#cancel-active-wrap') && session.status !== 'judging' && myRole) {
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

function renderCompleted(session, myRole, isSpectator) {
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
    ${isWin ? `<div style="text-align:center;font-size:20px;font-weight:900;color:#27ae60;margin-bottom:14px;animation:fadeUp 0.4s both;">🎉 승리!</div>` : myRole ? `<div style="text-align:center;font-size:18px;font-weight:900;color:var(--red);margin-bottom:14px;animation:fadeUp 0.4s both;">😔 패배</div>` : isSpectator ? `<div style="text-align:center;font-size:12px;color:var(--cream-dim);margin-bottom:14px;">👀 관전한 배틀의 최종 판정 결과입니다</div>` : ''}

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
    ${(() => {
      const sVotesA = session.spectatorVotesA || 0;
      const sVotesB = session.spectatorVotesB || 0;
      const sTotal = sVotesA + sVotesB;
      if (sTotal >= 2) {
        const sPct = Math.round((sVotesA / sTotal) * 100);
        const crowdPicked = sVotesA >= sVotesB ? 'plaintiff' : 'defendant';
        const crowdRight = crowdPicked === verdict.winner;
        return `<div style="margin-bottom:16px;padding:12px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);">
          <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;text-align:center;">👥 관중 예측 결과 (${sTotal.toLocaleString()}명)</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:5px;">
            <span style="color:#e74c3c;">🔴 A팀 ${sPct}%</span>
            <span style="color:#3498db;">🔵 B팀 ${100 - sPct}%</span>
          </div>
          <div style="height:7px;border-radius:4px;overflow:hidden;display:flex;background:rgba(255,255,255,0.06);">
            <div style="width:${sPct}%;background:linear-gradient(90deg,#e74c3c,#ff6b6b);"></div>
            <div style="width:${100 - sPct}%;background:linear-gradient(90deg,#3498db,#5dade2);"></div>
          </div>
          <div style="text-align:center;font-size:11px;margin-top:6px;color:${crowdRight ? '#27ae60' : '#e74c3c'};font-weight:700;">${crowdRight ? '✅ 관중 예측 적중!' : '😱 AI 판정이 관중 예측을 뒤집었어요!'}</div>
        </div>`;
      }
      return '';
    })()}
    <div class="verdict-actions-row">
      <button id="share-text-btn" class="btn btn-secondary">📋 결과 텍스트 공유</button>
      <button id="share-verdict-btn" class="btn btn-secondary">🖼️ 이미지 카드</button>
    </div>
    <a href="#/topics" class="btn btn-ghost" style="margin-top:8px;">🔥 다른 주제 보기</a>
  `;
  feed.appendChild(card);
  feed.scrollTop = feed.scrollHeight;

  if (verdict.winner) launchConfetti(verdict.winner);

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
    shareBtn.textContent = '⏳ 생성 중...';
    trackEvent('share_card', { winner: verdict.winner || 'draw', mode: session.mode || 'friend' });
    try {
      const canvas = await generateVerdictCard(session);
      await shareVerdictCard(canvas, session);
    } catch {
      showToast('공유 실패', 'error');
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = '🖼️ 이미지 카드';
    }
  });

  card.querySelector('#share-text-btn')?.addEventListener('click', async () => {
    const isDraw = !verdict.winner || verdict.winner === 'draw';
    const pWin = verdict.winner === 'plaintiff';
    const winnerLabel = isDraw ? '🤝 무승부' : pWin ? '🔴 A팀 승리' : '🔵 B팀 승리';
    const pScore = verdict.scores?.plaintiff ?? (pWin ? 60 : isDraw ? 50 : 40);
    const dScore = 100 - pScore;
    const parts = parseVerdict(verdict.text || '');
    const snippet = parts.reason ? parts.reason.slice(0, 60) + (parts.reason.length > 60 ? '...' : '') : '';
    const link = `${location.origin}/#/debate/${session.id || ''}`;
    const text = `⚖️ 소소킹 배틀 판정 결과\n\n📋 ${session.topicTitle || '배틀'}\n${winnerLabel} (${pScore}:${dScore})\n\n${snippet ? `"${snippet}"\n\n` : ''}지금 배틀하러 가기 → ${location.origin}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('복사됐어요! 카톡에 붙여넣기 하세요 💬', 'success');
    } catch {
      showToast('복사 실패. 직접 선택해서 복사해주세요', 'error');
    }
  });
}

function getSpecVote(sessionId) {
  try { return localStorage.getItem(`sosoking_specvote_${sessionId}`); } catch { return null; }
}

function attachSpectatorVote(sessionId, session) {
  const castVote = async (side) => {
    if (getSpecVote(sessionId)) return;
    try { localStorage.setItem(`sosoking_specvote_${sessionId}`, side); } catch {}
    try {
      await updateDoc(doc(db, 'debate_sessions', sessionId), {
        [`spectatorVotes${side}`]: increment(1),
      });
    } catch {}
  };
  document.getElementById('spec-vote-a')?.addEventListener('click', () => castVote('A'));
  document.getElementById('spec-vote-b')?.addEventListener('click', () => castVote('B'));
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
      <textarea class="debate-textarea" id="arg-input" placeholder="재밌게 쓸수록 유리해요 😄 (최대 200자)" maxlength="200" rows="1"></textarea>
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

  // 순서: A팀 먼저 주장 → B팀 반박
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
    ? (myRole === 'plaintiff' ? '재밌게 주장할수록 유리해요 😄 (최대 200자)' : '재치있게 반박하세요! 진지하면 감점 (최대 200자)')
    : '대기 중...';

  if (maxReached) {
    hint.textContent = '모든 라운드 완료 · 위에서 판정 요청 가능';
  } else if (verdictPending) {
    hint.textContent = '🔥 판정 요청 처리 중...';
  } else if (!isMyTurn) {
    hint.textContent = waitMsg;
  } else {
    const turnLabel = myRole === 'plaintiff' ? 'A팀이 먼저 주장' : 'B팀 반박';
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

function showBattleStart(session) {
  if (document.getElementById('battle-start-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'battle-start-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(13,17,23,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9998;pointer-events:none;';
  document.body.appendChild(overlay);

  const steps = [
    { text: '3', cls: 'cd-num', color: 'var(--gold)' },
    { text: '2', cls: 'cd-num', color: 'var(--gold)' },
    { text: '1', cls: 'cd-num', color: 'var(--gold)' },
    { text: '⚔️ 배틀!', cls: 'cd-go', color: '#fff' },
  ];
  let i = 0;

  function tick() {
    const s = steps[i];
    overlay.innerHTML = `
      <div class="${s.cls}" style="font-size:${s.cls === 'cd-go' ? '56px' : '100px'};font-weight:900;color:${s.color};text-align:center;line-height:1;text-shadow:0 0 40px currentColor;">${s.text}</div>
      ${i === 3 ? `<div style="font-size:13px;color:var(--cream-dim);margin-top:16px;animation:fadeUp 0.3s both;max-width:260px;text-align:center;">${escHtml(session.topicTitle || '')}</div>` : ''}
    `;
    i++;
    if (i < steps.length) setTimeout(tick, 700);
    else setTimeout(() => overlay.remove(), 1000);
  }
  tick();
}

function launchConfetti(winner) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const palette = winner === 'plaintiff'
    ? ['#e74c3c', '#ff6b6b', '#c9a84c', '#ffffff']
    : winner === 'defendant'
    ? ['#3498db', '#5dade2', '#c9a84c', '#ffffff']
    : ['#c9a84c', '#e8c97a', '#f39c12', '#ffffff'];

  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * -0.3 - 10,
    w: Math.random() * 10 + 4,
    h: Math.random() * 6 + 3,
    color: palette[Math.floor(Math.random() * palette.length)],
    vx: (Math.random() - 0.5) * 5,
    vy: Math.random() * 3 + 1.5,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 9,
    opacity: 1,
  }));

  let frame = 0;
  const MAX = 180;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.rot += p.rotV;
      if (frame > MAX * 0.55) p.opacity = Math.max(0, p.opacity - 0.018);
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (frame < MAX) requestAnimationFrame(tick);
    else canvas.remove();
  }
  requestAnimationFrame(tick);
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
    document.fonts.load('900 80px "Noto Serif KR"'),
    document.fonts.load('700 48px "Noto Sans KR"'),
    document.fonts.load('400 36px "Noto Sans KR"'),
    document.fonts.ready,
  ]);

  const W = 1080, H = 1440, PAD = 68, INNER = W - PAD * 2;
  const verdict = session.verdict || {};
  const isDraw  = !verdict.winner || verdict.winner === 'draw';
  const pWin    = verdict.winner === 'plaintiff';
  const scores  = verdict.scores || {};
  const pScore  = scores.plaintiff ?? (pWin ? 62 : isDraw ? 50 : 38);
  const dScore  = scores.defendant ?? (100 - pScore);
  const parts   = parseVerdict(verdict.text || '');
  const judge   = session.judgeType ? JUDGE_DEFS[session.judgeType] : null;

  // 승자 색상
  const ACCENT  = isDraw ? '#c9a84c' : pWin ? '#e74c3c' : '#3498db';
  const ACCENT2 = isDraw ? '#f0c060' : pWin ? '#ff7f7f' : '#70c0f0';
  const GOLD = '#c9a84c', GOLD_DIM = 'rgba(201,168,76,0.45)', CREAM = '#f0e6c8', CREAM_DIM = 'rgba(240,230,200,0.65)';

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── 배경 ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#13111e');
  bg.addColorStop(0.6, '#0c0f1a');
  bg.addColorStop(1,   '#080b12');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // 승자 색 상단 글로우
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 820);
  glow.addColorStop(0,   isDraw ? 'rgba(201,168,76,0.30)' : pWin ? 'rgba(231,76,60,0.28)' : 'rgba(52,152,219,0.28)');
  glow.addColorStop(0.6, 'rgba(0,0,0,0.05)');
  glow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // 하단 미션 글로우 (골드)
  const glow2 = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 500);
  glow2.addColorStop(0, 'rgba(201,168,76,0.12)');
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, H);

  // 외곽 테두리
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 5;
  cardRoundRect(ctx, 16, 16, W - 32, H - 32, 28); ctx.stroke();
  ctx.strokeStyle = isDraw ? GOLD_DIM : pWin ? 'rgba(231,76,60,0.3)' : 'rgba(52,152,219,0.3)';
  ctx.lineWidth = 1.5;
  cardRoundRect(ctx, 28, 28, W - 56, H - 56, 22); ctx.stroke();

  const wrap = (text, maxW, font, maxLines = 99) => {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxW) return [text];
    const lines = []; let line = '';
    for (const ch of [...text]) {
      const t = line + ch;
      if (ctx.measureText(t).width > maxW) { if (line) lines.push(line); line = ch; }
      else line = t;
    }
    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  };

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let y = 72;

  // ── 헤더 ──
  ctx.font = '700 26px "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(240,230,200,0.35)';
  const caseNo = verdict.caseNumber ? `${verdict.caseNumber}` : '소소킹 토론배틀';
  ctx.fillText(caseNo, W / 2, y); y += 44;

  // ── 승자 히어로 ──
  const winnerLabel = isDraw ? '🤝 무승부' : pWin ? '🔴 A팀 승리' : '🔵 B팀 승리';
  ctx.font = '900 94px "Noto Serif KR", serif';
  ctx.fillStyle = ACCENT2;
  // 그림자
  ctx.shadowColor = ACCENT; ctx.shadowBlur = 32;
  ctx.fillText(winnerLabel, W / 2, y + 86); y += 110;
  ctx.shadowBlur = 0;

  // 닉네임 행
  const pNick = (session.plaintiff?.nickname || 'A팀').slice(0, 10);
  const dNick = (session.defendant?.nickname || 'B팀').slice(0, 10);
  ctx.font = '400 28px "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(231,76,60,0.85)';
  ctx.textAlign = 'left'; ctx.fillText(`🔴 ${pNick}`, PAD, y);
  ctx.fillStyle = 'rgba(52,152,219,0.85)';
  ctx.textAlign = 'right'; ctx.fillText(`${dNick} 🔵`, W - PAD, y);
  ctx.textAlign = 'center'; y += 44;

  // ── 점수 바 ──
  const barH = 18, barR = 9;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  cardRoundRect(ctx, PAD, y, INNER, barH, barR); ctx.fill();
  // A팀
  const pW = Math.round(INNER * pScore / 100) - 3;
  const dW = INNER - pW - 6;
  if (pW > 0) {
    const pg = ctx.createLinearGradient(PAD, 0, PAD + pW, 0);
    pg.addColorStop(0, '#e74c3c'); pg.addColorStop(1, '#ff7f7f');
    ctx.fillStyle = pg; cardRoundRect(ctx, PAD, y, pW, barH, barR); ctx.fill();
  }
  if (dW > 0) {
    const dg = ctx.createLinearGradient(W - PAD - dW, 0, W - PAD, 0);
    dg.addColorStop(0, '#5dade2'); dg.addColorStop(1, '#3498db');
    ctx.fillStyle = dg; cardRoundRect(ctx, PAD + pW + 6, y, dW, barH, barR); ctx.fill();
  }
  y += barH + 16;
  ctx.font = '700 28px "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(231,76,60,0.9)'; ctx.textAlign = 'left';
  ctx.fillText(`${pScore}점`, PAD, y);
  ctx.fillStyle = 'rgba(52,152,219,0.9)'; ctx.textAlign = 'right';
  ctx.fillText(`${dScore}점`, W - PAD, y);
  ctx.textAlign = 'center'; y += 40;

  // ── 주제명 ──
  const topicLines = wrap(session.topicTitle || '배틀 주제', INNER, '700 38px "Noto Sans KR", sans-serif', 2);
  ctx.font = '700 38px "Noto Sans KR", sans-serif'; ctx.fillStyle = 'rgba(240,230,200,0.75)';
  topicLines.forEach(l => { ctx.fillText(l, W / 2, y); y += 52; });
  y += 16;

  // 구분선
  const sep = (yy, opacity = 0.3) => {
    ctx.strokeStyle = `rgba(201,168,76,${opacity})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, yy); ctx.lineTo(W - PAD, yy); ctx.stroke();
  };
  sep(y); y += 40;

  // ── 심판 + 어록 ──
  if (judge) {
    ctx.font = '700 30px "Noto Sans KR", sans-serif';
    ctx.fillStyle = judge.color || GOLD;
    ctx.fillText(`${judge.icon}  ${session.judgeType} 심판의 판정`, W / 2, y); y += 50;
  }

  if (parts.reason) {
    // 첫 문장 or 앞 110자만 뽑아서 인용구로
    const flat  = parts.reason.replace(/\n+/g, ' ').trim();
    const dot   = flat.search(/[.!?。]/);
    const quote = dot > 0 && dot < 120 ? flat.slice(0, dot + 1) : flat.slice(0, 110) + (flat.length > 110 ? '…' : '');
    const qLines = wrap(`"${quote}"`, INNER - 60, '400 34px "Noto Sans KR", sans-serif', 4);

    const qBoxH = qLines.length * 52 + 56;
    // 말풍선 배경
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    cardRoundRect(ctx, PAD, y, INNER, qBoxH, 18); ctx.fill();
    // 왼쪽 악센트 바
    ctx.fillStyle = ACCENT;
    cardRoundRect(ctx, PAD, y, 5, qBoxH, 3); ctx.fill();

    ctx.font = '400 34px "Noto Sans KR", sans-serif'; ctx.fillStyle = CREAM_DIM;
    let qy = y + 38;
    qLines.forEach(l => { ctx.fillText(l, W / 2, qy); qy += 52; });
    y += qBoxH + 32;

    // 나머지 판정문 (2줄까지)
    if (flat.length > quote.replace(/^"|"$/g, '').length + 5) {
      const rest = flat.slice(quote.replace(/^"|"$/g, '').length).trim();
      const restLines = wrap(rest, INNER, '400 30px "Noto Sans KR", sans-serif', 2);
      ctx.font = '400 30px "Noto Sans KR", sans-serif'; ctx.fillStyle = 'rgba(240,230,200,0.45)';
      restLines.forEach(l => { ctx.fillText(l, W / 2, y); y += 44; });
      y += 8;
    }
  }

  // ── 미션 ──
  if (parts.sentence) {
    sep(y, 0.4); y += 36;
    ctx.font = '700 30px "Noto Sans KR", sans-serif'; ctx.fillStyle = GOLD;
    ctx.fillText('🎯 미션', W / 2, y); y += 44;

    const mLines = wrap(parts.sentence, INNER - 56, '700 36px "Noto Serif KR", serif', 3);
    const mBoxH  = mLines.length * 54 + 48;
    ctx.fillStyle = 'rgba(201,168,76,0.08)';
    cardRoundRect(ctx, PAD, y, INNER, mBoxH, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.5)'; ctx.lineWidth = 2;
    cardRoundRect(ctx, PAD, y, INNER, mBoxH, 18); ctx.stroke();
    ctx.font = '700 36px "Noto Serif KR", serif'; ctx.fillStyle = CREAM;
    let my = y + 38;
    mLines.forEach(l => { ctx.fillText(l, W / 2, my); my += 54; });
    y += mBoxH + 32;
  }

  // ── 푸터 ──
  const footerY = H - 70;
  sep(footerY - 30, 0.25);
  ctx.font = '700 28px "Noto Sans KR", sans-serif'; ctx.fillStyle = GOLD;
  ctx.fillText('⚔️  sosoking.co.kr  — 나도 배틀하기', W / 2, footerY);

  return canvas;
}

async function shareVerdictCard(canvas, session) {
  const isDraw = !session.verdict?.winner || session.verdict?.winner === 'draw';
  const pWin = session.verdict?.winner === 'plaintiff';
  const verdictLabel = isDraw ? '무승부' : pWin ? 'A팀 승리' : 'B팀 승리';
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
