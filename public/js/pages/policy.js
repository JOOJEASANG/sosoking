import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const TITLES = { terms: '이용약관', privacy: '개인정보처리방침', ai_disclaimer: 'AI 서비스 안내' };

const DEFAULTS = {
  terms: `소소킹 생활법정 이용약관

시행일: 2025년 1월 1일

제1조 (목적)
본 약관은 {companyName}(이하 "운영자")가 운영하는 소소킹 생활법정(sosoking.co.kr, 이하 "서비스")의 이용 조건 및 절차를 규정하는 것을 목적으로 합니다.

제2조 (서비스의 성격)
① 소소킹 생활법정은 일상의 소소한 갈등을 주제로 친구와 토론하고 AI 판사에게 재미있는 판결을 받아보는 순수 오락·엔터테인먼트 서비스입니다.
② 서비스 내 모든 판결은 법적 효력이 없으며, 실제 법률 판단이나 법적 자문을 대체하지 않습니다.

제3조 (서비스 이용)
① 본 서비스는 별도의 회원가입 없이 익명으로 이용할 수 있습니다.
② 이용자는 하루 최대 10회 판결 요청 및 5회 주제 등록이 가능합니다.
③ 서비스 이용에는 인터넷 연결이 필요하며, 일부 기능은 최신 브라우저 환경을 요구합니다.

제4조 (금지행위)
이용자는 다음 행위를 하여서는 안 됩니다.
1. 특정 실존 인물의 명예를 훼손하거나 허위 사실을 적시하는 행위
2. 개인정보(실명, 연락처, 주소 등)를 포함한 내용 입력
3. 음란·폭력·혐오 표현 등 불법적이거나 유해한 내용 입력
4. 서비스 시스템에 부하를 주거나 정상적인 운영을 방해하는 행위
5. 영리 목적의 광고·홍보 내용 입력
6. 그 밖에 관련 법령 또는 운영자의 정책에 위반되는 행위

제5조 (콘텐츠 관리)
① 운영자는 제4조를 위반한 콘텐츠를 사전 고지 없이 삭제할 수 있습니다.
② 이용자가 등록한 주제 및 사건 내용은 서비스 품질 개선 목적으로 활용될 수 있습니다.
③ 이용자는 불건전한 콘텐츠를 신고할 수 있으며, 운영자는 이를 검토 후 조치합니다.

제6조 (서비스 변경·중단)
운영자는 서비스의 내용·기능을 변경하거나, 운영상·기술상 필요에 따라 서비스를 일시 중단 또는 종료할 수 있습니다. 이 경우 가능한 범위 내에서 사전 안내합니다.

제7조 (면책)
① 운영자는 AI가 생성한 판결 내용의 정확성·완전성에 대해 보증하지 않습니다.
② 서비스 이용 중 발생한 이용자 간의 분쟁에 대해 운영자는 개입하지 않으며 책임을 지지 않습니다.
③ 운영자의 귀책사유 없이 발생한 서비스 장애·데이터 손실에 대해 책임을 지지 않습니다.

제8조 (준거법 및 관할)
본 약관은 대한민국 법률에 따라 해석·적용되며, 분쟁 발생 시 운영자 소재지 관할 법원을 제1심 법원으로 합니다.`,

  privacy: `소소킹 생활법정 개인정보처리방침

시행일: 2025년 1월 1일
최종 수정일: 2025년 6월 1일

{companyName}(이하 "운영자")는 이용자의 개인정보를 소중히 여기며, 「개인정보 보호법」 등 관련 법령을 준수합니다.

제1조 (수집하는 정보)
본 서비스는 회원가입 없이 이용할 수 있으며, 이름·이메일·전화번호 등 개인 식별 정보를 수집하지 않습니다.
서비스 이용 과정에서 아래 정보가 자동 생성·저장될 수 있습니다.

· 익명 사용자 식별자 (Firebase 익명 인증 UID, 기기를 특정할 수 없음)
· 이용자가 직접 입력한 사건 제목·내용·주제 등록 내용·의견
· 서비스 이용 기록 (판결 요청 횟수, 접속 시간 등 집계 통계)
· 기기 및 브라우저 정보 (서비스 오류 분석 목적)

제2조 (정보의 이용 목적)
수집된 정보는 다음 목적으로만 사용됩니다.

· AI 판결 생성 및 서비스 핵심 기능 제공
· 악용·어뷰징 방지 및 이용 한도 관리
· 서비스 품질 개선 및 오류 분석
· 이용자 의견 수렴 및 반영

제3조 (제3자 제공)
수집된 정보는 원칙적으로 제3자에게 제공되지 않습니다.
다만, AI 판결 생성을 위해 이용자가 입력한 사건 내용이 Google LLC의 Gemini API로 전송됩니다. Google의 개인정보처리방침은 https://policies.google.com/privacy 에서 확인하실 수 있습니다.

제4조 (보유 및 파기)
서비스 운영 기간 동안 보관하며, 이용자 요청 또는 운영자 판단에 따라 삭제됩니다. 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.

제5조 (이용자의 권리)
이용자는 언제든지 아래 권리를 행사할 수 있습니다.

· 본인이 입력한 사건 내용의 삭제 요청
· 서비스 이용 내역 확인 요청

요청은 아래 연락처를 통해 접수하며, 운영자는 10영업일 이내에 처리합니다.

제6조 (쿠키 및 유사 기술)
본 서비스는 테마 설정, 이용 한도 관리 등을 위해 브라우저 로컬스토리지를 사용합니다. 별도의 광고 추적 쿠키는 사용하지 않습니다.

제7조 (보안)
Firebase(Google Cloud) 인프라를 통해 데이터를 암호화·저장하며, 접근 권한을 최소화하여 관리합니다.

제8조 (개인정보 보호책임자)
개인정보 관련 문의 및 삭제 요청은 아래 연락처로 주시기 바랍니다.
${'{email}' ? '이메일: {email}' : ''}
운영자는 신속하게 검토하여 처리하겠습니다.`,

  ai_disclaimer: `소소킹 생활법정 AI 서비스 안내

─────────────────────────────
⚠️  이 서비스는 순수 오락 목적입니다.
AI 판결은 어떠한 법적 효력도 없습니다.
─────────────────────────────

1. 서비스 성격

소소킹 생활법정은 일상의 사소한 갈등을 소재로 친구와 토론하고, AI 판사에게 재미있는 판결을 받아보는 엔터테인먼트 서비스입니다.

실제 법원 판결, 법률 자문, 분쟁 조정 서비스가 아닙니다. 판결 결과를 실제 생활의 법적 근거로 사용하지 마세요.


2. 사용 AI 모델

본 서비스는 Google의 Gemini 2.5 Flash 모델을 사용합니다. AI는 입력된 사건 내용을 바탕으로 오락용 판결문을 생성하며, 법률 전문 지식을 기반으로 하지 않습니다.


3. AI 판결의 한계

· AI의 판단은 맥락 이해가 제한적이며 부정확하거나 편향될 수 있습니다.
· 동일한 사건이라도 매번 다른 결과가 나올 수 있습니다.
· AI는 유머·과장·극적 표현을 포함한 오락용 콘텐츠를 생성합니다.
· 생성된 내용에 사실과 다른 표현이 포함될 수 있습니다.


4. 주의사항

· 실제 법적 문제는 반드시 변호사 등 전문 법률가에게 상담받으세요.
· 판결 결과를 타인에게 공유할 때는 오락 목적 서비스임을 명시해주세요.
· 특정인을 비방하거나 명예를 훼손하는 목적으로 사용하지 마세요.
· 민감한 개인정보나 실제 분쟁 중인 내용은 입력하지 마세요.


5. 입력 데이터 처리

이용자가 입력한 사건 내용은 AI 판결 생성 목적으로 Google Gemini API에 전송됩니다. 처리 후 내용은 Google의 데이터 정책에 따라 관리됩니다.
자세한 내용: https://policies.google.com/privacy


6. 책임 제한

운영자는 AI가 생성한 판결 내용의 정확성을 보증하지 않으며, 판결 결과를 실생활에 적용함으로써 발생하는 어떠한 결과에 대해서도 책임을 지지 않습니다.`
};

function applyBiz(text, biz) {
  return text
    .replace(/{companyName}/g, biz.companyName || '소소킹 판결소')
    .replace(/{ceoName}/g, biz.ceoName || '')
    .replace(/{businessNumber}/g, biz.businessNumber || '')
    .replace(/{contact}/g, biz.contact || '')
    .replace(/이메일: {email}\n/g, biz.email ? `이메일: ${biz.email}\n` : '')
    .replace(/{email}/g, biz.email || '운영자 연락처를 통해 문의해주세요.')
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
  ].filter(Boolean);
  if (!rows.length) return '';
  return `
    <div style="margin-top:32px;padding:16px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;">
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">운영자 정보</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:2;">${rows.join('<br>')}</div>
    </div>`;
}

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
    const [policySnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'policy_docs', type)),
      getDoc(doc(db, 'site_settings', 'config')),
    ]);
    const biz = settingsSnap.exists() ? (settingsSnap.data().businessInfo || {}) : {};
    const raw = policySnap.exists() && policySnap.data().content
      ? policySnap.data().content
      : (DEFAULTS[type] || '아직 등록된 내용이 없습니다.');
    const content = applyBiz(raw, biz);
    container.querySelector('.container').innerHTML =
      `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;">${content}</div>${bizInfoHtml(biz)}`;
  } catch {
    const content = DEFAULTS[type] || '불러오지 못했습니다.';
    container.querySelector('.container').innerHTML =
      `<div style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;">${content}</div>`;
  }
}
