/* election.js — 소소공화국 대통령 선거 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { showPointPopup } from '../utils/point-popup.js';
import { appState } from '../state.js';
import { checkRankUp } from '../utils/rank-up.js';

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

// 마감일(endKey, YYYY-MM-DD)까지 남은 시간 → D-day 라벨 (긴박감 표시)
function dDay(endKey) {
  if (!endKey) return '';
  const end = new Date(`${endKey}T23:59:59+09:00`).getTime();
  const nowKst = Date.now();
  const msLeft = end - nowKst;
  if (msLeft <= 0) return '집계 중';
  const minsLeft = Math.ceil(msLeft / 60000);
  if (minsLeft <= 60) return `⚡ ${minsLeft}분 남음`;
  const hoursLeft = Math.ceil(msLeft / 3600000);
  if (hoursLeft <= 24) return `D-DAY · ${hoursLeft}시간`;
  const days = Math.ceil(msLeft / 86400000);
  return `D-${days}`;
}

function renderDecreeApproval(p) {
  const approveCount = Number(p.decreeApprove || 0);
  const disapproveCount = Number(p.decreeDisapprove || 0);
  const total = approveCount + disapproveCount;
  const pct = total > 0 ? Math.round((approveCount / total) * 100) : null;

  const barHTML = pct != null
    ? `<div class="prez-approval-bar-wrap">
        <div class="prez-approval-bar"><div class="prez-approval-bar__fill" style="width:${pct}%"></div></div>
        <span class="prez-approval-label">지지 ${pct}% · ${total}명 평가</span>
      </div>`
    : '';

  const btnsHTML = `
    <div class="prez-rate-row" id="prez-rate-row">
      <span class="prez-rate-label">포고령 평가</span>
      <button class="prez-rate-btn${p.myDecreeRating === true ? ' prez-rate-btn--active-approve' : ''}" data-approve="true" id="prez-rate-approve">👍 찬성</button>
      <button class="prez-rate-btn${p.myDecreeRating === false ? ' prez-rate-btn--active-disapprove' : ''}" data-approve="false" id="prez-rate-disapprove">👎 반대</button>
    </div>`;

  return barHTML + (p.decree ? btnsHTML : '');
}

function renderPresident(p, isPresident) {
  if (!p) {
    return `<div class="prez-banner prez-banner--empty">
      <div class="prez-banner__label">현직 대통령</div>
      <div class="prez-banner__none">아직 선출 전 — 이번 주 첫 대통령을 뽑아주세요!</div>
    </div>`;
  }
  return `<div class="prez-banner" style="--party-color:${p.color}">
    <div class="prez-banner__crown">👑</div>
    <div class="prez-banner__label">소소공화국 대통령</div>
    <div class="prez-banner__emoji">${p.emoji}</div>
    <div class="prez-banner__name">${escHtml(p.candidateName)}</div>
    <div class="prez-banner__party">${escHtml(p.partyName)}${p.isAI ? ' · AI 정치인' : ' · 당대표'}</div>
    ${p.decree ? `<div class="prez-banner__decree" id="prez-decree-text">"${escHtml(p.decree)}"</div>` : `<div class="prez-banner__decree prez-banner__decree--empty" id="prez-decree-text">포고령 준비 중…</div>`}
    ${renderDecreeApproval(p)}
    ${isPresident ? `<button class="prez-decree-edit-btn" id="prez-decree-btn">📜 포고령 수정하기</button>` : ''}
  </div>
  ${isPresident ? `
  <div class="prez-decree-form" id="prez-decree-form" hidden>
    <div class="prez-decree-form__label">📜 대통령 포고령 발표</div>
    <textarea class="prez-decree-form__input" id="prez-decree-input" maxlength="200" placeholder="소소공화국 국민 여러분께 포고합니다…" rows="3">${escHtml(p.decree || '')}</textarea>
    <div class="prez-decree-form__hint"><span id="prez-decree-len">${p.decree ? p.decree.length : 0}</span>/200자</div>
    <div class="prez-decree-form__actions">
      <button class="btn btn--primary btn--sm" id="prez-decree-submit">포고령 발표 🏛️</button>
      <button class="btn btn--ghost btn--sm" id="prez-decree-cancel">취소</button>
    </div>
  </div>` : ''}`;
}

function renderCandidate(c, total, myVote, canVote, isLeading) {
  const pct = total > 0 ? Math.round((c.votes / total) * 100) : 0;
  const mine = myVote === c.partyId;
  const showResults = myVote != null || !canVote;
  const action = canVote && myVote == null
    ? `<button class="elec-vote-btn" data-party="${c.partyId}" data-name="${escHtml(c.partyName)}">지지 선언 🗳️</button>`
    : `<span class="elec-cand__pct${mine ? ' elec-cand__pct--mine' : ''}">${pct}%</span>`;
  const leadTag = isLeading && total > 0
    ? `<span class="elec-cand__lead-tag">🏆 선두</span>`
    : '';
  const pledgeHTML = c.pledge
    ? `<div class="elec-cand__pledge">📜 "${escHtml(c.pledge)}"</div>`
    : '';
  return `
    <div class="elec-cand${mine ? ' elec-cand--mine' : ''}${isLeading && total > 0 ? ' elec-cand--leading' : ''}" style="--party-color:${c.color}">
      <div class="elec-cand__emoji">${c.emoji}</div>
      <div class="elec-cand__body">
        <div class="elec-cand__top">
          <span class="elec-cand__name">${escHtml(c.candidateName)} ${c.isAI ? '🤖' : '👑'}</span>
          ${leadTag}
          <span class="elec-cand__party">${escHtml(c.partyName)}</span>
        </div>
        ${pledgeHTML}
        ${showResults ? `<div class="elec-bar"><div class="elec-bar__fill" style="width:${pct}%"></div></div>
        <div class="elec-cand__votes">${fmtNum(c.votes)}표${mine ? ' · 내 선택 ✅' : ''}</div>` : `<div class="elec-cand__sub">${c.isAI ? 'AI 정치인 후보' : '당대표 후보'}</div>`}
      </div>
      <div class="elec-cand__action">${action}</div>
    </div>`;
}

export async function renderElection() {
  setMeta('소소공화국 대통령 선거');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `<div class="election-page page-enter">
    <div class="skeleton" style="height:140px;border-radius:16px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:300px;border-radius:16px"></div>
  </div>`;

  let data;
  try {
    const call = httpsCallable(functions, 'getElection');
    const res = await call();
    data = res.data;
  } catch (err) {
    console.error('[election] load error', err);
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">선거 정보를 불러오지 못했어요</div>
      <button class="btn btn--primary" style="margin-top:16px" id="elec-retry">다시 시도</button>
    </div>`;
    el.querySelector('#elec-retry')?.addEventListener('click', renderElection);
    return;
  }

  const { election, president } = data;
  const cands = [...(election.candidates || [])].sort((a, b) => b.votes - a.votes || b.power - a.power);
  const total = election.totalVotes || 0;
  const loggedIn = !!auth.currentUser;
  const myVote = election.myVote;
  const isPresident = !!(president && president.candidateUid && auth.currentUser && president.candidateUid === auth.currentUser.uid);
  const myCandidate = auth.currentUser ? cands.find(c => c.candidateUid === auth.currentUser.uid) || null : null;

  const voteStateMsg = !loggedIn
    ? `<button class="btn btn--primary btn--sm" id="elec-login">로그인하고 투표하기</button>`
    : myVote != null
      ? `<span class="elec-voted">✅ 투표 완료 — 결과는 ${escHtml(election.endKey)}에 확정</span>`
      : `<span class="elec-open">한 명에게 한 표! 마감 ${escHtml(election.endKey)}</span>`;

  el.innerHTML = `<div class="election-page page-enter">
    ${renderPresident(president, isPresident)}
    <div class="elec-head">
      <div class="elec-head__dday" data-urgent="${dDay(election.endKey).startsWith('⚡') || dDay(election.endKey).startsWith('D-DAY') ? 'true' : 'false'}">${dDay(election.endKey)}</div>
      <div class="elec-head__title">🗳️ 이번 주 대통령 선거</div>
      <div class="elec-head__meta">총 ${fmtNum(total)}표 · 마감 ${escHtml(election.endKey)}</div>
      <div class="elec-head__state">${voteStateMsg}</div>
    </div>
    <div class="elec-list">
      ${cands.map((c, i) => renderCandidate(c, total, myVote, loggedIn, i === 0)).join('')}
    </div>
    <p class="elec-note">후보는 각 정당의 당대표(정치력 1위)이며, 당대표가 없는 정당은 AI 정치인이 출마합니다. 매주 월요일 새 선거가 시작됩니다.</p>
    ${myCandidate ? `
    <div class="elec-pledge-section">
      <div class="elec-pledge-section__title">📢 내 선거 공약 ${myCandidate.pledge ? '(수정 가능)' : '(아직 없음)'}</div>
      <p class="elec-pledge-section__hint">유권자에게 보여줄 짧은 공약을 작성해보세요 (80자 이내)</p>
      <textarea class="elec-pledge-input" id="elec-pledge-input" maxlength="80" placeholder="예) 모든 시민에게 정치력 2배 보너스를!" rows="2">${escHtml(myCandidate.pledge || '')}</textarea>
      <div class="elec-pledge-actions">
        <span class="elec-pledge-len"><span id="elec-pledge-len">${myCandidate.pledge ? myCandidate.pledge.length : 0}</span>/80</span>
        <button class="btn btn--primary btn--sm" id="elec-pledge-submit">공약 발표 📢</button>
      </div>
    </div>` : ''}
    <div id="elec-endorsements-section"></div>
    <div id="elec-history-section"></div>
  </div>`;

  el.querySelector('#elec-login')?.addEventListener('click', () => navigate('/login'));

  // 포고령 찬반 평가
  el.querySelectorAll('.prez-rate-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const approve = btn.dataset.approve === 'true';
      btn.disabled = true;
      try {
        const { data: rData } = await httpsCallable(functions, 'ratePresidentDecree')({ approve });
        el.querySelectorAll('.prez-rate-btn').forEach(b => {
          b.classList.toggle('prez-rate-btn--active-approve', b.dataset.approve === 'true' && rData.approve === true);
          b.classList.toggle('prez-rate-btn--active-disapprove', b.dataset.approve === 'false' && rData.approve === false);
          b.disabled = false;
        });
        const total = rData.approveCount + rData.disapproveCount;
        const pct = total > 0 ? Math.round((rData.approveCount / total) * 100) : 0;
        let barWrap = el.querySelector('.prez-approval-bar-wrap');
        if (!barWrap && total > 0) {
          barWrap = document.createElement('div');
          barWrap.className = 'prez-approval-bar-wrap';
          el.querySelector('#prez-rate-row')?.insertAdjacentElement('beforebegin', barWrap);
        }
        if (barWrap) {
          barWrap.innerHTML = `<div class="prez-approval-bar"><div class="prez-approval-bar__fill" style="width:${pct}%"></div></div>
            <span class="prez-approval-label">지지 ${pct}% · ${total}명 평가</span>`;
        }
        if (rData.firstRating) { toast.success('+3P 획득! 포고령 평가 완료 🏛️'); showPointPopup(3); }
      } catch (e) {
        toast.error(e?.message || '평가에 실패했어요');
        btn.disabled = false;
      }
    });
  });

  // 실시간 마감 카운트다운 (1분마다 업데이트)
  const ddayEl = el.querySelector('.elec-head__dday');
  if (ddayEl && election.endKey && election.status === 'open') {
    const tick = () => {
      if (!document.contains(ddayEl)) return;
      const label = dDay(election.endKey);
      ddayEl.textContent = label;
      ddayEl.dataset.urgent = (label.startsWith('⚡') || label.startsWith('D-DAY')) ? 'true' : 'false';
    };
    const timer = setInterval(tick, 60000);
    const cleanup = () => clearInterval(timer);
    window.addEventListener('hashchange', cleanup, { once: true });
  }

  // 대통령 포고령 편집기
  if (isPresident) {
    const decreeBtn = el.querySelector('#prez-decree-btn');
    const decreeForm = el.querySelector('#prez-decree-form');
    const decreeInput = el.querySelector('#prez-decree-input');
    const decreeLen = el.querySelector('#prez-decree-len');
    const decreeSubmit = el.querySelector('#prez-decree-submit');
    const decreeCancel = el.querySelector('#prez-decree-cancel');

    decreeBtn?.addEventListener('click', () => {
      decreeForm.hidden = !decreeForm.hidden;
      decreeBtn.textContent = decreeForm.hidden ? '📜 포고령 수정하기' : '📜 편집 닫기';
      if (!decreeForm.hidden) decreeInput?.focus();
    });
    decreeInput?.addEventListener('input', () => {
      if (decreeLen) decreeLen.textContent = decreeInput.value.length;
    });
    decreeCancel?.addEventListener('click', () => {
      decreeForm.hidden = true;
      decreeBtn.textContent = '📜 포고령 수정하기';
    });
    decreeSubmit?.addEventListener('click', async () => {
      const text = decreeInput?.value.trim();
      if (!text) { toast.warn('포고령 내용을 입력해주세요'); return; }
      decreeSubmit.disabled = true;
      decreeSubmit.textContent = '발표 중…';
      try {
        const call = httpsCallable(functions, 'setPresidentialDecree');
        const res = await call({ decree: text });
        const decreeTextEl = el.querySelector('#prez-decree-text');
        if (decreeTextEl) decreeTextEl.textContent = `"${res.data.decree}"`;
        decreeForm.hidden = true;
        decreeBtn.textContent = '📜 포고령 수정하기';
        toast.success('포고령을 발표했어요! 🏛️');
      } catch (e) {
        toast.error(e?.message || '발표에 실패했어요');
      } finally {
        decreeSubmit.disabled = false;
        decreeSubmit.textContent = '포고령 발표 🏛️';
      }
    });
  }

  el.querySelectorAll('.elec-vote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const partyId = btn.dataset.party;
      const name = btn.dataset.name;

      if (btn.dataset.confirming !== '1') {
        btn.dataset.confirming = '1';
        btn.textContent = '한 번만 가능! 확인 →';
        btn.classList.add('elec-vote-btn--confirm');
        setTimeout(() => {
          if (btn.dataset.confirming === '1') {
            btn.dataset.confirming = '';
            btn.textContent = '지지 선언 🗳️';
            btn.classList.remove('elec-vote-btn--confirm');
          }
        }, 3000);
        return;
      }

      btn.dataset.confirming = '';
      btn.disabled = true;
      btn.textContent = '…';
      btn.classList.remove('elec-vote-btn--confirm');
      try {
        const call = httpsCallable(functions, 'voteForPresident');
        await call({ partyId });
        toast.success(`${name} 후보에게 투표했어요! 🗳️`);
        appState.points = (appState.points || 0) + 5;
        showPointPopup(5);
        if (auth.currentUser) checkRankUp(auth.currentUser.uid, appState.points);
        httpsCallable(functions, 'syncPartyMemberPower')({}).catch(() => {});
        renderElection();
      } catch (e) {
        toast.error(e?.message || '투표에 실패했어요.');
        btn.disabled = false;
        btn.textContent = '지지 선언 🗳️';
      }
    });
  });

  // 선거 공약 편집기
  if (myCandidate) {
    const pledgeInput = el.querySelector('#elec-pledge-input');
    const pledgeLen = el.querySelector('#elec-pledge-len');
    const pledgeSubmit = el.querySelector('#elec-pledge-submit');
    pledgeInput?.addEventListener('input', () => {
      if (pledgeLen) pledgeLen.textContent = pledgeInput.value.length;
    });
    pledgeSubmit?.addEventListener('click', async () => {
      const text = pledgeInput?.value.trim();
      if (!text) { toast.warn('공약 내용을 입력해주세요'); return; }
      pledgeSubmit.disabled = true;
      pledgeSubmit.textContent = '발표 중…';
      try {
        const call = httpsCallable(functions, 'setCampaignPledge');
        await call({ pledge: text });
        toast.success('공약을 발표했어요! 📢');
        renderElection();
      } catch (e) {
        toast.error(e?.message || '공약 발표에 실패했어요');
        pledgeSubmit.disabled = false;
        pledgeSubmit.textContent = '공약 발표 📢';
      }
    });
  }

  // 지지 선언 피드 (비동기 로드 + 투표 후 작성 폼)
  loadEndorsements(el.querySelector('#elec-endorsements-section'), myVote, election.status);

  // 역대 대선 결과 (비동기 로드)
  loadElectionHistory(el.querySelector('#elec-history-section'));
}

async function loadEndorsements(host, myVote, status) {
  if (!host) return;
  try {
    const call = httpsCallable(functions, 'getElectionEndorsements');
    const { data } = await call();
    const items = data.endorsements || [];
    const myUid = auth.currentUser?.uid || '';

    const canEndorse = !!auth.currentUser && myVote != null && status === 'open';
    const myItem = items.find(e => e.uid === myUid);

    const listHTML = items.length
      ? items.map(e => `
        <div class="elec-endorsement${e.uid === myUid ? ' elec-endorsement--mine' : ''}" style="--party-c:${e.partyColor || '#aaa'}">
          <span class="elec-endorsement__emoji">${e.partyEmoji || '🏛️'}</span>
          <div class="elec-endorsement__body">
            <span class="elec-endorsement__nick">${escHtml(e.nickname)}</span>
            <p class="elec-endorsement__text">"${escHtml(e.text)}"</p>
          </div>
        </div>`).join('')
      : `<div class="elec-endorsement-empty">아직 지지 선언이 없어요. 첫 번째로 남겨보세요!</div>`;

    const formHTML = canEndorse && !myItem ? `
      <div class="elec-endorsement-form">
        <textarea class="elec-endorsement-input" id="elec-endorsement-input" maxlength="60"
          placeholder="후보에 대한 짧은 지지 선언을 남겨보세요 (60자 이내)" rows="2"></textarea>
        <div class="elec-endorsement-actions">
          <span class="elec-endorsement-len"><span id="elec-endorsement-len">0</span>/60</span>
          <button class="btn btn--primary btn--sm" id="elec-endorsement-submit">지지 선언 📣</button>
        </div>
      </div>` : '';

    host.innerHTML = `
      <div class="elec-endorsements">
        <div class="elec-endorsements__title">📣 지지 선언 <span>${items.length}명</span></div>
        ${formHTML}
        <div class="elec-endorsements__list">${listHTML}</div>
      </div>`;

    const input = host.querySelector('#elec-endorsement-input');
    const lenEl = host.querySelector('#elec-endorsement-len');
    const submit = host.querySelector('#elec-endorsement-submit');

    input?.addEventListener('input', () => { if (lenEl) lenEl.textContent = input.value.length; });
    submit?.addEventListener('click', async () => {
      const text = input?.value.trim();
      if (!text) { toast.warn('지지 선언 내용을 입력해주세요'); return; }
      submit.disabled = true;
      submit.textContent = '…';
      try {
        await httpsCallable(functions, 'addElectionEndorsement')({ text });
        toast.success('지지 선언을 남겼어요! 📣');
        loadEndorsements(host, myVote, status);
      } catch (e) {
        toast.error(e?.message || '실패했어요. 다시 시도해주세요.');
        submit.disabled = false;
        submit.textContent = '지지 선언 📣';
      }
    });
  } catch { /* non-critical */ }
}

async function loadElectionHistory(host) {
  if (!host) return;
  try {
    const call = httpsCallable(functions, 'getElectionHistory');
    const { data } = await call();
    const history = (data.history || []).filter(h => !h.seeded);
    if (!history.length) return;

    host.innerHTML = `
      <div class="elec-history">
        <div class="elec-history__title">📜 역대 대통령 기록</div>
        ${history.map((h, i) => {
          const w = h.winner;
          return `
          <div class="elec-history-item" style="--party-color:${w.color}">
            <span class="elec-history-item__medal">${i === 0 ? '👑' : `${i + 1}`}</span>
            <span class="elec-history-item__emoji">${w.emoji}</span>
            <div class="elec-history-item__body">
              <div class="elec-history-item__name">${escHtml(w.candidateName)}</div>
              <div class="elec-history-item__meta">${escHtml(w.partyName)} · ${h.periodId}${h.totalVotes ? ` · ${fmtNum(h.totalVotes)}표` : ''}</div>
              ${h.decree ? `<div class="elec-history-item__decree">"${escHtml(h.decree)}"</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  } catch { /* non-critical */ }
}
