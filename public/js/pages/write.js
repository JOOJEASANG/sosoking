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

export function renderWrite() {
  setMeta('피드 글쓰기');
  const el = document.getElementById('page-content');
  if (!el) return;

  const { type, preset } = getQueryParams();

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

  // 실제 피드 글쓰기 화면은 multi-write.js가 렌더링합니다.
  // 여기서는 중간 선택 화면 없이 로딩 자리만 잡아 둡니다.
  el.innerHTML = `
    <div class="write-page write-direct-loading">
      <div class="skeleton" style="height:180px;border-radius:18px"></div>
      <div class="skeleton" style="height:420px;border-radius:18px;margin-top:12px"></div>
    </div>`;

  window.dispatchEvent(new CustomEvent('sosoking:render-multi-write', { detail: { preset: preset || '' } }));
}
