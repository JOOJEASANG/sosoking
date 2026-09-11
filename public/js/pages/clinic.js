import { functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const COUNSELORS = [
  { id: 'musok', emoji: '🔮', name: '만신 김보살', tag: '신점 40년' },
  { id: 'uju', emoji: '🛸', name: '우주교 라엘롱', tag: '교주 3대째' },
  { id: 'halmae', emoji: '👵', name: '옆집 순자씨', tag: '인생 78년차' },
  { id: 'tbal', emoji: '🤖', name: '이성재', tag: '감정 0% 논리 100%' },
  { id: 'bungeo', emoji: '🐟', name: '지나가던 붕어', tag: '기억력 3초' },
  { id: 'baeu', emoji: '🎭', name: '대배우 오갈비', tag: '국립극단 40년' }
];
const EMOJI = Object.fromEntries(COUNSELORS.map(c => [c.id, c.emoji]));

const SAMPLES = [
  '썸녀가 카톡 1을 3시간째 안 읽어요',
  '회사 때려치우고 싶은데 통장이 웁니다',
  '다이어트 3일째인데 치킨이 자꾸 말을 걸어요',
  '친구가 5만원 빌려가고 잠수 탔어요'
];

const HALL = [
  { q: '남친이 게임하느라 답장을 안 해요', by: '🔮 만신 김보살', a: '그 남자, 전생에 PC방 사장이었소. 카톡 대신 롤 전적을 보시오. 승률이 곧 그의 사랑이니.' },
  { q: '월요일이 너무 싫어요', by: '🤖 이성재', a: '월요일은 7일 중 1일, 즉 14.3%입니다. 나머지 85.7%를 낭비하는 게 더 비효율적입니다.' },
  { q: '배달 최소주문 맞추려고 안 먹을 걸 시켰어요', by: '👵 옆집 순자씨', a: '아이고 잘했어. 남기면 아까우니 그것도 다 먹고, 담엔 그냥 나가서 사 먹어.' }
];

let picked = null;
let lastWorry = '';

function ensureClinicStyle() {
  if (document.getElementById('clinic-page-style')) return;
  const style = document.createElement('style');
  style.id = 'clinic-page-style';
  style.textContent = `
    .clinic-page{--rx-stamp:#ff4d3d;--rx-clinic:#17948a;}
    .clinic-wrap{max-width:560px;margin:0 auto;padding:18px 16px 90px;}
    .clinic-kicker{font-size:11px;letter-spacing:.16em;color:var(--gold);text-transform:uppercase;font-weight:800;}
    .clinic-head{font-family:var(--font-serif);font-size:26px;font-weight:900;line-height:1.25;margin:8px 0 4px;text-wrap:balance;}
    .clinic-head em{color:var(--rx-stamp);font-style:normal;}
    .clinic-sub{font-size:13px;color:var(--cream-dim);margin-bottom:16px;}
    .clinic-intake{background:var(--navy-card);border:1px solid var(--border);border-radius:16px;padding:16px 15px 15px;box-shadow:var(--shadow);}
    .clinic-intake-label{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.1em;color:var(--cream-dim);font-weight:700;margin-bottom:8px;text-transform:uppercase;}
    .clinic-intake textarea{width:100%;resize:vertical;min-height:84px;border:1px dashed var(--border);border-radius:11px;padding:12px;font-family:var(--font-sans);font-size:15px;line-height:1.65;color:var(--cream);background:rgba(255,255,255,.03);}
    .clinic-intake textarea:focus-visible{outline:2px solid var(--gold);outline-offset:1px;}
    .clinic-samples{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
    .clinic-samples button{cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--cream-dim);background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:999px;padding:6px 11px;transition:transform .12s;}
    .clinic-samples button:hover{transform:translateY(-1px);}
    .clinic-samples button:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .clinic-sec{font-size:10px;letter-spacing:.14em;color:var(--cream-dim);text-transform:uppercase;font-weight:700;margin:22px 2px 10px;}
    .clinic-docs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
    .clinic-doc{cursor:pointer;position:relative;border:1.5px solid var(--border);border-radius:14px;background:var(--navy-card);padding:12px 6px 10px;text-align:center;transition:transform .14s,border-color .18s;font-family:inherit;color:var(--cream);}
    .clinic-doc:hover{transform:translateY(-3px);}
    .clinic-doc:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .clinic-doc[aria-pressed="true"]{border-color:var(--gold);background:rgba(201,168,76,.1);}
    .clinic-doc[aria-pressed="true"]::after{content:"선택";position:absolute;top:-8px;right:-5px;font-size:9px;font-weight:800;color:#241a05;background:var(--gold);border-radius:999px;padding:3px 7px;}
    .clinic-doc-face{font-size:28px;line-height:1;}
    .clinic-doc-name{font-weight:900;font-size:12.5px;margin-top:6px;}
    .clinic-doc-tag{font-size:9.5px;color:var(--cream-dim);margin-top:2px;line-height:1.3;}
    .clinic-cta{margin-top:16px;width:100%;cursor:pointer;font-family:var(--font-serif);font-size:18px;font-weight:900;color:#fff;background:var(--rx-stamp);border:0;border-radius:14px;padding:15px;transition:transform .12s,filter .2s;}
    .clinic-cta:hover{transform:translateY(-2px);filter:brightness(1.05);}
    .clinic-cta:disabled{opacity:.6;cursor:progress;transform:none;}
    .clinic-cta:focus-visible{outline:3px solid var(--gold);outline-offset:2px;}
    .clinic-result{margin-top:24px;}
    .clinic-result[hidden]{display:none;}
    .rx-card{position:relative;background:var(--navy-card);border:2px solid var(--border);border-radius:8px;padding:20px 18px 16px;box-shadow:var(--shadow);overflow:hidden;}
    .rx-top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--border);padding-bottom:10px;margin-bottom:13px;}
    .rx-clinic-name{font-family:var(--font-serif);font-size:16px;font-weight:900;color:var(--cream);}
    .rx-no{font-size:10px;color:var(--cream-dim);margin-top:4px;font-variant-numeric:tabular-nums;}
    .rx-symbol{font-family:var(--font-serif);font-size:32px;color:var(--rx-stamp);line-height:.8;}
    .rx-doc{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
    .rx-doc .f{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid var(--border);display:grid;place-items:center;font-size:21px;}
    .rx-doc .n{font-weight:900;font-size:14px;color:var(--cream);}
    .rx-doc .t{font-size:10.5px;color:var(--cream-dim);}
    .rx-row{margin-bottom:12px;}
    .rx-key{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.1em;color:#fff;background:var(--rx-clinic);padding:2px 8px;border-radius:5px;margin-bottom:6px;text-transform:uppercase;}
    .rx-key.diag{background:var(--gold);color:#241a05;}
    .rx-key.warn{background:var(--rx-stamp);}
    .rx-val{font-size:14.5px;line-height:1.75;color:var(--cream);word-break:keep-all;}
    .rx-val.big{font-family:var(--font-serif);font-size:18px;font-weight:800;line-height:1.35;}
    .rx-stamp{position:absolute;right:12px;bottom:44px;width:78px;height:78px;border:3px solid var(--rx-stamp);border-radius:50%;color:var(--rx-stamp);display:grid;place-items:center;text-align:center;font-family:var(--font-serif);font-size:14px;font-weight:900;line-height:1.1;transform:rotate(-14deg);opacity:.8;pointer-events:none;}
    .rx-stamp small{display:block;font-size:7px;letter-spacing:.1em;margin-top:2px;}
    .rx-foot{border-top:1px dashed var(--border);margin-top:4px;padding-top:9px;font-size:9.5px;color:var(--cream-dim);line-height:1.5;}
    .clinic-actions{display:flex;gap:9px;margin-top:14px;}
    .clinic-actions button{flex:1;cursor:pointer;font-family:inherit;font-weight:900;font-size:13.5px;border-radius:12px;padding:13px 8px;border:1.5px solid var(--border);transition:transform .1s;color:var(--cream);background:var(--navy-card);}
    .clinic-actions button:hover{transform:translateY(-2px);}
    .clinic-actions button.share{background:var(--gold);color:#241a05;border-color:var(--gold);}
    .clinic-actions button:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .clinic-loading{text-align:center;padding:30px 10px;color:var(--cream-dim);}
    .clinic-loading .big{font-size:40px;animation:clinic-bob 1s ease-in-out infinite;}
    @keyframes clinic-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    .clinic-care{background:rgba(23,148,138,.1);border:1.5px solid var(--rx-clinic);border-radius:14px;padding:18px 16px;}
    .clinic-care h3{margin:0 0 6px;font-size:16px;font-weight:900;color:var(--cream);}
    .clinic-care p{margin:0 0 12px;font-size:13px;line-height:1.7;color:var(--cream-dim);}
    .clinic-care a{display:flex;justify-content:space-between;text-decoration:none;color:var(--cream);font-weight:700;font-size:13px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:10px;padding:11px 13px;margin-bottom:7px;}
    .clinic-hall{margin-top:30px;}
    .clinic-hall-item{background:var(--navy-card);border:1px solid var(--border);border-radius:13px;padding:13px 14px;margin-bottom:9px;}
    .clinic-hall-q{font-size:12.5px;color:var(--cream-dim);margin-bottom:6px;}
    .clinic-hall-q b{color:var(--cream);}
    .clinic-hall-a{font-size:13.5px;font-weight:700;line-height:1.6;color:var(--cream);word-break:keep-all;}
    .clinic-hall-by{font-size:10px;color:var(--cream-dim);margin-top:7px;}
    .clinic-disclaimer{margin-top:22px;text-align:center;font-size:10.5px;color:var(--cream-dim);line-height:1.65;}
    @media(prefers-reduced-motion:reduce){.clinic-loading .big{animation:none;}}
  `;
  document.head.appendChild(style);
}

export async function renderClinic(container) {
  ensureClinicStyle();
  picked = null;
  container.innerHTML = `
    <div class="clinic-page">
      <div class="page-header"><span class="logo">🔮 미친 상담소</span></div>
      <div class="clinic-wrap">
        <div class="clinic-kicker">접수 · INTAKE</div>
        <h1 class="clinic-head">무슨 고민이든<br><em>정신 나간 처방</em>을 내려드림</h1>
        <p class="clinic-sub">진지한 상담은 다른 데서, 여긴 병맛 전문입니다.</p>

        <section class="clinic-intake">
          <div class="clinic-intake-label"><span>▓ 고민 접수증</span><span id="clinic-count">0 / 200</span></div>
          <textarea id="clinic-worry" maxlength="200" placeholder="예: 썸녀가 카톡 1을 3시간째 안 읽어요… 저 차인 건가요?"></textarea>
          <div class="clinic-samples" id="clinic-samples"></div>
        </section>

        <div class="clinic-sec">담당 상담사 지정 · 원하는 미친놈을 고르세요</div>
        <div class="clinic-docs" id="clinic-docs"></div>

        <button class="clinic-cta" id="clinic-go" type="button">🩺 진료 시작 · 처방전 받기</button>

        <section class="clinic-result" id="clinic-result" hidden aria-live="polite"></section>

        <div class="clinic-hall">
          <div class="clinic-sec">🏆 오늘의 미친 처방 명예의전당</div>
          <div id="clinic-hall"></div>
        </div>

        <p class="clinic-disclaimer">100% 오락용이며 의학·법률·심리 효력이 전혀 없습니다.<br>진짜 힘든 고민은 병맛 대신 전문가에게 — 자살예방 <b>109</b> · 정신건강 <b>1577-0199</b></p>
      </div>
    </div>`;

  const worryEl = container.querySelector('#clinic-worry');
  const countEl = container.querySelector('#clinic-count');
  worryEl.addEventListener('input', () => { countEl.textContent = `${worryEl.value.length} / 200`; });

  container.querySelector('#clinic-samples').innerHTML =
    SAMPLES.map(s => `<button type="button" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('');
  container.querySelectorAll('#clinic-samples [data-s]').forEach(b => b.addEventListener('click', () => {
    worryEl.value = b.dataset.s; countEl.textContent = `${worryEl.value.length} / 200`; worryEl.focus();
  }));

  container.querySelector('#clinic-docs').innerHTML = COUNSELORS.map(d => `
    <button class="clinic-doc" type="button" data-id="${d.id}" aria-pressed="false" aria-label="${escapeHtml(d.name)} · ${escapeHtml(d.tag)}">
      <div class="clinic-doc-face" aria-hidden="true">${d.emoji}</div>
      <div class="clinic-doc-name">${escapeHtml(d.name)}</div>
      <div class="clinic-doc-tag">${escapeHtml(d.tag)}</div>
    </button>`).join('');
  container.querySelectorAll('#clinic-docs [data-id]').forEach(b => b.addEventListener('click', () => {
    picked = b.dataset.id;
    container.querySelectorAll('#clinic-docs [data-id]').forEach(x => x.setAttribute('aria-pressed', x.dataset.id === picked));
  }));

  container.querySelector('#clinic-hall').innerHTML = HALL.map(h => `
    <div class="clinic-hall-item">
      <div class="clinic-hall-q">Q. <b>${escapeHtml(h.q)}</b></div>
      <div class="clinic-hall-a">“${escapeHtml(h.a)}”</div>
      <div class="clinic-hall-by">— ${escapeHtml(h.by)}</div>
    </div>`).join('');

  container.querySelector('#clinic-go').addEventListener('click', () => submitWorry(container));
}

async function submitWorry(container) {
  const worryEl = container.querySelector('#clinic-worry');
  const worry = (worryEl?.value || '').trim();
  if (worry.length < 3) { showToast('고민을 조금만 더 적어주세요 🙏', 'error'); worryEl?.focus(); return; }
  if (!picked) {
    picked = COUNSELORS[Math.floor(Math.random() * COUNSELORS.length)].id;
    container.querySelectorAll('#clinic-docs [data-id]').forEach(x => x.setAttribute('aria-pressed', x.dataset.id === picked));
  }
  lastWorry = worry;
  await callAdvice(container, worry, picked);
}

async function callAdvice(container, worry, counselorId) {
  const go = container.querySelector('#clinic-go');
  const result = container.querySelector('#clinic-result');
  const counselor = COUNSELORS.find(c => c.id === counselorId) || COUNSELORS[0];
  if (go) { go.disabled = true; }
  if (result) {
    result.hidden = false;
    result.innerHTML = `<div class="clinic-loading"><div class="big" aria-hidden="true">${counselor.emoji}</div><div style="margin-top:10px;font-weight:700;">${escapeHtml(counselor.name)}님이 처방전을 쓰는 중…</div><div style="font-size:12px;margin-top:4px;">뇌지컬을 쥐어짜고 있습니다</div></div>`;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  try {
    const call = httpsCallable(functions, 'generateAdvice');
    const response = await call({ worry, counselorId });
    if (!container.isConnected) return;
    const data = response.data || {};
    if (data.safe === false) { renderCare(container); return; }
    renderResult(container, worry, data);
  } catch (error) {
    console.warn('generateAdvice failed:', error?.code || error);
    if (!container.isConnected) return;
    const code = String(error?.code || '');
    const msg = String(error?.message || '상담 중 오류가 발생했습니다.').replace('FirebaseError: ', '');
    if (code.includes('resource-exhausted')) { renderLimit(container, msg); }
    else { if (result) result.hidden = true; showToast(msg, 'error'); }
  } finally {
    if (go) { go.disabled = false; }
  }
}

function renderLimit(container, message) {
  const result = container.querySelector('#clinic-result');
  if (!result) return;
  result.hidden = false;
  result.innerHTML = `
    <div class="clinic-care" style="border-color:var(--gold);background:rgba(201,168,76,.1);">
      <h3>😵‍💫 오늘 무료 상담이 다 찼어요</h3>
      <p>${escapeHtml(message)}</p>
      <a href="#/auth" style="justify-content:center;font-weight:900;color:#241a05;background:var(--gold);border-color:var(--gold);">로그인하고 더 상담받기 →</a>
    </div>`;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderResult(container, worry, data) {
  const result = container.querySelector('#clinic-result');
  if (!result) return;
  const a = data.advice || {};
  const emoji = EMOJI[data.counselorId] || '🩺';
  const no = String(1000 + Math.floor(Math.random() * 8999));
  result.innerHTML = `
    <div class="rx-card">
      <div class="rx-top">
        <div><div class="rx-clinic-name">미친 고민상담소</div><div class="rx-no">처방전 No. ${no} · ${new Date().toLocaleDateString('ko-KR')}</div></div>
        <div class="rx-symbol" aria-hidden="true">℞</div>
      </div>
      <div class="rx-doc"><span class="f">${emoji}</span><div><div class="n">${escapeHtml(data.counselorName || '상담사')}</div><div class="t">${escapeHtml(data.counselorTag || '')}</div></div></div>
      <div class="rx-row"><span class="rx-key diag">진단명</span><div class="rx-val big">${escapeHtml(a.diagnosis || '')}</div></div>
      <div class="rx-row"><span class="rx-key">처방</span><div class="rx-val">${escapeHtml(a.prescription || '')}</div></div>
      ${a.dosage ? `<div class="rx-row"><span class="rx-key">복용법</span><div class="rx-val">${escapeHtml(a.dosage)}</div></div>` : ''}
      ${a.caution ? `<div class="rx-row"><span class="rx-key warn">주의</span><div class="rx-val">${escapeHtml(a.caution)}</div></div>` : ''}
      <div class="rx-stamp" aria-hidden="true">미친처방<small>승인 · APPROVED</small></div>
      <div class="rx-foot">본 처방전은 오락용이며 효력이 없습니다 · 미친 고민상담소 제3진료실</div>
    </div>
    <div class="clinic-actions">
      <button type="button" id="clinic-again">🔀 다른 상담사에게</button>
      <button type="button" class="share" id="clinic-share">📤 처방전 공유</button>
    </div>`;

  result.querySelector('#clinic-again')?.addEventListener('click', () => {
    const others = COUNSELORS.filter(c => c.id !== data.counselorId);
    picked = others[Math.floor(Math.random() * others.length)].id;
    container.querySelectorAll('#clinic-docs [data-id]').forEach(x => x.setAttribute('aria-pressed', x.dataset.id === picked));
    callAdvice(container, lastWorry, picked);
  });
  result.querySelector('#clinic-share')?.addEventListener('click', () => {
    const text = `😵‍💫 미친 고민상담소 처방전\n고민: ${worry}\n${data.counselorName} 왈: ${a.prescription}`;
    const url = a.resultId ? `${location.origin}/advice/${encodeURIComponent(a.resultId)}` : `${location.origin}/#/clinic`;
    if (navigator.share) navigator.share({ title: '미친 고민상담소', text, url }).catch(() => {});
    else if (navigator.clipboard?.writeText) navigator.clipboard.writeText(`${text}\n${url}`).then(() => showToast('처방전을 복사했어요 📋', 'success')).catch(() => {});
    else showToast('공유를 지원하지 않는 환경이에요', 'info');
  });
}

function renderCare(container) {
  const result = container.querySelector('#clinic-result');
  if (!result) return;
  result.innerHTML = `
    <div class="clinic-care">
      <h3>이 고민은 병맛으로 다룰 수 없어요</h3>
      <p>지금 많이 힘드신 것 같아요. 이런 마음은 장난이 아니라 전문가와 나눌 이야기예요. 아래로 지금 바로 연결됩니다.</p>
      <a href="tel:109">📞 자살예방 상담전화 <b>109</b></a>
      <a href="tel:1577-0199">📞 정신건강 위기상담 <b>1577-0199</b></a>
      <a href="tel:1388">📞 청소년 상담 <b>1388</b></a>
    </div>`;
}
