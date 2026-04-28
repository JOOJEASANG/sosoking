import { db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

export async function renderHome(container) {
  container.innerHTML = `
    <div>
      <div class="sk-hero">
        <span class="sk-hero-crown">👑</span>
        <h1 class="sk-hero-title">소소킹</h1>
        <p class="sk-hero-sub">사소한 것도 진지하게 따집니다 ㅋㅋ</p>
        <p class="sk-hero-desc">AI가 진행하는 병맛 게임 3종 세트</p>
      </div>

      <div class="sk-stats" id="sk-stats">
        <div class="sk-stat">
          <div class="sk-stat-num" id="stat-court">-</div>
          <div class="sk-stat-label">⚖️ 재판 완료</div>
        </div>
        <div class="sk-stat">
          <div class="sk-stat-num" id="stat-news">-</div>
          <div class="sk-stat-label">📺 뉴스 보도</div>
        </div>
        <div class="sk-stat">
          <div class="sk-stat-num" id="stat-devil">-</div>
          <div class="sk-stat-label">😈 거래 체결</div>
        </div>
      </div>

      <div class="sk-games">

        <a href="#/topics" class="sk-game-card sk-game-court">
          <div class="sk-game-emoji">⚖️</div>
          <div class="sk-game-info">
            <div class="sk-game-tag">GAME 1 · AI 판사</div>
            <h2 class="sk-game-title">사소한 재판</h2>
            <p class="sk-game-desc">억울하면 법정에 세우세요. AI 판사 7인방이 진지하게 판결합니다. 논리 없으면 집니다.</p>
            <span class="sk-game-btn">재판 시작 →</span>
          </div>
        </a>

        <a href="#/sosonews" class="sk-game-card sk-game-news">
          <div class="sk-game-emoji">📺</div>
          <div class="sk-game-info">
            <div class="sk-game-tag">GAME 2 · 긴급 속보</div>
            <h2 class="sk-game-title">소소뉴스</h2>
            <p class="sk-game-desc">오늘 있었던 아주 사소한 사건... CNN·MBC·뉴스9이 긴급 보도합니다. 배꼽 조심.</p>
            <span class="sk-game-btn">긴급 보도 →</span>
          </div>
        </a>

        <a href="#/devil-deal" class="sk-game-card sk-game-devil">
          <div class="sk-game-emoji">😈</div>
          <div class="sk-game-info">
            <div class="sk-game-tag">GAME 3 · 위험한 거래</div>
            <h2 class="sk-game-title">악마와의 거래</h2>
            <p class="sk-game-desc">소원 하나 들어줄게요. 단, 조건이 있습니다... 친구에게 공유해서 투표받으세요.</p>
            <span class="sk-game-btn">소원 말하기 →</span>
          </div>
        </a>

      </div>

      <div class="sk-section" id="today-section" style="padding-bottom:20px;"></div>

    </div>
  `;

  loadStats();
  loadTodayCase();
}

async function loadStats() {
  try {
    const [courtSnap, newsSnap, devilSnap] = await Promise.all([
      getCountFromServer(query(collection(db, 'sessions'), where('status', '==', 'completed'))),
      getCountFromServer(collection(db, 'sosonews')),
      getCountFromServer(collection(db, 'devil_deals')),
    ]);
    const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
    document.getElementById('stat-court')?.setAttribute('data-val', courtSnap.data().count);
    document.getElementById('stat-news')?.setAttribute('data-val',  newsSnap.data().count);
    document.getElementById('stat-devil')?.setAttribute('data-val', devilSnap.data().count);
    document.getElementById('stat-court').textContent = fmt(courtSnap.data().count);
    document.getElementById('stat-news').textContent  = fmt(newsSnap.data().count);
    document.getElementById('stat-devil').textContent = fmt(devilSnap.data().count);
  } catch {
    ['stat-court','stat-news','stat-devil'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '?';
    });
  }
}

async function loadTodayCase() {
  const sec = document.getElementById('today-section');
  if (!sec) return;
  try {
    const snap = await getDocs(query(
      collection(db, 'topics'),
      where('status', '==', 'active'),
      orderBy('playCount', 'desc'),
      limit(1)
    ));
    if (snap.empty) return;
    const t = { id: snap.docs[0].id, ...snap.docs[0].data() };
    sec.innerHTML = `
      <div class="sk-section-title">🔥 지금 가장 핫한 사건</div>
      <div class="today-case-card" onclick="location.hash='#/topic/${t.id}'">
        <div class="today-label">재판 ${(t.playCount||0).toLocaleString()}회 · ${t.category||'생활'}</div>
        <div class="today-title">${t.title}</div>
        <div class="today-summary">${t.summary}</div>
        <div class="today-vs">
          <div class="today-pos">
            <div class="today-pos-label">⚔️ 원고</div>
            <div class="today-pos-text">${t.plaintiffPosition}</div>
          </div>
          <div class="today-pos">
            <div class="today-pos-label">🛡️ 피고</div>
            <div class="today-pos-text">${t.defendantPosition}</div>
          </div>
        </div>
        <div class="today-footer"><span>탭해서 재판 시작 →</span></div>
      </div>
    `;
  } catch {}
}
