import { renderHome as renderBaseHome } from './home.js?v=20260729-script-csp-1';
import { db } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const BRAND_LOGO = '/logo.svg?v=20260729-logo-feed-1';
const BRAND_LOGO_FALLBACK = '/icons/sosoking-192.png?v=20260729-logo-feed-1';
const JUDGE_ICON = {
  '엄벌주의형': '👨‍⚖️',
  '감성형': '🥹',
  '현실주의형': '🤦',
  '과몰입형': '🔥',
  '피곤형': '😴',
  '논리집착형': '🧮',
  '드립형': '🎭'
};

function applyBrandLogo(container) {
  const logo = container.querySelector('.hero-section > img[alt="소소킹 로고"]');
  if (!logo) return;
  logo.src = BRAND_LOGO;
  logo.width = 200;
  logo.height = 200;
  logo.decoding = 'async';
  logo.fetchPriority = 'high';
  logo.style.visibility = 'visible';
  logo.onerror = () => {
    if (logo.src.includes('sosoking-192.png')) return;
    logo.src = BRAND_LOGO_FALLBACK;
  };
}

function addCourtEntrance(container) {
  const hero = container.querySelector('.hero-section');
  if (!hero || document.getElementById('court-entrance')) return;
  hero.insertAdjacentHTML('afterend', `
    <div class="container" id="court-entrance" style="margin-top:22px;">
      <div class="court-shell" style="padding:20px;">
        <div style="display:flex;gap:16px;align-items:center;">
          <div class="court-seal" aria-hidden="true">⚖️</div>
          <div style="flex:1;min-width:0;">
            <div class="court-kicker">SOSOKING ELECTRONIC COURT</div>
            <div class="court-title">생활분쟁 전자법정 개정 중</div>
            <div class="court-desc">라면, 충전기, 읽씹, 마지막 만두까지 제3생활부가 과하게 엄숙하게 심리합니다.</div>
          </div>
        </div>
        <div class="court-ledger">
          <div><strong>제3생활부</strong><span>사소함 전담</span></div>
          <div><strong>7명</strong><span>판사 자동 배정</span></div>
          <div><strong>0%</strong><span>법적 효력</span></div>
        </div>
      </div>
    </div>`);
}

function addProcedureSeal(container) {
  const target = Array.from(container.querySelectorAll('.container')).find(element => element.textContent.includes('재판 진행 순서'));
  if (!target || document.getElementById('court-procedure-note')) return;
  target.insertAdjacentHTML('afterbegin', `
    <div id="court-procedure-note" class="court-shell" style="padding:16px;margin-bottom:18px;">
      <div class="court-kicker">COURT PROTOCOL</div>
      <div class="court-title" style="font-size:19px;">내용 입력 → 사건명·판사 자동 배정 → 다섯 문서 작성</div>
      <div class="court-desc">화면은 진지하게, 사건은 사소하게. 입력은 한 칸만 받습니다.</div>
    </div>`);
}

function stepTextParts(step) {
  const textBox = step?.querySelector(':scope > div:nth-child(2)');
  return { title: textBox?.children?.[0] || null, description: textBox?.children?.[1] || null };
}

function fixLegacyHomeCopy(container) {
  const procedure = Array.from(container.querySelectorAll('.how-step'));
  if (procedure[0]) {
    const { title, description } = stepTextParts(procedure[0]);
    if (title) title.textContent = '사건 내용 접수 📝';
    if (description) description.textContent = '무슨 일이 있었는지 적으면 AI가 알아보기 쉬운 사건명을 자동으로 정합니다.';
  }
  if (procedure[3]) {
    const { description } = stepTextParts(procedure[3]);
    if (description) description.textContent = '자동 배정된 판사 성향이 반영된 문서형 판결과 생활형 처분이 내려집니다.';
  }
  container.querySelectorAll('.judge-card').forEach(card => {
    if (card.matches('a,button')) return;
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        location.hash = '#/submit';
      }
    });
  });
}

async function applyPublicStatistics(container) {
  const countElement = container.querySelector('#stat-count');
  const judgeElement = container.querySelector('#stat-judge');
  if (!countElement) return;

  // 기존 home.js의 권한 없는 cases 집계와 847 가상 애니메이션이 이 요소를 찾지 못하게 한다.
  countElement.id = 'public-stat-count';
  countElement.textContent = '—';
  if (judgeElement) judgeElement.textContent = '—';

  try {
    const snapshot = await getDoc(doc(db, 'site_public', 'statistics'));
    if (!snapshot.exists() || !container.isConnected) return;
    const data = snapshot.data();
    const completedCases = Number(data.completedCases);
    if (Number.isFinite(completedCases) && completedCases >= 0) {
      countElement.textContent = `${completedCases.toLocaleString('ko-KR')}건`;
    }

    const popularJudge = String(data.popularJudge || '').trim();
    if (judgeElement && popularJudge) {
      judgeElement.textContent = `${JUDGE_ICON[popularJudge] || '⚖️'} ${popularJudge.replace('형', '')}`;
    }
  } catch (error) {
    console.warn('public statistics load failed:', error?.code || error);
  }
}

export async function renderHome(container) {
  await renderBaseHome(container);
  applyBrandLogo(container);
  addCourtEntrance(container);
  addProcedureSeal(container);
  fixLegacyHomeCopy(container);
  await applyPublicStatistics(container);
}
