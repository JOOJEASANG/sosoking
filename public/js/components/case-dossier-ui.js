import { STORY_CASE_PACK } from '../data/story-case-pack.js';

let observer = null;
let timer = null;

const CATEGORY_EVIDENCE = {
  '카톡': ['📱 읽음 시간 기록', '대화 흐름과 반응 간격을 확인했습니다. 말보다 침묵이 더 크게 작용한 정황이 있습니다.'],
  '음식': ['🍽️ 현장 음식 기록', '남은 음식의 위치와 당시 발언을 대조했습니다. 마지막 선택의 소유권이 애매합니다.'],
  '정산': ['🧾 정산표', '금액 자체보다 사전에 기준을 말했는지가 판결 포인트로 보입니다.'],
  '직장': ['💼 공용공간 기록', '개인 불편과 공동 규칙이 충돌한 사건입니다. 기준이 없어서 갈등이 커졌습니다.'],
  '생활': ['🏠 생활 현장 기록', '공용 공간 또는 공용 물건에 대한 암묵적 기준이 서로 달랐습니다.'],
  '연애': ['💘 감정 온도 기록', '사실관계보다 상대가 기대한 배려 수준이 핵심 쟁점입니다.'],
  '친구': ['👫 관계 기록', '친구 사이의 편함이 책임 회피로 보였는지 확인할 필요가 있습니다.'],
  '취미': ['🎮 취미 활동 기록', '재미를 함께 즐기는 과정에서 한쪽의 기대가 무너진 정황이 있습니다.'],
  '이웃': ['🏘️ 공동생활 기록', '공용 공간에서 잠깐의 선택이 다른 사람에게 불편으로 이어졌습니다.'],
  '가족': ['👨‍👩‍👧 가족 규칙 기록', '가족이라는 이유로 허용되는 범위와 개인 권리의 경계가 쟁점입니다.']
};

function bootCaseDossierUi() {
  injectStyle();
  window.addEventListener('hashchange', schedule);
  schedule();
  if (!observer) {
    observer = new MutationObserver(schedule);
    observer.observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(renderIfNeeded, 120);
}

function renderIfNeeded() {
  if (!String(location.hash || '').startsWith('#/debate/')) {
    document.querySelector('.case-dossier-panel')?.remove();
    return;
  }
  const textarea = findTextarea();
  if (!textarea) return;
  const inputArea = textarea.closest('.debate-input-area, .input-area, .court-input-panel, .case-input-panel, form, div') || textarea.parentElement;
  if (!inputArea || inputArea.querySelector('.case-dossier-panel')) return;

  const topic = getTopicTitle();
  const story = findStory(topic);
  const panel = document.createElement('section');
  panel.className = 'case-dossier-panel';
  panel.innerHTML = renderPanel(story, topic);

  const rolePanel = inputArea.querySelector('.role-play-panel');
  if (rolePanel) inputArea.insertBefore(panel, rolePanel);
  else inputArea.prepend(panel);

  bindPanel(panel, textarea, story, topic);
  updateMeters(panel);
}

function findTextarea() {
  return [...document.querySelectorAll('#page-content textarea, textarea')]
    .find(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 30 && rect.height > 25 && style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled && !el.readOnly;
    }) || null;
}

function getTopicTitle() {
  const candidates = [
    '.debate-topic-name', '#debate-topic-bar', '.court-topic-title', '.topic-title', '.case-file-title', 'h1', 'h2'
  ];
  for (const sel of candidates) {
    const text = document.querySelector(sel)?.textContent?.replace(/^📋\s*/, '').trim();
    if (text && text.length > 3) return text;
  }
  return '';
}

function findStory(topic) {
  const clean = s => String(s || '').replace(/\s/g, '');
  const key = clean(topic);
  if (!key) return null;
  return STORY_CASE_PACK.find(c => key.includes(clean(c.title)) || clean(c.title).includes(key)) || null;
}

function getEvidence(story, topic) {
  const title = story?.title || topic || '생활법정 사건';
  const category = story?.category || '생활';
  const [catName, catText] = CATEGORY_EVIDENCE[category] || CATEGORY_EVIDENCE['생활'];
  return [
    {
      icon: '📁',
      name: '사건 발단 기록',
      text: story?.hook || `${title}의 시작점을 다시 확인했습니다. 처음 한마디가 사건의 분위기를 바꿨습니다.`,
      stat: '증거력 +2',
      type: 'evidence'
    },
    {
      icon: '🔄',
      name: '반전 포인트',
      text: story?.twist || '겉으로 보이는 잘못과 달리, 상대측에도 참작할 만한 사정이 발견됐습니다.',
      stat: '반전력 +2',
      type: 'twist'
    },
    {
      icon: catName.slice(0, 2),
      name: catName.replace(/^\p{Emoji_Presentation}/u, '') || '추가 증거',
      text: catText,
      stat: '판결자료 +1',
      type: 'category'
    }
  ];
}

function renderPanel(story, topic) {
  const evidence = getEvidence(story, topic);
  const title = story?.title || topic || '현재 사건';
  const difficulty = story?.difficulty || '생활 사건';
  return `
    <div class="dossier-head">
      <div>
        <div class="dossier-kicker">CASE DOSSIER</div>
        <strong>🕵️ 수사수첩 · ${esc(difficulty)}</strong>
        <small>${esc(title)}</small>
      </div>
      <button class="dossier-toggle" type="button">접기</button>
    </div>
    <div class="dossier-body">
      <div class="dossier-meters">
        ${meterHtml('증거력', 'evidence')}
        ${meterHtml('방청석 반응', 'audience')}
        ${meterHtml('판사 주목도', 'judge')}
      </div>
      <div class="dossier-evidence-list">
        ${evidence.map((ev, idx) => `
          <button type="button" class="dossier-evidence" data-evidence-index="${idx}">
            <span class="evidence-icon">${esc(ev.icon)}</span>
            <span class="evidence-body"><b>${esc(ev.name)}</b><small>${esc(ev.text)}</small></span>
            <i>${esc(ev.stat)}</i>
          </button>
        `).join('')}
      </div>
      <div class="dossier-audience">
        <b>👥 방청석</b>
        <span>${esc(getAudienceLine(story))}</span>
      </div>
    </div>
  `;
}

function meterHtml(label, key) {
  return `<div class="dossier-meter" data-meter="${key}"><span>${label}</span><div><i style="width:0%"></i></div><b>0</b></div>`;
}

function bindPanel(panel, textarea, story, topic) {
  panel.querySelector('.dossier-toggle')?.addEventListener('click', () => panel.classList.toggle('collapsed'));
  const evidence = getEvidence(story, topic);
  panel.querySelectorAll('.dossier-evidence').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = evidence[Number(btn.dataset.evidenceIndex)];
      if (!item) return;
      appendEvidence(textarea, item);
      bumpStats(item.type);
      updateMeters(panel);
      pop(panel, item.stat, reactionFor(item.type));
    });
  });
}

function appendEvidence(textarea, item) {
  const prefix = `[증거 제출: ${item.name}] `;
  const add = `${prefix}${item.text}`;
  const hasValue = textarea.value.trim().length > 0;
  const next = hasValue ? `${textarea.value.trim()}\n\n${add}` : add;
  const max = textarea.maxLength && textarea.maxLength > 0 ? textarea.maxLength : 800;
  textarea.value = next.slice(0, max);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  textarea.focus();
  try { textarea.setSelectionRange(textarea.value.length, textarea.value.length); } catch {}
}

function storageKey() {
  const sessionId = String(location.hash || '').split('/').pop() || 'local';
  return `sosoking_dossier_${sessionId}`;
}

function getStats() {
  try { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); } catch { return {}; }
}

function saveStats(stats) {
  try { localStorage.setItem(storageKey(), JSON.stringify(stats)); } catch {}
}

function bumpStats(type) {
  const stats = { evidence: 0, audience: 0, judge: 0, ...getStats() };
  if (type === 'evidence') { stats.evidence += 24; stats.judge += 12; }
  else if (type === 'twist') { stats.evidence += 16; stats.audience += 22; stats.judge += 10; }
  else { stats.evidence += 12; stats.audience += 12; stats.judge += 14; }
  stats.evidence = Math.min(100, stats.evidence);
  stats.audience = Math.min(100, stats.audience);
  stats.judge = Math.min(100, stats.judge);
  saveStats(stats);
}

function updateMeters(panel) {
  const stats = { evidence: 0, audience: 0, judge: 0, ...getStats() };
  panel.querySelectorAll('.dossier-meter').forEach(meter => {
    const key = meter.dataset.meter;
    const value = Math.max(0, Math.min(100, Number(stats[key] || 0)));
    meter.querySelector('i').style.width = `${value}%`;
    meter.querySelector('b').textContent = value;
  });
}

function reactionFor(type) {
  if (type === 'evidence') return '판사가 증거 기록을 넘겨봅니다';
  if (type === 'twist') return '방청석이 반전 포인트에 술렁입니다';
  return '사건의 판결자료가 보강됐습니다';
}

function pop(panel, stat, line) {
  panel.querySelector('.dossier-pop')?.remove();
  const el = document.createElement('div');
  el.className = 'dossier-pop';
  el.innerHTML = `<strong>${esc(stat)}</strong><span>${esc(line)}</span>`;
  panel.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

function getAudienceLine(story) {
  const category = story?.category || '생활';
  const lines = {
    '카톡': '읽음 표시가 나오자 방청석이 동시에 조용해집니다.',
    '음식': '음식 사건은 언제나 방청석의 몰입도가 높습니다.',
    '정산': '계산 이야기가 나오자 모두가 갑자기 진지해집니다.',
    '직장': '사무실 사람들은 이미 각자의 편을 정한 듯합니다.',
    '생활': '사소해 보였던 생활 규칙이 의외로 큰 쟁점이 됩니다.',
    '연애': '방청석이 웃다가도 갑자기 공감하는 분위기입니다.',
    '친구': '친구 사이니까 더 애매하다는 반응이 나옵니다.',
    '취미': '취미를 망친 순간은 생각보다 엄중하게 받아들여집니다.',
    '이웃': '공동생활 예절 문제에 방청석이 고개를 끄덕입니다.',
    '가족': '가족이라서 괜찮다는 말에 반대석이 술렁입니다.'
  };
  return lines[category] || lines['생활'];
}

function injectStyle() {
  if (document.getElementById('case-dossier-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'case-dossier-ui-style';
  style.textContent = `
    .case-dossier-panel { position:relative; z-index:31; margin:0 0 10px; padding:12px; border-radius:18px; border:1.5px solid rgba(201,168,76,.32); background:linear-gradient(145deg,rgba(16,24,38,.86),rgba(201,168,76,.08)); box-shadow:0 10px 28px rgba(0,0,0,.18); }
    [data-theme="light"] .case-dossier-panel { background:linear-gradient(145deg,rgba(255,255,255,.9),rgba(201,168,76,.08)); }
    .dossier-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .dossier-kicker { color:var(--gold); font-size:9px; font-weight:900; letter-spacing:.14em; margin-bottom:2px; }
    .dossier-head strong { display:block; color:var(--cream); font-size:13px; line-height:1.35; }
    .dossier-head small { display:block; margin-top:2px; color:var(--cream-dim); font-size:11px; line-height:1.35; }
    .dossier-toggle { border:1px solid rgba(201,168,76,.22); border-radius:999px; background:rgba(255,255,255,.04); color:var(--cream-dim); font-size:11px; font-weight:900; padding:6px 9px; cursor:pointer; }
    .dossier-meters { display:grid; gap:6px; margin-bottom:10px; }
    .dossier-meter { display:grid; grid-template-columns:76px 1fr 28px; align-items:center; gap:7px; }
    .dossier-meter span { color:var(--cream-dim); font-size:10px; font-weight:900; }
    .dossier-meter div { height:8px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.08); border:1px solid rgba(201,168,76,.12); }
    .dossier-meter i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--gold),var(--gold-light)); transition:width .28s ease; }
    .dossier-meter b { color:var(--gold); font-size:10px; text-align:right; }
    .dossier-evidence-list { display:grid; gap:7px; }
    .dossier-evidence { width:100%; display:flex; align-items:center; gap:9px; text-align:left; border:1px solid rgba(201,168,76,.18); border-radius:13px; padding:10px; background:rgba(255,255,255,.04); cursor:pointer; }
    [data-theme="light"] .dossier-evidence { background:rgba(255,255,255,.72); }
    .dossier-evidence:hover { border-color:var(--gold); transform:translateY(-1px); }
    .evidence-icon { width:32px; height:32px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:11px; background:rgba(201,168,76,.13); font-size:18px; }
    .evidence-body { flex:1; min-width:0; }
    .evidence-body b { display:block; color:var(--cream); font-size:12px; margin-bottom:2px; }
    .evidence-body small { display:block; color:var(--cream-dim); font-size:11px; line-height:1.45; }
    .dossier-evidence i { flex-shrink:0; color:var(--gold); font-size:10px; font-style:normal; font-weight:900; }
    .dossier-audience { margin-top:9px; padding:9px 10px; border-radius:12px; border:1px dashed rgba(201,168,76,.24); color:var(--cream-dim); font-size:11px; line-height:1.45; }
    .dossier-audience b { display:block; color:var(--gold); font-size:10px; margin-bottom:3px; }
    .dossier-pop { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:999px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; box-shadow:0 10px 24px rgba(0,0,0,.26); animation:dossierPop 1.6s ease both; z-index:100; white-space:nowrap; }
    .dossier-pop strong { font-size:12px; } .dossier-pop span { font-size:11px; font-weight:800; opacity:.86; }
    .case-dossier-panel.collapsed .dossier-body { display:none; }
    @keyframes dossierPop { 0% { opacity:0; transform:translate(-50%, 10px) scale(.88); } 18% { opacity:1; transform:translate(-50%, 0) scale(1); } 82% { opacity:1; transform:translate(-50%, 0) scale(1); } 100% { opacity:0; transform:translate(-50%, -8px) scale(.96); } }
    @media (max-width:480px) { .case-dossier-panel { padding:10px; border-radius:16px; } .dossier-meter { grid-template-columns:68px 1fr 24px; gap:6px; } .dossier-evidence { align-items:flex-start; } .dossier-evidence i { display:none; } .dossier-pop { max-width:calc(100vw - 28px); white-space:normal; justify-content:center; text-align:center; } }
  `;
  document.head.appendChild(style);
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }

bootCaseDossierUi();
