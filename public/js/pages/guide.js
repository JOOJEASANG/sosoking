import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const STEPS = [
  ['1', '오늘자료', '매일 올라오는 실제 역사·정치·사회 사건 자료를 짧게 읽습니다.', '/battle'],
  ['2', '댓글 참여', '자료를 읽고 내 생각을 댓글로 남깁니다.', '/battle'],
  ['3', '역사자료', '사건의 실제 배경, 전개, 결과, 쟁점을 더 자세히 확인합니다.', '/history'],
  ['4', '관심 분야', '내가 자주 보는 관점이나 주제를 선택해 자료 흐름을 정리합니다.', '/republic'],
];

const RULES = [
  ['포인트 없음', '활동 보상이나 정치력 점수 없이 읽기와 댓글 중심으로 운영합니다.'],
  ['자료 우선', '사건 요약, 배경, 전개, 결과, 쟁점, 생각해볼 질문을 먼저 보여줍니다.'],
  ['댓글 중심', '복잡한 게임 기능보다 짧은 의견과 토론 흐름을 우선합니다.'],
  ['실제 사건 기반', '가상 설정보다 실제 역사·사회 자료를 이해하기 쉽게 정리합니다.'],
];

export function renderGuide() {
  setMeta('이용안내');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">📚</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">소소킹은 포인트 경쟁이 아니라, 실제 사건 자료를 쉽게 읽고 댓글로 생각을 남기는 자료 사이트로 운영합니다.</p>
      </div>

      <section class="guide-section">
        <h2 class="guide-section__title">📌 이용 흐름</h2>
        <div class="guide-step-list">
          ${STEPS.map(([num, title, desc, path]) => `
            <div class="guide-step" data-path="${path}" style="cursor:pointer">
              <div class="guide-step__num">${num}</div>
              <div><div class="guide-step__title">${title}</div><div class="guide-step__desc">${desc}</div></div>
            </div>`).join('')}
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">📰 매일 보는 방식</h2>
        <div class="guide-section__body">
          <p><b>홈</b>에서 오늘 올라온 자료를 확인합니다.</p>
          <p><b>오늘자료</b>를 읽고, 사건에 대한 생각을 댓글로 남기면 됩니다.</p>
          <p><b>역사자료</b>에서는 실제 사건의 배경, 전개, 결과, 핵심 쟁점을 더 자세히 볼 수 있습니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">✅ 운영 기준</h2>
        <table class="guide-table"><thead><tr><th>항목</th><th>내용</th></tr></thead><tbody>${RULES.map(([a,b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">🧹 정리된 기능</h2>
        <div class="guide-section__body">
          <p>포인트, 정치력 보상, 복잡한 성장 구조는 전면에서 제거했습니다.</p>
          <p>현재 중심은 <b>오늘자료 · 역사자료 · 댓글 참여 · 관심 분야</b>입니다.</p>
        </div>
      </section>
    </div>`;
  el.querySelectorAll('[data-path]').forEach(node => node.addEventListener('click', () => navigate(node.dataset.path)));
}
