import { functions } from '../firebase.js?v=20260630-3';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { renderResult as renderBaseResult } from './result.js?v=20260708-result2';

function grievance(container) {
  const text = container.textContent || '';
  const m = text.match(/억울지수\s*(\d+)/);
  return Number(m?.[1] || 5);
}
function gradeByLv(lv) {
  if (lv >= 10) return ['SS', '전설의 억울함'];
  if (lv >= 8) return ['S', '제404호 긴급사건'];
  if (lv >= 6) return ['A', '황당재판 주요 사건'];
  if (lv >= 4) return ['B', '방청석 소환 가능'];
  return ['C', '사소하지만 기록됨'];
}
function badgesBy(container, lv) {
  const text = container.textContent || '';
  const badges = [];
  badges.push(['📜', '황당판결 발급']);
  if (text.includes('소소경찰') || text.includes('수사')) badges.push(['🚓', '수사기록 생성']);
  if (text.includes('황당검사') || text.includes('검사')) badges.push(['💼', '공소제기 완료']);
  if (text.includes('변호인')) badges.push(['🛡️', '변론 공방']);
  if (lv >= 8) badges.push(['🔥', '과몰입 인정']);
  if (text.includes('이미지 감정')) badges.push(['🖼️', '이미지 증거']);
  return badges.slice(0, 5);
}
function ensureResultGameStyle() {
  if (document.getElementById('result-game-style')) return;
  const style = document.createElement('style');
  style.id = 'result-game-style';
  style.textContent = `
    .reward-card{padding:18px;margin-bottom:14px;border-radius:20px;border:1px solid rgba(201,168,76,.45);background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(231,76,60,.08),rgba(255,255,255,.035));box-shadow:0 12px 34px rgba(0,0,0,.24);}
    .reward-grade{width:70px;height:70px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-family:var(--font-serif);font-size:32px;font-weight:900;color:#111827;background:linear-gradient(135deg,#ffdf7a,#c9a84c);box-shadow:0 10px 26px rgba(201,168,76,.28);}
    .reward-badge{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(201,168,76,.36);background:rgba(255,255,255,.07);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;color:#fff8ec;}
    .invite-defense{padding:16px;margin-bottom:14px;border-radius:18px;border:1px dashed rgba(201,168,76,.48);background:rgba(201,168,76,.07);}
    .invite-defense-title{font-weight:900;color:#e8c97a;margin-bottom:6px;}
    .invite-defense-desc{font-size:12px;color:rgba(255,248,236,.78);line-height:1.7;margin-bottom:12px;}
    .drama-flow-card{padding:16px;margin-bottom:14px;border-radius:18px;border:1px solid rgba(201,168,76,.35);background:rgba(201,168,76,.07);}
    .drama-flow{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px;}
    .drama-flow span{white-space:nowrap;border:1px solid rgba(201,168,76,.25);border-radius:999px;padding:7px 10px;font-size:11px;color:var(--cream-dim);background:rgba(255,255,255,.035);}
    .owner-delete-case{border-color:rgba(231,76,60,.45)!important;color:#e74c3c!important;}
    [data-theme="light"] .reward-badge,:root:not([data-theme="dark"]) .reward-badge{color:#fff8ec;background:rgba(13,17,23,.82);}
    [data-theme="light"] .invite-defense,:root:not([data-theme="dark"]) .invite-defense{background:#fff8e8!important;border-color:#d8c48d!important;box-shadow:0 8px 22px rgba(70,46,16,.08)!important;}
    [data-theme="light"] .invite-defense-title,:root:not([data-theme="dark"]) .invite-defense-title{color:#5b3f09!important;}
    [data-theme="light"] .invite-defense-desc,:root:not([data-theme="dark"]) .invite-defense-desc{color:#5f4b35!important;opacity:1!important;}
  `;
  document.head.appendChild(style);
}
function normalizeCourtDramaWording(container) {
  const map = [
    ['억울함 분석 결과', '소소경찰 수사기록'],
    ['억울함/황당성 분석', '초동수사 및 정황감식'],
    ['증거 아닌 증거 목록', '소소경찰 증거채집 목록'],
    ['핵심 쟁점', '공판 쟁점'],
    ['원고 측 주장', '황당검사 측 공소제기'],
    ['내가 이걸로 재판까지 해야 하나 싶은 바로 그 심정', '작은 일을 중대하게 몰아가는 검사 측 주장'],
    ['피고 측 변명 추정', '피고측 변호인 반박'],
    ['피고가 할 법한 말을 재판부가 미리 엄숙하게 정리', '말은 되지만 어쩐지 억울함을 키우는 변호인 주장'],
    ['재판부 판단', '재판부 공방 판단'],
    ['가장 쓸데없이 진지한 부분', '검사와 변호인의 공방을 들은 뒤 내린 과몰입 판단'],
    ['증거능력은 없지만 웃기기에는 충분한 자료입니다.', '소소경찰이 굳이 봉투에 담은 척 정리한 자료입니다.']
  ];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let text = node.nodeValue;
    map.forEach(([a, b]) => { text = text.replaceAll(a, b); });
    node.nodeValue = text;
  });
}
function addDramaFlow(container) {
  if (document.getElementById('drama-flow-card')) return;
  const reward = document.getElementById('game-reward-card');
  if (!reward) return;
  reward.insertAdjacentHTML('afterend', `
    <div id="drama-flow-card" class="drama-flow-card">
      <div class="court-kicker" style="margin-bottom:8px;">CASE DRAMA FLOW</div>
      <div class="drama-flow">
        <span>📋 사건접수</span><span>🚓 소소경찰 수사</span><span>🔍 증거채집</span><span>💼 황당검사 공소</span><span>🛡️ 변호인 반박</span><span>⚖️ 재판공방</span><span>🔨 판결선고</span>
      </div>
    </div>`);
}
function addReward(container) {
  if (document.getElementById('game-reward-card')) return;
  const lv = grievance(container);
  const [grade, label] = gradeByLv(lv);
  const badges = badgesBy(container, lv);
  const target = container.querySelector('.container > .card');
  if (!target) return;
  target.insertAdjacentHTML('afterend', `
    <div id="game-reward-card" class="reward-card">
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
        <div class="reward-grade">${grade}</div>
        <div style="flex:1;min-width:0;">
          <div class="court-kicker">JUDGEMENT REWARD</div>
          <div class="court-title" style="font-size:20px;">${label}</div>
          <div class="court-desc">소소한 일이 수사·공방·판결까지 완료된 황당사건 기록으로 등록되었습니다.</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${badges.map(([i, t]) => `<span class="reward-badge">${i} ${t}</span>`).join('')}</div>
    </div>`);
}
function addInviteDefense(container) {
  if (document.getElementById('invite-defense-card')) return;
  const actions = container.querySelector('.result-actions');
  if (!actions) return;
  actions.insertAdjacentHTML('beforebegin', `
    <div id="invite-defense-card" class="invite-defense">
      <div class="invite-defense-title">🔗 사건 링크 공유</div>
      <div class="invite-defense-desc">판결문 링크를 복사해서 친구에게 보낼 수 있습니다. 링크를 받은 사람은 공개된 황당판결 기록을 볼 수 있습니다.</div>
      <button class="btn btn-secondary" id="copy-defense-link">사건 링크 복사</button>
    </div>`);
  document.getElementById('copy-defense-link')?.addEventListener('click', async () => {
    const url = location.href;
    try { await navigator.clipboard?.writeText(url); alert('사건 링크를 복사했습니다.'); }
    catch { prompt('아래 링크를 복사하세요.', url); }
  });
}
function addOwnerDelete(container, caseId) {
  if (document.getElementById('owner-delete-case')) return;
  const actions = container.querySelector('.result-actions');
  if (!actions) return;
  const ownerShareButton = document.getElementById('btn-share');
  if (!ownerShareButton) return;
  actions.insertAdjacentHTML('afterbegin', `<button class="btn btn-ghost owner-delete-case" id="owner-delete-case">🗑️ 이 사건 삭제</button>`);
  document.getElementById('owner-delete-case')?.addEventListener('click', async () => {
    const ok = confirm('이 사건을 삭제할까요?\n\n접수내용, 판결문, 투표, 댓글, 신고 데이터가 함께 삭제됩니다. 삭제 후 복구할 수 없습니다.');
    if (!ok) return;
    const btn = document.getElementById('owner-delete-case');
    btn.disabled = true;
    btn.textContent = '삭제 중...';
    try {
      await httpsCallable(functions, 'deleteMyCase')({ caseId });
      showToast('사건을 삭제했습니다.', 'success');
      location.hash = '#/my-cases';
    } catch (err) {
      console.error(err);
      const raw = String(err.message || '삭제하지 못했습니다.');
      const msg = raw.includes('not-found') ? '삭제 함수가 아직 배포되지 않았습니다. Functions 배포가 필요합니다.' : raw.replace('FirebaseError: ', '');
      showToast(msg, 'error');
      btn.disabled = false;
      btn.textContent = '🗑️ 이 사건 삭제';
    }
  });
}
function decorateResult(container, caseId) {
  ensureResultGameStyle();
  normalizeCourtDramaWording(container);
  const titleCard = container.querySelector('.container > .card');
  if (titleCard && !document.getElementById('court-result-header')) {
    titleCard.classList.add('court-shell');
    titleCard.insertAdjacentHTML('afterbegin', `
      <div id="court-result-header" style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
        <span class="court-stamp">선고</span>
        <span class="court-kicker">FINAL STAGE CLEAR</span>
      </div>
      <div class="court-bench"></div>`);
  }
  addReward(container);
  addDramaFlow(container);
  const verdictCard = container.querySelector('.verdict-card');
  if (verdictCard && !document.getElementById('court-verdict-label')) {
    verdictCard.classList.add('court-document');
    verdictCard.insertAdjacentHTML('afterbegin', `
      <div id="court-verdict-label" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
        <div><div class="court-kicker">JUDGEMENT DOCUMENT</div><div class="court-title" style="font-size:19px;">황당재판 판결문</div></div>
        <div class="court-seal" style="width:48px;height:48px;font-size:22px;">⚖️</div>
      </div>`);
  }
  const reactionBox = Array.from(container.querySelectorAll('.card')).find(el => el.textContent.includes('배심원 투표'));
  if (reactionBox && !reactionBox.classList.contains('court-jury-box')) {
    reactionBox.classList.add('court-document', 'court-jury-box');
    reactionBox.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:5px;">CITIZEN JURY VERDICT</div>`);
    reactionBox.querySelectorAll('.reaction-btn').forEach(btn => { if (btn.style.border.includes('201,168,76')) btn.dataset.picked = 'true'; });
  }
  const commentsBox = Array.from(container.querySelectorAll('.card')).find(el => el.textContent.includes('방청석 한마디'));
  if (commentsBox && !commentsBox.classList.contains('court-gallery-box')) {
    commentsBox.classList.add('court-document', 'court-gallery-box');
    commentsBox.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:5px;">PUBLIC GALLERY</div>`);
  }
  const steps = container.querySelectorAll('.step-card');
  steps.forEach((step, idx) => {
    if (step.classList.contains('court-step-decorated')) return;
    step.classList.add('court-step-decorated');
    step.style.borderLeft = '3px solid rgba(201,168,76,.55)';
    step.insertAdjacentHTML('afterbegin', `<div class="court-kicker" style="margin-bottom:6px;">STAGE ${String(idx + 1).padStart(2, '0')}</div>`);
  });
  addInviteDefense(container);
  addOwnerDelete(container, caseId);
}

export async function renderResult(container, caseId) {
  await renderBaseResult(container, caseId);
  decorateResult(container, caseId);
}
