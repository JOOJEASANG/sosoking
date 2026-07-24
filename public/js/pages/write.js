import { navigate, getQueryParams } from '../router.js';
import { setMeta } from '../utils/seo.js';

const PRESETS = new Set(['judgment', 'consult', 'vote', 'drip']);

function escAttr(value) {
  return String(value || '').replace(/[&<>"]/g, '');
}

function showError(error) {
  const root = document.getElementById('page-content');
  if (!root) return;
  const message = String(error?.message || error || '글쓰기 화면을 불러오지 못했습니다.');
  root.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">글쓰기 화면 오류</div>
      <div class="empty-state__desc">${message.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]))}</div>
      <button type="button" class="btn btn--primary" data-write-retry>다시 열기</button>
    </div>`;
  root.querySelector('[data-write-retry]')?.addEventListener('click', () => navigate('/write?type=multi&preset=judgment'));
}

export function renderWrite() {
  setMeta('소소킹 커뮤니티 글쓰기');
  const root = document.getElementById('page-content');
  if (!root) return;
  const { type, preset, edit, postId, id } = getQueryParams();
  const editId = edit || postId || id || '';

  if (editId) {
    root.innerHTML = `<div class="write-page write-edit-loading" data-edit-post-id="${escAttr(editId)}"><div class="loading-center"><div class="spinner spinner--lg"></div></div></div>`;
    window.dispatchEvent(new CustomEvent('sosoking:render-write-edit', { detail: { postId: editId } }));
    return;
  }

  if (type !== 'multi') {
    navigate('/write?type=multi&preset=judgment');
    return;
  }

  const selected = PRESETS.has(preset) ? preset : 'judgment';
  if (preset !== selected) {
    navigate(`/write?type=multi&preset=${selected}`);
    return;
  }

  root.innerHTML = '<div class="write-page write-direct-loading"><div class="skeleton" style="height:180px;border-radius:18px"></div><div class="skeleton" style="height:420px;border-radius:18px;margin-top:12px"></div></div>';
  import('../multi-write.js').then(module => module.renderMultiWrite()).catch(showError);
}
