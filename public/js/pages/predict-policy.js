import { injectPredictStyle } from './predict-home.js';

const POLICY = {
  terms: {
    title: '이용약관',
    body: `소소킹 이용약관

시행일: 2026년 5월 13일

제1조 목적
본 약관은 소소킹이 제공하는 오락용 예측 게임 서비스의 이용 조건과 운영 기준을 정합니다.

제2조 서비스의 성격
소소킹은 오늘의 이슈가 내일 어떻게 될지 예측하고 게임 전용 포인트인 소소머니를 얻거나 잃는 엔터테인먼트 서비스입니다. 소소머니는 현금 가치가 없으며 충전, 환전, 출금, 현물 보상을 제공하지 않습니다.

제3조 예측판
예측판은 자동 수집 데이터, 알고리즘 점수, AI 요약 및 질문 생성 과정을 통해 제공될 수 있습니다. 모든 예측판에는 마감 시간, 결과 기준, 정산 시간이 표시됩니다.

제4조 금지 주제
정치 선거, 주식·코인 가격, 실제 범죄 피해자, 재난·사망 사고 희화화, 실명 비방, 혐오·차별, 선정적 내용, 불법행위 조장 주제는 제한될 수 있습니다.

제5조 이용자 콘텐츠
댓글과 근거 작성 시 실명, 연락처, 주소, 계좌번호, 직장·학교 등 개인을 식별할 수 있는 정보를 입력하지 않아야 합니다. 운영자는 부적절한 콘텐츠를 삭제하거나 이용을 제한할 수 있습니다.

제6조 정산
정산은 서비스가 정한 데이터 기준과 알고리즘에 따라 이루어집니다. 외부 데이터 지연, API 장애, 오류가 있을 경우 정산이 지연되거나 운영자가 보정할 수 있습니다.

제7조 면책
서비스는 오락 목적으로 제공됩니다. 예측 결과는 실제 투자, 도박, 법률 판단, 경제적 의사결정의 근거가 될 수 없습니다.`
  },
  privacy: {
    title: '개인정보처리방침',
    body: `소소킹 개인정보처리방침

시행일: 2026년 5월 13일

1. 처리하는 정보
서비스는 Firebase 익명 인증 또는 로그인 계정 정보, 닉네임, 예측 참여 기록, 댓글, 소소머니 잔액, 랭킹 정보, 접속 로그, 오류 로그를 처리할 수 있습니다.

2. 처리 목적
예측판 참여, 소소머니 정산, 댓글 표시, 랭킹 산정, 어뷰징 방지, 오류 개선, 문의 대응을 위해 정보를 처리합니다.

3. 보관 기간
계정 정보와 예측 기록은 서비스 제공 및 운영 목적상 필요한 기간 보관될 수 있습니다. 이용자가 삭제를 요청하거나 계정을 탈퇴하면 관련 법령 및 백업 정책에 따라 삭제 또는 비식별 처리됩니다.

4. 외부 서비스
서비스 제공을 위해 Firebase Authentication, Firestore, Cloud Functions, Hosting, Google Gemini API, 데이터 수집 API를 사용할 수 있습니다.

5. 개인정보 입력 제한
댓글과 예측 근거에 실명, 연락처, 주소, 계좌번호, 주민등록번호, 학교·직장, 민감정보를 입력하지 마세요.

6. 이용자 권리
이용자는 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.`
  },
  ai_disclaimer: {
    title: 'AI 서비스 안내',
    body: `소소킹 AI 서비스 안내

소소킹은 자동 수집된 이슈 데이터를 요약하고, 예측 질문과 결과 해설을 만들기 위해 AI를 사용할 수 있습니다.

AI는 데이터 원천이 아닙니다. 실제 이슈 후보는 API, RSS, 공개 데이터 등 외부 데이터 수집을 통해 확보되며, AI는 이를 게임용 문구로 정리하는 역할을 합니다.

AI가 생성한 요약, 질문, 해설은 부정확하거나 어색할 수 있습니다. 서비스는 오락용이며 투자, 도박, 법률 판단, 실제 의사결정의 근거로 사용할 수 없습니다.

부적절하거나 위험한 주제는 필터링될 수 있으며, 운영자는 안전을 위해 예측판을 숨김, 삭제, 정산 보류 또는 수정할 수 있습니다.`
  }
};

export function renderPredictPolicy(container, type = 'terms') {
  injectPredictStyle();
  injectPolicyStyle();
  const policy = POLICY[type] || POLICY.terms;
  container.innerHTML = `
    <main class="predict-app simple-page">
      <div class="simple-header">
        <a href="#/" class="back-link">‹</a>
        <div><span>POLICY</span><h1>${policy.title}</h1></div>
        <b>소소킹</b>
      </div>
      <article class="predict-policy-card"><pre>${escapeHtml(policy.body)}</pre></article>
    </main>`;
}

function injectPolicyStyle() {
  if (document.getElementById('predict-policy-style')) return;
  const style = document.createElement('style');
  style.id = 'predict-policy-style';
  style.textContent = `
    .predict-policy-card { max-width:820px; margin:0 auto; border:1px solid var(--predict-line); border-radius:24px; padding:20px; background:var(--predict-card); }
    .predict-policy-card pre { margin:0; white-space:pre-wrap; word-break:keep-all; overflow-wrap:anywhere; color:var(--predict-muted); font-family:var(--font-sans); font-size:13px; line-height:1.85; }
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
