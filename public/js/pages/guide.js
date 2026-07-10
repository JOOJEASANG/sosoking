import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { policyDefault } from '../data/default-policy-docs.js?v=20260710-full-audit1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const STEPS = [
  ['01 · 사건 접수','일상의 사소한 억울함을 한두 문장으로 적습니다. 사건명은 자동 제안되며 직접 수정할 수 있습니다.'],
  ['02 · 초동수사','AI 수사관이 사건 속 물건, 행동, 시간과 사후 태도를 찾아 발생 경위를 복원합니다.'],
  ['03 · 생활증거 감식','젓가락 이동, 소파 틈, 읽음 표시, 대기시간 같은 정황을 증거물처럼 과도하게 분석합니다.'],
  ['04 · 원고·피고 주장','원고측 핵심 주장과 피고측 핵심 반박을 짧게 생성해 같은 사실을 서로 다르게 해석합니다.'],
  ['05 · 법정공방','검사와 변호인이 핵심 주장을 장엄한 변론으로 확대하고 재판부가 사건을 심리합니다.'],
  ['06 · 황당판결','긴급특보, 판단과 사건 맞춤형 황당 처분 3개가 하나의 판결 기록으로 완성됩니다.'],
];

const GOOD_CASES = [
  '친구가 마지막 만두를 먼저 먹고 단무지만 권한 사건',
  '동생이 리모컨 위치를 알면서도 20분 동안 알려주지 않은 사건',
  '단체방 메시지는 전부 읽었는데 아무도 답하지 않은 사건',
  '공용 충전기를 충전 완료 후에도 계속 점유한 사건',
  '“아무거나”라고 한 뒤 메뉴 후보를 모두 거절한 사건',
];

const BAD_CASES = [
  '실제 범죄, 폭력, 학교폭력, 가정폭력, 의료·정신건강·안전 문제',
  '실명, 연락처, 주소, 학교명, 회사명 등 본인 또는 제3자의 개인정보',
  '특정인을 공격하거나 공개적으로 망신주기 위한 내용',
  '제3자의 얼굴이나 개인정보가 포함된 사진',
];

const FAQ = [
  ['판결에 법적 효력이 있나요?','없습니다. 수사기록, 양측 주장과 판결은 모두 오락을 위해 생성된 AI 콘텐츠입니다.'],
  ['사건은 처음부터 공개되나요?','아닙니다. 사건과 판결은 기본 비공개이며 결과를 확인한 뒤 작성자가 공개로 전환할 수 있습니다.'],
  ['원고측과 피고측 주장을 직접 써야 하나요?','아닙니다. 사건 내용을 바탕으로 AI가 양측의 짧은 핵심 주장과 상세 변론을 자동으로 만듭니다.'],
  ['사진을 올려도 되나요?','선택적으로 올릴 수 있지만 개인정보, 얼굴, 주소, 차량번호 등이 포함된 이미지는 제출하지 마세요.'],
  ['마음에 들지 않는 사건을 지울 수 있나요?','내 사건에서 본인 사건과 판결을 삭제할 수 있습니다. 삭제 후 복구할 수 없습니다.'],
  ['실제 심각한 문제도 접수할 수 있나요?','아니요. 실제 범죄·폭력·의료·법률·안전 문제는 관련 전문가나 기관에 문의해야 합니다.'],
];

function isLegacyGuide(text = '') {
  const source = String(text);
  return source.includes('소소 형량') || source.includes('AI가 접수관, 수사관, 변호사, 판사를 혼자 다 합니다') || source.includes('2026년 7월 8일');
}

export async function renderGuide(container) {
  const fallback = policyDefault('guide');
  const snap = await getDoc(doc(db, 'policy_docs', 'guide')).catch(() => null);
  const remote = snap?.exists() ? snap.data() : {};
  const supplemental = remote.content && !isLegacyGuide(remote.content) && remote.content.trim() !== fallback.content.trim()
    ? String(remote.content).trim()
    : '';

  container.innerHTML = `
    <div>
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">이용안내</span></div>
      <main class="container" style="padding-top:22px;padding-bottom:90px;max-width:760px;">
        <section class="court-shell guide-hero">
          <div class="guide-kicker">FULL COURT EXPERIENCE GUIDE</div>
          <h1 class="guide-title">접수한 사건이 수사와 공방을 거쳐 판결이 되기까지</h1>
          <p class="guide-summary">소소킹은 판결문 한 장만 생성하는 서비스가 아닙니다. 사건의 경위를 수사하고, 원고와 피고의 논리를 만든 뒤, 법정공방과 최종 선고까지 한 편의 황당재판으로 구성합니다.</p>
          <a href="#/submit" class="btn btn-primary" style="margin-top:17px;">사건 접수하고 전체 과정 시작</a>
        </section>

        <section class="guide-flow">
          ${STEPS.map(([title,text]) => `<div class="guide-step"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`).join('')}
        </section>

        <section class="card guide-section">
          <h2>접수하기 좋은 사건</h2>
          <div class="guide-list">${GOOD_CASES.map(text => `<div>✅ ${escapeHtml(text)}</div>`).join('')}</div>
        </section>

        <section class="card guide-section">
          <h2>접수하면 안 되는 내용</h2>
          <div class="guide-list">${BAD_CASES.map(text => `<div>⛔ ${escapeHtml(text)}</div>`).join('')}</div>
        </section>

        <section class="card guide-section guide-faq">
          <h2>자주 묻는 질문</h2>
          ${FAQ.map(([question,answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}
        </section>

        ${supplemental ? `<section class="card guide-section"><h2>추가 운영 안내</h2><div class="policy-document" style="padding:0!important;box-shadow:none!important;border:0!important;background:transparent!important;">${escapeHtml(supplemental)}</div></section>` : ''}

        <div class="disclaimer" style="margin-top:16px;"><strong>중요</strong><br>소소킹 황당재판소는 실제 법원·수사기관·법률상담 서비스가 아닙니다. 생성 결과에는 법적 효력이 없으며 일상의 가벼운 사건만 오락 목적으로 이용해야 합니다.</div>
      </main>
    </div>`;
}
