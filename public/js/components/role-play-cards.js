import { STORY_CASE_PACK } from '../data/story-case-pack.js';

const ROLES = [
  { id: 'police', icon: '🚓', name: '경찰', desc: '증거를 찾고 사건을 정리합니다', stat: '증거력' },
  { id: 'prosecutor', icon: '🧑‍💼', name: '검사', desc: '수상한 부분을 날카롭게 추궁합니다', stat: '추궁력' },
  { id: 'lawyer', icon: '⚖️', name: '변호사', desc: '한쪽 입장을 설득력 있게 방어합니다', stat: '설득력' },
  { id: 'witness', icon: '👀', name: '증인', desc: '현장 목격담으로 분위기를 뒤집습니다', stat: '현장감' },
  { id: 'judge', icon: '👨‍⚖️', name: '예비 판사', desc: 'AI 판결 전 결과를 예측합니다', stat: '판결감' },
];

const DEFAULT_CARDS = {
  police: [
    '증거물 1호를 확인했습니다. 겉보기엔 사소하지만 사건의 흐름을 바꿀 단서가 있습니다.',
    '당시 상황을 시간순으로 정리하면, 말보다 행동이 먼저 움직인 정황이 보입니다.',
    '목격자 진술과 현장 기록을 대조한 결과, 양쪽 모두 억울할 만한 부분이 확인됩니다.'
  ],
  prosecutor: [
    '왜 그 순간 상대방에게 한 번만 확인하지 않았습니까? 이 부분이 사건의 핵심입니다.',
    '피고 측 설명은 이해하지만, 행동 직전의 망설임이 있었다는 점은 쉽게 넘기기 어렵습니다.',
    '상대방이 서운할 수 있다는 사실을 알고도 그대로 행동한 것은 아닌지 묻고 싶습니다.'
  ],
  lawyer: [
    '이 사건은 고의적인 무시라기보다 서로 기대한 기준이 달라 생긴 오해에 가깝습니다.',
    '의뢰인의 행동은 완벽하진 않았지만, 당시 상황에서는 충분히 그렇게 판단할 여지가 있었습니다.',
    '감정은 상했지만 악의가 있었다고 보기 어렵고, 화해 가능한 생활사건으로 봐야 합니다.'
  ],
  witness: [
    '제가 본 바로는 그 순간 공기가 갑자기 조용해졌고, 모두가 눈치를 보기 시작했습니다.',
    '양쪽 다 할 말은 있어 보였지만, 아무도 먼저 정확히 말하지 않은 게 문제였습니다.',
    '현장 분위기는 웃기면서도 묘하게 진지했고, 방청석이 술렁일 만한 장면이었습니다.'
  ],
  judge: [
    '예비 판단으로는 한쪽의 완승보다는 쌍방 주의와 가벼운 화해 미션이 적절해 보입니다.',
    '현재까지의 기록만 보면 원고 측 억울함은 인정되나, 피고 측 사정도 일부 참작됩니다.',
    '이 사건은 법보다 센스의 문제입니다. 판결보다 다음 행동이 더 중요해 보입니다.'
  ]
};

const ROLE_REACTIONS = {
  police: ['증거력 +2', '판사가 증거 기록을 유심히 봅니다', '방청석이 단서에 술렁입니다'],
  prosecutor: ['추궁력 +2', '상대측이 잠시 당황합니다', '판사가 질문을 기록합니다'],
  lawyer: ['설득력 +2', '방어 논리가 정리됩니다', '판사가 정상참작 가능성을 봅니다'],
  witness: ['현장감 +2', '방청석 반응이 커집니다', '사건 장면이 선명해집니다'],
  judge: ['판결감 +2', 'AI 판결과 비교할 예측이 생겼습니다', '판사가 고개를 끄덕입니다']
};

let observer = null;
let timer = null;
let selectedRole = '';

function bootRolePlayCards() {
  injectStyle();
  window.addEventListener('hashchange', () => {
    selectedRole = '';
    schedule();
  });
  schedule();
  if (!observer) {
    observer = new MutationObserver(schedule);
    observer.observe(document.getElementById('page-content') || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'style', 'class']
    });
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(renderIfNeeded, 100);
}

function renderIfNeeded() {
  if (!String(location.hash || '').startsWith('#/debate/')) {
    document.querySelector('.role-play-panel')?.remove();
    return;
  }

  const textarea = findActiveTextarea();
  if (!textarea) {
    document.querySelector('.role-play-panel')?.remove();
    return;
  }

  const inputArea = findInputArea(textarea);
  if (!inputArea) return;

  let panel = inputArea.querySelector('.role-play-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'role-play-panel';
    inputArea.prepend(panel);
  }
  drawPanel(panel, textarea);
}

function findActiveTextarea() {
  const nodes = [...document.querySelectorAll('#debate-root textarea, #page-content textarea, textarea')];
  return nodes.find(el => isVisible(el) && !el.disabled && !el.readOnly) || null;
}

function findInputArea(textarea) {
  return textarea.closest('.debate-input-area, .input-area, .court-input-panel, .case-input-panel, form, div') || textarea.parentElement;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 20 && rect.height > 20 && style.display !== 'none' && style.visibility !== 'hidden';
}

function drawPanel(panel, textarea) {
  const topic = getCurrentTopic();
  const item = findStoryCase(topic);
  const role = selectedRole || 'police';
  selectedRole = role;
  const cards = buildCards(role, item, topic);

  panel.innerHTML = `
    <div class="role-play-head">
      <div>
        <div class="role-play-kicker">ROLE PLAY MODE</div>
        <strong>역할을 골라 사건을 진행하세요</strong>
      </div>
      <button class="role-play-hide" type="button">접기</button>
    </div>
    <div class="role-tabs">
      ${ROLES.map(r => `<button type="button" class="role-tab ${r.id === role ? 'active' : ''}" data-role="${r.id}"><span>${r.icon}</span><b>${r.name}</b></button>`).join('')}
    </div>
    <div class="role-desc">${roleInfo(role).icon} <b>${roleInfo(role).name}</b> · ${roleInfo(role).desc}</div>
    <div class="role-card-list">
      ${cards.map((text, idx) => `<button type="button" class="role-card" data-card-index="${idx}"><small>${cardLabel(role, idx)}</small><span>${esc(text)}</span></button>`).join('')}
    </div>
    ${item ? `<div class="role-case-hint"><b>사건 힌트</b><span>${esc(item.hook || item.summary || topic)}</span></div>` : ''}
  `;

  panel.querySelector('.role-play-hide')?.addEventListener('click', () => panel.classList.toggle('collapsed'));
  panel.querySelectorAll('.role-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRole = btn.dataset.role;
      drawPanel(panel, textarea);
    });
  });
  panel.querySelectorAll('.role-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = cards[Number(btn.dataset.cardIndex)] || '';
      applyCardToTextarea(textarea, role, text);
      flashReaction(panel, role);
    });
  });
}

function buildCards(role, item, topic) {
  const base = [...(DEFAULT_CARDS[role] || DEFAULT_CARDS.police)];
  if (!item) return base;
  if (role === 'police') {
    return [
      `사건 발단을 조사했습니다. ${item.hook || item.summary} 이 기록은 단순한 말다툼이 아니라 판결에 영향을 줄 단서입니다.`,
      `반전 포인트를 확인했습니다. ${item.twist || '양쪽 모두 억울할 만한 사정이 있습니다.'} 이 부분은 추가 심리가 필요합니다.`,
      `${item.title}의 핵심은 누가 완전히 맞느냐가 아니라, 그 순간 서로 확인하지 않은 빈틈에 있습니다.`
    ];
  }
  if (role === 'prosecutor') {
    return [
      `이 사건에서 묻고 싶습니다. ${item.defendantPosition || '상대측 설명'} 그렇다면 왜 먼저 확인하거나 설명하지 않았습니까?`,
      `${item.twist || item.hook || topic} 이 부분을 보면 상대측 설명에도 빈틈이 있습니다. 그냥 넘어가기 어렵습니다.`,
      `상대방이 서운할 수 있다는 걸 예상할 수 있었는데도 행동했다면, 최소한 사후 설명은 더 빨랐어야 합니다.`
    ];
  }
  if (role === 'lawyer') {
    return [
      `${item.defendantPosition || '상대측 설명'} 이 입장에도 나름의 사정이 있습니다. 고의보다 오해에 가까운 사건입니다.`,
      `${item.twist || '반전 포인트'}를 보면 한쪽만 일방적으로 몰아가기 어렵습니다. 정상참작이 필요합니다.`,
      `이 사건은 처벌보다 재발방지 약속이 중요합니다. 다음에는 미리 확인하는 규칙을 정하는 것이 적절합니다.`
    ];
  }
  if (role === 'witness') {
    return [
      `제가 본 현장은 이렇습니다. ${item.hook || item.summary} 그 순간 분위기가 갑자기 법정처럼 조용해졌습니다.`,
      `${item.twist || '나중에 드러난 반전'} 때문에 방청석 분위기가 한 번 뒤집혔습니다. 양쪽 모두 표정이 복잡했습니다.`,
      `현장감 있게 말하면, 이 사건은 사소해 보였지만 당사자들에겐 꽤 진지한 문제였습니다.`
    ];
  }
  if (role === 'judge') {
    return [
      `예비 판결: ${item.plaintiffPosition ? '원고 측 사정은 인정됩니다.' : '원고 측 일부 인정.'} 다만 ${item.defendantPosition ? '피고 측 설명도 일부 참작됩니다.' : '상대측 사정도 확인해야 합니다.'}`,
      `현재 기록상 ${item.title}은 한쪽 완승보다 쌍방 주의와 화해 미션이 어울리는 생활법정 사건입니다.`,
      `AI 판사에게 넘기기 전 제 예측은 쌍방 화해 권고입니다. 이 사건은 법보다 센스가 더 컸습니다.`
    ];
  }
  return base;
}

function applyCardToTextarea(textarea, role, text) {
  const prefix = `[${roleInfo(role).icon} ${roleInfo(role).name} 기록] `;
  const value = `${prefix}${text}`.slice(0, textarea.maxLength && textarea.maxLength > 0 ? textarea.maxLength : 500);
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  textarea.focus();
  try { textarea.setSelectionRange(textarea.value.length, textarea.value.length); } catch {}
}

function flashReaction(panel, role) {
  const existing = panel.querySelector('.role-reaction-pop');
  if (existing) existing.remove();
  const reactions = ROLE_REACTIONS[role] || ROLE_REACTIONS.police;
  const pop = document.createElement('div');
  pop.className = 'role-reaction-pop';
  pop.innerHTML = `<strong>${esc(reactions[0])}</strong><span>${esc(reactions[1])}</span>`;
  panel.appendChild(pop);
  setTimeout(() => pop.remove(), 1600);
}

function getCurrentTopic() {
  const raw = document.querySelector('.debate-topic-name')?.textContent || document.querySelector('#debate-topic-bar')?.textContent || '';
  return raw.replace(/^📋\s*/, '').trim();
}

function findStoryCase(topic) {
  const normalized = String(topic || '').replace(/\s/g, '');
  if (!normalized) return null;
  return STORY_CASE_PACK.find(c => normalized.includes(String(c.title || '').replace(/\s/g, '')) || String(c.title || '').replace(/\s/g, '').includes(normalized));
}

function roleInfo(id) { return ROLES.find(r => r.id === id) || ROLES[0]; }
function cardLabel(role, idx) {
  const labels = {
    police: ['증거 조사', '반전 확인', '상황 정리'],
    prosecutor: ['핵심 추궁', '모순 제기', '책임 확인'],
    lawyer: ['정상참작', '방어 논리', '화해 제안'],
    witness: ['목격담', '반전 증언', '현장 분위기'],
    judge: ['예비 판결', '판결 방향', '화해 예측'],
  };
  return labels[role]?.[idx] || `카드 ${idx + 1}`;
}
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }

function injectStyle() {
  if (document.getElementById('role-play-cards-style')) return;
  const style = document.createElement('style');
  style.id = 'role-play-cards-style';
  style.textContent = `
    .role-play-panel { margin:0 0 10px; padding:12px; border-radius:18px; border:1.5px solid rgba(201,168,76,.3); background:linear-gradient(145deg,rgba(201,168,76,.12),rgba(255,255,255,.035)); box-shadow:0 10px 28px rgba(0,0,0,.18); position:relative; z-index:30; }
    .role-play-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .role-play-kicker { color:var(--gold); font-size:9px; font-weight:900; letter-spacing:.12em; margin-bottom:2px; }
    .role-play-head strong { color:var(--cream); font-size:13px; }
    .role-play-hide { border:1px solid rgba(201,168,76,.22); border-radius:999px; background:rgba(255,255,255,.04); color:var(--cream-dim); font-size:11px; font-weight:900; padding:6px 9px; cursor:pointer; }
    .role-tabs { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:9px; }
    .role-tab { min-width:0; border:1px solid rgba(201,168,76,.18); border-radius:12px; background:rgba(255,255,255,.04); color:var(--cream-dim); padding:8px 4px; cursor:pointer; }
    .role-tab span { display:block; font-size:20px; line-height:1; margin-bottom:4px; }
    .role-tab b { display:block; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .role-tab.active { background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; border-color:transparent; box-shadow:0 0 0 3px rgba(201,168,76,.13); }
    .role-desc { margin-bottom:9px; padding:9px 10px; border-radius:12px; background:rgba(0,0,0,.14); color:var(--cream-dim); font-size:12px; line-height:1.45; }
    [data-theme="light"] .role-desc { background:rgba(255,255,255,.68); }
    .role-desc b { color:var(--gold); }
    .role-card-list { display:grid; gap:7px; }
    .role-card { text-align:left; border:1px solid rgba(201,168,76,.18); border-radius:13px; padding:10px 11px; background:rgba(255,255,255,.045); color:var(--cream); cursor:pointer; }
    [data-theme="light"] .role-card { background:rgba(255,255,255,.74); }
    .role-card small { display:inline-flex; margin-bottom:4px; color:var(--gold); font-size:10px; font-weight:900; }
    .role-card span { display:block; font-size:12px; line-height:1.55; color:var(--cream); }
    .role-card:hover { border-color:var(--gold); transform:translateY(-1px); }
    .role-case-hint { margin-top:9px; padding:9px 10px; border-radius:12px; border:1px dashed rgba(201,168,76,.22); }
    .role-case-hint b { display:block; color:var(--gold); font-size:10px; margin-bottom:3px; }
    .role-case-hint span { display:block; color:var(--cream-dim); font-size:11px; line-height:1.5; }
    .role-reaction-pop { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:999px; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; box-shadow:0 10px 24px rgba(0,0,0,.26); animation:rolePop 1.5s ease both; z-index:80; white-space:nowrap; }
    .role-reaction-pop strong { font-size:12px; } .role-reaction-pop span { font-size:11px; font-weight:800; opacity:.86; }
    .role-play-panel.collapsed .role-tabs, .role-play-panel.collapsed .role-desc, .role-play-panel.collapsed .role-card-list, .role-play-panel.collapsed .role-case-hint { display:none; }
    @keyframes rolePop { 0% { opacity:0; transform:translate(-50%, 10px) scale(.88); } 18% { opacity:1; transform:translate(-50%, 0) scale(1); } 82% { opacity:1; transform:translate(-50%, 0) scale(1); } 100% { opacity:0; transform:translate(-50%, -8px) scale(.96); } }
    @media (max-width:480px) { .role-play-panel { padding:10px; border-radius:16px; } .role-tabs { grid-template-columns:repeat(5, minmax(0,1fr)); gap:4px; } .role-tab { padding:7px 2px; } .role-tab span { font-size:18px; } .role-tab b { font-size:9px; } .role-card span { font-size:11.5px; } .role-reaction-pop { max-width:calc(100vw - 30px); white-space:normal; justify-content:center; text-align:center; } }
  `;
  document.head.appendChild(style);
}

bootRolePlayCards();
