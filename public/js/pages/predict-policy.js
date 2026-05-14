import { injectSosoStyle } from '../components/soso-style.js';

const POLICY = {
  terms: {
    title: '이용약관',
    label: 'TERMS',
    emoji: '📜',
    summary: '소소킹은 글, 사진, 투표, 댓글을 중심으로 운영되는 소소피드 커뮤니티 서비스입니다.',
    sections: [
      ['제1조 목적', '본 약관은 소소킹이 제공하는 소소피드, 글쓰기, 이미지 업로드, 댓글, 투표, 신고, 의견접수 등 서비스의 이용 조건과 운영 기준을 정합니다.'],
      ['제2조 서비스의 성격', '소소킹은 사진 제목학원, 밸런스게임, 소소토론, 퀴즈, AI놀이를 한 피드에서 즐기는 오락용 커뮤니티 서비스입니다. 게임머니, 충전, 환전, 출금, 현물 보상은 제공하지 않습니다.'],
      ['제3조 소소피드', '소소피드는 이용자가 글, 이미지, 질문, 선택지, 댓글, 투표를 남길 수 있는 참여형 공간입니다. 운영자는 안전한 이용을 위해 콘텐츠를 숨김, 삭제 또는 제한할 수 있습니다.'],
      ['제4조 금지 주제와 금지 행위', '정치 선거, 주식·코인 가격, 실제 범죄 피해자, 재난·사망 사고 희화화, 실명 비방, 혐오·차별, 선정적 내용, 불법행위 조장, 저작권 침해, 개인정보 노출 콘텐츠는 제한될 수 있습니다.'],
      ['제5조 이용자 콘텐츠', '소소피드 글, 이미지, 댓글, 의견 접수에는 실명, 연락처, 주소, 계좌번호, 직장·학교 등 개인을 식별할 수 있는 정보를 입력하지 않아야 합니다. 운영자는 부적절한 콘텐츠를 삭제하거나 이용을 제한할 수 있습니다.'],
      ['제6조 신고와 운영 조치', '사용자는 문제가 있는 글과 댓글을 신고할 수 있습니다. 운영자는 신고 내용과 서비스 운영 기준에 따라 게시물 숨김, 삭제, 이용 제한 등 필요한 조치를 할 수 있습니다.'],
      ['제7조 면책', '서비스는 오락 목적으로 제공됩니다. 이용자 게시물, 투표 결과, 댓글은 실제 사실 판단이나 전문적 의사결정의 근거가 될 수 없습니다.']
    ]
  },
  privacy: {
    title: '개인정보처리방침',
    label: 'PRIVACY',
    emoji: '🔒',
    summary: '서비스 운영에 필요한 최소한의 정보만 처리하며, 피드와 댓글에는 개인정보 입력을 제한합니다.',
    sections: [
      ['1. 처리하는 정보', 'Firebase 익명 인증 또는 로그인 계정 정보, 닉네임, 소소피드 글·이미지 URL, 댓글, 투표 기록, 신고·의견 접수 내용, 접속 로그, 오류 로그를 처리할 수 있습니다.'],
      ['2. 처리 목적', '소소피드 운영, 댓글·투표 표시, 신고 처리, 어뷰징 방지, 오류 개선, 문의 대응을 위해 정보를 처리합니다.'],
      ['3. 보관 기간', '계정 정보와 서비스 이용 기록은 서비스 제공 및 운영 목적상 필요한 기간 보관될 수 있습니다. 이용자가 삭제를 요청하거나 계정을 탈퇴하면 관련 법령 및 백업 정책에 따라 삭제 또는 비식별 처리됩니다.'],
      ['4. 외부 서비스', '서비스 제공을 위해 Firebase Authentication, Firestore, Cloud Storage, Cloud Functions, Hosting, Google Gemini API 등을 사용할 수 있습니다.'],
      ['5. 개인정보 입력 제한', '소소피드 글, 이미지, 댓글, 의견 접수에 실명, 연락처, 주소, 계좌번호, 주민등록번호, 학교·직장, 민감정보를 입력하지 마세요.'],
      ['6. 이용자 권리', '이용자는 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.']
    ]
  },
  ai_disclaimer: {
    title: 'AI 서비스 안내',
    label: 'AI NOTICE',
    emoji: '🤖',
    summary: 'AI는 글쓰기 보조와 놀이용 아이디어 생성 도구이며, 정답이나 사실 판단을 보장하지 않습니다.',
    sections: [
      ['AI의 역할', '소소킹은 제목 추천, 선택지 아이디어, 퀴즈 문구, AI놀이 콘텐츠 보조를 위해 AI를 사용할 수 있습니다.'],
      ['데이터 원천', 'AI는 데이터 원천이 아닙니다. 이용자 콘텐츠와 공개 데이터는 별도 운영 기준에 따라 관리되며, AI는 이를 놀이용 문구로 정리하는 보조 역할을 합니다.'],
      ['정확성 한계', 'AI가 생성한 요약, 제목, 질문, 선택지는 부정확하거나 어색할 수 있습니다. 서비스는 오락용이며 투자, 도박, 법률 판단, 실제 의사결정의 근거로 사용할 수 없습니다.'],
      ['운영 필터링', '부적절하거나 위험한 주제는 필터링될 수 있으며, 운영자는 안전을 위해 소소피드 콘텐츠를 숨김, 삭제 또는 수정할 수 있습니다.']
    ]
  }
};

export function renderPredictPolicy(container, type = 'terms') {
  injectSosoStyle();
  injectPolicyStyle();
  const policy = POLICY[type] || POLICY.terms;
  container.innerHTML = `
    <main class="predict-app simple-page soso-doc-page">
      <section class="doc-hero">
        <a href="#/" class="back-link">‹</a>
        <div class="doc-hero-copy">
          <img src="/logo.svg" alt="소소킹">
          <div><span>${policy.label}</span><h1>${policy.title}</h1><p>${policy.summary}</p></div>
        </div>
        <b>${policy.emoji}</b>
      </section>
      <article class="soso-doc-card">
        <div class="doc-effective">시행일: 2026년 5월 13일</div>
        ${policy.sections.map(([title, body]) => `<section class="doc-section"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></section>`).join('')}
      </article>
    </main>`;
}

function injectPolicyStyle() {
  if (document.getElementById('predict-policy-style')) return;
  const style = document.createElement('style');
  style.id = 'predict-policy-style';
  style.textContent = `
    .soso-doc-page{padding:18px clamp(16px,4vw,34px) 104px}.doc-hero,.soso-doc-card{max-width:880px;margin-left:auto;margin-right:auto}.doc-hero{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:stretch;margin-bottom:14px}.doc-hero-copy{display:flex;gap:14px;align-items:center;border:1px solid rgba(79,124,255,.14);border-radius:28px;padding:18px;background:rgba(255,255,255,.84);box-shadow:0 18px 54px rgba(55,90,170,.10)}.doc-hero-copy img{width:58px;height:58px;border-radius:20px;box-shadow:0 12px 28px rgba(79,124,255,.18);transform:rotate(-6deg)}.doc-hero-copy span{color:var(--predict-main);font-size:11px;font-weight:1000;letter-spacing:.16em}.doc-hero-copy h1{margin:4px 0 5px;font-size:28px;letter-spacing:-.06em}.doc-hero-copy p{margin:0;color:var(--predict-muted);font-size:13px;line-height:1.65}.doc-hero>b{display:flex;align-items:center;justify-content:center;min-width:64px;border-radius:24px;background:linear-gradient(135deg,rgba(79,124,255,.12),rgba(255,92,138,.10));font-size:28px}.soso-doc-card{border:1px solid rgba(79,124,255,.14);border-radius:30px;padding:22px;background:rgba(255,255,255,.86);box-shadow:0 18px 54px rgba(55,90,170,.10)}.doc-effective{display:inline-flex;padding:8px 10px;border-radius:999px;background:rgba(79,124,255,.09);color:var(--predict-main);font-size:12px;font-weight:1000;margin-bottom:10px}.doc-section{padding:16px 0;border-top:1px solid rgba(79,124,255,.11)}.doc-section:first-of-type{border-top:0}.doc-section h2{margin:0 0 8px;font-size:18px;letter-spacing:-.04em}.doc-section p{margin:0;color:var(--predict-muted);font-size:14px;line-height:1.85;word-break:keep-all;overflow-wrap:anywhere}@media(max-width:720px){.doc-hero{grid-template-columns:1fr}.doc-hero .back-link{width:42px}.doc-hero>b{display:none}.doc-hero-copy{align-items:flex-start}.doc-hero-copy img{width:48px;height:48px}.soso-doc-card{padding:18px}}[data-theme="dark"] .doc-hero-copy,[data-theme="dark"] .soso-doc-card{background:rgba(16,23,34,.88);box-shadow:none}
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
