import { injectSosoStyle } from '../components/soso-style.js';

const POLICY = {
  terms: {
    title: '이용약관',
    label: 'TERMS',
    emoji: '📜',
    summary: '소소킹은 재미, 정보, 투표, 댓글, 릴레이소설, 역할극을 중심으로 운영되는 소소피드 커뮤니티 서비스입니다.',
    sections: [
      ['제1조 목적', '본 약관은 소소킹이 제공하는 소소피드, 글쓰기, 이미지 업로드, 링크 공유, AI 링크 요약, 댓글, 투표, 신고, 의견접수 등 서비스의 이용 조건과 운영 기준을 정합니다.'],
      ['제2조 서비스의 성격', '소소킹은 사진 제목학원, 밸런스게임, 소소토론, 퀴즈, 정보공유, 영상 리액션, 릴레이소설, 막장드라마, 역할극방을 한 피드에서 즐기는 참여형 커뮤니티 서비스입니다.'],
      ['제3조 소소피드', '소소피드는 이용자가 글, 이미지, 링크, 질문, 선택지, 댓글, 투표를 남길 수 있는 참여형 공간입니다. 운영자는 안전한 이용을 위해 콘텐츠를 숨김, 삭제 또는 제한할 수 있습니다.'],
      ['제4조 링크와 AI 요약', '이용자는 유용한 사이트, 이미지, 영상 링크를 공유할 수 있습니다. AI 요약은 원문 전체를 복사하지 않고 핵심 내용을 짧게 정리하는 보조 기능이며, 원문 확인은 사이트 바로가기를 통해 이루어집니다.'],
      ['제5조 금지 주제와 금지 행위', '정치 선거 조작, 금융 투자 권유, 실제 범죄 피해자, 재난·사망 사고 희화화, 실명 비방, 혐오·차별, 선정적 내용, 불법행위 조장, 저작권 침해, 개인정보 노출 콘텐츠는 제한될 수 있습니다.'],
      ['제6조 이용자 콘텐츠', '소소피드 글, 이미지, 링크, 댓글, 의견 접수에는 실명, 연락처, 주소, 계좌번호, 직장·학교 등 개인을 식별할 수 있는 정보를 입력하지 않아야 합니다. 운영자는 부적절한 콘텐츠를 삭제하거나 이용을 제한할 수 있습니다.'],
      ['제7조 신고와 운영 조치', '사용자는 문제가 있는 글과 댓글을 신고할 수 있습니다. 운영자는 신고 내용과 서비스 운영 기준에 따라 게시물 숨김, 삭제, 이용 제한 등 필요한 조치를 할 수 있습니다.'],
      ['제8조 면책', '이용자 게시물, AI 요약, 투표 결과, 댓글은 이용자 참여와 정보 공유를 돕기 위한 콘텐츠이며, 전문적 판단이나 중요한 의사결정의 근거로 사용할 수 없습니다.']
    ]
  },
  privacy: {
    title: '개인정보처리방침',
    label: 'PRIVACY',
    emoji: '🔒',
    summary: '서비스 운영에 필요한 최소한의 정보만 처리하며, 피드와 댓글에는 개인정보 입력을 제한합니다.',
    sections: [
      ['1. 처리하는 정보', 'Firebase 익명 인증 또는 로그인 계정 정보, 닉네임, 소소피드 글·이미지 URL·링크 URL, 댓글, 투표 기록, 신고·의견 접수 내용, 접속 로그, 오류 로그를 처리할 수 있습니다.'],
      ['2. 처리 목적', '소소피드 운영, 댓글·투표 표시, 링크 요약, 신고 처리, 어뷰징 방지, 오류 개선, 문의 대응을 위해 정보를 처리합니다.'],
      ['3. 보관 기간', '계정 정보와 서비스 이용 기록은 서비스 제공 및 운영 목적상 필요한 기간 보관될 수 있습니다. 회원 탈퇴 시 로그인 계정은 삭제되지만, 이미 작성한 글·댓글·신고 기록은 운영 기록 보존을 위해 남을 수 있습니다.'],
      ['4. 외부 서비스', '서비스 제공을 위해 Firebase Authentication, Firestore, Cloud Storage, Cloud Functions, Hosting, Google Gemini API 등을 사용할 수 있습니다.'],
      ['5. 개인정보 입력 제한', '소소피드 글, 이미지, 링크, 댓글, 의견 접수에 실명, 연락처, 주소, 계좌번호, 주민등록번호, 학교·직장, 민감정보를 입력하지 마세요.'],
      ['6. 이용자 권리', '이용자는 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 다만 부정 이용 방지와 운영 기록 보존을 위해 일부 기록은 제한적으로 보관될 수 있습니다.']
    ]
  },
  ai_disclaimer: {
    title: 'AI 서비스 안내',
    label: 'AI NOTICE',
    emoji: '🤖',
    summary: 'AI는 링크 요약, 글쓰기 보조, 놀이용 아이디어 생성을 돕는 도구이며, 정확성을 보장하지 않습니다.',
    sections: [
      ['AI의 역할', '소소킹은 링크 요약, 제목 추천, 선택지 아이디어, 퀴즈 문구, 정보공유 설명, AI놀이 콘텐츠 보조를 위해 AI를 사용할 수 있습니다.'],
      ['링크 요약', 'AI 링크 요약은 원문 전체를 복사하지 않고 핵심 내용을 짧게 정리하는 기능입니다. 원문과 상세 내용은 반드시 사이트 바로가기를 통해 확인해야 합니다.'],
      ['정확성 한계', 'AI가 생성한 요약, 제목, 질문, 선택지, 핵심 포인트는 부정확하거나 어색할 수 있습니다. 중요한 정보는 원문과 공식 출처를 직접 확인해야 합니다.'],
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
        <div class="doc-effective">시행일: 2026년 5월 15일</div>
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
