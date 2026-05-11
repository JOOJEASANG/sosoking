const AVATARS = ['🧑‍💼','🙋','😎','🥺','😤','🕵️','🧑‍⚖️','👩‍💼','🧑‍💻','🐰'];
const EMOTIONS = [
  ['억울함 +2', '😤'],
  ['설득력 +1', '🧠'],
  ['공감 +2', '🥹'],
  ['드립력 +3', '🎭'],
  ['팩트 확인', '🔍'],
  ['방청석 술렁', '👥'],
  ['판사 주목', '👨‍⚖️'],
];

let observer = null;
let timer = null;
let typingTimer = null;
let lastBubbleCount = 0;

function bootCharacterGameUi() {
  injectStyle();
  scheduleEnhance();
  window.addEventListener('hashchange', () => {
    lastBubbleCount = 0;
    document.body.classList.remove('sosoking-typing-mode');
    scheduleEnhance();
  });
  document.addEventListener('focusin', handleTypingFocus, true);
  document.addEventListener('focusout', handleTypingBlur, true);
  if (!observer) {
    observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled'] });
  }
}

function handleTypingFocus(e) {
  if (!String(location.hash || '').startsWith('#/debate/')) return;
  if (!isTypingTarget(e.target)) return;
  clearTimeout(typingTimer);
  document.body.classList.add('sosoking-typing-mode');
  const panel = document.querySelector('.character-select-panel');
  if (panel) panel.classList.add('collapsed');
}

function handleTypingBlur() {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    if (!isTypingTarget(document.activeElement)) document.body.classList.remove('sosoking-typing-mode');
  }, 220);
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'textarea' || tag === 'input' || target.isContentEditable || Boolean(target.closest?.('.court-input-panel, .case-input-panel'));
}

function scheduleEnhance() {
  clearTimeout(timer);
  timer = setTimeout(enhance, 80);
}

function enhance() {
  const hash = String(location.hash || '#/');
  const active = hash.startsWith('#/town') || hash.startsWith('#/case-quest') || hash.startsWith('#/topic/') || hash.startsWith('#/debate/');
  document.body.classList.toggle('character-game-route', active);
  if (!active) {
    document.querySelector('.character-select-panel')?.remove();
    return;
  }
  renderCharacterPanel();
  applyAvatar();
  enhanceWaitingRoom();
  enhanceDebateReactions();
  enhanceQuestRewards();
}

function getAvatar() {
  try { return localStorage.getItem('sosoking_avatar') || '🧑‍💼'; } catch { return '🧑‍💼'; }
}

function setAvatar(icon) {
  try { localStorage.setItem('sosoking_avatar', icon); } catch {}
  applyAvatar();
  toast(`내 캐릭터가 ${icon} 로 변경됐습니다`);
}

function renderCharacterPanel() {
  if (document.querySelector('.character-select-panel')) return;
  const panel = document.createElement('aside');
  panel.className = 'character-select-panel collapsed';
  panel.innerHTML = `
    <button class="character-panel-toggle" title="내 캐릭터">${getAvatar()}</button>
    <div class="character-panel-body">
      <div class="character-panel-title">내 캐릭터</div>
      <div class="character-panel-sub">가상거리와 재판장에 반영됩니다</div>
      <div class="avatar-grid">
        ${AVATARS.map(a => `<button class="avatar-choice ${a === getAvatar() ? 'active' : ''}" data-avatar="${a}">${a}</button>`).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('.character-panel-toggle')?.addEventListener('click', () => panel.classList.toggle('collapsed'));
  panel.querySelectorAll('.avatar-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.avatar-choice').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      panel.querySelector('.character-panel-toggle').textContent = btn.dataset.avatar;
      setAvatar(btn.dataset.avatar);
    });
  });
}

function applyAvatar() {
  const avatar = getAvatar();
  const townHero = document.querySelector('.hero-char .char-body');
  if (townHero) townHero.textContent = avatar;

  const questPlayer = document.querySelector('.quest-player .npc-body');
  if (questPlayer) questPlayer.textContent = avatar;

  const waitingPlayer = document.querySelector('.waiting-side-preview.selected .waiting-avatar.player');
  if (waitingPlayer) waitingPlayer.textContent = avatar;

  const role = getActiveRole();
  const targetSelector = role === 'defendant'
    ? '.vc-defendant .vc-avatar span'
    : '.vc-plaintiff .vc-avatar span';
  const courtroomAvatar = document.querySelector(targetSelector);
  if (courtroomAvatar) courtroomAvatar.textContent = avatar;

  document.querySelectorAll('.character-select-panel .character-panel-toggle').forEach(el => { el.textContent = avatar; });
}

function getActiveRole() {
  try {
    const stored = JSON.parse(localStorage.getItem('sosoking_active_session') || 'null');
    return stored?.role || 'plaintiff';
  } catch { return 'plaintiff'; }
}

function enhanceWaitingRoom() {
  if (!String(location.hash || '').startsWith('#/topic/')) return;
  const root = document.querySelector('.waiting-room-page');
  if (!root) return;
  normalizeWaitingRoomText(root);
  const panel = root.querySelector('.case-file-panel');
  if (panel && panel.dataset.lifeCourtPatched !== '1') {
    panel.dataset.lifeCourtPatched = '1';
    const note = document.createElement('div');
    note.className = 'life-court-waiting-note';
    note.innerHTML = '<strong>📁 사건 기록 확인</strong><span>이 사건은 오락용 생활법정 사건입니다. 실제 인물이나 민감한 정보를 입력하지 마세요.</span>';
    panel.prepend(note);
  }
  const aiGate = root.querySelector('.entry-gate[data-mode="ai"]');
  if (aiGate) {
    aiGate.classList.add('life-ai-recommended');
    const strong = aiGate.querySelector('strong');
    const small = aiGate.querySelector('small');
    if (strong) strong.textContent = '혼자 AI 재판';
    if (small) small.textContent = '추천 · 바로 시작';
  }
  if (root.dataset.aiDefaultTried !== '1') {
    const plaintiff = root.querySelector('.character-choice[data-side="plaintiff"]');
    if (plaintiff && aiGate) {
      root.dataset.aiDefaultTried = '1';
      setTimeout(() => {
        if (!root.querySelector('.character-choice.active')) plaintiff.click();
        if (!root.querySelector('.entry-gate.active')) aiGate.click();
        const btn = document.getElementById('start-btn');
        if (btn && !btn.disabled) btn.textContent = '🤖 혼자 AI 재판 시작';
        applyAvatar();
      }, 120);
    }
  }
}

function normalizeWaitingRoomText(root) {
  const map = [
    [/원고 주장/g, '문제 제기 내용'],
    [/피고 주장/g, '상대측 설명'],
    [/억울함을 먼저 변론합니다/g, '사건의 문제점을 먼저 진술합니다'],
    [/상대 주장을 재치 있게 반론합니다/g, '상대측 사정을 설명합니다'],
    [/재판장 입장 게이트/g, '재판 방식 선택'],
    [/친구 게이트/g, '친구 재판'],
    [/랜덤 게이트/g, '랜덤 재판'],
    [/AI 게이트/g, '혼자 AI 재판'],
    [/팀 인원/g, '참여 인원'],
    [/변론 라운드/g, '사건 심리 단계'],
    [/끝장 변론/g, '집중 심리'],
    [/변론/g, '진술'],
    [/반론/g, '해명'],
    [/주장/g, '진술'],
    [/배틀/g, '재판'],
    [/토론/g, '사건 심리'],
    [/판정/g, '판결'],
  ];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !/[토론배틀변론반론주장판정게이트]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let text = node.nodeValue;
    map.forEach(([from, to]) => { text = text.replace(from, to); });
    node.nodeValue = text;
  });
}

function enhanceDebateReactions() {
  if (!String(location.hash || '').startsWith('#/debate/')) return;
  if (document.body.classList.contains('sosoking-typing-mode')) return;
  const bubbles = document.querySelectorAll('.argument-bubble');
  if (!bubbles.length || bubbles.length === lastBubbleCount) return;
  lastBubbleCount = bubbles.length;
  const latest = bubbles[bubbles.length - 1];
  if (!latest || latest.querySelector('.emotion-pop')) return;
  const [label, icon] = EMOTIONS[bubbles.length % EMOTIONS.length];
  const pop = document.createElement('div');
  pop.className = 'emotion-pop';
  pop.innerHTML = `<span>${icon}</span><strong>${label}</strong>`;
  latest.appendChild(pop);
  addTinyReactionBurst(latest);
}

function addTinyReactionBurst(target) {
  if (document.body.classList.contains('sosoking-typing-mode')) return;
  const rect = target.getBoundingClientRect();
  if (!rect.width) return;
  const layer = document.createElement('div');
  layer.className = 'tiny-reaction-burst';
  layer.style.left = `${rect.left + rect.width / 2}px`;
  layer.style.top = `${rect.top + 16}px`;
  layer.innerHTML = ['👏','😂','😮','⚖️','✨'].map((x, i) => `<i style="--i:${i}">${x}</i>`).join('');
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1300);
}

function enhanceQuestRewards() {
  if (!String(location.hash || '').startsWith('#/case-quest')) return;
  const card = document.querySelector('#quest-card');
  if (!card || card.dataset.rewardEnhanced === '1') return;
  card.dataset.rewardEnhanced = '1';
  const badge = document.createElement('div');
  badge.className = 'quest-reward-badge';
  badge.innerHTML = `<span>🎮</span><strong>퀘스트 진행 중</strong><small>입력할 때마다 사건 기록이 완성됩니다</small>`;
  card.prepend(badge);
}

function toast(message) {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast success show';
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function injectStyle() {
  if (document.getElementById('character-game-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'character-game-ui-style';
  style.textContent = `
    .character-select-panel { position:fixed; right:12px; top:82px; z-index:7000; width:218px; border:1.5px solid rgba(201,168,76,.36); border-radius:18px; background:rgba(13,17,23,.88); backdrop-filter:blur(14px); box-shadow:0 14px 34px rgba(0,0,0,.28); overflow:hidden; transition:transform .22s ease, width .22s ease, background .22s ease, opacity .18s ease; }
    [data-theme="light"] .character-select-panel { background:rgba(255,248,242,.88); box-shadow:0 10px 28px rgba(154,112,24,.16); }
    .character-select-panel.collapsed { width:52px; height:52px; border-radius:50%; }
    .character-panel-toggle { width:52px; height:52px; border:0; background:linear-gradient(135deg,rgba(201,168,76,.25),rgba(255,255,255,.04)); color:var(--cream); font-size:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; float:left; }
    .character-panel-body { padding:12px 12px 14px 62px; }
    .character-select-panel.collapsed .character-panel-body { display:none; }
    .character-panel-title { color:var(--gold); font-size:12px; font-weight:900; letter-spacing:.04em; }
    .character-panel-sub { margin-top:2px; color:var(--cream-dim); font-size:10px; line-height:1.35; }
    .avatar-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; margin-top:10px; }
    .avatar-choice { width:26px; height:26px; border-radius:9px; border:1px solid rgba(201,168,76,.18); background:rgba(255,255,255,.05); cursor:pointer; font-size:16px; }
    .avatar-choice.active { background:var(--gold); box-shadow:0 0 0 3px rgba(201,168,76,.16); }
    .emotion-pop { position:absolute; right:10px; top:-18px; z-index:20; display:inline-flex; align-items:center; gap:5px; padding:5px 9px; border-radius:999px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; box-shadow:0 8px 18px rgba(0,0,0,.24); animation:emotionPop .9s cubic-bezier(.34,1.56,.64,1) both; pointer-events:none; }
    .emotion-pop span { font-size:14px; } .emotion-pop strong { font-size:11px; font-weight:900; white-space:nowrap; }
    .tiny-reaction-burst { position:fixed; z-index:9000; pointer-events:none; transform:translate(-50%,-50%); }
    .tiny-reaction-burst i { position:absolute; font-style:normal; font-size:20px; animation:tinyBurst 1.15s ease-out forwards; animation-delay:calc(var(--i) * .04s); }
    .quest-reward-badge { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding:11px 12px; border-radius:16px; border:1.5px solid rgba(201,168,76,.25); background:linear-gradient(135deg,rgba(201,168,76,.11),rgba(255,255,255,.03)); }
    .quest-reward-badge span { font-size:24px; } .quest-reward-badge strong { display:block; color:var(--gold); font-size:12px; } .quest-reward-badge small { display:block; color:var(--cream-dim); font-size:10px; margin-top:2px; }
    .life-court-waiting-note { margin-bottom:13px; padding:12px 13px; border-radius:15px; border:1.5px solid rgba(201,168,76,.26); background:linear-gradient(135deg,rgba(201,168,76,.1),rgba(255,255,255,.03)); }
    .life-court-waiting-note strong { display:block; color:var(--gold); font-size:12px; margin-bottom:4px; }
    .life-court-waiting-note span { display:block; color:var(--cream-dim); font-size:12px; line-height:1.55; }
    .entry-gate.life-ai-recommended { border-color:var(--gold) !important; background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(255,255,255,.04)) !important; box-shadow:0 0 0 3px rgba(201,168,76,.14),0 10px 26px rgba(0,0,0,.18); }
    .entry-gate.life-ai-recommended::after { content:'추천'; position:absolute; top:7px; right:7px; border-radius:999px; padding:2px 7px; background:var(--gold); color:#0d1117; font-size:10px; font-weight:900; }
    .character-game-route .hero-char .char-body, .character-game-route .quest-player .npc-body, .character-game-route .waiting-avatar.player, .character-game-route .vc-avatar span { transition:transform .18s ease, filter .18s ease; }
    .character-game-route .hero-char:hover .char-body, .character-game-route .quest-player:hover .npc-body, .character-game-route .waiting-avatar.player:hover, .character-game-route .vc-avatar:hover span { transform:scale(1.12) rotate(-4deg); filter:drop-shadow(0 12px 14px rgba(201,168,76,.32)); }
    body.sosoking-typing-mode .character-select-panel { opacity:0 !important; pointer-events:none !important; transform:translateY(14px) scale(.88) !important; }
    body.sosoking-typing-mode .emotion-pop, body.sosoking-typing-mode .tiny-reaction-burst, body.sosoking-typing-mode .soso-3d-particles { display:none !important; }
    body.sosoking-typing-mode .court-input-panel, body.sosoking-typing-mode .case-input-panel { position:relative !important; z-index:9500 !important; transform:none !important; }
    body.sosoking-typing-mode textarea, body.sosoking-typing-mode input { position:relative !important; z-index:9501 !important; transform:none !important; }
    body.sosoking-typing-mode .vc-stage, body.sosoking-typing-mode .courtroom-3d-stage { opacity:.72; pointer-events:none; }
    body.sosoking-typing-mode .debate-feed { padding-bottom:240px !important; }
    @keyframes emotionPop { 0% { opacity:0; transform:translateY(8px) scale(.72) rotate(-4deg); } 58% { opacity:1; transform:translateY(-4px) scale(1.08) rotate(2deg); } 100% { opacity:1; transform:translateY(0) scale(1) rotate(0); } }
    @keyframes tinyBurst { 0% { opacity:0; transform:translate(0,0) scale(.5); } 20% { opacity:1; } 100% { opacity:0; transform:translate(calc((var(--i) - 2) * 20px), -62px) scale(1.25) rotate(calc(var(--i) * 28deg)); } }
    @media (max-width:520px) { .character-select-panel { top:74px; bottom:auto; right:10px; } .character-select-panel:not(.collapsed) { width:205px; } .emotion-pop { right:4px; top:-22px; } }
  `;
  document.head.appendChild(style);
}

bootCharacterGameUi();
