import { auth, db } from '../firebase.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { appState } from '../state.js';
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function loginWithReturn() {
  const returnTo = window.location.hash.slice(1).split('?')[0] || '/';
  navigate('/login?return=' + encodeURIComponent(returnTo));
}

export async function toggleScrap(postId, btn) {
  if (!auth.currentUser) {
    loginWithReturn();
    return;
  }
  const uid = auth.currentUser.uid;
  const postSnap = await getDoc(doc(db, 'feeds', postId)).catch(() => null);
  const post = postSnap?.exists?.() ? postSnap.data() : {};
  const scrapRef = doc(db, 'users', uid, 'scraps', postId);

  if (btn?.classList.contains('active')) {
    await deleteDoc(scrapRef).catch(() => {});
    btn.classList.remove('active');
    toast.success('스크랩을 취소했어요');
    return;
  }

  await setDoc(scrapRef, {
    postId,
    title: post.title || '',
    type: post.type || '',
    cat: post.cat || '',
    authorName: post.authorName || '',
    scrappedAt: serverTimestamp(),
  }).catch(() => {});
  btn?.classList.add('active');
  toast.success('스크랩했어요! 🔖');
}

const REPORT_REASONS = [
  { key: 'spam',  label: '스팸/도배' },
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
          <div style="display:flex;flex-direction:column;gap:7px" id="report-reason-list">
            ${REPORT_REASONS.map(r => `
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--color-border);border-radius:10px;cursor:pointer;font-size:14px;font-weight:700;transition:border-color .15s,background .15s" data-report-label>
                <input type="radio" name="sosoking-report" value="${r.key}" style="width:16px;height:16px;accent-color:var(--color-primary);flex-shrink:0">
                <span>${r.label}</span>
              </label>`).join('')}
          </div>
          <textarea id="report-extra-text" style="display:none;width:100%;box-sizing:border-box;margin-top:10px;padding:10px;border:1.5px solid var(--color-border);border-radius:10px;background:var(--color-surface-2);font-size:13px;font-family:inherit;resize:vertical;min-height:64px;outline:none" maxlength="200" placeholder="추가 설명 (선택)"></textarea>
        </div>
        <div style="display:flex;gap:8px;padding:16px 20px;border-top:1px solid var(--color-border-light);margin-top:16px">
          <button style="flex:1;padding:10px;border:1.5px solid var(--color-border);border-radius:10px;background:transparent;font-size:14px;font-weight:800;cursor:pointer;color:var(--color-text-secondary)" id="report-modal-cancel">취소</button>
          <button style="flex:1;padding:10px;border:none;border-radius:10px;background:#e53935;color:#fff;font-size:14px;font-weight:800;cursor:pointer" id="report-modal-submit">신고하기</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelectorAll('[name="sosoking-report"]').forEach(radio => {
      radio.addEventListener('change', () => {
        overlay.querySelectorAll('[data-report-label]').forEach(l => {
          l.style.borderColor = '';
          l.style.background = '';
        });
        radio.closest('[data-report-label]').style.borderColor = 'var(--color-primary)';
        radio.closest('[data-report-label]').style.background = 'var(--color-primary-subtle, rgba(255,107,74,.08))';
        overlay.querySelector('#report-extra-text').style.display = radio.value === 'other' ? '' : 'none';
      });
    });

    const close = (val) => { overlay.remove(); resolve(val); };

    overlay.querySelector('#report-modal-cancel').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(null); document.removeEventListener('keydown', onEsc); }
    });

    overlay.querySelector('#report-modal-submit').addEventListener('click', () => {
      const selected = overlay.querySelector('[name="sosoking-report"]:checked');
      if (!selected) {
        overlay.querySelectorAll('[data-report-label]').forEach(l => {
          l.style.borderColor = '#e53935';
          setTimeout(() => { l.style.borderColor = ''; }, 800);
        });
        return;
      }
      const labels = { spam:'스팸/도배', abuse:'욕설/비하/혐오', false:'허위정보/낚시', adult:'음란물', other:'기타' };
      const extra = overlay.querySelector('#report-extra-text')?.value.trim() || '';
      close(labels[selected.value] + (extra ? ' — ' + extra : ''));
    });
  });
}

export async function reportPost(postId, btn) {
  if (!auth.currentUser) {
    loginWithReturn();
    return;
  }

  const reason = await showReportModal();
  if (!reason) return;

  const postSnap = await getDoc(doc(db, 'feeds', postId)).catch(() => null);
  const post = postSnap?.exists?.() ? postSnap.data() : {};

  await addDoc(collection(db, 'reports'), {
    postId,
    postTitle: post.title || '',
    reason,
    reporterId: auth.currentUser.uid,
    reporterName: appState.nickname || auth.currentUser.displayName || '익명',
    resolved: false,
    createdAt: serverTimestamp(),
  });

  toast.success('신고가 접수됐어요. 검토 후 처리할게요.');
  if (btn) {
    btn.textContent = '신고됨';
    btn.disabled = true;
  }
}
