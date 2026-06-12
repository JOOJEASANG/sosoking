import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

function esc(value) {
  return String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
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
  while (diff !== 0 && seats.length) {
    seats[i % seats.length].seats += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
    i += 1;
  }
  return seats;
}

function statusBadge(label, tone = 'neutral') {
  const bg = tone === 'danger' ? 'rgba(239,68,68,.12)' : tone === 'ok' ? 'rgba(34,197,94,.12)' : 'rgba(59,130,246,.12)';
  const color = tone === 'danger' ? '#dc2626' : tone === 'ok' ? '#16a34a' : '#2563eb';
  return `<span style="display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:900">${label}</span>`;
}

function seatsHtml(seats, rulingPartyId) {
  return seats.map((p, idx) => {
    const role = p.id === rulingPartyId ? '여당' : idx === 0 ? '제1당' : '야당';
    return `<div style="padding:12px;border-radius:16px;background:var(--color-surface);border:1px solid var(--color-border)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <b style="font-size:15px">${esc(p.emoji)} ${esc(p.name)}</b>
        ${statusBadge(role, p.id === rulingPartyId ? 'ok' : 'neutral')}
      </div>
      <div style="display:flex;align-items:end;gap:8px;margin-top:10px">
        <span style="font-size:28px;font-weight:1000;color:var(--color-text-primary)">${p.seats}</span>
        <span style="font-size:12px;color:var(--color-text-muted);margin-bottom:5px">석 / 100석</span>
      </div>
      <div style="height:8px;border-radius:999px;background:var(--color-border);overflow:hidden;margin-top:8px">
        <i style="display:block;width:${p.seats}%;height:100%;background:${esc(p.color || '#64748b')};border-radius:999px"></i>
      </div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-top:7px">정치력 ${fmtNum(p.totalPower)}P</div>
    </div>`;
  }).join('');
}

function billProgress(bill) {
  const total = Number(bill.totalVotes || 0);
  const forPct = total > 0 ? Math.round((Number(bill.votesFor || 0) / total) * 100) : 50;
  const againstPct = 100 - forPct;
  return `<div style="margin-top:12px">
    <div style="height:10px;border-radius:999px;background:rgba(239,68,68,.18);overflow:hidden;display:flex">
      <i style="display:block;width:${forPct}%;height:100%;background:#2563eb"></i>
      <i style="display:block;width:${againstPct}%;height:100%;background:#ef4444"></i>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-text-secondary);margin-top:6px">
      <span>찬성 ${fmtNum(bill.votesFor)}표</span><span>반대 ${fmtNum(bill.votesAgainst)}표</span>
    </div>
  </div>`;
}

function congressBillsHtml(bills, myVotes) {
  if (!bills.length) {
    return `<div style="padding:16px;border-radius:18px;background:var(--color-surface);border:1px solid var(--color-border)">
      <div style="font-size:13px;font-weight:900;color:var(--color-text-muted)">현재 계류 의안</div>
      <div style="font-size:18px;font-weight:1000;margin-top:6px">의안 접수 대기</div>
      <div style="font-size:13px;color:var(--color-text-secondary);margin-top:6px">서버에서 주간 법안이 생성되면 이곳에 표시됩니다.</div>
    </div>`;
  }
  return bills.slice(0, 3).map((bill, idx) => {
    const myVote = myVotes[bill.id];
    const isClosed = bill.status === 'closed';
    const resultLabel = bill.result === 'passed' ? '가결' : bill.result === 'rejected' ? '부결' : '표결 진행';
    return `<article style="padding:16px;border-radius:18px;background:var(--color-surface);border:1px solid var(--color-border);margin-bottom:${idx === 2 ? 0 : 10}px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:start;flex-wrap:wrap">
        <div>
          <div style="font-size:13px;font-weight:900;color:var(--color-text-muted)">현재 계류 의안</div>
          <div style="font-size:20px;font-weight:1000;margin-top:5px">${esc(bill.title)}</div>
        </div>
        ${statusBadge(resultLabel, bill.result === 'rejected' ? 'danger' : bill.result === 'passed' ? 'ok' : 'neutral')}
      </div>
      <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.55;margin-top:8px">${esc(bill.desc || '')}</div>
      ${billProgress(bill)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        <button class="btn ${myVote === 'for' ? 'btn--primary' : 'btn--ghost'} btn--full congress-vote" data-bill-id="${esc(bill.id)}" data-choice="for" ${myVote || isClosed ? 'disabled' : ''}>찬성 · ${esc(bill.optionFor || '찬성')}</button>
        <button class="btn ${myVote === 'against' ? 'btn--primary' : 'btn--ghost'} btn--full congress-vote" data-bill-id="${esc(bill.id)}" data-choice="against" ${myVote || isClosed ? 'disabled' : ''}>반대 · ${esc(bill.optionAgainst || '반대')}</button>
      </div>
      ${myVote ? `<div style="font-size:12px;color:var(--color-text-muted);margin-top:8px">내 표결: ${myVote === 'for' ? '찬성' : '반대'}</div>` : ''}
    </article>`;
  }).join('');
}

function impeachmentHtml(president) {
  const count = Number(president?.impeachCount || 0);
  const threshold = Number(president?.impeachThreshold || 5);
  const triggered = !!president?.impeachTriggered;
  const hasPresident = !!president?.candidateName;
  const pct = threshold > 0 ? Math.min(100, Math.round((count / threshold) * 100)) : 0;
  return `<div style="padding:16px;border-radius:18px;background:linear-gradient(135deg,rgba(239,68,68,.08),rgba(255,255,255,.75));border:1px solid var(--color-border)">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:start;flex-wrap:wrap">
      <div>
        <div style="font-size:13px;font-weight:900;color:var(--color-text-muted)">탄핵 절차</div>
        <div style="font-size:20px;font-weight:1000;margin-top:5px">국회 탄핵소추 → 헌법재판소 심판</div>
      </div>
      ${triggered ? statusBadge('헌재 심판 대기', 'danger') : statusBadge('청원 단계')}
    </div>
    <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.55;margin-top:8px">
      ${hasPresident ? `${esc(president.candidateName)} 대통령에 대한 탄핵 청원은 ${count}/${threshold}명입니다.` : '현직 대통령이 없으면 탄핵 절차는 열리지 않습니다.'}
      청원이 기준을 넘으면 국회 탄핵소추가 가결된 것으로 보고 헌법재판소 심판 단계로 넘어갑니다.
    </div>
    <div style="height:9px;border-radius:999px;background:rgba(15,23,42,.12);overflow:hidden;margin-top:12px"><i style="display:block;width:${pct}%;height:100%;border-radius:999px;background:#ef4444"></i></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px;font-size:11px;text-align:center;color:var(--color-text-secondary)">
      <div>1. 청원</div><div>2. 국회 소추</div><div>3. 헌재 심판</div><div>4. 조기 대선</div>
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
  el.innerHTML = `<div class="page-section"><div class="empty-state"><div class="spinner spinner--lg"></div><div class="empty-state__title">국회 본회의장 입장 중…</div></div></div>`;

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
  const rulingPartyId = president?.partyId || parties[0]?.id || '';
  const seats = allocateSeats(parties);

  el.innerHTML = `<div class="page-section congress-page">
    <div style="padding:20px;border-radius:24px;background:linear-gradient(135deg,rgba(15,23,42,.95),rgba(51,65,85,.9));color:#fff;margin-bottom:16px;box-shadow:0 16px 36px rgba(15,23,42,.16)">
      <div style="font-size:12px;font-weight:900;letter-spacing:.08em;color:rgba(255,255,255,.62)">SOSO NATIONAL ASSEMBLY</div>
      <div style="font-size:27px;font-weight:1000;margin-top:5px">🏛️ 소소국회</div>
      <div style="font-size:13px;color:rgba(255,255,255,.72);margin-top:6px;line-height:1.55">3당 의석 구도, 주간 법안 표결, 탄핵소추 절차를 확인하는 입법 기관입니다.</div>
    </div>

    <section style="margin-bottom:16px">
      <div style="font-size:18px;font-weight:1000;margin-bottom:10px">의석 현황</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">${seatsHtml(seats, rulingPartyId)}</div>
    </section>

    <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:12px" class="congress-grid">
      <section>
        <div style="font-size:18px;font-weight:1000;margin-bottom:10px">법안 표결</div>
        ${congressBillsHtml(bills, myVotes)}
      </section>
      <section>
        <div style="font-size:18px;font-weight:1000;margin-bottom:10px">대통령 견제</div>
        ${impeachmentHtml(president)}
      </section>
    </div>
  </div>`;

  if (!document.getElementById('congress-style')) {
    const style = document.createElement('style');
    style.id = 'congress-style';
    style.textContent = '@media(max-width:760px){.congress-grid{grid-template-columns:1fr!important}.congress-vote{font-size:12px!important;padding-left:6px!important;padding-right:6px!important}}';
    document.head.appendChild(style);
  }
  document.querySelectorAll('.congress-vote').forEach(btn => btn.addEventListener('click', () => handleVote(btn)));
  document.getElementById('btn-go-election')?.addEventListener('click', () => navigate('/election'));
}
