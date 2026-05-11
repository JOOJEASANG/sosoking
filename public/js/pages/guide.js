import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const JUDGE_TYPES = [
  { icon: '👨‍⚖️', name: '엄벌주의형 판사', desc: '카톡 읽씹도 중대 생활사건처럼 다루는 강경한 AI 판사', color: '#c0392b' },
  { icon: '🥹', name: '감성형 판사', desc: '양쪽 사정에 모두 공감하며 화해 미션을 자주 내립니다', color: '#8e44ad' },
  { icon: '🤦', name: '현실주의형 판사', desc: '현실적으로 누가 더 말이 되는지 콕 집어 판결합니다', color: '#7f8c8d' },
  { icon: '🔥', name: '과몰입형 판사', desc: '치킨 한 조각도 인류사적 사건처럼 과장해서 판결합니다', color: '#e67e22' },
  { icon: '😴', name: '피곤형 판사', desc: '빨리 선고하고 퇴근하고 싶은 듯 짧고 웃긴 판결을 냅니다', color: '#95a5a6' },
  { icon: '🧮', name: '논리집착형 판사', desc: '공감, 억울함, 드립력까지 수치화해서 분석합니다', color: '#2980b9' },
  { icon: '🎭', name: '드립형 판사', desc: '엄숙한 판결문처럼 시작하다가 예상 못 한 드립을 날립니다', color: '#27ae60' },
];

export async function renderGuide(container) {
  let sessionLimit = 2, aiSessionLimit = 5, topicLimit = 5;
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    if (snap.exists()) {
      const d = snap.data();
      sessionLimit = d.dailySessionLimit ?? 2;
      aiSessionLimit = d.dailyAiSessionLimit ?? 5;
      topicLimit = d.dailyTopicLimit ?? 5;
    }
  } catch {}

  injectGuideStyle();
  container.innerHTML = `
    <div class="guide-page">
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">📖 이용 안내</span>
      </div>
      <div class="container guide-container">
        <section class="guide-hero">
          <div class="guide-hero-icon">⚖️</div>
          <div class="guide-hero-kicker">SOSOKING LIFE COURT</div>
          <h1>소소킹 생활법정 이용안내</h1>
          <p>카톡 읽씹, 치킨 마지막 조각, 더치페이처럼 일상 속 작은 사건을 접수하고 AI 판사에게 오락용 판결을 받아보는 생활법정 게임입니다.</p>
          <div class="guide-hero-actions">
            <a href="#/town">🏙️ 가상거리 입장</a>
            <a href="#/topics">🏛️ 사건 게시판</a>
          </div>
        </section>

        <section class="guide-section">
          <div class="guide-section-title">🎮 이용 순서</div>
          <div class="guide-steps">
            ${[
              ['🏙️', '가상거리 입장', '소소 경찰서, 법률사무소, 사건접수처, 생활법정이 있는 가상거리에서 시작합니다.'],
              ['📁', '사건 선택', '공식 생활사건을 고르거나, 내 상황을 직접 사건으로 접수할 수 있습니다.'],
              ['🕵️', '사건 해결 퀘스트', `경찰서에서 사건 상황을 정리하고, 법률사무소에서 양쪽 사정을 기록한 뒤, 증거 아이템을 선택합니다. 사건 접수는 하루 ${topicLimit}회까지 가능합니다.`],
              ['🚪', '재판 방식 선택', '혼자 AI 재판, 친구 재판, 랜덤 재판 중 원하는 방식으로 생활법정에 입장합니다. 초반에는 혼자 AI 재판이 가장 빠릅니다.'],
              ['📝', '사건 심리', '문제 제기 측과 상대측 설명을 차례로 남깁니다. 딱딱한 논리보다 상황 설명, 공감, 재치가 중요합니다.'],
              ['🔨', 'AI 판결 선고', 'AI 판사가 사건 기록을 보고 오락용 판결문, 명대사, 화해 미션을 만들어줍니다. 결과는 복사하거나 공유할 수 있습니다.'],
            ].map(([icon, title, desc], i) => `
              <div class="guide-step">
                <div class="guide-step-num">${i + 1}</div>
                <div class="guide-step-body">
                  <strong>${icon} ${title}</strong>
                  <span>${desc}</span>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <section class="guide-section">
          <div class="guide-section-title">👨‍⚖️ AI 판사 7가지 성향</div>
          <p class="guide-section-desc">같은 사건도 어떤 AI 판사가 배정되느냐에 따라 판결문 분위기가 달라집니다.</p>
          <div class="judge-type-grid">
            ${JUDGE_TYPES.map(j => `
              <div class="judge-type-card">
                <div class="judge-type-icon">${j.icon}</div>
                <div class="judge-type-name" style="color:${j.color};">${j.name}</div>
                <div class="judge-type-desc">${j.desc}</div>
              </div>`).join('')}
          </div>
        </section>

        <section class="guide-section">
          <div class="guide-section-title">❓ 자주 묻는 질문</div>
          <div class="guide-faq-list">
            ${[
              ['진짜 법원 서비스인가요?', '아니요. 소소킹 생활법정은 순수 오락용 AI 모의법정입니다. AI 판결문에는 실제 법적 효력이 없습니다.'],
              ['혼자서도 할 수 있나요?', `네. 혼자 AI 재판을 선택하면 소소봇이 상대 역할을 맡아 즉시 생활법정을 진행할 수 있습니다. 하루 ${aiSessionLimit}회까지 이용 가능합니다.`],
              ['친구가 가입해야 하나요?', '아니요. 친구 초대 링크를 받은 사람은 익명으로도 바로 참여할 수 있습니다.'],
              ['랜덤 재판도 가능한가요?', `네. 같은 사건을 선택한 대기자가 있으면 랜덤으로 연결됩니다. 친구·랜덤 재판은 하루 ${sessionLimit}회 기준으로 운영됩니다.`],
              ['공식 사건팩은 뭔가요?', '처음 방문한 사람도 바로 즐길 수 있도록 미리 준비된 생활사건입니다. 사건을 고르면 퀘스트에 자동으로 내용이 채워집니다.'],
              ['로그인이 필요한가요?', '기본 이용은 익명으로 가능합니다. 로그인하면 닉네임 설정과 기록 관리가 더 편리합니다.'],
              ['실제 분쟁 내용을 넣어도 되나요?', '권장하지 않습니다. 실명, 연락처, 주소, 직장, 학교, 계좌번호, 실제 민감한 분쟁 자료는 입력하지 마세요.'],
              ['AI 판결을 실제 문제 해결에 써도 되나요?', '안 됩니다. AI 판결은 재미용 콘텐츠입니다. 실제 법률·계약·손해배상·고소·노동·가사 문제는 전문가와 상담해야 합니다.'],
              ['다크/라이트 모드를 바꿀 수 있나요?', '하단 메뉴의 계정/설정 버튼에서 다크 모드와 라이트 모드를 바꿀 수 있습니다.'],
            ].map(([q, a]) => `
              <details class="guide-faq">
                <summary>Q. ${q}<span>+</span></summary>
                <div>A. ${a}</div>
              </details>`).join('')}
          </div>
        </section>

        <section class="guide-disclaimer">
          <strong>⚠️ 오락용 AI 모의법정 안내</strong>
          <span>소소킹 생활법정의 AI 판결, 점수, 미션, 조언은 모두 엔터테인먼트용입니다. 실제 법적 판단, 법률 상담, 증거, 합의, 권리 주장 근거로 사용할 수 없습니다.</span>
        </section>

        <a href="#/topics" class="guide-start-btn">🏛️ 생활법정 시작하기</a>
      </div>
    </div>`;
}

function injectGuideStyle() {
  if (document.getElementById('life-court-guide-style')) return;
  const style = document.createElement('style');
  style.id = 'life-court-guide-style';
  style.textContent = `
    .guide-page { min-height:100vh; background:radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.15), transparent 50%), var(--navy); }
    .guide-container { padding-top:26px; padding-bottom:88px; }
    .guide-hero { text-align:center; border:1.5px solid rgba(201,168,76,.26); border-radius:24px; padding:28px 18px; background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02)); box-shadow:0 14px 36px rgba(0,0,0,.22); margin-bottom:28px; }
    [data-theme="light"] .guide-hero { background:rgba(255,255,255,.82); box-shadow:0 10px 26px rgba(154,112,24,.12); }
    .guide-hero-icon { font-size:54px; margin-bottom:10px; }
    .guide-hero-kicker { font-size:10px; font-weight:900; color:var(--gold); letter-spacing:.14em; }
    .guide-hero h1 { margin:6px 0 8px; font-family:var(--font-serif); font-size:24px; color:var(--cream); }
    .guide-hero p { margin:0 auto; max-width:540px; color:var(--cream-dim); font-size:14px; line-height:1.75; }
    .guide-hero-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:18px; }
    .guide-hero-actions a, .guide-start-btn { text-decoration:none; border-radius:15px; padding:13px 12px; font-size:14px; font-weight:900; text-align:center; }
    .guide-hero-actions a:first-child { background:rgba(255,255,255,.06); border:1px solid rgba(201,168,76,.24); color:var(--cream); }
    .guide-hero-actions a:last-child, .guide-start-btn { background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; box-shadow:0 8px 24px rgba(201,168,76,.2); }
    .guide-section { margin-bottom:32px; }
    .guide-section-title { font-size:12px; font-weight:900; color:var(--gold); letter-spacing:.08em; margin-bottom:14px; }
    .guide-section-desc { margin:-6px 0 14px; color:var(--cream-dim); font-size:13px; line-height:1.7; }
    .guide-step { display:flex; align-items:stretch; }
    .guide-step-num { width:36px; height:36px; flex-shrink:0; border-radius:50%; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; z-index:1; }
    .guide-step-body { flex:1; padding:6px 0 24px 35px; border-left:2px solid rgba(201,168,76,.18); margin-left:-19px; }
    .guide-step:last-child .guide-step-body { border-left-color:transparent; }
    .guide-step-body strong { display:block; color:var(--gold); font-size:14px; margin-bottom:5px; }
    .guide-step-body span { display:block; color:var(--cream-dim); font-size:13px; line-height:1.7; }
    .judge-type-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
    .judge-type-card { padding:13px; border-radius:15px; border:1px solid rgba(201,168,76,.18); background:rgba(255,255,255,.035); }
    [data-theme="light"] .judge-type-card { background:rgba(255,255,255,.78); }
    .judge-type-icon { font-size:25px; margin-bottom:5px; }
    .judge-type-name { font-size:12px; font-weight:900; margin-bottom:4px; }
    .judge-type-desc { font-size:11px; color:var(--cream-dim); line-height:1.55; }
    .guide-faq-list { display:flex; flex-direction:column; gap:8px; }
    .guide-faq { border:1px solid rgba(201,168,76,.18); border-radius:13px; overflow:hidden; background:rgba(255,255,255,.025); }
    [data-theme="light"] .guide-faq { background:rgba(255,255,255,.72); }
    .guide-faq summary { padding:14px 15px; font-weight:900; font-size:13px; color:var(--cream); cursor:pointer; list-style:none; display:flex; justify-content:space-between; gap:12px; }
    .guide-faq summary span { color:var(--gold); }
    .guide-faq div { padding:12px 15px 14px; border-top:1px solid rgba(201,168,76,.14); color:var(--cream-dim); font-size:13px; line-height:1.75; }
    .guide-disclaimer { margin-bottom:22px; padding:15px 16px; border-radius:16px; border:1.5px solid rgba(231,76,60,.28); background:rgba(231,76,60,.06); }
    .guide-disclaimer strong { display:block; color:#e74c3c; font-size:13px; margin-bottom:7px; }
    .guide-disclaimer span { display:block; color:var(--cream-dim); font-size:13px; line-height:1.7; }
    .guide-start-btn { display:block; }
    @media (max-width:430px) { .guide-hero h1 { font-size:22px; } .guide-hero-actions { grid-template-columns:1fr; } .judge-type-grid { grid-template-columns:1fr; } .guide-step-body { padding-left:31px; } }
  `;
  document.head.appendChild(style);
}
