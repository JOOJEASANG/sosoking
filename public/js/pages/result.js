import { db, auth } from '../firebase.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { showToast } from '../components/toast.js';

function _fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
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

  if (!resultSnap.exists()) {
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 찾을 수 없습니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
    return;
  }

  const c = caseSnap.exists() ? caseSnap.data() : {};
  const r = resultSnap.data();
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const isOwner = caseSnap.exists() && c.userId === auth.currentUser?.uid;
  const isPublic = c.isPublic || false;

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
          <div style="font-size:56px;margin-bottom:8px;">${icon}</div>
          <div class="badge badge-gold" style="font-size:13px;padding:5px 14px;">${r.judgeType} 판사</div>
          <h2 style="margin-top:14px;font-size:20px;">${c.caseTitle || '판결 결과'}</h2>
          <div style="font-size:13px;color:var(--cream-dim);margin-top:4px;">억울지수 ${c.grievanceIndex || '?'}/10${c.createdAt ? ` · ${_fmtDate(c.createdAt)}` : ''}</div>
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
        <div style="text-align:center;margin-bottom:16px;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:11px;color:var(--cream-dim);line-height:1.7;">
          🤖 본 판결문은 <strong style="color:var(--cream);">AI가 생성한 오락 콘텐츠</strong>입니다.<br>
          실제 법적 효력이 없으며, 법률 자문으로 활용할 수 없습니다.
        </div>
        <div class="result-actions">
          ${isOwner ? `<button class="btn ${isPublic ? 'btn-ghost' : 'btn-primary'}" id="btn-share">
            ${isPublic ? '🔒 판결문 비공개로 전환' : '🔗 링크 공유하기'}
          </button>` : ''}
          <button class="btn btn-secondary" id="btn-retry">🎲 다른 판사에게 재판받기</button>
          <a href="#/" class="btn btn-ghost">처음으로 돌아가기</a>
        </div>
      </div>
    </div>`;

  if (isOwner) {
    document.getElementById('btn-share').addEventListener('click', async () => {
      const newPublic = !isPublic;
      try {
        await updateDoc(doc(db, 'cases', caseId), { isPublic: newPublic });
        await updateDoc(doc(db, 'results', caseId), {
          isPublic: newPublic, caseTitle: c.caseTitle,
          grievanceIndex: c.grievanceIndex, judgeType: r.judgeType,
          sentence: r.sentence, createdAt: r.createdAt || new Date()
        });
        if (newPublic) {
          const url = `${location.origin}/#/result/${encodeURIComponent(caseId)}`;
          const shareData = {
            title: `${c.caseTitle || '판결 결과'} - 소소킹 판결소`,
            text: `⚖️ ${r.judgeType} 판사의 판결: ${r.sentence}`,
            url,
          };
          let handled = false;
          if (navigator.share) {
            try {
              await navigator.share(shareData);
              handled = true;
            } catch (e) {
              if (e.name === 'AbortError') handled = true;
            }
          }
          if (!handled) {
            await navigator.clipboard.writeText(url).catch(() => {});
            showToast('링크가 복사되었습니다 🔗', 'success');
          }
        } else {
          showToast('비공개로 전환되었습니다.', 'success');
        }
        renderResult(container, caseId);
      } catch {
        showToast('처리 중 오류가 발생했습니다.', 'error');
      }
    });
  }

  document.getElementById('btn-retry').addEventListener('click', () => {
    location.hash = '#/submit';
    showToast('사건을 다시 접수하면 다른 판사가 배정됩니다.', 'success');
  });

}
