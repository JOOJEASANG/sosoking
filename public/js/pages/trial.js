import { db, functions } from '../firebase.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','선처형':'🤗','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const LOADING_MSGS = [
  'AI가 사건을 검토하고 있습니다...',
  '수사관이 증거를 수집 중입니다...',
  '변호사들이 주장을 준비 중입니다...',
  '판사님이 고민 중입니다...',
  '잠시만 기다려주세요...'
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

  const unsubscribe = onSnapshot(doc(db, 'results', caseId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    if (data.sentence) {
      clearInterval(msgTimer);
      unsubscribe();
      const la = document.getElementById('loading-area');
      if (la) la.style.display = 'none';
      setTimeout(() => { location.hash = `#/result/${encodeURIComponent(caseId)}`; }, 1500);
    }
  });
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
