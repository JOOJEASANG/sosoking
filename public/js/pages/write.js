import { navigate, getQueryParams } from '../router.js';
import { setMeta } from '../utils/seo.js';

const LEGACY_REDIRECTS = {
  vote: 'vote',
  crazy_court: 'vote',
  naming: 'naming',
  acrostic: 'acrostic',
  quiz: 'quiz',
  initial_game: 'quiz',
  relay: '',
};

function escAttr(value) {
  return String(value || '').replace(/[&<>"]/g, '');
}

function showWriteError(error) {
  const el = document.getElementById('page-content');
  if (!el) return;
  const message = String(error?.message || error || '글쓰기 화면을 불러오지 못했어요');
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">글쓰기 화면 오류</div>
      <div class="empty-state__desc">${message.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))}</div>
      <button class="btn btn--primary" style="margin-top:14px" onclick="location.hash='#/write?type=multi'">다시 열기</button>
    </div>`;
}

export function renderWrite() {
  setMeta('피드 글쓰기');
  const el = document.getElementById('page-content');
  if (!el) return;

  const { type, preset, edit, postId, id } = getQueryParams();
  const editId = edit || postId || id || '';

  if (editId) {
    el.innerHTML = `
      <div class="write-page write-edit-loading" data-edit-post-id="${escAttr(editId)}">
        <div class="loading-center"><div class="spinner spinner--lg"></div></div>
      </div>`;
    window.dispatchEvent(new CustomEvent('sosoking:render-write-edit', { detail: { postId: editId } }));
    return;
  }

  if (!type) {
    navigate('/write?type=multi');
    return;
  }

  if (type && type !== 'multi') {
    const mappedPreset = LEGACY_REDIRECTS[type] || '';
    const path = mappedPreset ? `/write?type=multi&preset=${mappedPreset}` : '/write?type=multi';
    navigate(path);
    return;
  }

  el.innerHTML = `
    <div class="write-page write-direct-loading">
      <div class="skeleton" style="height:180px;border-radius:18px"></div>
      <div class="skeleton" style="height:420px;border-radius:18px;margin-top:12px"></div>
    </div>`;

  import('../multi-write.js')
    .then(module => module.renderMultiWrite())
    .catch(error => {
      console.error('[renderWrite] multi-write import failed', error);
      showWriteError(error);
    });

  window.dispatchEvent(new CustomEvent('sosoking:render-multi-write', { detail: { preset: preset || '' } }));
}