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
  '과몰입형':'🔥','선처형':'🤗','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const JUDGES = [
  { name: '엄벌주의형', icon: '👨‍⚖️', desc: '무조건 중범죄' },
  { name: '감성형',    icon: '🥹',   desc: '눈물로 판결' },
  { name: '현실주의형', icon: '🤦',  desc: '그래서 어쩌라고요' },
  { name: '과몰입형',  icon: '🔥',   desc: '역사적 대형 사건' },
  { name: '선처형',    icon: '🤗',   desc: '화해를 유도' },
  { name: '피곤형',    icon: '😴',   desc: '빨리 끝냅시다' },
  { name: '논리집착형', icon: '🧮',  desc: '수치화된 판결' },
  { name: '드립형',    icon: '🎭',   desc: '예능처럼 진지하게' },
];

const TW_CASES = [
  '라면 국물 무단 음용 사건',
  '카톡 읽씹 17회 반복 사건',
  '충전기 독점 점거 사건',
  '화장실 청소 3주 미루기 사건',
  '마지막 과자 몰래 먹기 사건',
  '에어컨 온도 독단 조작 사건',
  '공용 리모컨 실종 사건',
  '우산 무단 사용 후 반납 불이행 사건',
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
        <div class="hero-badge">⚖️ AI 법정 · 무료 · 익명</div>
        <h1 class="hero-h1">억울하세요?</h1>
        <p class="hero-sub">사소한 억울함을 접수하면 AI 판사가<br><strong>과하게 진지하게</strong> 판결합니다</p>

        <div class="hero-tw">
          지금 접수중: <strong id="tw-text"></strong><span class="cursor-blink" style="color:var(--gold);">|</span>
        </div>

        <a href="#/submit" class="hero-cta">🚨 지금 당장 억울함 호소하기</a>
        <div class="hero-disclaimer">무료 · 익명 · 법적효력 없음 (당연히)</div>

        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-num" id="stat-count">847+</div>
            <div class="stat-label">총 억울함 해소</div>
          </div>
          <div class="stat-item">
            <div class="stat-num">8가지</div>
            <div class="stat-label">판사 유형</div>
          </div>
          <div class="stat-item">
            <div class="stat-num">0%</div>
            <div class="stat-label">법적효력</div>
          </div>
        </div>
      </section>

      <!-- ============ 판사 라인업 ============ -->
      <div class="container" style="margin-top:40px;">
        <div class="section-header">JUDGE LINEUP</div>
        <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;margin-bottom:6px;">어떤 판사가 배정될까요?</div>
        <div class="section-sub">판사는 랜덤 배정되며 직접 선택도 가능합니다</div>

        <div class="judge-lineup">
          <!-- 랜덤 배정 card -->
          <div class="judge-card" onclick="location.hash='#/submit'">
            <div class="judge-card-icon">🎲</div>
            <div class="judge-card-name" style="color:var(--cream);">랜덤 배정</div>
            <div class="judge-card-desc" style="color:var(--gold);font-weight:700;">+ 랜덤</div>
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
      <div class="container" style="margin-top:40px;">
        <div class="section-header">RECENT VERDICTS</div>
        <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;margin-bottom:16px;">최근 판결 사례</div>
        <div id="feed-container" style="display:flex;flex-direction:column;gap:10px;">
          ${EXAMPLES.map(c => _caseCard(null, c)).join('')}
        </div>
      </div>

      <!-- ============ 이용 방법 ============ -->
      <div class="container" style="margin-top:40px;">
        <div class="section-header">HOW IT WORKS</div>
        <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;margin-bottom:20px;">이용 방법</div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${[
            ['01','억울함 접수','사건명과 경위를 입력합니다'],
            ['02','AI 수사 개시','접수관·수사관이 사건을 검토합니다'],
            ['03','법정 공방','원고·피고 측 변호사가 맞붙습니다'],
            ['04','판사 등장','배정된 판사가 최종 판결을 내립니다']
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

      <!-- ============ 오락 안내 ============ -->
      <div class="container" style="margin-top:28px;">
        <div class="disclaimer">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          소소킹 판결소는 실제 법률 자문이 아닌 AI 기반 오락형 서비스입니다. 판결에는 어떠한 법적 효력도 없습니다.
        </div>
      </div>

      <!-- ============ 하단 CTA ============ -->
      <section class="cta-section" style="margin-top:48px;">
        <h2>억울한 사건이 있으신가요?</h2>
        <p>망설이지 마세요. AI 판사가 과하게 진지하게 들어드립니다.</p>
        <a href="#/submit" class="hero-cta" style="font-size:16px;">🚨 억울함 지금 바로 접수하기</a>
      </section>

    </div>
  `;

  // Start typewriter
  _startTypewriter();

  // Load stats count
  _loadCount();

  // Load public feed
  _loadPublicFeed();
}

function _caseCard(id, r) {
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const href = id ? `onclick="location.hash='#/result/${encodeURIComponent(id)}'"` : `onclick="location.hash='#/submit'"`;
  const linkLabel = id ? '직접 확인하기 →' : '판결받기 →';
  return `
    <div class="card example-card" ${href} style="min-height:96px;padding:18px 20px;">
      <div class="case-title">${r.caseTitle || r.title || '제목 없음'}</div>
      <div style="font-size:13px;color:var(--cream-dim);margin-top:4px;line-height:1.6;">${((r.sentence || r.desc || '')).substring(0, 70)}…</div>
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
      query(collection(db, 'results'), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(5))
    );
    if (snap.empty) return;

    const feedEl = document.getElementById('feed-container');
    if (!feedEl) return;

    feedEl.innerHTML = snap.docs.map(d => _caseCard(d.id, d.data())).join('');
  } catch {
    // Keep example fallback
  }
}
