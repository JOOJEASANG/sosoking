import { db, functions } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const generateJudgmentCallable = httpsCallable(functions, 'generateJudgment');

const TRIAL_STAGES = [
  ['사건 접수조서 개봉', '사건번호와 접수 내용을 대조하고 있습니다.'],
  ['수사관 현장 재구성', '행동 순서와 이상한 타이밍을 시간순으로 정리하고 있습니다.'],
  ['가상 CCTV·증거 감식', '예능용 가상 프레임과 엉뚱한 감식 수치를 작성하고 있습니다.'],
  ['검사·변호인 공방', '원고의 억울함과 피고의 뻔뻔한 항변을 분리하고 있습니다.'],
  ['재판부 판단·선고', '재판장 성격에 맞춰 주문의 수위를 올리고 있습니다.'],
];

function safe(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function paragraph(value) {
  return safe(value).replaceAll('\n', '<br>');
}

function legacyTrial(result) {
  if (result?.trialRecord) return result.trialRecord;
  if (!result?.caseTimeline || !result?.forensicReport) return null;
  return {
    resultVersion: result.resultVersion,
    docketNumber: result.docketNumber,
    courtName: result.courtName,
    courtroom: result.courtroom,
    division: result.division,
    recordClerk: result.recordClerk,
    analystName: result.analystName,
    prosecutorName: result.prosecutorName,
    defenderName: result.defenderName,
    judgeType: result.judgeType,
    refinedCaseTitle: result.caseTitle,
    expandedCase: result.reception || result.expandedCase,
    caseTimeline: result.caseTimeline,
    forensicReport: result.forensicReport,
    plaintiffArg: result.plaintiffArg,
    defendantArg: result.defendantArg,
    courtOpinion: result.courtOpinion,
    sentence: result.sentence,
    closingComment: result.closingComment,
    evidenceBits: result.evidenceBits || result.evidenceList || [],
    absurdDetails: result.absurdDetails || [],
    defendantExcuses: result.defendantExcuses || [],
    penaltyIdeas: result.penaltyIdeas || [],
  };
}

export async function loadJudgmentResult(caseId) {
  const publicSnapshot = await getDoc(doc(db, 'public_results', caseId));
  if (publicSnapshot.exists()) return { id: publicSnapshot.id, ...publicSnapshot.data() };
  const privateSnapshot = await getDoc(doc(db, 'results', caseId));
  return privateSnapshot.exists() ? { id: privateSnapshot.id, ...privateSnapshot.data() } : null;
}

export function trialPageHtml(caseId) {
  return `
    <section class="trial-page role-trial-progress">
      <div class="container trial-layout">
        <div class="trial-heading">
          <div class="eyebrow">황당재판 기록 작성 중</div>
          <h1>수사관부터 판사까지<br>전원 과몰입 중입니다</h1>
          <p>접수 내용을 먼저 파악한 뒤 수사기록, 가상 감식, 양측 공방과 최종 주문을 각각 다른 담당자가 작성합니다.</p>
        </div>
        <section class="card trial-card" data-case-id="${safe(caseId)}">
          <div class="court-orbit" aria-hidden="true"><span>⚖</span></div>
          <div class="trial-status-label" id="trial-status-label">기록철 배당 중</div>
          <h2 id="trial-status-title">접수조서를 열고 있습니다</h2>
          <p id="trial-status-copy">사건 식별번호 ${safe(caseId)}</p>
          <div class="trial-progress"><span id="trial-progress-bar"></span></div>
          <ol class="trial-stage-list" id="trial-stage-list">
            ${TRIAL_STAGES.map(([title, description], index) => `
              <li data-stage="${index}">
                <span class="trial-stage-index">${index + 1}</span>
                <span><strong>${safe(title)}</strong><small>${safe(description)}</small></span>
              </li>`).join('')}
          </ol>
          <div class="trial-error hidden" id="trial-error">
            <strong>재판 기록 작성이 잠시 중단됐습니다</strong>
            <p id="trial-error-message"></p>
            <button class="button button-primary" id="trial-retry" type="button">다시 수사하기</button>
          </div>
        </section>
      </div>
    </section>`;
}

function setStage(index) {
  const safeIndex = Math.max(0, Math.min(TRIAL_STAGES.length - 1, index));
  const [title, description] = TRIAL_STAGES[safeIndex];
  const label = document.getElementById('trial-status-label');
  const heading = document.getElementById('trial-status-title');
  const copy = document.getElementById('trial-status-copy');
  const bar = document.getElementById('trial-progress-bar');
  if (label) label.textContent = `${safeIndex + 1} / ${TRIAL_STAGES.length}`;
  if (heading) heading.textContent = title;
  if (copy) copy.textContent = description;
  if (bar) bar.style.width = `${((safeIndex + 1) / TRIAL_STAGES.length) * 100}%`;
  document.querySelectorAll('#trial-stage-list li').forEach((item, itemIndex) => {
    item.classList.toggle('active', itemIndex === safeIndex);
    item.classList.toggle('completed', itemIndex < safeIndex);
  });
}

export function startTrial(caseId, { onComplete, onError }) {
  let stageIndex = 0;
  let stopped = false;
  setStage(0);
  const timer = window.setInterval(() => {
    if (stageIndex < TRIAL_STAGES.length - 1) {
      stageIndex += 1;
      setStage(stageIndex);
    }
  }, 1800);

  const run = async () => {
    const errorBox = document.getElementById('trial-error');
    errorBox?.classList.add('hidden');
    try {
      const response = await generateJudgmentCallable({ caseId });
      if (stopped) return;
      window.clearInterval(timer);
      setStage(TRIAL_STAGES.length - 1);
      const label = document.getElementById('trial-status-label');
      const heading = document.getElementById('trial-status-title');
      const copy = document.getElementById('trial-status-copy');
      if (label) label.textContent = response.data.docketNumber || '선고 기록 완료';
      if (heading) heading.textContent = '황당재판 기록철이 완성됐습니다';
      if (copy) copy.textContent = String(response.data.generationMode || '').startsWith('gemini')
        ? '수사기록·가상 감식·법정공방·주문 작성을 마쳤습니다.'
        : '안전 대체 기록으로 재판철을 작성했습니다.';
      window.setTimeout(() => onComplete(response.data), 650);
    } catch (error) {
      if (stopped) return;
      window.clearInterval(timer);
      const message = error?.message || '재판 기록 작성 중 오류가 발생했습니다.';
      document.getElementById('trial-error-message').textContent = message;
      errorBox?.classList.remove('hidden');
      onError?.(error);
    }
  };

  document.getElementById('trial-retry')?.addEventListener('click', () => location.reload());
  run();
  return () => { stopped = true; window.clearInterval(timer); };
}

function listItems(items = [], className = '') {
  return items.map((item, index) => `<li class="${className}"><span>${String(index + 1).padStart(2, '0')}</span><p>${paragraph(item)}</p></li>`).join('');
}

function personnelRow(label, value) {
  return `<div><span>${safe(label)}</span><strong>${safe(value || '배정 기록 없음')}</strong></div>`;
}

function roleTrialResultHtml(result, trial) {
  const generationLabel = String(result.generationMode || '').startsWith('gemini') ? 'Gemini 역할분리 재판' : '안전 대체 재판기록';
  return `
    <section class="result-page role-trial-page">
      <div class="container result-shell role-trial-document">
        <header class="role-docket-cover card" id="share-card">
          <div class="role-docket-top"><span>${safe(trial.courtName || '소소킹 황당재판소')}</span><strong>사건 ${safe(trial.docketNumber || result.id || result.caseId)}</strong></div>
          <div class="role-docket-seal">判</div>
          <p class="role-docket-kicker">${safe(trial.division || '황당재판부')} 최종 기록철</p>
          <h1>${safe(trial.refinedCaseTitle || result.caseTitle || '황당사건')}</h1>
          <p class="role-docket-sub">${safe(trial.courtroom || '')} · ${safe(trial.judgeType || result.judgeType || 'AI 판사')} · ${safe(generationLabel)}</p>
        </header>

        <section class="card role-personnel-card">
          <div class="role-section-heading"><span>배당기록</span><h2>사건 담당자</h2></div>
          <div class="role-personnel-grid">
            ${personnelRow('기록 담당', trial.recordClerk)}
            ${personnelRow('수사·감식', trial.analystName)}
            ${personnelRow('원고 측', trial.prosecutorName)}
            ${personnelRow('피고 측', trial.defenderName)}
          </div>
        </section>

        <section class="card role-record-section reception-record">
          <div class="role-section-heading"><span>제1기록</span><h2>사건 접수 및 쟁점 정리</h2></div>
          <div class="role-document-text">${paragraph(trial.expandedCase)}</div>
          ${trial.absurdDetails?.length ? `<ol class="role-detail-list">${listItems(trial.absurdDetails)}</ol>` : ''}
        </section>

        <section class="card role-record-section timeline-record">
          <div class="role-section-heading"><span>제2기록 · ${safe(trial.analystName || '수사관')}</span><h2>수사 진행기록</h2></div>
          <div class="role-document-text role-monospace">${paragraph(trial.caseTimeline)}</div>
        </section>

        <section class="card role-record-section forensic-record">
          <div class="role-section-heading"><span>제3기록 · 예능용 가상 재구성</span><h2>CCTV·증거 감식보고서</h2></div>
          <div class="fiction-notice"><strong>가상 감식 주의</strong><span>아래 CCTV·시각·수치·증거 표현은 웃음을 위한 재구성이며 실제 확인 결과가 아닙니다.</span></div>
          <div class="role-document-text">${paragraph(trial.forensicReport)}</div>
          ${trial.evidenceBits?.length ? `<div class="role-evidence-grid">${trial.evidenceBits.map((item, index) => `<article><span>증 제${index + 1}호</span><p>${paragraph(item)}</p></article>`).join('')}</div>` : ''}
        </section>

        <section class="card role-record-section argument-record">
          <div class="role-section-heading"><span>제4기록</span><h2>검사·변호인 최종공방</h2></div>
          <div class="role-argument-grid">
            <article class="role-argument plaintiff"><span>${safe(trial.prosecutorName || '원고 측')}</span><h3>원고 측 주장</h3><p>${paragraph(trial.plaintiffArg)}</p></article>
            <div class="role-versus">VS</div>
            <article class="role-argument defendant"><span>${safe(trial.defenderName || '피고 측')}</span><h3>피고 측 변론</h3><p>${paragraph(trial.defendantArg)}</p></article>
          </div>
          ${trial.defendantExcuses?.length ? `<details class="role-inline-details"><summary>피고 측 예비 변명 ${trial.defendantExcuses.length}건</summary><ol>${listItems(trial.defendantExcuses)}</ol></details>` : ''}
        </section>

        <section class="card role-record-section opinion-record">
          <div class="role-section-heading"><span>제5기록 · ${safe(trial.judgeType || '재판부')}</span><h2>재판부 판단</h2></div>
          <div class="role-document-text opinion-text">${paragraph(trial.courtOpinion)}</div>
        </section>

        <section class="card role-sentence-section">
          <div class="role-section-heading"><span>최종선고</span><h2>주문</h2></div>
          <div class="role-sentence-text">${paragraph(trial.sentence)}</div>
          ${trial.penaltyIdeas?.length ? `<details class="role-inline-details"><summary>재판부가 검토한 다른 황당 처분</summary><ol>${listItems(trial.penaltyIdeas)}</ol></details>` : ''}
        </section>

        <section class="closing-panel role-closing"><span>재판장 마지막 한마디</span><strong>${safe(trial.closingComment || '이 사건은 종결됐지만 기록철의 민망함은 남는다.')}</strong></section>

        <div class="share-toolbar card"><div><strong>이 재판기록을 증거물로 남기세요</strong><span>링크를 공유하거나 대표 판결 이미지를 저장할 수 있습니다.</span></div><div class="share-actions"><button class="button" id="copy-result-link" type="button">링크 복사</button><button class="button" id="share-result" type="button">공유하기</button><button class="button button-primary" id="download-result-image" type="button">판결 이미지 저장</button></div></div>
        <details class="card original-case-details"><summary>실제 접수 원문 확인</summary><div><strong>${safe(result.caseTitle || '')}</strong><p>${paragraph(result.caseDescription || '')}</p></div></details>
        <p class="legal-notice">본 결과는 오락 콘텐츠입니다. 가상 CCTV·감식·수치 표현은 실제 사실확인이나 법률자료가 아닙니다.</p>
      </div>
    </section>`;
}

function orderCards(orders = []) {
  return orders.map(order => `<li><span>${safe(order.number)}</span><p>${paragraph(order.text)}</p></li>`).join('');
}

function compactResultHtml(result) {
  const judgment = result?.judgment || {};
  const analysis = result?.caseAnalysis || {};
  const comedyLines = Array.isArray(judgment.comedyLines) ? judgment.comedyLines : [];
  const orders = Array.isArray(judgment.orders) ? judgment.orders : [];
  const generationLabel = String(result?.generationMode || '').startsWith('gemini') ? 'Gemini 판결' : '안전 대체 판결';
  return `
    <section class="result-page"><div class="container result-shell">
      <header class="judgment-cover card" id="share-card"><div class="judgment-meta"><span>${safe(judgment.incidentLevel || '심리 완료')}</span><span>사건번호 ${safe(result.docketNumber || result.id || result.caseId || '')}</span></div><div class="judgment-seal">判</div><p class="judgment-kicker">소소킹 황당재판소 최종판결</p><h1>${safe(judgment.headline || result.caseTitle || '황당사건 판결')}</h1><p class="judgment-opening">${paragraph(judgment.opening || judgment.summary)}</p><div class="judgment-engine-label">${safe(generationLabel)} · ${safe(result.judgeType || 'AI')} 재판부</div></header>
      ${comedyLines.length ? `<section class="card result-section comedy-section"><div class="result-section-label">결정적 한마디</div><div class="comedy-grid">${comedyLines.map((line, index) => `<blockquote><span>0${index + 1}</span>${safe(line)}</blockquote>`).join('')}</div></section>` : ''}
      <section class="card result-section case-core-section"><div class="result-section-label">사건 분석</div><div class="case-core-grid"><div><span>행위자</span><strong>${safe(analysis.actor || result.defendantName || '피고 측')}</strong></div><div><span>핵심 대상</span><strong>${safe(analysis.target || '사건 대상')}</strong></div><div class="wide"><span>결정적 행동</span><strong>${safe(analysis.action || judgment.facts)}</strong></div><div class="wide"><span>실제 결과</span><strong>${safe(analysis.consequence || judgment.summary)}</strong></div></div></section>
      <section class="card result-section claim-section"><div class="result-section-label">법정공방</div><div class="claim-grid"><article class="claim-card plaintiff"><span>원고측 주장</span><p>${paragraph(judgment.plaintiffClaim)}</p></article><div class="versus">VS</div><article class="claim-card defendant"><span>피고측 반박</span><p>${paragraph(judgment.defendantClaim)}</p></article></div></section>
      <section class="result-two-column"><article class="card result-section"><div class="result-section-label">사건의 핵심</div><p class="result-body">${paragraph(judgment.facts)}</p></article><article class="card result-section"><div class="result-section-label">감식 결과</div><p class="result-body">${paragraph(judgment.investigation)}</p></article></section>
      <section class="card result-section opinion-section"><div class="result-section-label">재판부 최종 판단</div><p class="result-body opinion-body">${paragraph(judgment.opinion)}</p></section><section class="card result-section orders-section"><div class="result-section-label">주문</div><ol class="order-list">${orderCards(orders)}</ol></section><section class="closing-panel"><span>재판부 마지막 한마디</span><strong>“${safe(judgment.closingComment || '')}”</strong></section>
      <div class="share-toolbar card"><div><strong>이 판결을 증거물로 남기세요</strong><span>링크를 공유하거나 이미지로 저장할 수 있습니다.</span></div><div class="share-actions"><button class="button" id="copy-result-link" type="button">링크 복사</button><button class="button" id="share-result" type="button">공유하기</button><button class="button button-primary" id="download-result-image" type="button">판결 이미지 저장</button></div></div><details class="card original-case-details"><summary>접수 원문 확인</summary><div><strong>${safe(result.caseTitle || '')}</strong><p>${paragraph(result.caseDescription || '')}</p></div></details><p class="legal-notice">${safe(judgment.legalNotice || '본 결과는 오락 콘텐츠입니다.')}</p>
    </div></section>`;
}

export function resultPageHtml(result) {
  const trial = legacyTrial(result);
  return trial ? roleTrialResultHtml(result, trial) : compactResultHtml(result);
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  const tokens = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = token;
      if (lines.length >= maxLines) break;
    } else line = candidate;
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => context.fillText(item, x, y + (index * lineHeight)));
  return y + lines.length * lineHeight;
}

async function downloadResultImage(result) {
  await document.fonts?.ready;
  const judgment = result.judgment || {};
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#1b2238');
  gradient.addColorStop(1, '#0b0f1c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#d9ab55';
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, 968, 1238);
  ctx.fillStyle = '#f2c66d';
  ctx.font = '800 27px "Noto Sans KR", sans-serif';
  ctx.fillText(`소소킹 황당재판소 · ${result.docketNumber || '최종판결'}`, 92, 122);
  ctx.fillStyle = '#fff8eb';
  ctx.font = '900 54px "Noto Serif KR", serif';
  let y = wrapCanvasText(ctx, judgment.headline || result.caseTitle, 92, 220, 880, 76, 3);
  ctx.fillStyle = '#c8cedc';
  ctx.font = '500 27px "Noto Sans KR", sans-serif';
  y = wrapCanvasText(ctx, judgment.opening, 92, y + 38, 890, 45, 7);
  const comedy = Array.isArray(judgment.comedyLines) ? judgment.comedyLines.slice(0, 2) : [];
  y += 45;
  comedy.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? '#f2c66d' : '#ffffff';
    ctx.font = '800 31px "Noto Sans KR", sans-serif';
    y = wrapCanvasText(ctx, `“${line}”`, 92, y, 890, 48, 3) + 24;
  });
  ctx.strokeStyle = '#46506c';
  ctx.beginPath();
  ctx.moveTo(92, y + 10);
  ctx.lineTo(988, y + 10);
  ctx.stroke();
  ctx.fillStyle = '#f2c66d';
  ctx.font = '900 26px "Noto Sans KR", sans-serif';
  ctx.fillText('주문', 92, y + 66);
  ctx.fillStyle = '#eef0f5';
  ctx.font = '600 24px "Noto Sans KR", sans-serif';
  y += 115;
  (judgment.orders || []).slice(0, 3).forEach(order => { y = wrapCanvasText(ctx, `${order.number}. ${order.text}`, 92, y, 890, 39, 3) + 24; });
  ctx.fillStyle = '#9ea7bd';
  ctx.font = '500 20px "Noto Sans KR", sans-serif';
  ctx.fillText('CCTV·감식 표현은 오락용 가상 재구성입니다 · sosoking.co.kr', 92, 1240);
  const link = document.createElement('a');
  link.download = `소소킹-판결-${result.docketNumber || result.id || result.caseId || 'result'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function bindResultActions(result, showToast) {
  const url = `${location.origin}${location.pathname}#/result/${encodeURIComponent(result.id || result.caseId)}`;
  const shareData = { title: result.judgment?.headline || '소소킹 황당재판소 판결', text: result.trialRecord?.closingComment || result.judgment?.comedyLines?.[0] || result.judgment?.summary || '', url };
  document.getElementById('copy-result-link')?.addEventListener('click', async () => { await navigator.clipboard.writeText(url); showToast('판결 링크를 복사했습니다.'); });
  document.getElementById('share-result')?.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) { if (error?.name !== 'AbortError') showToast('공유하지 못했습니다.', 'error'); }
    } else { await navigator.clipboard.writeText(url); showToast('공유 기능 대신 링크를 복사했습니다.'); }
  });
  document.getElementById('download-result-image')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = '이미지 만드는 중...';
    try { await downloadResultImage(result); showToast('판결 이미지를 저장했습니다.'); }
    catch { showToast('이미지를 만들지 못했습니다.', 'error'); }
    finally { button.disabled = false; button.textContent = original; }
  });
}
