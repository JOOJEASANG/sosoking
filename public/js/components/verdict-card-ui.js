const QUOTES = [
  '사소한 사건일수록 사람의 진심이 드러나는 법입니다.',
  '치킨 한 조각보다 중요한 것은 서로에게 물어보는 한마디였습니다.',
  '카톡 답장은 짧아도 마음의 재판은 길어질 수 있습니다.',
  '정산은 숫자의 문제 같지만, 사실은 마음의 온도 문제입니다.',
  '법정은 조용했지만 방청석의 공감은 이미 움직였습니다.',
  '오늘의 판결은 법보다 웃음에 가까운 생활 판결입니다.',
];

const MISSIONS = {
  plaintiff: [
    '피고에게 “다음엔 미리 말해줘”라고 부드럽게 전달하기',
    '오늘 하루는 사건을 더 키우지 않고 쿨하게 넘기기',
    '상대방 사정도 한 줄로 인정해주기',
  ],
  defendant: [
    '원고에게 작은 사과 한마디 남기기',
    '다음 비슷한 상황에서는 먼저 물어보기',
    '작은 음료나 간식으로 평화협정 체결하기',
  ],
  draw: [
    '둘 다 다음부터 한 번 더 물어보기',
    '카톡 이모티콘 하나로 평화협정 체결하기',
    '오늘의 사건은 웃고 넘기기로 합의하기',
  ],
};

let observer = null;
let timer = null;

function bootVerdictCards() {
  injectVerdictStyle();
  schedule();
  if (observer) return;
  observer = new MutationObserver(schedule);
  observer.observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('hashchange', schedule);
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhanceVerdict, 80);
}

function enhanceVerdict() {
  if (!String(location.hash || '').startsWith('#/debate/')) return;
  const feed = document.getElementById('debate-feed');
  if (!feed || document.querySelector('.game-verdict-card')) return;

  const txt = feed.textContent || '';
  if (!/판결 완료|판정 완료|승소|승리|무승부|미션|점수|판결문/.test(txt)) return;

  const topic = document.querySelector('.debate-topic-name')?.textContent?.replace(/^📋\s*/, '').trim() || '생활 사건';
  const winner = detectWinner(txt);
  const quote = QUOTES[Math.abs(txt.length) % QUOTES.length];
  const mission = pickMission(winner, txt.length);
  const score = detectScore(txt);

  const card = document.createElement('section');
  card.className = `game-verdict-card winner-${winner}`;
  card.innerHTML = `
    <div class="verdict-card-seal">⚖️</div>
    <div class="verdict-card-kicker">SOSOKING LIFE COURT</div>
    <h2>판결문 카드</h2>
    <div class="verdict-case-name">${esc(topic)}</div>
    <div class="verdict-result-row">
      <div class="verdict-result-icon">${winner === 'plaintiff' ? '🙋' : winner === 'defendant' ? '🛡️' : '🤝'}</div>
      <div>
        <div class="verdict-result-label">오늘의 판결</div>
        <div class="verdict-result-text">${winnerText(winner)}</div>
      </div>
    </div>
    ${score ? `<div class="verdict-score-chip">점수 기록 · ${esc(score)}</div>` : ''}
    <div class="verdict-section">
      <strong>오늘의 명대사</strong>
      <span>“${esc(quote)}”</span>
    </div>
    <div class="verdict-section mission">
      <strong>화해 미션</strong>
      <span>${esc(mission)}</span>
    </div>
    <div class="verdict-notice">이 판결은 오락용 AI 모의법정 결과이며 실제 법적 효력은 없습니다.</div>
    <div class="verdict-actions">
      <button id="copy-verdict-card">📋 판결문 복사</button>
      <button id="share-verdict-card">📤 공유하기</button>
    </div>
  `;

  feed.prepend(card);

  const shareText = makeShareText(topic, winner, quote, mission);
  document.getElementById('copy-verdict-card')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast('판결문 카드 내용이 복사됐습니다');
    } catch {
      toast('복사가 어려우면 화면을 캡처해서 공유해보세요');
    }
  });
  document.getElementById('share-verdict-card')?.addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: '소소킹 생활법정 판결문', text: shareText, url: location.href });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareText);
      toast('공유 문구가 복사됐습니다');
    } catch {
      toast('공유가 어려우면 화면을 캡처해서 보내보세요');
    }
  });
}

function detectWinner(text) {
  if (/원고\s*(승소|승리)|A팀\s*(승리|승소)|plaintiff/i.test(text)) return 'plaintiff';
  if (/피고\s*(승소|승리)|B팀\s*(승리|승소)|defendant/i.test(text)) return 'defendant';
  if (/무승부|동점|각하|화해/i.test(text)) return 'draw';
  return 'draw';
}

function winnerText(winner) {
  if (winner === 'plaintiff') return '원고 측 일부 승소';
  if (winner === 'defendant') return '피고 측 일부 승소';
  return '양측 화해 권고';
}

function pickMission(winner, seed) {
  const list = MISSIONS[winner] || MISSIONS.draw;
  return list[Math.abs(seed) % list.length];
}

function detectScore(text) {
  const score = text.match(/\d{1,3}\s*[:：]\s*\d{1,3}|\d{1,3}\s*점/g)?.slice(0, 2)?.join(' / ');
  return score || '';
}

function makeShareText(topic, winner, quote, mission) {
  return `[소소킹 생활법정 판결문]\n사건명: ${topic}\n판결: ${winnerText(winner)}\n명대사: “${quote}”\n화해 미션: ${mission}\n\n※ 오락용 AI 모의법정 결과이며 실제 법적 효력은 없습니다.`;
}

function toast(message) {
  const box = document.getElementById('toast-container');
  if (!box) { alert(message); return; }
  const el = document.createElement('div');
  el.className = 'toast success show';
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function injectVerdictStyle() {
  if (document.getElementById('verdict-card-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'verdict-card-ui-style';
  style.textContent = `
    .game-verdict-card { position:relative; overflow:hidden; margin:0 0 18px; padding:22px 18px 18px; border-radius:24px; border:1.8px solid rgba(201,168,76,.45); background:radial-gradient(circle at 50% 0%, rgba(201,168,76,.22), transparent 45%), linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.025)); box-shadow:0 18px 46px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.08); text-align:center; animation:verdictCardDrop .42s cubic-bezier(.34,1.56,.64,1) both; }
    [data-theme="light"] .game-verdict-card { background:radial-gradient(circle at 50% 0%, rgba(201,168,76,.2), transparent 46%), rgba(255,255,255,.88); box-shadow:0 12px 30px rgba(154,112,24,.16); }
    .game-verdict-card::before { content:''; position:absolute; inset:10px; border:1px dashed rgba(201,168,76,.24); border-radius:19px; pointer-events:none; }
    .verdict-card-seal { width:58px; height:58px; margin:0 auto 10px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(201,168,76,.14); border:1.5px solid rgba(201,168,76,.36); font-size:32px; box-shadow:0 0 22px rgba(201,168,76,.18); }
    .verdict-card-kicker { font-size:10px; font-weight:900; color:var(--gold); letter-spacing:.14em; }
    .game-verdict-card h2 { margin:5px 0 10px; font-family:var(--font-serif); font-size:24px; color:var(--cream); }
    .verdict-case-name { display:inline-flex; max-width:100%; padding:7px 12px; border-radius:999px; background:rgba(0,0,0,.18); color:var(--cream); font-size:13px; font-weight:900; line-height:1.45; }
    [data-theme="light"] .verdict-case-name { background:rgba(154,112,24,.08); }
    .verdict-result-row { margin:16px auto 14px; display:flex; align-items:center; justify-content:center; gap:12px; padding:13px; border-radius:18px; border:1px solid rgba(201,168,76,.24); background:rgba(201,168,76,.08); text-align:left; }
    .verdict-result-icon { width:44px; height:44px; flex-shrink:0; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:25px; background:rgba(255,255,255,.08); border:1px solid rgba(201,168,76,.22); }
    .verdict-result-label { font-size:10px; color:var(--cream-dim); font-weight:900; letter-spacing:.08em; }
    .verdict-result-text { margin-top:2px; color:var(--gold); font-size:17px; font-weight:900; }
    .verdict-score-chip { display:inline-flex; margin-bottom:12px; padding:5px 10px; border-radius:999px; border:1px solid rgba(201,168,76,.25); color:var(--gold); font-size:11px; font-weight:900; background:rgba(201,168,76,.08); }
    .verdict-section { text-align:left; margin-top:10px; padding:13px 14px; border-radius:16px; background:rgba(0,0,0,.14); border:1px solid rgba(255,255,255,.06); }
    [data-theme="light"] .verdict-section { background:rgba(154,112,24,.055); border-color:rgba(154,112,24,.12); }
    .verdict-section strong { display:block; color:var(--gold); font-size:11px; font-weight:900; letter-spacing:.06em; margin-bottom:5px; }
    .verdict-section span { display:block; color:var(--cream); font-size:13px; line-height:1.65; }
    .verdict-section.mission { border-color:rgba(39,174,96,.22); background:rgba(39,174,96,.06); }
    .verdict-notice { margin-top:12px; color:var(--cream-dim); font-size:11px; line-height:1.55; }
    .verdict-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:14px; }
    .verdict-actions button { border:none; border-radius:14px; padding:12px 8px; font-size:13px; font-weight:900; cursor:pointer; }
    .verdict-actions button:first-child { background:rgba(255,255,255,.07); color:var(--cream); border:1px solid rgba(201,168,76,.22); }
    .verdict-actions button:last-child { background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; }
    @keyframes verdictCardDrop { from { opacity:0; transform:translateY(-16px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
    @media (max-width:430px) { .game-verdict-card { padding:20px 14px 15px; } .verdict-actions { grid-template-columns:1fr; } .game-verdict-card h2 { font-size:22px; } }
  `;
  document.head.appendChild(style);
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

bootVerdictCards();
