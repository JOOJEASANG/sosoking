/* republic.js — 소소공화국 허브 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { toast } from '../components/toast.js';

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function powerBar(pct, color) {
  return `<div class="rep-pbar"><div class="rep-pbar__fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function renderPowerLadder(status, election, president) {
  const loggedIn = !!status?.loggedIn;
  const hasParty = !!status?.partyId;
  const isLeader = !!status?.isLeader;
  const isPresident = !!(president && status?.uid && president.candidateUid === status.uid);
  const electionEndKey = status?.electionEndKey || election?.endKey || election?.electionEndKey;

  let electionLabel = '진행 중';
  if (electionEndKey) {
    const endMs = new Date(`${electionEndKey}T23:59:59+09:00`).getTime();
    const daysLeft = Math.ceil((endMs - Date.now()) / 86400000);
    electionLabel = daysLeft <= 0 ? '집계 중' : daysLeft === 1 ? '오늘 마감' : `D-${daysLeft}`;
  }

  const steps = [
    {
      num: 1,
      title: '입당',
      desc: hasParty ? `${status.partyEmoji || ''} ${status.partyName || '내 정당'}` : '3당 중 선택',
      active: !hasParty,
      done: hasParty,
      path: '/republic',
    },
    {
      num: 2,
      title: '당대표',
      desc: isLeader ? '대선 후보 등록' : hasParty && status.pointsToLeader ? `${fmtNum(status.pointsToLeader)}P 남음` : '정치력 1위 도전',
      active: hasParty && !isLeader,
      done: isLeader,
      path: hasParty ? '/ranking' : '/republic',
    },
    {
      num: 3,
      title: '대통령',
      desc: isPresident ? '현직 대통령' : `대선 ${electionLabel}`,
      active: isLeader && !isPresident,
      done: isPresident,
      path: '/election',
    },
    {
      num: 4,
      title: '국회·헌재',
      desc: president?.impeachTriggered ? '탄핵심판 대기' : '법안·탄핵 견제',
      active: !!president?.impeachTriggered,
      done: false,
      path: president?.impeachTriggered ? '/constitutional-court' : '/congress',
    },
  ];

  const mainPath = loggedIn ? (hasParty ? '/battle' : '/republic') : '/signup';
  const mainText = loggedIn ? (hasParty ? '오늘 정치 활동 시작 →' : '입당하고 시작 →') : '정치 인생 시작 →';

  return `
    <div class="rep-section" style="background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(51,65,85,.92));color:#fff;border:0;box-shadow:0 16px 36px rgba(15,23,42,.18)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <div style="font-size:12px;font-weight:900;letter-spacing:.08em;color:rgba(255,255,255,.62)">POWER LADDER</div>
          <div style="font-size:23px;font-weight:1000;margin-top:4px">👑 권력 사다리</div>
          <div style="font-size:13px;color:rgba(255,255,255,.72);line-height:1.55;margin-top:5px">입당 → 당대표 → 대통령 → 국회·헌재까지 이어지는 소소공화국 핵심 진행도입니다.</div>
        </div>
        <button class="btn btn--primary btn--sm" data-path="${mainPath}" style="box-shadow:0 10px 22px rgba(255,107,74,.25)">${mainText}</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px" class="rep-power-ladder-grid">
        ${steps.map(s => `
          <button data-path="${s.path}" style="text-align:left;border:1px solid ${s.active ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.12)'};background:${s.done ? 'rgba(34,197,94,.16)' : s.active ? 'rgba(255,255,255,.17)' : 'rgba(255,255,255,.09)'};border-radius:16px;padding:12px;color:#fff;font-family:inherit;cursor:pointer">
            <span style="display:inline-flex;width:24px;height:24px;border-radius:999px;align-items:center;justify-content:center;background:${s.done ? 'rgba(34,197,94,.95)' : s.active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.16)'};color:${s.active && !s.done ? '#111827' : '#fff'};font-size:12px;font-weight:1000">${s.num}</span>
            <b style="display:block;font-size:14px;margin-top:8px;color:#fff">${s.title}</b>
            <small style="display:block;font-size:11px;margin-top:3px;color:rgba(255,255,255,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(s.desc)}</small>
          </button>`).join('')}
      </div>
    </div>`;
}

function renderPresidentSection(president) {
  if (!president) {
    return `
      <div class="rep-president rep-president--vacant">
        <div class="rep-president__label">현직 대통령</div>
        <div class="rep-president__vacant-title">공석 👤</div>
        <div class="rep-president__vacant-desc">대통령 선거에서 유저 투표로 결정됩니다</div>
        <button class="btn btn--primary btn--sm" data-path="/election">대선 투표하기 →</button>
      </div>`;
  }

  const approveCount = Number(president.decreeApprove || 0);
  const disapproveCount = Number(president.decreeDisapprove || 0);
  const total = approveCount + disapproveCount;
  const approvePct = total >= 3 ? Math.round((approveCount / total) * 100) : null;

  const approvalChip = approvePct !== null
    ? `<span class="rep-president__approval${approvePct < 40 ? ' rep-president__approval--danger' : approvePct >= 70 ? ' rep-president__approval--good' : ''}">${approvePct < 40 ? '⚠️' : approvePct >= 70 ? '⭐' : '📊'} 지지율 ${approvePct}%</span>`
    : '';

  const impeachCount = Number(president.impeachCount || 0);
  const impeachThreshold = Number(president.impeachThreshold || 5);
  const impeachHTML = impeachCount > 0
    ? `<div class="rep-president__impeach${president.impeachTriggered ? ' rep-president__impeach--triggered' : ''}">
        ${president.impeachTriggered ? '⚡ 헌재 심판 대기' : `✍️ 탄핵 청원 ${impeachCount}/${impeachThreshold}`}
      </div>`
    : '';

  return `
    <div class="rep-president" style="--party-color:${president.color || '#ff6b4a'}">
      <div class="rep-president__top">
        <div>
          <div class="rep-president__label">현직 대통령</div>
          <div class="rep-president__name">${president.emoji || ''} ${escHtml(president.candidateName)}</div>
          <div class="rep-president__party">${escHtml(president.partyName)}${president.isAI ? ' · AI' : ''}</div>
        </div>
        <div class="rep-president__right">
          ${approvalChip}
          ${impeachHTML}
        </div>
      </div>
      ${president.decree ? `<div class="rep-president__decree">"${escHtml(president.decree.slice(0, 60))}${president.decree.length > 60 ? '…' : ''}"</div>` : ''}
      <button class="rep-president__btn" data-path="/election">선거 현황 보기 →</button>
    </div>`;
}

function renderElectionSection(election, president) {
  if (!election) {
    return `
      <div class="rep-section">
        <div class="rep-section__title">🗳️ 대통령 선거</div>
        <div class="rep-empty">선거 정보 불러오는 중...</div>
      </div>`;
  }

  const cands = election.candidates || [];
  const totalVotes = election.totalVotes || 0;
  const myVote = election.myVote || null;
  const endKey = election.electionEndKey || election.endKey || null;

  let countdownHTML = '';
  if (endKey) {
    const endMs = new Date(`${endKey}T23:59:59+09:00`).getTime();
    const daysLeft = Math.ceil((endMs - Date.now()) / 86400000);
    const label = daysLeft <= 0 ? '집계 중' : daysLeft === 1 ? '오늘 마감! ⚡' : `D-${daysLeft}`;
    const pct = Math.min(100, Math.max(0, Math.round(((Date.now() - (endMs - 6 * 86400000)) / (6 * 86400000)) * 100)));
    countdownHTML = `
      <div class="rep-elec-countdown">
        <span class="rep-elec-countdown__label">이번 주 선거</span>
        <div class="rep-elec-countdown__track"><div class="rep-elec-countdown__fill" style="width:${pct}%"></div></div>
        <span class="rep-elec-countdown__remain${daysLeft <= 1 ? ' rep-elec-countdown__remain--urgent' : ''}">${label}</span>
      </div>`;
  }

  const topCands = cands.slice(0, 3).map(c => {
    const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
    const isMine = myVote === c.partyId;
    return `
      <div class="rep-cand${isMine ? ' rep-cand--mine' : ''}" style="--party-color:${c.color}">
        <span class="rep-cand__emoji">${c.emoji}</span>
        <div class="rep-cand__info">
          <span class="rep-cand__name">${escHtml(c.candidateName)}${c.isAI ? ' 🤖' : ''}</span>
          <span class="rep-cand__party">${escHtml(c.partyName)}</span>
        </div>
        <div class="rep-cand__right">
          ${myVote != null ? `<span class="rep-cand__pct">${pct}%</span>` : ''}
          ${isMine ? `<span class="rep-cand__voted">내 선택 ✅</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const voteCTA = myVote == null
    ? `<button class="btn btn--primary btn--full" data-path="/election">🗳️ 지금 대선 투표하기 +5P</button>`
    : `<button class="btn btn--ghost btn--full" data-path="/election">선거 상세 보기 →</button>`;

  return `
    <div class="rep-section">
      <div class="rep-section__title">🗳️ 대통령 선거</div>
      ${countdownHTML}
      <div class="rep-cand-list">${topCands || '<div class="rep-empty">후보 없음</div>'}</div>
      ${totalVotes > 0 ? `<div class="rep-elec-votes">총 ${fmtNum(totalVotes)}표 참여</div>` : ''}
      ${voteCTA}
    </div>`;
}

function renderPartiesSection(parties, myPartyId) {
  if (!parties.length) {
    return `<div class="rep-section"><div class="rep-section__title">🏛️ 정당</div><div class="rep-empty">정당 정보 없음</div></div>`;
  }

  const totalPower = parties.reduce((s, p) => s + Number(p.totalPower || 0), 0);

  const cards = parties.map((p, idx) => {
    const isMine = p.id === myPartyId;
    const pct = totalPower > 0 ? Math.round((Number(p.totalPower || 0) / totalPower) * 100) : 0;
    const MEDALS = ['🥇', '🥈', '🥉'];
    return `
      <div class="rep-party${isMine ? ' rep-party--mine' : ''}" style="--party-color:${p.color || '#888'}">
        <div class="rep-party__top">
          <span class="rep-party__emoji">${MEDALS[idx] || ''} ${p.emoji}</span>
          <div class="rep-party__info">
            <span class="rep-party__name">${escHtml(p.name)}</span>
            <span class="rep-party__stats">당원 ${fmtNum(p.memberCount)}명 · ⚡ ${fmtNum(p.totalPower)}P</span>
          </div>
          ${isMine
            ? `<span class="rep-party__mine-tag">내 정당</span>`
            : `<button class="rep-party__join btn btn--sm btn--ghost" data-party-id="${p.id}" data-party-name="${escHtml(p.name)}">입당</button>`}
        </div>
        ${powerBar(pct, p.color || '#888')}
        ${p.leader ? `<div class="rep-party__leader">👑 당대표: ${escHtml(p.leader.nickname)}</div>` : `<div class="rep-party__leader rep-party__leader--empty">당대표 없음 — 활동하면 당대표!</div>`}
      </div>`;
  }).join('');

  return `
    <div class="rep-section">
      <div class="rep-section__header">
        <span class="rep-section__title">🏛️ 3개 정당</span>
        <button class="rep-section__more" data-path="/parties">전체 보기 →</button>
      </div>
      <div class="rep-parties">${cards}</div>
      ${!myPartyId ? `<p class="rep-join-hint">💡 정당에 입당하면 대선 투표 · 유세 활동 · 랭킹 참여가 가능해요!</p>` : ''}
    </div>`;
}

function renderGovLinks(congressBills) {
  const billCount = Array.isArray(congressBills) ? congressBills.filter(b => b.status !== 'closed').length : 0;

  const links = [
    { emoji: '🏛️', name: '소소국회', desc: billCount > 0 ? `법안 ${billCount}건 표결 진행 중` : '법안 표결', path: '/congress', highlight: billCount > 0 },
    { emoji: '⚖️', name: '헌법재판소', desc: 'AI 재판관 3인', path: '/constitutional-court' },
    { emoji: '📰', name: '소소신문', desc: '오늘의 AI 뉴스', path: '/news' },
    { emoji: '🏆', name: '정치력 랭킹', desc: '출세 사다리 확인', path: '/ranking' },
    { emoji: '📜', name: '역대 당선자', desc: '공화국 역사', path: '/king-history' },
  ];

  return `
    <div class="rep-section">
      <div class="rep-section__title">🔗 국가 기관</div>
      <div class="rep-gov-links">
        ${links.map(l => `
          <button class="rep-gov-link${l.highlight ? ' rep-gov-link--highlight' : ''}" data-path="${l.path}">
            <span class="rep-gov-link__emoji">${l.emoji}</span>
            <div class="rep-gov-link__info">
              <span class="rep-gov-link__name">${l.name}</span>
              <span class="rep-gov-link__desc">${l.desc}</span>
            </div>
            <span class="rep-gov-link__arrow">→</span>
          </button>`).join('')}
      </div>
    </div>`;
}

export async function renderRepublic() {
  setMeta('소소공화국', '정당 · 대선 · 국회 · 헌법재판소 — 공화국 전체를 한눈에');
  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="rep-page page-enter">
      <div class="rep-hero">
        <div class="rep-hero__eyebrow">SOSO REPUBLIC</div>
        <h1 class="rep-hero__title">🏛️ 소소공화국</h1>
        <p class="rep-hero__sub">정당 · 대선 · 국회 · 헌법재판소</p>
      </div>
      <div class="page-section">
        <div class="skeleton" style="height:100px;border-radius:16px;margin-bottom:12px"></div>
        <div class="skeleton" style="height:180px;border-radius:16px;margin-bottom:12px"></div>
        <div class="skeleton" style="height:240px;border-radius:16px;margin-bottom:12px"></div>
        <div class="skeleton" style="height:200px;border-radius:16px"></div>
      </div>
    </div>`;

  const user = auth.currentUser;

  const [overviewRes, presidentRes, electionRes, billsRes, myStatusRes] = await Promise.allSettled([
    httpsCallable(functions, 'getPoliticsOverview')({}),
    httpsCallable(functions, 'getPresident')({}),
    httpsCallable(functions, 'getElection')(),
    httpsCallable(functions, 'getCongressBills')({}),
    user ? httpsCallable(functions, 'getMyStatus')() : Promise.resolve({ data: { loggedIn: false } }),
  ]);

  const overview = overviewRes.value?.data || {};
  const electionPayload = electionRes.value?.data || null;
  const election = electionPayload?.election || electionPayload || null;
  const president = presidentRes.value?.data?.president || electionPayload?.president || null;
  const bills = billsRes.value?.data?.bills || [];
  const parties = Array.isArray(overview.parties) ? overview.parties.slice(0, 3) : [];
  const myStatus = myStatusRes.value?.data || { loggedIn: false };
  const myPartyId = myStatus?.partyId || null;

  el.innerHTML = `
    <div class="rep-page page-enter">
      <div class="rep-hero">
        <div class="rep-hero__eyebrow">SOSO REPUBLIC</div>
        <h1 class="rep-hero__title">🏛️ 소소공화국</h1>
        <p class="rep-hero__sub">정당 · 대선 · 국회 · 헌법재판소</p>
      </div>
      <div class="page-section rep-content">
        ${renderPowerLadder(myStatus, election, president)}
        ${renderPresidentSection(president)}
        ${renderElectionSection(election, president)}
        ${renderPartiesSection(parties, myPartyId)}
        ${renderGovLinks(bills)}
      </div>
    </div>`;

  el.querySelectorAll('[data-path]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.path));
  });

  el.querySelectorAll('[data-party-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!user) { navigate('/login'); return; }
      const partyId = btn.dataset.partyId;
      const partyName = btn.dataset.partyName;
      if (!confirm(`${partyName}에 입당하시겠습니까?`)) return;
      btn.disabled = true;
      btn.textContent = '처리 중...';
      try {
        await httpsCallable(functions, 'joinParty')({ partyId });
        toast.success(`🎉 ${partyName} 입당 완료! 이제 활동으로 정치력을 쌓아 당대표에 도전하세요.`);
        navigate('/');
      } catch (e) {
        toast.error(e?.message || '입당에 실패했습니다.');
        btn.disabled = false;
        btn.textContent = '입당';
      }
    });
  });
}
