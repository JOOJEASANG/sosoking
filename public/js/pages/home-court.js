import { renderHome as renderBaseHome } from './home.js?v=20260729-brand-policy-1';
// Cache lineage marker for the CSP regression check: ./home.js?v=20260729-script-csp-1
import { db } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { compactText, escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { loadSafePublicResults } from '../utils/public-results.js?v=20260730-public-records-2';

const BRAND_LOGO = '/logo.png?v=20260729-brand-unified-1';
const BRAND_LOGO_FALLBACK = '/icons/sosoking-192.png?v=20260729-brand-unified-1';
const HOME_PUBLIC_RECORD_LIMIT = 5;
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
            <div class="court-kicker">SOSOKING LIFE COURT</div>
            <div class="court-title">소소한 일상을 판결하는 생활법정</div>
            <div class="court-desc">내 사건은 AI 판사에게 맡기고, 오늘의 실제 판례는 직접 판결해보세요.</div>
          </div>
        </div>
        <div class="court-ledger">
          <div><strong data-home-daily-limit>설정 확인</strong><span>AI 사건 접수</span></div>
          <div><strong>7명</strong><span>판사 자동 배정</span></div>
          <div><strong>1판</strong><span>오늘의 재판</span></div>
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

  const feedElement = container.querySelector('#feed-container');
  const feedSection = feedElement?.closest('.container');
  const feedTitle = feedSection?.querySelector('div[style*="font-family"]');
  if (feedTitle) feedTitle.textContent = '최근 공개 판결 5건';
  const searchElement = container.querySelector('#feed-search');
  if (searchElement) searchElement.placeholder = '🔍 최근 5건에서 사건명 검색...';
}

async function applySubmissionLimit(container) {
  const heroDisclaimer = container.querySelector('.hero-disclaimer');
  const ledgerLimit = container.querySelector('[data-home-daily-limit]');

  try {
    const snapshot = await getDoc(doc(db, 'site_public', 'config'));
    if (!container.isConnected) return;
    const settings = snapshot.exists() ? snapshot.data() : {};
    const enabled = settings.dailyLimitEnabled === true;
    const limit = Math.max(1, Math.min(1000, Math.floor(Number(settings.dailyLimit) || 3)));

    if (heroDisclaimer) {
      heroDisclaimer.textContent = enabled
        ? `회원당 하루 ${limit}회 · 오락용 AI 판결 · 법적 효력 없음`
        : '현재 사건 접수 제한 없음 · 오락용 AI 판결 · 법적 효력 없음';
    }
    if (ledgerLimit) ledgerLimit.textContent = enabled ? `하루 ${limit}건` : '제한 없음';
  } catch (error) {
    console.warn('public submission limit load failed:', error?.code || error);
    if (heroDisclaimer) heroDisclaimer.textContent = '접수 한도는 운영 설정에 따라 적용 · 오락용 AI 판결 · 법적 효력 없음';
    if (ledgerLimit) ledgerLimit.textContent = '운영 설정';
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function publicSummary(record = {}) {
  return record.sentence || record.publicCaseDescription || record.verdict || '';
}

function publicFeedCard(caseId, record = {}) {
  const title = record.caseTitle || '제목 없음';
  const judgeType = record.judgeType || 'AI';
  const date = formatDate(record.createdAt);
  return `<a class="card example-card" data-public-result-link="true" href="#/result/${encodeURIComponent(caseId)}" style="display:block;padding:18px 20px;color:inherit;text-decoration:none;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div class="case-title" style="flex:1;">${escapeHtml(title)}</div>
      ${date ? `<div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(date)}</div>` : ''}
    </div>
    <div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.6;">${escapeHtml(compactText(publicSummary(record), 72))}</div>
    <div class="case-meta" style="margin-top:10px;justify-content:space-between;">
      <span>${JUDGE_ICON[judgeType] || '⚖️'} ${escapeHtml(judgeType)} 판사</span>
      <span style="color:var(--gold);font-size:12px;">판결문 바로 보기 →</span>
    </div>
  </a>`;
}

async function applySafePublicFeed(container) {
  const feedElement = container.querySelector('#feed-container');
  if (!feedElement) return;
  feedElement.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  try {
    const rows = await loadSafePublicResults(db, {
      maxRows: HOME_PUBLIC_RECORD_LIMIT,
      fallbackRows: 100
    });
    if (!container.isConnected) return;

    const renderRows = searchText => {
      const keyword = String(searchText || '').trim();
      const filtered = keyword
        ? rows.filter(([, record]) => String(record.caseTitle || '').includes(keyword))
        : rows;
      if (!rows.length) {
        feedElement.innerHTML = '<div style="text-align:center;padding:36px 0;color:var(--cream-dim);font-size:14px;">📭 아직 공개된 판결기록이 없습니다.</div>';
        return;
      }
      feedElement.innerHTML = filtered.length
        ? filtered.map(([caseId, record]) => publicFeedCard(caseId, record)).join('')
        : `<div style="text-align:center;padding:36px 0;color:var(--cream-dim);font-size:14px;">🔍 "${escapeHtml(keyword)}"에 대한 판결 사례가 없습니다</div>`;
    };

    renderRows('');
    const searchElement = container.querySelector('#feed-search');
    if (searchElement) {
      searchElement.replaceWith(searchElement.cloneNode(true));
      container.querySelector('#feed-search')?.addEventListener('input', event => renderRows(event.currentTarget.value));
    }
  } catch (error) {
    console.warn('safe public feed load failed:', error?.code || error);
    feedElement.innerHTML = `<div style="text-align:center;padding:36px 0;color:var(--cream-dim);font-size:14px;">판결기록을 불러오지 못했습니다.<br><button type="button" id="home-public-feed-retry" class="btn btn-secondary" style="margin-top:12px;">다시 불러오기</button></div>`;
    container.querySelector('#home-public-feed-retry')?.addEventListener('click', () => applySafePublicFeed(container));
  }
}

async function applyPublicStatistics(container) {
  const countElement = container.querySelector('#stat-count');
  const judgeElement = container.querySelector('#stat-judge');
  if (!countElement) return;

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
  await Promise.all([
    applySubmissionLimit(container),
    applyPublicStatistics(container),
    applySafePublicFeed(container)
  ]);
}