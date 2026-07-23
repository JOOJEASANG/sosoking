export function openGallery(images, startIdx = 0) {
  let cur = startIdx;
  const overlay = document.createElement('div');
  overlay.className = 'gallery-overlay';

  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };

  const render = () => {
    overlay.innerHTML = `
      <button class="gallery-close" aria-label="닫기">✕</button>
      <button class="gallery-nav gallery-nav--prev" ${cur === 0 ? 'style="visibility:hidden"' : ''}>‹</button>
      <div class="gallery-img-wrap"><img class="gallery-img" src="${images[cur]}" alt=""></div>
      <button class="gallery-nav gallery-nav--next" ${cur === images.length - 1 ? 'style="visibility:hidden"' : ''}>›</button>
      ${images.length > 1 ? `<div class="gallery-counter">${cur + 1} / ${images.length}</div>` : ''}`;

    overlay.querySelector('.gallery-close').onclick = close;
    const prev = overlay.querySelector('.gallery-nav--prev');
    const next = overlay.querySelector('.gallery-nav--next');
    if (prev) prev.onclick = event => {
      event.stopPropagation();
      if (cur > 0) {
        cur -= 1;
        render();
      }
    };
    if (next) next.onclick = event => {
      event.stopPropagation();
      if (cur < images.length - 1) {
        cur += 1;
        render();
      }
    };
  };

  const onKey = event => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft' && cur > 0) {
      cur -= 1;
      render();
    }
    if (event.key === 'ArrowRight' && cur < images.length - 1) {
      cur += 1;
      render();
    }
  };

  render();
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

export function bindGalleryClicks(root = document) {
  root.querySelectorAll('.detail-gallery__thumb').forEach(thumb => {
    btnBind(thumb, () => {
      const grid = thumb.closest('[data-images]');
      if (!grid) return;
      const images = JSON.parse(decodeURIComponent(grid.dataset.images));
      const idx = parseInt(thumb.dataset.galleryIdx, 10) || 0;
      openGallery(images, idx);
    });
  });
}

function btnBind(el, handler) {
  if (!el || el.dataset.galleryReady === '1') return;
  el.dataset.galleryReady = '1';
  el.addEventListener('click', handler);
}
