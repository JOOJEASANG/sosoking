import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const LOADING_MSGS = [
  '접수관이 사건번호에 괜히 품격을 부여하는 중... 📋',
  '수사관이 증거물에 라벨을 붙이며 혼자 진지해지는 중... 🔍',
  '원고 측 변호사가 책상을 살짝 두드릴 타이밍을 재는 중... 💼',
  '피고 측 변호사가 말도 안 되지만 그럴듯한 변명을 찾는 중... 🛡️',
  '판사님이 판결봉을 닦으며 인생의 무게를 재는 중... ⚖️',
  '생활형 처분 문구를 30자 안팎으로 압축하는 중... ✂️',
  '법정 방청석에서 누군가 피식 웃은 사실을 기록하는 중... 📝'
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

  const stop = () => {
    clearInterval(msgTimer);
    try { unsubscribeCase?.(); } catch {}
    try { unsubscribeResult?.(); } catch {}
    window._pageCleanup = null;
  };

  const showError = (message = '') => {
    stop();
    const la = document.getElementById('loading-area');
    if (la) la.innerHTML = `
      <div style="font-size:15px;color:var(--red);margin-top:20px;">⚠️ 판결 중 오류가 발생했습니다.</div>
      ${message ? `<div style="font-size:11px;color:var(--cream-dim);margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;word-break:break-all;">${escapeHtml(message)}</div>` : ''}
      <a href="#/submit" style="color:var(--gold);margin-top:16px;display:inline-block;font-size:14px;">다시 접수하기</a>`;
  };

  const unsubscribeCase = onSnapshot(doc(db, 'cases', caseId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status === 'error' || data.status === 'blocked') {
      showError(data.errorMessage || (data.status === 'blocked' ? '접수 제한 내용이 포함되어 있습니다.' : ''));
    }
  }, (err) => showError(err.message));

  const unsubscribeResult = onSnapshot(doc(db, 'results', caseId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderSteps(data);
    if (data.sentence) {
      stop();
      const la = document.getElementById('loading-area');
      if (la) la.style.display = 'none';
      setTimeout(() => { location.hash = `#/result/${encodeURIComponent(caseId)}`; }, 1200);
    }
  }, (err) => showError(err.message));

  window._pageCleanup = stop;

  try {
    const generateTrial = httpsCallable(functions, 'generateTrial');
    await generateTrial({ caseId });
  } catch (e) {
    console.error(e);
    showError(e?.message || '재판 호출에 실패했습니다.');
  }
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
    const judge = escapeHtml(data.judgeType);
    html += `
      <div class="step-card visible" style="margin-bottom:14px;">
        <div class="judge-reveal">
          <div class="judge-icon">${JUDGE_ICON[data.judgeType] || '⚖️'}</div>
          <div style="font-size:12px;color:var(--cream-dim);margin-bottom:4px;">이 사건의 담당 판사</div>
          <div class="judge-name">${judge} 판사</div>
        </div>
      </div>`;
  }
  if (data.verdict) {
    html += `
      <div class="card verdict-card step-card visible" style="margin-bottom:14px;padding:22px;">
        <div style="margin-bottom:10px;"><span class="badge badge-gold">최종 판결</span></div>
        <div class="verdict-stamp">판결</div>
        <div class="step-content" style="margin-top:12px;">${escapeHtml(data.verdict)}</div>
      </div>`;
  }
  if (data.sentence) {
    html += `
      <div class="card sentence-card step-card visible">
        <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">📜 생활형 처분</div>
        <div class="sentence-text">${escapeHtml(data.sentence)}</div>
      </div>`;
  }
  container.innerHTML = html;
}

function stepCard(role, label, content) {
  return `
    <div class="card step-card visible" style="margin-bottom:14px;">
      <div class="step-role">${escapeHtml(role)} · ${escapeHtml(label)}</div>
      <div class="step-content">${escapeHtml(content)}</div>
    </div>`;
}
