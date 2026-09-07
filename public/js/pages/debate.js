import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const DATA_URL = '/data/debate-cases.json?v=20260907-debate-1';
const VOTES_KEY = 'sosoking-debate-votes';
const OPS_KEY = 'sosoking-debate-opinions';
const STREAK_KEY = 'sosoking-debate-streak';
const STREAK_DAY_KEY = 'sosoking-debate-streak-day';
const EPOCH = Date.UTC(2026, 8, 7); // 2026-09-07 기준일

const JUDGES = [
  ['꼰대형', '🧓'], ['냉혈형', '🧊'], ['회피형', '🏃'], ['추궁형', '🔎'],
  ['오버형', '🚨'], ['드립형', '🎭'], ['빙의형', '🌀']
];
const SIDE_LABEL = { p: '원고 편', d: '피고 편', b: '쌍방과실' };

let CASES = null;

const store = {
  get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// 결정적 셔플: 같은 코드면 모든 사용자가 같은 순서를 본다.
function shuffledDeck(cases) {
  return cases
    .map(c => [c, hashString(`deck:${c.id}`)])
    .sort((a, b) => a[1] - b[1])
    .map(pair => pair[0]);
}

function dayNumber() {
  return Math.floor((Date.now() - EPOCH) / 86400000);
}

function todayCase(deck) {
  const n = ((dayNumber() % deck.length) + deck.length) % deck.length;
  return deck[n];
}

// 실시간 집계 전까지 보여줄 결정적 예시 분포 (베타).
function sampleSplit(id) {
  const h = hashString(`split:${id}`);
  const b = 7 + (h % 8);            // 쌍방 7~14%
  const p = 40 + ((h >> 4) % 21);   // 원고 40~60%
  const d = Math.max(1, 100 - p - b);
  return { p, d, b };
}

function assignJudge(id) {
  return JUDGES[hashString(`judge:${id}`) % JUDGES.length];
}

function spiceLabel(n) { return '🌶️'.repeat(Math.max(1, Math.min(3, n || 1))); }

function ensureDebateStyle() {
  if (document.getElementById('debate-page-style')) return;
  const style = document.createElement('style');
  style.id = 'debate-page-style';
  style.textContent = `
    .debate-page{--dbt-p:#d9694f;--dbt-d:#3f9f8f;--dbt-b:#9a86c4;}
    .debate-wrap{max-width:640px;margin:0 auto;padding:18px 16px 90px;}
    .debate-daterail{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
    .debate-daterail .d{font-size:13px;color:var(--cream-dim);} .debate-daterail .d b{color:var(--cream);}
    .debate-beta{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:rgba(201,168,76,.12);border:1px solid var(--border);color:var(--gold);font-size:11px;font-weight:800;letter-spacing:.04em;}
    .debate-card{position:relative;overflow:hidden;background:var(--navy-card);border:1px solid var(--border);border-radius:18px;padding:22px 20px 20px;box-shadow:var(--shadow);}
    .debate-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,var(--gold),transparent);}
    .debate-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}
    .debate-docket{font-size:10px;letter-spacing:.18em;color:var(--gold);font-weight:800;text-transform:uppercase;}
    .debate-cat{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--cream-dim);}
    .debate-title{font-family:var(--font-serif);font-weight:900;font-size:24px;line-height:1.4;margin:2px 0 0;letter-spacing:-.01em;word-break:keep-all;}
    .debate-rule{height:1px;background:var(--border);margin:15px 0;}
    .debate-situation{font-size:15px;line-height:1.85;color:var(--cream);word-break:keep-all;}
    .debate-crux{margin-top:15px;padding:13px 15px;border-radius:12px;background:rgba(201,168,76,.10);border:1px solid var(--border);display:flex;gap:10px;align-items:flex-start;}
    .debate-crux .k{font-size:10px;letter-spacing:.12em;color:var(--gold);font-weight:800;flex-shrink:0;padding-top:2px;}
    .debate-crux .v{font-size:14px;font-weight:700;line-height:1.6;color:var(--cream);word-break:keep-all;}
    .debate-vote{margin-top:18px;}
    .debate-vote-q{text-align:center;font-size:12px;color:var(--cream-dim);margin-bottom:12px;}
    .debate-duo{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    .dbtn{appearance:none;cursor:pointer;font-family:inherit;border-radius:14px;padding:15px 12px;text-align:center;border:1.5px solid var(--border);background:rgba(255,255,255,.03);color:var(--cream);transition:transform .15s,border-color .2s,background .2s;}
    .dbtn:hover{transform:translateY(-2px);}
    .dbtn:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .dbtn .s{font-size:10px;font-weight:800;letter-spacing:.08em;margin-bottom:6px;}
    .dbtn .l{font-size:13.5px;font-weight:800;line-height:1.4;word-break:keep-all;}
    .dbtn.p .s{color:var(--dbt-p);} .dbtn.p:hover{border-color:var(--dbt-p);background:rgba(217,105,79,.12);}
    .dbtn.d .s{color:var(--dbt-d);} .dbtn.d:hover{border-color:var(--dbt-d);background:rgba(63,159,143,.12);}
    .dbtn-both{appearance:none;cursor:pointer;font-family:inherit;width:100%;margin-top:10px;border-radius:12px;padding:12px;border:1.5px dashed var(--border);background:rgba(154,134,196,.10);color:var(--dbt-b);font-size:13px;font-weight:800;transition:transform .15s;}
    .dbtn-both:hover{transform:translateY(-2px);}
    .dbtn-both:focus-visible{outline:2px solid var(--dbt-b);outline-offset:2px;}
    .debate-results{margin-top:20px;}
    .debate-results[hidden]{display:none;}
    .debate-poll-label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--cream-dim);margin-bottom:10px;}
    .debate-poll-label b{color:var(--gold);letter-spacing:.04em;}
    .debate-splitbar{display:flex;height:42px;border-radius:12px;overflow:hidden;border:1px solid var(--border);}
    .debate-seg{display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#12151d;min-width:0;transition:width .9s cubic-bezier(.2,.8,.2,1);white-space:nowrap;overflow:hidden;}
    .debate-seg.p{background:linear-gradient(180deg,#e78671,var(--dbt-p));}
    .debate-seg.d{background:linear-gradient(180deg,#5bb6a6,var(--dbt-d));}
    .debate-seg.b{background:linear-gradient(180deg,#ab98d2,var(--dbt-b));}
    .debate-legend{display:flex;justify-content:space-between;gap:8px;margin-top:9px;}
    .debate-legend .lg{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--cream-dim);min-width:0;}
    .debate-legend .sw{width:9px;height:9px;border-radius:3px;flex-shrink:0;}
    .debate-legend .lg.p .sw{background:var(--dbt-p);} .debate-legend .lg.d .sw{background:var(--dbt-d);}
    .debate-legend .lg span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .debate-ident{margin-top:13px;padding:12px 15px;border-radius:12px;text-align:center;background:rgba(255,255,255,.04);border:1px solid var(--border);font-size:13.5px;font-weight:800;color:var(--cream);}
    .debate-ident b{color:var(--gold-light,var(--gold));}
    .debate-judge{margin-top:16px;padding:16px 16px;border-radius:14px;background:rgba(201,168,76,.08);border:1px solid var(--border);display:flex;gap:12px;align-items:center;}
    .debate-judge-av{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:22px;background:rgba(0,0,0,.2);border:1px solid var(--border);flex-shrink:0;}
    .debate-judge .k{font-size:9.5px;letter-spacing:.12em;color:var(--gold);font-weight:800;text-transform:uppercase;}
    .debate-judge .n{font-family:var(--font-serif);font-weight:900;font-size:15px;margin-top:1px;color:var(--cream);}
    .debate-judge .t{font-size:12px;color:var(--cream-dim);margin-top:3px;line-height:1.5;}
    .debate-sec{margin-top:24px;}
    .debate-sec-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;}
    .debate-sec-h h2{font-family:var(--font-serif);font-size:17px;font-weight:900;margin:0;color:var(--cream);}
    .debate-sec-h .c{font-size:11px;color:var(--cream-dim);}
    .debate-op{display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);}
    .debate-op:last-child{border-bottom:0;}
    .debate-op-side{flex-shrink:0;width:50px;text-align:center;font-size:9.5px;font-weight:800;padding:5px 0;border-radius:7px;height:fit-content;}
    .debate-op-side.p{color:var(--dbt-p);background:rgba(217,105,79,.12);} .debate-op-side.d{color:var(--dbt-d);background:rgba(63,159,143,.12);}
    .debate-op-body{min-width:0;flex:1;}
    .debate-op-name{font-size:11.5px;color:var(--cream-dim);font-weight:700;margin-bottom:3px;}
    .debate-op-text{font-size:13.5px;line-height:1.6;color:var(--cream);word-break:keep-all;}
    .debate-op-empty{text-align:center;padding:22px 10px;color:var(--cream-dim);font-size:13px;line-height:1.7;}
    .debate-op-form{margin-top:14px;display:flex;flex-direction:column;gap:9px;}
    .debate-op-form textarea{width:100%;resize:vertical;min-height:58px;border-radius:12px;padding:11px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--cream);font-family:inherit;font-size:13.5px;line-height:1.6;}
    .debate-op-form textarea:focus-visible{outline:2px solid var(--gold);outline-offset:1px;}
    .debate-op-row{display:flex;gap:8px;align-items:center;}
    .debate-sidepick{display:flex;gap:6px;flex:1;}
    .debate-sidepick button{flex:1;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:800;padding:9px;border-radius:9px;border:1.5px solid var(--border);background:transparent;color:var(--cream-dim);transition:.15s;}
    .debate-sidepick button[aria-pressed="true"].p{color:var(--dbt-p);border-color:var(--dbt-p);background:rgba(217,105,79,.12);}
    .debate-sidepick button[aria-pressed="true"].d{color:var(--dbt-d);border-color:var(--dbt-d);background:rgba(63,159,143,.12);}
    .debate-post{cursor:pointer;font-family:inherit;font-weight:800;font-size:13px;padding:11px 18px;border-radius:10px;border:0;background:var(--gold);color:#241a05;flex-shrink:0;transition:transform .15s,filter .2s;}
    .debate-post:hover{transform:translateY(-1px);filter:brightness(1.06);}
    .debate-post:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .debate-share{margin-top:20px;width:100%;cursor:pointer;font-family:inherit;padding:15px;border-radius:14px;border:1px solid var(--border);background:rgba(201,168,76,.10);color:var(--gold);font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;transition:.2s;}
    .debate-share:hover{background:rgba(201,168,76,.2);}
    .debate-share:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .debate-teaser{margin-top:13px;padding:13px 16px;border-radius:12px;background:rgba(255,255,255,.03);border:1px dashed var(--border);font-size:12.5px;color:var(--cream-dim);text-align:center;line-height:1.6;}
    .debate-teaser b{color:var(--cream);}
    .debate-arch-item{display:flex;align-items:center;gap:12px;width:100%;cursor:pointer;text-align:left;font-family:inherit;padding:13px 14px;border-radius:13px;margin-bottom:9px;background:var(--navy-card);border:1px solid var(--border);color:var(--cream);transition:transform .15s,border-color .2s;}
    .debate-arch-item:hover{transform:translateY(-2px);border-color:var(--gold);}
    .debate-arch-item:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
    .debate-arch-ic{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-size:18px;background:rgba(0,0,0,.2);border:1px solid var(--border);flex-shrink:0;}
    .debate-arch-main{min-width:0;flex:1;}
    .debate-arch-cat{font-size:10px;color:var(--gold);font-weight:700;letter-spacing:.05em;}
    .debate-arch-t{font-size:14px;font-weight:800;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .debate-arch-meta{font-size:11px;color:var(--cream-dim);margin-top:2px;}
    .debate-arch-go{font-size:11px;color:var(--cream-dim);font-weight:700;flex-shrink:0;}
    @media(prefers-reduced-motion:reduce){.debate-seg{transition:none;}}
  `;
  document.head.appendChild(style);
}

function categoryIcon(cat) {
  const map = { 돈: '💸', 연애: '📱', 가족: '🍮', 직장: '🕕', 친구: '🤝', 공중도덕: '🚇', 음식: '🍜', 여행: '✈️', 동거: '❄️', 관계: '🎁', 온라인: '💬', 육아: '👶', 윤리: '👀', 생활: '🐶', 소비: '🛒' };
  return map[cat] || '⚖️';
}

function renderError(container, retryFn) {
  container.innerHTML = `
    <div class="page-header"><span class="logo">⚖️ 오늘의 토론</span></div>
    <div class="container" style="padding:50px 20px;text-align:center;color:var(--cream-dim);">
      토론 사건을 불러오지 못했습니다.<br>
      <button type="button" class="btn btn-primary" id="debate-retry" style="margin-top:14px;">다시 시도</button>
      <a href="#/" class="btn btn-ghost" style="margin-top:8px;">홈으로</a>
    </div>`;
  container.querySelector('#debate-retry')?.addEventListener('click', retryFn);
}

export async function renderDebate(container, caseId = '') {
  ensureDebateStyle();
  container.innerHTML = `
    <div class="page-header"><span class="logo">⚖️ 오늘의 토론</span></div>
    <div class="container" style="padding:40px 20px;"><div class="loading-dots"><span></span><span></span><span></span></div></div>`;

  if (!CASES) {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      CASES = Array.isArray(data?.cases) ? data.cases : [];
      if (!CASES.length) throw new Error('empty');
    } catch (error) {
      console.warn('debate data load failed:', error);
      renderError(container, () => renderDebate(container, caseId));
      return;
    }
  }
  if (!container.isConnected) return;

  const deck = shuffledDeck(CASES);
  const current = (caseId && CASES.find(c => c.id === caseId)) || todayCase(deck);
  paintCase(container, current);
}

function paintCase(container, c) {
  const votes = store.get(VOTES_KEY, {});
  const voted = votes[c.id];
  const fmtDate = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const streak = store.get(STREAK_KEY, 0);

  container.innerHTML = `
    <div class="debate-page">
      <div class="page-header"><span class="logo">⚖️ 오늘의 토론</span></div>
      <div class="debate-wrap">
        <div class="debate-daterail">
          <div class="d">오늘 <b>${escapeHtml(fmtDate.format(new Date()))}</b>의 토론${streak > 0 ? ` · 🔥 ${streak}일 연속` : ''}</div>
          <span class="debate-beta">BETA · 로컬 집계</span>
        </div>

        <section class="debate-card" aria-live="polite">
          <div class="debate-card-top">
            <span class="debate-docket">토론 제 ${escapeHtml(String(c.id).replace('case_', ''))} 호</span>
            <span class="debate-cat">${categoryIcon(c.category)} ${escapeHtml(c.category)} <span title="논쟁 강도">${spiceLabel(c.spice)}</span></span>
          </div>
          <h1 class="debate-title">${escapeHtml(c.title)}</h1>
          <div class="debate-rule"></div>
          <p class="debate-situation">${escapeHtml(c.situation)}</p>
          <div class="debate-crux"><span class="k">쟁점</span><span class="v">${escapeHtml(c.crux)}</span></div>

          <div class="debate-vote">
            <p class="debate-vote-q">당신의 판단은? · 투표하면 여론이 공개됩니다</p>
            <div class="debate-duo">
              <button class="dbtn p" type="button" data-s="p"><div class="s">원고 편</div><div class="l">${escapeHtml(c.plaintiff)}</div></button>
              <button class="dbtn d" type="button" data-s="d"><div class="s">피고 편</div><div class="l">${escapeHtml(c.defendant)}</div></button>
            </div>
            <button class="dbtn-both" type="button" data-s="b">🤝 쌍방과실 · 둘 다 잘못</button>
          </div>

          <div class="debate-results" id="debate-results" hidden></div>
        </section>

        <div class="debate-sec">
          <div class="debate-sec-h"><h2>지난 토론</h2></div>
          <div id="debate-archive"></div>
        </div>
      </div>
    </div>`;

  container.querySelectorAll('.debate-vote [data-s]').forEach(btn =>
    btn.addEventListener('click', () => castVote(container, c, btn.dataset.s)));
  if (voted) revealResults(container, c, voted, false);
  renderArchive(container, c);
}

function castVote(container, c, side) {
  const votes = store.get(VOTES_KEY, {});
  if (votes[c.id]) return;
  votes[c.id] = side;
  store.set(VOTES_KEY, votes);

  const dayKey = new Date().toDateString();
  const lastDay = store.get(STREAK_DAY_KEY, null);
  if (lastDay !== dayKey) {
    store.set(STREAK_KEY, store.get(STREAK_KEY, 0) + 1);
    store.set(STREAK_DAY_KEY, dayKey);
  }
  revealResults(container, c, side, true);
  showToast('투표 완료! 여론이 공개됐어요 ⚖️', 'success');
}

function revealResults(container, c, side, animate) {
  const base = sampleSplit(c.id);
  // 내 선택 1표를 예시 분포에 살짝 반영
  const raw = { p: base.p * 40, d: base.d * 40, b: base.b * 40 };
  raw[side] += 40;
  const total = raw.p + raw.d + raw.b;
  const P = { p: Math.round(raw.p / total * 100), d: Math.round(raw.d / total * 100) };
  P.b = Math.max(0, 100 - P.p - P.d);

  const top = P.p >= P.d && P.p >= P.b ? 'p' : (P.d >= P.b ? 'd' : 'b');
  const mine = P[side];
  const ident = side === 'b'
    ? `🤝 당신은 <b>중재파</b> · 쌍방과실 <b>${P.b}%</b>`
    : (side === top ? `👑 당신은 <b>다수파</b> · <b>${mine}%</b>가 같은 생각`
                    : `🥷 당신은 <b>소수파</b> · <b>${mine}%</b>만 당신 편`);
  const judge = assignJudge(c.id);
  const box = container.querySelector('#debate-results');
  if (!box) return;
  box.hidden = false;
  box.innerHTML = `
    <div class="debate-poll-label"><span>민심 현황</span><b>예시 분포 · 실시간 집계 준비 중</b></div>
    <div class="debate-splitbar" role="img" aria-label="원고 ${P.p}%, 피고 ${P.d}%, 쌍방 ${P.b}%">
      <div class="debate-seg p" style="width:${animate ? 0 : P.p}%">${P.p > 10 ? P.p + '%' : ''}</div>
      <div class="debate-seg d" style="width:${animate ? 0 : P.d}%">${P.d > 10 ? P.d + '%' : ''}</div>
      <div class="debate-seg b" style="width:${animate ? 0 : P.b}%">${P.b > 8 ? P.b + '%' : ''}</div>
    </div>
    <div class="debate-legend">
      <div class="lg p"><span class="sw"></span><span>원고 ${escapeHtml(c.plaintiff)}</span></div>
      <div class="lg d"><span class="sw"></span><span>피고 ${escapeHtml(c.defendant)}</span></div>
    </div>
    <div class="debate-ident">${ident}</div>

    <div class="debate-judge">
      <div class="debate-judge-av">${judge[1]}</div>
      <div>
        <div class="k">오늘의 담당 재판부</div>
        <div class="n">${escapeHtml(judge[0])} 판사</div>
        <div class="t">AI 판사의 최종 판결문은 다음 업데이트에서 공개됩니다.</div>
      </div>
    </div>

    <div class="debate-sec">
      <div class="debate-sec-h"><h2>방청석</h2><span class="c" id="debate-op-count"></span></div>
      <div id="debate-op-list"></div>
      <div class="debate-op-form">
        <textarea id="debate-op-input" placeholder="이 사건, 당신의 한마디는? (${SIDE_LABEL[side]})" maxlength="140"></textarea>
        <div class="debate-op-row">
          <div class="debate-sidepick" id="debate-sidepick">
            <button type="button" class="p" data-ps="p" aria-pressed="${side === 'p'}">원고 편</button>
            <button type="button" class="d" data-ps="d" aria-pressed="${side === 'd'}">피고 편</button>
          </div>
          <button class="debate-post" type="button" id="debate-post">등록</button>
        </div>
      </div>
    </div>

    <button class="debate-share" type="button" id="debate-share">🔗 결과 공유하고 친구 판단 물어보기</button>
    <div class="debate-teaser">⏰ 내일 또 새로운 토론이 열립니다 · <b>연속 참여를 이어가세요</b></div>
  `;

  if (animate) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const segs = box.querySelectorAll('.debate-seg');
      if (segs[0]) segs[0].style.width = P.p + '%';
      if (segs[1]) segs[1].style.width = P.d + '%';
      if (segs[2]) segs[2].style.width = P.b + '%';
    }));
  }

  let pickSide = side === 'b' ? 'p' : side;
  renderOpinions(container, c);
  box.querySelectorAll('#debate-sidepick [data-ps]').forEach(b => b.addEventListener('click', () => {
    pickSide = b.dataset.ps;
    box.querySelectorAll('#debate-sidepick [data-ps]').forEach(x => x.setAttribute('aria-pressed', x.dataset.ps === pickSide));
  }));
  box.querySelector('#debate-post')?.addEventListener('click', () => postOpinion(container, c, pickSide));
  box.querySelector('#debate-share')?.addEventListener('click', () => shareCase(c, P));
}

function opinionsOf(id) {
  const all = store.get(OPS_KEY, {});
  return Array.isArray(all[id]) ? all[id] : [];
}

function renderOpinions(container, c) {
  const list = opinionsOf(c.id);
  const countEl = container.querySelector('#debate-op-count');
  const listEl = container.querySelector('#debate-op-list');
  if (countEl) countEl.textContent = list.length ? `의견 ${list.length}` : '';
  if (!listEl) return;
  listEl.innerHTML = list.length
    ? list.map(o => `
      <div class="debate-op">
        <div class="debate-op-side ${o.s === 'd' ? 'd' : 'p'}">${o.s === 'd' ? '피고편' : '원고편'}</div>
        <div class="debate-op-body">
          <div class="debate-op-name">나</div>
          <div class="debate-op-text">${escapeHtml(o.t)}</div>
        </div>
      </div>`).join('')
    : `<div class="debate-op-empty">아직 의견이 없어요.<br>이 사건의 첫 방청객이 되어보세요 🗣️</div>`;
}

function postOpinion(container, c, side) {
  const ta = container.querySelector('#debate-op-input');
  const text = (ta?.value || '').trim();
  if (text.length < 2) { showToast('의견을 조금만 더 적어주세요.', 'error'); ta?.focus(); return; }
  const all = store.get(OPS_KEY, {});
  const arr = Array.isArray(all[c.id]) ? all[c.id] : [];
  arr.unshift({ s: side === 'd' ? 'd' : 'p', t: text, ts: Date.now() });
  all[c.id] = arr.slice(0, 50);
  store.set(OPS_KEY, all);
  if (ta) ta.value = '';
  renderOpinions(container, c);
  showToast('의견이 등록됐어요 🗣️', 'success');
}

function shareCase(c, P) {
  const url = `${location.origin}/#/debate/${encodeURIComponent(c.id)}`;
  const text = `⚖️ [오늘의 토론] ${c.title}\n원고 ${P.p}% vs 피고 ${P.d}% · 당신의 판단은?\n소소킹 판결소`;
  if (navigator.share) {
    navigator.share({ title: `소소킹 판결소 · ${c.title}`, text, url }).catch(() => {});
  } else if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(`${text}\n${url}`).then(() => showToast('공유 문구를 복사했어요 📋', 'success')).catch(() => {});
  } else {
    showToast('공유를 지원하지 않는 환경입니다.', 'info');
  }
}

function renderArchive(container, current) {
  const host = container.querySelector('#debate-archive');
  if (!host) return;
  const votes = store.get(VOTES_KEY, {});
  const deck = shuffledDeck(CASES);
  const others = deck.filter(c => c.id !== current.id).slice(0, 8);
  host.innerHTML = others.map(c => {
    const voted = votes[c.id];
    const meta = voted ? `✔ 참여함 · ${SIDE_LABEL[voted]}` : `🌶️${c.spice} · ${escapeHtml(c.category)}`;
    return `<button class="debate-arch-item" type="button" data-go="${escapeHtml(c.id)}">
      <span class="debate-arch-ic">${categoryIcon(c.category)}</span>
      <span class="debate-arch-main"><span class="debate-arch-cat">${escapeHtml(c.category)}</span><span class="debate-arch-t">${escapeHtml(c.title)}</span><span class="debate-arch-meta">${meta}</span></span>
      <span class="debate-arch-go">${voted ? '결과 ›' : '투표 ›'}</span>
    </button>`;
  }).join('');
  host.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    const c = CASES.find(x => x.id === b.dataset.go);
    if (!c) return;
    paintCase(container, c);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}
