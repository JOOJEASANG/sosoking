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
  { name: '엄벌주의형', icon: '👨‍⚖️', desc: '"중범죄야, 중범죄"' },
  { name: '감성형',    icon: '🥹',   desc: '판사가 더 울어요' },
  { name: '현실주의형', icon: '🤦',  desc: '"그래서 어쩌라고요"' },
  { name: '과몰입형',  icon: '🔥',   desc: '전 세계 1면 뉴스감' },
  { name: '선처형',    icon: '🤗',   desc: '다 이해해요 근데...' },
  { name: '피곤형',    icon: '😴',   desc: '빨리 집에 가고 싶다' },
  { name: '논리집착형', icon: '🧮',  desc: '억울지수 7.4532점' },
  { name: '드립형',    icon: '🎭',   desc: '판결이요? ㅋㅋ' },
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
        <div class="hero-badge">세계 최초 사소한 억울함 전문 법정 ⚖️</div>
        <h1 class="hero-h1">억울하세요?<br><span style="font-size:0.65em;color:var(--gold);">여기 접수하세요.</span></h1>
        <p class="hero-sub">라면 국물 한 방울, 읽씹 한 번도<br>당신의 억울함은 <strong>중요합니다.</strong><br><span style="font-size:12px;opacity:0.6;">(법적으로는 아닙니다)</span></p>

        <div class="hero-tw">
          🔴 심의중: <strong id="tw-text"></strong><span class="cursor-blink" style="color:var(--gold);">|</span>
        </div>

        <a href="#/submit" class="hero-cta">🚨 지금 당장 억울함 호소하기</a>
        <div class="hero-disclaimer">무료 · 완전 익명 · 법적효력 없음 (진짜로)</div>

        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-num" id="stat-count">847+</div>
            <div class="stat-label">억울함 해소됨</div>
          </div>
          <div class="stat-item">
            <div class="stat-num">8명</div>
            <div class="stat-label">개성있는 판사</div>
          </div>
          <div class="stat-item">
            <div class="stat-num">0%</div>
            <div class="stat-label">법적효력 😅</div>
          </div>
        </div>
      </section>

      <!-- ============ 판사 라인업 ============ -->
      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">👇 어떤 판사가 걸릴지 모릅니다</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:4px;">8명의 AI 판사가 대기중</div>
        <div class="section-sub">랜덤 배정 or 직접 선택 가능합니다</div>

        <div class="judge-lineup">
          <div class="judge-card" onclick="location.hash='#/submit'">
            <div class="judge-card-icon">🎲</div>
            <div class="judge-card-name">운에 맡기기</div>
            <div class="judge-card-desc" style="color:var(--gold);">두근두근</div>
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
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:16px;">최근 억울함 판결 사례</div>
        <div id="feed-container" style="display:flex;flex-direction:column;gap:10px;">
          ${EXAMPLES.map(c => _caseCard(null, c)).join('')}
        </div>
      </div>

      <!-- ============ 이용 방법 ============ -->
      <div class="container" style="margin-top:44px;">
        <div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">📋 이게 진짜 법정처럼 진행됩니다</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:20px;">재판 진행 순서</div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${[
            ['01','억울함 접수 📝','사건명과 억울한 경위를 적어요 (진지하게)'],
            ['02','AI 수사 개시 🔍','수사관이 라면 국물 방울 수를 감식합니다'],
            ['03','법정 공방 ⚔️','원고·피고 변호사가 열정적으로 싸웁니다 (대본 있음)'],
            ['04','판사 판결 확정 ⚖️','판사가 과하게 진지하게 생활형 처분을 내립니다']
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
        <div style="font-size:36px;margin-bottom:12px;">😤</div>
        <h2>참을 수 없이 억울하신가요?</h2>
        <p>지금 바로 접수하세요.<br>AI 판사가 기다리고 있습니다. (진짜로)</p>
        <a href="#/submit" class="hero-cta" style="font-size:16px;">🚨 억울함 지금 바로 접수하기</a>
        <div style="margin-top:14px;font-size:12px;color:rgba(245,240,232,0.35);">평균 판결 시간: 약 1분 (판사님 커피 드시는 시간 포함)</div>
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
