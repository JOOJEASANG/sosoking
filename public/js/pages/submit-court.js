import { renderSubmit as renderBaseSubmit } from './submit.js?v=20260708-simple1';

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
}

export async function renderSubmit(container) {
  await renderBaseSubmit(container);
  decorateSubmit(container);
}
