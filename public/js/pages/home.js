import { db } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { compactText, escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { loadSafePublicResults } from '../utils/public-results.js?v=20260730-public-records-2';

const BRAND_LOGO = '/logo.png?v=20260729-brand-unified-1';
const HOME_PUBLIC_RECORD_LIMIT = 5;
const JUDGES = [
  { name: '꼰대형', icon: '🧓', desc: '기본·예의·사람 사는 도리로 끝까지 훈계' },
  { name: '냉혈형', icon: '🧊', desc: '서운함보다 시간·수량·결과를 차갑게 계산' },
  { name: '회피형', icon: '🏃', desc: '개입을 피하려다 더 이상한 최소 처분' },
  { name: '추궁형', icon: '🔎', desc: '말 한마디와 앞뒤 모순을 끝까지 추궁' },
  { name: '오버형', icon: '🚨', desc: '소소한 분쟁을 국가비상급 사건으로 격상' },
  { name: '드립형', icon: '🎭', desc: '정색한 문서 속에 사건 맞춤 드립과 콜백' },
  { name: '빙의형', icon: '🌀', desc: '게임·회사·음식 등 사건 세계관에 완전 몰입' }
];
const JUDGE_ICON = Object.fromEntries(JUDGES.map(judge => [judge.name, judge.icon]));
const TYPEWRITER_CASES = [
  '마지막 치킨 한 조각 무단 섭취 사건',
  '공용 리모컨 장기 잠적 사건',
  '카톡 읽고 답장 안 한 채 릴스 전송 사건',
  '에어컨 18도 독단 설정 사건',
  '충전기 빌려가서 침대 옆에 정착시킨 사건',
  '냉장고 마지막 푸딩 실종 사건'
];

let typewriterTimer = null;

function stopHomeTimers() {
  if (typewriterTimer !== null) {
    clearTimeout(typewriterTimer);
    typewriterTimer = null;
  }
}

function startTypewriter(container) {
  const target = container.querySelector('#tw-text');
  if (!target) return;
  stopHomeTimers();
  let caseIndex = 0;
  let charIndex = 0;
  let deleting = false;

  const tick = () => {
    if (!container.isConnected || !target.isConnected) {
      stopHomeTimers();
      return;
    }
    const text = TYPEWRITER_CASES[caseIndex];
    target.textContent = text.slice(0, charIndex);
    if (!deleting && charIndex < text.length) {
      charIndex += 1;
      typewriterTimer = setTimeout(tick, 55);
      return;
    }
    if (!deleting) {
      deleting = true;
      typewriterTimer = setTimeout(tick, 1500);
      return;
    }
    if (charIndex > 0) {
      charIndex -= 1;
      typewriterTimer = setTimeout(tick, 24);
      return;
    }
    deleting = false;
    caseIndex = (caseIndex + 1) % TYPEWRITER_CASES.length;
    typewriterTimer = setTimeout(tick, 320);
  };

  tick();
  window._pageCleanup = stopHomeTimers;
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
  const title = record.caseTitle || '생활분쟁 사건';
  const judgeType = record.judgeType || '소소킹 AI 재판부';
  const date = formatDate(record.createdAt);
  return `<a class="card example-card" data-public-result-link="true" href="#/result/${encodeURIComponent(caseId)}" style="display:block;padding:18px 20px;color:inherit;text-decoration:none;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div class="case-title" style="flex:1;">${escapeHtml(title)}</div>
      ${date ? `<div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(date)}</div>` : ''}
    </div>
    <div style="font-size:13px;color:var(--cream-dim);margin-top:7px;line-height:1.65;">${escapeHtml(compactText(publicSummary(record), 80) || '공개된 AI 판결 기록입니다.')}</div>
    <div class="case-meta" style="margin-top:10px;justify-content:space-between;gap:10px;">
      <span>${JUDGE_ICON[judgeType] || record.judgeIcon || '⚖️'} ${escapeHtml(judgeType)} 판사</span>
      <span style="color:var(--gold);font-size:12px;">판결문 보기 →</span>
    </div>
  </a>`;
}

async function loadPublicFeed(container) {
  const host = container.querySelector('#feed-container');
  if (!host) return;
  try {
    const rows = await loadSafePublicResults(db, { maxRows: HOME_PUBLIC_RECORD_LIMIT, fallbackRows: 100 });
    if (!container.isConnected || !host.isConnected) return;
    host.innerHTML = rows.length
      ? rows.map(([caseId, record]) => publicFeedCard(caseId, record)).join('')
      : '<div style="text-align:center;padding:34px 0;color:var(--cream-dim);font-size:14px;">📭 아직 공개된 판결기록이 없습니다.<br><a href="#/submit" style="display:inline-block;margin-top:10px;color:var(--gold);">첫 사건 접수하기 →</a></div>';
  } catch (error) {
    console.warn('home public feed load failed:', error?.code || error);
    host.innerHTML = '<div style="text-align:center;padding:34px 0;color:var(--cream-dim);font-size:14px;">판결기록을 불러오지 못했습니다.<br><button type="button" class="btn btn-secondary" id="home-feed-retry" style="margin-top:12px;">다시 불러오기</button></div>';
    host.querySelector('#home-feed-retry')?.addEventListener('click', () => loadPublicFeed(container));
  }
}

async function loadPublicSettings(container) {
  const disclaimer = container.querySelector('.hero-disclaimer');
  const ledger = container.querySelector('[data-home-daily-limit]');
  try {
    const snapshot = await getDoc(doc(db, 'site_public', 'config'));
    if (!container.isConnected) return;
    const settings = snapshot.exists() ? snapshot.data() : {};
    const enabled = settings.dailyLimitEnabled === true;
    const limit = Math.max(1, Math.min(1000, Math.floor(Number(settings.dailyLimit) || 3)));
    if (disclaimer) disclaimer.textContent = enabled
      ? `회원당 하루 ${limit}건 · 비공개 생성 · 법적 효력 없음`
      : '현재 사건 접수 제한 없음 · 비공개 생성 · 법적 효력 없음';
    if (ledger) ledger.textContent = enabled ? `하루 ${limit}건` : '제한 없음';
  } catch (error) {
    console.warn('home public settings load failed:', error?.code || error);
    if (disclaimer) disclaimer.textContent = '접수 한도는 운영 설정에 따라 적용 · 비공개 생성 · 법적 효력 없음';
    if (ledger) ledger.textContent = '운영 설정';
  }
}

async function loadPublicStatistics(container) {
  const count = container.querySelector('#stat-count');
  const judge = container.querySelector('#stat-judge');
  if (count) count.textContent = '—';
  if (judge) judge.textContent = '—';
  try {
    const snapshot = await getDoc(doc(db, 'site_public', 'statistics'));
    if (!snapshot.exists() || !container.isConnected) return;
    const data = snapshot.data();
    const completed = Number(data.completedCases);
    if (count && Number.isFinite(completed) && completed >= 0) count.textContent = `${completed.toLocaleString('ko-KR')}건`;
    const popularJudge = String(data.popularJudge || '').trim();
    if (judge && popularJudge) judge.textContent = `${JUDGE_ICON[popularJudge] || '⚖️'} ${popularJudge.replace('형', '')}`;
  } catch (error) {
    console.warn('home public statistics load failed:', error?.code || error);
  }
}

export async function renderHome(container) {
  stopHomeTimers();
  container.innerHTML = `
    <div style="padding-bottom:60px;">
      <section class="hero-section">
        <img src="${BRAND_LOGO}" alt="소소킹 로고" width="132" height="132" decoding="async" fetchpriority="high" style="width:132px;height:132px;margin:0 auto 14px;display:block;animation:wiggle 3.5s ease-in-out infinite;">
        <div class="hero-badge">⚖️ 사소한 일상을 과하게 진지하게 판결합니다</div>
        <h1 class="hero-h1">사소한 일도<br><span style="font-size:.58em;color:var(--gold);font-style:italic;">오늘은 판결감입니다.</span></h1>
        <p class="hero-sub">내 억울함은 AI 판사에게 맡기고,<br><strong>내 사건도 판결을 보기 전에 내가 먼저 찍어보세요.</strong><br><span style="font-size:11px;opacity:.62;">꼰대·냉혈·회피·추궁·오버·드립·빙의 중 누가 배정될지는 사건마다 달라집니다.</span></p>

        <div class="hero-tw">📌 현재 생활법정 심의중: <strong id="tw-text"></strong><span class="cursor-blink" style="color:var(--gold);">|</span></div>

        <a href="#/submit" class="hero-cta hero-cta-pulse">⚖️ 내 사건 접수하기</a>
        <div class="hero-disclaimer">운영 설정 확인 중 · 비공개 생성 · 법적 효력 없음</div>

        <div class="stats-row">
          <div class="stat-item"><div class="stat-num" id="stat-count">—</div><div class="stat-label">완료된 AI 판결</div></div>
          <div class="stat-item"><div class="stat-num" id="stat-judge">—</div><div class="stat-label">인기 판사</div></div>
          <div class="stat-item"><div class="stat-num">0%</div><div class="stat-label">법적 효력<br><span style="font-size:9px;opacity:.7;">오락 전용</span></div></div>
        </div>
      </section>

      <div class="container" id="court-entrance" style="margin-top:22px;">
        <div class="court-shell" style="padding:20px;">
          <div style="display:flex;gap:16px;align-items:center;">
            <div class="court-seal" aria-hidden="true">⚖️</div>
            <div style="flex:1;min-width:0;">
              <div class="court-kicker">SOSOKING LIFE COURT</div>
              <div class="court-title">비공개 접수 → 내 예상 판정 → AI 판결</div>
              <div class="court-desc">판결을 본 다음 맞춘 척하지 못하게, 작성자도 먼저 한 표를 정한 뒤 판결 봉인이 풀립니다.</div>
            </div>
          </div>
          <div class="court-ledger">
            <div><strong data-home-daily-limit>설정 확인</strong><span>사건 접수</span></div>
            <div><strong>7명</strong><span>AI 판사 자동 배정</span></div>
            <div><strong>1회</strong><span>내 예상 판정</span></div>
          </div>
        </div>
      </div>

      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🎲 담당 판사는 사건마다 자동 배정</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:800;margin-bottom:4px;">7명의 AI 판사</div>
        <div class="section-sub">같은 사건도 판사의 성격에 따라 관찰 방식과 웃음 포인트가 달라집니다.</div>
        <div class="judge-lineup">
          ${JUDGES.map(judge => `<a href="#/submit" class="judge-card" style="text-decoration:none;color:inherit;" aria-label="${escapeHtml(judge.name)} 판사 · ${escapeHtml(judge.desc)}">
            <div class="judge-card-icon">${judge.icon}</div>
            <div class="judge-card-name">${escapeHtml(judge.name)}</div>
            <div class="judge-card-desc">${escapeHtml(judge.desc)}</div>
          </a>`).join('')}
        </div>
      </div>

      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🔥 사용자가 직접 공개한 AI 생활판결</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:800;margin-bottom:4px;">최근 공개 판결 5건</div>
        <div class="section-sub">접수 원문은 작성자만 보고, 공개용 사건 기록과 AI 판결만 공개됩니다.</div>
        <div id="feed-container" style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
          <a href="#/jury" class="btn btn-primary" style="flex:1;min-width:150px;">🗳️ 민심소 블라인드 판정</a>
          <a href="#/board" class="btn btn-secondary" style="flex:1;min-width:150px;">🏆 명예의 전당</a>
        </div>
      </div>

      <div class="container" style="margin-top:44px;">
        <div class="court-shell" style="padding:16px;margin-bottom:18px;">
          <div class="court-kicker">COURT PROTOCOL</div>
          <div class="court-title" style="font-size:19px;">접수부터 판결 공개까지</div>
          <div class="court-desc">화면은 진지하게, 사건은 사소하게, 공개는 작성자가 직접 선택합니다.</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${[
            ['01','생활사건 접수 📝','실명·연락처·주소 같은 개인정보 없이 무슨 일이 있었는지만 적습니다.'],
            ['02','다섯 단계 AI 문서 작성 📑','사건접수·수사보고·원고측·피고측·재판부 판결 문서를 담당 판사 성격으로 생성합니다.'],
            ['03','내 예상 판정 🔒','판결을 보기 전에 원고 승·피고 승·쌍방 과실 중 하나를 최초 1회 선택합니다.'],
            ['04','AI 판결 봉인 해제 ⚖️','내 선택을 기록한 순간 AI 재판부의 판결을 열어 내 판단과 비교합니다.'],
            ['05','원하면 공개·민심소 참여 🌐','공개를 선택한 안전한 판결만 민심소·토론·명예의 전당·공개 링크에 나타납니다.']
          ].map(([num, title, desc]) => `<div class="how-step">
            <div class="how-step-num" style="min-width:40px;height:40px;font-size:13px;">${num}</div>
            <div><div style="font-weight:800;font-size:15px;margin-bottom:3px;">${escapeHtml(title)}</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.65;">${escapeHtml(desc)}</div></div>
          </div>`).join('')}
        </div>
      </div>

      <div class="container" style="margin-top:28px;text-align:center;">
        <a href="#/guide" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border:1px solid var(--border);border-radius:20px;font-size:13px;color:var(--cream-dim);text-decoration:none;">📖 이용 안내 · 자주 묻는 질문</a>
      </div>

      <div class="container" style="margin-top:20px;">
        <div class="disclaimer"><strong>⚠️ 오락 서비스 안내</strong><br>소소킹 판결소는 사소한 생활분쟁을 생성형 AI가 법정 문서처럼 과장해 만드는 오락 서비스입니다. 실제 사례·판례 서비스나 법률상담이 아니며 결과에는 법적 효력이 없습니다.</div>
      </div>

      <section class="cta-section" style="margin-top:48px;">
        <div style="font-size:48px;margin-bottom:12px;animation:wiggle 1.5s infinite;" aria-hidden="true">😤</div>
        <h2>참으면 억울함이 숙성됩니다</h2>
        <p>생활법정에 접수하고<br>판결을 보기 전 내 판단부터 남겨보세요.<br><span style="font-size:12px;opacity:.55;">실제 법적 문제는 실제 전문가에게.</span></p>
        <a href="#/submit" class="hero-cta hero-cta-pulse" style="font-size:16px;">⚖️ 지금 사건 접수하기</a>
      </section>
    </div>`;

  startTypewriter(container);
  await Promise.all([
    loadPublicSettings(container),
    loadPublicStatistics(container),
    loadPublicFeed(container)
  ]);
}
