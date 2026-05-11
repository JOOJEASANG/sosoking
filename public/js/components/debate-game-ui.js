let styleInjected = false;
let observer = null;
let active = false;

const JUDGE_QUESTIONS = [
  '사건 발생 당시 가장 결정적인 장면은 무엇이었습니까?',
  '상대방도 그렇게 행동할 만한 사정이 있었습니까?',
  '그 상황에서 한마디만 더 했다면 사건이 커지지 않았을까요?',
  '방청석이 이해할 수 있도록 핵심 상황을 짧게 정리해 주세요.',
  'AI 판사가 보기엔 감정보다 사실 확인이 먼저입니다. 정확히 무슨 일이 있었나요?',
];

const AUDIENCE_REACTIONS = [
  '👥 방청석이 사건 기록을 보며 웅성입니다.',
  '😮 방청객 일부가 방금 진술에 고개를 끄덕였습니다.',
  '😂 판사가 웃음을 참으려 망치를 만지작거립니다.',
  '🤔 방청석 분위기가 묘하게 진지해졌습니다.',
  '👏 누군가 조용히 “이건 인정”이라고 말했습니다.',
];

export function syncDebateGameUi(hash) {
  const isDebate = String(hash || '').startsWith('#/debate/');
  active = isDebate;
  document.body.classList.toggle('sosoking-game-debate', isDebate);

  if (!isDebate) {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    return;
  }

  injectStyle();
  scheduleEnhance();

  if (!observer) {
    observer = new MutationObserver(() => scheduleEnhance());
    observer.observe(document.getElementById('page-content') || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['class', 'disabled'],
    });
  }
}

let enhanceTimer = null;
function scheduleEnhance() {
  if (!active) return;
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(enhanceDebateDom, 30);
}

function enhanceDebateDom() {
  if (!active) return;

  const root = document.getElementById('debate-root') || document.getElementById('page-content');
  if (root) {
    root.classList.add('court-game-root', 'case-hearing-root');
    normalizeCourtText(root);
  }

  document.querySelectorAll('.argument-bubble').forEach((bubble, idx) => {
    bubble.classList.add('court-speech-bubble', 'case-statement-bubble');
    const wrap = bubble.closest('.bubble-wrap');
    if (wrap) wrap.classList.add('court-speech-wrap');
    if (!bubble.dataset.caseLabel) {
      bubble.dataset.caseLabel = '1';
      const label = document.createElement('div');
      label.className = 'case-statement-label';
      label.textContent = bubble.classList.contains('plaintiff-side')
        ? '문제 제기 진술'
        : '상대측 해명';
      bubble.prepend(label);
    }
    if (idx === document.querySelectorAll('.argument-bubble').length - 1) {
      bubble.classList.add('latest-statement');
    } else {
      bubble.classList.remove('latest-statement');
    }
  });

  document.querySelectorAll('.bubble-left').forEach(wrap => wrap.classList.add('court-left-speaker'));
  document.querySelectorAll('.bubble-right').forEach(wrap => wrap.classList.add('court-right-speaker'));

  document.querySelectorAll('.round-separator').forEach((el, index) => {
    el.classList.add('court-round-title', 'case-hearing-title');
    const raw = el.textContent.trim();
    const n = raw.match(/\d+/)?.[0] || String(index + 1);
    el.textContent = `⚖️ 제${n}심리 · 사실 확인`;
  });

  document.querySelectorAll('.round-status-row').forEach(el => el.classList.add('court-turn-board', 'case-hearing-board'));
  document.querySelectorAll('.round-status-chip').forEach(el => el.classList.add('court-turn-chip'));

  const verdictWrap = document.getElementById('verdict-btn-wrap');
  if (verdictWrap) verdictWrap.classList.add('court-verdict-panel', 'case-verdict-panel');

  document.querySelectorAll('#verdict-request-btn, #verdict-accept-btn').forEach(btn => {
    btn.classList.add('court-gavel-btn');
    if (!btn.dataset.courtEnhanced) {
      btn.dataset.courtEnhanced = '1';
    }
    if (btn.id === 'verdict-request-btn') btn.innerHTML = '🔨 판결 선고 요청';
    if (btn.id === 'verdict-accept-btn') btn.innerHTML = '🔨 판결 선고 동의';
  });

  document.querySelectorAll('#verdict-cancel-btn, #verdict-decline-btn').forEach(btn => {
    btn.classList.add('court-soft-btn');
  });

  enhanceInputArea();
  enhanceHearingCards();
  enhanceCompletedVerdict();
  enhanceWaitingScreen();
}

function normalizeCourtText(root) {
  const replaceMap = [
    [/토론/g, '사건 심리'],
    [/배틀/g, '재판'],
    [/변론 라운드/g, '사건 심리 단계'],
    [/라운드/g, '심리 단계'],
    [/원고 변론/g, '문제 제기 진술'],
    [/피고 반론/g, '상대측 해명'],
    [/변론/g, '진술'],
    [/반론/g, '해명'],
    [/주장/g, '문제 제기'],
    [/판정/g, '판결'],
  ];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !/[토론배틀변론라운드반론주장판정]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let next = node.nodeValue;
    replaceMap.forEach(([from, to]) => { next = next.replace(from, to); });
    if (next !== node.nodeValue) node.nodeValue = next;
  });
}

function enhanceInputArea() {
  const textareas = Array.from(document.querySelectorAll('textarea'));
  textareas.forEach(textarea => {
    textarea.classList.add('court-argument-textarea', 'case-statement-textarea');
    if (!textarea.dataset.courtPlaceholderSet) {
      textarea.dataset.courtPlaceholderSet = '1';
    }
    textarea.setAttribute('placeholder', '사건 기록에 남길 진술을 입력하세요. 감정도 좋지만, 무슨 일이 있었는지 중심으로 적어주세요...');
    const parent = textarea.closest('form, div');
    if (parent) parent.classList.add('court-input-panel', 'case-input-panel');
  });

  document.querySelectorAll('button').forEach(btn => {
    const text = (btn.textContent || '').trim();
    if (!btn.dataset.courtSubmitEnhanced && /제출|문제 제기|해명|진술|반박|변론|반론/.test(text) && btn.closest('.court-input-panel')) {
      btn.dataset.courtSubmitEnhanced = '1';
      btn.classList.add('court-submit-btn');
    }
    if (btn.closest('.court-input-panel') && btn.classList.contains('court-submit-btn')) {
      btn.innerHTML = '📝 사건 진술 제출';
    }
  });
}

function enhanceHearingCards() {
  const feed = document.getElementById('debate-feed') || document.querySelector('.debate-feed');
  if (!feed) return;

  const statusRow = feed.querySelector('.round-status-row, .case-hearing-board');
  if (statusRow && !document.querySelector('.judge-question-card')) {
    const questionIndex = Math.abs((feed.textContent || '').length) % JUDGE_QUESTIONS.length;
    const card = document.createElement('div');
    card.className = 'judge-question-card';
    card.innerHTML = `
      <div class="judge-question-icon">👨‍⚖️</div>
      <div>
        <div class="judge-question-kicker">AI 판사 질문 카드</div>
        <div class="judge-question-text">${JUDGE_QUESTIONS[questionIndex]}</div>
      </div>
    `;
    statusRow.insertAdjacentElement('afterend', card);
  }

  const allText = document.body.textContent || '';
  const evidenceMatch = allText.match(/증거 아이템[:：]\s*([^\.\n]+)/);
  if (evidenceMatch && !document.querySelector('.evidence-review-card')) {
    const card = document.createElement('div');
    card.className = 'evidence-review-card';
    card.innerHTML = `
      <div class="evidence-review-icon">🧾</div>
      <div>
        <div class="evidence-review-kicker">증거물 확인</div>
        <div class="evidence-review-text">증거물 1호, <strong>${escapeHtml(evidenceMatch[1].trim())}</strong>이 사건 기록에 첨부됐습니다.</div>
      </div>
    `;
    feed.prepend(card);
  }

  const bubbleCount = document.querySelectorAll('.argument-bubble').length;
  if (bubbleCount > 0 && feed.dataset.audienceFor !== String(bubbleCount)) {
    feed.dataset.audienceFor = String(bubbleCount);
    document.querySelector('.audience-reaction-card')?.remove();
    const reaction = AUDIENCE_REACTIONS[bubbleCount % AUDIENCE_REACTIONS.length];
    const card = document.createElement('div');
    card.className = 'audience-reaction-card';
    card.innerHTML = `<strong>방청석 반응</strong><span>${reaction}</span>`;
    const verdict = document.getElementById('verdict-btn-wrap');
    if (verdict && verdict.parentElement === feed) verdict.insertAdjacentElement('beforebegin', card);
    else feed.appendChild(card);
  }
}

function enhanceCompletedVerdict() {
  const feed = document.getElementById('debate-feed');
  if (!feed || feed.dataset.verdictEnhanced === '1') return;

  const txt = feed.textContent || '';
  if (!/판결 완료|승리|승소|미션|점수/.test(txt)) return;

  feed.dataset.verdictEnhanced = '1';
  const badge = document.createElement('div');
  badge.className = 'court-verdict-cutscene';
  badge.innerHTML = `
    <div class="cutscene-gavel">🔨</div>
    <div>
      <div class="cutscene-title">판결 선고</div>
      <div class="cutscene-sub">AI 판사의 최종 판결문이 도착했습니다. 이 판결은 오락용이며 실제 법적 효력은 없습니다.</div>
    </div>
  `;
  feed.prepend(badge);
}

function enhanceWaitingScreen() {
  const waiting = document.querySelector('.waiting-screen');
  if (!waiting || waiting.dataset.courtWaitingEnhanced === '1') return;
  waiting.dataset.courtWaitingEnhanced = '1';
  waiting.classList.add('court-waiting-room-card');
}

function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.id = 'debate-game-ui-style';
  style.textContent = `
    body.sosoking-game-debate #page-content { background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.14), transparent 48%), var(--navy); min-height:100vh; }
    body.sosoking-game-debate .debate-header { position:sticky; top:0; z-index:60; background:rgba(13,17,23,.94); border-bottom:1px solid rgba(201,168,76,.18); backdrop-filter:blur(12px); box-shadow:0 8px 24px rgba(0,0,0,.18); }
    [data-theme="light"] body.sosoking-game-debate .debate-header { background:rgba(255,248,242,.96); }
    body.sosoking-game-debate .debate-status { color:var(--gold); font-weight:900; letter-spacing:-.01em; }
    body.sosoking-game-debate .debate-round-dot { height:7px; border-radius:999px; background:rgba(255,255,255,.12); }
    body.sosoking-game-debate .debate-round-dot.active { background:var(--gold); box-shadow:0 0 12px rgba(201,168,76,.55); animation:courtDotPulse .85s ease-in-out infinite alternate; }
    body.sosoking-game-debate .debate-round-dot.done { background:rgba(201,168,76,.62); }
    body.sosoking-game-debate .debate-topic-bar-inner { border:1px solid rgba(201,168,76,.18); background:linear-gradient(135deg, rgba(201,168,76,.08), rgba(255,255,255,.02)); border-radius:16px; margin:10px 12px; padding:12px 14px; }
    body.sosoking-game-debate .debate-topic-bar-inner::before { content:'📁 사건 기록'; display:block; color:var(--gold); font-size:10px; font-weight:900; letter-spacing:.08em; margin-bottom:4px; }
    body.sosoking-game-debate .debate-feed { padding-left:14px !important; padding-right:14px !important; scroll-behavior:smooth; }
    .court-turn-board { display:grid !important; grid-template-columns:1fr 1fr; gap:8px; padding:10px; border-radius:18px; border:1.5px solid rgba(201,168,76,.18); background:rgba(0,0,0,.14); margin:12px 0; }
    [data-theme="light"] .court-turn-board { background:rgba(255,255,255,.62); }
    .court-turn-chip { border-radius:14px !important; border:1px solid rgba(201,168,76,.16) !important; background:rgba(255,255,255,.045) !important; box-shadow:inset 0 1px 0 rgba(255,255,255,.04); }
    .court-turn-chip.submitted { background:rgba(39,174,96,.08) !important; border-color:rgba(39,174,96,.22) !important; }
    .court-turn-chip.waiting { background:rgba(201,168,76,.08) !important; border-color:rgba(201,168,76,.28) !important; }
    .court-round-title { display:flex !important; align-items:center; justify-content:center; gap:6px; margin:18px auto 12px !important; width:max-content; padding:6px 14px !important; border-radius:999px !important; border:1px solid rgba(201,168,76,.24); background:rgba(201,168,76,.08); color:var(--gold) !important; font-size:12px !important; font-weight:900 !important; }
    .case-hearing-title { box-shadow:0 6px 18px rgba(0,0,0,.12); }
    .court-speech-wrap { position:relative; margin-top:16px !important; min-height:54px; animation:courtBubbleIn .24s ease both; }
    .court-left-speaker { padding-left:48px; }
    .court-right-speaker { padding-right:48px; }
    .court-left-speaker:before, .court-right-speaker:after { position:absolute; top:3px; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; border:2px solid rgba(201,168,76,.28); background:linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04)); box-shadow:0 6px 18px rgba(0,0,0,.2); }
    .court-left-speaker:before { content:'🙋'; left:2px; border-color:rgba(231,76,60,.48); }
    .court-right-speaker:after { content:'🛡️'; right:2px; border-color:rgba(52,152,219,.48); }
    .court-speech-bubble { position:relative; border-radius:18px !important; padding:13px 15px !important; line-height:1.62 !important; box-shadow:0 10px 24px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.06); border-width:1.5px !important; }
    .court-speech-bubble.latest-statement { box-shadow:0 0 0 3px rgba(201,168,76,.12), 0 12px 26px rgba(0,0,0,.22); }
    .court-speech-bubble:after { content:''; position:absolute; top:16px; width:12px; height:12px; transform:rotate(45deg); }
    .bubble-left .court-speech-bubble:after { left:-6px; background:inherit; border-left:inherit; border-bottom:inherit; }
    .bubble-right .court-speech-bubble:after { right:-6px; background:inherit; border-right:inherit; border-top:inherit; }
    .plaintiff-side.court-speech-bubble { background:linear-gradient(135deg, rgba(231,76,60,.18), rgba(231,76,60,.055)) !important; border-color:rgba(231,76,60,.34) !important; color:var(--cream) !important; }
    .defendant-side.court-speech-bubble { background:linear-gradient(135deg, rgba(52,152,219,.18), rgba(52,152,219,.055)) !important; border-color:rgba(52,152,219,.34) !important; color:var(--cream) !important; }
    .case-statement-label { display:inline-flex; margin-bottom:7px; padding:3px 8px; border-radius:999px; background:rgba(0,0,0,.18); color:var(--gold); font-size:10px; font-weight:900; letter-spacing:.04em; }
    .argument-meta { font-size:11px !important; font-weight:900 !important; margin-top:5px !important; color:var(--cream-dim) !important; }
    .judge-question-card, .evidence-review-card, .audience-reaction-card { display:flex; align-items:flex-start; gap:12px; margin:12px 0; padding:13px 14px; border-radius:18px; border:1.5px solid rgba(201,168,76,.25); background:linear-gradient(135deg, rgba(201,168,76,.1), rgba(255,255,255,.025)); box-shadow:0 8px 22px rgba(0,0,0,.16); animation:courtBubbleIn .24s ease both; }
    [data-theme="light"] .judge-question-card, [data-theme="light"] .evidence-review-card, [data-theme="light"] .audience-reaction-card { background:rgba(255,255,255,.76); }
    .judge-question-icon, .evidence-review-icon { width:38px; height:38px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.28); font-size:22px; }
    .judge-question-kicker, .evidence-review-kicker, .audience-reaction-card strong { display:block; color:var(--gold); font-size:10px; font-weight:900; letter-spacing:.08em; margin-bottom:4px; }
    .judge-question-text, .evidence-review-text, .audience-reaction-card span { display:block; color:var(--cream); font-size:13px; line-height:1.55; }
    .audience-reaction-card { align-items:center; flex-direction:column; gap:3px; text-align:center; }
    .court-verdict-panel { position:relative; margin-top:14px; border-radius:20px; border:1.5px solid rgba(201,168,76,.3); background:linear-gradient(135deg, rgba(201,168,76,.12), rgba(255,255,255,.035)); padding:14px !important; box-shadow:0 12px 32px rgba(0,0,0,.22); }
    .court-verdict-panel:before { content:'⚖️'; position:absolute; left:50%; top:-18px; transform:translateX(-50%); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:var(--navy); border:1.5px solid rgba(201,168,76,.35); }
    .court-gavel-btn { border:none !important; background:linear-gradient(135deg, var(--gold), var(--gold-light)) !important; color:#0d1117 !important; font-weight:900 !important; border-radius:15px !important; box-shadow:0 8px 24px rgba(201,168,76,.24); }
    .court-gavel-btn:active { transform:translateY(1px) scale(.99); }
    .court-soft-btn { border-radius:14px !important; border:1.5px solid rgba(201,168,76,.22) !important; }
    .court-input-panel { position:relative; }
    body.sosoking-game-debate textarea.court-argument-textarea { min-height:94px !important; border-radius:18px !important; border:1.5px solid rgba(201,168,76,.24) !important; background:rgba(255,255,255,.055) !important; color:var(--cream) !important; box-shadow:0 -6px 24px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.04); }
    [data-theme="light"] body.sosoking-game-debate textarea.court-argument-textarea { background:rgba(255,255,255,.86) !important; }
    .court-submit-btn { border:none !important; border-radius:15px !important; background:linear-gradient(135deg, var(--gold), var(--gold-light)) !important; color:#0d1117 !important; font-weight:900 !important; }
    .court-verdict-cutscene { margin:0 0 16px; padding:16px; display:flex; align-items:center; gap:13px; border-radius:20px; border:1.5px solid rgba(201,168,76,.38); background:linear-gradient(135deg, rgba(201,168,76,.16), rgba(255,255,255,.04)); box-shadow:0 14px 36px rgba(0,0,0,.25); animation:verdictDrop .46s cubic-bezier(.34,1.56,.64,1) both; }
    .cutscene-gavel { width:52px; height:52px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(201,168,76,.14); border:1px solid rgba(201,168,76,.3); font-size:30px; animation:gavelHit .55s ease .15s both; }
    .cutscene-title { font-family:var(--font-serif); font-size:19px; font-weight:900; color:var(--gold); }
    .cutscene-sub { margin-top:3px; font-size:12px; color:var(--cream-dim); line-height:1.45; }
    .court-waiting-room-card { border-radius:22px !important; border:1.5px solid rgba(201,168,76,.24); background:linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); box-shadow:0 12px 32px rgba(0,0,0,.22); }
    @keyframes courtBubbleIn { from { opacity:0; transform:translateY(8px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes courtDotPulse { from { opacity:.65; transform:scaleX(.9); } to { opacity:1; transform:scaleX(1.04); } }
    @keyframes verdictDrop { from { opacity:0; transform:translateY(-16px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes gavelHit { 0% { transform:rotate(-28deg) scale(1.1); } 60% { transform:rotate(12deg) scale(1.02); } 100% { transform:rotate(0) scale(1); } }
    @media (max-width:430px) { .court-turn-board { grid-template-columns:1fr; } .court-left-speaker { padding-left:42px; } .court-right-speaker { padding-right:42px; } .court-left-speaker:before, .court-right-speaker:after { width:34px; height:34px; font-size:20px; } .court-speech-bubble { font-size:14px !important; } .judge-question-card, .evidence-review-card { padding:12px; } }
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}
