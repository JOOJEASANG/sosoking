import { auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const getDailyRealCourt = httpsCallable(functions, 'getDailyRealCourt');
const submitDailyRealCourtVerdict = httpsCallable(functions, 'submitDailyRealCourtVerdict');

let selectedChoiceId = '';
let evidenceUsed = 0;
let latestData = null;

function ensureStyle() {
  if (document.getElementById('daily-real-court-style')) return;
  const style = document.createElement('style');
  style.id = 'daily-real-court-style';
  style.textContent = `
    .daily-court-page{padding:22px 0 34px;}
    .daily-court-intro{margin-bottom:16px;padding:20px;border:1px solid rgba(201,168,76,.35);border-radius:18px;background:linear-gradient(135deg,rgba(201,168,76,.13),rgba(255,255,255,.025));}
    .daily-court-kicker{font-size:10px;font-weight:900;letter-spacing:.16em;color:var(--gold);margin-bottom:7px;}
    .daily-court-intro h1{font-size:23px;color:var(--cream);margin-bottom:7px;word-break:keep-all;}
    .daily-court-intro p{font-size:13px;color:var(--cream-dim);line-height:1.75;}
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
    .daily-profile{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;}
    .daily-profile-item{padding:13px 8px;border:1px solid var(--border);border-radius:13px;text-align:center;background:rgba(255,255,255,.025);}
    .daily-profile-value{font-family:var(--font-serif);font-size:20px;font-weight:900;color:var(--gold);}
    .daily-profile-label{font-size:10px;color:var(--cream-dim);margin-top:3px;}
    .daily-source{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--border);font-size:11px;color:var(--cream-dim);}
    .daily-source a{color:var(--gold);font-weight:800;text-decoration:none;}
    [data-theme="light"] .daily-fun-line{background:rgba(154,112,24,.06);}
    @media(max-width:420px){.daily-court-case{padding:19px 17px}.daily-profile{grid-template-columns:repeat(3,1fr)}.daily-result{padding:19px 17px}.daily-source{align-items:flex-start;flex-direction:column}.daily-court-intro h1{font-size:21px}}
  `;
  document.head.appendChild(style);
}

function errorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('unauthenticated')) return '로그인 후 오늘의 판결에 참여할 수 있습니다.';
  if (code.includes('failed-precondition')) return error?.message || '이메일 인증을 확인해주세요.';
  if (code.includes('unavailable')) return '오늘의 실제 판례를 준비하고 있습니다.';
  return '오늘의 재판을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function percentage(count, total) {
  return total > 0 ? Math.round((Number(count || 0) / total) * 100) : 0;
}

function profileMarkup(profile = {}) {
  const total = Number(profile.totalPlayed || 0);
  const correct = Number(profile.totalCorrect || 0);
  const accuracy = total ? Math.round(correct / total * 100) : 0;
  return `<div class="daily-profile">
    <div class="daily-profile-item"><div class="daily-profile-value">${Number(profile.currentStreak || 0)}일</div><div class="daily-profile-label">연속 출석</div></div>
    <div class="daily-profile-item"><div class="daily-profile-value">${accuracy}%</div><div class="daily-profile-label">판결 적중률</div></div>
    <div class="daily-profile-item"><div class="daily-profile-value">${Number(profile.totalScore || 0)}</div><div class="daily-profile-label">누적 점수</div></div>
  </div>`;
}

function resultMarkup(data) {
  const gameCase = data.gameCase;
  const reveal = data.reveal;
  const vote = data.vote;
  const stats = data.stats || { totalVotes: 0, counts: {} };
  if (!reveal || !vote) return '';
  return `<section class="daily-result" aria-live="polite">
    <div class="daily-result-score">
      <div><div class="daily-court-kicker">TODAY'S JUDGMENT SCORE</div><strong>${vote.correct ? '실제 판결 적중' : '실제 판결과 다름'}</strong></div>
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
    ${profileMarkup(data.profile)}
    <div class="daily-source">
      <span>${escapeHtml(reveal.court)} ${escapeHtml(reveal.decidedAt)} 선고 ${escapeHtml(reveal.caseNumber)}</span>
      <a href="${escapeHtml(reveal.sourceUrl)}" target="_blank" rel="noopener noreferrer">공식 판례 확인 ↗</a>
    </div>
  </section>`;
}

function renderGame(container, data) {
  latestData = data;
  const gameCase = data.gameCase;
  const voted = data.voted === true;
  selectedChoiceId = voted ? String(data.vote?.selectedChoiceId || '') : selectedChoiceId;
  evidenceUsed = voted ? Number(data.vote?.evidenceUsed || 0) : evidenceUsed;

  container.innerHTML = `
    <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">오늘의 재판</span></div>
    <div class="container daily-court-page">
      <section class="daily-court-intro">
        <div class="daily-court-kicker">REAL CASE · 하루 한 판</div>
        <h1>실제 법원은 어떻게 판단했을까요?</h1>
        <p>결론을 먼저 숨겼습니다. 증거를 확인하고 직접 판결한 뒤 실제 판례와 다른 이용자의 선택을 비교해보세요.</p>
      </section>
      <section class="card daily-court-case">
        <div class="daily-court-meta"><span class="daily-court-chip">${escapeHtml(data.dateKey)}</span><span class="daily-court-chip">${escapeHtml(gameCase.category || '실제 판례')}</span><span class="daily-court-chip">판례 ${Number(data.catalogSize || 0)}건 순환</span></div>
        <div class="daily-court-title">${escapeHtml(gameCase.title)}</div>
        <div class="daily-court-summary">${escapeHtml(gameCase.summary)}</div>
        <div class="daily-court-question">${escapeHtml(gameCase.question)}</div>
        <div class="daily-evidence">
          ${(gameCase.evidence || []).map((text, index) => `<button type="button" class="daily-evidence-btn${voted || index < evidenceUsed ? ' revealed' : ''}" data-evidence-index="${index}" ${voted || index < evidenceUsed ? 'disabled' : ''}>${voted || index < evidenceUsed ? `증거 ${index + 1} · ${escapeHtml(text)}` : `🔒 증거 ${index + 1} 열람하기 · 최대 점수 -15점`}</button>`).join('')}
        </div>
        <div class="daily-evidence-note">증거를 적게 볼수록 정답 점수가 높습니다. 실제 판결은 선택 후 공개됩니다.</div>
        <div class="daily-choice-list">
          ${gameCase.choices.map(choice => `<button type="button" class="daily-choice${selectedChoiceId === choice.id ? ' selected' : ''}" data-choice-id="${escapeHtml(choice.id)}" ${voted ? 'disabled' : ''}>${escapeHtml(choice.label)}</button>`).join('')}
        </div>
        ${voted ? '' : data.signedIn
          ? '<button type="button" class="btn btn-primary" id="daily-court-submit" disabled>이 판결로 선고하기</button>'
          : '<a href="#/auth" class="btn btn-primary">로그인하고 판결하기</a>'}
        ${resultMarkup(data)}
      </section>
      <div class="disclaimer"><strong>실제 판례 기반 콘텐츠</strong><br>${escapeHtml(gameCase.sourceNotice || '')} 사건관계인의 신상은 표시하지 않으며, 게임용 요약은 법률상담이나 법적 판단을 대신하지 않습니다.</div>
    </div>`;

  container.querySelectorAll('.daily-choice').forEach(button => {
    button.addEventListener('click', () => {
      if (voted) return;
      selectedChoiceId = button.dataset.choiceId || '';
      container.querySelectorAll('.daily-choice').forEach(item => item.classList.toggle('selected', item === button));
      const submit = container.querySelector('#daily-court-submit');
      if (submit) submit.disabled = !selectedChoiceId;
    });
  });

  container.querySelectorAll('.daily-evidence-btn').forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('revealed') || voted) return;
      const index = Number(button.dataset.evidenceIndex || 0);
      button.classList.add('revealed');
      button.disabled = true;
      button.textContent = `증거 ${index + 1} · ${gameCase.evidence[index] || ''}`;
      evidenceUsed = Math.max(evidenceUsed, index + 1);
    });
  });

  const submit = container.querySelector('#daily-court-submit');
  if (submit) {
    submit.disabled = !selectedChoiceId;
    submit.addEventListener('click', async () => {
      if (!selectedChoiceId || submit.disabled) return;
      submit.disabled = true;
      const oldText = submit.textContent;
      submit.textContent = '실제 판결 대조 중...';
      try {
        const response = await submitDailyRealCourtVerdict({ selectedChoiceId, evidenceUsed });
        renderGame(container, response.data);
        showToast(response.data?.vote?.correct ? '실제 판결을 맞혔습니다.' : '실제 판결과 비교 결과가 공개됐습니다.', 'success');
      } catch (error) {
        console.error('daily court submit failed:', error);
        submit.disabled = false;
        submit.textContent = oldText;
        showToast(errorMessage(error), 'error');
      }
    });
  }
}

export async function renderDailyRealCourt(container) {
  ensureStyle();
  selectedChoiceId = '';
  evidenceUsed = 0;
  latestData = null;
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
