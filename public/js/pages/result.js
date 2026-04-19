import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { showToast } from '../components/toast.js';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','선처형':'🤗','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

export async function renderResult(container, caseId) {
  container.innerHTML = `
    <div class="page-header"><span class="logo">⚖️ 판결 결과</span></div>
    <div class="container" style="padding:28px 20px 80px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  const [caseSnap, resultSnap] = await Promise.all([
    getDoc(doc(db, 'cases', caseId)),
    getDoc(doc(db, 'results', caseId))
  ]);

  if (!caseSnap.exists() || !resultSnap.exists()) {
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 찾을 수 없습니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
    return;
  }

  const c = caseSnap.data();
  const r = resultSnap.data();
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';

  const steps = [
    ['📋 접수관','사건 접수', r.reception],
    ['🔍 수사관','수사 기록', r.investigation],
    ['💼 원고 측','원고 측 주장', r.plaintiffArg],
    ['🛡️ 피고 측','피고 측 주장', r.defendantArg],
  ];

  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">⚖️ 판결 결과</span></div>
      <div class="container" style="padding-top:28px;padding-bottom:80px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:48px;margin-bottom:8px;">${icon}</div>
          <div class="badge badge-gold" style="font-size:13px;padding:5px 14px;">${r.judgeType} 판사</div>
          <h2 style="margin-top:14px;font-size:20px;">${c.caseTitle}</h2>
          <div style="font-size:13px;color:var(--cream-dim);margin-top:4px;">억울지수 ${c.grievanceIndex}/10 · ${c.nickname || '익명'}</div>
        </div>
        ${steps.map(([role,label,content]) => `
          <div class="card step-card visible" style="margin-bottom:12px;">
            <div class="step-role">${role} · ${label}</div>
            <div class="step-content">${content || ''}</div>
          </div>`).join('')}
        <div class="card verdict-card step-card visible" style="margin-bottom:12px;padding:22px;">
          <div style="margin-bottom:10px;"><span class="badge badge-gold">최종 판결문</span></div>
          <div class="verdict-stamp">판결</div>
          <div class="step-content" style="margin-top:12px;">${r.verdict}</div>
        </div>
        <div class="card sentence-card step-card visible" style="margin-bottom:28px;">
          <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">📜 생활형 처분</div>
          <div class="sentence-text">${r.sentence}</div>
        </div>
        <div class="result-actions">
          <button class="btn btn-primary" id="btn-retry">🎲 다른 판사에게 다시 재판받기</button>
          <button class="btn btn-secondary" id="btn-copy">📋 결과 복사하기</button>
          <a href="#/" class="btn btn-ghost">처음으로</a>
        </div>
      </div>
    </div>`;

  document.getElementById('btn-retry').addEventListener('click', () => {
    location.hash = '#/submit';
    showToast('사건을 다시 접수하면 다른 판사가 배정됩니다.', 'success');
  });

  document.getElementById('btn-copy').addEventListener('click', async () => {
    const text = `⚖️ 소소킹 판결소\n\n사건명: ${c.caseTitle}\n담당: ${r.judgeType} 판사 ${icon}\n\n${r.verdict}\n\n📜 처분: ${r.sentence}\n\nsosoking.co.kr`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('판결문이 복사되었습니다!', 'success');
    } catch {
      showToast('복사에 실패했습니다.', 'error');
    }
  });
}
