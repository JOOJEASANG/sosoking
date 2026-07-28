import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const TITLES = { terms: '이용약관', privacy: '개인정보처리방침', ai_disclaimer: 'AI 서비스 안내' };

const DEFAULTS = {
  terms: `소소킹 판결소 이용약관

제1조 (목적)
본 약관은 {companyName}(이하 '서비스')가 제공하는 AI 기반 오락 판결 서비스 이용에 관한 조건 및 절차를 규정합니다.

제2조 (서비스 이용)
1. 본 서비스는 오락 목적으로 제공되며 법적 효력이 없습니다.
2. 이용자는 운영 정책에 따른 접수 한도 내에서 사건을 접수할 수 있습니다.
3. 개인정보, 타인을 비방하는 내용, 불법적인 내용은 접수할 수 없습니다.
4. 사건과 판결문은 기본적으로 비공개이며, 이용자가 공개 동의 항목을 직접 선택하거나 결과 화면에서 공개로 전환한 경우에만 공개 판결기록에 게시됩니다.
5. 공개 시 닉네임, 사건 내용 및 AI가 생성한 판결문이 다른 로그인 이용자에게 표시되고 투표와 댓글의 대상이 될 수 있습니다.

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

시행일: 2026년 7월 29일

1. 처리하는 정보
- 회원·인증 정보: Firebase Authentication 사용자 식별자(UID), 이메일 주소, 로그인 제공자, 이메일 인증 여부
- 프로필 정보: 닉네임, 프로필 이미지 주소 또는 생성형 아바타 정보
- 서비스 이용 정보: 사건 내용, 공개 여부, 생성된 판결문, 투표·댓글, 신고 내역
- 보안·운영 정보: 접수 및 AI 요청 횟수, 처리 시각, 오류·사용량 기록, 과거 사건 주소 이전을 위한 일방향 해시값
사건 내용에는 실명, 연락처, 주소, 계좌번호, 주민등록번호 등 타인을 식별할 수 있는 정보를 입력하지 않아야 합니다.

2. 처리 목적
- 회원 로그인, 이메일 인증, 닉네임 중복 방지 및 내 사건 관리
- 입력 내용을 바탕으로 한 AI 판결문 생성과 로컬 대체 판결 생성
- 이용자가 명시적으로 선택한 공개 판결기록 제공
- 투표·댓글·신고 기능 운영
- 개인정보·고위험 내용·시스템 공격성 문장의 사전 및 생성 후 탐지
- 중복 요청, 비정상 이용 및 AI 비용 남용 방지
- 과거 형식의 사건 주소를 UID가 포함되지 않은 새 주소로 안전하게 이전

3. 공개 범위
사건과 판결문은 기본적으로 비공개입니다. 이용자가 사건 접수 화면의 공개 동의 항목을 직접 선택하거나 결과 화면에서 공개로 전환한 경우에만 닉네임, 사건 내용 및 AI 판결문이 공개 판결기록에 표시됩니다. 인증 UID와 이메일 주소는 공개 판결문 및 공개 댓글에 포함하지 않습니다. 신규 사건의 공개 주소 식별자에는 인증 UID를 포함하지 않습니다. 과거 주소가 이전된 경우 원문 주소는 저장하지 않고 일방향 해시 별칭을 통해 새 주소로 연결할 수 있습니다. 이용자는 결과 화면에서 다시 비공개로 전환할 수 있습니다.

4. 외부 서비스 및 국외 처리 가능성
서비스 운영을 위해 Google Firebase(Authentication, Firestore, Functions, Hosting)와 Google Gemini API를 사용합니다. AI 판결 생성 시 이용자가 입력한 사건 내용이 Gemini API로 전송될 수 있으며, Google의 서비스 운영 환경에서 처리될 수 있습니다. 각 서비스의 구체적인 처리 방식은 Google의 관련 약관과 개인정보처리방침을 따릅니다.

5. 보유 및 삭제
회원 정보, 사건 및 판결기록은 서비스 제공과 내 사건 관리를 위해 보관됩니다. 공개 여부는 이용자가 직접 변경할 수 있으며, 계정·사건·댓글 등 저장 정보의 열람 또는 삭제 요청은 사이트 하단의 운영자 연락처로 문의할 수 있습니다. 법령상 보존 의무나 분쟁 대응 필요가 있는 경우 해당 기간 동안 보관될 수 있습니다. 과거 사건 주소 이전용 해시 별칭은 이전된 판결의 연결 유지에 필요한 기간 동안 보관되며 사건 삭제 시 함께 삭제됩니다.

6. 안전조치
Firestore 보안 규칙, 서버 전용 쓰기, 이메일 인증, 요청 횟수 제한을 적용합니다. 사건·항소 이유·공개 댓글과 AI 생성 결과는 저장·AI 전송·공개 전 단계에서 개인정보와 고위험 표현 등을 자동 검사하며, 해당 내용은 접수 또는 공개가 제한될 수 있습니다. App Check가 활성화된 경우 비정상 클라이언트 요청을 확인하기 위해 reCAPTCHA 기반 토큰이 처리될 수 있습니다.

7. 이용자의 권리 및 문의
이용자는 자신의 사건 공개 여부를 변경할 수 있습니다. 개인정보 관련 열람·정정·삭제·처리정지 문의는 사이트 하단에 표시된 운영자 연락처로 접수할 수 있습니다.`,

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
본 서비스는 운영 설정에 따라 Google Gemini 계열 모델을 사용하며, 장애·한도 초과·안전검사 실패 시 로컬 대체 문서를 생성할 수 있습니다.

5. 데이터 처리
입력한 사건 내용은 판결 생성, 사건 및 결과 저장, 안전검사, 사용량·오류 관리에 사용됩니다. 사건과 판결문은 기본적으로 비공개이며 이용자가 명시적으로 공개를 선택한 경우에만 공개 판결기록에 표시됩니다. AI 생성이 필요한 경우 사건 내용이 Google Gemini API로 전송될 수 있습니다.`
};

function applyBiz(text, biz) {
  return String(text || '')
    .replace(/{companyName}/g, biz.companyName || '소소킹 판결소')
    .replace(/{ceoName}/g, biz.ceoName || '')
    .replace(/{businessNumber}/g, biz.businessNumber || '')
    .replace(/{contact}/g, biz.contact || '')
    .replace(/{email}/g, biz.email || '')
    .replace(/{address}/g, biz.address || '');
}

function bizInfoHtml(biz) {
  if (!biz || !Object.values(biz).some(Boolean)) return '';
  const rows = [
    biz.companyName && `상호: ${biz.companyName}`,
    biz.ceoName && `대표자: ${biz.ceoName}`,
    biz.businessNumber && `사업자등록번호: ${biz.businessNumber}`,
    biz.contact && `연락처: ${biz.contact}`,
    biz.email && `이메일: ${biz.email}`,
    biz.address && `주소: ${biz.address}`,
  ].filter(Boolean).map(escapeHtml);
  if (!rows.length) return '';
  return `
    <div style="margin-top:32px;padding:16px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;">
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">운영자 정보</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:2;">${rows.join('<br>')}</div>
    </div>`;
}

function isObsoleteManagedPolicy(type, saved) {
  if (!saved) return false;
  if (type === 'privacy') {
    return saved.includes('개인 식별 정보를 수집하지 않습니다')
      || (saved.includes('시행일: 2026년 7월 28일')
        && saved.includes('인증 UID와 이메일 주소는 공개 판결문 및 공개 댓글에 포함하지 않습니다.'));
  }
  if (type === 'ai_disclaimer') {
    return saved.includes('입력하신 사건 내용은 AI 판결 생성 목적으로만 사용되며');
  }
  return false;
}

export async function renderPolicy(container, type) {
  const safeType = Object.prototype.hasOwnProperty.call(TITLES, type) ? type : 'terms';
  container.innerHTML = `
    <div class="page-header">
      <a href="#/" class="back-btn">‹</a>
      <span class="logo">${escapeHtml(TITLES[safeType] || '정책')}</span>
    </div>
    <div class="container" style="padding:28px 20px 60px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  try {
    const [policySnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'policy_docs', safeType)),
      getDoc(doc(db, 'site_public', 'config')),
    ]);
    const biz = settingsSnap.exists() ? (settingsSnap.data().businessInfo || {}) : {};
    const saved = policySnap.exists() ? String(policySnap.data().content || '') : '';
    const raw = saved && !isObsoleteManagedPolicy(safeType, saved)
      ? saved
      : (DEFAULTS[safeType] || '아직 등록된 내용이 없습니다.');
    const content = applyBiz(raw, biz);
    container.querySelector('.container').innerHTML =
      `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;">${escapeHtml(content)}</div>${bizInfoHtml(biz)}`;
  } catch {
    const content = DEFAULTS[safeType] || '불러오지 못했습니다.';
    container.querySelector('.container').innerHTML =
      `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;">${escapeHtml(content)}</div>`;
  }
}
