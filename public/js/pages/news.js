/* news.js — 소소신문 전용 페이지 */
import { db, auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { showPointPopup } from '../utils/point-popup.js';

const KST_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function kstDateStr(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-');
  const dt = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
  const day = KST_NAMES[dt.getDay()];
  return `${Number(m)}월 ${Number(d)}일 (${day})`;
}

function isToday(dateKey) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return dateKey === kst.toISOString().slice(0, 10);
}

function kstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function renderFeaturedArticle(news) {
  const dateLabel = news.date ? kstDateStr(news.date) : '';
  const todayBadge = news.date && isToday(news.date)
    ? `<span class="news-badge news-badge--today">오늘</span>`
    : `<span class="news-badge">${escHtml(dateLabel)}</span>`;
  return `
    <div class="news-featured">
      <div class="news-featured__masthead">
        <span class="news-featured__logo">📰 소소신문</span>
        ${todayBadge}
      </div>
      <h1 class="news-featured__headline">${escHtml(news.headline)}</h1>
      ${news.body ? `<p class="news-featured__body">${escHtml(news.body)}</p>` : ''}
      <div class="news-featured__footer">소소공화국 공식 일간지 · 정치 정보 실시간 제공</div>
    </div>`;
}

function renderArchiveItem(news) {
  const dateLabel = kstDateStr(news.date);
  return `
    <div class="news-archive-item">
      <span class="news-archive-item__date">${escHtml(dateLabel)}</span>
      <p class="news-archive-item__headline">${escHtml(news.headline || '기사 없음')}</p>
      ${news.body ? `<p class="news-archive-item__body">${escHtml(news.body)}</p>` : ''}
    </div>`;
}

async function fetchTodayNews() {
  try {
    const fn = httpsCallable(functions, 'getDailyNews');
    const { data } = await fn();
    return (data && data.headline) ? data : null;
  } catch { return null; }
}

async function fetchNewsArchive(excludeDate) {
  try {
    const snap = await getDocs(
      query(collection(db, 'daily_news'), orderBy('date', 'desc'), limit(14))
    );
    return snap.docs
      .map(d => ({ date: d.id, ...d.data() }))
      .filter(n => n.date !== excludeDate && n.headline);
  } catch { return []; }
}

async function loadBattleBulletin(slot) {
  if (!slot) return;
  try {
    const { data } = await httpsCallable(functions, 'getBattleStatus')();
    if (!data) return;

    const { exists, topic, votes = {}, totalVotes = 0, status, king, chars = [], currentKing } = data;
    if (!exists) return;

    const isEnded = status === 'ended';
    const winnerChar = king ? chars.find(c => c.id === king) : null;
    const sorted = [...chars].sort((a, b) => (Number(votes[b.id] || 0)) - (Number(votes[a.id] || 0)));
    const top = sorted[0];
    const topPct = totalVotes > 0 ? Math.round((Number(votes[top?.id] || 0) / totalVotes) * 100) : 0;

    const statusLabel = isEnded
      ? `<span class="news-bulletin__status news-bulletin__status--ended">종료</span>`
      : `<span class="news-bulletin__status news-bulletin__status--live">🔴 진행중</span>`;

    const barsHTML = sorted.slice(0, 4).map(c => {
      const count = Number(votes[c.id] || 0);
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const isWinner = isEnded && c.id === king;
      return `
        <div class="news-bulletin__bar-row${isWinner ? ' news-bulletin__bar-row--winner' : ''}">
          <span class="news-bulletin__bar-emoji">${c.emoji}</span>
          <span class="news-bulletin__bar-name">${escHtml(c.name)}</span>
          <div class="news-bulletin__bar-track">
            <div class="news-bulletin__bar-fill" style="width:${Math.max(2, pct)}%;background:${c.color}"></div>
          </div>
          <span class="news-bulletin__bar-pct">${pct}%</span>
          ${isWinner ? '<span class="news-bulletin__bar-crown">👑</span>' : ''}
        </div>`;
    }).join('');

    slot.innerHTML = `
      <section class="news-bulletin" data-path="/battle">
        <div class="news-bulletin__header">
          <span class="news-bulletin__label">⚔️ 오늘의 정치배틀</span>
          ${statusLabel}
        </div>
        <div class="news-bulletin__topic">${escHtml(topic || '이슈 생성 중…')}</div>
        ${totalVotes > 0 ? `
          <div class="news-bulletin__bars">${barsHTML}</div>
          <div class="news-bulletin__total">${fmtNum(totalVotes)}명 참여${isEnded && winnerChar ? ` · 집권 대표 ${winnerChar.emoji} ${escHtml(winnerChar.name)}` : ''}</div>
        ` : '<div class="news-bulletin__total">아직 투표가 없습니다 — 첫 번째로 참여하세요!</div>'}
        ${currentKing ? `<div class="news-bulletin__king">현재 집권 대표: ${currentKing.emoji} <b>${escHtml(currentKing.name)}</b>${currentKing.streak > 1 ? ` · 🔥 ${currentKing.streak}일 연속` : ''}</div>` : ''}
      </section>`;

    slot.querySelector('[data-path]')?.addEventListener('click', () => navigate('/battle'));
  } catch { /* non-critical */ }
}

async function loadPartyStandings(slot) {
  if (!slot) return;
  try {
    const snap = await getDocs(collection(db, 'parties'));
    const PARTY_COLORS_NEWS = {
      national: { name: '국민안정당', emoji: '🎙️', color: '#8B7355' },
      youth:    { name: '청년혁명당', emoji: '📱', color: '#E84393' },
      center:   { name: '중도민주당', emoji: '📊', color: '#00CEC9' },
    };
    const parties = snap.docs
      .map(d => {
        const meta = PARTY_COLORS_NEWS[d.id];
        if (!meta) return null;
        return { id: d.id, ...meta, totalPower: Number(d.data().totalPower || 0), memberCount: Number(d.data().memberCount || 0) };
      })
      .filter(Boolean)
      .sort((a, b) => b.totalPower - a.totalPower);

    const total = parties.reduce((s, p) => s + p.totalPower, 0);
    if (!total) return;

    const rows = parties.map((p, i) => {
      const pct = Math.round((p.totalPower / total) * 100);
      const medals = ['🥇', '🥈', '🥉'];
      return `
        <div class="news-party-row" style="--party-c:${p.color}">
          <span class="news-party-row__rank">${medals[i] || i + 1}</span>
          <span class="news-party-row__emoji">${p.emoji}</span>
          <span class="news-party-row__name">${escHtml(p.name)}</span>
          <div class="news-party-row__bar-wrap">
            <div class="news-party-row__bar" style="width:${Math.max(3, pct)}%"></div>
          </div>
          <span class="news-party-row__pct">${pct}%</span>
        </div>`;
    }).join('');

    slot.innerHTML = `
      <section class="news-party-standings" data-path="/parties">
        <div class="news-section-title">🏛️ 정당 세력 현황</div>
        <div class="news-party-rows">${rows}</div>
        <div class="news-party-standings__footer">정치력 기준 · 클릭해서 정당 상세 보기</div>
      </section>`;

    slot.querySelector('[data-path]')?.addEventListener('click', () => navigate('/parties'));
  } catch { /* non-critical */ }
}

async function loadKingRecap(slot) {
  if (!slot) return;
  try {
    const { data } = await httpsCallable(functions, 'getKingHistory')();
    const { history = [] } = data;
    if (history.length === 0) return;

    const recent = history.slice(0, 5);
    const rows = recent.map((h, i) => `
      <div class="news-king-row${i === 0 ? ' news-king-row--latest' : ''}">
        <span class="news-king-row__date">${h.date || ''}</span>
        <span class="news-king-row__emoji">${h.emoji || ''}</span>
        <div class="news-king-row__body">
          <span class="news-king-row__name">${escHtml(h.charName || '')}</span>
          ${h.topic ? `<span class="news-king-row__topic">${escHtml(h.topic)}</span>` : ''}
        </div>
        <div class="news-king-row__right">
          ${h.totalVotes > 0 ? `<span class="news-king-row__pct">${Math.round((h.votes / h.totalVotes) * 100)}%</span>` : `<span class="news-king-row__pct">${h.votes}표</span>`}
          ${i === 0 ? '<span class="news-king-row__badge">최신</span>' : ''}
        </div>
      </div>`).join('');

    slot.innerHTML = `
      <section class="news-king-recap" data-path="/king-history">
        <div class="news-section-title">👑 최근 집권 기록</div>
        <div class="news-king-rows">${rows}</div>
        <div class="news-king-recap__more">전체 기록 보기 →</div>
      </section>`;

    slot.querySelector('[data-path]')?.addEventListener('click', () => navigate('/king-history'));
  } catch { /* non-critical */ }
}

async function loadPresidentQAHighlight(slot) {
  if (!slot) return;
  try {
    const { data } = await httpsCallable(functions, 'getPresidentQA')();
    const answered = (data.questions || []).filter(q => q.answer);
    if (!answered.length) return;

    const items = answered.slice(0, 3).map(q => `
      <div class="news-qa-item">
        <div class="news-qa-item__q">
          <span style="color:${q.partyColor}">${q.partyEmoji}</span>
          <span class="news-qa-item__nick">${escHtml(q.nickname)}</span>
          <span class="news-qa-item__text">"${escHtml(q.question)}"</span>
        </div>
        <div class="news-qa-item__a">
          <span>👑</span>
          <span class="news-qa-item__a-text">${escHtml(q.answer)}</span>
        </div>
      </div>`).join('');

    slot.innerHTML = `
      <section class="news-qa-highlight" data-path="/election">
        <div class="news-section-title">🎙️ 대정부 질의응답</div>
        <div class="news-qa-items">${items}</div>
        <div class="news-qa-highlight__more">전체 질문 보기 →</div>
      </section>`;

    slot.querySelector('[data-path]')?.addEventListener('click', () => navigate('/election'));
  } catch { /* non-critical */ }
}

const CRISIS_PARTY_INFO = {
  national: { name: '국민안정당', emoji: '🎙️', color: '#8B7355' },
  youth:    { name: '청년혁명당', emoji: '📱', color: '#E84393' },
  center:   { name: '중도민주당', emoji: '📊', color: '#00CEC9' },
};

function renderCrisisPartyBreakdown(partyVotes, optionA, optionB) {
  if (!partyVotes) return '';
  const rows = Object.entries(partyVotes)
    .map(([pid, pv]) => {
      const info = CRISIS_PARTY_INFO[pid];
      if (!info) return null;
      const a = Number(pv.A || 0), b = Number(pv.B || 0), tot = a + b;
      if (!tot) return null;
      const pctA = Math.round((a / tot) * 100);
      const pctB = 100 - pctA;
      const leanA = pctA > pctB;
      return { info, tot, pctA, pctB, leanA };
    })
    .filter(Boolean)
    .sort((x, y) => y.tot - x.tot);
  if (rows.length < 2) return '';
  return `
    <div class="news-crisis__party-breakdown">
      <div class="news-crisis__party-breakdown__title">📊 정당별 투표 성향</div>
      ${rows.map(r => `
        <div class="news-crisis__party-row" style="--p-color:${r.info.color}">
          <span class="news-crisis__party-row__em">${r.info.emoji}</span>
          <span class="news-crisis__party-row__name">${escHtml(r.info.name)}</span>
          <div class="news-crisis__party-row__bars">
            <div class="news-crisis__party-row__bar--a" style="width:${r.pctA}%" title="A. ${escHtml(optionA)}"></div>
            <div class="news-crisis__party-row__bar--b" style="width:${r.pctB}%" title="B. ${escHtml(optionB)}"></div>
          </div>
          <span class="news-crisis__party-row__lean${r.leanA ? ' news-crisis__party-row__lean--a' : ' news-crisis__party-row__lean--b'}">${r.leanA ? 'A ' + r.pctA + '%' : 'B ' + r.pctB + '%'}</span>
        </div>`).join('')}
      <div class="news-crisis__party-breakdown__legend">
        <span class="news-crisis__legend--a">■ A. ${escHtml(optionA)}</span>
        <span class="news-crisis__legend--b">■ B. ${escHtml(optionB)}</span>
      </div>
    </div>`;
}

function crisisWeekEnd(weekKey) {
  if (!weekKey) return null;
  const ms = new Date(`${weekKey}T00:00:00+09:00`).getTime() + 7 * 86400000 - 1000;
  return ms;
}

async function loadNewsCrisis(slot) {
  if (!slot) return;
  try {
    const { data } = await httpsCallable(functions, 'getWeeklyCrisis')();
    const { crisis, myVote, prevCrisis } = data;
    if (!crisis || !crisis.title) return;

    const totalVotes = Number(crisis.votesA || 0) + Number(crisis.votesB || 0);
    const pctA = totalVotes > 0 ? Math.round((Number(crisis.votesA || 0) / totalVotes) * 100) : 50;
    const pctB = 100 - pctA;
    const isWinnerA = pctA >= pctB;

    // Days remaining in this week's vote
    const endMs = crisisWeekEnd(crisis.weekKey);
    const daysLeft = endMs ? Math.max(0, Math.ceil((endMs - Date.now()) / 86400000)) : null;
    const daysLabel = daysLeft === null ? '' : daysLeft === 0 ? '오늘 마감' : daysLeft === 1 ? '내일 마감' : `${daysLeft}일 남음`;

    const barHTML = totalVotes > 0 ? `
      <div class="news-crisis__bar-wrap">
        <div class="news-crisis__bar-row">
          <span class="news-crisis__bar-label news-crisis__bar-label--a${myVote === 'A' ? ' news-crisis__bar-label--chosen' : ''}">A</span>
          <div class="news-crisis__bar-track">
            <div class="news-crisis__bar-fill--a" style="width:${pctA}%"></div>
          </div>
          <span class="news-crisis__bar-pct">${pctA}%</span>
        </div>
        <div class="news-crisis__bar-row">
          <span class="news-crisis__bar-label news-crisis__bar-label--b${myVote === 'B' ? ' news-crisis__bar-label--chosen' : ''}">B</span>
          <div class="news-crisis__bar-track">
            <div class="news-crisis__bar-fill--b" style="width:${pctB}%"></div>
          </div>
          <span class="news-crisis__bar-pct">${pctB}%</span>
        </div>
        <div class="news-crisis__total">${fmtNum(totalVotes)}명 참여 · ${isWinnerA ? escHtml(crisis.optionA) : escHtml(crisis.optionB)} 우세</div>
      </div>` : '';

    const descA = crisis.optionADesc ? `<span class="news-crisis__btn-desc">${escHtml(crisis.optionADesc)}</span>` : '';
    const descB = crisis.optionBDesc ? `<span class="news-crisis__btn-desc">${escHtml(crisis.optionBDesc)}</span>` : '';

    const actionHTML = myVote
      ? `<div class="news-crisis__voted">✅ 투표 완료 — "${myVote === 'A' ? escHtml(crisis.optionA) : escHtml(crisis.optionB)}" 선택</div>`
      : `<div class="news-crisis__options">
           <button class="news-crisis__btn" data-option="A">A. ${escHtml(crisis.optionA)}${descA}<span class="news-crisis__btn-reward">+5P</span></button>
           <button class="news-crisis__btn" data-option="B">B. ${escHtml(crisis.optionB)}${descB}<span class="news-crisis__btn-reward">+5P</span></button>
         </div>`;

    const partyBreakdownHTML = (myVote || totalVotes > 0) ? renderCrisisPartyBreakdown(crisis.partyVotes, crisis.optionA, crisis.optionB) : '';

    const prevHTML = prevCrisis && (prevCrisis.votesA + prevCrisis.votesB) > 0 ? (() => {
      const prevTotal = prevCrisis.votesA + prevCrisis.votesB;
      const prevPctA = Math.round((prevCrisis.votesA / prevTotal) * 100);
      const prevWinner = prevPctA >= 50 ? prevCrisis.optionA : prevCrisis.optionB;
      return `<div class="news-crisis__prev">
        <span class="news-crisis__prev-label">지난 주:</span>
        <span class="news-crisis__prev-result">${escHtml(prevCrisis.title)} → ${escHtml(prevWinner)} 채택</span>
        ${prevCrisis.consequence ? `<span class="news-crisis__prev-consequence">"${escHtml(prevCrisis.consequence)}"</span>` : ''}
      </div>`;
    })() : '';

    slot.innerHTML = `
      <section class="news-crisis">
        <div class="news-section-title">🚨 이번 주 국정 위기 국민투표${daysLabel ? ` <span class="news-crisis__days">${daysLabel}</span>` : ''}</div>
        <div class="news-crisis__title">${escHtml(crisis.title)}</div>
        <p class="news-crisis__desc">${escHtml(crisis.desc || '')}</p>
        ${barHTML}
        ${actionHTML}
        ${partyBreakdownHTML}
        ${prevHTML}
      </section>`;

    slot.querySelectorAll('.news-crisis__btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!auth.currentUser) { navigate('/login'); return; }
        const option = btn.dataset.option;
        slot.querySelectorAll('.news-crisis__btn').forEach(b => b.disabled = true);
        try {
          const { data: vData } = await httpsCallable(functions, 'voteOnCrisis')({ option });
          if (vData.firstVote) {
            toast.success('+5P 획득! 국정 위기 투표 완료 🗳️');
            showPointPopup(5);
          } else {
            toast.success('국정 위기 투표 완료');
          }
          loadNewsCrisis(slot);
        } catch (e) {
          slot.querySelectorAll('.news-crisis__btn').forEach(b => b.disabled = false);
          toast.error(e?.message || '투표에 실패했어요');
        }
      });
    });
  } catch { /* non-critical */ }
}

async function loadAiColumn(slot) {
  if (!slot) return;
  try {
    const { data } = await httpsCallable(functions, 'generateNewsColumn')();
    if (!data?.column) return;
    slot.innerHTML = `
      <section class="news-column">
        <div class="news-section-title">✍️ 오늘의 시론</div>
        ${data.headline ? `<div class="news-column__headline">${escHtml(data.headline)}</div>` : ''}
        <p class="news-column__body">${escHtml(data.column)}</p>
        <div class="news-column__footer">AI 칼럼니스트 · 소소공화국 특파원</div>
      </section>`;
  } catch { /* non-critical */ }
}

async function loadBreakingAlerts(slot) {
  if (!slot) return;
  try {
    const { data } = await httpsCallable(functions, 'getPresident')();
    const p = data?.president;
    const alerts = [];

    if (p) {
      const approveCount = Number(p.decreeApprove || 0);
      const disapproveCount = Number(p.decreeDisapprove || 0);
      const total = approveCount + disapproveCount;
      const approvePct = total >= 5 ? Math.round((approveCount / total) * 100) : null;

      if (approvePct !== null && approvePct < 25) {
        alerts.push({ level: 'critical', icon: '🚨', text: `대통령 지지율 ${approvePct}% — 헌정 위기 경보`, path: '/election' });
      } else if (approvePct !== null && approvePct >= 80) {
        alerts.push({ level: 'high', icon: '⭐', text: `대통령 지지율 ${approvePct}% — 높은 국민 신뢰`, path: '/election' });
      }

      const impeachCount = Number(p.impeachCount || 0);
      const impeachThreshold = Number(p.impeachThreshold || 5);
      if (p.impeachTriggered) {
        alerts.push({ level: 'critical', icon: '✍️', text: `탄핵 청원 가결! ${impeachCount}/${impeachThreshold}명 서명 완료`, path: '/election' });
      } else if (impeachCount > 0) {
        const pct = Math.round((impeachCount / impeachThreshold) * 100);
        const level = pct >= 60 ? 'warning' : 'info';
        alerts.push({ level, icon: '✍️', text: `탄핵 청원 진행 중 — ${impeachCount}/${impeachThreshold}명 (${pct}%)`, path: '/election' });
      }
    }

    if (!alerts.length) return;

    slot.innerHTML = `<div class="news-breaking-alerts">
      ${alerts.map(a => `
        <div class="news-breaking-alert news-breaking-alert--${a.level}" data-path="${a.path}">
          <span class="news-breaking-alert__badge">🔴 속보</span>
          <span class="news-breaking-alert__icon">${a.icon}</span>
          <span class="news-breaking-alert__text">${escHtml(a.text)}</span>
        </div>`).join('')}
    </div>`;
    slot.querySelectorAll('[data-path]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.path)));
  } catch { /* non-critical */ }
}

async function loadPresidentBlock(slot) {
  if (!slot) return;
  try {
    const { data } = await httpsCallable(functions, 'getPresident')();
    const p = data?.president;
    if (!p) return;
    const approveCount = Number(p.decreeApprove || 0);
    const disapproveCount = Number(p.decreeDisapprove || 0);
    const total = approveCount + disapproveCount;
    const approvePct = total > 0 ? Math.round((approveCount / total) * 100) : null;

    const impeachCount = Number(p.impeachCount || 0);
    const impeachThreshold = Number(p.impeachThreshold || 5);
    const impeachPct = Math.min(100, Math.round((impeachCount / impeachThreshold) * 100));
    const impeachNewsHTML = impeachCount > 0 ? (() => {
      if (p.impeachTriggered) return `<div class="news-prez-impeach news-prez-impeach--triggered">✍️ 탄핵 청원 가결 — ${impeachCount}/${impeachThreshold}명</div>`;
      const urgencyClass = impeachPct >= 60 ? ' news-prez-impeach--urgent' : '';
      return `<div class="news-prez-impeach${urgencyClass}">
        <div class="news-prez-impeach__label">✍️ 탄핵 청원 ${impeachCount}/${impeachThreshold}명 서명</div>
        <div class="news-prez-impeach__bar-wrap"><div class="news-prez-impeach__bar" style="width:${impeachPct}%"></div></div>
      </div>`;
    })() : '';

    slot.innerHTML = `
      <section class="news-prez-block" data-path="/election">
        <div class="news-section-title">🏛️ 현직 대통령</div>
        <div class="news-prez-block__content" style="--party-c:${p.color}">
          <span class="news-prez-block__emoji">${p.emoji}</span>
          <div class="news-prez-block__info">
            <div class="news-prez-block__name">${escHtml(p.candidateName)}</div>
            <div class="news-prez-block__party">${escHtml(p.partyName)}</div>
            ${p.decree ? `<div class="news-prez-block__decree">"${escHtml(p.decree)}"</div>` : ''}
            ${approvePct !== null ? `
              <div class="news-prez-block__approval">
                <div class="news-prez-block__bar"><div class="news-prez-block__fill" style="width:${approvePct}%"></div></div>
                <span class="news-prez-block__pct">지지율 ${approvePct}% (${total}명 평가)</span>
              </div>` : ''}
            ${impeachNewsHTML}
          </div>
        </div>
      </section>`;
    slot.querySelector('[data-path]')?.addEventListener('click', () => navigate('/election'));
  } catch { /* non-critical */ }
}

export async function renderNews() {
  setMeta('소소신문 — 소소공화국 일간지', '소소공화국의 오늘과 역사를 전하는 소소신문');

  const el = document.getElementById('page-content');
  if (!el) return;

  el.innerHTML = `
    <div class="news-page page-enter">
      <div class="news-page__inner">
        <div class="news-loading">
          <span class="news-loading__icon">📰</span>
          <span>소소신문 불러오는 중…</span>
        </div>
      </div>
    </div>`;

  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKey = kst.toISOString().slice(0, 10);
  const [todayNews, archiveData] = await Promise.all([
    fetchTodayNews(),
    fetchNewsArchive(todayKey),
  ]);

  const featuredHTML = todayNews
    ? renderFeaturedArticle(todayNews)
    : `<div class="news-empty">
        <div class="news-empty__icon">🗞️</div>
        <div class="news-empty__text">오늘의 소소신문을 준비 중이에요</div>
        <div class="news-empty__sub">잠시 후 다시 확인해 주세요</div>
      </div>`;

  const archiveHTML = archiveData.length
    ? `<section class="news-archive">
        <h2 class="news-archive__title">📁 지난 호</h2>
        <div class="news-archive__list">
          ${archiveData.map(renderArchiveItem).join('')}
        </div>
      </section>`
    : '';

  el.innerHTML = `
    <div class="news-page page-enter">
      <div class="news-page__inner">
        <div id="news-breaking-slot"></div>
        ${featuredHTML}
        <div id="news-column-slot"></div>
        <div id="news-battle-slot"></div>
        <div id="news-prez-slot"></div>
        <div id="news-qa-slot"></div>
        <div id="news-crisis-slot"></div>
        <div id="news-party-slot"></div>
        <div id="news-king-slot"></div>
        ${archiveHTML}
      </div>
    </div>`;

  // 비동기 정치 데이터 섹션 로드
  const inner = el.querySelector('.news-page__inner');
  if (inner) {
    loadBreakingAlerts(inner.querySelector('#news-breaking-slot'));
    loadAiColumn(inner.querySelector('#news-column-slot'));
    loadBattleBulletin(inner.querySelector('#news-battle-slot'));
    loadPresidentBlock(inner.querySelector('#news-prez-slot'));
    loadPresidentQAHighlight(inner.querySelector('#news-qa-slot'));
    loadNewsCrisis(inner.querySelector('#news-crisis-slot'));
    loadPartyStandings(inner.querySelector('#news-party-slot'));
    loadKingRecap(inner.querySelector('#news-king-slot'));
  }
}
