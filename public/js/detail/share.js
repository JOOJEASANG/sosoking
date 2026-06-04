import { toast } from '../components/toast.js';
import { generateShareCardBlob } from './share-card.js';

const AI_TYPES = ['ai_judge', 'ai_translate', 'ai_match', 'ai_naming', 'ai_consult'];

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

const AI_SHARE_TEXTS = {
  ai_judge:     (p, url) => `⚖️ 판결소 판결\n"${(p.situation || p.title || '').slice(0, 60)}"\n\n소소킹에서 판결받기 👉 ${url}`,
  ai_translate: (p, url) => `✨ ${p.styleName || ''} 번역\n"${(p.originalText || '').slice(0, 60)}"\n→ "${(p.translated || '').slice(0, 60)}"\n\n소소킹에서 번역하기 👉 ${url}`,
  ai_match:     (p, url) => `💘 궁합소 ${p.matchResult?.score || 0}%\n${p.itemA} 💘 ${p.itemB}\n${p.matchResult?.grade || ''}\n\n소소킹에서 궁합보기 👉 ${url}`,
  ai_naming:    (p, url) => `✨ 창작소 작명\n${(p.names || []).slice(0, 3).map(n => `"${n.name}"`).join(', ')}\n\n소소킹에서 이름짓기 👉 ${url}`,
  ai_consult:   (p, url) => `💬 상담소 조언\n"${(p.concern || p.title || '').slice(0, 60)}"\n\n소소킹에서 상담받기 👉 ${url}`,
};

// 카드 이미지가 필요한 버튼에 로딩 스피너 표시
function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.origHtml = btn.dataset.origHtml || btn.innerHTML;
  btn.innerHTML = loading
    ? `<span class="share-btn__icon" style="animation:spin .8s linear infinite;display:inline-block">⏳</span><span class="share-btn__label">준비 중...</span>`
    : btn.dataset.origHtml;
}

export function openShareSheet(post) {
  const url = `${location.origin}${location.pathname}#/detail/${post.id}`;
  const title = post.title || '소소킹';
  const encodedUrl = encodeURIComponent(url);
  const aiText = AI_SHARE_TEXTS[post.type]?.(post, url) || title;
  const isAiPost = AI_TYPES.includes(post.type);

  const existing = document.getElementById('share-sheet');
  if (existing) { existing.remove(); return; }

  const sheet = document.createElement('div');
  sheet.id = 'share-sheet';
  sheet.className = 'share-sheet';
  sheet.innerHTML = `
    <div class="share-sheet__backdrop"></div>
    <div class="share-sheet__panel">
      <div class="share-sheet__title">📤 공유하기</div>
      <div class="share-sheet__grid">
        <button class="share-btn share-btn--kakao" data-action="kakao">
          <span class="share-btn__icon">💬</span><span class="share-btn__label">카카오톡</span>
        </button>
        <button class="share-btn share-btn--instagram" data-action="instagram">
          <span class="share-btn__icon" style="font-size:20px;line-height:1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
          </span>
          <span class="share-btn__label">인스타그램</span>
        </button>
        <a class="share-btn share-btn--twitter"
           href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(aiText)}"
           target="_blank" rel="noopener noreferrer">
          <span class="share-btn__icon">🐦</span><span class="share-btn__label">X(트위터)</span>
        </a>
        <a class="share-btn share-btn--facebook"
           href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}"
           target="_blank" rel="noopener noreferrer">
          <span class="share-btn__icon">📘</span><span class="share-btn__label">페이스북</span>
        </a>
        ${isAiPost ? `
        <button class="share-btn share-btn--image" data-action="image">
          <span class="share-btn__icon">💾</span><span class="share-btn__label">이미지 저장</span>
        </button>` : ''}
        <button class="share-btn share-btn--copy" data-action="copy">
          <span class="share-btn__icon">🔗</span><span class="share-btn__label">링크 복사</span>
        </button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.querySelector('.share-sheet__panel')?.classList.add('open'));
  sheet.querySelector('.share-sheet__backdrop')?.addEventListener('click', () => sheet.remove());
  sheet.querySelectorAll('a.share-btn').forEach(a => a.addEventListener('click', () => setTimeout(() => sheet.remove(), 300)));

  // ── 카카오톡 ──
  sheet.querySelector('[data-action="kakao"]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    // 1) Kakao SDK
    if (tryKakaoSDKShare(url, title)) { sheet.remove(); return; }

    // 2) 카드 이미지 + Web Share API (모바일에서 카카오톡 공유 시트 포함)
    if (isAiPost && navigator.share) {
      sheet.remove();
      setLoading(null, false);
      const data = await generateShareCardBlob(post);
      if (data) {
        try {
          const file = new File([data.blob], 'sosoking.png', { type: 'image/png' });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title, url });
            return;
          }
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      // 이미지 없이 링크만 공유 시도
      try { await navigator.share({ title, url }); return; } catch {}
    } else if (navigator.share) {
      sheet.remove();
      try { await navigator.share({ title, url }); return; } catch (err) {
        if (err.name === 'AbortError') return;
      }
    } else {
      sheet.remove();
    }

    await copyToClipboard(url);
    toast.success('링크 복사 완료! 카카오톡에 붙여넣기 하세요 💬');
  });

  // ── 인스타그램 ──
  sheet.querySelector('[data-action="instagram"]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    sheet.remove();

    if (!isAiPost) {
      await copyToClipboard(url);
      toast.success('링크를 복사했어요! 인스타그램 스토리에 붙여넣어 보세요 📸');
      return;
    }

    toast.info?.('카드 만드는 중... ✏️');
    const data = await generateShareCardBlob(post);
    if (!data) { toast.error('카드 만들기에 실패했어요'); return; }

    // 모바일: Web Share API → 인스타그램 공유 시트 포함
    if (navigator.canShare) {
      try {
        const file = new File([data.blob], 'sosoking.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '소소킹 AI 결과' });
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // PC 폴백: 이미지 다운로드 안내
    const a = document.createElement('a');
    a.href = data.dataUrl;
    a.download = 'sosoking-result.png';
    a.click();
    toast.success('이미지 저장 완료! 인스타그램에 직접 업로드 해주세요 📸');
  });

  // ── 이미지 저장 ──
  sheet.querySelector('[data-action="image"]')?.addEventListener('click', async () => {
    sheet.remove();
    toast.info?.('카드 만드는 중... ✏️');
    const data = await generateShareCardBlob(post);
    if (!data) { toast.warn('이 게시글은 카드를 지원하지 않아요'); return; }
    const a = document.createElement('a');
    a.href = data.dataUrl;
    a.download = 'sosoking-result.png';
    a.click();
    toast.success('카드가 저장됐어요! 📸');
  });

  // ── 링크 복사 ──
  sheet.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
    await copyToClipboard(url);
    toast.success('링크가 복사됐어요! 🔗');
    sheet.remove();
  });
}
