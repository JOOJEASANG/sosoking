/* election.js — 새공화국 대통령 선거 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { showPointPopup } from '../utils/point-popup.js';
import { appState } from '../state.js';
import { checkRankUp } from '../utils/rank-up.js';

const PARTY_INFO = {
  national: { name: '국민질서당', emoji: '🛡️', color: '#263B66', ideology: '보수파' },
  youth: { name: '시민개혁당', emoji: '🕯️', color: '#B8323B', ideology: '진보파' },
  center: { name: '국민통합당', emoji: '⚖️', color: '#2F7D6E', ideology: '중도파' },
};

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function dDay(endKey) {
  if (!endKey) return '';
  const end = new Date(`${endKey}T23:59:59+09:00`).getTime();
  const msLeft = end - Date.now();
  if (msLeft <= 0) return '집계 중';
  const hours = Math.ceil(msLeft / 3600000);
  if (hours <= 1) return '⚡ 마감 임박';
  if (hours <= 24) return `D-DAY · ${hours}시간`;
  return `D-${Math.ceil(msLeft / 86400000)}`;
}

function normalizeCandidate(c) {
  const fallback = PARTY_INFO[c.partyId] || { name: c.partyName || c.partyId || '정당', emoji: '🏛️', color: '#64748b', ideology: '' };
  return {
    ...fallback,
    ...c,
    partyName: c.partyName || fallback.name,
    emoji: c.emoji || fallback.emoji,
    color: c.color || fallback.color,
    ideology: c.ideology || fallback.ideology,
    candidateName: c.candidateName || fallback.leaderName || '후보',
    votes: Number(c.votes || 0),
    power: Number(c.power || 0),
  };
}

function renderDecreeApproval(p) {
  const approve = Number(p.decreeApprove || 0);
  const disapprove = Number(p.decreeDisapprove || 0);
  const total = approve + disapprove;
  const pct = total ? Math.round((approve / total) * 100) : null;
  return `
    ${pct !== null ? `<div class="prez-approval-bar-wrap"><div class="prez-approval-bar"><div class="prez-approval-bar__fill" style="width:${pct}%"></div></div><span class="prez-approval-label">지지 ${pct}% · ${total}명 평가</span></div>` : ''}
    ${p.decree ? `<div class="prez-rate-row" id="prez-rate-row"><span class="prez-rate-label">포고령 평가</span><button class="prez-rate-btn${p.myDecreeRating === true ? ' prez-rate-btn--active-approve' : ''}" data-approve="true">👍 찬성</button><button class="prez-rate-btn${p.myDecreeRating === false ? ' prez-rate-btn--active-disapprove' : ''}" data-approve="false">👎 반대</button></div>` : ''}`;
}

function renderPresident(p, isPresident) {
  if (!p) {
    return `<div class="prez-banner prez-banner--empty"><div class="prez-banner__label">현직 대통령</div><div class="prez-banner__none">아직 선출 전 — 새공화국 첫 대통령을 기다리는 중입니다.</div></div>`;
  }
  return `<div class="prez-banner" style="--party-color:${p.color || '#64748b'}">
    <div class="prez-banner__crown">🏛️</div>
    <div class="prez-banner__label">소소공화국 대통령</div>
    <div class="prez-banner__emoji">${escHtml(p.emoji || '🏛️')}</div>
    <div class="prez-banner__name">${escHtml(p.candidateName || '대통령')}</div>
    <div class="prez-banner__party">${escHtml(p.partyName || '')}${p.isAI ? ' · AI 정치인' : ' · 당대표'}</div>
    ${p.decree ? `<div class="prez-banner__decree" id="prez-decree-text">"${escHtml(p.decree)}"</div>` : `<div class="prez-banner__decree prez-banner__decree--empty" id="prez-decree-text">포고령 준비 중…</div>`}
    ${renderDecreeApproval(p)}
    ${isPresident ? `<button class="prez-decree-edit-btn" id="prez-decree-btn">📜 포고령 수정하기</button>` : ''}
  </div>
  ${isPresident ? `<div class="prez-decree-form" id="prez-decree-form" hidden><div class="prez-decree-form__label">📜 대통령 포고령 발표</div><textarea class="prez-decree-form__input" id="prez-decree-input" maxlength="200" placeholder="소소공화국 국민 여러분께 포고합니다…" rows="3">${escHtml(p.decree || '')}</textarea><div class="prez-decree-form__hint"><span id="prez-decree-len">${p.decree ? p.decree.length : 0}</span>/200자</div><div class="prez-decree-form__actions"><button class="btn btn--primary btn--sm" id="prez-decree-submit">포고령 발표 🏛️</button><button class="btn btn--ghost btn--sm" id="prez-decree-cancel">취소</button></div></div>` : ''}`;
}

function renderCandidate(c, total, myVote, canVote, isLeading, rulingPartyId) {
  const pct = total > 0 ? Math.round((c.votes / total) * 100) : 0;
  const mine = myVote === c.partyId;
  const showResults = myVote != null || !canVote;
  const isRuling = rulingPartyId && c.partyId === rulingPartyId;
  return `<div class="elec-cand${mine ? ' elec-cand--mine' : ''}${isLeading && total > 0 ? ' elec-cand--leading' : ''}" style="--party-color:${c.color}">
    <div class="elec-cand__emoji">${escHtml(c.emoji)}</div>
    <div class="elec-cand__body">
      <div class="elec-cand__top">
        <span class="elec-cand__name">${escHtml(c.candidateName)} ${c.isAI ? '🤖' : '🏛️'}</span>
        ${isRuling ? '<span class="elec-cand__gov-badge elec-cand__gov-badge--ruling">여당</span>' : rulingPartyId ? '<span class="elec-cand__gov-badge elec-cand__gov-badge--opp">야당</span>' : ''}
        ${isLeading && total > 0 ? '<span class="elec-cand__lead-tag">🏆 선두</span>' : ''}
        <span class="elec-cand__party">${escHtml(c.partyName)} · ${escHtml(c.ideology || '')}</span>
      </div>
      ${c.pledge ? `<div class="elec-cand__pledge">📜 "${escHtml(c.pledge.pledge || c.pledge)}"</div>` : ''}
      ${showResults ? `<div class="elec-bar"><div class="elec-bar__fill" style="width:${pct}%"></div></div><div class="elec-cand__votes">${fmtNum(c.votes)}표${mine ? ' · 내 선택 ✅' : ''}</div>` : `<div class="elec-cand__sub">${c.slogan ? escHtml(c.slogan) : c.isAI ? 'AI 정치인 후보' : '당대표 후보'}</div>`}
    </div>
    <div class="elec-cand__action">${canVote && myVote == null ? `<button class="elec-vote-btn" data-party="${escHtml(c.partyId)}" data-name="${escHtml(c.partyName)}">지지 선언 🗳️</button>` : `<span class="elec-cand__pct${mine ? ' elec-cand__pct--mine' : ''}">${pct}%</span>`}</div>
  </div>`;
}

export async function renderElection() {
  setMeta('소소공화국 대통령 선거');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="election-page page-enter"><div class="skeleton" style="height:140px;border-radius:16px;margin-bottom:12px"></div><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;

  let data;
  try {
    const res = await httpsCallable(functions, 'getElection')();
    data = res.data || {};
  } catch (err) {
    console.error('[election] load error', err);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">선거 정보를 불러오지 못했어요</div><button class="btn btn--primary" style="margin-top:16px" id="elec-retry">다시 시도</button></div>`;
    el.querySelector('#elec-retry')?.addEventListener('click', renderElection);
    return;
  }

  const election = data.election || {};
  const president = data.president || null;
  const cands = (election.candidates || []).map(normalizeCandidate).sort((a, b) => b.votes - a.votes || b.power - a.power);
  const total = Number(election.totalVotes || 0);
  const loggedIn = !!auth.currentUser;
  const myVote = election.myVote;
  const isPresident = !!(president?.candidateUid && auth.currentUser && president.candidateUid === auth.currentUser.uid);
  const myCandidate = auth.currentUser ? cands.find(c => c.candidateUid === auth.currentUser.uid) || null : null;
  const rulingPartyId = president?.partyId || null;
  const ddayStr = dDay(election.endKey);

  const voteStateMsg = !loggedIn
    ? `<button class="btn btn--primary btn--sm" id="elec-login">로그인하고 투표하기</button>`
    : myVote != null
      ? `<span class="elec-voted">✅ 투표 완료 — 결과는 ${escHtml(election.endKey || '')}에 확정</span>`
      : `<span class="elec-open">한 명에게 한 표! 마감 ${escHtml(election.endKey || '')}</span>`;

  el.innerHTML = `<div class="election-page page-enter">
    <div class="elec-republic-bar"><div class="elec-republic-status" style="--sc:#2563eb"><span class="elec-republic-status__dot">🏛️</span><span class="elec-republic-status__label">새공화국 선거</span></div><span class="elec-republic-votes">${fmtNum(total)}표 집계</span></div>
    ${renderPresident(president, isPresident)}
    <div class="elec-head"><div class="elec-head__dday">${escHtml(ddayStr)}</div><div class="elec-head__title">🗳️ 이번 주 대통령 선거</div><div class="elec-head__meta">국민질서당 · 시민개혁당 · 국민통합당</div><div class="elec-head__state">${voteStateMsg}</div></div>
    <div class="elec-list">${cands.map((c, i) => renderCandidate(c, total, myVote, loggedIn, i === 0, rulingPartyId)).join('')}</div>
    <p class="elec-note">후보는 각 정당의 당대표 또는 대표 AI 정치인입니다. 매주 월요일 새 선거가 시작됩니다.</p>
    ${myCandidate ? `<div class="elec-pledge-section"><div class="elec-pledge-section__title">📢 내 선거 공약 ${myCandidate.pledge ? '(수정 가능)' : '(아직 없음)'}</div><p class="elec-pledge-section__hint">유권자에게 보여줄 짧은 공약을 작성해보세요.</p><textarea class="elec-pledge-input" id="elec-pledge-input" maxlength="120" placeholder="예) 권력기관을 견제하고 시민광장을 넓히겠습니다." rows="2">${escHtml(myCandidate.pledge?.pledge || myCandidate.pledge || '')}</textarea><div class="elec-pledge-actions"><span class="elec-pledge-len"><span id="elec-pledge-len">${myCandidate.pledge ? String(myCandidate.pledge?.pledge || myCandidate.pledge).length : 0}</span>/120</span><button class="btn btn--primary btn--sm" id="elec-pledge-submit">공약 발표 📢</button></div></div>` : ''}
    <div id="elec-history-section"></div>
  </div>`;

  bindElectionEvents(el, myCandidate);
  loadElectionHistory(el.querySelector('#elec-history-section'));
}

function bindElectionEvents(el, myCandidate) {
  el.querySelector('#elec-login')?.addEventListener('click', () => navigate('/login'));
  el.querySelectorAll('.prez-rate-btn').forEach(btn => btn.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    btn.disabled = true;
    try {
      await httpsCallable(functions, 'ratePresidentDecree')({ approve: btn.dataset.approve === 'true' });
      toast.success('포고령 평가 완료 🏛️');
      renderElection();
    } catch (e) { toast.error(e?.message || '평가에 실패했어요'); btn.disabled = false; }
  }));

  el.querySelectorAll('.elec-vote-btn').forEach(btn => btn.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const partyId = btn.dataset.party;
    const name = btn.dataset.name;
    if (btn.dataset.confirming !== '1') {
      btn.dataset.confirming = '1'; btn.textContent = '한 번만 가능! 확인 →'; btn.classList.add('elec-vote-btn--confirm');
      setTimeout(() => { if (btn.dataset.confirming === '1') { btn.dataset.confirming = ''; btn.textContent = '지지 선언 🗳️'; btn.classList.remove('elec-vote-btn--confirm'); } }, 3000);
      return;
    }
    btn.disabled = true; btn.textContent = '…';
    try {
      const { data } = await httpsCallable(functions, 'voteForPresident')({ partyId });
      const points = data.points || 5;
      toast.success(`${name} 후보에게 투표했어요! 🗳️`);
      appState.points = (appState.points || 0) + points;
      showPointPopup(points);
      if (auth.currentUser) checkRankUp(auth.currentUser.uid, appState.points);
      httpsCallable(functions, 'syncPartyMemberPower')({}).catch(() => {});
      renderElection();
    } catch (e) { toast.error(e?.message || '투표에 실패했어요.'); btn.disabled = false; btn.textContent = '지지 선언 🗳️'; }
  }));

  if (myCandidate) {
    const input = el.querySelector('#elec-pledge-input');
    const len = el.querySelector('#elec-pledge-len');
    input?.addEventListener('input', () => { if (len) len.textContent = input.value.length; });
    el.querySelector('#elec-pledge-submit')?.addEventListener('click', async () => {
      const pledge = input?.value.trim();
      if (!pledge) { toast.warn('공약 내용을 입력해주세요'); return; }
      try {
        await httpsCallable(functions, 'setCampaignPledge')({ partyId: myCandidate.partyId, pledge });
        toast.success('공약을 발표했어요! 📢');
        renderElection();
      } catch (e) { toast.error(e?.message || '공약 발표에 실패했어요'); }
    });
  }

  if (el.querySelector('#prez-decree-btn')) {
    const btn = el.querySelector('#prez-decree-btn');
    const form = el.querySelector('#prez-decree-form');
    const input = el.querySelector('#prez-decree-input');
    const len = el.querySelector('#prez-decree-len');
    btn.addEventListener('click', () => { form.hidden = !form.hidden; btn.textContent = form.hidden ? '📜 포고령 수정하기' : '📜 편집 닫기'; });
    input?.addEventListener('input', () => { if (len) len.textContent = input.value.length; });
    el.querySelector('#prez-decree-cancel')?.addEventListener('click', () => { form.hidden = true; btn.textContent = '📜 포고령 수정하기'; });
    el.querySelector('#prez-decree-submit')?.addEventListener('click', async () => {
      const decree = input?.value.trim();
      if (!decree) { toast.warn('포고령 내용을 입력해주세요'); return; }
      try {
        await httpsCallable(functions, 'setPresidentialDecree')({ decree });
        toast.success('포고령을 발표했어요! 🏛️');
        renderElection();
      } catch (e) { toast.error(e?.message || '발표에 실패했어요'); }
    });
  }
}

async function loadElectionHistory(host) {
  if (!host) return;
  try {
    const { data } = await httpsCallable(functions, 'getElectionHistory')();
    const history = (data.history || []).filter(h => h.winner && !h.seeded).slice(0, 8);
    if (!history.length) return;
    host.innerHTML = `<div class="elec-history"><div class="elec-history__title">📜 역대 대통령 기록</div>${history.map((h, i) => {
      const w = normalizeCandidate(h.winner || {});
      return `<div class="elec-history-item" style="--party-color:${w.color}"><span class="elec-history-item__medal">${i === 0 ? '🏛️' : `${i + 1}`}</span><span class="elec-history-item__emoji">${w.emoji}</span><div class="elec-history-item__body"><div class="elec-history-item__name">${escHtml(w.candidateName)}</div><div class="elec-history-item__meta">${escHtml(w.partyName)} · ${escHtml(h.periodId || '')}${h.totalVotes ? ` · 총 ${fmtNum(h.totalVotes)}표` : ''}</div>${h.decree ? `<div class="elec-history-item__decree">"${escHtml(h.decree)}"</div>` : ''}</div></div>`;
    }).join('')}</div>`;
  } catch { /* non-critical */ }
}
