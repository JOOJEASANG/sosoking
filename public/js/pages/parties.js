/* parties.js — 소소공화국 정당: 입당·정당 순위·당대표 + 정치성향 테스트 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { getPoliticalRank } from '../utils/political-rank.js';

// 정당별 강점·정책·입당 혜택·한마디 (표시용 메타)
const PARTY_META = {
  national: {
    strengths: ['안정', '경험', '절차'],
    policy: '검증된 정책만 신중하게 — 흔들림 없는 안정',
    perk: '🎖️ 경력직 배지',
    quotes: ['18년 경력으로 말하자면, 서두를 일이 아닙니다.', '먼저 전례를 봐야 합니다.', '그건 위원회에 회부하시죠.'],
  },
  youth: {
    strengths: ['변화', '개혁', 'MZ파워'],
    policy: '기득권 타파, 청년 우선 — 갈아엎자',
    perk: '🔥 혁명가 배지',
    quotes: ['ㄹㅇ 이건 갈아엎어야 됨', '기득권 팩폭 들어간다', '아 답답해서 내가 나선다'],
  },
  center: {
    strengths: ['데이터', '중도', '합리'],
    policy: '여론·통계 기반 합리 정치 — 숫자가 곧 민심',
    perk: '📈 분석가 배지',
    quotes: ['수치를 보면 민심은 이렇습니다.', '오차범위 내 접전이네요.', '데이터가 답을 알고 있죠.'],
  },
};

// 정치성향 테스트 (각 선택지가 정당 친화도에 가중치)
const QUIZ = [
  {
    q: '정치에서 가장 중요한 건?',
    opts: [
      { t: '안정과 경험', w: { national: 2 } },
      { t: '변화와 개혁', w: { youth: 2 } },
      { t: '합리와 데이터', w: { center: 2 } },
    ],
  },
  {
    q: '갈등이 터졌다, 당신은?',
    opts: [
      { t: '선례와 절차부터 확인', w: { national: 2 } },
      { t: '직접 나서서 해결', w: { youth: 2 } },
      { t: '데이터로 원인 분석', w: { center: 2 } },
    ],
  },
  {
    q: 'SNS에서 당신은?',
    opts: [
      { t: '점잖게 안 함', w: { national: 2 } },
      { t: '팩폭 댓글러', w: { youth: 2 } },
      { t: '팩트·통계 정리러', w: { center: 2 } },
    ],
  },
  {
    q: '당신의 말투는?',
    opts: [
      { t: '느긋하고 권위 있게', w: { national: 2 } },
      { t: '직설적이고 솔직하게', w: { youth: 2 } },
      { t: '짧고 냉정하게', w: { center: 2 } },
    ],
  },
  {
    q: '이상적인 나라는?',
    opts: [
      { t: '흔들림 없는 안정', w: { national: 2 } },
      { t: '기득권 없는 공정', w: { youth: 2 } },
      { t: '데이터로 굴러가는 합리', w: { center: 2 } },
    ],
  },
];

let _partiesCache = [];

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function leaderLine(p) {
  if (p.leader && p.leader.power > 0) {
    return `현 당대표 <b>${escHtml(p.leader.nickname)}</b> · 정치력 ${fmtNum(p.leader.power)}`;
  }
  return `당대표 공석 — 입당 후 활동 1위가 당대표!`;
}

function strengthChips(id) {
  const meta = PARTY_META[id];
  if (!meta) return '';
  return `<div class="party-chips">${meta.strengths.map(s => `<span class="party-chip">#${escHtml(s)}</span>`).join('')}</div>`;
}

function renderMyBanner(me) {
  if (!auth.currentUser) {
    return `<div class="party-mine party-mine--guest">
      <div class="party-mine__title">🏛️ 소소공화국 정당</div>
      <div class="party-mine__desc">로그인하고 정당에 입당하면 활동이 곧 정치력이 됩니다.</div>
      <button class="btn btn--primary btn--sm" id="party-login">로그인하고 입당하기</button>
    </div>`;
  }
  if (me && me.partyId) {
    const meta = PARTY_META[me.partyId];
    return `<div class="party-mine">
      <div class="party-mine__label">내 소속 정당</div>
      <div class="party-mine__name">${escHtml(me.partyName)}</div>
      <div class="party-mine__power">내 정치력 <b>${fmtNum(me.power)}</b>${meta ? ` · ${escHtml(meta.perk)}` : ''}</div>
      <div class="party-mine__hint">글·댓글·투표로 활동할수록 정치력이 오르고, 당내 1위가 당대표가 됩니다.</div>
    </div>`;
  }
  return `<div class="party-mine party-mine--none">
    <div class="party-mine__title">아직 소속 정당이 없어요</div>
    <div class="party-mine__desc">정치성향 테스트로 30초 만에 내 정당을 찾거나, 아래에서 직접 골라 입당하세요.</div>
    <button class="btn btn--primary btn--sm" id="party-quiz-open">🧭 내 정당 찾기 (30초 테스트)</button>
  </div>`;
}

function renderRivalry(parties, electionByParty, electionTotal, campaignByParty) {
  if (parties.length < 2) return '';
  const top = parties[0], second = parties[1];
  const gapPower = (top.totalPower || 0) - (second.totalPower || 0);
  const totalPower = (top.totalPower || 0) + (second.totalPower || 0);
  const topPct = totalPower > 0 ? Math.round(((top.totalPower || 0) / totalPower) * 100) : 50;
  const secPct = 100 - topPct;
  const topElecPct = electionTotal > 0 ? Math.round(((electionByParty[top.id] || 0) / electionTotal) * 100) : null;
  const secElecPct = electionTotal > 0 ? Math.round(((electionByParty[second.id] || 0) / electionTotal) * 100) : null;
  const topCamp = campaignByParty[top.id] || 0;
  const secCamp = campaignByParty[second.id] || 0;
  const topTrend = (top.powerDiff || 0) > (second.powerDiff || 0) ? '▲ 상승 중' : '';
  const secTrend = (second.powerDiff || 0) > (top.powerDiff || 0) ? '▲ 상승 중' : '';
  return `
    <div class="party-rivalry">
      <div class="party-rivalry__header">
        <span class="party-rivalry__badge">⚔️ 이번 주 최대 라이벌</span>
        <span class="party-rivalry__gap">정치력 차: ${fmtNum(gapPower)}</span>
      </div>
      <div class="party-rivalry__match">
        <div class="party-rivalry__side party-rivalry__side--left" style="--rc:${top.color}">
          <span class="party-rivalry__emoji">${top.emoji}</span>
          <span class="party-rivalry__name">${escHtml(top.name)}</span>
          <span class="party-rivalry__pwr">${fmtNum(top.totalPower)}P</span>
          ${topTrend ? `<span class="party-rivalry__trend">${topTrend}</span>` : ''}
          ${topElecPct != null ? `<span class="party-rivalry__elec">${topElecPct}% 🗳️</span>` : ''}
          ${topCamp > 0 ? `<span class="party-rivalry__camp">🎤 ${topCamp}</span>` : ''}
        </div>
        <div class="party-rivalry__bar">
          <div class="party-rivalry__bar-fill party-rivalry__bar-fill--left" style="width:${topPct}%;background:${top.color}"></div>
          <div class="party-rivalry__bar-fill party-rivalry__bar-fill--right" style="width:${secPct}%;background:${second.color}"></div>
        </div>
        <div class="party-rivalry__side party-rivalry__side--right" style="--rc:${second.color}">
          <span class="party-rivalry__emoji">${second.emoji}</span>
          <span class="party-rivalry__name">${escHtml(second.name)}</span>
          <span class="party-rivalry__pwr">${fmtNum(second.totalPower)}P</span>
          ${secTrend ? `<span class="party-rivalry__trend">${secTrend}</span>` : ''}
          ${secElecPct != null ? `<span class="party-rivalry__elec">${secElecPct}% 🗳️</span>` : ''}
          ${secCamp > 0 ? `<span class="party-rivalry__camp">🎤 ${secCamp}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function renderParliamentChart(parties) {
  const totalPower = parties.reduce((s, p) => s + (p.totalPower || 0), 0);
  if (totalPower === 0) return '';
  const TOTAL_SEATS = 100;
  const seats = parties.map(p => ({
    ...p,
    seats: Math.max(1, Math.round(((p.totalPower || 0) / totalPower) * TOTAL_SEATS)),
  }));
  // 의석 합이 100이 되도록 최대값 조정
  let sum = seats.reduce((s, p) => s + p.seats, 0);
  if (sum !== TOTAL_SEATS) {
    const idx = seats.indexOf(seats.reduce((a, b) => (a.seats > b.seats ? a : b)));
    seats[idx].seats += TOTAL_SEATS - sum;
  }

  const blocks = seats.map(p => {
    const label = p.seats >= 8 ? `${p.emoji}<br><span class="parl-block__seats">${p.seats}</span>` : `<span class="parl-block__seats">${p.seats}</span>`;
    return `<div class="parl-block" style="flex:${p.seats};background:${p.color}" title="${p.name} ${p.seats}석">
      ${label}
    </div>`;
  }).join('');

  const legend = seats.map(p =>
    `<span class="parl-legend-item"><span class="parl-legend-dot" style="background:${p.color}"></span>${p.emoji} ${p.seats}석</span>`
  ).join('');

  return `
    <div class="parl-chart">
      <div class="parl-chart__title">🏛️ 공화국 의석 현황 <span class="parl-chart__sub">총 ${TOTAL_SEATS}석 · 정치력 비례</span></div>
      <div class="parl-blocks">${blocks}</div>
      <div class="parl-legend">${legend}</div>
    </div>`;
}

function renderTrendBadge(diff) {
  if (!diff) return '';
  if (diff > 0) return `<span class=”party-trend party-trend--up”>▲ +${fmtNum(diff)}</span>`;
  return `<span class=”party-trend party-trend--down”>▼ ${fmtNum(Math.abs(diff))}</span>`;
}

function renderStandingsBoard(parties, electionByParty, electionTotal) {
  if (!parties.length) return '';
  const maxPower = Math.max(...parties.map(p => p.totalPower || 0), 1);

  const rows = parties.map(p => {
    const pct = Math.round(((p.totalPower || 0) / maxPower) * 100);
    const elecPct = electionTotal > 0
      ? Math.round(((electionByParty[p.id] || 0) / electionTotal) * 100)
      : null;
    const isTop = p.rank === 1;
    return `
      <div class=”standings-row${isTop ? ' standings-row--top' : ''}” style=”--party-color:${p.color}”>
        <div class=”standings-row__rank”>${medal(p.rank)}</div>
        <div class=”standings-row__party”>
          <span class=”standings-row__emoji”>${p.emoji}</span>
          <div class=”standings-row__info”>
            <span class=”standings-row__name”>${escHtml(p.name)}</span>
            ${p.leader?.nickname ? `<span class=”standings-row__leader”>👑 ${escHtml(p.leader.nickname)}</span>` : '<span class=”standings-row__leader”>공석</span>'}
          </div>
        </div>
        <div class=”standings-row__bar-wrap”>
          <div class=”standings-row__bar” style=”width:${Math.max(2, pct)}%”></div>
        </div>
        <div class=”standings-row__stats”>
          <span class=”standings-row__power”>${fmtNum(p.totalPower)}P</span>
          ${elecPct !== null ? `<span class=”standings-row__elec”>${elecPct}%🗳</span>` : ''}
          ${(p.powerDiff || 0) > 0 ? `<span class=”standings-row__trend”>▲</span>` : ''}
          <span class=”standings-row__members”>${fmtNum(p.memberCount)}명</span>
        </div>
      </div>`;
  }).join('');

  return `<div class=”standings-board”>${rows}</div>`;
}

function renderPartyCard(p, me, isTopPower, presPartyId, winCount, elecVotes = 0, elecTotal = 0, campaignCount = 0) {
  const isMine = me && me.partyId === p.id;
  const isPrezParty = presPartyId && p.id === presPartyId;
  const meta = PARTY_META[p.id];
  const elecPct = elecTotal > 0 ? Math.round((elecVotes / elecTotal) * 100) : null;

  const topBadges = [
    isTopPower ? `<span class=”pcard-badge pcard-badge--top”>👑 제1당</span>` : '',
    isPrezParty ? `<span class=”pcard-badge pcard-badge--prez”>🏛️ 집권당</span>` : '',
    isMine      ? `<span class=”pcard-badge pcard-badge--mine”>✅ 내 정당</span>` : '',
  ].filter(Boolean).join('');

  const joinBtn = isMine
    ? ''
    : `<button class=”btn btn--primary btn--full party-join-btn” data-party=”${p.id}” data-name=”${escHtml(p.name)}”>${me && me.partyId ? '⟳ 이적' : '입당하기'}</button>`;

  return `
    <div class=”pcard${isMine ? ' pcard--mine' : ''}${isTopPower ? ' pcard--top' : ''}${isPrezParty ? ' pcard--prez' : ''}” style=”--party-color:${p.color}”>
      <div class=”pcard__header”>
        ${topBadges ? `<div class=”pcard__badges”>${topBadges}</div>` : ''}
        <div class=”pcard__rank”>${medal(p.rank)}</div>
        <div class=”pcard__emoji”>${p.emoji}</div>
        <div class=”pcard__name”>${escHtml(p.name)}</div>
        <div class=”pcard__slogan”>”${escHtml(p.slogan)}”</div>
      </div>
      <div class=”pcard__body”>
        ${meta ? `<div class=”pcard__chips”>${meta.strengths.map(s => `<span class=”pcard__chip”>#${escHtml(s)}</span>`).join('')}</div>` : ''}
        ${meta ? `<div class=”pcard__policy”>📌 ${escHtml(meta.policy)}</div>` : ''}
        <div class=”pcard__leader”>${leaderLine(p)}</div>
        <div class=”pcard__stats”>
          <div class=”pcard__stat”>
            <span class=”pcard__stat-label”>정치력</span>
            <span class=”pcard__stat-value”>⚡ ${fmtNum(p.totalPower)}P${renderTrendBadge(p.powerDiff)}</span>
          </div>
          <div class=”pcard__stat”>
            <span class=”pcard__stat-label”>당원</span>
            <span class=”pcard__stat-value”>👥 ${fmtNum(p.memberCount)}</span>
          </div>
          ${elecPct !== null ? `<div class=”pcard__stat”>
            <span class=”pcard__stat-label”>득표율</span>
            <span class=”pcard__stat-value”>🗳️ ${elecPct}%</span>
          </div>` : ''}
          ${winCount > 0 ? `<div class=”pcard__stat”>
            <span class=”pcard__stat-label”>역대 집권</span>
            <span class=”pcard__stat-value”>🏆 ${winCount}회</span>
          </div>` : ''}
        </div>
        <div class=”pcard__footer”>
          <div class=”pcard__footer-btns”>
            <button class=”pcard__text-btn party-members-btn” data-party=”${p.id}”>👥 당원</button>
            <button class=”pcard__text-btn party-manifesto-btn” data-party=”${p.id}”>📜 당론</button>
          </div>
          ${joinBtn}
        </div>
      </div>
      ${meta && isMine ? `<div id=”party-manifesto-slot”></div>` : ''}
    </div>
    <div class=”party-members” id=”members-${p.id}” hidden></div>
    <div class=”party-manifesto-display” id=”manifesto-display-${p.id}” hidden></div>`;
}

function showJoinCeremony(partyId, name, color, emoji) {
  const meta = PARTY_META[partyId];
  const quote = meta ? pick(meta.quotes) : '';
  const perk = meta ? meta.perk : '';

  const overlay = document.createElement('div');
  overlay.className = 'join-ceremony';
  overlay.innerHTML = `
    <div class="join-ceremony__card" style="--party-color:${color}">
      <div class="join-ceremony__burst" aria-hidden="true">
        <span>🎊</span><span>🎉</span><span>✨</span><span>🎊</span><span>🎉</span>
      </div>
      <div class="join-ceremony__emoji">${emoji}</div>
      <div class="join-ceremony__congrats">입당 완료!</div>
      <div class="join-ceremony__name">${escHtml(name)}</div>
      ${perk ? `<div class="join-ceremony__perk">${escHtml(perk)} 획득</div>` : ''}
      ${quote ? `<div class="join-ceremony__quote">"${escHtml(quote)}"</div>` : ''}
      <div class="join-ceremony__hint">활동할수록 정치력이 쌓여 당내 1위 <b>당대표</b>가 됩니다</div>
      <button class="btn btn--primary join-ceremony__go" id="jc-go">지금 활동하러 가기 →</button>
      <button class="join-ceremony__close" id="jc-close">닫기</button>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('join-ceremony--visible'));

  overlay.querySelector('#jc-go').addEventListener('click', () => { overlay.remove(); navigate('/battle'); });
  overlay.querySelector('#jc-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function doJoin(partyId, name) {
  const call = httpsCallable(functions, 'joinParty');
  await call({ partyId });
  const found = _partiesCache.find(p => p.id === partyId);
  const color = found?.color || '#ff6b4a';
  const emoji = found?.emoji || '🏛️';
  showJoinCeremony(partyId, name, color, emoji);
  renderParties();
}

async function loadMembers(partyId, host) {
  host.innerHTML = `<div class="party-members__loading">불러오는 중…</div>`;
  try {
    const call = httpsCallable(functions, 'getPartyMembers');
    const { data } = await call({ partyId });
    const members = data.members || [];
    const weeklyStars = data.weeklyStars || [];
    if (!members.length) {
      host.innerHTML = `<div class="party-members__empty">아직 당원이 없어요. 첫 당원이 되어보세요!</div>`;
      return;
    }
    const starsHTML = weeklyStars.length ? `
      <div class="party-weekly-stars">
        <div class="party-weekly-stars__title">🔥 이번 주 급부상</div>
        ${weeklyStars.map((m, i) => `
          <span class="party-weekly-star">
            ${['🥇','🥈','🥉'][i] || ''}
            ${m.icon?.value ? m.icon.value + ' ' : ''}${escHtml(m.nickname)}
            <em>+${fmtNum(m.weeklyGain)}P</em>
          </span>`).join('')}
      </div>` : '';
    host.innerHTML = starsHTML + members.map(m => {
      const polRank = getPoliticalRank(m.power || 0);
      return `
      <div class="party-member${m.rank === 1 ? ' party-member--leader' : ''}">
        <span class="party-member__rank">${m.rank === 1 ? '👑' : m.rank}</span>
        <span class="party-member__pol-rank" title="${escHtml(polRank.label)}">${polRank.emoji}</span>
        <span class="party-member__name">${escHtml(m.nickname)}${m.rank === 1 ? ' <span class="party-member__badge">당대표</span>' : ''}</span>
        <span class="party-member__power">${fmtNum(m.power)}</span>
      </div>`;
    }).join('');
  } catch (e) {
    host.innerHTML = `<div class="party-members__empty">당원 목록을 불러오지 못했어요.</div>`;
  }
}

// ── 정치성향 테스트 ──
function openQuiz() {
  if (!auth.currentUser) { navigate('/login'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'quiz-overlay';
  const answers = new Array(QUIZ.length).fill(-1);

  const renderBody = () => {
    overlay.innerHTML = `
      <div class="quiz-modal">
        <button class="quiz-close" id="quiz-close" aria-label="닫기">✕</button>
        <div class="quiz-title">🧭 내 정당 찾기</div>
        <div class="quiz-sub">5문항 · 30초 — 내 정치성향에 맞는 정당을 추천해드려요</div>
        <div class="quiz-body">
          ${QUIZ.map((item, qi) => `
            <div class="quiz-q">
              <div class="quiz-q__title">Q${qi + 1}. ${escHtml(item.q)}</div>
              <div class="quiz-opts">
                ${item.opts.map((o, oi) => `
                  <button class="quiz-opt${answers[qi] === oi ? ' selected' : ''}" data-q="${qi}" data-o="${oi}">${escHtml(o.t)}</button>
                `).join('')}
              </div>
            </div>`).join('')}
        </div>
        <button class="btn btn--primary quiz-submit" id="quiz-submit">결과 보기</button>
      </div>`;

    overlay.querySelector('#quiz-close').addEventListener('click', () => overlay.remove());
    overlay.querySelectorAll('.quiz-opt').forEach(b => {
      b.addEventListener('click', () => {
        const qi = Number(b.dataset.q), oi = Number(b.dataset.o);
        answers[qi] = oi;
        overlay.querySelectorAll(`.quiz-opt[data-q="${qi}"]`).forEach(x => x.classList.toggle('selected', Number(x.dataset.o) === oi));
      });
    });
    overlay.querySelector('#quiz-submit').addEventListener('click', () => {
      if (answers.includes(-1)) { toast.warn('모든 문항에 답해주세요!'); return; }
      showResult();
    });
  };

  const showResult = () => {
    const score = {};
    QUIZ.forEach((item, qi) => {
      const w = item.opts[answers[qi]].w;
      for (const k in w) score[k] = (score[k] || 0) + w[k];
    });
    const ranked = _partiesCache.length
      ? [..._partiesCache].sort((a, b) => (score[b.id] || 0) - (score[a.id] || 0))
      : [];
    const best = ranked[0];
    if (!best) { overlay.remove(); return; }
    const meta = PARTY_META[best.id];

    overlay.innerHTML = `
      <div class="quiz-modal quiz-result" style="--party-color:${best.color}">
        <button class="quiz-close" id="quiz-close2" aria-label="닫기">✕</button>
        <div class="quiz-result__label">당신과 가장 잘 맞는 정당은</div>
        <div class="quiz-result__emoji">${best.emoji}</div>
        <div class="quiz-result__name">${escHtml(best.name)}</div>
        <div class="quiz-result__slogan">“${escHtml(best.slogan)}”</div>
        ${meta ? `<div class="quiz-result__chips">${meta.strengths.map(s => `<span class="party-chip">#${escHtml(s)}</span>`).join('')}</div>` : ''}
        ${meta ? `<div class="quiz-result__policy">📌 ${escHtml(meta.policy)}</div><div class="quiz-result__perk">입당 혜택 ${escHtml(meta.perk)}</div>` : ''}
        <button class="btn btn--primary quiz-join" id="quiz-join">${best.emoji} ${escHtml(best.name)} 입당하기</button>
        <button class="quiz-retry" id="quiz-retry">다시 테스트</button>
      </div>`;

    overlay.querySelector('#quiz-close2').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#quiz-retry').addEventListener('click', () => { answers.fill(-1); renderBody(); });
    overlay.querySelector('#quiz-join').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.disabled = true; b.textContent = '입당 중…';
      try {
        await doJoin(best.id, best.name);
        overlay.remove();
      } catch (err) {
        toast.error(err?.message || '입당에 실패했어요.');
        b.disabled = false; b.textContent = `${best.emoji} ${best.name} 입당하기`;
      }
    });
  };

  renderBody();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function renderActivityFeed(activities, topic) {
  if (!activities || !activities.length) return '';
  return `
    <div class="party-activity-section">
      <div class="party-activity-header">
        <span class="party-activity-live">🔴 LIVE</span>
        <span class="party-activity-title">오늘의 정당 활동</span>
        <span class="party-activity-topic">"${escHtml(topic || '')}"</span>
      </div>
      <div class="party-activity-list">
        ${activities.map(a => `
          <div class="party-activity-item" style="--party-c:${a.color}">
            <span class="party-activity-emoji">${a.emoji}</span>
            <div class="party-activity-body">
              <span class="party-activity-name">${escHtml(a.charName)} <em>${escHtml(a.partyName)}</em></span>
              <p class="party-activity-text">${escHtml(a.text)}</p>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

async function loadPartyManifesto(slot, partyId, isLeader = false) {
  if (!slot || !partyId) return;
  try {
    slot.innerHTML = `<div class="party-manifesto party-manifesto--loading">당론 성명 불러오는 중…</div>`;
    const call = httpsCallable(functions, 'getPartyManifesto');
    const { data } = await call({ partyId });

    const editBtn = isLeader
      ? `<button class="party-manifesto__edit-btn" id="party-manifesto-edit" type="button">✏️ 수정</button>`
      : '';

    if (!data.manifesto) {
      slot.innerHTML = isLeader
        ? `<div class="party-manifesto party-manifesto--empty">
            <div class="party-manifesto__title">📜 이번 주 당론 성명</div>
            <p class="party-manifesto__text">아직 없습니다. 당대표로서 성명을 입력해보세요!</p>
            <button class="btn btn--primary btn--sm" id="party-manifesto-write" type="button">✍️ 당론 성명 작성</button>
          </div>`
        : '';
    } else {
      slot.innerHTML = `
        <div class="party-manifesto">
          <div class="party-manifesto__title">📜 이번 주 당론 성명${editBtn}</div>
          <p class="party-manifesto__text">"${escHtml(data.manifesto)}"</p>
        </div>`;
    }

    if (isLeader) {
      const openEditor = () => {
        slot.innerHTML = `
          <div class="party-manifesto party-manifesto--editing">
            <div class="party-manifesto__title">✍️ 당론 성명 입력 (최대 150자)</div>
            <textarea class="party-manifesto__input" id="party-manifesto-input" maxlength="150" rows="3" placeholder="이번 주 ${PARTY_META[partyId]?.strengths?.[0] || ''} 관련 당론을 밝혀주세요...">${data.manifesto || ''}</textarea>
            <div class="party-manifesto__actions">
              <button class="btn btn--primary btn--sm" id="party-manifesto-save">저장</button>
              <button class="btn btn--ghost btn--sm" id="party-manifesto-cancel">취소</button>
            </div>
          </div>`;
        slot.querySelector('#party-manifesto-cancel')?.addEventListener('click', () =>
          loadPartyManifesto(slot, partyId, true)
        );
        slot.querySelector('#party-manifesto-save')?.addEventListener('click', async () => {
          const saveBtn = slot.querySelector('#party-manifesto-save');
          const inputEl = slot.querySelector('#party-manifesto-input');
          if (!inputEl || !saveBtn) return;
          const newText = inputEl.value.trim();
          if (!newText || newText.length < 5) { toast.warn('5자 이상 입력해주세요'); return; }
          saveBtn.disabled = true;
          saveBtn.textContent = '저장 중…';
          try {
            await httpsCallable(functions, 'setPartyManifesto')({ text: newText });
            toast.success('당론 성명을 발표했습니다! 📜');
            loadPartyManifesto(slot, partyId, true);
          } catch (e) {
            toast.error(e?.message || '저장에 실패했어요');
            saveBtn.disabled = false;
            saveBtn.textContent = '저장';
          }
        });
      };
      slot.querySelector('#party-manifesto-edit')?.addEventListener('click', openEditor);
      slot.querySelector('#party-manifesto-write')?.addEventListener('click', openEditor);
    }
  } catch { slot.innerHTML = ''; }
}

export async function renderParties() {
  setMeta('소소공화국 정당');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `<div class="parties-page page-enter">
    <div class="skeleton" style="height:120px;border-radius:16px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:320px;border-radius:16px"></div>
  </div>`;

  let overview, activitiesData, president = null, electionWins = {}, electionByParty = {}, electionTotal = 0, campaignByParty = {};
  try {
    const callOverview = httpsCallable(functions, 'getPoliticsOverview');
    const callActivities = httpsCallable(functions, 'getPartyActivities');
    const callPresident = httpsCallable(functions, 'getPresident');
    const callHistory = httpsCallable(functions, 'getElectionHistory');
    const callElection = httpsCallable(functions, 'getElection');
    const callMomentum = httpsCallable(functions, 'getCampaignMomentum');
    const [overviewRes, activitiesRes, presidentRes, historyRes, elecRes, momentumRes] = await Promise.all([
      callOverview(), callActivities(),
      callPresident().catch(() => null),
      callHistory().catch(() => null),
      callElection().catch(() => null),
      callMomentum().catch(() => null),
    ]);
    overview = overviewRes.data;
    activitiesData = activitiesRes.data;
    president = presidentRes?.data?.president || null;
    (historyRes?.data?.history || []).forEach(h => {
      if (h.winner?.partyId && !h.seeded) {
        electionWins[h.winner.partyId] = (electionWins[h.winner.partyId] || 0) + 1;
      }
    });
    const elec = elecRes?.data?.election;
    if (elec && elec.status === 'open') {
      electionTotal = elec.totalVotes || 0;
      (elec.candidates || []).forEach(c => { if (c.partyId) electionByParty[c.partyId] = c.votes || 0; });
    }
    (momentumRes?.data?.byParty || []).forEach(p => { campaignByParty[p.partyId] = p.count; });
  } catch (err) {
    console.error('[parties] load error', err);
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">정당 현황을 불러오지 못했어요</div>
      <button class="btn btn--primary" style="margin-top:16px" id="party-retry">다시 시도</button>
    </div>`;
    el.querySelector('#party-retry')?.addEventListener('click', renderParties);
    return;
  }

  const { parties = [], me = null } = overview;
  _partiesCache = parties;

  const ruling = parties[0] || null; // 제1당 (정치력 최강)
  const activityHTML = renderActivityFeed(activitiesData?.activities, activitiesData?.topic);

  // 공화국 집계 통계
  const totalCitizens = parties.reduce((s, p) => s + (p.memberCount || 0), 0);
  const totalPower = parties.reduce((s, p) => s + (p.totalPower || 0), 0);
  const topGrowthParty = [...parties].sort((a, b) => (b.powerDiff || 0) - (a.powerDiff || 0))[0];

  // 현재 정세 요약 — 제1당 + 현직 대통령 + 공화국 통계
  const stateHTML = `
    <div class="republic-state">
      <div class="republic-state__item">
        <span class="republic-state__label">제1당</span>
        ${ruling
          ? `<span class="republic-state__value" style="--party-color:${ruling.color}">${ruling.emoji} ${escHtml(ruling.name)}</span>`
          : `<span class="republic-state__value">집계 중</span>`}
      </div>
      <div class="republic-state__divider"></div>
      <div class="republic-state__item">
        <span class="republic-state__label">현직 대통령</span>
        ${president
          ? `<span class="republic-state__value" style="--party-color:${president.color}">👑 ${escHtml(president.candidateName)}</span>`
          : `<span class="republic-state__value">선출 전</span>`}
      </div>
      <div class="republic-state__divider"></div>
      <div class="republic-state__item">
        <span class="republic-state__label">소소시민</span>
        <span class="republic-state__value">👥 ${fmtNum(totalCitizens)}명</span>
      </div>
      <div class="republic-state__divider"></div>
      <div class="republic-state__item">
        <span class="republic-state__label">총 정치력</span>
        <span class="republic-state__value">⚡ ${fmtNum(totalPower)}P</span>
      </div>
      ${topGrowthParty && (topGrowthParty.powerDiff || 0) > 0 ? `
      <div class="republic-state__divider"></div>
      <div class="republic-state__item">
        <span class="republic-state__label">급성장</span>
        <span class="republic-state__value" style="--party-color:${topGrowthParty.color}">${topGrowthParty.emoji} +${fmtNum(topGrowthParty.powerDiff)}</span>
      </div>` : ''}
    </div>`;

  const parliamentHTML = renderParliamentChart(parties);
  const rivalryHTML = renderRivalry(parties, electionByParty, electionTotal, campaignByParty);

  el.innerHTML = `<div class="parties-page page-enter">
    <div class="parties-hero">
      <div class="parties-hero__badge">🏛️ 소소공화국 정당정치</div>
      <h1 class="parties-hero__title">7개 정당, 단 하나의 권력</h1>
      <p class="parties-hero__sub">입당해 정치력을 쌓고 당내 1위 <b>당대표</b>로, 매주 <b>대선</b>에서 <b>대통령</b>에 도전하세요.</p>
    </div>
    ${stateHTML}
    ${rivalryHTML}
    ${parliamentHTML}
    ${activityHTML}
    ${renderMyBanner(me)}
    <div class="standings-section">
      <div class="standings-section__header">
        <div>
          <div class="standings-section__eyebrow">PARTY POWER RANKING</div>
          <div class="standings-section__title">📊 정당 세력 순위</div>
        </div>
        <button class="parties-quiz-btn" id="party-quiz-top">🧭 내 정당 찾기</button>
      </div>
      ${renderStandingsBoard(parties, electionByParty, electionTotal)}
    </div>
    <div class="parties-detail-title">정당 상세 정보 · 입당</div>
    <div class="parties-list">
      ${parties.map((p, i) => renderPartyCard(p, me, i === 0, president?.partyId || null, electionWins[p.id] || 0, electionByParty[p.id] || 0, electionTotal, campaignByParty[p.id] || 0)).join('')}
    </div>
  </div>`;

  el.querySelector('#party-login')?.addEventListener('click', () => navigate('/login'));
  el.querySelector('#party-quiz-open')?.addEventListener('click', openQuiz);
  el.querySelector('#party-quiz-top')?.addEventListener('click', openQuiz);

  // 내 정당 당론 성명 비동기 로드
  if (me && me.partyId) {
    const myPartyData = parties.find(p => p.id === me.partyId);
    const isMyPartyLeader = !!(auth.currentUser && myPartyData?.leader?.uid === auth.currentUser.uid);
    const manifestoSlot = el.querySelector(`#pcard-${me.partyId} #party-manifesto-slot`) || el.querySelector('#party-manifesto-slot');
    loadPartyManifesto(manifestoSlot, me.partyId, isMyPartyLeader);
  }

  el.querySelectorAll('.party-members-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.party;
      const host = el.querySelector(`#members-${pid}`);
      if (!host) return;
      if (host.hidden) {
        host.hidden = false;
        btn.textContent = '닫기';
        loadMembers(pid, host);
      } else {
        host.hidden = true;
        btn.textContent = '당원 보기';
      }
    });
  });

  el.querySelectorAll('.party-manifesto-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.party;
      const host = el.querySelector(`#manifesto-display-${pid}`);
      if (!host) return;
      if (!host.hidden) {
        host.hidden = true;
        btn.textContent = '📜 당론';
        return;
      }
      host.hidden = false;
      btn.textContent = '📜 닫기';
      if (host.dataset.loaded) return;
      host.dataset.loaded = '1';
      host.innerHTML = `<div class="party-manifesto-display__loading">당론 불러오는 중…</div>`;
      try {
        const { data } = await httpsCallable(functions, 'getPartyManifesto')({ partyId: pid });
        const partyMeta = PARTY_META[pid];
        host.innerHTML = data.manifesto
          ? `<div class="party-manifesto-display__box">
               <div class="party-manifesto-display__label">📜 이번 주 당론 성명</div>
               <p class="party-manifesto-display__text">"${escHtml(data.manifesto)}"</p>
             </div>`
          : `<div class="party-manifesto-display__box party-manifesto-display__box--empty">
               <div class="party-manifesto-display__label">📜 당론 성명</div>
               <p class="party-manifesto-display__text">${partyMeta ? escHtml(partyMeta.policy) : '당론 성명이 아직 없습니다.'}</p>
             </div>`;
      } catch {
        host.innerHTML = `<div class="party-manifesto-display__box party-manifesto-display__box--empty"><p class="party-manifesto-display__text">불러오지 못했어요.</p></div>`;
      }
    });
  });

  el.querySelectorAll('.party-join-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const partyId = btn.dataset.party;
      const name = btn.dataset.name;
      if (me && me.partyId && !confirm(`현재 정당을 탈당하고 '${name}'으로 이적할까요?`)) return;
      btn.disabled = true;
      btn.textContent = '처리 중…';
      try {
        await doJoin(partyId, name);
      } catch (e) {
        toast.error(e?.message || '입당에 실패했어요.');
        btn.disabled = false;
        btn.textContent = '입당';
      }
    });
  });
}
