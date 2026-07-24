import { auth, db } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { appState } from '../state.js';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function loginWithReturn() {
  const returnTo = location.hash.slice(1).split('?')[0] || '/';
  navigate(`/login?return=${encodeURIComponent(returnTo)}`);
}

export async function toggleScrap(postId, button) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    loginWithReturn();
    return;
  }
  const ref = doc(db, 'users', auth.currentUser.uid, 'scraps', postId);
  if (button?.classList.contains('active')) {
    await deleteDoc(ref);
    button.classList.remove('active');
    toast.success('스크랩을 취소했어요.');
    return;
  }
  await setDoc(ref, { postId, scrappedAt: serverTimestamp() });
  button?.classList.add('active');
  toast.success('스크랩했어요.');
}

const REPORT_REASONS = [
  { key: 'spam', label: '스팸/도배' },
  { key: 'abuse', label: '욕설/비하/혐오' },
  { key: 'false', label: '허위정보/낚시' },
  { key: 'adult', label: '음란물' },
  { key: 'other', label: '기타' },
];

function showReportModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;box-sizing:border-box';
    overlay.innerHTML = `
      <div style="background:var(--color-surface);border-radius:16px;width:100%;max-width:340px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25)">
        <div style="padding:20px 20px 0">
          <div style="font-size:16px;font-weight:900;margin-bottom:14px">신고 사유 선택</div>
          <div style="display:flex;flex-direction:column;gap:7px">
            ${REPORT_REASONS.map(item => `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--color-border);border-radius:10px;cursor:pointer;font-size:14px;font-weight:700"><input type="radio" name="sosoking-report" value="${item.key}"><span>${item.label}</span></label>`).join('')}
          </div>
          <textarea data-report-extra style="display:none;width:100%;box-sizing:border-box;margin-top:10px;padding:10px;border:1.5px solid var(--color-border);border-radius:10px;background:var(--color-surface-2);font-size:13px;font-family:inherit;resize:vertical;min-height:64px" maxlength="200" placeholder="추가 설명"></textarea>
        </div>
        <div style="display:flex;gap:8px;padding:16px 20px;border-top:1px solid var(--color-border-light);margin-top:16px">
          <button type="button" class="btn btn--ghost" data-report-cancel>취소</button>
          <button type="button" class="btn btn--primary" data-report-submit>신고하기</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = value => { overlay.remove(); resolve(value); };
    overlay.querySelectorAll('[name="sosoking-report"]').forEach(radio => radio.addEventListener('change', () => {
      overlay.querySelector('[data-report-extra]').style.display = radio.value === 'other' ? '' : 'none';
    }));
    overlay.querySelector('[data-report-cancel]')?.addEventListener('click', () => close(null));
    overlay.addEventListener('click', event => { if (event.target === overlay) close(null); });
    overlay.querySelector('[data-report-submit]')?.addEventListener('click', () => {
      const selected = overlay.querySelector('[name="sosoking-report"]:checked');
      if (!selected) return;
      const labels = { spam: '스팸/도배', abuse: '욕설/비하/혐오', false: '허위정보/낚시', adult: '음란물', other: '기타' };
      const extra = overlay.querySelector('[data-report-extra]')?.value.trim() || '';
      close(`${labels[selected.value]}${extra ? ` — ${extra}` : ''}`);
    });
  });
}

export async function reportPost(postId, button) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    loginWithReturn();
    toast.warn('회원 로그인 후 신고할 수 있어요.');
    return;
  }
  const reason = await showReportModal();
  if (!reason) return;
  const reportId = `${postId}_${user.uid}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 900);
  try {
    await setDoc(doc(db, 'reports', reportId), {
      postId,
      postTitle: '',
      reason,
      reporterId: user.uid,
      reporterName: appState.nickname || user.displayName || '회원',
      resolved: false,
      createdAt: serverTimestamp(),
    });
    toast.success('신고가 접수됐어요.');
    if (button) {
      button.textContent = '신고됨';
      button.disabled = true;
    }
  } catch (error) {
    if (String(error.code || '').includes('permission-denied')) toast.warn('이미 신고했거나 신고할 수 없는 글입니다.');
    else throw error;
  }
}
