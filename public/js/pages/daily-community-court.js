import { functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const getDailyCourt = httpsCallable(functions, 'getDailyRealCourt');
const submitVerdict = httpsCallable(functions, 'submitDailyRealCourtVerdict');
const selected = new Map();
let activeCaseId = '';
let rankingTab = 'weekly';

function ensureStyle() {
  if (document.getElementById('daily-community-court-style')) return;
  const style = document.createElement('style');
  style.id = 'daily-community-court-style';
  style.textContent = `
    .community-court-page{padding:22px 20px 100px}.community-intro{padding:20px;border:1px solid rgba(201,168,76,.38);border-radius:18px;background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(255,255,255,.025));margin-bottom:14px}.community-kicker{font-size:10px;font-weight:900;letter-spacing:.15em;color:var(--gold);margin-bottom:7px}.community-intro h1{font-size:23px;color:var(--cream);margin-bottom:7px;word-break:keep-all}.community-intro p{font-size:13px;color:var(--cream-dim);line-height:1.75}.community-progress-head{display:flex;justify-content:space-between;gap:12px;margin-top:16px;font-size:12px;color:var(--cream-dim)}.community-progress-head strong{color:var(--gold-light)}.community-progress{height:8px;margin-top:7px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.community-progress span{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-light));border-radius:999px}.community-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.community-tab{border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.025);color:var(--cream-dim);padding:11px 7px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.community-tab.active{border-color:var(--gold);background:rgba(201,168,76,.13);color:var(--gold-light)}.community-tab.done{color:var(--cream)}.community-tab span{display:block;font-size:10px;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.community-case{padding:22px;margin-bottom:14px}.community-meta{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:13px}.community-chip{display:inline-flex;padding:5px 9px;border-radius:999px;border:1px solid var(--border);background:var(--gold-dim);font-size:10px;font-weight:800;color:var(--gold)}.community-title{font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.5;margin-bottom:12px;color:var(--cream);word-break:keep-all}.community-summary{font-size:14px;line-height:1.85;color:var(--cream-dim);white-space:pre-wrap;word-break:keep-all}.community-arguments{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.community-argument{padding:14px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.025)}.community-argument strong{display:block;font-size:12px;color:var(--gold-light);margin-bottom:6px}.community-argument p{font-size:12px;line-height:1.7;color:var(--cream-dim)}.community-question{padding-top:16px;border-top:1px solid var(--border);font-size:15px;font-weight:900;line-height:1.7;color:var(--gold-light)}.community-choices{display:flex;flex-direction:column;gap:9px;margin:16px 0}.community-choice{width:100%;border:1.5px solid var(--border);border-radius:13px;background:rgba(255,255,255,.025);color:var(--cream);padding:14px 15px;text-align:left;font:inherit;font-size:14px;font-weight:800;line-height:1.55;cursor:pointer}.community-choice:hover{border-color:rgba(201,168,76,.65);background:rgba(201,168,76,.07)}.community-choice.selected{border-color:var(--gold);background:rgba(201,168,76,.14);box-shadow:0 0 0 2px rgba(201,168,76,.12)}.community-choice:disabled{cursor:default;opacity:.82}.community-result{margin-top:15px;padding:20px;border:1.5px solid rgba(201,168,76,.55);border-radius:17px;background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(255,255,255,.025))}.community-result-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.community-result h2{font-size:18px;color:var(--cream);line-height:1.5}.community-score{font-family:var(--font-serif);font-size:32px;font-weight:900;color:var(--gold-light);white-space:nowrap}.community-copy{margin-top:10px;font-size:13px;line-height:1.8;color:var(--cream-dim);white-space:pre-wrap}.community-fun{margin-top:13px;padding:13px 14px;border-left:3px solid var(--gold);background:rgba(0,0,0,.08);font-family:var(--font-serif);font-size:14px;line-height:1.75;color:var(--gold-light)}.community-bars{display:flex;flex-direction:column;gap:10px;margin-top:18px}.community-bar-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;font-size:12px;color:var(--cream-dim)}.community-bar-track{grid-column:1/-1;height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.community-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold-light))}.community-source{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:15px;padding-top:13px;border-top:1px solid var(--border);font-size:11px;color:var(--cream-dim)}.community-source a{color:var(--gold);font-weight:800;text-decoration:none}.community-complete{margin:14px 0;padding:19px;border:1.5px solid var(--gold);border-radius:17px;background:rgba(201,168,76,.11);text-align:center}.community-complete strong{display:block;font-size:21px;color:var(--gold-light);margin:4px 0 6px}.community-complete p{font-size:13px;color:var(--cream-dim)}.community-profile{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.community-profile div{padding:13px 7px;border:1px solid var(--border);border-radius:13px;text-align:center;background:rgba(255,255,255,.025)}.community-profile strong{display:block;font-family:var(--font-serif);font-size:19px;color:var(--gold)}.community-profile span{font-size:10px;color:var(--cream-dim)}.community-ranking{padding:20px;margin:15px 0}.community-ranking-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:13px}.community-ranking-head h2{font-size:19px;color:var(--cream)}.community-ranking-head span{font-size:11px;color:var(--cream-dim)}.community-ranking-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}.community-ranking-tab{border:1px solid var(--border);border-radius:10px;background:transparent;color:var(--cream-dim);padding:9px 6px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.community-ranking-tab.active{border-color:var(--gold);background:var(--gold-dim);color:var(--gold-light)}.community-ranking-panel{display:none}.community-ranking-panel.active{display:block}.community-rank{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;padding:11px 4px;border-bottom:1px solid rgba(201,168,76,.13)}.community-rank.me{margin:0 -7px;padding-left:11px;padding-right:11px;border-radius:10px;background:rgba(201,168,76,.11)}.community-rank em{font-style:normal;font-weight:900;color:var(--gold)}.community-rank b{min-width:0;font-size:13px;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.community-rank b small{display:block;font-size:10px;font-weight:500;color:var(--cream-dim);margin-top:2px}.community-rank strong{text-align:right;color:var(--gold-light)}.community-empty{text-align:center;padding:22px 8px;font-size:12px;color:var(--cream-dim)}.community-cta{display:flex;gap:9px;margin-top:14px}.community-cta>*{flex:1}@media(max-width:520px){.community-arguments{grid-template-columns:1fr}.community-profile{grid-template-columns:repeat(2,1fr)}.community-case{padding:19px 17px}.community-result{padding:18px 16px}.community-source{align-items:flex-start;flex-direction:column}.community-cta{flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function pct(value, total) {
  return total ? Math.round(Number(value || 0) / total * 100) : 0;
}
function errorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('unauthenticated')) return '로그인 후 판결을 선택할 수 있습니다.';
  if (code.includes('failed-precondition')) return error?.message || '이메일 인증을 확인해주세요.';
  return error?.message || '오늘의 재판을 불러오지 못했습니다.';
}
function rankRows(entries = [], type) {
  if (!entries.length) return '<div class="community-empty">아직 랭킹 기록이 없습니다.</div>';
  return entries.map(entry => {
    const detail = type === 'daily'
      ? `${entry.aligned}/${entry.played}건 AI와 일치`
      : `${entry.played}건 참여 · AI 일치율 ${entry.accuracy}%`;
    return `<div class="community-rank${entry.isMe ? ' me' : ''}"><em>${entry.rank}위</em><b>${escapeHtml(entry.nickname)}${entry.isMe ? ' · 나' : ''}<small>${escapeHtml(detail)}</small></b><strong>${Number(entry.score || 0)}점</strong></div>`;
  }).join('');
}
function rankings(data) {
  const rows = data.rankings || {};
  return `<section class="card community-ranking"><div class="community-ranking-head"><div><div class="community-kicker">JUDGE RANKING</div><h2>판결 참여 랭킹</h2></div><span>AI와 달라도 70점</span></div><div class="community-ranking-tabs" role="tablist">${[['daily','오늘'],['weekly','이번 주'],['allTime','누적']].map(([key,label]) => `<button type="button" class="community-ranking-tab${rankingTab === key ? ' active' : ''}" data-rank-tab="${key}">${label}</button>`).join('')}</div>${['daily','weekly','allTime'].map(key => `<div class="community-ranking-panel${rankingTab === key ? ' active' : ''}" data-rank-panel="${key}">${rankRows(rows[key], key)}</div>`).join('')}</section>`;
}
function profile(data) {
  const p = data.profile || {};
  const total = Number(p.totalPlayed || 0);
  const aligned = Number(p.totalAligned || 0);
  return `<div class="community-profile"><div><strong>${Number(p.currentStreak || 0)}일</strong><span>연속 참여</span></div><div><strong>${total ? Math.round(aligned / total * 100) : 0}%</strong><span>AI 판단 일치율</span></div><div><strong>${Number(p.weeklyScore || 0)}</strong><span>이번 주 점수</span></div><div><strong>${Number(p.totalScore || 0)}</strong><span>누적 점수</span></div></div>`;
}
function result(data, item) {
  const vote = data.votes?.[item.id];
  const reveal = data.reveals?.[item.id];
  if (!vote || !reveal) return '';
  const stat = data.stats?.[item.id] || { totalVotes: 0, counts: {} };
  const total = Number(stat.totalVotes || 0);
  const link = reveal.resultUrl ? `#/result/${encodeURIComponent(String(reveal.resultUrl).split('/').pop())}` : '';
  return `<section class="community-result" aria-live="polite"><div class="community-result-head"><div><div class="community-kicker">AI JUDGE COMPARISON</div><h2>${escapeHtml(reveal.judgeType || 'AI')} 판사 · ${escapeHtml(reveal.aiChoiceLabel || '')}</h2></div><div class="community-score">${Number(vote.score || 0)}점</div></div><div class="community-copy">${escapeHtml(reveal.reasoning || '')}</div><div class="community-fun">“${escapeHtml(reveal.funLine || '')}”</div><div class="community-bars">${item.choices.map(choice => { const value = Number(stat.counts?.[choice.id] || 0); const percentage = pct(value, total); return `<div class="community-bar-row"><span>${escapeHtml(choice.label)}</span><strong>${value}표 · ${percentage}%</strong><div class="community-bar-track"><div class="community-bar-fill" style="width:${percentage}%"></div></div></div>`; }).join('')}</div><div class="community-source"><span>${reveal.sourceKind === 'user' ? '공개 동의된 익명 접수사건' : '가상 생활사건'}</span>${link ? `<a href="${link}">AI 판결문 전체 보기 →</a>` : ''}</div></section>`;
}
function sync(data) {
  const cases = Array.isArray(data.gameCases) ? data.gameCases : [];
  cases.forEach(item => {
    if (data.votes?.[item.id]) selected.set(item.id, String(data.votes[item.id].selectedChoiceId || ''));
  });
  if (!cases.some(item => item.id === activeCaseId)) activeCaseId = cases.find(item => !data.votes?.[item.id])?.id || cases[0]?.id || '';
}
function nextCase(data, id) {
  const cases = data.gameCases || [];
  const start = Math.max(0, cases.findIndex(item => item.id === id));
  for (let step = 1; step <= cases.length; step += 1) {
    const item = cases[(start + step) % cases.length];
    if (item && !data.votes?.[item.id]) return item;
  }
  return null;
}
function bind(container, data, item, voted) {
  container.querySelectorAll('[data-case-id]').forEach(button => button.addEventListener('click', () => { activeCaseId = button.dataset.caseId || activeCaseId; render(container, data); }));
  container.querySelectorAll('[data-choice-id]').forEach(button => button.addEventListener('click', () => {
    if (voted) return;
    selected.set(item.id, button.dataset.choiceId || '');
    container.querySelectorAll('[data-choice-id]').forEach(choice => choice.classList.toggle('selected', choice === button));
    const submit = container.querySelector('#community-submit');
    if (submit) submit.disabled = false;
  }));
  container.querySelector('#community-submit')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const choice = String(selected.get(item.id) || '');
    if (!choice || button.disabled) return;
    button.disabled = true;
    button.textContent = '판결 집계 중...';
    try {
      const response = await submitVerdict({ caseId: item.id, selectedChoiceId: choice });
      activeCaseId = item.id;
      render(container, response.data);
      showToast(response.data?.votes?.[item.id]?.aligned ? 'AI 판사와 같은 판단입니다.' : '다른 판단도 유효한 판결입니다.', 'success');
    } catch (error) {
      button.disabled = false;
      button.textContent = '이 판결로 선고하기';
      showToast(errorMessage(error), 'error');
    }
  });
  container.querySelector('#community-next')?.addEventListener('click', () => { const next = nextCase(data, item.id); if (next) { activeCaseId = next.id; render(container, data); } });
  container.querySelectorAll('[data-rank-tab]').forEach(button => button.addEventListener('click', () => { rankingTab = button.dataset.rankTab || 'weekly'; render(container, data); }));
}
function render(container, data) {
  sync(data);
  const cases = data.gameCases || [];
  const item = cases.find(candidate => candidate.id === activeCaseId) || cases[0];
  if (!item) throw new Error('오늘의 생활사건이 비어 있습니다.');
  const index = cases.findIndex(candidate => candidate.id === item.id);
  const vote = data.votes?.[item.id];
  const voted = Boolean(vote);
  const chosen = voted ? String(vote.selectedChoiceId || '') : String(selected.get(item.id) || '');
  const today = data.today || {};
  const progress = cases.length ? Math.round(Number(today.played || 0) / cases.length * 100) : 0;
  const next = nextCase(data, item.id);
  container.innerHTML = `<div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">오늘의 재판</span></div><div class="container community-court-page"><section class="community-intro"><div class="community-kicker">COMMUNITY COURT · 하루 세 판</div><h1>다른 사람의 생활사건을 직접 판결합니다</h1><p>글쓰기는 사건접수 한 곳에서만 합니다. 오늘의 재판에서는 공개에 동의한 익명 사건을 읽고 원고·피고·쌍방 중 하나만 선택하세요.</p><div class="community-progress-head"><span>오늘 진행 ${Number(today.played || 0)} / ${cases.length}</span><strong>${Number(today.score || 0)} / ${Number(today.maxScore || 300)}점</strong></div><div class="community-progress"><span style="width:${Math.min(100, progress)}%"></span></div></section><div class="community-tabs">${cases.map((candidate, i) => `<button type="button" class="community-tab${candidate.id === item.id ? ' active' : ''}${data.votes?.[candidate.id] ? ' done' : ''}" data-case-id="${escapeHtml(candidate.id)}">${data.votes?.[candidate.id] ? '✓ ' : ''}${i + 1}번 사건<span>${escapeHtml(candidate.category || '생활사건')}</span></button>`).join('')}</div><section class="card community-case"><div class="community-meta"><span class="community-chip">${escapeHtml(data.dateKey || '')}</span><span class="community-chip">${index + 1} / ${cases.length}</span><span class="community-chip">${escapeHtml(item.sourceKind === 'user' ? '실제 유저 접수' : '가상 사건')}</span><span class="community-chip">후보 ${Number(data.poolSize || 0)}건</span></div><div class="community-title">${escapeHtml(item.title)}</div><div class="community-summary">${escapeHtml(item.summary)}</div><div class="community-arguments">${(item.arguments || []).map(arg => `<div class="community-argument"><strong>${escapeHtml(arg.label)}</strong><p>${escapeHtml(arg.text)}</p></div>`).join('')}</div><div class="community-question">${escapeHtml(item.question)}</div><div class="community-choices">${item.choices.map(choice => `<button type="button" class="community-choice${chosen === choice.id ? ' selected' : ''}" data-choice-id="${escapeHtml(choice.id)}" ${voted ? 'disabled' : ''}>${escapeHtml(choice.label)}</button>`).join('')}</div>${voted ? '' : data.signedIn ? `<button type="button" class="btn btn-primary" id="community-submit" ${chosen ? '' : 'disabled'}>이 판결로 선고하기</button>` : '<a href="#/auth" class="btn btn-primary">로그인하고 판결하기</a>'}${result(data, item)}${voted && next ? '<button type="button" class="btn btn-secondary" id="community-next" style="margin-top:12px;">다음 사건 판결하기</button>' : ''}</section>${today.completed ? `<section class="community-complete"><div class="community-kicker">TODAY COMPLETE</div><strong>오늘의 3건 판결 완료</strong><p>AI 판단과 ${Number(today.aligned || 0)}건 일치 · 총 ${Number(today.score || 0)}점이 랭킹에 반영됐습니다.</p></section>` : ''}${profile(data)}${rankings(data)}<div class="disclaimer"><strong>선택형 오락 재판</strong><br>${escapeHtml(item.sourceNotice || '')} AI 판단은 정답이나 법률상담이 아니며, 다른 판단을 선택해도 참여 점수가 지급됩니다.</div><div class="community-cta"><a href="#/submit" class="btn btn-primary">내 사건 접수하기</a><a href="#/board" class="btn btn-secondary">지난 판결 보기</a></div></div>`;
  bind(container, data, item, voted);
}

export async function renderDailyRealCourt(container) {
  ensureStyle();
  selected.clear();
  activeCaseId = '';
  rankingTab = 'weekly';
  container.innerHTML = '<div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">오늘의 재판</span></div><div class="container" style="padding:70px 20px 100px;"><div class="loading-dots"><span></span><span></span><span></span></div></div>';
  try {
    const response = await getDailyCourt();
    render(container, response.data);
  } catch (error) {
    container.innerHTML = `<div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">오늘의 재판</span></div><div class="container" style="padding:60px 20px 100px;text-align:center;"><div class="card" style="padding:25px;"><div style="font-size:42px;margin-bottom:12px;">⚖️</div><div style="font-weight:900;color:var(--gold);margin-bottom:8px;">오늘의 생활사건을 준비하고 있습니다</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">${escapeHtml(errorMessage(error))}</div><button type="button" class="btn btn-secondary" id="community-retry" style="margin-top:18px;">다시 불러오기</button></div></div>`;
    container.querySelector('#community-retry')?.addEventListener('click', () => renderDailyRealCourt(container));
  }
}
