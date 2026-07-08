import { db } from '../firebase.js?v=20260630-3';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const EXAMPLES = [
  { title: '공용 충전기 장기 점유 사건', sentence: '피고는 3일간 충전 완료 즉시 회수 의무를 부담한다.', judgeType: '현실주의형' },
  { title: '회의실 온도 독단 조정 사건', sentence: '피고는 다음 회의 1회 에어컨 온도 합의 절차를 이행한다.', judgeType: '논리집착형' },
  { title: '점심 메뉴 결정 회피 사건', sentence: '피고는 1회 메뉴 후보 3개를 먼저 제시할 의무를 진다.', judgeType: '피곤형' }
];

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'😢','현실주의형':'🤦',
  '과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const JUDGES = [
  { name: '엄벌주의형', icon: '👨‍⚖️', desc: '사소함도 중대사안' },
  { name: '감성형', icon: '😢', desc: '재판부가 먼저 울컥' },
  { name: '현실주의형', icon: '🤦', desc: '차갑고 정확한 체념' },
  { name: '과몰입형', icon: '🔥', desc: '황당사건 대하드라마' },
  { name: '피곤형', icon: '😴', desc: '퇴근이 간절한 판결' },
  { name: '논리집착형', icon: '🧮', desc: '억울지수 소수점 계산' },
  { name: '드립형', icon: '🎭', desc: '정색하고 웃기는 판결' },
];

const TW_CASES = [
  '공용 충전기 장기 점유 사건', '회의실 온도 독단 조정 사건', '점심 메뉴 결정 회피 사건',
  '단체방 읽음 후 무응답 사건', '냉장고 음료 무단 시음 사건', '택배 대신 수령 후 방치 사건',
  '공용 우산 반납 지연 사건', '회의 시간 5분 지각 반복 사건', '프린터 용지 마지막 장 미보충 사건',
  '공용 리모컨 위치 미보고 사건', '아무거나라고 말한 뒤 메뉴 반박 사건'
];

let _twTimer = null;
let _feedAll = [];

export async function renderHome(container) {
  if (_twTimer !== null) { clearTimeout(_twTimer); _twTimer = null; }

  container.innerHTML = `
    <div style="padding-bottom:60px;">
      <section class="hero-section home-hero-light-safe">
        <div class="home-logo-frame"><img class="home-logo-banner" src="/site-logo-banner.png?v=20260707-logo2" alt="소소킹 황당재판소 로고" /></div>
        <div class="hero-badge">⚖️ 세상 모든 소소사건 · 법적효력 0%</div>
        <h1 class="hero-h1">세상의 모든<br><span style="font-size:0.52em;color:var(--gold);font-style:italic;">소소한 사건과 황당한 사례</span></h1>
        <p class="hero-sub">이제 소소킹 황당재판소에서<br><strong>AI 재판부에게 판결받아보세요.</strong><br>그냥 넘기기엔 찝찝하고, 진짜 따지기엔 너무 사소한 일까지<br>과하게 진지한 판결문으로 정리해드립니다.<br><span style="font-size:11px;opacity:0.5;">실제 법원은 아니고, 마음속 방청석은 열려 있습니다.</span></p>
        <div class="hero-tw">📌 현재 접수 가능한 소소사건: <strong id="tw-text"></strong><span class="cursor-blink" style="color:var(--gold);">|</span></div>
        <a href="#/submit" class="hero-cta hero-cta-pulse">🚨 소소사건 판결받기</a>
        <div class="hero-disclaimer">무료 · 익명 · 과장됨 · 법적효력 없음</div>
        <div class="stats-row">
          <div class="stat-item"><div class="stat-num" id="stat-count">847+</div><div class="stat-label">소소사건<br><span style="font-size:9px;opacity:0.7;">판결 완료</span></div></div>
          <div class="stat-item"><div class="stat-num" id="stat-judge">?</div><div class="stat-label">이번주 인기<br><span style="font-size:9px;opacity:0.7;">재판부</span></div></div>
          <div class="stat-item"><div class="stat-num">0%</div><div class="stat-label">법적효력<br><span style="font-size:9px;opacity:0.7;">대신 공감</span></div></div>
        </div>
      </section>

      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🎲 접수되는 순간 이미 재판은 시작됩니다</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:4px;">7명의 AI 재판부 + 운명 배정 ⚖️</div>
        <div class="section-sub">웃긴 일, 억울한 일, 어이없는 일상 사례까지 과하게 진지하게 판결합니다</div>
        <div class="judge-lineup">
          <div class="judge-card" onclick="location.hash='#/submit'"><div class="judge-card-icon">🎲</div><div class="judge-card-name">운명에 맡기기</div><div class="judge-card-desc" style="color:var(--gold);">서버가 점지합니다</div></div>
          ${JUDGES.map(j => `<div class="judge-card" onclick="location.hash='#/submit'"><div class="judge-card-icon">${j.icon}</div><div class="judge-card-name">${escapeHtml(j.name)}</div><div class="judge-card-desc">${escapeHtml(j.desc)}</div></div>`).join('')}
        </div>
      </div>

      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🔥 실제로 공개된 소소판결 사례</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:12px;">최근 생활형 판결</div>
        <div style="position:relative;margin-bottom:12px;"><input type="text" id="feed-search" class="form-input" placeholder="🔍 사건명으로 검색..." style="font-size:14px;padding-left:14px;"></div>
        <div id="feed-container" style="display:flex;flex-direction:column;gap:10px;">${EXAMPLES.map(c => _caseCard(null, c)).join('')}</div>
      </div>

      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🎬 절차는 엄숙하게, 내용은 사소하게</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:20px;">재판 진행 순서</div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${[
            ['01','소소사건 접수 📝','일상 속 소소한 사건과 황당한 사례를 적습니다. 실명 대신 상황과 억울함만 제출하세요.'],
            ['02','황당성 검토 🔍','재판부가 이 사건을 얼마나 진지하게 다룰지 엄숙하게 고민합니다.'],
            ['03','법정 공방 ⚔️','원고 주장, 피고 변명, 증거 아닌 증거가 말이 되는 듯 안 되는 듯 펼쳐집니다.'],
            ['04','소소판결 선고 ⚖️','최종 판결문과 생활형 처분이 내려집니다. 실제 법적 효력은 없습니다.']
          ].map(([num, title, desc]) => `<div class="how-step"><div class="how-step-num" style="min-width:40px;height:40px;font-size:13px;">${num}</div><div><div style="font-weight:700;font-size:15px;margin-bottom:3px;">${escapeHtml(title)}</div><div style="font-size:13px;color:var(--cream-dim);">${escapeHtml(desc)}</div></div></div>`).join('')}
        </div>
      </div>

      <div class="container" style="margin-top:28px;text-align:center;"><a href="#/guide" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border:1px solid var(--border);border-radius:20px;font-size:13px;color:var(--cream-dim);text-decoration:none;transition:all 0.2s;">📖 이용 안내 · 자주 묻는 질문</a></div>
      <div class="container" style="margin-top:20px;"><div class="disclaimer"><strong>⚠️ 오락 서비스 안내</strong><br>소소킹 황당재판소는 실제 법률 자문이 아닌 AI 기반 오락형 판결 서비스입니다. 판결에는 어떠한 법적 효력도 없습니다.</div></div>
      <section class="cta-section" style="margin-top:48px;"><div style="font-size:48px;margin-bottom:12px;animation:wiggle 1.5s infinite;">😤</div><h2>소소한 사건도 판결받을 권리가 있습니다</h2><p>세상의 모든 소소한 사건과 황당한 사례,<br>이제 소소킹 황당재판소에서 판결받아보세요.<br><span style="font-size:12px;opacity:0.5;">단, 실제 법적 문제는 실제 전문가에게.</span></p><a href="#/submit" class="hero-cta hero-cta-pulse" style="font-size:16px;">🚨 지금 바로 접수하기</a></section>
    </div>
  `;

  _startTypewriter();
  _loadCount();
  _loadPublicFeed();
}

function _updatePopularJudge() {
  if (_feedAll.length === 0) return;
  const counts = {};
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [, r] of _feedAll) {
    if (!r.judgeType) continue;
    const ts = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);
    if (ts < oneWeekAgo) continue;
    counts[r.judgeType] = (counts[r.judgeType] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const el = document.getElementById('stat-judge');
  if (el && top) el.textContent = (JUDGE_ICON[top[0]] || '⚖️') + ' ' + top[0].replace('형', '');
}

function _fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _applySearch() {
  const q = (document.getElementById('feed-search')?.value || '').trim();
  const feedEl = document.getElementById('feed-container');
  if (!feedEl) return;
  const filtered = q ? _feedAll.filter(([, r]) => (r.caseTitle || '').includes(q)) : _feedAll;
  if (filtered.length === 0) feedEl.innerHTML = `<div style="text-align:center;padding:36px 0;color:var(--cream-dim);font-size:14px;">🔍 "${escapeHtml(q)}"에 대한 판결 사례가 없습니다</div>`;
  else feedEl.innerHTML = filtered.map(([id, r]) => _caseCard(id, r)).join('');
}

function _caseCard(id, r) {
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const href = id ? `onclick="location.hash='#/result/${encodeURIComponent(id)}'"` : `onclick="location.hash='#/submit'"`;
  const linkLabel = id ? '소소판결 보기 →' : '나도 판결받기 →';
  const dateStr = _fmtDate(r.createdAt);
  return `<div class="card example-card" ${href} style="padding:18px 20px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;"><div class="case-title" style="flex:1;">${escapeHtml(r.absurdityTitle || r.caseTitle || r.title || '제목 없음')}</div>${dateStr ? `<div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(dateStr)}</div>` : ''}</div><div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.6;">${escapeHtml(compactText(r.closingComment || r.sentence || r.desc || '', 72))}</div><div class="case-meta" style="margin-top:10px;justify-content:space-between;"><span>${icon} ${escapeHtml(r.judgeType || '?')} 재판부</span><span style="color:var(--gold);font-size:12px;">${linkLabel}</span></div></div>`;
}

function _startTypewriter() {
  const el = document.getElementById('tw-text');
  if (!el) return;
  let caseIdx = 0, charIdx = 0, deleting = false;
  function tick() {
    const current = TW_CASES[caseIdx];
    if (!deleting) {
      charIdx++; el.textContent = current.substring(0, charIdx);
      if (charIdx >= current.length) { _twTimer = setTimeout(() => { deleting = true; _twTimer = setTimeout(tick, 40); }, 2000); return; }
      _twTimer = setTimeout(tick, 80);
    } else {
      charIdx--; el.textContent = current.substring(0, charIdx);
      if (charIdx <= 0) { deleting = false; caseIdx = (caseIdx + 1) % TW_CASES.length; _twTimer = setTimeout(tick, 80); return; }
      _twTimer = setTimeout(tick, 40);
    }
  }
  _twTimer = setTimeout(tick, 80);
}

async function _loadCount() {
  try {
    const snap = await getCountFromServer(query(collection(db, 'cases'), where('status', '==', 'completed')));
    const count = snap.data().count;
    const el = document.getElementById('stat-count');
    if (el && count > 0) el.textContent = count.toLocaleString('ko-KR') + '건';
  } catch { _animateCount(); }
}

function _animateCount() {
  const el = document.getElementById('stat-count');
  if (!el) return;
  let n = 0;
  const target = 847;
  const step = Math.ceil(target / 40);
  const t = setInterval(() => {
    n = Math.min(n + step, target);
    el.textContent = n.toLocaleString('ko-KR') + '+';
    if (n >= target) clearInterval(t);
  }, 30);
}

async function _loadPublicFeed() {
  try {
    const snap = await getDocs(query(collection(db, 'results'), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(20)));
    if (snap.empty) return;
    _feedAll = snap.docs.map(d => [d.id, d.data()]);
    const feedEl = document.getElementById('feed-container');
    if (!feedEl) return;
    feedEl.innerHTML = _feedAll.map(([id, r]) => _caseCard(id, r)).join('');
    _updatePopularJudge();
    const searchEl = document.getElementById('feed-search');
    if (searchEl) searchEl.addEventListener('input', _applySearch);
  } catch {}
}
