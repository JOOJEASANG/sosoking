import { db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const EXAMPLES = [
  {
    title: '라면 국물 무단 음용 사건',
    sentence: '피고인은 원고의 명시적 동의 없이 라면 국물을 전량 음용하였으며, 이는 식음료 영역 침해죄 및 정서적 재산 손괴에 해당한다.',
    judgeType: '엄벌주의형'
  },
  {
    title: '카톡 읽씹 17회 반복 사건',
    sentence: '피고인의 17회 연속 읽씹 행위는 단순한 무례를 넘어 디지털 공간에서의 감정 유기죄로 판단된다. 즉각 답장 및 이모티콘 5개 이상 첨부를 명한다.',
    judgeType: '논리집착형'
  },
  {
    title: '공용 리모컨 실종 사건',
    sentence: '리모컨은 소파 쿠션 밑에 있다. 그게 전부다. 재판 종결.',
    judgeType: '피곤형'
  }
];

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const JUDGES = [
  { name: '엄벌주의형', icon: '👨‍⚖️', desc: '전과자 만들어 드림' },
  { name: '감성형',    icon: '🥹',   desc: '판사가 더 많이 울어요' },
  { name: '현실주의형', icon: '🤦',  desc: '위로 기대하지 마요' },
  { name: '과몰입형',  icon: '🔥',   desc: '드라마 대본 쓰는 판사' },
  { name: '피곤형',    icon: '😴',   desc: '이 재판 하기 싫다' },
  { name: '논리집착형', icon: '🧮',  desc: '억울지수 7.35±0.003점' },
  { name: '드립형',    icon: '🎭',   desc: '진지한 척 드립 치는 판사' },
];

const TW_CASES = [
  '라면 국물 무단 음용 사건',
  '카톡 읽씹 17회 반복 사건',
  '파마 안 한다고 해놓고 한 사건',
  '내 자리에 슬쩍 앉아있던 사건',
  '밥 먹었냐고 물어보지 않은 사건',
  '에어컨 온도 독단 조작 사건',
  '마지막 과자 혼자 다 먹은 사건',
  '택배 대신 수령 후 3일 방치 사건',
  '공용 리모컨 실종 사건',
  '우산 무단 사용 후 반납 불이행 사건',
  '충전기 끝에 살짝 꽂아만 두고 간 사건',
];

// Module-level timer ref so it can be cleared on re-render
let _twTimer = null;

export async function renderHome(container) {
  // Clear any running typewriter
  if (_twTimer !== null) {
    clearTimeout(_twTimer);
    _twTimer = null;
  }

  container.innerHTML = `
    <div style="padding-bottom:60px;">

      <!-- ============ HERO ============ -->
      <section class="hero-section">
        <div class="hero-badge">🌏 세계 유일 사소한 억울함 전문 법정 (UN 미승인)</div>
        <h1 class="hero-h1">억울하죠?<br><span style="font-size:0.58em;color:var(--gold);font-style:italic;">그러니까요.</span></h1>
        <p class="hero-sub">아무도 안 들어줬죠?<br>저희가 <strong>과하게 진지하게</strong> 들어드립니다.<br><span style="font-size:11px;opacity:0.5;">(법적 효력은 없지만 심리적으로 시원합니다)</span></p>

        <div class="hero-tw">
          ⚠️ 지금 이 억울함 심의중: <strong id="tw-text"></strong><span class="cursor-blink" style="color:var(--gold);">|</span>
        </div>

        <a href="#/submit" class="hero-cta hero-cta-pulse">🚨 억울함 즉시 접수하기</a>
        <div class="hero-disclaimer">완전 무료 · 완전 익명 · 완전히 법적효력 없음</div>

        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-num" id="stat-count">847+</div>
            <div class="stat-label">억울함 처리됨</div>
          </div>
          <div class="stat-item">
            <div class="stat-num" id="stat-judge">?</div>
            <div class="stat-label">이번주 인기<br><span style="font-size:9px;opacity:0.7;">판사</span></div>
          </div>
          <div class="stat-item">
            <div class="stat-num">0%</div>
            <div class="stat-label">법적효력<br><span style="font-size:9px;opacity:0.7;">(근데 시원함)</span></div>
          </div>
        </div>
      </section>

      <!-- ============ 판사 라인업 ============ -->
      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">⚠️ 누가 걸릴지 아무도 모릅니다</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:4px;">8명의 AI 판사 대기중 🫡</div>
        <div class="section-sub">랜덤 배정 (용기있으면) or 직접 선택 가능</div>

        <div class="judge-lineup">
          <div class="judge-card" onclick="location.hash='#/submit'">
            <div class="judge-card-icon">🎲</div>
            <div class="judge-card-name">운명에 맡기기</div>
            <div class="judge-card-desc" style="color:var(--gold);">두근두근...</div>
          </div>
          ${JUDGES.map(j => `
            <div class="judge-card" onclick="location.hash='#/submit'">
              <div class="judge-card-icon">${j.icon}</div>
              <div class="judge-card-name">${j.name}</div>
              <div class="judge-card-desc">${j.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ============ 최근 판결 사례 ============ -->
      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🔥 실제로 판결받은 사건들</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:12px;">최근 억울함 판결 사례</div>
        <div style="position:relative;margin-bottom:12px;">
          <input type="text" id="feed-search" class="form-input" placeholder="🔍 사건명으로 검색..." style="font-size:14px;padding-left:14px;">
        </div>
        <div id="feed-container" style="display:flex;flex-direction:column;gap:10px;">
          ${EXAMPLES.map(c => _caseCard(null, c)).join('')}
        </div>
      </div>

      <!-- ============ 이용 방법 ============ -->
      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🎬 진짜 법정처럼 진행됩니다 (연기임)</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:20px;">재판 진행 순서</div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${[
            ['01','억울함 접수 📝','억울한 내용 적어요. 최대한 불쌍하게 쓸수록 유리합니다 (아님)'],
            ['02','AI 수사 개시 🔍','수사관이 라면 국물 방울 수를 정밀 감식합니다 (서버에서)'],
            ['03','법정 공방 ⚔️','원고·피고 변호사가 열정적으로 싸웁니다. 대본 있습니다.'],
            ['04','판사 판결 확정 ⚖️','판사가 인생을 망칠 듯이 진지하게 생활형 처분을 내립니다']
          ].map(([num, title, desc]) => `
            <div class="how-step">
              <div class="how-step-num" style="min-width:40px;height:40px;font-size:13px;">${num}</div>
              <div>
                <div style="font-weight:700;font-size:15px;margin-bottom:3px;">${title}</div>
                <div style="font-size:13px;color:var(--cream-dim);">${desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ============ 이용 안내 링크 ============ -->
      <div class="container" style="margin-top:28px;text-align:center;">
        <a href="#/guide" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border:1px solid var(--border);border-radius:20px;font-size:13px;color:var(--cream-dim);text-decoration:none;transition:all 0.2s;">
          📖 이용 안내 · 자주 묻는 질문
        </a>
      </div>

      <!-- ============ 오락 안내 ============ -->
      <div class="container" style="margin-top:20px;">
        <div class="disclaimer">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          소소킹 판결소는 실제 법률 자문이 아닌 AI 기반 오락형 서비스입니다. 판결에는 어떠한 법적 효력도 없습니다.
        </div>
      </div>

      <!-- ============ 하단 CTA ============ -->
      <section class="cta-section" style="margin-top:48px;">
        <div style="font-size:48px;margin-bottom:12px;animation:wiggle 1.5s infinite;">😤</div>
        <h2>아직도 참고 계세요?</h2>
        <p>억울함은 참는 게 아닙니다.<br>AI 법정에 접수하는 겁니다.<br><span style="font-size:12px;opacity:0.5;">(그게 더 건강합니다 아마도)</span></p>
        <a href="#/submit" class="hero-cta hero-cta-pulse" style="font-size:16px;">🚨 억울함 지금 바로 접수하기</a>
        <div style="margin-top:16px;font-size:11px;color:rgba(245,240,232,0.3);">
          평균 판결 시간: 약 1분<br>(판사님 커피 뽑으러 가시는 시간 포함)
        </div>
      </section>

    </div>
  `;

  // Start typewriter
  _startTypewriter();

  // Load stats count
  _loadCount();

  // Load public feed + popular judge
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

// 날짜 포맷: "4월 20일 오후 3:24"
function _fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// 검색 필터링
let _feedAll = [];
function _applySearch() {
  const q = (document.getElementById('feed-search')?.value || '').trim();
  const feedEl = document.getElementById('feed-container');
  if (!feedEl) return;
  const filtered = q ? _feedAll.filter(([, r]) => (r.caseTitle || '').includes(q)) : _feedAll;
  if (filtered.length === 0) {
    feedEl.innerHTML = `<div style="text-align:center;padding:36px 0;color:var(--cream-dim);font-size:14px;">🔍 "${q}"에 대한 판결 사례가 없습니다</div>`;
  } else {
    feedEl.innerHTML = filtered.map(([id, r]) => _caseCard(id, r)).join('');
  }
}

function _caseCard(id, r) {
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const href = id ? `onclick="location.hash='#/result/${encodeURIComponent(id)}'"` : `onclick="location.hash='#/submit'"`;
  const linkLabel = id ? '판결문 보기 →' : '나도 접수하기 →';
  const dateStr = _fmtDate(r.createdAt);
  return `
    <div class="card example-card" ${href} style="padding:18px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div class="case-title" style="flex:1;">${r.caseTitle || r.title || '제목 없음'}</div>
        ${dateStr ? `<div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${dateStr}</div>` : ''}
      </div>
      <div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.6;">${((r.sentence || r.desc || '')).substring(0, 72)}…</div>
      <div class="case-meta" style="margin-top:10px;justify-content:space-between;">
        <span>${icon} ${r.judgeType || '?'} 판사</span>
        <span style="color:var(--gold);font-size:12px;">${linkLabel}</span>
      </div>
    </div>`;
}

function _startTypewriter() {
  const el = document.getElementById('tw-text');
  if (!el) return;

  let caseIdx = 0;
  let charIdx = 0;
  let deleting = false;

  function tick() {
    const current = TW_CASES[caseIdx];
    if (!deleting) {
      // Typing forward
      charIdx++;
      el.textContent = current.substring(0, charIdx);
      if (charIdx >= current.length) {
        // Full text shown — pause then start deleting
        _twTimer = setTimeout(() => {
          deleting = true;
          _twTimer = setTimeout(tick, 40);
        }, 2000);
        return;
      }
      _twTimer = setTimeout(tick, 80);
    } else {
      // Deleting
      charIdx--;
      el.textContent = current.substring(0, charIdx);
      if (charIdx <= 0) {
        deleting = false;
        caseIdx = (caseIdx + 1) % TW_CASES.length;
        _twTimer = setTimeout(tick, 80);
        return;
      }
      _twTimer = setTimeout(tick, 40);
    }
  }

  _twTimer = setTimeout(tick, 80);
}

async function _loadCount() {
  try {
    const snap = await getCountFromServer(
      query(collection(db, 'cases'), where('status', '==', 'completed'))
    );
    const count = snap.data().count;
    const el = document.getElementById('stat-count');
    if (el && count > 0) {
      el.textContent = count.toLocaleString('ko-KR') + '건';
    }
  } catch {
    // keep animated fallback value
    _animateCount();
  }
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
    const snap = await getDocs(
      query(collection(db, 'results'), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(20))
    );
    if (snap.empty) return;

    _feedAll = snap.docs.map(d => [d.id, d.data()]);

    const feedEl = document.getElementById('feed-container');
    if (!feedEl) return;
    feedEl.innerHTML = _feedAll.map(([id, r]) => _caseCard(id, r)).join('');

    _updatePopularJudge();

    // 검색 이벤트 연결
    const searchEl = document.getElementById('feed-search');
    if (searchEl) searchEl.addEventListener('input', _applySearch);
  } catch {
    // Keep example fallback
  }
}
