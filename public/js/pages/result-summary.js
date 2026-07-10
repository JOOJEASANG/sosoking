import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';
import { renderResult as renderBaseResult } from './result-court.js?v=20260709-script1';

function ensureSummaryStyle() {
  if (document.getElementById('quick-verdict-style')) return;
  const style = document.createElement('style');
  style.id = 'quick-verdict-style';
  style.textContent = `
    .quick-verdict{border:1px solid rgba(201,168,76,.58);border-radius:20px;background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(255,255,255,.035));padding:18px;margin-bottom:14px;box-shadow:0 10px 26px rgba(0,0,0,.14)}
    .quick-verdict-kicker{font-size:10px;font-weight:900;letter-spacing:.16em;color:var(--gold);margin-bottom:6px}
    .quick-verdict-title{font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.45;color:var(--cream);margin-bottom:13px}
    .quick-verdict-grid{display:grid;grid-template-columns:1fr;gap:9px}
    .quick-verdict-row{border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.035);padding:11px 12px}
    .quick-verdict-row span{display:block;font-size:10px;font-weight:900;color:var(--gold);margin-bottom:4px}
    .quick-verdict-row strong{display:block;font-size:14px;line-height:1.65;color:var(--cream)}
    .full-judgment-details{margin-bottom:15px}
    .full-judgment-details>summary{cursor:pointer;list-style:none;border:1px solid rgba(201,168,76,.4);border-radius:14px;background:rgba(201,168,76,.08);padding:13px 15px;color:var(--gold);font-size:13px;font-weight:900;text-align:center}
    .full-judgment-details>summary::-webkit-details-marker{display:none}
    .full-judgment-details>summary::after{content:' ＋'}
    .full-judgment-details[open]>summary::after{content:' －'}
    .full-judgment-details[open]>summary{margin-bottom:12px}
    @media(min-width:720px){.quick-verdict-grid{grid-template-columns:1fr 1fr}}
    [data-theme="light"] .quick-verdict,:root:not([data-theme="dark"]) .quick-verdict{background:linear-gradient(135deg,#fff3cf,#fffaf0)!important;border-color:#d8bc68!important}
    [data-theme="light"] .quick-verdict-title,:root:not([data-theme="dark"]) .quick-verdict-title,[data-theme="light"] .quick-verdict-row strong,:root:not([data-theme="dark"]) .quick-verdict-row strong{color:#342514!important}
    [data-theme="light"] .quick-verdict-row,:root:not([data-theme="dark"]) .quick-verdict-row{background:rgba(255,255,255,.72)!important;border-color:#e2d3af!important}
  `;
  document.head.appendChild(style);
}

function cleanLine(value, maxLength = 150) {
  return compactText(String(value || '').replace(/^[-*#\s]+/, ''), maxLength);
}

function scriptOf(result = {}) {
  return String(result.judgmentScript || '').trim();
}

function verdictLabel(result = {}) {
  const text = `${scriptOf(result)} ${result.courtOpinion || ''} ${result.sentence || ''}`;
  if (text.includes('전부 기각')) return '원고 청구 전부 기각';
  if (text.includes('기각')) return '원고 청구 일부 기각';
  if (text.includes('쌍방')) return '쌍방 생활과실 인정';
  if (text.includes('인용') || text.includes('인정')) return '원고 마음속 일부 승소';
  return '생활평온 회복명령';
}

function firstOrder(result = {}) {
  const script = scriptOf(result);
  const orderArea = script.includes('[주문]') ? script.split('[주문]').slice(1).join('[주문]') : '';
  const match = orderArea.match(/(?:^|\n)\s*1\.\s*([^\n]+)/);
  return cleanLine(match?.[1] || String(result.sentence || '').split('\n').find(Boolean) || '판결문 전문의 주문을 확인하세요.', 180);
}

function closingLine(result = {}) {
  const script = scriptOf(result);
  if (script) {
    const rows = script.split('\n').map(row => cleanLine(row, 180)).filter(Boolean);
    const candidate = [...rows].reverse().find(row => !/^\d+\./.test(row) && !row.startsWith('[') && !row.startsWith('사건번호'));
    if (candidate) return candidate;
  }
  return cleanLine(result.closingComment || result.verdict || result.courtOpinion || '사소한 사건은 작았지만 재판부의 태도는 작지 않았습니다.', 180);
}

function collapseFullJudgment(container) {
  const section = container.querySelector('#judgment-script-section');
  if (!section || section.closest('.full-judgment-details')) return;
  const details = document.createElement('details');
  details.className = 'full-judgment-details';
  details.innerHTML = '<summary>전체 수사기록·변론·판결문 펼쳐보기</summary>';
  section.insertAdjacentElement('beforebegin', details);
  details.appendChild(section);
}

async function addQuickVerdict(container, caseId) {
  ensureSummaryStyle();
  if (document.getElementById('quick-verdict')) return;

  const snap = await getDoc(doc(db, 'results', caseId)).catch(() => null);
  if (!snap?.exists()) return;
  const result = snap.data() || {};
  const card = document.createElement('section');
  card.id = 'quick-verdict';
  card.className = 'quick-verdict';
  card.innerHTML = `
    <div class="quick-verdict-kicker">5초 판결 요약</div>
    <div class="quick-verdict-title">${escapeHtml(verdictLabel(result))}</div>
    <div class="quick-verdict-grid">
      <div class="quick-verdict-row"><span>핵심 처분</span><strong>${escapeHtml(firstOrder(result))}</strong></div>
      <div class="quick-verdict-row"><span>재판부 한마디</span><strong>${escapeHtml(closingLine(result))}</strong></div>
    </div>`;

  const info = container.querySelector('.case-info-card');
  const cover = container.querySelector('.case-cover');
  (info || cover)?.insertAdjacentElement('afterend', card);
  collapseFullJudgment(container);
}

export async function renderResult(container, caseId) {
  await renderBaseResult(container, caseId);
  await addQuickVerdict(container, caseId);
}
