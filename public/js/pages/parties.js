/* parties.js — 새공화국 정당: 보수·진보·중도 3당 + 6인 캐릭터 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { getPoliticalRank } from '../utils/political-rank.js';

const PARTY_META = {
  national: {
    ideology: '보수파',
    strengths: ['안보', '질서', '성장', '책임'],
    policy: '군사독재 이후의 혼란을 경계하며, 안보와 질서 속에서 점진적 개혁을 추진합니다.',
    perk: '🛡️ 질서 수호 배지',
    characters: [
      { name: '강도윤', role: '대표', text: '위기에는 국가가 흔들리지 않아야 합니다.' },
      { name: '서문하', role: '경제·언론 전략가', text: '민심은 구호보다 물가와 성장률에 먼저 반응합니다.' },
    ],
    quotes: ['질서 없는 개혁은 또 다른 혼란입니다.', '국가의 기본은 안보와 책임입니다.', '정치는 감정보다 운영 능력입니다.'],
  },
  youth: {
    ideology: '진보파',
    strengths: ['개혁', '복지', '시민권', '공정'],
    policy: '광장에서 시작된 민주주의를 제도 개혁과 시민권 확대로 이어가려는 개혁 노선입니다.',
    perk: '🕯️ 시민개혁 배지',
    characters: [
      { name: '한서윤', role: '대표', text: '시민이 만든 권력은 시민에게 돌아가야 합니다.' },
      { name: '백진우', role: '제도개혁 참모', text: '낡은 권력 구조를 고치지 않으면 역사는 반복됩니다.' },
    ],
    quotes: ['광장의 요구를 제도로 바꿔야 합니다.', '개혁은 미루는 순간 기득권이 됩니다.', '공정은 말이 아니라 구조입니다.'],
  },
  center: {
    ideology: '중도파',
    strengths: ['협치', '균형', '실용', '통합'],
    policy: '진영 갈등을 줄이고, 연정과 합의를 통해 지속 가능한 개혁을 추진합니다.',
    perk: '⚖️ 통합 중재 배지',
    characters: [
      { name: '윤태건', role: '대표', text: '이긴 쪽만의 공화국은 오래가지 못합니다.' },
      { name: '오하린', role: '여론·세대 분석가', text: '광장은 하나가 아닙니다. 세대마다 다른 분노가 있습니다.' },
    ],
    quotes: ['정치는 이기는 기술이 아니라 버티는 제도입니다.', '협치는 약함이 아니라 비용을 줄이는 기술입니다.', '숫자와 현장을 같이 봐야 합니다.'],
  },
};

const QUIZ = [
  {
    q: '새 공화국이 시작됐다. 가장 먼저 해야 할 일은?',
    opts: [
      { t: '안보와 행정 질서를 안정시킨다', w: { national: 2 } },
      { t: '권력기관과 낡은 제도를 개혁한다', w: { youth: 2 } },
      { t: '갈등을 줄이는 합의 체계를 만든다', w: { center: 2 } },
    ],
  },
  {
    q: '경제 위기가 터졌을 때 우선순위는?',
    opts: [
      { t: '기업 활동과 시장 신뢰 회복', w: { national: 2 } },
      { t: '실업자·서민 보호와 복지 확충', w: { youth: 2 } },
      { t: '재정 안정과 사회 안전망의 균형', w: { center: 2 } },
    ],
  },
  {
    q: '대규모 시민집회가 열렸다. 당신의 판단은?',
    opts: [
      { t: '질서 유지와 제도 절차가 우선이다', w: { national: 2 } },
      { t: '시민의 요구를 정치가 받아야 한다', w: { youth: 2 } },
      { t: '요구를 제도권 협상으로 연결해야 한다', w: { center: 2 } },
    ],
  },
  {
    q: '국회가 여소야대로 막혔다. 당신의 방식은?',
    opts: [
      { t: '원칙을 세우고 정면 돌파한다', w: { national: 2 } },
      { t: '시민 여론으로 개혁 동력을 만든다', w: { youth: 2 } },
      { t: '양쪽이 받을 수 있는 절충안을 만든다', w: { center: 2 } },
    ],
  },
  {
    q: '이상적인 지도자는?',
    opts: [
      { t: '위기 때 흔들리지 않는 책임형 지도자', w: { national: 2 } },
      { t: '불평등과 특권을 깨는 개혁형 지도자', w: { youth: 2 } },
      { t: '갈라진 시민을 묶는 조정형 지도자', w: { center: 2 } },
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

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function leaderLine(p) {
  if (p.leader && p.leader.power > 0) {
    const role = p.leader.role ? ` · ${escHtml(p.leader.role)}` : '';
    return `현 당대표 <b>${escHtml(p.leader.nickname)}</b>${role} · 정치력 ${fmtNum(p.leader.power)}`;
  }
  return '당대표 공석 — 입당 후 활동 1위가 당대표!';
}

function renderMyBanner(me) {
  if (!auth.currentUser) {
    return `<div class="party-mine party-mine--guest">
      <div class="party-mine__title">🏛️ 새공화국 정당정치</div>
      <div class="party-mine__desc">보수파·진보파·중도파 중 하나를 선택해 새 공화국의 정치사를 써 내려가세요.</div>
      <button class="btn btn--primary btn--sm" id="party-login">로그인하고 입당하기</button>
    </div>`;
  }
  if (me && me.partyId) {
    const meta = PARTY_META[me.partyId];
    return `<div class="party-mine">
      <div class="party-mine__label">내 소속 정당</div>
      <div class="party-mine__name">${escHtml(me.partyName)}</div>
      <div class="party-mine__power">내 정치력 <b>${fmtNum(me.power)}</b>${meta ? ` · ${escHtml(meta.perk)}` : ''}</div>
      <div class="party-mine__hint">시민발언·댓글·투표로 정치력을 쌓고 당내 1위가 되어 당대표에 도전하세요.</div>
    </div>`;
  }
  return `<div class="party-mine party-mine--none">
    <div class="party-mine__title">아직 소속 정당이 없어요</div>
    <div class="party-mine__desc">정치성향 테스트로 내 정당을 찾거나, 아래에서 직접 골라 입당하세요.</div>
    <button class="btn btn--primary btn--sm" id="party-quiz-open">🧭 내 정당 찾기</button>
  </div>`;
}

function renderCharacters(meta) {
  if (!meta?.characters?.length) return '';
  return `<div class="pcard__characters">
    ${meta.characters.map(c => `<div class="pcard__character">
      <b>${escHtml(c.name)}</b><span>${escHtml(c.role)}</span>
      <p>${escHtml(c.text)}</p>
    </div>`).join('')}
  </div>`;
}

function renderParliamentChart(parties) {
  const totalPower = parties.reduce((s, p) => s + (p.totalPower || 0), 0);
  if (totalPower === 0) return '';
  const totalSeats = 100;
  const seats = parties.map(p => ({ ...p, seats: Math.max(1, Math.round(((p.totalPower || 0) / totalPower) * totalSeats)) }));
  let sum = seats.reduce((s, p) => s + p.seats, 0);
  if (sum !== totalSeats) {
    const idx = seats.indexOf(seats.reduce((a, b) => (a.seats > b.seats ? a : b)));
    seats[idx].seats += totalSeats - sum;
  }
  return `<div class="parl-chart">
    <div class="parl-chart__title">🏛️ 새공화국 의석 현황 <span class="parl-chart__sub">총 ${totalSeats}석 · 정치력 비례</span></div>
    <div class="parl-blocks">
      ${seats.map(p => `<div class="parl-block" style="flex:${p.seats};background:${p.color}" title="${escHtml(p.name)} ${p.seats}석">${p.emoji}<br><span class="parl-block__seats">${p.seats}</span></div>`).join('')}
    </div>
    <div class="parl-legend">${seats.map(p => `<span class="parl-legend-item"><span class="parl-legend-dot" style="background:${p.color}"></span>${p.emoji} ${p.seats}석</span>`).join('')}</div>
  </div>`;
}

function renderPartyCard(p, me, isTopPower) {
  const meta = PARTY_META[p.id];
  const isMine = me && me.partyId === p.id;
  const joinBtn = isMine
    ? ''
    : `<button class="btn btn--primary btn--full party-join-btn" data-party="${p.id}" data-name="${escHtml(p.name)}">${me && me.partyId ? '⟳ 이적' : '입당하기'}</button>`;

  return `<div class="pcard${isMine ? ' pcard--mine' : ''}${isTopPower ? ' pcard--top' : ''}" style="--party-color:${p.color}">
    <div class="pcard__header">
      <div class="pcard__badges">
        ${isTopPower ? '<span class="pcard-badge pcard-badge--top">👑 제1당</span>' : ''}
        ${isMine ? '<span class="pcard-badge pcard-badge--mine">✅ 내 정당</span>' : ''}
        ${meta ? `<span class="pcard-badge">${escHtml(meta.ideology)}</span>` : ''}
      </div>
      <div class="pcard__rank">${medal(p.rank)}</div>
      <div class="pcard__emoji">${p.emoji}</div>
      <div class="pcard__name">${escHtml(p.name)}</div>
      <div class="pcard__slogan">“${escHtml(p.slogan)}”</div>
    </div>
    <div class="pcard__body">
      ${meta ? `<div class="pcard__chips">${meta.strengths.map(s => `<span class="pcard__chip">#${escHtml(s)}</span>`).join('')}</div>` : ''}
      ${meta ? `<div class="pcard__policy">📌 ${escHtml(meta.policy)}</div>` : ''}
      ${renderCharacters(meta)}
      <div class="pcard__leader">${leaderLine(p)}</div>
      ${p.leader?.profile ? `<div class="pcard__policy">인물 설명 · ${escHtml(p.leader.profile)}</div>` : ''}
      ${p.leader?.flaw ? `<div class="pcard__policy">약점 · ${escHtml(p.leader.flaw)}</div>` : ''}
      <div class="pcard__stats">
        <div class="pcard__stat"><span class="pcard__stat-label">정치력</span><span class="pcard__stat-value">⚡ ${fmtNum(p.totalPower)}P</span></div>
        <div class="pcard__stat"><span class="pcard__stat-label">당원</span><span class="pcard__stat-value">👥 ${fmtNum(p.memberCount)}</span></div>
      </div>
      <div class="pcard__footer">
        <div class="pcard__footer-btns">
          <button class="pcard__text-btn party-members-btn" data-party="${p.id}">👥 당원</button>
          <button class="pcard__text-btn party-manifesto-btn" data-party="${p.id}">📜 당론</button>
        </div>
        ${joinBtn}
      </div>
    </div>
    ${isMine ? '<div id="party-manifesto-slot"></div>' : ''}
  </div>
  <div class="party-members" id="members-${p.id}" hidden></div>
  <div class="party-manifesto-display" id="manifesto-display-${p.id}" hidden></div>`;
}

function showJoinCeremony(partyId, name, color, emoji) {
  const meta = PARTY_META[partyId];
  const quote = meta ? pick(meta.quotes) : '';
  const perk = meta ? meta.perk : '';
  const overlay = document.createElement('div');
  overlay.className = 'join-ceremony';
  overlay.innerHTML = `<div class="join-ceremony__card" style="--party-color:${color}">
    <div class="join-ceremony__emoji">${emoji}</div>
    <div class="join-ceremony__congrats">입당 완료</div>
    <div class="join-ceremony__name">${escHtml(name)}</div>
    ${perk ? `<div class="join-ceremony__perk">${escHtml(perk)} 획득</div>` : ''}
    ${quote ? `<div class="join-ceremony__quote">“${escHtml(quote)}”</div>` : ''}
    <div class="join-ceremony__hint">이제 매일 공개되는 역사 풍자 이슈에 참여해 정치력을 쌓을 수 있습니다.</div>
    <button class="btn btn--primary join-ceremony__go" id="jc-go">오늘의 정치게임으로 →</button>
    <button class="join-ceremony__close" id="jc-close">닫기</button>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('join-ceremony--visible'));
  overlay.querySelector('#jc-go').addEventListener('click', () => { overlay.remove(); navigate('/battle'); });
  overlay.querySelector('#jc-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function doJoin(partyId, name) {
  await httpsCallable(functions, 'joinParty')({ partyId });
  const found = _partiesCache.find(p => p.id === partyId);
  showJoinCeremony(partyId, name, found?.color || '#2F7D6E', found?.emoji || '🏛️');
  renderParties();
}

async function loadMembers(partyId, host) {
  host.innerHTML = '<div class="party-members__loading">불러오는 중…</div>';
  try {
    const { data } = await httpsCallable(functions, 'getPartyMembers')({ partyId });
    const members = data.members || [];
    if (!members.length) {
      host.innerHTML = '<div class="party-members__empty">아직 당원이 없어요.</div>';
      return;
    }
    host.innerHTML = members.map(m => {
      const polRank = getPoliticalRank(m.power || 0);
      return `<div class="party-member${m.rank === 1 ? ' party-member--leader' : ''}">
        <span class="party-member__rank">${m.rank === 1 ? '👑' : m.rank}</span>
        <span class="party-member__pol-rank" title="${escHtml(polRank.label)}">${polRank.emoji}</span>
        <span class="party-member__name">${m.icon?.value ? escHtml(m.icon.value) + ' ' : ''}${escHtml(m.nickname)}${m.role ? ` <em>${escHtml(m.role)}</em>` : ''}${m.rank === 1 ? ' <span class="party-member__badge">당대표</span>' : ''}</span>
        <span class="party-member__power">${fmtNum(m.power)}</span>
      </div>`;
    }).join('');
  } catch {
    host.innerHTML = '<div class="party-members__empty">당원 목록을 불러오지 못했어요.</div>';
  }
}

function openQuiz() {
  if (!auth.currentUser) { navigate('/login'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'quiz-overlay';
  const answers = new Array(QUIZ.length).fill(-1);

  const renderBody = () => {
    overlay.innerHTML = `<div class="quiz-modal">
      <button class="quiz-close" id="quiz-close" aria-label="닫기">✕</button>
      <div class="quiz-title">🧭 내 정당 찾기</div>
      <div class="quiz-sub">새공화국 정치성향 테스트 · 5문항</div>
      <div class="quiz-body">
        ${QUIZ.map((item, qi) => `<div class="quiz-q">
          <div class="quiz-q__title">Q${qi + 1}. ${escHtml(item.q)}</div>
          <div class="quiz-opts">${item.opts.map((o, oi) => `<button class="quiz-opt${answers[qi] === oi ? ' selected' : ''}" data-q="${qi}" data-o="${oi}">${escHtml(o.t)}</button>`).join('')}</div>
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
      if (answers.includes(-1)) { toast.warn('모든 문항에 답해주세요.'); return; }
      showResult();
    });
  };

  const showResult = () => {
    const score = {};
    QUIZ.forEach((item, qi) => {
      const w = item.opts[answers[qi]].w;
      for (const k in w) score[k] = (score[k] || 0) + w[k];
    });
    const ranked = _partiesCache.length ? [..._partiesCache].sort((a, b) => (score[b.id] || 0) - (score[a.id] || 0)) : [];
    const best = ranked[0];
    if (!best) { overlay.remove(); return; }
    const meta = PARTY_META[best.id];
    overlay.innerHTML = `<div class="quiz-modal quiz-result" style="--party-color:${best.color}">
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
    overlay.querySelector('#quiz-join').addEventListener('click', async e => {
      const b = e.currentTarget;
      b.disabled = true; b.textContent = '입당 중…';
      try { await doJoin(best.id, best.name); overlay.remove(); }
      catch (err) { toast.error(err?.message || '입당에 실패했어요.'); b.disabled = false; b.textContent = `${best.emoji} ${best.name} 입당하기`; }
    });
  };

  renderBody();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function loadPartyManifesto(host, partyId) {
  if (!host) return;
  const meta = PARTY_META[partyId];
  host.innerHTML = '<div class="party-manifesto-display__loading">당론 불러오는 중…</div>';
  try {
    const { data } = await httpsCallable(functions, 'getPartyManifesto')({ partyId });
    host.innerHTML = data.manifesto
      ? `<div class="party-manifesto-display__box"><div class="party-manifesto-display__label">📜 이번 주 당론 성명</div><p class="party-manifesto-display__text">“${escHtml(data.manifesto)}”</p></div>`
      : `<div class="party-manifesto-display__box party-manifesto-display__box--empty"><div class="party-manifesto-display__label">📜 기본 당론</div><p class="party-manifesto-display__text">${meta ? escHtml(meta.policy) : '당론 성명이 아직 없습니다.'}</p></div>`;
  } catch {
    host.innerHTML = `<div class="party-manifesto-display__box party-manifesto-display__box--empty"><p class="party-manifesto-display__text">${meta ? escHtml(meta.policy) : '불러오지 못했어요.'}</p></div>`;
  }
}

export async function renderParties() {
  setMeta('새공화국 정당');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="parties-page page-enter"><div class="skeleton" style="height:120px;border-radius:16px;margin-bottom:12px"></div><div class="skeleton" style="height:320px;border-radius:16px"></div></div>`;

  let overview;
  try {
    const { data } = await httpsCallable(functions, 'getPoliticsOverview')();
    overview = data || {};
  } catch (err) {
    console.error('[parties] load error', err);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">정당 현황을 불러오지 못했어요</div><button class="btn btn--primary" style="margin-top:16px" id="party-retry">다시 시도</button></div>`;
    el.querySelector('#party-retry')?.addEventListener('click', renderParties);
    return;
  }

  const { parties = [], me = null } = overview;
  _partiesCache = parties;
  const ruling = parties[0] || null;
  const totalCitizens = parties.reduce((s, p) => s + (p.memberCount || 0), 0);
  const totalPower = parties.reduce((s, p) => s + (p.totalPower || 0), 0);

  const stateHTML = `<div class="republic-state">
    <div class="republic-state__item"><span class="republic-state__label">제1당</span>${ruling ? `<span class="republic-state__value" style="--party-color:${ruling.color}">${ruling.emoji} ${escHtml(ruling.name)}</span>` : '<span class="republic-state__value">집계 중</span>'}</div>
    <div class="republic-state__divider"></div>
    <div class="republic-state__item"><span class="republic-state__label">소소시민</span><span class="republic-state__value">👥 ${fmtNum(totalCitizens)}명</span></div>
    <div class="republic-state__divider"></div>
    <div class="republic-state__item"><span class="republic-state__label">총 정치력</span><span class="republic-state__value">⚡ ${fmtNum(totalPower)}P</span></div>
  </div>`;

  el.innerHTML = `<div class="parties-page page-enter">
    <div class="parties-hero">
      <div class="parties-hero__badge">🏛️ 새공화국 정당정치</div>
      <h1 class="parties-hero__title">보수파·진보파·중도파, 새 역사의 시작</h1>
      <p class="parties-hero__sub">군사독재 이후 열린 새 공화국에서 매일 공개되는 역사 풍자 이슈를 두고 정당들이 여론전을 벌입니다.</p>
    </div>
    ${stateHTML}
    ${renderParliamentChart(parties)}
    ${renderMyBanner(me)}
    <div class="standings-section">
      <div class="standings-section__header">
        <div><div class="standings-section__eyebrow">NEW REPUBLIC PARTY</div><div class="standings-section__title">📊 정당 세력 순위</div></div>
        <button class="parties-quiz-btn" id="party-quiz-top">🧭 내 정당 찾기</button>
      </div>
    </div>
    <div class="parties-detail-title">정당 상세 정보 · 6인 캐릭터</div>
    <div class="parties-list">${parties.map((p, i) => `<div class="pcard-wrap">${renderPartyCard(p, me, i === 0)}</div>`).join('')}</div>
  </div>`;

  el.querySelector('#party-login')?.addEventListener('click', () => navigate('/login'));
  el.querySelector('#party-quiz-open')?.addEventListener('click', openQuiz);
  el.querySelector('#party-quiz-top')?.addEventListener('click', openQuiz);

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
        btn.textContent = '👥 당원';
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
      if (!host.dataset.loaded) {
        host.dataset.loaded = '1';
        await loadPartyManifesto(host, pid);
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
      try { await doJoin(partyId, name); }
      catch (e) { toast.error(e?.message || '입당에 실패했어요.'); btn.disabled = false; btn.textContent = '입당'; }
    });
  });
}
