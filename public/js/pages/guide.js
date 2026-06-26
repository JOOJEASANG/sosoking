import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const STEPS = [
  ['1', 'AI 놀이터', '판결소·창작소·미친 상담소에서 캐릭터를 고르거나 랜덤 캐릭터로 결과를 받아봅니다.', '/playground'],
  ['2', '오늘의 콘텐츠', '매일 생성되는 생활자료와 A/B 토론 주제를 한눈에 확인합니다.', '/today'],
  ['3', '소소자료실', '생활정보를 읽고 댓글을 남기거나 이미지와 함께 직접 자료를 등록합니다.', '/materials'],
  ['4', '소소토론실', 'A 또는 B를 선택하고 선택한 입장으로 댓글을 남기거나 새 토론을 등록합니다.', '/debates'],
];

const RULES = [
  ['AI 결과는 참고용', '판결·창작·상담 결과는 재미와 참고를 위한 내용이며 전문적인 판단을 대신하지 않습니다.'],
  ['A/B 선택과 댓글 연동', '토론 댓글은 위에서 선택한 A 또는 B 입장으로 자동 등록됩니다.'],
  ['이미지 자동 최적화', '자료·토론에 올리는 큰 이미지는 브라우저에서 해상도와 용량을 자동으로 줄입니다.'],
  ['서로 존중하기', '특정인을 공격하거나 개인정보·불법 정보·광고성 링크를 포함한 글은 제한될 수 있습니다.'],
];

export function renderGuide() {
  setMeta('이용안내', '소소킹 AI 놀이터·자료실·토론실 이용 방법');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">👑</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">AI 캐릭터와 가볍게 놀고, 생활자료를 나누고, A/B 토론에 참여하는 방법입니다.</p>
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
        <h2 class="guide-section__title">🤖 AI 놀이터</h2>
        <div class="guide-section__body">
          <p><b>판결소</b>에서는 생활 속 갈등을 여러 성향의 캐릭터가 재치 있게 판결합니다.</p>
          <p><b>창작소</b>에서는 문장 말투를 바꾸거나 이름을 지을 수 있습니다.</p>
          <p><b>미친 상담소</b>에서는 고민을 무겁지 않게 풀어주는 유머 있는 조언을 받을 수 있습니다.</p>
          <p>판결소와 상담소에서 캐릭터를 고르지 않으면 서로 다른 캐릭터가 무작위로 선택됩니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">📚 자료실과 토론실</h2>
        <div class="guide-section__body">
          <p><b>자료실</b>에서는 AI·관리자·회원이 등록한 생활자료를 읽고 댓글을 남길 수 있습니다.</p>
          <p><b>토론실</b>에서는 A 또는 B를 먼저 선택한 뒤 같은 입장으로 댓글을 작성합니다.</p>
          <p>로그인 회원은 자료와 토론을 직접 등록할 수 있으며 대표 이미지도 첨부할 수 있습니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">✅ 운영 기준</h2>
        <table class="guide-table"><thead><tr><th>항목</th><th>내용</th></tr></thead><tbody>${RULES.map(([a,b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>
      </section>
    </div>`;
  el.querySelectorAll('[data-path]').forEach(node => node.addEventListener('click', () => navigate(node.dataset.path)));
}
