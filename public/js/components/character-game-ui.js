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
let lastBubbleCount = 0;

function bootCharacterGameUi() {
  injectStyle();
  scheduleEnhance();
  window.addEventListener('hashchange', () => {
    lastBubbleCount = 0;
    scheduleEnhance();
  });
  if (!observer) {
    observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true, characterData: true });
  }
}

function scheduleEnhance() {
  clearTimeout(timer);
  timer = setTimeout(enhance, 80);
}

function enhance() {
  const hash = String(location.hash || '#/');
  const active = hash.startsWith('#/town') || hash.startsWith('#/case-quest') || hash.startsWith('#/debate/');
  document.body.classList.toggle('character-game-route', active);
  if (!active) {
    document.querySelector('.character-select-panel')?.remove();
    return;
  }
  renderCharacterPanel();
  applyAvatar();
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

function enhanceDebateReactions() {
  if (!String(location.hash || '').startsWith('#/debate/')) return;
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
    .character-select-panel { position:fixed; right:12px; top:82px; z-index:7000; width:218px; border:1.5px solid rgba(201,168,76,.36); border-radius:18px; background:rgba(13,17,23,.88); backdrop-filter:blur(14px); box-shadow:0 14px 34px rgba(0,0,0,.28); overflow:hidden; transition:transform .22s ease, width .22s ease, background .22s ease; }
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
    .character-game-route .hero-char .char-body, .character-game-route .quest-player .npc-body, .character-game-route .vc-avatar span { transition:transform .18s ease, filter .18s ease; }
    .character-game-route .hero-char:hover .char-body, .character-game-route .quest-player:hover .npc-body, .character-game-route .vc-avatar:hover span { transform:scale(1.12) rotate(-4deg); filter:drop-shadow(0 12px 14px rgba(201,168,76,.32)); }
    @keyframes emotionPop { 0% { opacity:0; transform:translateY(8px) scale(.72) rotate(-4deg); } 58% { opacity:1; transform:translateY(-4px) scale(1.08) rotate(2deg); } 100% { opacity:1; transform:translateY(0) scale(1) rotate(0); } }
    @keyframes tinyBurst { 0% { opacity:0; transform:translate(0,0) scale(.5); } 20% { opacity:1; } 100% { opacity:0; transform:translate(calc((var(--i) - 2) * 20px), -62px) scale(1.25) rotate(calc(var(--i) * 28deg)); } }
    @media (max-width:520px) { .character-select-panel { top:auto; bottom:86px; right:10px; } .character-select-panel:not(.collapsed) { width:205px; } .emotion-pop { right:4px; top:-22px; } }
  `;
  document.head.appendChild(style);
}

bootCharacterGameUi();
