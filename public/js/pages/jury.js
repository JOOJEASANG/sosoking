// 민심소 — 판결소가 AI의 판결이라면, 민심소는 사람들의 판결이다.
//
// 다른 사람의 사건을 판결문 없이 먼저 읽고 원고/피고 중 한쪽을 고른다.
// 투표하는 순간 AI 판사의 판결이 열리고, 내 판단과 민심과 AI가 어떻게 갈렸는지 보여준다.
// 표는 이미 있는 voteResult callable과 result_reactions 컬렉션을 그대로 쓴다.

import { db, auth, functions } from '../firebase.js?v=20260630-3';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';
import { loadSafePublicResults } from '../utils/public-results.js?v=20260730-public-records-2';
import { jurySeenSet, markJurySeen } from '../utils/jury-seen.js?v=20260829-jury-content-1';
import { showToast } from '../components/toast.js?v=20260630-3';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const SIDE_LABEL = {
  plaintiff: '원고 승',
  defendant: '피고 승',
  both: '쌍방 과실'
};

// 댓글논쟁에서 내 입장을 표시할 때 쓰는 짧은 이름. 투표한 쪽이 곧 내 입장이 된다.
const STANCE_LABEL = {
  plaintiff: '원고측',
  defendant: '피고측',
  both: '쌍방'
};
const COMMENT_LIMIT = 60;

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}



// 판정 기록은 이 브라우저에만 남긴다. 서버에 쌓을 만큼 중요한 값이 아니고,
// 로그인 없이 한 번 들렀다 가는 사람도 기록이 보여야 재미가 붙는다.
function readScore() {
  try {
    const raw = JSON.parse(localStorage.getItem('sosoking-jury-score') || '{}');
    return {
      total: Number(raw.total) || 0,
      hit: Number(raw.hit) || 0,
      streak: Number(raw.streak) || 0,
      best: Number(raw.best) || 0
    };
  } catch {
    return { total: 0, hit: 0, streak: 0, best: 0 };
  }
}

function writeScore(score) {
  try {
    localStorage.setItem('sosoking-jury-score', JSON.stringify(score));
  } catch {
    /* 저장이 막혀 있어도 판정 자체는 계속 되어야 한다. */
  }
}

// AI 판결과 일치했는지에 따라 기록을 갱신한다.
// 승패가 기록되지 않은 옛 사건은 적중 판정에서 제외한다.
function updateScore(agreed, comparable) {
  const score = readScore();
  if (!comparable) return score;
  score.total += 1;
  if (agreed) {
    score.hit += 1;
    score.streak += 1;
    score.best = Math.max(score.best, score.streak);
  } else {
    score.streak = 0;
  }
  writeScore(score);
  return score;
}

function renderScoreboard() {
  const slot = document.getElementById('jury-scoreboard');
  if (!slot) return;
  const { total, hit, streak, best } = readScore();
  if (!total) {
    slot.innerHTML = '<span class="jury-score-empty">아직 판정 기록이 없습니다. 첫 판정을 내려보세요.</span>';
    return;
  }
  const rate = Math.round((hit / total) * 100);
  slot.innerHTML = `
    <span class="jury-score-item"><b>${total}</b>건 판정</span>
    <span class="jury-score-item">AI와 일치 <b>${rate}%</b></span>
    <span class="jury-score-item">연속 <b>${streak}</b>${best > streak ? ` (최고 ${best})` : ''}</span>`;
}



function pickCase(rows) {
  const seen = jurySeenSet();
  const fresh = rows.filter(([id, data]) => !seen.has(id) && (data?.plaintiffArg || data?.publicCaseDescription));
  const pool = fresh.length ? fresh : rows;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 소제목(접수취지 등)은 걷어내고 본문 문단만 이어 붙인다. 투표 판단에 필요한
// 정보는 충분히 보여주되, 지나치게 길면 상한에서 자른다.
const JURY_SUBHEADINGS = /^(접수취지|사건개요|접수의견|확인 정황|주요 증거|진술 검토|조사관 의견|청구취지|주장요지|피해 및 요구사항|답변취지|항변요지|피고측 최종의견|주문|판단이유|재판부 의견)\s*$/;

function readableBody(text, maxLen = 1400) {
  const paras = String(text || '')
    .split(/\n{2,}|\n/)
    .map(part => part.trim())
    .filter(part => part && !JURY_SUBHEADINGS.test(part));
  const joined = paras.join('\n\n');
  return joined.length > maxLen ? `${joined.slice(0, maxLen).trim()}…` : joined;
}

// 문단을 <p>로 감싸 escape 후 렌더링한다.
function paragraphsHtml(text, maxLen) {
  const body = readableBody(text, maxLen);
  if (!body) return '';
  return body.split(/\n{2,}/).map(part => `<p>${escapeHtml(part)}</p>`).join('');
}

// 공개 화면에서 AI가 왜 그렇게 판결했는지 판단이유·주문 발췌를 보여준다.
// 승패만 알려주면 '왜'가 빠져 재미가 반감된다. 전문은 링크로 이어간다.
function verdictExcerptHtml(data) {
  const body = readableBody(data?.verdict, 700);
  if (!body) return '';
  const paras = body.split(/\n{2,}/).map(part => `<p>${escapeHtml(part)}</p>`).join('');
  return `<div class="jury-verdict-excerpt"><span class="jury-side-tag jury-side-verdict">AI 재판부 판결</span>${paras}</div>`;
}

function verdictWinner(data) {
  const raw = String(data?.winner || '').toLowerCase();
  return ['plaintiff', 'defendant', 'both'].includes(raw) ? raw : '';
}

function tallyBar(counts, total) {
  const rows = ['plaintiff', 'defendant', 'both'].map(side => {
    const count = Number(counts?.[side] || 0);
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="jury-tally-row">
        <span class="jury-tally-label">${SIDE_LABEL[side]}</span>
        <span class="jury-tally-track"><i style="width:${percent}%"></i></span>
        <span class="jury-tally-value">${percent}%</span>
      </div>`;
  }).join('');
  return `<div class="jury-tally">${rows}</div>`;
}

export async function renderJury(container) {
  container.innerHTML = `
    <div class="jury-page">
      <div class="page-header"><a href="#/" class="back-btn">‹</a><span class="logo">민심소</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div class="jury-intro">
          <div class="jury-intro-title">가려진 판결을 먼저 맞혀보세요</div>
          <p class="jury-intro-copy">
            사건 목록에서 하나를 골라 사건 개요와 양측 주장을 읽고 한쪽에 투표하면,
            <strong>가려졌던 AI 판사의 판결과 민심 집계가 열리고</strong> 그 자리에서 논쟁까지 이어집니다.
          </p>
          <div class="jury-scoreboard" id="jury-scoreboard"></div>
        </div>
        <div id="jury-slot"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  renderScoreboard();
  await loadJuryList(container);
}

// 판정할 수 있는 공개 사건을 모은다. (양측 주장 또는 접수 내용이 있어야 판단 가능)
async function loadJuryRows() {
  const rows = await loadSafePublicResults(db, { maxRows: 60, fallbackRows: 120 });
  return rows.filter(([, data]) => data?.plaintiffArg || data?.publicCaseDescription || data?.reception);
}

// 예전 판결기록처럼 사건을 목록으로 훑어보게 한다. 카드에는 판결을 절대 노출하지
// 않는다(블라인드 유지). 이미 판정한 사건은 '판정 완료'로 표시만 하고 목록에는
// 그대로 남겨, 다시 열어 판결·논쟁을 볼 수 있게 한다.
async function loadJuryList(container) {
  const slot = container.querySelector('#jury-slot');
  if (!slot) return;
  slot.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  renderScoreboard();

  let rows;
  try {
    rows = await loadJuryRows();
  } catch (error) {
    console.error('jury list load failed:', error);
    slot.innerHTML = `
      <div class="card jury-empty">
        <p>사건을 불러오지 못했습니다.</p>
        <button type="button" class="btn btn-primary" id="jury-retry">다시 시도</button>
      </div>`;
    slot.querySelector('#jury-retry')?.addEventListener('click', () => loadJuryList(container));
    return;
  }
  if (!container.isConnected) return;

  if (!rows.length) {
    slot.innerHTML = `
      <div class="card jury-empty">
        <p>아직 공개된 사건이 없습니다.</p>
        <a class="btn btn-primary" href="#/submit">첫 사건 접수하기</a>
      </div>`;
    return;
  }

  const seen = jurySeenSet();
  const cards = rows.map(([caseId, data]) => juryListCard(caseId, data, seen.has(caseId))).join('');
  slot.innerHTML = `
    <div class="jury-list-head">사건 ${rows.length}건 · 하나를 골라 판정해보세요</div>
    <div class="jury-list">${cards}</div>`;

  slot.querySelectorAll('.jury-list-card').forEach(cardEl => {
    cardEl.addEventListener('click', () => {
      const caseId = cardEl.dataset.caseId;
      const row = rows.find(([id]) => id === caseId);
      if (row) openCase(container, row[0], row[1]);
    });
  });
}

function juryListCard(caseId, data, judged) {
  const title = escapeHtml(data?.caseTitle || '생활분쟁 사건');
  const icon = escapeHtml(data?.judgeIcon || '⚖️');
  const judgeType = escapeHtml(data?.judgeType || '소소킹 AI 재판부');
  const grievance = Math.max(1, Math.min(10, Number(data?.grievanceIndex) || 5));
  return `
    <button type="button" class="jury-list-card${judged ? ' judged' : ''}" data-case-id="${escapeHtml(caseId)}">
      <div class="jury-list-main">
        <div class="jury-list-title">${title}</div>
        <div class="jury-list-meta">
          <span class="jury-list-judge">${icon} ${judgeType} 판사</span>
          <span class="jury-list-grievance">억울지수 ${grievance}/10</span>
        </div>
      </div>
      <span class="jury-list-cta">${judged ? '판정 완료 · 다시 보기' : '판정하기 ›'}</span>
    </button>`;
}

// 목록에서 사건 하나를 열어 블라인드 판정 → 결과 확인 → 논쟁까지 진행한다.
// 이미 투표한 사건이면 서버에 남은 내 표를 읽어 결과를 바로 열어준다(점수는 다시 집계하지 않음).
async function openCase(container, caseId, data) {
  const slot = container.querySelector('#jury-slot');
  if (!slot) return;
  slot.innerHTML = `
    <div class="jury-backrow"><button type="button" class="jury-back-btn" id="jury-back">‹ 사건 목록으로</button></div>
    <div id="jury-case"><div class="loading-dots"><span></span><span></span><span></span></div></div>`;
  slot.querySelector('#jury-back')?.addEventListener('click', () => loadJuryList(container));
  const caseSlot = slot.querySelector('#jury-case');
  container.querySelector('.jury-page')?.scrollIntoView({ block: 'start' });

  let priorSide = '';
  const user = auth.currentUser;
  if (user && !user.isAnonymous) {
    try {
      const voteSnap = await getDoc(doc(db, `result_reactions/${caseId}/votes/${user.uid}`));
      if (voteSnap.exists()) priorSide = String(voteSnap.data().reaction || '');
    } catch (error) {
      console.warn('jury prior vote load failed:', error?.code || error);
    }
  }
  if (!caseSlot.isConnected) return;

  if (['plaintiff', 'defendant', 'both'].includes(priorSide)) {
    revealVerdict(container, caseSlot, caseId, data, priorSide, { recordScore: false });
  } else {
    renderCaseCard(container, caseSlot, [caseId, data]);
  }
}

// '다음 사건' — 아직 판정하지 않은 사건을 하나 골라 바로 연다.
async function openRandomUnseen(container) {
  const slot = container.querySelector('#jury-slot');
  if (slot) slot.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  let rows = [];
  try {
    rows = await loadJuryRows();
  } catch (error) {
    console.error('jury next load failed:', error);
  }
  const picked = pickCase(rows);
  if (!picked) {
    loadJuryList(container);
    return;
  }
  openCase(container, picked[0], picked[1]);
}

function renderCaseCard(container, slot, [caseId, data]) {
  const title = escapeHtml(data?.caseTitle || '생활분쟁 사건');
  // 사건 개요는 접수 문서(없으면 원본 접수 내용)에서, 양측 주장은 전체를 보여준다.
  // 판결·판단이유·주문은 투표 뒤에만 공개한다.
  const overview = paragraphsHtml(data?.reception || data?.publicCaseDescription, 900);
  const plaintiff = paragraphsHtml(data?.plaintiffArg, 1400);
  const defendant = paragraphsHtml(data?.defendantArg, 1400);

  slot.innerHTML = `
    <article class="card jury-card">
      <div class="jury-case-title">${title}</div>
      ${overview ? `<div class="jury-overview"><span class="jury-side-tag jury-side-overview">사건 개요</span>${overview}</div>` : ''}
      <div class="jury-side">
        <span class="jury-side-tag jury-side-plaintiff">원고측 주장</span>
        ${plaintiff || '<p>주장이 기록되지 않았습니다.</p>'}
      </div>
      <div class="jury-side">
        <span class="jury-side-tag jury-side-defendant">피고측 항변</span>
        ${defendant || '<p>항변이 기록되지 않았습니다.</p>'}
      </div>
      <div class="jury-vote-prompt">판결문은 아직 가려져 있습니다. 누구 손을 들어주시겠습니까?</div>
      <div class="jury-vote-buttons">
        <button type="button" class="btn jury-vote-btn" data-side="plaintiff">원고 승</button>
        <button type="button" class="btn jury-vote-btn" data-side="defendant">피고 승</button>
        <button type="button" class="btn jury-vote-btn" data-side="both">쌍방 과실</button>
      </div>
      <p class="jury-note" id="jury-note"></p>
    </article>`;

  slot.querySelectorAll('.jury-vote-btn').forEach(button => {
    button.addEventListener('click', () => castVote(container, slot, caseId, data, button.dataset.side));
  });
}

async function castVote(container, slot, caseId, data, side) {
  const note = slot.querySelector('#jury-note');
  const buttons = [...slot.querySelectorAll('.jury-vote-btn')];
  buttons.forEach(button => { button.disabled = true; });

  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    if (note) {
      note.innerHTML = '표를 기록하려면 로그인이 필요합니다. <a href="#/auth">로그인하기</a>';
    }
    buttons.forEach(button => { button.disabled = false; });
    return;
  }

  if (note) note.textContent = '표를 접수하는 중입니다…';

  try {
    await httpsCallable(functions, 'voteResult')({ caseId, reaction: side });
  } catch (error) {
    console.error('jury vote failed:', error);
    if (note) note.textContent = '표를 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    buttons.forEach(button => { button.disabled = false; });
    return;
  }

  markJurySeen(caseId);
  await revealVerdict(container, slot, caseId, data, side);
}

async function revealVerdict(container, slot, caseId, data, mySide, { recordScore = true } = {}) {
  let counts = {};
  let total = 0;
  try {
    const snapshot = await getDoc(doc(db, `result_reactions/${caseId}`));
    if (snapshot.exists()) {
      const summary = snapshot.data();
      counts = summary?.counts || {};
      total = ['plaintiff', 'defendant', 'both']
        .reduce((sum, side) => sum + Number(counts?.[side] || 0), 0);
    }
  } catch (error) {
    console.warn('jury tally load failed:', error);
  }

  const aiSide = verdictWinner(data);
  const agreed = Boolean(aiSide) && aiSide === mySide;
  // 새 투표일 때만 연속 적중 기록을 갱신한다. 이미 판정한 사건을 다시 열 때는 집계하지 않는다.
  const score = recordScore ? updateScore(agreed, Boolean(aiSide)) : readScore();

  const headline = aiSide
    ? (agreed
      ? `AI 판사도 <strong>${SIDE_LABEL[aiSide]}</strong>을 선택했습니다.`
      : `AI 판사는 <strong>${SIDE_LABEL[aiSide]}</strong>을 선택했습니다.`)
    : '이 사건은 AI 판결의 승패가 기록되기 전에 접수된 사건입니다.';

  const majority = ['plaintiff', 'defendant', 'both']
    .reduce((top, side) => (Number(counts?.[side] || 0) > Number(counts?.[top] || 0) ? side : top), 'plaintiff');
  const majorityPercent = total > 0 ? Math.round((Number(counts?.[majority] || 0) / total) * 100) : 0;

  slot.innerHTML = `
    <article class="card jury-card jury-result">
      <div class="jury-verdict-badge${agreed ? ' jury-verdict-agree' : ''}">
        ${aiSide ? (agreed ? '민심과 판결이 일치' : '민심과 판결이 엇갈림') : '판결 기록 없음'}
      </div>
      <div class="jury-case-title">${escapeHtml(data?.caseTitle || '생활분쟁 사건')}</div>
      ${mySide ? `<p class="jury-reveal-line">당신의 선택은 <strong>${SIDE_LABEL[mySide]}</strong>이었습니다.</p>` : ''}
      <p class="jury-reveal-line">${headline}</p>
      ${total > 0
        ? `<p class="jury-reveal-line">배심원 ${total}명 중 <strong>${majorityPercent}%</strong>가 ${SIDE_LABEL[majority]}을 택했습니다.</p>${tallyBar(counts, total)}`
        : '<p class="jury-reveal-line">이 사건의 첫 배심원입니다.</p>'}
      ${recordScore && aiSide && score.total
        ? `<p class="jury-score-line">${agreed
            ? `${score.streak}연속 적중 중입니다.`
            : '연속 기록이 끊겼습니다.'} 지금까지 ${score.total}건 중 ${Math.round((score.hit / score.total) * 100)}% 일치.</p>`
        : ''}
      ${verdictExcerptHtml(data)}
      <div class="jury-debate" id="jury-debate">
        <div class="jury-debate-head">
          <span class="jury-debate-title">이 판결, 어떻게 보세요?</span>
          <span class="jury-debate-mystance">내 입장 · <strong>${STANCE_LABEL[mySide]}</strong></span>
        </div>
        <div class="jury-debate-form">
          <textarea id="jury-comment-input" class="form-textarea" maxlength="600" rows="3"
            placeholder="${escapeHtml(STANCE_LABEL[mySide])} 입장에서 왜 그렇게 판단했는지 적어보세요."></textarea>
          <div class="jury-debate-form-foot">
            <span class="jury-debate-hint">개인정보·욕설·실명 언급은 제한됩니다.</span>
            <span id="jury-comment-count">0/600</span>
          </div>
          <button type="button" class="btn btn-primary" id="jury-comment-submit">논쟁에 참여</button>
        </div>
        <div class="jury-debate-list" id="jury-debate-list">
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
      <div class="jury-actions">
        <a class="btn" href="#/result/${encodeURIComponent(caseId)}">판결문 전문 보기</a>
        <button type="button" class="btn" id="jury-to-list">사건 목록으로</button>
        <button type="button" class="btn btn-primary" id="jury-next">다음 사건 판정</button>
      </div>
    </article>`;

  slot.querySelector('#jury-to-list')?.addEventListener('click', () => loadJuryList(container));
  slot.querySelector('#jury-next')?.addEventListener('click', () => {
    renderScoreboard();
    openRandomUnseen(container);
  });

  wireDebate(container, slot, caseId, mySide);
}

// 투표 뒤 같은 화면에서 바로 댓글논쟁을 벌인다. 입장(stance)은 방금 투표한 쪽으로
// 고정한다. 판결기록 시절 흩어져 있던 토론을 민심소 한 곳으로 합친 것이다.
function fmtCommentDate(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function commentsHtml(comments) {
  if (!comments.length) {
    return '<div class="jury-debate-empty">아직 논쟁이 없습니다. 첫 의견을 남겨보세요.</div>';
  }
  return comments.map(comment => {
    const stance = STANCE_LABEL[String(comment.stance || '')];
    const badge = stance
      ? `<span class="jury-comment-stance">${escapeHtml(stance)}</span>`
      : '';
    return `<article class="jury-comment">
      <div class="jury-comment-head">
        <span class="jury-comment-author">${escapeHtml(comment.nickname || '익명 배심원')}</span>
        ${badge}
        <time class="jury-comment-date">${escapeHtml(fmtCommentDate(comment.createdAt))}</time>
      </div>
      <div class="jury-comment-text">${escapeHtml(comment.text || '')}</div>
    </article>`;
  }).join('');
}

async function loadComments(caseId, listEl) {
  if (!listEl) return;
  try {
    const snapshot = await getDocs(query(
      collection(db, `court_comments/${caseId}/items`),
      orderBy('createdAt', 'desc'),
      limit(COMMENT_LIMIT)
    ));
    const comments = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    listEl.innerHTML = commentsHtml(comments);
  } catch (error) {
    console.warn('jury comments load failed:', error?.code || error);
    listEl.innerHTML = '<div class="jury-debate-empty">논쟁을 불러오지 못했습니다.</div>';
  }
}

function wireDebate(container, slot, caseId, mySide) {
  const input = slot.querySelector('#jury-comment-input');
  const counter = slot.querySelector('#jury-comment-count');
  const submit = slot.querySelector('#jury-comment-submit');
  const listEl = slot.querySelector('#jury-debate-list');

  loadComments(caseId, listEl);

  input?.addEventListener('input', () => {
    if (counter) counter.textContent = `${input.value.length}/600`;
  });

  submit?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
      showToast('로그인한 회원만 논쟁에 참여할 수 있습니다.', 'error');
      location.hash = '#/auth';
      return;
    }
    const text = input?.value.trim() || '';
    if (text.length < 2) {
      showToast('의견을 2자 이상 입력해주세요.', 'error');
      input?.focus();
      return;
    }
    const oldLabel = submit.textContent;
    submit.disabled = true;
    submit.textContent = '등록 중…';
    try {
      await httpsCallable(functions, 'addDiscussionComment')({ caseId, stance: mySide, text });
      if (input) {
        input.value = '';
        if (counter) counter.textContent = '0/600';
      }
      showToast('논쟁에 참여했습니다.', 'success');
      await loadComments(caseId, listEl);
    } catch (error) {
      console.error('jury comment submit failed:', error);
      showToast(String(error?.message || '등록에 실패했습니다.').replace(/^FirebaseError:\s*/, '').slice(0, 200), 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = oldLabel;
    }
  });
}
