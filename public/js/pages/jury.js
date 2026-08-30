// 민심소 — 공개 사건의 AI 판결을 가린 채 먼저 판단하고, 투표 뒤 결과와 토론을 연다.

import { db, auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
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

const JURY_TARGET_KEY = 'sosoking-jury-target-case';
const SIDE_LABEL = { plaintiff: '원고 승', defendant: '피고 승', both: '쌍방 과실' };
const STANCE_LABEL = { plaintiff: '원고측', defendant: '피고측', both: '쌍방' };
const COMMENT_LIMIT = 60;
const SCORE_KEY = 'sosoking-jury-score';
const JURY_SUBHEADINGS = /^(접수취지|사건개요|접수의견|확인 정황|주요 증거|진술 검토|조사관 의견|청구취지|주장요지|피해 및 요구사항|답변취지|항변요지|피고측 최종의견|주문|판단이유|재판부 의견)\s*$/;

function readScore() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCORE_KEY) || '{}');
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
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(score)); } catch {}
}

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

function renderScoreboard(container) {
  const slot = container.querySelector('#jury-scoreboard');
  if (!slot) return;
  const { total, hit, streak, best } = readScore();
  if (!total) {
    slot.innerHTML = '<span class="jury-score-empty">아직 판정 기록이 없습니다. 첫 판정을 내려보세요.</span>';
    return;
  }
  const rate = Math.round((hit / total) * 100);
  slot.innerHTML = `<span class="jury-score-item"><b>${total}</b>건 판정</span><span class="jury-score-item">AI와 일치 <b>${rate}%</b></span><span class="jury-score-item">연속 <b>${streak}</b>${best > streak ? ` · 최고 ${best}` : ''}</span>`;
}

function readableBody(text, maxLen = 1400) {
  const paragraphs = String(text || '')
    .split(/\n{2,}|\n/)
    .map(part => part.trim())
    .filter(part => part && !JURY_SUBHEADINGS.test(part));
  const joined = paragraphs.join('\n\n');
  return joined.length > maxLen ? `${joined.slice(0, maxLen).trim()}…` : joined;
}

function paragraphsHtml(text, maxLen) {
  const body = readableBody(text, maxLen);
  if (!body) return '<p>공개된 사건 설명이 없습니다.</p>';
  return body.split(/\n{2,}/).map(part => `<p>${escapeHtml(part)}</p>`).join('');
}

function verdictWinner(data = {}) {
  const raw = String(data.winner || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(SIDE_LABEL, raw) ? raw : '';
}

function validGrievance(data = {}) {
  const value = Number(data.grievanceIndex);
  return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null;
}

function juryListCard(caseId, data, judged) {
  const grievance = validGrievance(data);
  return `
    <button type="button" class="jury-list-card${judged ? ' judged' : ''}" data-case-id="${escapeHtml(caseId)}">
      <div class="jury-list-main">
        <div class="jury-list-title">${escapeHtml(data.caseTitle || '생활분쟁 사건')}</div>
        <div class="jury-list-meta">
          <span class="jury-list-judge">${escapeHtml(data.judgeIcon || '⚖️')} ${escapeHtml(data.judgeType || '소소킹 AI 재판부')} 판사</span>
          ${grievance !== null ? `<span class="jury-list-grievance">억울지수 ${grievance}/10</span>` : ''}
        </div>
      </div>
      <span class="jury-list-cta">${judged ? '판정 완료 · 다시 보기' : '판정하기 ›'}</span>
    </button>`;
}

async function loadJuryRows() {
  const rows = await loadSafePublicResults(db, { maxRows: 60, fallbackRows: 120 });
  return rows.filter(([, data]) => data?.plaintiffArg || data?.defendantArg || data?.publicCaseDescription || data?.reception);
}

function consumeRequestedCaseId() {
  try {
    const value = sessionStorage.getItem(JURY_TARGET_KEY) || '';
    sessionStorage.removeItem(JURY_TARGET_KEY);
    return value;
  } catch {
    return '';
  }
}

export async function renderJury(container) {
  container.innerHTML = `
    <div class="jury-page">
      <div class="page-header"><a href="#/" class="back-btn" aria-label="홈으로 돌아가기">‹</a><span class="logo">민심소</span></div>
      <div class="container" style="padding-top:22px;padding-bottom:90px;">
        <div class="jury-intro">
          <div class="jury-intro-title">가려진 판결을 먼저 맞혀보세요</div>
          <p class="jury-intro-copy">사건 기록과 양측 주장을 먼저 읽고 <strong>원고 승·피고 승·쌍방 과실</strong> 중 하나를 고르면, 가려졌던 AI 판결과 전체 민심 집계가 열립니다.</p>
          <div class="jury-scoreboard" id="jury-scoreboard"></div>
        </div>
        <div id="jury-slot"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  renderScoreboard(container);
  await loadJuryList(container, consumeRequestedCaseId());
}

async function loadJuryList(container, requestedCaseId = '') {
  const slot = container.querySelector('#jury-slot');
  if (!slot) return;
  slot.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  let rows;
  try {
    rows = await loadJuryRows();
  } catch (error) {
    console.error('jury list load failed:', error);
    slot.innerHTML = '<div class="card jury-empty"><p>사건을 불러오지 못했습니다.</p><button type="button" class="btn btn-primary" id="jury-retry">다시 시도</button></div>';
    slot.querySelector('#jury-retry')?.addEventListener('click', () => loadJuryList(container));
    return;
  }
  if (!container.isConnected) return;

  if (!rows.length) {
    slot.innerHTML = '<div class="card jury-empty"><p>아직 공개된 사건이 없습니다.</p><a class="btn btn-primary" href="#/submit">첫 사건 접수하기</a></div>';
    return;
  }

  const requested = requestedCaseId ? rows.find(([id]) => id === requestedCaseId) : null;
  if (requested) {
    await openCase(container, requested[0], requested[1]);
    return;
  }

  const seen = jurySeenSet();
  slot.innerHTML = `<div class="jury-list-head">공개 사건 ${rows.length}건 · 판결은 투표 전까지 가려집니다</div><div class="jury-list">${rows.map(([caseId, data]) => juryListCard(caseId, data, seen.has(caseId))).join('')}</div>`;
  slot.querySelectorAll('.jury-list-card').forEach(button => {
    button.addEventListener('click', () => {
      const caseId = String(button.dataset.caseId || '');
      const row = rows.find(([id]) => id === caseId);
      if (row) void openCase(container, row[0], row[1]);
    });
  });
}

async function priorVoteFor(caseId) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return '';
  try {
    const snapshot = await getDoc(doc(db, `result_reactions/${caseId}/votes/${user.uid}`));
    const reaction = snapshot.exists() ? String(snapshot.data().reaction || '') : '';
    return Object.prototype.hasOwnProperty.call(SIDE_LABEL, reaction) ? reaction : '';
  } catch (error) {
    console.warn('jury prior vote load failed:', error?.code || error);
    return '';
  }
}

async function openCase(container, caseId, data) {
  const slot = container.querySelector('#jury-slot');
  if (!slot) return;
  slot.innerHTML = '<div class="jury-backrow"><button type="button" class="jury-back-btn" id="jury-back">‹ 사건 목록으로</button></div><div id="jury-case"><div class="loading-dots"><span></span><span></span><span></span></div></div>';
  slot.querySelector('#jury-back')?.addEventListener('click', () => loadJuryList(container));
  const caseSlot = slot.querySelector('#jury-case');
  const prior = await priorVoteFor(caseId);
  if (!caseSlot?.isConnected) return;
  if (prior) await revealVerdict(container, caseSlot, caseId, data, prior, { recordScore: false });
  else renderCaseCard(container, caseSlot, caseId, data);
}

function renderCaseCard(container, slot, caseId, data) {
  slot.innerHTML = `
    <div class="card jury-card">
      <div class="jury-case-title">${escapeHtml(data.caseTitle || '생활분쟁 사건')}</div>
      <div class="jury-overview"><span class="jury-side-tag jury-side-overview">사건 기록</span>${paragraphsHtml(data.publicCaseDescription || data.reception || data.investigation, 1200)}</div>
      <div class="jury-side"><span class="jury-side-tag jury-side-plaintiff">원고측</span>${paragraphsHtml(data.plaintiffArg, 1000)}</div>
      <div class="jury-side"><span class="jury-side-tag jury-side-defendant">피고측</span>${paragraphsHtml(data.defendantArg, 1000)}</div>
      <div class="jury-vote-prompt">내가 재판장이라면?</div>
      <div class="jury-vote-buttons" role="group" aria-label="민심 판정">
        <button class="jury-vote-btn" data-jury-vote="plaintiff">⚖️ 원고 승</button>
        <button class="jury-vote-btn" data-jury-vote="defendant">🛡️ 피고 승</button>
        <button class="jury-vote-btn" data-jury-vote="both">🤝 쌍방 과실</button>
      </div>
      <p class="jury-note">투표 전에는 AI 판결과 다른 이용자의 민심 비율을 보여주지 않습니다.</p>
    </div>`;

  slot.querySelectorAll('[data-jury-vote]').forEach(button => {
    button.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user || user.isAnonymous) {
        showToast('민심소 투표는 로그인 후 이용할 수 있습니다.', 'error');
        location.hash = '#/auth';
        return;
      }
      const side = String(button.dataset.juryVote || '');
      if (!Object.prototype.hasOwnProperty.call(SIDE_LABEL, side)) return;
      const buttons = [...slot.querySelectorAll('[data-jury-vote]')];
      buttons.forEach(item => { item.disabled = true; });
      try {
        const voteResult = httpsCallable(functions, 'voteResult');
        await voteResult({ caseId, reaction: side });
        markJurySeen(caseId);
        await revealVerdict(container, slot, caseId, data, side, { recordScore: true });
      } catch (error) {
        console.error('jury vote failed:', error);
        buttons.forEach(item => { item.disabled = false; });
        showToast((error?.message || '투표하지 못했습니다.').replace('FirebaseError: ', ''), 'error');
      }
    });
  });
}

async function reactionSummary(caseId) {
  try {
    const snapshot = await getDoc(doc(db, `result_reactions/${caseId}`));
    if (!snapshot.exists()) return { counts: {}, total: 0 };
    const counts = snapshot.data().counts || {};
    const total = ['plaintiff', 'defendant', 'both'].reduce((sum, side) => sum + Math.max(0, Number(counts[side] || 0)), 0);
    return { counts, total };
  } catch (error) {
    console.warn('jury tally load failed:', error?.code || error);
    return { counts: {}, total: 0 };
  }
}

function tallyHtml(counts, total) {
  return `<div class="jury-tally">${['plaintiff', 'defendant', 'both'].map(side => {
    const count = Math.max(0, Number(counts?.[side] || 0));
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return `<div class="jury-tally-row"><span>${SIDE_LABEL[side]}</span><span class="jury-tally-track"><i style="width:${percent}%"></i></span><span class="jury-tally-value">${percent}%</span></div>`;
  }).join('')}</div>`;
}

function verdictExcerpt(data) {
  const body = readableBody(data.verdict || data.sentence, 850);
  if (!body) return '<div class="jury-verdict-excerpt"><span class="jury-side-tag jury-side-verdict">AI 재판부 판결</span><p>판결 요약이 없습니다. 판결문 전체 보기에서 확인해주세요.</p></div>';
  return `<div class="jury-verdict-excerpt"><span class="jury-side-tag jury-side-verdict">AI 재판부 판결</span>${body.split(/\n{2,}/).map(part => `<p>${escapeHtml(part)}</p>`).join('')}</div>`;
}

async function revealVerdict(container, slot, caseId, data, mySide, { recordScore }) {
  markJurySeen(caseId);
  const winner = verdictWinner(data);
  const comparable = Boolean(winner);
  const agreed = comparable && winner === mySide;
  if (recordScore) updateScore(agreed, comparable);
  renderScoreboard(container);
  const summary = await reactionSummary(caseId);
  if (!slot.isConnected) return;

  slot.innerHTML = `
    <div class="card jury-card">
      <div class="jury-case-title">${escapeHtml(data.caseTitle || '생활분쟁 사건')}</div>
      <span class="jury-verdict-badge${agreed ? ' jury-verdict-agree' : ''}">${comparable ? (agreed ? '🎯 AI 판결과 일치' : '👀 AI와 다른 판단') : '⚖️ AI 판결 공개'}</span>
      <p class="jury-reveal-line">내 선택: <strong>${SIDE_LABEL[mySide]}</strong></p>
      ${comparable ? `<p class="jury-reveal-line">AI 재판부: <strong>${SIDE_LABEL[winner]}</strong></p>` : ''}
      ${verdictExcerpt(data)}
      <div style="margin-top:16px;font-size:12px;color:var(--cream-dim);">현재 민심 ${summary.total}표</div>
      ${tallyHtml(summary.counts, summary.total)}
      <div class="jury-actions">
        <a href="#/result/${encodeURIComponent(caseId)}" class="btn btn-primary">📜 판결문 전체 보기</a>
        <a href="#/discussion/${encodeURIComponent(caseId)}" class="btn btn-secondary">💬 토론 크게 보기</a>
        <button type="button" class="btn btn-ghost" id="jury-next">다른 사건 판정</button>
      </div>
      <div id="jury-debate"></div>
    </div>`;

  slot.querySelector('#jury-next')?.addEventListener('click', () => loadJuryList(container));
  await renderDebate(slot.querySelector('#jury-debate'), caseId, mySide);
}

async function loadComments(caseId) {
  try {
    const snapshot = await getDocs(query(collection(db, `court_comments/${caseId}/items`), orderBy('createdAt', 'desc'), limit(COMMENT_LIMIT)));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.status !== 'hidden');
  } catch (error) {
    console.warn('jury comments load failed:', error?.code || error);
    return [];
  }
}

function formatCommentDate(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function commentsHtml(comments) {
  if (!comments.length) return '<div class="jury-debate-empty">아직 공개된 의견이 없습니다. 첫 의견을 남겨보세요.</div>';
  return comments.map(comment => `<div class="jury-comment">
    <div class="jury-comment-head"><span class="jury-comment-author">${escapeHtml(comment.nickname || '익명 토론자')}</span>${comment.stance ? `<span class="jury-comment-stance">${escapeHtml(STANCE_LABEL[comment.stance] || comment.stance)}</span>` : ''}<span class="jury-comment-date">${escapeHtml(formatCommentDate(comment.createdAt))}</span></div>
    <div class="jury-comment-text">${escapeHtml(comment.text || '')}</div>
  </div>`).join('');
}

async function renderDebate(host, caseId, mySide) {
  if (!host) return;
  const comments = await loadComments(caseId);
  if (!host.isConnected) return;
  const user = auth.currentUser;
  const canWrite = Boolean(user && !user.isAnonymous);
  host.className = 'jury-debate';
  host.innerHTML = `
    <div class="jury-debate-head"><div class="jury-debate-title">💬 판결 토론</div><div class="jury-debate-mystance">내 입장 <strong>${STANCE_LABEL[mySide]}</strong></div></div>
    ${canWrite ? `<form class="jury-debate-form" id="jury-debate-form"><textarea class="form-textarea" id="jury-debate-text" maxlength="600" rows="3" placeholder="사건과 판결에 대한 의견을 남겨보세요. 실명·연락처·욕설은 입력하지 마세요."></textarea><div class="jury-debate-form-foot"><span>내 투표 입장이 함께 표시됩니다.</span><span id="jury-comment-count">0/600</span></div><button class="btn btn-primary" type="submit">의견 등록</button></form>` : '<div class="jury-debate-empty">댓글 작성은 로그인 후 이용할 수 있습니다.</div>'}
    <div class="jury-debate-list">${commentsHtml(comments)}</div>`;

  const textarea = host.querySelector('#jury-debate-text');
  const count = host.querySelector('#jury-comment-count');
  textarea?.addEventListener('input', () => { if (count) count.textContent = `${textarea.value.length}/600`; });
  host.querySelector('#jury-debate-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const text = String(textarea?.value || '').trim();
    if (text.length < 2) {
      showToast('의견을 2자 이상 입력해주세요.', 'error');
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const addDiscussionComment = httpsCallable(functions, 'addDiscussionComment');
      await addDiscussionComment({ caseId, stance: mySide, text });
      showToast('의견을 등록했습니다.', 'success');
      await renderDebate(host, caseId, mySide);
    } catch (error) {
      console.error('jury discussion comment failed:', error);
      showToast((error?.message || '의견을 등록하지 못했습니다.').replace('FirebaseError: ', ''), 'error');
      button.disabled = false;
    }
  });
}
