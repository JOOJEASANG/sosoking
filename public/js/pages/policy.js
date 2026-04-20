import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const TITLES = { terms: '이용약관', privacy: '개인정보처리방침', ai_disclaimer: 'AI 서비스 안내' };

const DEFAULTS = {
  terms: `소소킹 판결소 이용약관

제1조 (목적)
본 약관은 소소킹 판결소(이하 '서비스')가 제공하는 AI 기반 판결 서비스 이용에 관한 조건 및 절차를 규정합니다.

제2조 (서비스 이용)
1. 본 서비스는 오락 목적으로 제공되며 법적 효력이 없습니다.
2. 이용자는 일일 3건의 사건을 접수할 수 있습니다.
3. 개인정보, 타인을 비방하는 내용, 불법적인 내용은 접수할 수 없습니다.

제3조 (금지행위)
1. 허위 사실 또는 타인의 명예를 훼손하는 내용 접수 금지
2. 개인정보(실명, 연락처 등) 입력 금지
3. 서비스 악용 또는 시스템 교란 행위 금지
4. 영리 목적의 광고성 내용 접수 금지

제4조 (서비스 변경 및 중단)
운영자는 사전 고지 없이 서비스를 변경하거나 중단할 수 있습니다.

제5조 (면책)
본 서비스의 AI 판결은 어떠한 법적 구속력도 없으며, 서비스 이용으로 인한 손해에 대해 운영자는 책임지지 않습니다.

제6조 (준거법)
본 약관은 대한민국 법률에 따라 해석됩니다.`,

  privacy: `소소킹 판결소 개인정보처리방침

1. 수집하는 개인정보
본 서비스는 Firebase 익명 인증을 사용하며 이름, 이메일 등 개인 식별 정보를 수집하지 않습니다. 서비스 이용 시 입력하는 사건 내용이 서버에 저장됩니다.

2. 개인정보 이용 목적
- AI 판결 생성 및 서비스 제공
- 서비스 품질 개선 및 악용 방지

3. 개인정보 보유 기간
서비스 운영 기간 동안 보관하며, 관리자의 판단에 따라 삭제될 수 있습니다.

4. 개인정보 제3자 제공
수집된 정보는 AI 판결 생성을 위해 Google Gemini API에 전달됩니다. 그 외 제3자에게 제공하지 않습니다.

5. 이용자의 권리
이용자는 접수한 사건의 삭제를 요청할 수 있습니다. 관리자 이메일로 문의해주세요.

6. 쿠키 및 추적 기술
본 서비스는 Firebase Analytics를 통해 익명화된 서비스 이용 통계를 수집할 수 있습니다.

7. 문의
개인정보 관련 문의사항은 서비스 운영자에게 연락주세요.`,

  ai_disclaimer: `소소킹 판결소 AI 서비스 안내

1. 본 서비스의 성격
소소킹 판결소는 Google Gemini AI를 활용한 순수 오락 목적의 서비스입니다. 실제 법률 자문이 아님을 명확히 알려드립니다.

2. AI 판결의 한계
- AI가 생성한 판결문은 어떠한 법적 효력도 없습니다.
- AI의 판단은 부정확하거나 편향될 수 있습니다.
- 실제 법적 문제는 반드시 전문 법률가에게 상담받으시기 바랍니다.
- AI는 유머와 과장을 포함한 오락용 콘텐츠를 생성합니다.

3. 콘텐츠 관련 주의사항
- AI가 생성한 내용에 오류나 부적절한 표현이 포함될 수 있습니다.
- 생성된 판결문을 실제 상황에 활용하지 마세요.
- 판결 결과를 타인에게 공유 시 오락 목적임을 명시해주세요.

4. 사용 AI 모델
본 서비스는 Google의 Gemini 2.0 Flash 모델을 사용합니다.

5. 데이터 처리
입력하신 사건 내용은 AI 판결 생성 목적으로만 사용되며, Google의 개인정보처리방침에 따라 처리됩니다.`
};

export async function renderPolicy(container, type) {
  container.innerHTML = `
    <div class="page-header">
      <a href="#/" class="back-btn">‹</a>
      <span class="logo">${TITLES[type] || '정책'}</span>
    </div>
    <div class="container" style="padding:28px 20px 60px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  try {
    const snap = await getDoc(doc(db, 'policy_docs', type));
    const content = snap.exists() && snap.data().content ? snap.data().content : (DEFAULTS[type] || '아직 등록된 내용이 없습니다.');
    container.querySelector('.container').innerHTML =
      `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;">${content}</div>`;
  } catch {
    const content = DEFAULTS[type] || '불러오지 못했습니다.';
    container.querySelector('.container').innerHTML =
      `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;">${content}</div>`;
  }
}
