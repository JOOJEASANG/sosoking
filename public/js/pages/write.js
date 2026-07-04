import { navigate, getQueryParams } from '../router.js';
import { setMeta } from '../utils/seo.js';

const DEFAULT_PRESET = 'drip';
const ALLOWED_PRESETS = new Set(['vote', 'drip']);

const LEGACY_REDIRECTS = {
  collect: 'drip',
  general: 'drip',
  category: 'drip',
  anonymous: 'drip',
  judgment: 'vote',
  verdict: 'vote',
  court: 'vote',
  vote: 'vote',
  ox: 'vote',
  crazy_court: 'vote',
  debate: 'vote',
  discussion: 'vote',
  balance: 'vote',
  battle: 'vote',
  consult: 'drip',
  quiz: 'drip',
  initial_game: 'drip',
  drip: 'drip',
  cbattle: 'drip',
  naming: 'drip',
  translation: 'drip',
  translate: 'drip',
  relay: 'drip',
  acrostic: 'drip',
  tournament: 'drip',
};

function escAttr(value) {
  return String(value || '').replace(/[&<>"]/g, '');
}

function normalizePreset(value) {
  const key = String(value || '').trim();
  return ALLOWED_PRESETS.has(key) ? key : (LEGACY_REDIRECTS[key] || DEFAULT_PRESET);
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
      <button class="btn btn--primary" style="margin-top:14px" onclick="location.hash='#/write?type=multi&preset=drip'">다시 열기</button>
    </div>`;
}

export function renderWrite() {
  setMeta('소소킹 글쓰기');
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
    navigate(`/write?type=multi&preset=${DEFAULT_PRESET}`);
    return;
  }

  if (type && type !== 'multi') {
    const mappedPreset = normalizePreset(type);
    navigate(`/write?type=multi&preset=${mappedPreset}`);
    return;
  }

  const normalizedPreset = normalizePreset(preset);
  if (preset !== normalizedPreset) {
    navigate(`/write?type=multi&preset=${normalizedPreset}`);
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

  window.dispatchEvent(new CustomEvent('sosoking:render-multi-write', { detail: { preset: normalizedPreset } }));
}
