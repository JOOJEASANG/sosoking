import { db, functions } from '../firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const LOADING_MSGS = [
  '판사님이 서류 어디 뒀는지 찾는 중... 🔍',
  '수사관이 현장 라면 국물 감식 중입니다... 🍜',
  '원고 측 변호사가 격분하며 서류 정리 중... 💼',
  '피고 측 변호사가 변명 준비 중입니다... 🛡️',
  '판사님이 점심 召 드시고 오는 중... 🍱',
  '법원 도장 찾는 중... 어디 뒀더라... 📋',
  '잠시만요, 판사님 커피 뽑으러 가셨습니다... ☕',
  '억울함의 무게를 측정 중입니다... ⚖️'
];

export async function renderTrial(container, caseId) {
  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">⚖️ 재판 진행 중</span></div>
      <div class="container" style="padding-top:24px;padding-bottom:60px;">
        <div class="trial-progress" id="trial-progress">
          ${Array(7).fill(0).map(() => '<div class="progress-step"></div>').join('')}
        </div>
        <div id="steps-container"></div>
        <div id="loading-area" style="text-align:center;padding:40px 0;">
          <div class="loading-dots"><span></span><span></span><span></span></div>
          <div id="loading-text" style="font-size:13px;color:var(--cream-dim);margin-top:10px;">${LOADING_MSGS[0]}</div>
        </div>
      </div>
    </div>
  `;

  let msgIdx = 0;
  const msgTimer = setInterval(() => {
    msgIdx = (msgIdx + 1) % LOADING_MSGS.length;
    const el = document.getElementById('loading-text');
    if (el) el.textContent = LOADING_MSGS[msgIdx];
  }, 3000);

  try {
    const generateTrial = httpsCallable(functions, 'generateTrial');
    generateTrial({ caseId });
  } catch (e) { console.error(e); }

  const unsubscribeCase = onSnapshot(doc(db, 'cases', caseId), (snap) => {
    if (!snap.exists()) return;
    if (snap.data().status === 'error') {
      clearInterval(msgTimer);
      unsubscribeCase();
      unsubscribeResult();
      window._pageCleanup = null;
      const errMsg = snap.data().errorMessage || '';
      const la = document.getElementById('loading-area');
      if (la) la.innerHTML = `
        <div style="font-size:15px;color:var(--red);margin-top:20px;">⚠️ 판결 중 오류가 발생했습니다.</div>
        ${errMsg ? `<div style="font-size:11px;color:var(--cream-dim);margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;word-break:break-all;">${errMsg}</div>` : ''}
        <a href="#/submit" style="color:var(--gold);margin-top:16px;display:inline-block;font-size:14px;">다시 접수하기</a>`;
    }
  });

  const unsubscribeResult = onSnapshot(doc(db, 'results', caseId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    if (data.sentence) {
      clearInterval(msgTimer);
      unsubscribeResult();
      unsubscribeCase();
      window._pageCleanup = null;
      const la = document.getElementById('loading-area');
      if (la) la.style.display = 'none';
      setTimeout(() => { location.hash = `#/result/${encodeURIComponent(caseId)}`; }, 1500);
    }
  });

  window._pageCleanup = () => {
    clearInterval(msgTimer);
    unsubscribeCase();
    unsubscribeResult();
  };
}

function renderSteps(data) {
  const container = document.getElementById('steps-container');
  const progress = document.getElementById('trial-progress');
  if (!container || !progress) return;

  const done = [data.reception, data.investigation, data.plaintiffArg, data.defendantArg, data.judgeType, data.verdict, data.sentence].filter(Boolean).length;
  progress.querySelectorAll('.progress-step').forEach((s, i) => { if (i < done) s.classList.add('done'); });

  let html = '';
  if (data.reception) html += stepCard('📋 접수관', '사건 접수', data.reception);
  if (data.investigation) html += stepCard('🔍 수사관', '수사 기록', data.investigation);
  if (data.plaintiffArg) html += stepCard('💼 원고 측 변호사', '원고 측 주장', data.plaintiffArg);
  if (data.defendantArg) html += stepCard('🛡️ 피고 측 변호사', '피고 측 주장', data.defendantArg);

  if (data.judgeType) {
    html += `
      <div class="step-card visible" style="margin-bottom:14px;">
        <div class="judge-reveal">
          <div class="judge-icon">${JUDGE_ICON[data.judgeType] || '⚖️'}</div>
          <div style="font-size:12px;color:var(--cream-dim);margin-bottom:4px;">이 사건의 담당 판사</div>
          <div class="judge-name">${data.judgeType} 판사</div>
        </div>
      </div>`;
  }
  if (data.verdict) {
    html += `
      <div class="card verdict-card step-card visible" style="margin-bottom:14px;padding:22px;">
        <div style="margin-bottom:10px;"><span class="badge badge-gold">최종 판결</span></div>
        <div class="verdict-stamp">판결</div>
        <div class="step-content" style="margin-top:12px;">${data.verdict}</div>
      </div>`;
  }
  if (data.sentence) {
    html += `
      <div class="card sentence-card step-card visible">
        <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">📜 생활형 처분</div>
        <div class="sentence-text">${data.sentence}</div>
      </div>`;
  }
  container.innerHTML = html;
}

function stepCard(role, label, content) {
  return `
    <div class="card step-card visible" style="margin-bottom:14px;">
      <div class="step-role">${role} · ${label}</div>
      <div class="step-content">${content}</div>
    </div>`;
}
