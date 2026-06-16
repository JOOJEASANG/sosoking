import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const STEPS = [
  ['1', '오늘게임', '매일 하나의 역사정치 사건을 보고, 가상 정당 중 어느 해석을 지지할지 선택합니다.', '/battle'],
  ['2', '정당 활동', '마음에 드는 정당에 입당하고 하루 유세로 정치력을 쌓습니다.', '/republic'],
  ['3', '대통령 선거', '정당 후보를 확인하고 주간 대통령 선거에 투표합니다.', '/election'],
  ['4', '역사자료', '오늘 사건의 실제 모티브와 배경, 쟁점을 읽습니다.', '/history'],
];

const POINTS = [
  ['첫 가입', '+500P'],
  ['오늘게임 투표', '+5P'],
  ['대통령 선거 투표', '+5P'],
  ['정당 유세', '+3P'],
];

export function renderGuide() {
  setMeta('이용안내');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">🏛️</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">복잡한 보조 기능을 줄이고, 역사 사건 선택 → 정당 활동 → 대통령 선거 흐름만 남긴 역사정치 게임입니다.</p>
      </div>

      <section class="guide-section">
        <h2 class="guide-section__title">📌 핵심만 보면 됩니다</h2>
        <div class="guide-step-list">
          ${STEPS.map(([num, title, desc, path]) => `
            <div class="guide-step" data-path="${path}" style="cursor:pointer">
              <div class="guide-step__num">${num}</div>
              <div><div class="guide-step__title">${title}</div><div class="guide-step__desc">${desc}</div></div>
            </div>`).join('')}
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">🎮 매일 하는 순서</h2>
        <div class="guide-section__body">
          <p><b>홈</b>에 들어가면 오늘 해야 할 순서가 그대로 보입니다.</p>
          <p>처음에는 <b>오늘게임</b>에서 투표하고, 그 다음 <b>정당</b>에서 입당/유세를 하고, 마지막으로 <b>대통령 선거</b>를 확인하면 됩니다.</p>
          <p><b>역사자료</b>는 게임 사건이 실제 어떤 역사 흐름을 모티브로 했는지 보는 곳입니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">💰 정치력 얻는 법</h2>
        <table class="guide-table"><thead><tr><th>행동</th><th>보상</th></tr></thead><tbody>${POINTS.map(([a,b]) => `<tr><td>${a}</td><td style="text-align:center;font-weight:800;color:var(--color-success)">${b}</td></tr>`).join('')}</tbody></table>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">🧹 정리된 기능</h2>
        <div class="guide-section__body">
          <p>국회, 헌법재판소, 소소신문, 피드처럼 흐름을 복잡하게 만들던 기능은 핵심 메뉴에서 제외했습니다.</p>
          <p>현재 게임의 중심은 <b>오늘게임 · 역사자료 · 정당 · 대통령 선거</b>입니다.</p>
        </div>
      </section>
    </div>`;
  el.querySelectorAll('[data-path]').forEach(node => node.addEventListener('click', () => navigate(node.dataset.path)));
}
