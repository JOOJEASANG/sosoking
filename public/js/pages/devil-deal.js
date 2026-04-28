import { db, auth, functions, trackEvent } from '../firebase.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

export async function renderDevilDeal(container, dealId) {
  if (dealId) {
    await renderDealResult(container, dealId);
    return;
  }

  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">😈 악마와의 거래</span>
      </div>
      <div class="container" style="padding-top:28px;padding-bottom:80px;">

        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:64px;margin-bottom:10px;animation:crownBounce 2s ease-in-out infinite;display:inline-block;filter:drop-shadow(0 0 20px rgba(239,68,68,0.5));">😈</div>
          <h2 style="font-family:var(--font-serif);font-size:24px;font-weight:700;color:var(--devil);margin-bottom:8px;">악마와의 거래</h2>
          <p style="font-size:14px;color:var(--text-dim);line-height:1.7;">소원 하나 들어드리겠습니다.<br>단... <strong style="color:var(--devil);">조건이 있습니다 😈</strong></p>
        </div>

        <div class="card" style="border-color:rgba(239,68,68,0.4);background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.02));margin-bottom:20px;">
          <label class="form-label" style="color:var(--devil);">🕯️ 소원을 말하거라</label>
          <textarea class="form-textarea" id="wish-input"
            placeholder="예) 친구가 먼저 카톡을 보내게 해주세요&#10;예) 내일 일어나서 배가 안 고팠으면&#10;예) 엄마한테 혼나지 않았으면"
            style="min-height:110px;border-color:rgba(239,68,68,0.25);"></textarea>
          <div class="char-counter"><span id="wish-char">0</span>/80</div>
        </div>

        <div id="devil-msg" style="text-align:center;font-size:13px;min-height:18px;color:var(--red);margin-bottom:12px;"></div>
        <button id="deal-btn" class="btn btn-primary" style="background:var(--devil);color:#fff;box-shadow:0 2px 18px var(--devil-glow);">😈 거래 요청하기</button>

        <div style="text-align:center;margin-top:16px;font-size:12px;color:var(--text-dim);">
          완성된 거래 조건을 친구에게 공유해서 투표받을 수 있어요!
        </div>
      </div>
    </div>
  `;

  const textarea = container.querySelector('#wish-input');
  const charEl   = container.querySelector('#wish-char');
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charEl.textContent = len;
    charEl.parentElement.className = 'char-counter' + (len > 80 ? ' over' : '');
  });

  container.querySelector('#deal-btn').addEventListener('click', async () => {
    const wish  = textarea.value.trim();
    const msgEl = container.querySelector('#devil-msg');
    if (!wish) { msgEl.textContent = '소원을 입력해주세요'; return; }
    if (wish.length > 80) { msgEl.textContent = '80자 이내로 입력해주세요'; return; }
    msgEl.textContent = '';
    const btn = container.querySelector('#deal-btn');
    btn.disabled = true; btn.textContent = '😈 조건 협상 중...';
    try {
      trackEvent('devil_deal_request');
      const generateDevilDeal = httpsCallable(functions, 'generateDevilDeal');
      const res = await generateDevilDeal({ wish });
      location.hash = `#/devil-deal/${res.data.dealId}`;
    } catch (err) {
      showToast(err.message || '거래 요청 실패', 'error');
      btn.disabled = false; btn.textContent = '😈 거래 요청하기';
    }
  });
}

async function renderDealResult(container, dealId) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/devil-deal" class="back-btn">‹</a>
        <span class="logo">😈 거래 조건</span>
      </div>
      <div class="container" style="padding-top:24px;padding-bottom:80px;">
        <div class="loading-dots" style="padding:60px 0;"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;

  try {
    const snap = await getDoc(doc(db, 'devil_deals', dealId));
    if (!snap.exists()) {
      container.querySelector('.container').innerHTML = `<div class="empty-state"><span class="empty-state-icon">😈</span><div class="empty-state-title">거래를 찾을 수 없습니다</div><a href="#/devil-deal" class="btn btn-secondary" style="margin-top:20px;max-width:200px;margin-left:auto;margin-right:auto;display:flex;">돌아가기</a></div>`;
      return;
    }

    const data = snap.data();
    const conditions = data.conditions || [];
    const myUid = auth.currentUser?.uid;
    const myVote = data.votes?.[myUid] !== undefined ? data.votes[myUid] : null;

    const voteCount = (idx) => Object.values(data.votes || {}).filter(v => v === idx).length;
    const totalVotes = Object.keys(data.votes || {}).length;

    container.querySelector('.container').innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:48px;margin-bottom:8px;filter:drop-shadow(0 0 16px rgba(239,68,68,0.5));">😈</div>
        <p style="font-size:13px;color:var(--text-dim);font-style:italic;">"${data.intro}"</p>
      </div>

      <div class="card" style="margin-bottom:16px;background:rgba(239,68,68,0.05);border-color:rgba(239,68,68,0.3);">
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">소원</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);">${data.wish}</div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--devil);letter-spacing:0.08em;margin-bottom:12px;">🕯️ 선택하거라... (친구들도 투표 가능)</div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;" id="conditions-list">
        ${conditions.map((c, i) => {
          const cnt = voteCount(i);
          const pct = totalVotes ? Math.round(cnt / totalVotes * 100) : 0;
          const isMine = myVote === i;
          return `
            <div class="devil-condition-card${isMine ? ' selected' : ''}" data-idx="${i}"
              style="padding:16px;border-radius:14px;border:1.5px solid ${isMine ? 'var(--devil)' : 'var(--border)'};background:${isMine ? 'var(--devil-dim)' : 'var(--bg-card)'};cursor:pointer;transition:all 0.2s;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:11px;font-weight:700;color:var(--devil);">${c.label}</span>
                <span style="font-size:11px;color:var(--text-dim);">${cnt}표 (${pct}%)</span>
              </div>
              <div style="font-size:14px;color:var(--text);line-height:1.7;">${c.text}</div>
              <div class="vote-bar" style="margin-top:10px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">
                <div style="height:100%;background:var(--devil);width:${pct}%;transition:width 0.5s;border-radius:2px;"></div>
              </div>
            </div>`;
        }).join('')}
      </div>

      <p style="text-align:center;font-size:13px;color:var(--text-dim);font-style:italic;margin-bottom:20px;">"${data.closing}"</p>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <button id="share-deal-btn" class="btn btn-primary" style="background:var(--devil);color:#fff;box-shadow:0 2px 18px var(--devil-glow);">
          📤 친구에게 공유해서 투표받기
        </button>
        <a href="#/devil-deal" class="btn btn-ghost">😈 새 소원 말하기</a>
      </div>
    `;

    // 투표 이벤트
    container.querySelector('#conditions-list').addEventListener('click', async (e) => {
      const card = e.target.closest('[data-idx]');
      if (!card) return;
      const idx = Number(card.dataset.idx);
      try {
        const voteDevilDeal = httpsCallable(functions, 'voteDevilDeal');
        await voteDevilDeal({ dealId, conditionIndex: idx });
        showToast('투표 완료!', 'success');
        await renderDealResult(container, dealId);
      } catch (err) {
        showToast(err.message || '투표 실패', 'error');
      }
    });

    // 공유
    container.querySelector('#share-deal-btn').addEventListener('click', () => {
      const url = `${location.origin}/#/devil-deal/${dealId}`;
      if (navigator.share) {
        navigator.share({ title: '악마와의 거래 🔥', text: `"${data.wish}" 소원의 거래 조건을 골라줘!`, url });
      } else {
        navigator.clipboard.writeText(url).then(() => showToast('링크 복사됨!', 'success'));
      }
    });

  } catch {
    showToast('거래를 불러오지 못했습니다', 'error');
  }
}
