import { auth, db, storage } from '../firebase.js?v=20260708-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { ref, getBytes } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

export async function addOwnerStorageImage(container, caseId) {
  try {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return;
    if (container.querySelector('#owner-storage-image')) return;

    const caseSnap = await getDoc(doc(db, 'cases', caseId));
    if (!caseSnap.exists()) return;
    const c = caseSnap.data() || {};
    if (c.userId !== auth.currentUser.uid) return;

    const caseImage = c.imageAttachment || {};
    const meta = c.imageAttachmentMeta || caseImage || {};
    const path = c.imageStoragePath || meta.storagePath || caseImage.storagePath || '';
    if (!path) return;

    const bytes = await getBytes(ref(storage, path), 700 * 1024);
    const mimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(meta.mimeType) ? meta.mimeType : 'image/jpeg';
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const details = [
      meta.width && meta.height ? `${Number(meta.width)}×${Number(meta.height)}` : '',
      meta.originalSize ? `원본 ${formatBytes(meta.originalSize)}` : '',
      meta.resizedSize ? `저장 ${formatBytes(meta.resizedSize)}` : ''
    ].filter(Boolean).join(' · ');

    const html = `
      <section id="owner-storage-image" class="case-section image-section">
        <div class="section-head"><span>첨부 이미지 참고자료</span><em>작성자 전용</em></div>
        <img src="${url}" alt="첨부 이미지" style="width:100%;max-height:360px;object-fit:contain;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.16);">
        <p style="font-size:11px;color:var(--cream-dim);margin:8px 0 0;">${escapeHtml(details || '첨부 이미지')}</p>
      </section>`;

    const anchor = container.querySelector('.point-grid') || container.querySelector('.case-info-card');
    if (anchor) anchor.insertAdjacentHTML('afterend', html);
  } catch (err) {
    console.warn('owner storage image skipped:', err.message || err);
  }
}
