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
    #submit-form .judge-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
    #submit-form .judge-option{min-height:96px;padding:12px 10px;border-radius:16px;}
    #submit-form .judge-option-icon{font-size:24px;line-height:1;margin-bottom:6px;display:inline-flex;}
    #submit-form .judge-option-name{font-size:13px;font-weight:900;line-height:1.3;}
    #submit-form .judge-option-desc{font-size:10.5px;line-height:1.45;margin-top:4px;}
    .simple-submit-note{margin:0 0 16px;padding:12px 14px;border:1px solid rgba(201,168,76,.28);border-radius:14px;background:rgba(201,168,76,.07);font-size:12px;color:var(--cream-dim);line-height:1.7;}
    .simple-submit-note strong{color:var(--gold);}
    @media(max-width:420px){#submit-form .judge-grid{grid-template-columns:1fr 1fr;gap:8px;}#submit-form .judge-option{padding:10px 8px;min-height:92px;}}
  `;
  document.head.appendChild(style);
}
function applySaferPublicDefault(container) {
  const pub = container.querySelector('#is-public');
  if (pub && pub.dataset.defaultSet !== '1') {
    pub.checked = false;
    pub.dataset.defaultSet = '1';
    const text = pub.closest('label')?.querySelector('span');
    if (text) text.innerHTML = '<b style="color:var(--gold);">판결문 생성 후 공개 선택</b><br><span style="color:var(--cream-dim);">처음에는 비공개로 저장됩니다. 결과 화면에서 내용을 확인한 뒤 공개할 수 있습니다.</span>';
  }
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
      disclaimer.innerHTML = `· 하루 접수 한도 <strong>${dailyLimit}건</strong> · 재접수 대기 <strong>${cooldownSec}초</strong><br>· 실명·연락처·주민번호 입력 금지 · 실제 법적 효력 없음`;
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
        <strong>간단 접수 방식</strong> · 사건을 길게 쓸 필요 없습니다. 한두 문장만 적으면 사건번호, 담당 조사관, 증거 아닌 증거, 황당 처분은 재판부가 알아서 크게 키웁니다.
      </div>`);
  }
  applySaferPublicDefault(container);
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  decorateSubmit(container);
  await applyPublicLimits(container);
}
