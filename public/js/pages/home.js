import { db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const JUDGES = [
  ['👨‍⚖️', '엄벌주의형', '소소한 일도 중대 사건처럼 판결'],
  ['🥹', '감성형', '눈물과 공감으로 판결'],
  ['🤦', '현실주의형', '팩트로 쿨하게 판결'],
  ['🔥', '과몰입형', '인류사급 대사건으로 판결'],
  ['😴', '피곤형', '빨리 끝내고 싶은 판결'],
  ['🧮', '논리집착형', '점수와 확률로 판결'],
  ['🎭', '드립형', '진지한 척 웃기게 판결'],
];

export async function renderHome(container) {
  container.innerHTML = `
    <section class="battle-hero">
      <span class="battle-gavel">⚖️</span>
      <span class="battle-badge">소소킹 생활법정</span>
      <h1 class="battle-title">소소한 억울함,<br><span>AI 판사에게 판결받자</span></h1>
      <p class="battle-sub">친구와 다툰 일, 애매한 상황, 사소한 논쟁까지<br>원고와 피고가 되어 웃기게 겨루는 법정 게임</p>

      <div class="hero-preview">
        <div class="hero-preview-label">📋 예시 사건 — 카톡 읽씹 무죄 사건</div>
        <div class="hero-preview-card">
          <div class="hero-preview-vs">
            <div class="hero-preview-side p">
              <div class="hero-preview-role" style="color:#e88;">🔴 원고</div>
              <div class="hero-preview-text">&quot;읽었으면 바로 답장하는 게 예의입니다.&quot;</div>
            </div>
            <div class="hero-preview-side d">
              <div class="hero-preview-role" style="color:#7ac;">🔵 피고</div>
              <div class="hero-preview-text">&quot;답장은 제 마음의 준비가 끝난 뒤 가능합니다.&quot;</div>
            </div>
          </div>
          <div class="hero-preview-footer">AI 판사가 재치·공감·유머 기준으로 판결합니다</div>
        </div>
      </div>

      <div class="battle-cta-wrap">
        <button onclick="window._startCourtCase()" class="btn btn-primary" style="max-width:360px;margin:0 auto;font-size:18px;padding:18px;">🏛️ 사건 접수하기</button>
        <a href="#/submit-topic" class="battle-cta-sub">✏️ 내 사건 직접 등록하기</a>
      </div>
      <p class="battle-disclaimer">오락 목적 · 실제 법적 효력 없음 · 무료 · 익명 가능</p>
      <div class="battle-scroll-hint"><span>↓</span><span>오늘의 사건</span></div>
    </section>

    <div class="container" style="padding-top:32px;padding-bottom:80px;">
      <div id="active-session-banner"></div>
      <div id="today-section"></div>
      <div id="popular-section" style="margin-top:32px;"></div>

      <div style="margin-top:40px;">
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">👨‍⚖️ 랜덤 AI 판사단</div>
        <div class="home-feature-grid">
          ${JUDGES.map(([icon, name, desc]) => `
            <div class="home-feature-item">
              <span class="home-feature-icon">${icon}</span>
              <div class="home-feature-label">${name}</div>
              <div class="home-feature-desc">${desc}</div>
            </div>`).join('')}
        </div>
      </div>

      <div style="margin-top:32px;">
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:16px;">🎮 진행 방식</div>
        <div class="home-feature-grid">
          <div class="home-feature-item"><span class="home-feature-icon">📋</span><div class="home-feature-label">사건 선택</div><div class="home-feature-desc">공감되는 생활 사건을 고릅니다</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">🙋</span><div class="home-feature-label">원고·피고 선택</div><div class="home-feature-desc">내가 편들 입장을 정합니다</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">💬</span><div class="home-feature-label">변론 진행</div><div class="home-feature-desc">원고 변론, 피고 반론 순서로 진행</div></div>
          <div class="home-feature-item"><span class="home-feature-icon">🏆</span><div class="home-feature-label">AI 판결</div><div class="home-feature-desc">판사가 점수·이유·미션을 선고</div></div>
        </div>
      </div>

      <div style="margin-top:32px;">
        <button onclick="window._startCourtCase()" class="btn btn-primary" style="font-size:17px;padding:18px;">🔥 생활법정 입장하기</button>
        <a href="#/guide" class="btn btn-ghost" style="margin-top:10px;font-size:14px;">📖 이용 안내 보기</a>
      </div>

      <div style="margin-top:24px;padding-bottom:12px;">
        <div class="disclaimer" style="text-align:center;">
          소소킹 생활법정은 순수 오락 서비스입니다.<br>AI 판결에는 실제 법적 효력이 없으며, 재미로만 이용해주세요.
        </div>
      </div>
    </div>
  `;

  loadTodayCase();
  loadPopularTopics();
  checkActiveSessionBanner();
}

window._startCourtCase = () => {
  try { localStorage.setItem('sosoking_game_mode', 'court'); } catch {}
  location.hash = '#/topics';
};

async function loadTodayCase() {
  const el = document.getElementById('today-section');
  if (!el) return;
  try {
    let snap = await getDocs(query(
      collection(db, 'topics'),
      where('status', '==', 'active'),
      where('isOfficial', '==', true),
      orderBy('playCount', 'desc'),
      limit(1)
    ));
    if (snap.empty) {
      snap = await getDocs(query(
        collection(db, 'topics'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(1)
      ));
    }
    if (!snap.empty) renderTodayCard(el, snap.docs[0].id, snap.docs[0].data());
  } catch { /* no cases yet */ }
}

function renderTodayCard(el, topicId, t) {
  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">🌟 오늘의 사건</div>
    <div class="today-case-card" onclick="location.hash='#/topic/${encodeURIComponent(topicId)}'">
      <div class="today-label">📋 ${escHtml(t.category || '생활')} · 재판 ${(t.playCount||0).toLocaleString()}회</div>
      <div class="today-title">${escHtml(t.title)}</div>
      <div class="today-summary">${escHtml(t.summary)}</div>
      <div class="today-vs">
        <div class="today-pos" style="border-left:2px solid rgba(231,76,60,0.5);">
          <div class="today-pos-label">🔴 원고 입장</div>
          <div class="today-pos-text">${escHtml(t.plaintiffPosition)}</div>
        </div>
        <div class="today-pos" style="border-left:2px solid rgba(52,152,219,0.5);">
          <div class="today-pos-label">🔵 피고 입장</div>
          <div class="today-pos-text">${escHtml(t.defendantPosition)}</div>
        </div>
      </div>
      <div class="today-footer"><span style="color:var(--gold);font-weight:700;">탭해서 재판 시작 →</span></div>
    </div>
  `;
}

async function loadPopularTopics() {
  const el = document.getElementById('popular-section');
  if (!el) return;
  try {
    const snap = await getDocs(query(
      collection(db, 'topics'),
      where('status', '==', 'active'),
      orderBy('playCount', 'desc'),
      limit(5)
    ));
    if (snap.empty) return;
    const cards = snap.docs.map(d => {
      const t = d.data();
      return `<div class="topic-card" onclick="location.hash='#/topic/${encodeURIComponent(d.id)}'" style="margin-bottom:8px;">
        <div class="topic-card-title">${escHtml(t.title)}</div>
        <div class="topic-card-summary">${escHtml(t.summary)}</div>
        <div class="topic-card-footer">
          <span class="topic-card-cat">${escHtml(t.category || '생활')}</span>
          <span>재판 ${(t.playCount||0).toLocaleString()}회</span>
          ${t.isOfficial ? '<span style="color:var(--gold);font-size:10px;font-weight:700;">공식</span>' : ''}
        </div>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">🔥 인기 사건</div>
      ${cards}
      <a href="#/topics" style="display:block;text-align:center;margin-top:12px;color:var(--gold);font-size:13px;font-weight:700;text-decoration:none;">전체 사건 보기 →</a>
    `;
  } catch { /* silent */ }
}

function checkActiveSessionBanner() {
  const el = document.getElementById('active-session-banner');
  if (!el) return;
  try {
    const stored = JSON.parse(localStorage.getItem('sosoking_active_session') || 'null');
    if (!stored || !stored.sessionId) return;
    const ageHours = (Date.now() - (stored.savedAt || 0)) / 3600000;
    if (ageHours > 48) { localStorage.removeItem('sosoking_active_session'); return; }
    const roleLabel = stored.role === 'plaintiff' ? '🔴 원고' : '🔵 피고';
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(201,168,76,0.14),rgba(201,168,76,0.05));border:1.5px solid rgba(201,168,76,0.45);border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:3px;">🔥 진행 중인 재판</div>
          <div style="font-size:13px;color:var(--cream);font-weight:600;">${escHtml(stored.topicTitle || '사건')} · ${roleLabel}</div>
        </div>
        <a href="#/debate/${stored.sessionId}" style="flex-shrink:0;padding:9px 16px;border-radius:10px;background:var(--gold);color:#0d1117;font-size:13px;font-weight:700;text-decoration:none;">이어하기 →</a>
      </div>
    `;
  } catch {}
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
