import { db } from '../firebase.js?v=20260630-3';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const EXAMPLES = [
  { title: '마지막 만두 긴급 실종 사건', sentence: '원고는 최후 한입 기대권 침해를 주장하고, 피고는 젓가락 선착순 원칙을 항변했다.', judgeType: '과몰입형' },
  { title: '거실 리모컨 위치 미보고 사건', sentence: '가정평온수사대가 소파 틈을 통제구역으로 지정하고 20분의 수색 피해를 산정했다.', judgeType: '논리집착형' },
  { title: '점심 메뉴 결정 회피 사건', sentence: '원고와 피고의 주장을 들은 재판부가 메뉴 후보 3개 선제 제출 의무를 선고했다.', judgeType: '피곤형' }
];
const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'😢','현실주의형':'🤦','과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};
const JUDGES = [
  { name: '엄벌주의형', icon: '👨‍⚖️', desc: '사소함도 중대사안' },
  { name: '감성형', icon: '😢', desc: '서운함까지 현장 감식' },
  { name: '현실주의형', icon: '🤦', desc: '차갑고 실행 가능한 처분' },
  { name: '과몰입형', icon: '🔥', desc: '황당사건 재난특보화' },
  { name: '피곤형', icon: '😴', desc: '야간근무에 지친 판결' },
  { name: '논리집착형', icon: '🧮', desc: '0.1초와 한 입까지 계산' },
  { name: '드립형', icon: '🎭', desc: '정색한 말투로 웃김' }
];
const TW_CASES = [
  '마지막 만두 선점 사건', '리모컨 소파 틈 은닉 사건', '단체방 읽음 후 무응답 사건',
  '냉장고 음료 무단 시음 사건', '택배 대신 수령 후 방치 사건', '공용 우산 반납 지연 사건',
  '회의 시간 5분 지각 반복 사건', '프린터 마지막 용지 미보충 사건', '아무거나라고 한 뒤 메뉴 반박 사건'
];

let typewriterTimer = null;
let publicResults = [];

function resultTitle(result = {}) {
  return result.headline || result.judgment?.headline || result.absurdityTitle || result.caseTitle || result.title || '제목 없음';
}

function resultPreview(result = {}) {
  return result.judgment?.breakingNews
    || result.judgment?.summary
    || result.judgment?.plaintiffClaim
    || result.judgment?.closingComment
    || result.closingComment
    || result.sentence
    || result.verdict
    || result.courtOpinion
    || result.desc
    || '';
}

function resultSearchText(result = {}) {
  return [
    resultTitle(result), result.caseDescription,
    result.judgment?.breakingNews, result.judgment?.emergencyBriefing, result.judgment?.impactAssessment,
    result.judgment?.summary, result.judgment?.facts, result.judgment?.investigation,
    result.judgment?.plaintiffClaim, result.judgment?.defendantClaim,
    result.judgment?.prosecution, result.judgment?.defense, result.judgment?.opinion,
    result.judgment?.closingComment, result.closingComment, result.sentence, result.verdict, result.courtOpinion,
  ].filter(Boolean).join(' ').toLowerCase();
}

const PROCESS_STEPS = [
  ['01','사건 접수 📝','짧은 사건 내용과 억울함을 적으면 사건번호가 발급됩니다.'],
  ['02','초동수사 착수 🚓','AI 수사관이 시간·물건·행동과 사건 뒤 태도를 지나치게 자세히 복원합니다.'],
  ['03','생활증거 감식 🔍','리모컨, 젓가락, 읽음 표시 같은 사소한 정황을 증거물로 지정합니다.'],
  ['04','원고·피고 주장 ⚔️','원고측 핵심 주장과 피고측 반박을 짧게 만들고 서로 맞붙입니다.'],
  ['05','재판부 과몰입 심리 🏛️','검사와 변호인이 긴 변론을 펼치고 재판부가 생활질서 붕괴 여부를 심리합니다.'],
  ['06','황당판결 선고 🔨','긴급특보, 판단, 사건 맞춤형 황당 처분 3개가 하나의 판결 기록으로 완성됩니다.'],
];

export async function renderHome(container) {
  if (typewriterTimer !== null) {
    clearTimeout(typewriterTimer);
    typewriterTimer = null;
  }

  container.innerHTML = `
    <div style="padding-bottom:60px;">
      <section class="hero-section home-hero-light-safe">
        <div class="home-logo-frame"><img class="home-logo-banner" src="/site-logo-banner.png?v=20260707-logo2" alt="소소킹 황당재판소 로고"></div>
        <div class="hero-badge">⚖️ 접수부터 수사·공방·판결까지 · 법적효력 0%</div>
        <h1 class="hero-h1">사소한 사건을<br><span style="font-size:.52em;font-style:italic;">끝까지 크게 키우는 황당재판</span></h1>
        <p class="hero-sub">그냥 넘기기엔 찝찝하고, 진짜 따지기엔 너무 사소한 일을 접수하세요.<br><strong>AI 수사관이 조사하고, 원고와 피고가 맞붙고, 재판부가 긴급특보급 판결을 내립니다.</strong><br><span style="font-size:11px;">실제 법원이나 법률상담 서비스가 아닌 오락 콘텐츠입니다.</span></p>
        <div class="hero-tw">📌 지금 재판 가능한 사건: <strong id="tw-text"></strong><span class="cursor-blink" style="color:var(--gold);">|</span></div>
        <a href="#/submit" class="hero-cta hero-cta-pulse">🚨 황당사건 접수하기</a>
        <div class="hero-disclaimer">기본 비공개 · 공개 선택 가능 · 사건은 크게 과장됨 · 법적효력 없음</div>
        <div class="stats-row">
          <div class="stat-item"><div class="stat-num" id="stat-count">집계중</div><div class="stat-label">사건 접수부터<br><span>판결 완료</span></div></div>
          <div class="stat-item"><div class="stat-num" id="stat-judge">?</div><div class="stat-label">이번주 인기<br><span>AI 재판부</span></div></div>
          <div class="stat-item"><div class="stat-num">6단계</div><div class="stat-label">수사·공방 포함<br><span>전체 재판 체험</span></div></div>
        </div>
      </section>

      <div class="container">
        <section class="court-shell site-intro-shell">
          <div class="court-kicker">SOSOKING FULL COURT EXPERIENCE</div>
          <div class="court-title">판결문 한 장만 만드는 사이트가 아닙니다</div>
          <div class="court-desc">사건이 접수되면 AI가 수사관·원고측·피고측·검사·변호인·재판부 역할을 나눠 맡습니다. 사소한 사실을 현장감식하고 양측 논리를 만들어 법정에서 붙인 뒤, 마지막에 과하게 장엄한 판결로 마무리합니다.</div>
          <div class="service-flow-grid">
            <div class="service-flow-item"><b>🚓 사건수사</b><span>실제 입력 내용에서 시간·물건·행동·사후 태도를 뽑아 사건 기록으로 만듭니다.</span></div>
            <div class="service-flow-item"><b>⚔️ 양측 주장</b><span>원고측 핵심 주장과 피고측 핵심 반박을 먼저 짧고 명확하게 대립시킵니다.</span></div>
            <div class="service-flow-item"><b>🏛️ 법정공방</b><span>검사와 변호인이 같은 사실을 전혀 다른 방향으로 과장해 변론합니다.</span></div>
            <div class="service-flow-item"><b>🔨 최종판결</b><span>긴급특보·재판부 판단·실행 가능한 황당 처분을 하나의 기록으로 저장합니다.</span></div>
          </div>
        </section>
      </div>

      <div class="container" style="margin-top:40px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🎲 접수되는 순간 담당 재판부가 배정됩니다</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:4px;">7명의 AI 재판부 + 운명 배정</div>
        <div class="section-sub">같은 사건도 재판부 성향에 따라 수사 강도와 판결 말투가 달라집니다.</div>
        <div class="judge-lineup">
          <div class="judge-card" onclick="location.hash='#/submit'"><div class="judge-card-icon">🎲</div><div class="judge-card-name">운명에 맡기기</div><div class="judge-card-desc">서버가 담당부를 점지</div></div>
          ${JUDGES.map(judge => `<div class="judge-card" onclick="location.hash='#/submit'"><div class="judge-card-icon">${judge.icon}</div><div class="judge-card-name">${escapeHtml(judge.name)}</div><div class="judge-card-desc">${escapeHtml(judge.desc)}</div></div>`).join('')}
        </div>
      </div>

      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🎬 실제 체험은 이렇게 진행됩니다</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:18px;">사건 접수부터 선고까지 6단계</div>
        <div class="home-process">
          ${PROCESS_STEPS.map(([number, title, description]) => `<div class="how-step"><div class="how-step-num">${number}</div><div><div style="font-weight:900;font-size:15px;margin-bottom:4px;">${escapeHtml(title)}</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(description)}</div></div></div>`).join('')}
        </div>
      </div>

      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🔥 공개된 사건의 수사기록과 판결</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:12px;">최근 황당재판 기록</div>
        <div style="position:relative;margin-bottom:12px;"><input type="text" id="feed-search" class="form-input" placeholder="🔍 사건·수사·양측 주장·판결 내용 검색" style="font-size:14px;padding-left:14px;"></div>
        <div id="feed-container" style="display:flex;flex-direction:column;gap:10px;">${EXAMPLES.map(item => caseCard(null, item)).join('')}</div>
      </div>

      <div class="container" style="margin-top:28px;text-align:center;"><a href="#/guide" class="btn btn-secondary" style="width:auto;padding:11px 20px;">📖 전체 이용안내와 자주 묻는 질문</a></div>
      <div class="container" style="margin-top:20px;"><div class="disclaimer"><strong>⚠️ 오락 서비스 안내</strong><br>소소킹 황당재판소는 일상의 가벼운 갈등을 수사·공방·판결 형식으로 재구성하는 AI 오락 서비스입니다. 실제 범죄·폭력·법률·의료·안전 문제는 접수하지 말고 관련 전문가나 기관에 문의하세요.</div></div>
      <section class="cta-section" style="margin-top:48px;"><div style="font-size:48px;margin-bottom:12px;animation:wiggle 1.5s infinite;">📂</div><h2>사건 하나면 수사본부가 열립니다</h2><p>한두 문장으로 접수하면 원고와 피고가 맞붙고<br>AI 재판부가 끝까지 크게 키워 판결합니다.</p><a href="#/submit" class="hero-cta hero-cta-pulse" style="font-size:16px;">🚨 지금 사건 접수하기</a></section>
    </div>`;

  startTypewriter();
  loadCount();
  loadPublicFeed();
}

function updatePopularJudge() {
  if (!publicResults.length) return;
  const counts = {};
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [, result] of publicResults) {
    if (!result.judgeType) continue;
    const timestamp = result.createdAt?.toDate ? result.createdAt.toDate().getTime() : result.createdAt ? new Date(result.createdAt).getTime() : 0;
    if (timestamp < oneWeekAgo) continue;
    counts[result.judgeType] = (counts[result.judgeType] || 0) + 1;
  }
  const top = Object.entries(counts).sort((left, right) => right[1] - left[1])[0];
  const element = document.getElementById('stat-judge');
  if (element && top) element.textContent = `${JUDGE_ICON[top[0]] || '⚖️'} ${top[0].replace('형', '')}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function applySearch() {
  const keyword = (document.getElementById('feed-search')?.value || '').trim().toLowerCase();
  const feed = document.getElementById('feed-container');
  if (!feed) return;
  const filtered = keyword ? publicResults.filter(([, result]) => resultSearchText(result).includes(keyword)) : publicResults;
  feed.innerHTML = filtered.length
    ? filtered.map(([id, result]) => caseCard(id, result)).join('')
    : `<div style="text-align:center;padding:36px 0;color:var(--cream-dim);font-size:14px;">🔍 “${escapeHtml(keyword)}”에 대한 재판 기록이 없습니다.</div>`;
}

function caseCard(id, result) {
  const icon = JUDGE_ICON[result.judgeType] || '⚖️';
  const click = id ? `onclick="location.hash='#/result/${encodeURIComponent(id)}'"` : `onclick="location.hash='#/submit'"`;
  const linkLabel = id ? '전체 재판기록 보기 →' : '나도 사건 접수 →';
  const date = formatDate(result.createdAt);
  return `<div class="card example-card" ${click} style="padding:18px 20px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;"><div class="case-title" style="flex:1;">${escapeHtml(resultTitle(result))}</div>${date ? `<div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(date)}</div>` : ''}</div><div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.65;">${escapeHtml(compactText(resultPreview(result), 120))}</div><div class="case-meta" style="margin-top:10px;justify-content:space-between;"><span>${icon} ${escapeHtml(result.judgeType || '?')} 재판부</span><span style="color:var(--gold);font-size:12px;">${linkLabel}</span></div></div>`;
}

function startTypewriter() {
  const element = document.getElementById('tw-text');
  if (!element) return;
  let caseIndex = 0;
  let characterIndex = 0;
  let deleting = false;
  function tick() {
    const current = TW_CASES[caseIndex];
    characterIndex += deleting ? -1 : 1;
    element.textContent = current.substring(0, characterIndex);
    if (!deleting && characterIndex >= current.length) {
      typewriterTimer = setTimeout(() => { deleting = true; tick(); }, 1800);
      return;
    }
    if (deleting && characterIndex <= 0) {
      deleting = false;
      caseIndex = (caseIndex + 1) % TW_CASES.length;
    }
    typewriterTimer = setTimeout(tick, deleting ? 40 : 80);
  }
  typewriterTimer = setTimeout(tick, 80);
}

async function loadCount() {
  const element = document.getElementById('stat-count');
  try {
    const snapshot = await getCountFromServer(query(collection(db, 'cases'), where('status', '==', 'completed')));
    if (element) element.textContent = `${Number(snapshot.data().count || 0).toLocaleString('ko-KR')}건`;
  } catch {
    if (element) element.textContent = '집계중';
  }
}

async function loadPublicFeed() {
  try {
    const snapshot = await getDocs(query(collection(db, 'results'), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(20)));
    if (snapshot.empty) return;
    publicResults = snapshot.docs.map(document => [document.id, document.data()]);
    const feed = document.getElementById('feed-container');
    if (!feed) return;
    feed.innerHTML = publicResults.map(([id, result]) => caseCard(id, result)).join('');
    updatePopularJudge();
    document.getElementById('feed-search')?.addEventListener('input', applySearch);
  } catch (error) {
    console.warn('public result feed load failed:', error.message || error);
  }
}
