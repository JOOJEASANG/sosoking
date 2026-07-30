import { functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const getDailyRealCourt = httpsCallable(functions, 'getDailyRealCourt');
const submitDailyRealCourtVerdict = httpsCallable(functions, 'submitDailyRealCourtVerdict');

const selectedChoices = new Map();
const evidenceUsage = new Map();
let activeCaseId = '';
let activeRankingTab = 'weekly';

function ensureStyle() {
  if (document.getElementById('daily-real-court-style')) return;
  const style = document.createElement('style');
  style.id = 'daily-real-court-style';
  style.textContent = `
    .daily-court-page{padding:22px 0 34px;}
    .daily-court-intro{margin-bottom:14px;padding:20px;border:1px solid rgba(201,168,76,.35);border-radius:18px;background:linear-gradient(135deg,rgba(201,168,76,.13),rgba(255,255,255,.025));}
    .daily-court-kicker{font-size:10px;font-weight:900;letter-spacing:.16em;color:var(--gold);margin-bottom:7px;}
    .daily-court-intro h1{font-size:23px;color:var(--cream);margin-bottom:7px;word-break:keep-all;}
    .daily-court-intro p{font-size:13px;color:var(--cream-dim);line-height:1.75;}
    .daily-progress-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:16px;font-size:12px;color:var(--cream-dim);}
    .daily-progress-head strong{color:var(--gold-light);}
    .daily-progress-track{height:8px;margin-top:7px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;}
    .daily-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold-light));transition:width .25s ease;}
    .daily-case-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;}
    .daily-case-tab{min-width:0;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.025);color:var(--cream-dim);padding:11px 7px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;}
    .daily-case-tab.active{border-color:var(--gold);background:rgba(201,168,76,.13);color:var(--gold-light);}
    .daily-case-tab.done{color:var(--cream);}
    .daily-case-tab span{display:block;font-size:10px;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .daily-court-case{padding:22px;margin-bottom:14px;}
    .daily-court-meta{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:13px;}
    .daily-court-chip{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;border:1px solid var(--border);background:var(--gold-dim);font-size:10px;font-weight:800;color:var(--gold);}
    .daily-court-title{font-family:var(--font-serif);font-size:21px;font-weight:900;line-height:1.5;margin-bottom:12px;color:var(--cream);word-break:keep-all;}
    .daily-court-summary{font-size:14px;line-height:1.85;color:var(--cream-dim);white-space:pre-wrap;word-break:keep-all;}
    .daily-court-question{margin-top:18px;padding-top:16px;border-top:1px solid var(--border);font-size:15px;font-weight:900;line-height:1.7;color:var(--gold-light);word-break:keep-all;}
    .daily-evidence{display:flex;flex-direction:column;gap:8px;margin:14px 0;}
    .daily-evidence-btn{width:100%;border:1px dashed rgba(201,168,76,.42);border-radius:12px;background:rgba(201,168,76,.05);color:var(--cream-dim);padding:12px 13px;text-align:left;font-family:inherit;font-size:12px;line-height:1.6;cursor:pointer;}
    .daily-evidence-btn.revealed{border-style:solid;background:rgba(201,168,76,.11);color:var(--cream);cursor:default;}
    .daily-evidence-note{font-size:11px;color:var(--cream-dim);margin-top:4px;}
    .daily-choice-list{display:flex;flex-direction:column;gap:9px;margin:16px 0;}
    .daily-choice{width:100%;border:1.5px solid var(--border);border-radius:13px;background:rgba(255,255,255,.025);color:var(--cream);padding:14px 15px;text-align:left;font-family:inherit;font-size:14px;font-weight:800;line-height:1.55;cursor:pointer;transition:.15s ease;}
    .daily-choice:hover{border-color:rgba(201,168,76,.65);background:rgba(201,168,76,.07);}
    .daily-choice.selected{border-color:var(--gold);background:rgba(201,168,76,.14);box-shadow:0 0 0 2px rgba(201,168,76,.14);}
    .daily-choice:disabled{cursor:default;opacity:.78;}
    .daily-result{margin-top:15px;padding:22px;border:1.5px solid rgba(201,168,76,.55);border-radius:17px;background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(255,255,255,.025));}
    .daily-result-score{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px;}
    .daily-score-number{font-family:var(--font-serif);font-size:35px;font-weight:900;color:var(--gold-light);line-height:1;}
    .daily-result h2{font-size:19px;color:var(--cream);margin-bottom:9px;word-break:keep-all;}
    .daily-result-copy{font-size:13px;line-height:1.8;color:var(--cream-dim);white-space:pre-wrap;word-break:keep-all;}
    .daily-fun-line{margin-top:13px;padding:13px 14px;border-left:3px solid var(--gold);background:rgba(0,0,0,.08);font-family:var(--font-serif);font-size:14px;line-height:1.75;color:var(--gold-light);}
    .daily-bars{display:flex;flex-direction:column;gap:10px;margin-top:18px;}
    .daily-bar-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;font-size:12px;color:var(--cream-dim);}
    .daily-bar-track{grid-column:1/-1;height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;}
    .daily-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold-light));}
    .daily-source{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--border);font-size:11px;color:var(--cream-dim);}
    .daily-source a{color:var(--gold);font-weight:800;text-decoration:none;}
    .daily-next-btn{margin-top:12px;}
    .daily-complete{margin:14px 0;padding:19px;border:1.5px solid var(--gold);border-radius:17px;background:rgba(201,168,76,.11);text-align:center;}
    .daily-complete strong{display:block;font-size:21px;color:var(--gold-light);margin:4px 0 6px;}
    .daily-complete p{font-size:13px;color:var(--cream-dim);}
    .daily-profile{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0;}
    .daily-profile-item{padding:13px 7px;border:1px solid var(--border);border-radius:13px;text-align:center;background:rgba(255,255,255,.025);}
    .daily-profile-value{font-family:var(--font-serif);font-size:19px;font-weight:900;color:var(--gold);}
    .daily-profile-label{font-size:10px;color:var(--cream-dim);margin-top:3px;}
    .daily-ranking{margin:15px 0;padding:20px;}
    .daily-ranking-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:13px;}
    .daily-ranking-head h2{font-size:19px;color:var(--cream);}
    .daily-ranking-head span{font-size:11px;color:var(--cream-dim);}
    .daily-ranking-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px;}
    .daily-ranking-tab{border:1px solid var(--border);border-radius:10px;background:transparent;color:var(--cream-dim);padding:9px 6px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;}
    .daily-ranking-tab.active{border-color:var(--gold);background:var(--gold-dim);color:var(--gold-light);}
    .daily-ranking-panel{display:none;}
    .daily-ranking-panel.active{display:block;}
    .daily-rank-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;padding:11px 4px;border-bottom:1px solid rgba(201,168,76,.13);}
    .daily-rank-row:last-child{border-bottom:none;}
    .daily-rank-row.me{margin:0 -7px;padding-left:11px;padding-right:11px;border-radius:10px;background:rgba(201,168,76,.11);}
    .daily-rank-number{font-weight:900;color:var(--gold);}
    .daily-rank-name{min-width:0;font-size:13px;font-weight:900;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .daily-rank-name small{display:block;font-size:10px;font-weight:500;color:var(--cream-dim);margin-top:2px;}
    .daily-rank-score{text-align:right;font-size:14px;font-weight:900;color:var(--gold-light);}
    .daily-ranking-empty{padding:24px 8px;text-align:center;font-size:12px;color:var(--cream-dim);}
    [data-theme="light"] .daily-fun-line{background:rgba(154,112,24,.06);}
    @media(max-width:420px){.daily-court-case{padding:19px 17px}.daily-profile{grid-template-columns:repeat(2,1fr)}.daily-result{padding:19px 17px}.daily-source{align-items:flex-start;flex-direction:column}.daily-court-intro h1{font-size:21px}.daily-ranking{padding:18px 16px}}
  `;
  document.head.appendChild(style);
}

function errorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('unauthenticated')) return '로그인 후 오늘의 판결에 참여할 수 있습니다.';
  if (code.includes('failed-precondition')) return error?.message || '이메일 인증을 확인해주세요.';
  if (code.includes('unavailable')) return error?.message || '오늘의 실제 판례를 준비하고 있습니다.';
  return '오늘의 재판을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function percentage(count, total) {
  return total > 0 ? Math.round((Number(count || 0) / total) * 100) : 0;
}

function profileMarkup(data) {
  const profile = data.profile || {};
  const total = Number(profile.totalPlayed || 0);
  const correct = Number(profile.totalCorrect || 0);
  const accuracy = total ? Math.round(correct / total * 100) : 0;
  return `<div class="daily-profile">
    <div class="daily-profile-item"><div class="daily-profile-value">${Number(profile.currentStreak || 0)}일</div><div class="daily-profile-label">연속 출석</div></div>
    <div class="daily-profile-item"><div class="daily-profile-value">${accuracy}%</div><div class="daily-profile-label">누적 적중률</div></div>
    <div class="daily-profile-item"><div class="daily-profile-value">${Number(profile.weeklyScore || 0)}</div><div class="daily-profile-label">이번 주 점수</div></div>
    <div class="daily-profile-item"><div class="daily-profile-value">${Number(profile.totalScore || 0)}</div><div class="daily-profile-label">누적 점수</div></div>
  </div>`;
}

function resultMarkup(data, gameCase) {
  const vote = data.votes?.[gameCase.id];
  const reveal = data.reveals?.[gameCase.id];
  const stats = data.stats?.[gameCase.id] || { totalVotes: 0, counts: {} };
  if (!reveal || !vote) return '';
  return `<section class="daily-result" aria-live="polite">
    <div class="daily-result-score">
      <div><div class="daily-court-kicker">CASE JUDGMENT SCORE</div><strong>${vote.correct ? '실제 판결 적중' : '실제 판결과 다름'}</strong></div>
      <div class="daily-score-number">${Number(vote.score || 0)}점</div>
    </div>
    <h2>실제 판단 · ${escapeHtml(reveal.correctChoiceLabel)}</h2>
    <div class="daily-result-copy">${escapeHtml(reveal.reasoning)}</div>
    <div class="daily-fun-line">“${escapeHtml(reveal.funLine)}”</div>
    <div class="daily-bars">
      ${gameCase.choices.map(choice => {
        const count = Number(stats.counts?.[choice.id] || 0);
        const pct = percentage(count, Number(stats.totalVotes || 0));
        return `<div class="daily-bar-row"><span>${escapeHtml(choice.label)}</span><strong>${count}표 · ${pct}%</strong><div class="daily-bar-track"><div class="daily-bar-fill" style="width:${pct}%"></div></div></div>`;
      }).join('')}
    </div>
    <div class="daily-source">
      <span>${escapeHtml(reveal.court)} ${escapeHtml(reveal.decidedAt)} 선고 ${escapeHtml(reveal.caseNumber)}</span>
      <a href="${escapeHtml(reveal.sourceUrl)}" target="_blank" rel="noopener noreferrer">공식 판례 확인 ↗</a>
    </div>
  </section>`;
}

function rankDetail(entry, type) {
  if (type === 'daily') return `${entry.correct}/${entry.played}건 적중 · 증거 ${entry.evidenceUsed}개`;
  if (type === 'weekly') return `${entry.played}건 참여 · 적중률 ${entry.accuracy}%`;
  return `${entry.played}건 판결 · 적중률 ${entry.accuracy}% · 최고 ${entry.bestStreak}일`;
}

function rankingRows(entries = [], type) {
  if (!entries.length) return '<div class="daily-ranking-empty">아직 랭킹 기록이 없습니다.</div>';
  return entries.map(entry => `<div class="daily-rank-row${entry.isMe ? ' me' : ''}">
    <div class="daily-rank-number">${entry.rank}위</div>
    <div class="daily-rank-name">${escapeHtml(entry.nickname)}${entry.isMe ? ' · 나' : ''}<small>${escapeHtml(rankDetail(entry, type))}</small></div>
    <div class="daily-rank-score">${Number(entry.score || 0)}점</div>
  </div>`).join('');
}

function rankingsMarkup(data) {
  const rankings = data.rankings || {};
  return `<section class="card daily-ranking">
    <div class="daily-ranking-head"><div><div class="daily-court-kicker">JUDGE RANKING</div><h2>판사 랭킹</h2></div><span>매일 3건 기준</span></div>
    <div class="daily-ranking-tabs" role="tablist" aria-label="판사 랭킹 기간">
      <button type="button" class="daily-ranking-tab${activeRankingTab === 'daily' ? ' active' : ''}" data-ranking-tab="daily" role="tab" aria-selected="${activeRankingTab === 'daily'}">오늘</button>
      <button type="button" class="daily-ranking-tab${activeRankingTab === 'weekly' ? ' active' : ''}" data-ranking-tab="weekly" role="tab" aria-selected="${activeRankingTab === 'weekly'}">이번 주</button>
      <button type="button" class="daily-ranking-tab${activeRankingTab === 'allTime' ? ' active' : ''}" data-ranking-tab="allTime" role="tab" aria-selected="${activeRankingTab === 'allTime'}">누적</button>
    </div>
    <div class="daily-ranking-panel${activeRankingTab === 'daily' ? ' active' : ''}" data-ranking-panel="daily">${rankingRows(rankings.daily, 'daily')}</div>
    <div class="daily-ranking-panel${activeRankingTab === 'weekly' ? ' active' : ''}" data-ranking-panel="weekly">${rankingRows(rankings.weekly, 'weekly')}</div>
    <div class="daily-ranking-panel${activeRankingTab === 'allTime' ? ' active' : ''}" data-ranking-panel="allTime">${rankingRows(rankings.allTime, 'all')}</div>
  </section>`;
}

function syncState(data) {
  const cases = Array.isArray(data.gameCases) ? data.gameCases : [];
  cases.forEach(gameCase => {
    const vote = data.votes?.[gameCase.id];
    if (vote) {
      selectedChoices.set(gameCase.id, String(vote.selectedChoiceId || ''));
      evidenceUsage.set(gameCase.id, Number(vote.evidenceUsed || 0));
    }
  });
  if (!cases.some(gameCase => gameCase.id === activeCaseId)) {
    activeCaseId = cases.find(gameCase => !data.votes?.[gameCase.id])?.id || cases[0]?.id || '';
  }
}

function nextUnvotedCase(data, currentId = '') {
  const cases = Array.isArray(data.gameCases) ? data.gameCases : [];
  const start = Math.max(0, cases.findIndex(gameCase => gameCase.id === currentId));
  for (let step = 1; step <= cases.length; step += 1) {
    const gameCase = cases[(start + step) % cases.length];
    if (gameCase && !data.votes?.[gameCase.id]) return gameCase;
  }
  return null;
}

function renderGame(container, data) {
  syncState(data);
  const cases = Array.isArray(data.gameCases) ? data.gameCases : [];
  const gameCase = cases.find(item => item.id === activeCaseId) || cases[0];
  if (!gameCase) throw new Error('오늘의 판례가 비어 있습니다.');

  const caseIndex = cases.findIndex(item => item.id === gameCase.id);
  const vote = data.votes?.[gameCase.id];
  const voted = Boolean(vote);
  const selectedChoiceId = voted ? String(vote.selectedChoiceId || '') : String(selectedChoices.get(gameCase.id) || '');
  const evidenceUsed = voted ? Number(vote.evidenceUsed || 0) : Number(evidenceUsage.get(gameCase.id) || 0);
  const today = data.today || {};
  const progress = cases.length ? Math.round((Number(today.played || 0) / cases.length) * 100) : 0;
  const nextCase = nextUnvotedCase(data, gameCase.id);

  container.innerHTML = `
    <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">오늘의 재판</span></div>
    <div class="container daily-court-page">
      <section class="daily-court-intro">
        <div class="daily-court-kicker">REAL CASE · 하루 세 판</div>
        <h1>실제 법원은 어떻게 판단했을까요?</h1>
        <p>오늘 출제된 3건을 직접 판결하고 점수를 합산합니다. 하루·주간·누적 랭킹에서 다른 판사들과 기록을 비교해보세요.</p>
        <div class="daily-progress-head"><span>오늘 진행 ${Number(today.played || 0)} / ${cases.length}</span><strong>${Number(today.score || 0)} / ${Number(today.maxScore || cases.length * 100)}점</strong></div>
        <div class="daily-progress-track" aria-label="오늘의 재판 진행률"><div class="daily-progress-fill" style="width:${Math.min(100, progress)}%"></div></div>
      </section>
      <div class="daily-case-nav" aria-label="오늘의 사건 선택">
        ${cases.map((item, index) => `<button type="button" class="daily-case-tab${item.id === gameCase.id ? ' active' : ''}${data.votes?.[item.id] ? ' done' : ''}" data-case-id="${escapeHtml(item.id)}">${data.votes?.[item.id] ? '✓ ' : ''}${index + 1}번 사건<span>${escapeHtml(item.category || '실제 판례')}</span></button>`).join('')}
      </div>
      <section class="card daily-court-case">
        <div class="daily-court-meta"><span class="daily-court-chip">${escapeHtml(data.dateKey)}</span><span class="daily-court-chip">${caseIndex + 1} / ${cases.length}</span><span class="daily-court-chip">${escapeHtml(gameCase.category || '실제 판례')}</span><span class="daily-court-chip">판례 ${Number(data.catalogSize || 0)}건 순환</span></div>
        <div class="daily-court-title">${escapeHtml(gameCase.title)}</div>
        <div class="daily-court-summary">${escapeHtml(gameCase.summary)}</div>
        <div class="daily-court-question">${escapeHtml(gameCase.question)}</div>
        <div class="daily-evidence">
          ${(gameCase.evidence || []).map((text, index) => `<button type="button" class="daily-evidence-btn${voted || index < evidenceUsed ? ' revealed' : ''}" data-evidence-index="${index}" ${voted || index < evidenceUsed ? 'disabled' : ''}>${voted || index < evidenceUsed ? `증거 ${index + 1} · ${escapeHtml(text)}` : `🔒 증거 ${index + 1} 열람하기 · 최대 점수 -15점`}</button>`).join('')}
        </div>
        <div class="daily-evidence-note">사건별 최고 100점입니다. 증거를 적게 볼수록 정답 점수가 높습니다.</div>
        <div class="daily-choice-list">
          ${gameCase.choices.map(choice => `<button type="button" class="daily-choice${selectedChoiceId === choice.id ? ' selected' : ''}" data-choice-id="${escapeHtml(choice.id)}" ${voted ? 'disabled' : ''}>${escapeHtml(choice.label)}</button>`).join('')}
        </div>
        ${voted ? '' : data.signedIn
          ? '<button type="button" class="btn btn-primary" id="daily-court-submit" disabled>이 판결로 선고하기</button>'
          : '<a href="#/auth" class="btn btn-primary">로그인하고 판결하기</a>'}
        ${resultMarkup(data, gameCase)}
        ${voted && nextCase ? '<button type="button" class="btn btn-secondary daily-next-btn" id="daily-court-next">다음 사건 판결하기</button>' : ''}
      </section>
      ${today.completed ? `<section class="daily-complete" aria-live="polite"><div class="daily-court-kicker">TODAY COMPLETE</div><strong>오늘의 3건 판결 완료</strong><p>${Number(today.correct || 0)}건 적중 · 총 ${Number(today.score || 0)}점으로 오늘 랭킹에 등록되었습니다.</p></section>` : ''}
      ${profileMarkup(data)}
      ${rankingsMarkup(data)}
      <div class="disclaimer"><strong>실제 판례 기반 콘텐츠</strong><br>${escapeHtml(gameCase.sourceNotice || '')} 사건관계인의 신상은 표시하지 않으며, 게임용 요약은 법률상담이나 법적 판단을 대신하지 않습니다.</div>
    </div>`;

  container.querySelectorAll('.daily-case-tab').forEach(button => {
    button.addEventListener('click', () => {
      activeCaseId = button.dataset.caseId || activeCaseId;
      renderGame(container, data);
    });
  });

  container.querySelectorAll('.daily-choice').forEach(button => {
    button.addEventListener('click', () => {
      if (voted) return;
      const choiceId = button.dataset.choiceId || '';
      selectedChoices.set(gameCase.id, choiceId);
      container.querySelectorAll('.daily-choice').forEach(item => item.classList.toggle('selected', item === button));
      const submit = container.querySelector('#daily-court-submit');
      if (submit) submit.disabled = !choiceId;
    });
  });

  container.querySelectorAll('.daily-evidence-btn').forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('revealed') || voted) return;
      const index = Number(button.dataset.evidenceIndex || 0);
      button.classList.add('revealed');
      button.disabled = true;
      button.textContent = `증거 ${index + 1} · ${gameCase.evidence[index] || ''}`;
      evidenceUsage.set(gameCase.id, Math.max(Number(evidenceUsage.get(gameCase.id) || 0), index + 1));
    });
  });

  const submit = container.querySelector('#daily-court-submit');
  if (submit) {
    submit.disabled = !selectedChoiceId;
    submit.addEventListener('click', async () => {
      const choiceId = String(selectedChoices.get(gameCase.id) || selectedChoiceId || '');
      if (!choiceId || submit.disabled) return;
      submit.disabled = true;
      const oldText = submit.textContent;
      submit.textContent = '실제 판결 대조 중...';
      try {
        const response = await submitDailyRealCourtVerdict({
          caseId: gameCase.id,
          selectedChoiceId: choiceId,
          evidenceUsed: Number(evidenceUsage.get(gameCase.id) || 0)
        });
        const next = nextUnvotedCase(response.data, gameCase.id);
        activeCaseId = next?.id || gameCase.id;
        renderGame(container, response.data);
        showToast(response.data?.votes?.[gameCase.id]?.correct ? '실제 판결을 맞혔습니다.' : '실제 판결과 비교 결과가 공개됐습니다.', 'success');
      } catch (error) {
        console.error('daily court submit failed:', error);
        submit.disabled = false;
        submit.textContent = oldText;
        showToast(errorMessage(error), 'error');
      }
    });
  }

  container.querySelector('#daily-court-next')?.addEventListener('click', () => {
    if (!nextCase) return;
    activeCaseId = nextCase.id;
    renderGame(container, data);
  });

  container.querySelectorAll('[data-ranking-tab]').forEach(button => {
    button.addEventListener('click', () => {
      activeRankingTab = button.dataset.rankingTab || 'weekly';
      container.querySelectorAll('[data-ranking-tab]').forEach(item => {
        const active = item.dataset.rankingTab === activeRankingTab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      container.querySelectorAll('[data-ranking-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.rankingPanel === activeRankingTab));
    });
  });
}

export async function renderDailyRealCourt(container) {
  ensureStyle();
  selectedChoices.clear();
  evidenceUsage.clear();
  activeCaseId = '';
  activeRankingTab = 'weekly';
  container.innerHTML = `<div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">오늘의 재판</span></div><div class="container" style="padding:70px 20px 100px;"><div class="loading-dots"><span></span><span></span><span></span></div></div>`;
  try {
    const response = await getDailyRealCourt();
    renderGame(container, response.data);
  } catch (error) {
    console.error('daily court load failed:', error);
    container.innerHTML = `<div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">오늘의 재판</span></div><div class="container" style="padding:60px 20px 100px;text-align:center;"><div class="card" style="padding:25px;"><div style="font-size:42px;margin-bottom:12px;">⚖️</div><div style="font-weight:900;color:var(--gold);margin-bottom:8px;">오늘의 판례를 준비하고 있습니다</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">${escapeHtml(errorMessage(error))}</div><button type="button" class="btn btn-secondary" id="daily-court-retry" style="margin-top:18px;">다시 불러오기</button></div></div>`;
    container.querySelector('#daily-court-retry')?.addEventListener('click', () => renderDailyRealCourt(container));
  }
}
