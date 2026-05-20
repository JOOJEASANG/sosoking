import { toast } from '../components/toast.js';

export function openShareSheet(post) {
  const url = `${location.origin}${location.pathname}#/detail/${post.id}`;
  const title = encodeURIComponent(post.title || '소소킹');
  const encodedUrl = encodeURIComponent(url);
  const existing = document.getElementById('share-sheet');
  if (existing) {
    existing.remove();
    return;
  }

  const sheet = document.createElement('div');
  sheet.id = 'share-sheet';
  sheet.className = 'share-sheet';
  sheet.innerHTML = `
    <div class="share-sheet__backdrop"></div>
    <div class="share-sheet__panel">
      <div class="share-sheet__title">공유하기</div>
      <div class="share-sheet__grid">
        <a class="share-btn share-btn--kakao" href="https://story.kakao.com/share?url=${encodedUrl}" target="_blank" rel="noopener">
          <span class="share-btn__icon">💬</span><span class="share-btn__label">카카오</span>
        </a>
        <a class="share-btn share-btn--facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener">
          <span class="share-btn__icon">📘</span><span class="share-btn__label">페이스북</span>
        </a>
        <a class="share-btn share-btn--twitter" href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${title}" target="_blank" rel="noopener">
          <span class="share-btn__icon">🐦</span><span class="share-btn__label">X(트위터)</span>
        </a>
        <button class="share-btn share-btn--copy" id="btn-copy-link">
          <span class="share-btn__icon">🔗</span><span class="share-btn__label">링크복사</span>
        </button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  sheet.querySelector('.share-sheet__backdrop')?.addEventListener('click', () => sheet.remove());
  sheet.querySelector('#btn-copy-link')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success('링크가 복사됐어요! 🔗');
    sheet.remove();
  });
  requestAnimationFrame(() => sheet.querySelector('.share-sheet__panel')?.classList.add('open'));
}
