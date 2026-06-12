import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

function esc(value) {
  return String(value || '').replace(/[&<>"/]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '/': '&#47;' }[ch]));
}

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  return n.toLocaleString();
}

function allocateSeats(parties) {
  const list = Array.isArray(parties) ? parties.slice(0, 3) : [];
  if (!list.length) return [];
  const totalPower = list.reduce((sum, p) => sum + Number(p.totalPower || 0), 0);
  if (totalPower <= 0) return list.map((p, i) => ({ ...p, seats: [34, 33, 33][i] || 0 }));
  let seats = list.map(p => ({ ...p, seats: Math.max(1, Math.round((Number(p.totalPower || 0) / totalPower) * 100)) }));
  let diff = 100 - seats.reduce((sum, p) => sum + p.seats, 0);
  seats.sort((a, b) => Number(b.totalPower || 0) - Number(a.totalPower || 0));
  let i = 0;
  while (diff !== 0 && seats.length) { seats[i % seats.length].seats += diff > 0 ? 1 : -1; diff += diff > 0 ? -1 : 1; i++; }
  return seats;
}

function renderSeats(seats, rulingPartyId) {
  const ORDINALS = ['제1당', '제2당', '제3당'];
  return seats.map((p, idx) => {
    const isRuling = !!rulingPartyId && p.id === rulingPartyId;
    const role = isRuling ? '여당' : (rulingPartyId ? '야당' : (ORDINALS[idx] || `제${idx + 1}당`));
    return `<div class="congress-seat-card">
      <div class="congress-seat-card__top">
        <span class="congress-seat-card__name">${esc(p.emoji)} ${esc(p.name)}</span>
        <span class="congress-seat-badge ${isRuling ? 'congress-seat-badge--ruling' : 'congress-seat-badge--neutral'}">${role}</span>
      </div>
      <div class="congress-seat-count">
        <span class="congress-seat-count__num">${p.seats}</span>
        <span class="congress-seat-count__label">석 / 100석</span>
      </div>
      <div class="congress-seat-bar">
        <div class="congress-seat-bar__fill" style="width:${p.seats}%;background:${esc(p.color || '#64748b')}"></div>
      </div>
      <div class="congress-seat-power">정치력 ${fmtNum(p.totalPower)}P</div>
    </div>`;
  }).join('');
}

function billStatusClass(bill) {
  if (bill.result === 'passed') return 'congress-bill-status--passed';
  if (bill.result === 'rejected') return 'congress-bill-status--rejected';
  return 'congress-bill-status--pending';
}

function billStatusLabel(bill) {
  if (bill.result === 'passed') return '가결';
  if (bill.result === 'rejected') return '부결';
  return '표결 진행';
}

function renderBillProgress(bill) {
  const total = Number(bill.totalVotes || 0);
  const forPct = total > 0 ? Math.round((Number(bill.votesFor || 0) / total) * 100) : 50;
  const againstPct = 100 - forPct;
  return `<div class="congress-bill-progress">
    <div class="congress-bill-progress__bar">
      <span class="congress-bill-progress__for" style="width:${forPct}%"></span>
      <span class="congress-bill-progress__against" style="width:${againstPct}%"></span>
    </div>
    <div class="congress-bill-progress__labels">
      <span>찬성 ${fmtNum(bill.votesFor)}표</span>
      <span>반대 ${fmtNum(bill.votesAgainst)}표</span>
    </div>
  </div>`;
}

function renderBills(bills, myVotes) {
  if (!bills.length) {
    return `<div class="congress-bill-empty">
      <div class="congress-bill-empty__label">현재 계류 의안</div>
      <div class="congress-bill-empty__title">의안 접수 대기</div>
      <div class="congress-bill-empty__desc">서버에서 주간 법안이 생성되면 이곳에 표시됩니다.</div>
    </div>`;
  }
  return bills.slice(0, 3).map(bill => {
    const myVote = myVotes[bill.id];
    const isClosed = bill.status === 'closed';
    return `<article class="congress-bill">
      <div class="congress-bill__top">
        <div>
          <div class="congress-bill__meta">현재 계류 의안</div>
          <div class="congress-bill__title">${esc(bill.title)}</div>
        </div>
        <span class="congress-bill-status ${billStatusClass(bill)}">${billStatusLabel(bill)}</span>
      </div>
      <div class="congress-bill__desc">${esc(bill.desc || '')}</div>
      ${renderBillProgress(bill)}
      <div class="congress-bill__actions">
        <button class="btn ${myVote === 'for' ? 'btn--primary' : 'btn--ghost'} btn--full congress-vote"
          data-bill-id="${esc(bill.id)}" data-choice="for" ${myVote || isClosed ? 'disabled' : ''}>
          찬성 · ${esc(bill.optionFor || '찬성')}
        </button>
        <button class="btn ${myVote === 'against' ? 'btn--primary' : 'btn--ghost'} btn--full congress-vote"
          data-bill-id="${esc(bill.id)}" data-choice="against" ${myVote || isClosed ? 'disabled' : ''}>
          반대 · ${esc(bill.optionAgainst || '반대')}
        </button>
      </div>
      ${myVote ? `<div class="congress-bill__myvote">내 표결: ${myVote === 'for' ? '✅ 찬성' : '❌ 반대'}</div>` : ''}
      ${isClosed && bill.consequence ? `<div class="congress-bill__consequence">📋 ${esc(bill.consequence)}</div>` : ''}
    </article>`;
  }).join('');
}

function renderImpeachment(president) {
  const count = Number(president?.impeachCount || 0);
  const threshold = Number(president?.impeachThreshold || 5);
  const triggered = !!president?.impeachTriggered;
  const hasPresident = !!president?.candidateName;
  const pct = threshold > 0 ? Math.min(100, Math.round((count / threshold) * 100)) : 0;
  return `<div class="congress-impeach">
    <div class="congress-impeach__top">
      <div>
        <div class="congress-impeach__label">탄핵 절차</div>
        <div class="congress-impeach__title">국회 탄핵소추 → 헌법재판소</div>
      </div>
      ${triggered
        ? `<span class="congress-bill-status congress-bill-status--rejected">헌재 심판 대기</span>`
        : `<span class="congress-bill-status congress-bill-status--pending">청원 단계</span>`}
    </div>
    <div class="congress-impeach__desc">
      ${hasPresident
        ? `${esc(president.candidateName)} 대통령에 대한 탄핵 청원 ${count}/${threshold}명 서명.`
        : '현직 대통령이 없으면 탄핵 절차는 열리지 않습니다.'}
      청원 기준 달성 시 헌법재판소 심판 단계로 넘어갑니다.
    </div>
    <div class="congress-impeach-bar">
      <span class="congress-impeach-bar__fill" style="width:${pct}%"></span>
    </div>
    <div class="congress-impeach-steps">
      <span>1. 청원</span><span>2. 국회 소추</span><span>3. 헌재 심판</span><span>4. 조기 대선</span>
    </div>
    <button class="btn btn--ghost btn--full" id="btn-go-election" style="margin-top:12px">대통령 현황 보기</button>
  </div>`;
}

async function handleVote(btn) {
  const billId = btn.dataset.billId;
  const choice = btn.dataset.choice;
  btn.disabled = true;
  btn.textContent = '표결 처리 중...';
  try {
    await httpsCallable(functions, 'voteCongressBill')({ billId, choice });
    await renderCongress();
  } catch (error) {
    console.error('[congress vote]', error);
    alert(error?.message || '표결 처리에 실패했습니다.');
    await renderCongress();
  }
}

export async function renderCongress() {
  setMeta('국회', '소소공화국 국회 — 의석, 법안, 탄핵소추를 확인하세요');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="page-section">
    <div class="skeleton" style="height:100px;border-radius:16px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:200px;border-radius:16px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:300px;border-radius:16px"></div>
  </div>`;

  const [overviewRes, billsRes, presidentRes] = await Promise.allSettled([
    httpsCallable(functions, 'getPoliticsOverview')({}),
    httpsCallable(functions, 'getCongressBills')({}),
    httpsCallable(functions, 'getPresident')({}),
  ]);
  const overview = overviewRes.value?.data || {};
  const billData = billsRes.value?.data || {};
  const parties = Array.isArray(overview.parties) ? overview.parties.slice(0, 3) : [];
  const bills = Array.isArray(billData.bills) ? billData.bills : [];
  const myVotes = billData.myVotes || {};
  const president = presidentRes.value?.data?.president || null;
  const rulingPartyId = president?.partyId || null;
  const seats = allocateSeats(parties);

  el.innerHTML = `<div class="page-section">
    <div class="congress-page">
      <div class="congress-hero">
        <div class="congress-hero__eyebrow">SOSO NATIONAL ASSEMBLY</div>
        <div class="congress-hero__title">🏛️ 소소국회</div>
        <div class="congress-hero__desc">3당 의석 구도, 주간 법안 표결, 탄핵소추 절차를 확인하는 입법 기관입니다.</div>
      </div>

      <section>
        <div class="congress-section-title">의석 현황</div>
        <div class="congress-seats-grid">${renderSeats(seats, rulingPartyId)}</div>
      </section>

      <div class="congress-main-grid">
        <section>
          <div class="congress-section-title">법안 표결</div>
          ${renderBills(bills, myVotes)}
        </section>
        <section>
          <div class="congress-section-title">대통령 견제</div>
          ${renderImpeachment(president)}
        </section>
      </div>
    </div>
  </div>`;

  document.querySelectorAll('.congress-vote').forEach(btn => btn.addEventListener('click', () => handleVote(btn)));
  document.getElementById('btn-go-election')?.addEventListener('click', () => navigate('/election'));
}
