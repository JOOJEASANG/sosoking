import { db } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

export const POLICY_EFFECTIVE_DATE = '2026년 8월 30일';

export const POLICY_TITLES = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
  ai_disclaimer: 'AI 서비스 안내'
};

export const DEFAULT_POLICIES = {
  terms: `소소킹 판결소 이용약관
시행일: ${POLICY_EFFECTIVE_DATE}

제1조 (목적)
본 약관은 소소킹 판결소(이하 “서비스”)가 제공하는 오락형 AI 생활판결, 공개 판결기록, 민심소 투표·토론, 명예의 전당 및 관련 기능의 이용 조건과 운영 원칙을 정합니다.

제2조 (서비스의 성격)
1. 서비스는 사소한 생활분쟁을 생성형 AI가 법정 문서 형식으로 재구성하는 오락 서비스입니다.
2. AI 판결, 민심 투표, 억울지수, 랭킹 및 댓글은 법률상담·법적 판단·실제 법원 판결이 아니며 법적 효력이 없습니다.
3. 실제 범죄·폭력·의료·정신건강·노동·계약 등 중요한 문제는 적절한 관계 기관이나 전문가에게 상담해야 합니다.

제3조 (계정과 이용 자격)
1. 사건 접수와 내 사건 관리는 Google 또는 이메일 기반 회원 로그인이 필요합니다.
2. 이메일 가입자는 서비스가 요구하는 이메일 인증을 완료해야 주요 기능을 이용할 수 있습니다.
3. 이용자는 본인의 계정을 안전하게 관리해야 하며 타인의 계정이나 인증정보를 무단으로 사용해서는 안 됩니다.

제4조 (사건 접수와 AI 판결)
1. 이용자는 본인이 직접 작성한 생활사건 내용을 접수할 수 있습니다.
2. 신규 사건은 비공개 상태로 시작하며, AI가 사건접수·수사보고·원고측 변론·피고측 변론·재판부 판결의 문서를 생성합니다.
3. AI 생성이 완료되어도 사건 작성자에게 최종 판결을 즉시 노출하지 않을 수 있습니다. 현재 서비스에서는 작성자가 원고 승·피고 승·쌍방 과실 중 최초 1회 예상 판정을 선택한 뒤 AI 판결의 봉인이 해제됩니다.
4. 작성자의 예상 판정은 AI 판결을 확인한 뒤 변경할 수 없으며, 공개 민심 투표 집계와 별도로 관리됩니다.
5. 접수 횟수와 재접수 대기시간은 서비스 화면에 표시된 현재 운영 설정을 따르며 운영 상황에 따라 조정되거나 해제될 수 있습니다.

제5조 (공개 판결기록)
1. 사건과 판결은 기본적으로 작성자에게만 보이는 비공개 상태입니다.
2. 작성자가 직접 공개를 선택한 경우에만 공개 판결기록으로 전환됩니다. 공개 전에는 개인정보·고위험 내용 등에 대한 안전검사가 수행될 수 있습니다.
3. 작성자가 처음 입력한 접수 원문은 작성자 본인에게만 공개하는 것을 원칙으로 합니다. 다른 이용자에게는 공개용 사건 정보, 공개용 닉네임, AI 생성 문서 등 공개에 필요한 정보만 제공됩니다.
4. 공개 판결은 민심소 투표·토론, 명예의 전당, 태그·공개 페이지 및 검색엔진 등에 노출될 수 있습니다.
5. 작성자는 제공되는 기능을 통해 공개 판결을 다시 비공개로 전환하거나 본인 사건을 삭제할 수 있습니다. 운영상·안전상 필요한 경우 운영자가 공개를 제한하거나 숨김·삭제할 수 있습니다.

제6조 (민심소 투표와 토론)
1. 민심소는 공개 사건의 AI 판결을 먼저 가린 상태에서 이용자가 원고 승·피고 승·쌍방 과실 등의 선택을 한 뒤 AI 판결과 전체 민심을 비교하는 오락 기능입니다.
2. 개별 이용자의 투표 선택은 공개 목록에 표시하지 않고 선택지별 집계 결과를 제공할 수 있습니다.
3. 공개 댓글·토론에는 이용자의 닉네임, 선택한 입장, 작성 내용 및 작성 시각 등이 표시될 수 있습니다.
4. 투표·댓글·신고 기능에는 스팸 방지와 안정적인 운영을 위한 횟수 제한 또는 대기시간이 적용될 수 있습니다.

제7조 (금지되는 이용)
이용자는 다음 내용을 입력·게시하거나 서비스를 다음 목적으로 이용해서는 안 됩니다.
1. 주민등록번호, 전화번호, 이메일, 상세 주소, 계좌번호 등 본인 또는 타인의 개인정보를 불필요하게 입력하는 행위
2. 실제 범죄·폭력·성폭력·자해·위기상황 등 오락 서비스로 다루기 부적절한 고위험 사건을 처리하려는 행위
3. 타인을 특정해 비방·모욕·협박하거나 신상을 추측·공개하는 행위
4. 불법·유해 콘텐츠, 서비스 방해, 자동화된 남용, 보안 우회 또는 시스템 지시 탈취를 시도하는 행위
5. 타인의 권리를 침해하거나 서비스의 정상적인 운영을 방해하는 행위

제8조 (신고·운영 조치)
1. 이용자는 공개 판결이나 댓글에서 개인정보 노출, 부적절한 표현, 권리 침해 등을 발견하면 신고 기능을 이용할 수 있습니다.
2. 운영자는 신고 내용과 서비스 정책을 검토하여 공개 제한, 숨김, 삭제, 이용 제한 등 필요한 조치를 할 수 있습니다.
3. 삭제 처리 중인 사건에는 새 투표·댓글·공개 전환 등이 제한될 수 있습니다.

제9조 (AI 결과와 서비스 제공의 한계)
1. 생성형 AI는 사실과 다른 내용, 과장, 모순 또는 부정확한 표현을 만들 수 있습니다.
2. 서비스는 오락성을 위해 가상의 정황·문서 표현·생활형 처분을 생성할 수 있으며 이를 실제 사실이나 법률정보로 간주해서는 안 됩니다.
3. 네트워크, 외부 AI 제공자, Firebase 등 제3자 인프라의 장애·점검·사용량 제한으로 기능이 일시 중단되거나 결과 생성이 실패할 수 있습니다.

제10조 (콘텐츠와 이용자의 책임)
1. 이용자는 본인이 입력하거나 공개하는 내용에 필요한 권리를 보유하고 있어야 합니다.
2. 이용자가 판결 공개를 선택하면 서비스는 해당 공개 콘텐츠를 서비스 화면, 공유 페이지, 검색 결과, 통계 및 랭킹 기능에 표시하기 위해 필요한 범위에서 이용할 수 있습니다.
3. 서비스의 로고, UI, 프로그램 코드 및 운영자가 직접 제작한 콘텐츠에 대한 권리는 각 권리자에게 귀속됩니다.

제11조 (이용 종료와 삭제)
1. 이용자는 제공되는 기능을 통해 본인 사건을 삭제할 수 있으며, 삭제 시 관련 판결·투표·댓글 등 연결된 기록도 함께 삭제될 수 있습니다.
2. 계정 삭제 또는 서비스 이용 종료와 관련한 데이터 처리는 개인정보처리방침과 실제 제공되는 삭제 기능에 따릅니다.
3. 법령상 보존 의무, 분쟁 대응 또는 시스템 백업 등 정당한 사유가 있는 경우 필요한 범위에서 일정 기간 보존될 수 있습니다.

제12조 (약관 변경 및 문의)
1. 서비스 기능, 운영 방식 또는 관련 정책이 변경되면 약관도 변경될 수 있으며 중요한 변경은 서비스 내 적절한 방법으로 안내합니다.
2. 서비스 관련 문의는 사이트 하단에 표시된 운영자 연락처를 이용할 수 있습니다.

운영자: {companyName}
대표자: {ceoName}
연락처: {contact}
이메일: {email}`,

  privacy: `소소킹 판결소 개인정보처리방침
시행일: ${POLICY_EFFECTIVE_DATE}

1. 처리하는 정보
서비스는 기능 제공 과정에서 다음 정보를 처리할 수 있습니다.
- 계정 정보: Firebase 사용자 식별자(UID), 로그인 제공자, 이메일 주소, 이메일 인증 여부, 표시 이름·프로필 이미지 등 인증 제공 정보
- 프로필 정보: 이용자가 설정한 닉네임과 프로필 이미지 정보
- 사건 정보: 이용자가 입력한 접수 원문, 사건 상태, 공개 여부, AI가 생성한 사건명·수사·변론·판결·항소 내용 등
- 본인 예상 판정: 작성자가 AI 판결을 보기 전에 선택한 원고 승·피고 승·쌍방 과실 중 최초 선택과 처리 시각
- 참여 정보: 민심소 투표, 반응, 공개 댓글·토론 내용, 신고 내용과 처리 상태
- 운영 정보: 요청 횟수, 사용량·오류·보안 이벤트, 접수·AI 요청 제한을 위한 카운터와 시각, App Check 검증정보 등 서비스 운영에 필요한 기술정보

2. 처리 목적
위 정보는 다음 목적으로 이용합니다.
- 회원 인증, 닉네임·프로필 및 내 사건 관리
- 사건 접수, AI 문서 생성, 본인 예상 판정 후 판결 공개, 항소 등 핵심 기능 제공
- 이용자가 선택한 공개 범위에 따른 공개 판결·민심 투표·댓글·랭킹 제공
- 신고 처리, 개인정보·고위험 콘텐츠 차단, 스팸·남용·부정 이용 방지
- 오류 분석, 사용량·비용 관리, 서비스 안정성·보안 유지

3. 수집 방법
- 이용자가 회원가입·로그인·프로필 설정·사건 접수·투표·댓글·신고 등을 통해 직접 제공
- 서비스 이용 과정에서 Firebase 및 서버 기능을 통해 자동 생성·기록
- 생성형 AI가 이용자 입력을 바탕으로 결과 문서를 생성하는 과정에서 파생

4. 공개되는 정보와 비공개 정보
- 신규 사건과 접수 원문은 기본적으로 비공개입니다.
- 작성자가 처음 입력한 접수 원문은 작성자 본인에게만 제공하는 것을 원칙으로 합니다.
- 작성자가 판결 공개를 선택하면 안전검사를 통과한 공개용 사건 정보, 공개용 닉네임, AI 생성 판결, 공개 댓글, 투표 집계 등이 다른 이용자 또는 검색엔진에 노출될 수 있습니다.
- 작성자의 본인 예상 판정은 공개 민심 집계와 별도로 관리하며 공개 민심 비율에 포함하지 않습니다.
- 개별 민심소 투표자의 선택은 공개 목록에 표시하지 않지만 집계 통계에는 반영됩니다.

5. 생성형 AI 및 외부 서비스 이용
- AI 판결 생성에는 Google Gemini API가 사용될 수 있으며, 사건 내용은 결과 생성을 위해 필요한 범위에서 AI 제공자에게 전송될 수 있습니다.
- 회원 인증, 데이터베이스, 서버 기능, 호스팅 등에는 Google Firebase·Google Cloud 기반 서비스가 사용됩니다.
- 외부 제공자의 데이터 처리 방식과 보안·보존 정책은 해당 제공자의 정책 및 서비스 설정의 영향을 받을 수 있습니다.

6. 보유 및 삭제
- 계정·프로필 정보는 회원 기능 제공에 필요한 기간 동안 처리되며 계정 삭제 또는 운영상 삭제 절차에 따라 정리됩니다.
- 사건·판결·투표·댓글 등의 기록은 이용자가 사건을 삭제하거나 운영 정책에 따라 제거될 때까지 보관될 수 있습니다.
- 신고·보안·사용량·오류 기록은 서비스 보호와 분쟁 대응 등 필요한 목적을 달성하는 범위에서 보관 후 정리합니다.
- 즉시 삭제가 어려운 백업·로그 또는 법령상 보존 의무가 있는 정보는 해당 목적과 기간 동안 제한적으로 보관될 수 있습니다.

7. 이용자의 선택과 권리
- 이용자는 본인 프로필과 사건을 확인하고 제공되는 기능 범위에서 공개 상태를 변경하거나 사건을 삭제할 수 있습니다.
- 공개 전에는 개인정보가 포함되지 않았는지 직접 확인해야 하며, 공개 후에도 다시 비공개로 전환할 수 있습니다.
- 개인정보와 관련한 문의·정정·삭제 요청은 사이트 하단의 운영자 연락처를 통해 문의할 수 있습니다.

8. 안전조치
서비스는 Firestore 접근 규칙, 서버 측 권한 확인, 입력 안전검사, 요청 횟수 제한, 신고·관리자 기능 등 합리적인 보호조치를 적용합니다. 다만 인터넷 서비스의 특성상 절대적인 보안을 보장할 수는 없습니다.

9. 방침 변경
서비스 기능이나 처리 방식이 달라질 경우 본 방침이 변경될 수 있으며 중요한 변경은 서비스 내 적절한 방법으로 안내합니다.

개인정보 관련 문의
운영자: {companyName}
대표자: {ceoName}
연락처: {contact}
이메일: {email}
주소: {address}`,

  ai_disclaimer: `소소킹 판결소 AI 서비스 안내
시행일: ${POLICY_EFFECTIVE_DATE}

1. AI가 만드는 오락 콘텐츠
소소킹의 사건접수·수사보고·원고측 변론·피고측 변론·판결·항소 문서는 생성형 AI가 만든 오락 콘텐츠입니다. 실제 법원 문서, 판례, 수사 기록 또는 전문가 의견이 아닙니다.

2. 법적 효력이 없습니다
AI 판결, 생활형 처분, 억울지수, 민심소 투표와 랭킹은 어떠한 법적 효력도 없으며 실제 권리·의무, 손해배상, 계약, 신고 또는 소송 여부를 판단하는 근거로 사용해서는 안 됩니다.

3. AI는 틀릴 수 있습니다
생성형 AI는 사실과 다른 정황, 모순, 과장, 잘못된 용어 또는 존재하지 않는 규칙을 만들 수 있습니다. 서비스는 장르 특성상 일상 소재를 과장하거나 가상의 정황과 생활형 처분을 덧붙일 수 있습니다.

4. 본인 사건의 블라인드 판정
작성자의 사건도 AI 판결을 먼저 보여주지 않고 사건 기록과 양측 주장을 읽은 뒤 원고 승·피고 승·쌍방 과실 중 하나를 최초 1회 선택하도록 할 수 있습니다. 이 선택은 AI 판결을 본 뒤 바꿀 수 없으며 공개 민심 투표와 별도로 저장됩니다.

5. 공개 판결과 민심소
작성자가 공개를 선택한 사건은 개인정보·고위험 내용 안전검사를 거친 뒤 공개 판결기록, 민심소, 명예의 전당, 공개 공유 페이지 등에 표시될 수 있습니다. 다른 이용자는 AI 판결을 가린 채 먼저 판단한 뒤 AI 결과와 민심 집계를 비교할 수 있습니다.

6. 개인정보를 입력하지 마세요
실명, 연락처, 주민등록번호, 상세 주소, 이메일, 계좌번호 등 본인이나 타인을 식별할 수 있는 개인정보를 사건·댓글에 입력하지 마세요. 작성자가 처음 입력한 접수 원문은 작성자 본인에게만 제공하는 것을 원칙으로 합니다.

7. 심각한 사건은 다루지 않습니다
실제 범죄·폭력·성폭력·가정폭력·학교폭력·스토킹·자해·의료·정신건강 등 긴급하거나 중대한 문제는 오락형 AI 판결 대상이 아닙니다. 필요한 경우 즉시 적절한 관계 기관이나 전문가에게 도움을 요청하세요.

8. 신고와 수정
공개 판결이나 댓글에서 개인정보 노출, 권리 침해, 명백한 오류 또는 부적절한 표현을 발견하면 서비스의 신고 기능이나 사이트 하단 운영자 연락처를 이용해 알려주세요. 운영 정책에 따라 숨김·삭제 등 조치가 이루어질 수 있습니다.`
};

const OBSOLETE_SIGNATURES = {
  terms: ['오늘의 재판', '실제 판례 맞히기', '회원당 하루 1회'],
  privacy: ['오늘의 재판 판결 제출', '실제 판례', '일간·주간·누적 랭킹'],
  ai_disclaimer: ['실제 판례 맞히기', '오늘의 실제 판례', '매일 실제 법원 판례']
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
    ['상호', biz.companyName],
    ['대표자', biz.ceoName],
    ['사업자등록번호', biz.businessNumber],
    ['연락처', biz.contact],
    ['이메일', biz.email],
    ['주소', biz.address]
  ].filter(([, value]) => value);
  if (!rows.length) return '';
  return `<div class="card" style="margin-top:24px;padding:16px 18px;font-size:12px;line-height:1.8;color:var(--cream-dim);">
    <strong style="display:block;margin-bottom:5px;color:var(--gold);">운영자 정보</strong>
    ${rows.map(([label, value]) => `${escapeHtml(label)}: ${escapeHtml(String(value))}`).join('<br>')}
  </div>`;
}

function isObsoleteManagedPolicy(type, saved) {
  const text = String(saved || '');
  return (OBSOLETE_SIGNATURES[type] || []).some(signature => text.includes(signature));
}

export function defaultPolicyText(type, businessInfo = {}) {
  const safeType = Object.prototype.hasOwnProperty.call(POLICY_TITLES, type) ? type : 'terms';
  return applyBiz(DEFAULT_POLICIES[safeType] || '', businessInfo);
}

export async function renderPolicy(container, type) {
  const safeType = Object.prototype.hasOwnProperty.call(POLICY_TITLES, type) ? type : 'terms';
  container.innerHTML = `
    <div class="page-header">
      <a href="#/" class="back-btn" aria-label="홈으로 돌아가기">‹</a>
      <span class="logo">${escapeHtml(POLICY_TITLES[safeType])}</span>
    </div>
    <div class="container" style="padding-top:28px;padding-bottom:90px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  const contentHost = container.querySelector('.container');
  if (!contentHost) return;

  try {
    const [policySnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'policy_docs', safeType)),
      getDoc(doc(db, 'site_public', 'config'))
    ]);
    const businessInfo = settingsSnap.exists() ? (settingsSnap.data().businessInfo || {}) : {};
    const saved = policySnap.exists() ? String(policySnap.data().content || '').trim() : '';
    const raw = saved && !isObsoleteManagedPolicy(safeType, saved)
      ? saved
      : DEFAULT_POLICIES[safeType];
    const content = applyBiz(raw, businessInfo);
    contentHost.innerHTML = `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(content)}</div>${bizInfoHtml(businessInfo)}`;
  } catch (error) {
    console.warn('policy load failed:', error?.code || error);
    contentHost.innerHTML = `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(DEFAULT_POLICIES[safeType])}</div>`;
  }
}
