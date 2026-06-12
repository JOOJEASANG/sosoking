import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const callGenerateCourtAiVerdict = httpsCallable(functions, 'generateCourtAiVerdict');

function esc(value) {
  return String(value || '').replace(/[&<>"/]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '/': '&#47;' }[ch]));
}

function statusLabel(result) {
  if (result === 'accepted') return '탄핵 인용';
  if (result === 'rejected') return '탄핵 기각';
  return '심리 중';
}

function statusBadgeClass(result) {
  if (result === 'accepted') return 'court-badge court-badge--accept';
  if (result === 'rejected') return 'court-badge court-badge--reject';
  return 'court-badge';
}

function historyBadgeClass(result) {
  if (result === 'accepted') return 'court-history-item__badge court-history-item__badge--accepted';
  if (result === 'rejected') return 'court-history-item__badge court-history-item__badge--rejected';
  return 'court-history-item__badge court-history-item__badge--pending';
}

function renderCard(review) {
  if (!review) {
    return `<div class="court-empty-card">
      <div class="court-empty-card__title">🏛️ 대기 중인 탄핵심판이 없습니다</div>
      <div class="court-empty-card__desc">국회 탄핵소추 절차가 성립하면 헌법재판소 심판이 열립니다.<br>대통령 승인율이 40% 이하로 떨어지면 탄핵 청원이 가능합니다.</div>
      <button class="btn btn--primary btn--full" id="btn-go-congress" style="margin-top:14px">🏛️ 국회 보기</button>
    </div>`;
  }
  const accept = Number(review.votesForRemoval || 0);
  const reject = Number(review.votesForDismissal || 0);
  return `<div class="court-card">
    <div class="court-card__top">
      <div>
        <div class="court-card__eyebrow">CONSTITUTIONAL COURT</div>
        <div class="court-card__title">🏛️ ${esc(review.presidentName)} 대통령 탄핵심판</div>
        <div class="court-card__charge">${esc(review.charge)}</div>
      </div>
      <span class="${statusBadgeClass(review.result)}">${statusLabel(review.result)}</span>
    </div>
    <div class="court-stats">
      <div class="court-stat"><small>탄핵 청원</small><b>${review.impeachCount}/${review.threshold}</b></div>
      <div class="court-stat"><small>인용 의견</small><b>${accept}명</b></div>
      <div class="court-stat"><small>기각 의견</small><b>${reject}명</b></div>
    </div>
    <div class="court-judges">
      ${Array.from({ length: 9 }, (_, i) =>
        `<div class="court-judge-box ${i < accept ? 'court-judge-box--accept' : 'court-judge-box--reject'}" title="${i < accept ? '인용' : '기각'}"></div>`
      ).join('')}
    </div>
    <p class="court-hint">재판관 9명 중 6명 이상 인용 의견이면 탄핵 인용 흐름으로 표시됩니다.</p>
  </div>`;
}

function renderHistory(reviews, current) {
  const list = reviews.filter(r => !current || r.id !== current.id);
  if (!list.length) return '';
  return `<div class="court-history">
    <div class="court-history__title">최근 심판 기록</div>
    <div class="court-history-list">
      ${list.map(r => `
        <div class="court-history-item">
          <span class="court-history-item__name">${esc(r.presidentName)} 대통령</span>
          <span class="${historyBadgeClass(r.result)}">${statusLabel(r.result)}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

function renderVerdictSection(verdicts) {
  const hasVerdicts = verdicts && verdicts.length > 0;
  return `<div class="court-verdict">
    <div class="court-verdict__title">⚖️ AI 재판관 의견</div>
    ${hasVerdicts
      ? `<div class="court-verdict-list" id="ai-verdict-list">
          ${verdicts.map(v => `
            <div class="court-verdict-item">
              <div class="court-verdict-item__name">${esc(v.charName)}</div>
              <div class="court-verdict-item__text">${esc(v.verdict).replace(/\n/g, '<br>')}</div>
            </div>`).join('')}
        </div>`
      : `<div class="court-verdict__desc">AI 재판관 3인이 탄핵심판에 대한 의견을 밝힙니다.</div>
         <button class="btn btn--primary btn--full" id="btn-ai-verdict">🏛️ AI 재판관 의견 생성</button>
         <div class="court-verdict-list" id="ai-verdict-list"></div>`
    }
  </div>`;
}

function bindAiVerdict(reviewId) {
  const btn = document.getElementById('btn-ai-verdict');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '생성 중...';
    const listEl = document.getElementById('ai-verdict-list');
    try {
      const res = await callGenerateCourtAiVerdict({ reviewId });
      const verdicts = res.data?.verdicts || [];
      if (listEl) {
        listEl.innerHTML = verdicts.map(v => `
          <div class="court-verdict-item">
            <div class="court-verdict-item__name">${esc(v.charName)}</div>
            <div class="court-verdict-item__text">${esc(v.verdict).replace(/\n/g, '<br>')}</div>
          </div>`).join('');
      }
      btn.remove();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '🏛️ AI 재판관 의견 생성';
      if (listEl) listEl.innerHTML = `<div style="color:var(--color-danger);font-size:13px">⚠️ 생성 실패: ${esc(e.message || '다시 시도해주세요')}</div>`;
    }
  });
}

export async function renderConstitutionalCourt() {
  setMeta('헌법재판소', '소소공화국 헌법재판소');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="page-section">
    <div class="skeleton" style="height:100px;border-radius:16px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:220px;border-radius:16px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:160px;border-radius:16px"></div>
  </div>`;

  let data = {};
  try {
    const res = await httpsCallable(functions, 'getConstitutionalCourtStatus')({});
    data = res.data || {};
  } catch (e) {
    el.innerHTML = `<div class="page-section"><div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">헌법재판소 정보를 불러오지 못했습니다</div><div class="empty-state__desc">${esc(e.message || '잠시 후 다시 시도해주세요.')}</div></div></div>`;
    return;
  }

  const current = data.current || null;
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];

  el.innerHTML = `<div class="page-section">
    <div class="court-page">
      <div class="court-hero">
        <div class="court-hero__eyebrow">SOSO CONSTITUTIONAL COURT</div>
        <div class="court-hero__title">🏛️ 헌법재판소</div>
        <div class="court-hero__desc">국회 탄핵소추 이후 열리는 탄핵심판 전용 기관입니다.</div>
      </div>
      ${renderCard(current)}
      ${current ? renderVerdictSection([]) : ''}
      ${renderHistory(reviews, current)}
    </div>
  </div>`;

  document.getElementById('btn-go-congress')?.addEventListener('click', () => navigate('/congress'));
  if (current) bindAiVerdict(current.id);
}
