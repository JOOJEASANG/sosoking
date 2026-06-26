import { toast } from '../components/toast.js';

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}

function tryKakaoSDKShare(url, title) {
  const K = window.Kakao;
  if (!K?.Share?.sendDefault) return false;
  if (!K.isInitialized()) return false;
  try {
    K.Share.sendDefault({
      objectType: 'feed',
      content: {
        title,
        description: '소소킹에서 확인해보세요!',
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '소소킹에서 보기', link: { mobileWebUrl: url, webUrl: url } }],
    });
    return true;
  } catch {
    return false;
  }
}

export function openShareSheet(post) {
  const url = `${location.origin}${location.pathname}#/detail/${post.id}`;
  const title = post.title || '소소킹';
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const existing = document.getElementById('share-sheet');
  if (existing) { existing.remove(); return; }

  const sheet = document.createElement('div');
  sheet.id = 'share-sheet';
  sheet.className = 'share-sheet';
  sheet.innerHTML = `
    <div class="share-sheet__backdrop"></div>
    <div class="share-sheet__panel">
      <div class="share-sheet__title">공유하기</div>
      <div class="share-sheet__grid">
        <button class="share-btn share-btn--kakao" id="btn-share-kakao">
          <span class="share-btn__icon">💬</span><span class="share-btn__label">카카오톡</span>
        </button>
        <a class="share-btn share-btn--facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener">
          <span class="share-btn__icon">📘</span><span class="share-btn__label">페이스북</span>
        </a>
        <a class="share-btn share-btn--twitter" href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener">
          <span class="share-btn__icon">🐦</span><span class="share-btn__label">X(트위터)</span>
        </a>
        <button class="share-btn share-btn--copy" id="btn-copy-link">
          <span class="share-btn__icon">🔗</span><span class="share-btn__label">링크복사</span>
        </button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  sheet.querySelector('.share-sheet__backdrop')?.addEventListener('click', () => sheet.remove());

  sheet.querySelector('#btn-share-kakao')?.addEventListener('click', async () => {
    sheet.remove();
    // Kakao SDK 초기화된 경우 SDK 공유 시도
    if (tryKakaoSDKShare(url, title)) return;
    // 모바일 Web Share API → 기기 내 카카오톡 포함 공유 시트 표시
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    // 최종 fallback: 링크 복사
    await copyToClipboard(url);
    toast.success('링크가 복사됐어요! 카카오톡에 붙여넣기 하세요 💬');
  });

  sheet.querySelector('#btn-copy-link')?.addEventListener('click', async () => {
    await copyToClipboard(url);
    toast.success('링크가 복사됐어요! 🔗');
    sheet.remove();
  });

  requestAnimationFrame(() => sheet.querySelector('.share-sheet__panel')?.classList.add('open'));
}
