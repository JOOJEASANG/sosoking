import { db } from '../firebase.js';
import { collection, query, where, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { STORY_CASE_PACK, STORY_CASE_CATEGORIES } from '../data/story-case-pack.js';

let activeCategory = '';
let dbTopics = [];

export async function renderTopics(container) {
  injectCaseBoardStyle();
  try { localStorage.setItem('sosoking_game_mode', 'court'); } catch {}

  container.innerHTML = `
    <div class="case-board-page">
      <div class="case-board-header">
        <a href="#/" class="case-back-btn">‹</a>
        <div>
          <div class="case-header-kicker">STORY LIFE COURT</div>
          <div class="case-header-title">🕵️ 오늘의 사건 게시판</div>
        </div>
        <button class="case-write-btn" onclick="location.hash='#/case-quest'">접수</button>
      </div>
      <div class="container case-board-container">
        <div class="case-board-stage">
          <div class="case-board-glow"></div>
          <div class="case-board-judge">
            <div class="case-board-nameplate">AI 접수 판사</div>
            <div class="case-board-avatar">👨‍⚖️</div>
            <div class="case-board-speech">단서와 반전이 있는 사건을 고르고, 역할별 플레이로 생활법정에 입장하세요.</div>
          </div>
          <div class="case-board-clerk"><div class="clerk-avatar">🧑‍💼</div><div class="clerk-label">서기</div></div>
          <div class="case-board-sign"><div class="sign-title">스토리 사건 ${STORY_CASE_PACK.length}개</div><div class="sign-sub">단서 · 반전 · 판결 포인트 중심</div></div>
        </div>
        <div id="active-session-banner"></div>
        <div class="case-search-panel">
          <div class="case-search-wrap"><span>🔍</span><input type="text" id="search-input" placeholder="치킨 유언, 블루체크, 쿠폰, 딸기우유, 스포일러..."></div>
          <div class="case-cat-filter" id="cat-filter"></div>
        </div>
        <div class="official-pack-banner">
          <span>🕵️</span>
          <div><strong>스토리형 사건팩</strong><small>기존 단순 사건 대신 사건 발단, 반전 포인트, 판결 포인트가 있는 사건만 보여줍니다.</small></div>
          <button onclick="location.hash='#/case-quest'">내 사건 접수</button>
        </div>
        <div id="topics-list" class="case-door-grid"></div>
      </div>
    </div>`;

  checkActiveSessionBanner();
  await loadDbTopics();
  renderFilter();
  renderList();
  document.getElementById('search-input')?.addEventListener('input', e => renderList(e.target.value.trim(), activeCategory));
}

async function loadDbTopics() {
  try {
    const snap = await getDocs(query(collection(db, 'topics'), where('status', '==', 'active'), orderBy('playCount', 'desc')));
    dbTopics = snap.docs.map(d => ({ id: d.id, ...d.data(), isDbTopic: true })).filter(t => !looksLikeOldSimpleCase(t.title));
  } catch { dbTopics = []; }
}

function looksLikeOldSimpleCase(title = '') {
  const oldTitles = ['카톡 읽씹 3시간 사건','단답형 답장 성의 부족 사건','단톡방 공지 미확인 사건','새벽 카톡 알림 사건','치킨 마지막 조각 사건','감자튀김 하나만 사건','메뉴 아무거나 사건','더치페이 100원 정산 사건','데이트 10분 지각 사건','약속 5분 지각 사건','냉장고 음료 무단 개봉 사건','리모컨 독점 사건','주차 선 살짝 넘은 사건','드라마 스포일러 사건'];
  return oldTitles.includes(String(title));
}

function renderFilter() {
  const el = document.getElementById('cat-filter');
  if (!el) return;
  el.innerHTML = '<button class="case-cat-pill active" data-cat="">전체</button>' + STORY_CASE_CATEGORIES.map(c => `<button class="case-cat-pill" data-cat="${escAttr(c.name)}">${escHtml(c.icon || '')} ${escHtml(c.name)}</button>`).join('');
  el.addEventListener('click', e => {
    const pill = e.target.closest('.case-cat-pill');
    if (!pill) return;
    el.querySelectorAll('.case-cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeCategory = pill.dataset.cat || '';
    renderList(document.getElementById('search-input')?.value.trim() || '', activeCategory);
  });
}

function renderList(search = '', cat = '') {
  const el = document.getElementById('topics-list');
  if (!el) return;
  let list = [
    ...STORY_CASE_PACK.map((t, idx) => ({ ...t, isStoryCase: true, playCount: 80 + ((STORY_CASE_PACK.length - idx) * 7) })),
    ...dbTopics,
  ];
  if (cat) list = list.filter(t => t.category === cat);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(t => [t.title, t.summary, t.category, t.difficulty, t.hook, t.twist, t.plaintiffPosition, t.defendantPosition].some(v => String(v || '').toLowerCase().includes(q)));
  }
  if (!list.length) {
    el.innerHTML = `<div class="case-empty-state"><div class="case-empty-icon">🔍</div><div class="case-empty-title">검색 결과가 없습니다</div><div class="case-empty-sub">다른 검색어를 입력하거나 직접 사건을 접수해보세요.</div><button onclick="location.hash='#/case-quest'" class="case-empty-btn">🕵️ 사건 직접 접수</button></div>`;
    return;
  }
  el.innerHTML = list.map((t, i) => cardHtml(t, i)).join('');
  el.querySelectorAll('[data-start-story]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const item = STORY_CASE_PACK.find(x => x.id === btn.dataset.startStory);
    if (!item) return;
    sessionStorage.setItem('sosoking_prefill_case', JSON.stringify({
      title: item.title,
      summary: `${item.summary} ${item.hook || ''} ${item.twist || ''}`.slice(0, 120),
      plaintiffPosition: item.plaintiffPosition,
      defendantPosition: item.defendantPosition,
      category: item.category,
      storyCaseId: item.id,
      difficulty: item.difficulty,
    }));
    location.hash = '#/case-quest';
  }));
}

function cardHtml(t, i) {
  if (t.isDbTopic && !t.isStoryCase) {
    return `<article class="case-door-card" onclick="location.hash='#/topic/${encodeURIComponent(t.id)}'" style="animation-delay:${Math.min(i * 0.025, 0.36)}s;"><div class="case-door-top"><div class="case-file-icon">${caseIcon(t.category)}</div><div><div class="case-door-cat">${escHtml(t.category || '접수 사건')}</div><div class="case-door-count">유저 접수 사건 · 재판 ${(t.playCount||0).toLocaleString()}회</div></div></div><div class="case-door-title">${escHtml(t.title)}</div><div class="case-door-summary">${escHtml(t.summary)}</div><div class="case-roles-mini"><div class="case-role-mini red"><span>🔴 문제 제기</span><strong>${escHtml(t.plaintiffPosition)}</strong></div><div class="case-role-mini blue"><span>🔵 상대측 설명</span><strong>${escHtml(t.defendantPosition)}</strong></div></div><div class="case-enter-door"><span class="door-knob"></span><span>법정 입장</span></div></article>`;
  }
  return `<article class="case-door-card story-case-card" style="animation-delay:${Math.min(i * 0.025, 0.36)}s;"><div class="case-door-top"><div class="case-file-icon">${caseIcon(t.category)}</div><div><div class="case-door-cat">${escHtml(t.category)} · ${escHtml(t.difficulty || '스토리')}</div><div class="case-door-count">스토리 사건 · 단서/반전 포함</div></div></div><div class="case-door-title">${escHtml(t.title)}</div><div class="case-door-summary">${escHtml(t.summary)}</div><div class="story-hook"><b>사건 발단</b><span>${escHtml(t.hook || '사건 기록을 확인해보세요.')}</span></div><div class="story-twist"><b>반전 포인트</b><span>${escHtml(t.twist || '심리 중 새로운 포인트가 드러납니다.')}</span></div><div class="case-roles-mini"><div class="case-role-mini red"><span>🔴 문제 제기</span><strong>${escHtml(t.plaintiffPosition)}</strong></div><div class="case-role-mini blue"><span>🔵 상대측 설명</span><strong>${escHtml(t.defendantPosition)}</strong></div></div><div class="story-actions"><button class="story-main" data-start-story="${escAttr(t.id)}">🕵️ 이 사건으로 시작</button></div></article>`;
}

function caseIcon(category = '') {
  const c = String(category);
  if (c.includes('카톡')) return '💬';
  if (c.includes('연애')) return '💘';
  if (c.includes('음식') || c.includes('치킨')) return '🍗';
  if (c.includes('정산') || c.includes('돈')) return '💸';
  if (c.includes('직장')) return '💼';
  if (c.includes('친구')) return '👫';
  if (c.includes('가족')) return '👨‍👩‍👧';
  if (c.includes('이웃')) return '🏘️';
  if (c.includes('취미')) return '🎮';
  return '📁';
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
    el.innerHTML = `<div class="case-active-banner"><div><div class="case-active-kicker">🔥 진행 중인 재판</div><div class="case-active-title">${escHtml(stored.topicTitle || '사건')} · ${roleLabel}</div></div><a href="#/debate/${stored.sessionId}">이어하기 →</a></div>`;
  } catch {}
}

function injectCaseBoardStyle() {
  if (document.getElementById('case-board-style')) return;
  const style = document.createElement('style');
  style.id = 'case-board-style';
  style.textContent = `
    .case-board-page { min-height:100vh; background:radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.16), transparent 50%), var(--navy); }
    .case-board-header { position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; background:rgba(13,17,23,.94); border-bottom:1px solid var(--border); backdrop-filter:blur(12px); }
    [data-theme="light"] .case-board-header { background:rgba(255,248,242,.96); }
    .case-back-btn { color:var(--cream-dim); font-size:28px; text-decoration:none; line-height:1; }
    .case-header-kicker { font-size:9px; font-weight:900; letter-spacing:.14em; color:var(--gold); text-align:center; }
    .case-header-title { font-family:var(--font-serif); font-size:17px; color:var(--cream); font-weight:900; }
    .case-write-btn { border:1px solid rgba(201,168,76,.32); background:rgba(201,168,76,.08); color:var(--gold); border-radius:999px; padding:8px 11px; font-size:12px; font-weight:900; cursor:pointer; }
    .case-board-container { padding-top:16px; padding-bottom:84px; }
    .case-board-stage { position:relative; overflow:hidden; height:205px; margin-bottom:16px; border-radius:22px; border:1.5px solid rgba(201,168,76,.34); background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); box-shadow:0 14px 38px rgba(0,0,0,.28); }
    [data-theme="light"] .case-board-stage { background:rgba(255,255,255,.68); box-shadow:0 10px 28px rgba(154,112,24,.12); }
    .case-board-glow { position:absolute; inset:-90px -30px auto; height:160px; background:radial-gradient(circle, rgba(201,168,76,.32), transparent 68%); animation:caseGlow 4s ease-in-out infinite alternate; }
    .case-board-judge { position:absolute; left:50%; top:20px; transform:translateX(-50%); width:160px; text-align:center; z-index:3; }
    .case-board-nameplate { display:inline-flex; padding:3px 10px; border-radius:999px; background:rgba(201,168,76,.12); color:var(--gold); font-size:10px; font-weight:900; margin-bottom:6px; }
    .case-board-avatar { width:68px; height:68px; margin:0 auto; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:38px; border:2px solid rgba(201,168,76,.5); background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04)); animation:caseJudge 1.2s ease-in-out infinite alternate; }
    .case-board-speech { margin-top:8px; padding:8px 10px; border-radius:14px; background:rgba(0,0,0,.2); border:1px solid rgba(201,168,76,.2); color:var(--cream); font-size:11px; line-height:1.45; }
    [data-theme="light"] .case-board-speech { background:rgba(255,255,255,.82); }
    .case-board-clerk { position:absolute; left:22px; bottom:20px; text-align:center; z-index:3; }
    .clerk-avatar { width:52px; height:52px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:30px; background:rgba(255,255,255,.08); border:1px solid rgba(201,168,76,.25); }
    .clerk-label { margin-top:4px; color:var(--cream-dim); font-size:11px; font-weight:900; }
    .case-board-sign { position:absolute; right:16px; bottom:22px; width:145px; padding:12px; border-radius:14px; border:1px solid rgba(201,168,76,.28); background:rgba(0,0,0,.2); }
    [data-theme="light"] .case-board-sign { background:rgba(255,255,255,.78); }
    .sign-title { font-size:13px; font-weight:900; color:var(--gold); } .sign-sub { margin-top:3px; font-size:11px; color:var(--cream-dim); line-height:1.4; }
    .official-pack-banner { display:flex; align-items:center; gap:11px; margin:0 0 16px; padding:13px 14px; border-radius:17px; border:1.5px solid rgba(201,168,76,.28); background:linear-gradient(135deg,rgba(201,168,76,.11),rgba(255,255,255,.025)); }
    .official-pack-banner span { font-size:28px; } .official-pack-banner div { flex:1; min-width:0; } .official-pack-banner strong { display:block; color:var(--gold); font-size:13px; } .official-pack-banner small { display:block; color:var(--cream-dim); font-size:11px; margin-top:2px; line-height:1.4; } .official-pack-banner button { border:none; border-radius:12px; background:var(--gold); color:#0d1117; font-size:11px; font-weight:900; padding:9px 10px; cursor:pointer; }
    .case-active-banner { background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(201,168,76,.05)); border:1.5px solid rgba(201,168,76,.45); border-radius:14px; padding:14px 16px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .case-active-kicker { font-size:12px; font-weight:900; color:var(--gold); margin-bottom:3px; } .case-active-title { font-size:13px; color:var(--cream); font-weight:800; } .case-active-banner a { flex-shrink:0; padding:9px 14px; border-radius:10px; background:var(--gold); color:#0d1117; font-size:13px; font-weight:900; text-decoration:none; }
    .case-search-panel { margin-bottom:16px; }
    .case-search-wrap { display:flex; align-items:center; gap:9px; background:rgba(255,255,255,.05); border:1.5px solid rgba(201,168,76,.22); border-radius:15px; padding:12px 14px; }
    [data-theme="light"] .case-search-wrap { background:rgba(255,255,255,.76); }
    .case-search-wrap input { flex:1; border:none; background:transparent; color:var(--cream); outline:none; font-size:15px; font-family:var(--font-sans); }
    .case-search-wrap input::placeholder { color:var(--cream-dim); }
    .case-cat-filter { display:flex; gap:7px; overflow-x:auto; padding:10px 2px 0; scrollbar-width:none; }
    .case-cat-filter::-webkit-scrollbar { display:none; }
    .case-cat-pill { flex-shrink:0; border:1px solid rgba(201,168,76,.2); background:rgba(255,255,255,.035); color:var(--cream-dim); border-radius:999px; padding:7px 12px; font-size:12px; font-weight:900; cursor:pointer; }
    .case-cat-pill.active { color:#0d1117; background:linear-gradient(135deg,var(--gold),var(--gold-light)); border-color:transparent; }
    .case-door-grid { display:grid; grid-template-columns:1fr; gap:12px; }
    .case-door-card { position:relative; overflow:hidden; border-radius:20px; padding:16px; border:1.5px solid rgba(201,168,76,.25); background:linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); box-shadow:0 10px 28px rgba(0,0,0,.2); cursor:pointer; transform:translateY(8px); opacity:0; animation:caseCardIn .38s ease forwards; }
    .story-case-card { border-color:rgba(201,168,76,.46); }
    .story-case-card:after { content:'STORY'; position:absolute; top:12px; right:12px; border-radius:999px; padding:3px 8px; background:var(--gold); color:#0d1117; font-size:10px; font-weight:900; letter-spacing:.08em; }
    [data-theme="light"] .case-door-card { background:linear-gradient(145deg, rgba(255,255,255,.95), rgba(255,241,228,.82)); box-shadow:0 8px 22px rgba(154,112,24,.12); }
    .case-door-top { position:relative; display:flex; align-items:center; gap:11px; margin-bottom:12px; }
    .case-file-icon { width:42px; height:42px; border-radius:13px; display:flex; align-items:center; justify-content:center; background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.22); font-size:22px; }
    .case-door-cat { font-size:11px; font-weight:900; color:var(--gold); letter-spacing:.06em; }
    .case-door-count { margin-top:2px; font-size:11px; color:var(--cream-dim); }
    .case-door-title { position:relative; font-family:var(--font-serif); font-size:18px; font-weight:900; color:var(--cream); line-height:1.35; margin-bottom:6px; }
    .case-door-summary { position:relative; font-size:13px; color:var(--cream-dim); line-height:1.6; margin-bottom:12px; }
    .story-hook, .story-twist { position:relative; margin-bottom:9px; padding:10px 11px; border-radius:13px; border:1px solid rgba(201,168,76,.18); background:rgba(255,255,255,.035); }
    [data-theme="light"] .story-hook, [data-theme="light"] .story-twist { background:rgba(154,112,24,.055); }
    .story-hook b, .story-twist b { display:block; color:var(--gold); font-size:10px; font-weight:900; margin-bottom:3px; }
    .story-hook span, .story-twist span { display:block; color:var(--cream-dim); font-size:12px; line-height:1.55; }
    .story-twist { border-color:rgba(231,76,60,.2); } .story-twist b { color:#e67e22; }
    .case-roles-mini { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
    .case-role-mini { min-width:0; border-radius:12px; padding:9px 10px; border:1px solid rgba(255,255,255,.08); }
    .case-role-mini.red { background:rgba(231,76,60,.08); border-color:rgba(231,76,60,.22); } .case-role-mini.blue { background:rgba(52,152,219,.08); border-color:rgba(52,152,219,.22); }
    .case-role-mini span { display:block; font-size:10px; font-weight:900; margin-bottom:3px; } .case-role-mini.red span { color:#e74c3c; } .case-role-mini.blue span { color:#3498db; }
    .case-role-mini strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--cream); font-size:12px; font-weight:700; }
    .story-actions { margin-top:12px; display:grid; }
    .story-main { border:0; border-radius:13px; padding:12px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; font-size:13px; font-weight:900; cursor:pointer; }
    .case-enter-door { margin-top:12px; display:flex; align-items:center; justify-content:center; gap:7px; border-radius:13px; padding:10px; background:rgba(201,168,76,.1); color:var(--gold); font-size:13px; font-weight:900; }
    .door-knob { width:9px; height:9px; border-radius:50%; background:var(--gold); box-shadow:0 0 10px rgba(201,168,76,.5); }
    .case-empty-state { grid-column:1/-1; text-align:center; padding:44px 20px; border:1.5px dashed rgba(201,168,76,.28); border-radius:20px; background:rgba(255,255,255,.03); }
    .case-empty-icon { font-size:46px; margin-bottom:10px; } .case-empty-title { font-size:17px; font-weight:900; color:var(--cream); } .case-empty-sub { margin-top:5px; font-size:13px; color:var(--cream-dim); } .case-empty-btn { margin-top:18px; border:none; border-radius:13px; padding:12px 18px; background:var(--gold); color:#0d1117; font-weight:900; cursor:pointer; }
    @keyframes caseGlow { from { opacity:.45; transform:scale(.95); } to { opacity:1; transform:scale(1.05); } }
    @keyframes caseJudge { from { transform:translateY(0) rotate(-1deg); } to { transform:translateY(-4px) rotate(1deg); } }
    @keyframes caseCardIn { to { transform:translateY(0); opacity:1; } }
    @media (min-width:760px) { .case-door-grid { grid-template-columns:1fr 1fr; } .case-board-stage { height:230px; } }
    @media (max-width:420px) { .case-board-stage { height:190px; } .case-board-sign { width:120px; right:10px; } .case-board-clerk { left:14px; } .case-roles-mini { grid-template-columns:1fr; } .case-door-title { font-size:17px; } .official-pack-banner { align-items:flex-start; } .official-pack-banner button { display:none; } }
  `;
  document.head.appendChild(style);
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
function escAttr(s) { return escHtml(s); }
