import { db, auth, functions } from '../firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

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
      return;
    }
    const session = snap.data();
    const uid = auth.currentUser?.uid;

    if (!myRole) {
      if (session.plaintiff?.userId === uid) myRole = 'plaintiff';
      else if (session.defendant?.userId === uid) myRole = 'defendant';
    }

    if (session.status === lastRenderedStatus && session.status !== 'active' && session.status !== 'ready_for_verdict') return;
    lastRenderedStatus = session.status;

    updateHeader(session, myRole);
    updateTopicBar(session, myRole);

    if (session.status === 'waiting') {
      renderWaiting(session, sessionId);
      removeInputArea();
    } else if (session.status === 'active' || session.status === 'ready_for_verdict') {
      renderActive(session, myRole, sessionId);
      if (!inputAttached) { attachInput(sessionId, session, myRole); inputAttached = true; }
      else updateInput(session, myRole);
    } else if (session.status === 'judging') {
      renderJudging(session);
      removeInputArea();
    } else if (session.status === 'completed') {
      renderCompleted(session, myRole);
      removeInputArea();
    }
  });

  window._pageCleanup = () => unsub();
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

  const dots = bar.querySelectorAll('.debate-round-dot');
  dots.forEach((d, i) => {
    d.classList.remove('done', 'active');
    if (i < session.currentRound) d.classList.add('done');
    else if (i === session.currentRound && session.status === 'active') d.classList.add('active');
  });

  const statusMap = {
    waiting: '상대방 대기 중...',
    active: myRole ? `${session.currentRound + 1}라운드 · ${myTurnText(session, myRole)}` : `${session.currentRound + 1}라운드 진행 중`,
    ready_for_verdict: '주장 완료 · 판결 요청 가능',
    judging: '⚖️ AI 판사 심리 중...',
    completed: '판결 완료',
  };
  statusEl.textContent = statusMap[session.status] || '';
}

function myTurnText(session, myRole) {
  if (!myRole) return '';
  const round = session.currentRound;
  const rounds = session.rounds || [];
  const submitted = rounds[round]?.[myRole];
  return submitted ? '상대방 발언 대기 중' : '내 차례';
}

function renderWaiting(session, sessionId) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  const shareUrl = `${location.origin}${location.pathname}#/join/${session.shareToken}`;
  feed.innerHTML = `
    <div class="waiting-screen">
      <span class="waiting-icon">⏳</span>
      <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--cream);margin-bottom:8px;">상대방을 기다리는 중</div>
      <p style="font-size:14px;color:var(--cream-dim);line-height:1.7;margin-bottom:20px;">${escHtml(session.topicTitle)}</p>
      <div style="font-size:13px;color:var(--gold);font-weight:700;margin-bottom:8px;">아래 링크를 친구에게 전송하세요</div>
      <div class="waiting-link-box" id="share-link">${shareUrl}</div>
      <button id="copy-link-btn" class="btn btn-primary" style="margin-bottom:12px;">🔗 링크 복사하기</button>
      ${navigator.share ? `<button id="native-share-btn" class="btn btn-secondary">📤 공유하기</button>` : ''}
      <p style="margin-top:20px;font-size:12px;color:var(--cream-dim);">링크를 받은 친구가 참가하면 자동으로 시작됩니다</p>
    </div>
  `;
  document.getElementById('copy-link-btn')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl); showToast('링크가 복사되었습니다!', 'success'); }
    catch { showToast('복사 실패. 직접 복사해주세요.', 'error'); }
  });
  document.getElementById('native-share-btn')?.addEventListener('click', async () => {
    try { await navigator.share({ title: `소소킹 생활법정 - ${session.topicTitle}`, url: shareUrl }); }
    catch { /* cancelled */ }
  });
}

function renderActive(session, myRole, sessionId) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;

  const rounds = session.rounds || [];
  let html = '';

  if (session.status !== 'ready_for_verdict') {
    const curRound = session.currentRound || 0;
    const curData = rounds[curRound] || {};
    const pSubmitted = !!curData.plaintiff;
    const dSubmitted = !!curData.defendant;
    html += `<div class="round-status-row">
      <div class="round-status-chip ${pSubmitted ? 'submitted' : 'waiting'}">
        <div class="chip-role" style="color:#e74c3c;">⚔️ 원고</div>
        <div class="chip-state">${pSubmitted ? '✓ 주장 완료' : '✏️ 작성 중...'}</div>
      </div>
      <div class="round-status-chip ${dSubmitted ? 'submitted' : 'waiting'}">
        <div class="chip-role" style="color:#3498db;">🛡️ 피고</div>
        <div class="chip-state">${dSubmitted ? '✓ 주장 완료' : '✏️ 작성 중...'}</div>
      </div>
    </div>`;
  }

  rounds.forEach((r, i) => {
    if (i > 0) html += `<div class="round-separator">${i + 1}라운드</div>`;
    if (r.plaintiff) {
      const isMine = myRole === 'plaintiff';
      html += `<div>
        <div class="argument-bubble ${isMine ? 'mine' : 'opponent'}">${escHtml(r.plaintiff)}</div>
        <div class="argument-meta ${isMine ? 'right' : ''}">⚔️ ${escHtml(session.plaintiff?.nickname || '원고')}</div>
      </div>`;
    }
    if (r.defendant) {
      const isMine = myRole === 'defendant';
      html += `<div>
        <div class="argument-bubble ${isMine ? 'mine' : 'opponent'}">${escHtml(r.defendant)}</div>
        <div class="argument-meta ${isMine ? 'right' : ''}">🛡️ ${escHtml(session.defendant?.nickname || '피고')}</div>
      </div>`;
    }
  });

  if (!rounds.length) {
    html += `<div style="text-align:center;padding:32px 0 16px;color:var(--cream-dim);font-size:14px;">
      <div style="font-size:32px;margin-bottom:12px;">⚖️</div>
      재판이 시작되었습니다!<br>먼저 주장을 입력하세요.
    </div>`;
  }

  feed.innerHTML = html;
  feed.scrollTop = feed.scrollHeight;

  if (session.status === 'ready_for_verdict') {
    const btnWrap = document.createElement('div');
    btnWrap.id = 'verdict-btn-wrap';
    btnWrap.style.cssText = 'padding:8px 0 16px;';
    btnWrap.innerHTML = `
      <div style="text-align:center;font-size:13px;color:var(--gold);font-weight:700;margin-bottom:12px;">양측 주장이 모두 완료됐습니다!</div>
      <button id="verdict-request-btn" class="btn btn-primary">⚖️ AI 판사 판결 요청하기</button>`;
    feed.appendChild(btnWrap);
    document.getElementById('verdict-request-btn')?.addEventListener('click', async () => {
      const b = document.getElementById('verdict-request-btn');
      if (b) { b.disabled = true; b.textContent = '⏳ 판사 심리 중...'; }
      try {
        const requestVerdict = httpsCallable(functions, 'requestVerdict');
        await requestVerdict({ sessionId });
      } catch (err) {
        showToast(err.message || '오류 발생', 'error');
        if (b) { b.disabled = false; b.textContent = '⚖️ AI 판사 판결 요청하기'; }
      }
    });
  }
}

function renderJudging(session) {
  const feed = document.getElementById('debate-feed');
  if (!feed) return;
  const existing = feed.querySelector('#judging-card');
  if (existing) return;
  const card = document.createElement('div');
  card.id = 'judging-card';
  card.style.cssText = 'text-align:center;padding:40px 20px;';
  card.innerHTML = `
    <div style="font-size:48px;margin-bottom:16px;animation:waitingPulse 1.5s ease-in-out infinite;">⚖️</div>
    <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;color:var(--cream);margin-bottom:8px;">AI 판사 심리 중</div>
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

  const verdict = session.verdict;
  if (!verdict) return;

  let winnerIcon = '🤝';
  let winnerLabel = '무승부';
  let winnerName = '팽팽한 접전';
  let myResultText = '';
  let myResultColor = 'var(--gold)';
  let isWin = false;

  if (verdict.winner === 'plaintiff') {
    winnerIcon = '⚔️'; winnerLabel = '원고 승소';
    winnerName = escHtml(session.plaintiff?.nickname || '원고');
    if (myRole === 'plaintiff') { myResultText = '🎉 승소!'; myResultColor = '#27ae60'; isWin = true; }
    else if (myRole === 'defendant') { myResultText = '😔 패소'; myResultColor = 'var(--red)'; }
  } else if (verdict.winner === 'defendant') {
    winnerIcon = '🛡️'; winnerLabel = '피고 승소';
    winnerName = escHtml(session.defendant?.nickname || '피고');
    if (myRole === 'defendant') { myResultText = '🎉 승소!'; myResultColor = '#27ae60'; isWin = true; }
    else if (myRole === 'plaintiff') { myResultText = '😔 패소'; myResultColor = 'var(--red)'; }
  }

  const parts = parseVerdict(verdict.text || '');
  const caseNo = verdict.caseNumber || '';
  const topicTitle = session.topicTitle || '사건';

  const card = document.createElement('div');
  card.className = 'verdict-reveal';
  card.style.cssText = 'padding:0 0 20px;';
  card.innerHTML = `
    ${caseNo ? `<div class="verdict-case-no">${escHtml(caseNo)}</div>` : ''}
    <div style="text-align:center;margin-bottom:12px;font-size:11px;color:var(--cream-dim);letter-spacing:.1em;">⚖️ 최종 판결</div>
    <div class="verdict-winner${isWin ? ' won' : ''}">
      <span class="verdict-winner-icon">${winnerIcon}</span>
      <div class="verdict-winner-label">${winnerLabel}</div>
      <div class="verdict-winner-name">${winnerName}</div>
      ${myResultText ? `<div class="verdict-my-result" style="color:${myResultColor};">${myResultText}</div>` : ''}
    </div>
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
      <button id="share-verdict-btn" class="btn btn-secondary">📤 판결 결과 공유하기</button>
      <a href="#/topics" class="btn btn-ghost">⚖️ 다른 사건 보기</a>
    </div>
  `;
  feed.appendChild(card);
  feed.scrollTop = feed.scrollHeight;

  card.querySelector('#share-verdict-btn')?.addEventListener('click', async () => {
    const text = `소소킹 생활법정 판결 결과\n📋 사건: ${topicTitle}\n⚖️ 판결: ${winnerLabel}${parts.sentence ? '\n📜 처분: ' + parts.sentence : ''}\n\n재판 받아보기 → ${location.origin}${location.pathname}`;
    if (navigator.share) {
      try { await navigator.share({ title: '소소킹 생활법정', text, url: location.origin + location.pathname }); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(text); showToast('결과가 복사되었습니다!', 'success'); }
    catch { showToast('공유 실패', 'error'); }
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
  area.innerHTML = `
    <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;text-align:center;" id="input-hint"></div>
    <div class="debate-input-row">
      <textarea class="debate-textarea" id="arg-input" placeholder="주장을 입력하세요... (최대 200자)" maxlength="200" rows="1"></textarea>
      <button class="debate-send-btn" id="send-btn">↑</button>
    </div>
    <div style="text-align:right;font-size:11px;color:var(--cream-dim);margin-top:4px;"><span id="char-count">0</span>/200</div>
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

  const round = session.currentRound;
  const rounds = session.rounds || [];
  const alreadySubmitted = rounds[round]?.[myRole];
  const isMyTurn = !alreadySubmitted;
  const maxReached = session.status === 'ready_for_verdict';

  textarea.disabled = !isMyTurn || maxReached;
  btn.disabled = !isMyTurn || maxReached;

  if (maxReached) {
    hint.textContent = '모든 라운드 완료 · 위에서 판결 요청 가능';
  } else if (!isMyTurn) {
    hint.textContent = '상대방 발언을 기다리는 중...';
  } else {
    hint.textContent = `${round + 1}라운드 · 내 차례 (${myRole === 'plaintiff' ? '원고' : '피고'})`;
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
