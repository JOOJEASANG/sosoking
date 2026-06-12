import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

function esc(value) {
  return String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function label(result) {
  if (result === 'accepted') return '인용 예상';
  if (result === 'rejected') return '기각 예상';
  return '심리 중';
}

function card(review) {
  if (!review) {
    return `<section style="padding:18px;border-radius:20px;background:var(--color-surface);border:1px solid var(--color-border)">
      <div style="font-size:20px;font-weight:1000">대기 중인 탄핵심판이 없습니다</div>
      <div style="font-size:13px;color:var(--color-text-secondary);margin-top:7px;line-height:1.55">국회 탄핵소추 절차가 성립하면 헌법재판소 심판이 표시됩니다.</div>
      <button class="btn btn--primary btn--full" id="btn-go-congress" style="margin-top:14px">국회 보기</button>
    </section>`;
  }
  const accept = Number(review.votesForRemoval || 0);
  const reject = Number(review.votesForDismissal || 0);
  return `<section style="padding:18px;border-radius:22px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(51,65,85,.92));color:#fff;box-shadow:0 16px 36px rgba(15,23,42,.18);margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap">
      <div>
        <div style="font-size:12px;font-weight:900;color:rgba(255,255,255,.62);letter-spacing:.08em">CONSTITUTIONAL COURT</div>
        <div style="font-size:24px;font-weight:1000;margin-top:5px">🏛️ ${esc(review.presidentName)} 대통령 탄핵심판</div>
        <div style="font-size:13px;color:rgba(255,255,255,.72);margin-top:6px">${esc(review.charge)}</div>
      </div>
      <span style="padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12px;font-weight:900">${label(review.result)}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px">
      <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,.12)"><small>청원</small><b>${review.impeachCount}/${review.threshold}</b></div>
      <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,.12)"><small>인용 의견</small><b>${accept}명</b></div>
      <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,.12)"><small>기각 의견</small><b>${reject}명</b></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:5px;margin-top:14px">
      ${Array.from({ length: 9 }, (_, i) => `<div style="height:34px;border-radius:10px;background:${i < accept ? '#ef4444' : '#22c55e'};opacity:.9"></div>`).join('')}
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,.72);margin-top:9px">재판관 9명 중 6명 이상 인용 의견이면 탄핵 인용 흐름으로 표시됩니다.</div>
  </section>`;
}

function history(reviews, current) {
  const list = reviews.filter(r => !current || r.id !== current.id);
  if (!list.length) return '';
  return `<section style="margin-top:18px"><div style="font-size:18px;font-weight:1000;margin-bottom:10px">최근 심판 기록</div>
    <div style="display:grid;gap:8px">${list.map(r => `<div style="padding:12px;border-radius:14px;background:var(--color-surface);border:1px solid var(--color-border);display:flex;justify-content:space-between;gap:10px;align-items:center"><b>${esc(r.presidentName)}</b><span style="font-size:12px;font-weight:900">${label(r.result)}</span></div>`).join('')}</div>
  </section>`;
}

export async function renderConstitutionalCourt() {
  setMeta('헌법재판소', '소소공화국 헌법재판소');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="page-section"><div class="empty-state"><div class="spinner spinner--lg"></div><div class="empty-state__title">헌법재판소 사건 확인 중…</div></div></div>`;

  const res = await httpsCallable(functions, 'getConstitutionalCourtStatus')({});
  const data = res.data || {};
  const current = data.current || null;
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];

  el.innerHTML = `<div class="page-section">
    <div style="padding:18px;border-radius:24px;background:linear-gradient(135deg,rgba(127,29,29,.1),rgba(255,255,255,.8));border:1px solid var(--color-border);margin-bottom:16px">
      <div style="font-size:12px;font-weight:900;color:var(--color-text-muted);letter-spacing:.08em">SOSO CONSTITUTIONAL COURT</div>
      <div style="font-size:27px;font-weight:1000;margin-top:5px">🏛️ 헌법재판소</div>
      <div style="font-size:13px;color:var(--color-text-secondary);margin-top:6px;line-height:1.55">국회 탄핵소추 이후 열리는 탄핵심판 전용 기관입니다.</div>
    </div>
    ${card(current)}
    ${history(reviews, current)}
  </div>`;
  document.getElementById('btn-go-congress')?.addEventListener('click', () => navigate('/congress'));
}
