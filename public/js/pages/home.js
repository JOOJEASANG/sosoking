import { db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const EXAMPLE_CASE = {
  title: '카톡 읽씹 무죄 주장 사건',
  plaintiff: '읽었으면 바로 답장이 기본 예의다',
  defendant: '나중에 답할 자유가 있다',
};

export async function renderHome(container) {
  container.innerHTML = `
    <section class="court-hero">
      <span class="court-gavel">⚖️</span>
      <span class="court-badge">소소킹 생활법정</span>
      <h1 class="court-title">사소한 갈등,<br><span>법정에서 끝냅시다</span></h1>
      <p class="court-sub">친구와 직접 토론하고<br>AI 판사에게 공정한 판결을 받으세요</p>

      <div class="hero-preview">
        <div class="hero-preview-label">📋 예시 — ${EXAMPLE_CASE.title}</div>
        <div class="hero-preview-card">
          <div class="hero-preview-vs">
            <div class="hero-preview-side p">
              <div class="hero-preview-role" style="color:#e88;">⚔️ 원고 측</div>
              <div class="hero-preview-text">"${EXAMPLE_CASE.plaintiff}"</div>
            </div>
            <div class="hero-preview-side d">
              <div class="hero-preview-role" style="color:#7ac;">🛡️ 피고 측</div>
              <div class="hero-preview-text">"${EXAMPLE_CASE.defendant}"</div>
            </div>
          </div>
          <div class="hero-preview-footer">누가 맞을까요? → AI 판사가 판결합니다</div>
        </div>
      </div>

      <div class="court-cta-wrap">
        <a href="#/topics" class="court-cta-main">⚖️ 지금 바로 재판받기</a>
        <a href="#/submit-topic" class="court-cta-sub">✏️ 내 억울한 사건 직접 등록하기</a>
      </div>
      <p class="court-disclaimer">오락 목적 · AI 판결에 법적 효력 없음 · 무료 · 익명</p>
      <div class="court-scroll-hint"><span>↓</span><span>오늘의 사건</span></div>
    </section>

    <div class="container" style="padding-top:32px;padding-bottom:80px;">
      <div id="today-section"></div>
      <div id="popular-section" style="margin-top:32px;"></div>

      <div style="margin-top:40px;">
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:20px;">🎯 이렇게 합니다</div>
        <div class="how-to-list">
          <div class="how-to-item">
            <div class="how-to-num">1</div>
            <div class="how-to-body">
              <div class="how-to-title">사건 고르기</div>
              <div class="how-to-desc">카톡 읽씹, 치킨 마지막 조각, 더치페이… 공감 100% 사건 중 하나를 고르거나 직접 등록하세요.</div>
            </div>
          </div>
          <div class="how-to-item">
            <div class="how-to-num">2</div>
            <div class="how-to-body">
              <div class="how-to-title">입장 선택 → 친구 초대</div>
              <div class="how-to-desc">원고/피고 중 내 입장을 선택하고 링크를 친구에게 보내세요. 클릭하는 순간 재판 시작. 가입 불필요.</div>
            </div>
          </div>
          <div class="how-to-item">
            <div class="how-to-num">3</div>
            <div class="how-to-body">
              <div class="how-to-title">2라운드 토론 → AI 판결</div>
              <div class="how-to-desc">각자 주장을 2번 입력하면 AI 판사가 공정하게 판결합니다. 억울해도 논리가 부족하면 집니다.</div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:32px;">
        <div class="home-feature-grid">
          <div class="home-feature-item">
            <span class="home-feature-icon">🔗</span>
            <div class="home-feature-label">링크 초대</div>
            <div class="home-feature-desc">가입 없이 링크 하나로 친구 초대</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">🎲</span>
            <div class="home-feature-label">랜덤 매칭</div>
            <div class="home-feature-desc">모르는 사람과 즉석 대결도 가능</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">🤖</span>
            <div class="home-feature-label">AI 판사</div>
            <div class="home-feature-desc">어느 편도 안 든다. 논리로만 판결</div>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">✏️</span>
            <div class="home-feature-label">직접 등록</div>
            <div class="home-feature-desc">내 억울한 일을 사건으로 등록</div>
          </div>
        </div>
      </div>

      <div style="margin-top:40px;">
        <a href="#/topics" class="btn btn-primary" style="font-size:17px;padding:18px;">⚖️ 지금 재판 시작하기</a>
      </div>

      <div style="margin-top:24px;padding-bottom:12px;">
        <div class="disclaimer" style="text-align:center;">
          소소킹 생활법정은 순수 오락 서비스입니다.<br>AI 판결에는 법적 효력이 없으며, 익명으로 운영됩니다.
        </div>
      </div>
    </div>
  `;

  loadTodayCase();
  loadPopularTopics();
}

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
  } catch { /* no topics yet */ }
}

function renderTodayCard(el, topicId, t) {
  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:12px;">🌟 오늘의 사건</div>
    <div class="today-case-card" onclick="location.hash='#/topic/${topicId}'">
      <div class="today-label">📋 ${t.category || '생활'} · 재판 ${(t.playCount||0).toLocaleString()}회</div>
      <div class="today-title">${t.title}</div>
      <div class="today-summary">${t.summary}</div>
      <div class="today-vs">
        <div class="today-pos" style="border-left:2px solid rgba(231,76,60,0.5);">
          <div class="today-pos-label">⚔️ 원고</div>
          <div class="today-pos-text">${t.plaintiffPosition}</div>
        </div>
        <div class="today-pos" style="border-left:2px solid rgba(52,152,219,0.5);">
          <div class="today-pos-label">🛡️ 피고</div>
          <div class="today-pos-text">${t.defendantPosition}</div>
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
      return `<div class="topic-card" onclick="location.hash='#/topic/${d.id}'" style="margin-bottom:8px;">
        <div class="topic-card-title">${t.title}</div>
        <div class="topic-card-summary">${t.summary}</div>
        <div class="topic-card-footer">
          <span class="topic-card-cat">${t.category || '생활'}</span>
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
