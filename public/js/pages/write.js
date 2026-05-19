import { navigate, getQueryParams } from '../router.js';
import { setMeta } from '../utils/seo.js';

const WRITE_TEMPLATES = [
  {
    key: 'free',
    icon: '🧩',
    title: '만능 놀이글',
    desc: '글, 사진, 투표, 작명, 삼행시를 원하는 대로 조합합니다.',
    path: '/write?type=multi',
    badge: '기본',
  },
  {
    key: 'vote',
    icon: '🗳️',
    title: '투표 · 판정형',
    desc: '골라봐와 억까재판을 하나로 합친 선택/판정형 글입니다.',
    path: '/write?type=multi&preset=vote',
    badge: '통합',
  },
  {
    key: 'naming',
    icon: '😜',
    title: '미친작명소',
    desc: '사진이나 상황에 웃긴 이름을 붙이는 참여형 글입니다.',
    path: '/write?type=multi&preset=naming',
    badge: '추천',
  },
  {
    key: 'acrostic',
    icon: '✍️',
    title: '삼행시짓기',
    desc: '제시어를 등록하고 사람들이 한 줄씩 삼행시를 만듭니다.',
    path: '/write?type=multi&preset=acrostic',
    badge: '창작',
  },
];

const LEGACY_REDIRECTS = {
  vote: 'vote',
  crazy_court: 'vote',
  naming: 'naming',
  acrostic: 'acrostic',
  initial_game: 'free',
  relay: 'free',
};

export function renderWrite() {
  setMeta('글 쓰기');
  const el = document.getElementById('page-content');
  if (!el) return;

  const { type } = getQueryParams();
  if (type && type !== 'multi') {
    const preset = LEGACY_REDIRECTS[type] || 'free';
    const path = preset === 'free' ? '/write?type=multi' : `/write?type=multi&preset=${preset}`;
    navigate(path);
    return;
  }

  el.innerHTML = `
    <div class="write-page write-list-page">
      <div class="write-list-hero">
        <div class="write-list-hero__eyebrow">✍️ 글쓰기</div>
        <h1>무엇을 올릴까요?</h1>
        <p>복잡한 6개 유형은 만능 놀이글로 통합했습니다. 필요한 템플릿을 누르면 바로 작성 화면으로 이동합니다.</p>
      </div>

      <div class="write-template-list">
        ${WRITE_TEMPLATES.map(item => `
          <button class="write-template-item" type="button" data-write-path="${item.path}">
            <span class="write-template-item__icon">${item.icon}</span>
            <span class="write-template-item__body">
              <span class="write-template-item__title-row">
                <b>${item.title}</b>
                <small>${item.badge}</small>
              </span>
              <span class="write-template-item__desc">${item.desc}</span>
            </span>
            <span class="write-template-item__arrow">›</span>
          </button>
        `).join('')}
      </div>

      <div class="write-list-note">
        <b>정리 완료</b>
        <span>초성게임과 릴레이는 글쓰기 유형에서 제거했습니다. 진짜 반응이 나올 만한 투표/작명/삼행시 중심으로 운영합니다.</span>
      </div>
    </div>`;

  el.querySelectorAll('[data-write-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.writePath));
  });
}
