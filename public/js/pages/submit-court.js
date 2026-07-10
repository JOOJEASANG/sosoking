import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260708-title3';

function ensureSimpleSubmitStyle() {
  if (document.getElementById('simple-submit-style')) return;
  const style = document.createElement('style');
  style.id = 'simple-submit-style';
  style.textContent = `
    #submit-form details.card summary::-webkit-details-marker{display:none;}
    #submit-form details.card summary::after{content:'＋';float:right;color:var(--cream-dim);font-weight:900;}
    #submit-form details.card[open] summary::after{content:'－';}
    .simple-submit-note{margin:0 0 16px;padding:13px 14px;border:1px solid var(--border);border-radius:14px;background:color-mix(in srgb,var(--gold) 7%,var(--navy-card));font-size:12px;color:var(--cream-dim);line-height:1.75;}
    .simple-submit-note strong{color:var(--gold);}
  `;
  document.head.appendChild(style);
}

async function applyPublicLimits(container) {
  try {
    const snap = await getDoc(doc(db, 'public_settings', 'config'));
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const dailyLimit = Math.max(1, Math.min(20, Number(data.dailyLimit || 3)));
    const cooldownSec = Math.max(0, Math.min(300, Number(data.cooldownSec || 45)));
    const disclaimer = Array.from(container.querySelectorAll('.disclaimer')).find(el => el.textContent.includes('하루 접수 한도'));
    if (disclaimer) {
      disclaimer.innerHTML = `· 하루 접수 한도 <strong>${dailyLimit}건</strong> · 재접수 대기 <strong>${cooldownSec}초</strong><br>· 실명·연락처·주소 등 개인정보 입력 금지 · 실제 법적 효력 없음`;
    }
  } catch (err) {
    console.warn('public submit settings skipped:', err.message || err);
  }
}

function decorateSubmit(container) {
  ensureSimpleSubmitStyle();
  const form = container.querySelector('#submit-form');
  const topCard = container.querySelector('.container > .card');
  if (topCard) topCard.classList.add('court-shell');
  if (form && !document.getElementById('simple-submit-note')) {
    form.insertAdjacentHTML('afterbegin', `
      <div id="simple-submit-note" class="simple-submit-note">
        <strong>한두 문장이면 충분합니다.</strong> 접수 후 AI 수사관이 사건을 복원하고, 원고측 핵심 주장과 피고측 반박을 만든 뒤 검사·변호인·재판부가 법정공방과 최종 판결까지 이어갑니다.
      </div>`);
  }
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  decorateSubmit(container);
  await applyPublicLimits(container);
}
