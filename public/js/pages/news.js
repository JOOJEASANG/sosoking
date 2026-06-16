/* news.js — 새공화국 소소신문 */
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { showPointPopup } from '../utils/point-popup.js';

const PARTY_INFO = {
  national: { name: '국민질서당', emoji: '🛡️', color: '#263B66', ideology: '보수파' },
  youth: { name: '시민개혁당', emoji: '🕯️', color: '#B8323B', ideology: '진보파' },
  center: { name: '국민통합당', emoji: '⚖️', color: '#2F7D6E', ideology: '중도파' },
};

function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function todayLabel() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

function normalizeParty(pid, fallback = {}) {
  return { ...(PARTY_INFO[pid] || { name: pid || '정당', emoji: '🏛️', color: '#64748b', ideology: '' }), ...fallback };
}

function renderFeaturedArticle(news, battle) {
  const headline = news?.headline || news?.columns?.[0]?.title || '새공화국 브리핑';
  const body = news?.body || news?.columns?.[0]?.summary || battle?.topicDesc || '오늘의 역사 이슈와 정당 대항전이 시민광장의 주요 의제로 떠올랐습니다.';
  return `<div class="news-featured">
    <div class="news-featured__masthead"><span class="news-featured__logo">📰 소소신문</span><span class="news-badge news-badge--today">오늘</span></div>
    <h1 class="news-featured__headline">${escHtml(headline)}</h1>
    <p class="news-featured__body">${escHtml(body)}</p>
    <div class="news-featured__footer">소소공화국 공식 일간지 · 역사 이슈와 시민 여론 브리핑</div>
  </div>`;
}

function renderBattleBulletin(data) {
  if (!data?.exists) return `<section class="news-bulletin"><div class="news-section-title">⚔️ 오늘의 정당 대항전</div><div class="news-bulletin__total">아직 배틀이 생성되지 않았습니다.</div></section>`;
  const votes = data.votes || {};
  const total = Number(data.totalVotes || 0);
  const rows = Object.entries(PARTY_INFO).map(([pid, info]) => {
    const count = Number(votes[pid] || 0);
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `<div class="news-bulletin__bar-row"><span class="news-bulletin__bar-emoji">${info.emoji}</span><span class="news-bulletin__bar-name">${info.name}</span><div class="news-bulletin__bar-track"><div class="news-bulletin__bar-fill" style="width:${Math.max(2, pct)}%;background:${info.color}"></div></div><span class="news-bulletin__bar-pct">${pct}%</span></div>`;
  }).join('');
  return `<section class="news-bulletin" data-path="/battle">
    <div class="news-bulletin__header"><span class="news-bulletin__label">⚔️ 오늘의 정당 대항전</span><span class="news-bulletin__status ${data.status === 'ended' ? 'news-bulletin__status--ended' : 'news-bulletin__status--live'}">${data.status === 'ended' ? '종료' : '🔴 진행중'}</span></div>
    <div class="news-bulletin__topic">${escHtml(data.topic || '역사 쟁점 토론')}</div>
    ${data.historyQuestion ? `<p class="news-featured__body" style="margin-top:6px">쟁점 · ${escHtml(data.historyQuestion)}</p>` : ''}
    <div class="news-bulletin__bars">${rows}</div>
    <div class="news-bulletin__total">${fmtNum(total)}명 참여</div>
  </section>`;
}

function renderPartyStandings(overview) {
  const parties = Array.isArray(overview?.parties) ? overview.parties : [];
  if (!parties.length) return '';
  const total = parties.reduce((s, p) => s + Number(p.totalPower || 0), 0) || 1;
  const rows = parties.slice(0, 3).map((p, i) => {
    const meta = normalizeParty(p.id, p);
    const pct = Math.round((Number(p.totalPower || 0) / total) * 100);
    const medals = ['🥇', '🥈', '🥉'];
    return `<div class="news-party-row" style="--party-c:${meta.color}"><span class="news-party-row__rank">${medals[i] || i + 1}</span><span class="news-party-row__emoji">${meta.emoji}</span><span class="news-party-row__name">${escHtml(meta.name)}</span><div class="news-party-row__bar-wrap"><div class="news-party-row__bar" style="width:${Math.max(3, pct)}%"></div></div><span class="news-party-row__pct">${pct}%</span></div>`;
  }).join('');
  return `<section class="news-party-standings" data-path="/parties"><div class="news-section-title">🏛️ 정당 세력 현황</div><div class="news-party-rows">${rows}</div><div class="news-party-standings__footer">정치력 기준 · 클릭해서 정당 상세 보기</div></section>`;
}

function renderCrisis(crisisData) {
  const crisis = crisisData?.crisis;
  if (!crisis?.title) return '';
  const votes = crisis.votes || {};
  const total = Number(crisis.totalVotes || 0);
  const options = Array.isArray(crisis.options) ? crisis.options : Object.entries(PARTY_INFO).map(([pid, p]) => ({ partyId: pid, label: `${p.emoji} ${p.name} 해법 지지` }));
  const rows = options.map(opt => {
    const info = normalizeParty(opt.partyId);
    const count = Number(votes[opt.partyId] || 0);
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `<button class="news-crisis__btn" data-party-id="${escHtml(opt.partyId)}"><b>${escHtml(opt.label || `${info.emoji} ${info.name}`)}</b><span class="news-crisis__btn-desc">${pct}% · ${fmtNum(count)}표</span><span class="news-crisis__btn-reward">+5P</span></button>`;
  }).join('');
  return `<section class="news-crisis"><div class="news-section-title">🚨 이번 주 국정 위기 국민투표</div><div class="news-crisis__title">${escHtml(crisis.title)}</div><p class="news-crisis__desc">${escHtml(crisis.desc || '')}</p><div class="news-crisis__options">${rows}</div>${crisisData.myVote ? `<div class="news-crisis__voted">✅ 투표 완료 — ${escHtml(normalizeParty(crisisData.myVote).name)} 해법 선택</div>` : ''}</section>`;
}

function renderColumns(news) {
  const cols = Array.isArray(news?.columns) ? news.columns : [];
  if (!cols.length) return '';
  return `<section class="news-archive"><div class="news-section-title">🗞️ 오늘의 칼럼</div>${cols.map(c => `<div class="news-archive-item"><span class="news-archive-item__date">${escHtml((c.tags || []).join(' · '))}</span><p class="news-archive-item__headline">${escHtml(c.title || '')}</p><p class="news-archive-item__body">${escHtml(c.summary || '')}</p></div>`).join('')}</section>`;
}

async function safeCall(name, payload) {
  try {
    const { data } = await httpsCallable(functions, name)(payload || {});
    return data || null;
  } catch { return null; }
}

export async function renderNews() {
  setMeta('소소킹 소소신문');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `<div class="news-page page-enter"><div class="skeleton" style="height:220px;border-radius:20px;margin-bottom:14px"></div><div class="skeleton" style="height:160px;border-radius:18px"></div></div>`;

  const [news, battle, overview, crisis] = await Promise.all([
    safeCall('getDailyNews'),
    safeCall('getBattleStatus'),
    safeCall('getPoliticsOverview'),
    safeCall('getWeeklyCrisis'),
  ]);

  el.innerHTML = `<div class="news-page page-enter">
    <div class="news-hero"><div><div class="news-hero__eyebrow">SOSO DAILY · ${todayLabel()}</div><div class="news-hero__title">📰 소소신문</div><div class="news-hero__desc">새공화국의 역사 이슈, 정당 대항전, 시민 여론을 한 번에 정리합니다.</div></div><a class="btn btn--ghost btn--sm" href="#/feed?q=역사">역사 이슈 보기</a></div>
    ${renderFeaturedArticle(news, battle)}
    <div class="news-grid">${renderBattleBulletin(battle)}${renderPartyStandings(overview)}</div>
    ${renderCrisis(crisis)}
    ${renderColumns(news)}
  </div>`;

  el.querySelectorAll('[data-path]').forEach(node => node.addEventListener('click', () => navigate(node.dataset.path)));
  el.querySelectorAll('.news-crisis__btn').forEach(btn => btn.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const partyId = btn.dataset.partyId;
    btn.disabled = true;
    try {
      await httpsCallable(functions, 'voteOnCrisis')({ partyId });
      toast.success('국정 위기 투표 완료 🗳️');
      showPointPopup(5);
      renderNews();
    } catch (e) {
      toast.error(e?.message || '투표에 실패했어요');
      btn.disabled = false;
    }
  }));
}
