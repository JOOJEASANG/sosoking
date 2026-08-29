// 민심소 — 판결소가 AI의 판결이라면, 민심소는 사람들의 판결이다.
//
// 다른 사람의 사건을 판결문 없이 먼저 읽고 원고/피고 중 한쪽을 고른다.
// 투표하는 순간 AI 판사의 판결이 열리고, 내 판단과 민심과 AI가 어떻게 갈렸는지 보여준다.
// 표는 이미 있는 voteResult callable과 result_reactions 컬렉션을 그대로 쓴다.

import { db, auth, functions } from '../firebase.js?v=20260630-3';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';
import { loadSafePublicResults } from '../utils/public-results.js?v=20260730-public-records-2';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const SIDE_LABEL = {
  plaintiff: '원고 승',
  defendant: '피고 승',
  both: '쌍방 과실'
};

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// 이미 판단한 사건을 또 보여주지 않기 위해 이 브라우저에서 본 사건을 기억한다.
function seenCases() {
  try {
    return new Set(JSON.parse(localStorage.getItem('sosoking-jury-seen') || '[]'));
  } catch {
    return new Set();
  }
}

function markSeen(caseId) {
  try {
    const seen = [...seenCases(), caseId].slice(-200);
    localStorage.setItem('sosoking-jury-seen', JSON.stringify(seen));
  } catch {
    /* 저장이 막힌 브라우저에서도 투표 자체는 동작해야 한다. */
  }
}

function pickCase(rows) {
  const seen = seenCases();
  const fresh = rows.filter(([id, data]) => !seen.has(id) && (data?.plaintiffArg || data?.publicCaseDescription));
  const pool = fresh.length ? fresh : rows;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function firstParagraph(text, maxLen = 320) {
  const clean = String(text || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  const body = clean.find(part => part.length > 20) || clean[0] || '';
  return compactText(body, maxLen);
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
          <div class="jury-intro-title">당신이 판사라면?</div>
          <p class="jury-intro-copy">
            다른 사람이 접수한 사건입니다. 판결문은 아직 가려져 있습니다.
            양측 주장을 읽고 한쪽을 고르면 AI 판사의 판결이 열립니다.
          </p>
        </div>
        <div id="jury-slot"><div class="loading-dots"><span></span><span></span><span></span></div></div>
      </div>
    </div>`;

  await loadJuryCase(container);
}

async function loadJuryCase(container) {
  const slot = container.querySelector('#jury-slot');
  if (!slot) return;

  let picked = null;
  try {
    const rows = await loadSafePublicResults(db, { maxRows: 60 });
    picked = pickCase(rows);
  } catch (error) {
    console.error('jury case load failed:', error);
    slot.innerHTML = `
      <div class="card jury-empty">
        <p>사건을 불러오지 못했습니다.</p>
        <button type="button" class="btn btn-primary" id="jury-retry">다시 시도</button>
      </div>`;
    slot.querySelector('#jury-retry')?.addEventListener('click', () => loadJuryCase(container));
    return;
  }

  if (!picked) {
    slot.innerHTML = `
      <div class="card jury-empty">
        <p>아직 공개된 사건이 없습니다.</p>
        <a class="btn btn-primary" href="#/submit">첫 사건 접수하기</a>
      </div>`;
    return;
  }

  renderCaseCard(container, slot, picked);
}

function renderCaseCard(container, slot, [caseId, data]) {
  const title = escapeHtml(data?.caseTitle || '생활분쟁 사건');
  const plaintiff = escapeHtml(firstParagraph(data?.plaintiffArg || data?.publicCaseDescription));
  const defendant = escapeHtml(firstParagraph(data?.defendantArg));

  slot.innerHTML = `
    <article class="card jury-card">
      <div class="jury-case-title">${title}</div>
      <div class="jury-side">
        <span class="jury-side-tag jury-side-plaintiff">원고측 주장</span>
        <p>${plaintiff || '주장이 기록되지 않았습니다.'}</p>
      </div>
      <div class="jury-side">
        <span class="jury-side-tag jury-side-defendant">피고측 항변</span>
        <p>${defendant || '항변이 기록되지 않았습니다.'}</p>
      </div>
      <div class="jury-vote-prompt">누구 손을 들어주시겠습니까?</div>
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

  markSeen(caseId);
  await revealVerdict(container, slot, caseId, data, side);
}

async function revealVerdict(container, slot, caseId, data, mySide) {
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
  const agreed = aiSide && aiSide === mySide;

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
      <p class="jury-reveal-line">당신의 선택은 <strong>${SIDE_LABEL[mySide]}</strong>이었습니다.</p>
      <p class="jury-reveal-line">${headline}</p>
      ${total > 0
        ? `<p class="jury-reveal-line">배심원 ${total}명 중 <strong>${majorityPercent}%</strong>가 ${SIDE_LABEL[majority]}을 택했습니다.</p>${tallyBar(counts, total)}`
        : '<p class="jury-reveal-line">이 사건의 첫 배심원입니다.</p>'}
      <div class="jury-actions">
        <a class="btn btn-primary" href="#/result/${encodeURIComponent(caseId)}">판결문 전문 보기</a>
        <button type="button" class="btn" id="jury-next">다음 사건</button>
      </div>
    </article>`;

  slot.querySelector('#jury-next')?.addEventListener('click', () => {
    slot.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    loadJuryCase(container);
  });
}
