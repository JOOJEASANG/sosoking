/* election.js — 소소공화국 대통령 선거 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { showPointPopup } from '../utils/point-popup.js';

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

// 마감일(endKey, YYYY-MM-DD)까지 남은 일수 → D-day 라벨
function dDay(endKey) {
  if (!endKey) return '';
  const end = new Date(`${endKey}T00:00:00+09:00`).getTime();
  const nowKst = Date.now();
  const days = Math.ceil((end - nowKst) / 86400000);
  if (days <= 0) return 'D-DAY';
  return `D-${days}`;
}

function renderPresident(p) {
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
    ${p.decree ? `<div class="prez-banner__decree">"${escHtml(p.decree)}"</div>` : ''}
  </div>`;
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
  return `
    <div class="elec-cand${mine ? ' elec-cand--mine' : ''}${isLeading && total > 0 ? ' elec-cand--leading' : ''}" style="--party-color:${c.color}">
      <div class="elec-cand__emoji">${c.emoji}</div>
      <div class="elec-cand__body">
        <div class="elec-cand__top">
          <span class="elec-cand__name">${escHtml(c.candidateName)} ${c.isAI ? '🤖' : '👑'}</span>
          ${leadTag}
          <span class="elec-cand__party">${escHtml(c.partyName)}</span>
        </div>
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

  const voteStateMsg = !loggedIn
    ? `<button class="btn btn--primary btn--sm" id="elec-login">로그인하고 투표하기</button>`
    : myVote != null
      ? `<span class="elec-voted">✅ 투표 완료 — 결과는 ${escHtml(election.endKey)}에 확정</span>`
      : `<span class="elec-open">한 명에게 한 표! 마감 ${escHtml(election.endKey)}</span>`;

  el.innerHTML = `<div class="election-page page-enter">
    ${renderPresident(president)}
    <div class="elec-head">
      <div class="elec-head__dday">${dDay(election.endKey)}</div>
      <div class="elec-head__title">🗳️ 이번 주 대통령 선거</div>
      <div class="elec-head__meta">총 ${fmtNum(total)}표 · 마감 ${escHtml(election.endKey)}</div>
      <div class="elec-head__state">${voteStateMsg}</div>
    </div>
    <div class="elec-list">
      ${cands.map((c, i) => renderCandidate(c, total, myVote, loggedIn, i === 0)).join('')}
    </div>
    <p class="elec-note">후보는 각 정당의 당대표(정치력 1위)이며, 당대표가 없는 정당은 AI 정치인이 출마합니다. 매주 월요일 새 선거가 시작됩니다.</p>
  </div>`;

  el.querySelector('#elec-login')?.addEventListener('click', () => navigate('/login'));

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
        showPointPopup(5);
        httpsCallable(functions, 'syncPartyMemberPower')({}).catch(() => {});
        renderElection();
      } catch (e) {
        toast.error(e?.message || '투표에 실패했어요.');
        btn.disabled = false;
        btn.textContent = '지지 선언 🗳️';
      }
    });
  });
}
