import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

const STEPS = [
  ['1', 'AI 놀이터', '판결소·창작소·미친 상담소에서 캐릭터 결과를 받아봅니다.', '/playground'],
  ['2', '오늘의 콘텐츠', '매일 자동 생성되는 생활자료와 A/B 토론을 한 화면에서 확인합니다.', '/today'],
  ['3', '소소자료실', '생활정보를 읽고 댓글을 남기거나 직접 자료를 등록합니다.', '/materials'],
  ['4', '소소토론실', 'A 또는 B를 선택하고 같은 입장으로 댓글을 작성합니다.', '/debates'],
  ['5', '내정보', '개인 AI 결과, 닉네임과 계정 삭제 기능을 관리합니다.', '/account'],
];

const VISIBILITY = [
  ['개인 AI 결과', '본인만 열람', '판결·창작·상담 입력과 결과는 계정 전용 영역에 저장됩니다.'],
  ['자료·토론', '전체 공개', '회원이 등록한 글, 닉네임, 대표 이미지와 댓글은 비회원에게도 보일 수 있습니다.'],
  ['투표·조회 기록', '개별 기록 비공개', '화면에는 합계만 표시하고 개인별 기록은 서버에서 중복 참여 방지에 사용합니다.'],
];

const RULES = [
  ['AI 결과는 참고용', '재미와 참고를 위한 자동 생성 결과이며 법률·의료·세무·투자 등 전문 판단을 대신하지 않습니다.'],
  ['A/B 투표와 댓글 연동', '토론 댓글은 별도 입장을 고르는 방식이 아니라 현재 실제 투표한 A 또는 B 입장으로 등록됩니다.'],
  ['이미지 자동 최적화', '큰 이미지는 브라우저에서 긴 변 1,920px 이하, 약 1.8MB 이하로 줄인 뒤 업로드합니다.'],
  ['회원 콘텐츠 공개', '자료·토론·댓글·대표 이미지는 공개 콘텐츠이므로 개인정보나 타인의 얼굴·문서를 올리지 마세요.'],
  ['운영자 관리', '신고, 권리 침해, 광고, 혐오·괴롭힘, 개인정보 노출 등 운영 기준에 어긋나는 콘텐츠는 숨김 또는 삭제될 수 있습니다.'],
];

export function renderGuide() {
  setMeta('이용안내', '소소킹 AI 놀이터·오늘의 콘텐츠·자료실·토론실·내정보 이용 방법');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="guide-page">
      <div class="guide-hero">
        <div class="guide-hero__icon">👑</div>
        <h1 class="guide-hero__title">소소킹 이용안내</h1>
        <p class="guide-hero__sub">AI 캐릭터와 가볍게 놀고, 생활정보를 나누고, A/B 토론에 참여하는 서비스입니다.</p>
      </div>

      <section class="guide-section">
        <h2 class="guide-section__title">📌 서비스 이용 흐름</h2>
        <div class="guide-step-list">
          ${STEPS.map(([num, title, desc, path]) => `
            <div class="guide-step" data-path="${path}" role="button" tabindex="0">
              <div class="guide-step__num">${num}</div>
              <div><div class="guide-step__title">${title}</div><div class="guide-step__desc">${desc}</div></div>
            </div>`).join('')}
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">🤖 AI 놀이터</h2>
        <div class="guide-section__body">
          <p><b>판결소</b>에서는 생활 속 갈등이나 고민을 입력하면 여러 성향의 캐릭터가 각자의 관점으로 판결합니다.</p>
          <p><b>창작소</b>에서는 문장을 다른 말투로 바꾸거나 이름·제목·별명 등을 만들 수 있습니다.</p>
          <p><b>미친 상담소</b>에서는 고민을 지나치게 무겁지 않게 풀어주는 재치 있고 유머 있는 조언을 받을 수 있습니다.</p>
          <p>판결소와 상담소에서 캐릭터를 선택하지 않으면 서로 다른 캐릭터 3명이 무작위로 선택됩니다.</p>
          <p>로그인 회원의 AI 입력과 결과는 공개 게시물로 자동 전환되지 않으며 내정보에 최근 50개까지만 저장됩니다.</p>
          <p>일일 이용 횟수와 전체 월간 상한은 운영 상황에 따라 조정될 수 있습니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">🗓️ 오늘의 콘텐츠</h2>
        <div class="guide-section__body">
          <p>생활자료는 매일 오전 7시 30분, A/B 토론은 오전 8시에 각각 자동 생성되도록 설정되어 있습니다.</p>
          <p>자동 생성 결과는 공개 전 별도의 AI 안전·균형 검수를 통과한 경우에만 게시됩니다.</p>
          <p>생성이나 검수에 실패하면 임의의 대체 글을 공개하지 않고 운영 기록에 실패 상태를 남깁니다.</p>
          <p>관리자는 누락된 날짜를 다시 실행하거나 필요한 자료·토론을 직접 등록할 수 있습니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">📚 소소자료실</h2>
        <div class="guide-section__body">
          <p>AI 자동생성 자료, 관리자 자료와 회원이 직접 등록한 생활정보를 함께 제공합니다.</p>
          <p>로그인 회원은 제목·요약·핵심 내용·태그·출처와 대표 이미지를 포함한 자료를 등록하고 댓글을 작성할 수 있습니다.</p>
          <p>회원이 입력한 출처명이나 링크는 운영자가 사실성을 보증하지 않으므로 중요한 정보는 관계 기관의 최신 안내를 다시 확인해야 합니다.</p>
          <p>조회수는 로그인 회원 기준으로 같은 자료에 하루 한 번만 반영됩니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">💬 소소토론실</h2>
        <div class="guide-section__body">
          <p>AI·관리자·회원이 등록한 생활형 주제에서 A와 B 중 하나를 선택합니다.</p>
          <p>투표는 나중에 다른 쪽으로 변경할 수 있으며 기존 집계는 서버에서 함께 조정됩니다.</p>
          <p>댓글을 작성하려면 먼저 A 또는 B에 투표해야 하고, 댓글의 입장은 실제 현재 투표 기록에서 서버가 자동 결정합니다.</p>
          <p>로그인 회원은 상황 설명, A·B 입장과 대표 이미지를 포함한 새 토론도 직접 등록할 수 있습니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">🔐 공개 범위</h2>
        <table class="guide-table">
          <thead><tr><th>데이터</th><th>공개 범위</th><th>설명</th></tr></thead>
          <tbody>${VISIBILITY.map(([a,b,c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody>
        </table>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">👤 내정보와 탈퇴</h2>
        <div class="guide-section__body">
          <p>내정보에서는 닉네임, 개인 AI 결과, 본인이 작성한 콘텐츠와 계정 설정을 확인할 수 있습니다.</p>
          <p>개인 AI 결과는 개별 삭제할 수 있으며 삭제한 결과는 복구할 수 없습니다.</p>
          <p>회원 탈퇴 시 인증 계정, 회원 정보, 개인 AI 결과, 개인별 참여 기록, 작성한 공개 콘텐츠와 업로드 파일을 삭제합니다.</p>
          <p>전체 투표수·조회수처럼 작성자를 식별하지 않는 집계 수치는 서비스 통계로 남을 수 있습니다.</p>
        </div>
      </section>

      <section class="guide-section">
        <h2 class="guide-section__title">✅ 운영 기준</h2>
        <table class="guide-table"><thead><tr><th>항목</th><th>내용</th></tr></thead><tbody>${RULES.map(([a,b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>
      </section>
    </div>`;

  const go = node => navigate(node.dataset.path);
  el.querySelectorAll('[data-path]').forEach(node => {
    node.addEventListener('click', () => go(node));
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(node); }
    });
  });
}
