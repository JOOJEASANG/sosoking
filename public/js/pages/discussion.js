import { db, auth, functions } from '../firebase.js?v=20260729-auth-session-1';
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
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const STANCES = [
  { id: 'plaintiff', label: '원고측', icon: '⚖️', description: '원고의 주장과 피해에 더 공감합니다.' },
  { id: 'defendant', label: '피고측', icon: '🛡️', description: '피고의 사정과 반론에 더 공감합니다.' },
  { id: 'both', label: '쌍방', icon: '🤝', description: '양쪽 모두 책임이나 사정이 있다고 봅니다.' }
];
const STANCE_MAP = new Map(STANCES.map(item => [item.id, item]));
const COMMENT_LIMIT = 80;

function ensureDiscussionStyle() {
  if (document.getElementById('discussion-court-style')) return;
  const style = document.createElement('style');
  style.id = 'discussion-court-style';
  style.textContent = `
    .discussion-page{min-height:100vh;padding-bottom:84px;}
    .discussion-container{max-width:780px;padding-top:22px;padding-bottom:90px;}
    .discussion-summary{padding:22px;margin-bottom:16px;border-color:rgba(201,168,76,.45);}
    .discussion-kicker{font-size:10px;color:var(--gold);font-weight:900;letter-spacing:.14em;margin-bottom:7px;}
    .discussion-title{font-family:var(--font-serif);font-size:22px;font-weight:900;line-height:1.5;color:var(--cream);}
    .discussion-copy{font-size:13px;color:var(--cream-dim);line-height:1.75;margin-top:9px;}
    .discussion-verdict{margin-top:13px;padding:13px 14px;border-left:3px solid var(--gold);background:rgba(201,168,76,.08);border-radius:0 10px 10px 0;font-size:13px;color:var(--cream);line-height:1.7;}
    .discussion-choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;}
    .discussion-choice{border:1px solid var(--border);background:var(--surface-soft);color:var(--cream);border-radius:14px;padding:14px 10px;cursor:pointer;text-align:center;min-height:128px;display:flex;flex-direction:column;justify-content:center;transition:transform .15s ease,border-color .15s ease,background .15s ease;}
    .discussion-choice:hover{transform:translateY(-1px);border-color:var(--gold);}
    .discussion-choice.active{border-color:var(--gold);background:rgba(201,168,76,.14);box-shadow:0 0 0 1px rgba(201,168,76,.18) inset;}
    .discussion-choice-icon{font-size:26px;margin-bottom:6px;}
    .discussion-choice-label{font-size:15px;font-weight:900;color:var(--gold);}
    .discussion-choice-count{font-size:12px;color:var(--cream-dim);margin-top:5px;}
    .discussion-choice-bar{height:5px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px;}
    .discussion-choice-bar span{display:block;height:100%;background:var(--gold);}
    .discussion-comment{padding:15px 0;border-top:1px solid var(--border);}
    .discussion-comment:first-child{border-top:0;}
    .discussion-comment-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;}
    .discussion-comment-author{font-size:12px;font-weight:900;color:var(--gold);}
    .discussion-comment-meta{font-size:10px;color:var(--cream-dim);}
    .discussion-stance-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid rgba(201,168,76,.35);border-radius:999px;background:rgba(201,168,76,.09);font-size:10px;font-weight:900;color:var(--gold);}
    .discussion-legacy-badge{font-size:10px;color:var(--cream-dim);}
    .discussion-comment-text{font-size:14px;color:var(--cream);line-height:1.75;white-space:pre-wrap;overflow-wrap:anywhere;}
    [data-theme='light'] .discussion-title,[data-theme='light'] .discussion-choice,[data-theme='light'] .discussion-comment-text{color:#241a0f;}
    [data-theme='light'] .discussion-choice{background:#fffaf1;}
    [data-theme='light'] .discussion-choice-bar{background:rgba(72,48,12,.1);}
    @media(max-width:580px){
      .discussion-choice-grid{grid-template-columns:1fr;}
      .discussion-choice{min-height:0;display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;text-align:left;gap:8px;padding:12px 14px;}
      .discussion-choice-icon{margin:0;font-size:23px;}
      .discussion-choice-count{margin:0;text-align:right;}
      .discussion-choice-bar{grid-column:2/-1;margin-top:1px;}
    }
  `;
  document.head.appendChild(style);
}

function fmtDate(value) {
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

function isPublicResult(data = {}) {
  return data.isPublic === true && Number(data.publicDataVersion || 0) === 1;
}

function participantReady() {
  return Boolean(auth.currentUser && !auth.currentUser.isAnonymous);
}

function errorMessage(error, fallback) {
  return String(error?.message || fallback)
    .replace(/^FirebaseError:\s*/, '')
    .replace(/^functions\//, '')
    .slice(0, 220);
}

async function loadDiscussion(caseId) {
  const user = auth.currentUser;
  const resultRef = doc(db, 'results', caseId);
  const reactionRef = doc(db, 'result_reactions', caseId);
  const commentsQuery = query(
    collection(db, `court_comments/${caseId}/items`),
    orderBy('createdAt', 'desc'),
    limit(COMMENT_LIMIT)
  );

  const [resultSnap, reactionSnap, commentSnap, myVoteSnap] = await Promise.all([
    getDoc(resultRef),
    getDoc(reactionRef).catch(() => null),
    getDocs(commentsQuery).catch(() => null),
    user
      ? getDoc(doc(db, `result_reactions/${caseId}/votes/${user.uid}`)).catch(() => null)
      : Promise.resolve(null)
  ]);

  return {
    result: resultSnap.exists() ? resultSnap.data() : null,
    reactions: reactionSnap?.exists() ? reactionSnap.data() : { counts: {} },
    comments: commentSnap?.docs?.map(item => ({ id: item.id, ...item.data() })) || [],
    myStance: myVoteSnap?.exists() ? String(myVoteSnap.data().reaction || '') : ''
  };
}

function renderChoices(reactions, selected) {
  const counts = reactions?.counts || {};
  const total = STANCES.reduce((sum, item) => sum + Number(counts[item.id] || 0), 0);

  return STANCES.map(item => {
    const count = Number(counts[item.id] || 0);
    const percent = total ? Math.round(count / total * 100) : 0;
    return `<button type="button" class="discussion-choice${selected === item.id ? ' active' : ''}" data-discussion-stance="${item.id}" aria-pressed="${selected === item.id ? 'true' : 'false'}">
      <span class="discussion-choice-icon" aria-hidden="true">${item.icon}</span>
      <span>
        <span class="discussion-choice-label">${item.label}</span>
        <span style="display:block;font-size:10px;color:var(--cream-dim);line-height:1.45;margin-top:3px;">${item.description}</span>
      </span>
      <span class="discussion-choice-count">${count}표 · ${percent}%</span>
      <span class="discussion-choice-bar" aria-hidden="true"><span style="width:${percent}%;"></span></span>
    </button>`;
  }).join('');
}

function renderComments(comments) {
  if (!comments.length) {
    return '<div style="padding:22px 0;text-align:center;font-size:13px;color:var(--cream-dim);">아직 토론 의견이 없습니다. 첫 의견을 남겨보세요.</div>';
  }

  return comments.map(comment => {
    const stance = STANCE_MAP.get(String(comment.stance || ''));
    const badge = stance
      ? `<span class="discussion-stance-badge">${stance.icon} ${stance.label}</span>`
      : '<span class="discussion-legacy-badge">이전 방청석 기록</span>';
    return `<article class="discussion-comment">
      <div class="discussion-comment-head">
        <div><span class="discussion-comment-author">${escapeHtml(comment.nickname || '익명 토론자')}</span> ${badge}</div>
        <time class="discussion-comment-meta">${escapeHtml(fmtDate(comment.createdAt))}</time>
      </div>
      <div class="discussion-comment-text">${escapeHtml(comment.text || '')}</div>
    </article>`;
  }).join('');
}

function unavailable(container, message) {
  container.innerHTML = `
    <div class="page-header"><a href="#/board" class="back-btn" aria-label="판결기록으로 돌아가기">‹</a><span class="logo">토론 법정</span></div>
    <div class="container" style="padding-top:54px;padding-bottom:90px;text-align:center;">
      <div class="card" style="padding:26px;">
        <div style="font-size:42px;margin-bottom:12px;">💬</div>
        <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">토론장을 열 수 없습니다</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.75;">${escapeHtml(message)}</div>
        <a href="#/board" class="btn btn-secondary" style="margin-top:18px;">판결기록으로 이동</a>
      </div>
    </div>`;
}

export async function renderDiscussion(container, caseId) {
  ensureDiscussionStyle();
  container.innerHTML = `
    <div class="page-header"><a href="#/result/${encodeURIComponent(caseId)}" class="back-btn" aria-label="판결문으로 돌아가기">‹</a><span class="logo">토론 법정</span></div>
    <div class="container discussion-container"><div class="loading-dots"><span></span><span></span><span></span></div></div>`;

  let data;
  try {
    data = await loadDiscussion(caseId);
  } catch (error) {
    console.error('discussion load failed:', error);
    unavailable(container, '로그인 상태와 네트워크를 확인한 뒤 다시 시도해주세요.');
    return;
  }

  if (!data.result) {
    unavailable(container, '해당 판결기록을 찾을 수 없습니다.');
    return;
  }
  if (!isPublicResult(data.result)) {
    unavailable(container, '공개된 판결기록에서만 토론장을 이용할 수 있습니다.');
    return;
  }

  const result = data.result;
  const selected = STANCE_MAP.has(data.myStance) ? data.myStance : '';
  const title = result.caseTitle || '생활분쟁 사건';
  const caseSummary = compactText(result.publicCaseDescription || result.reception || result.sentence || '', 260);
  const verdictSummary = compactText(result.sentence || result.verdict || '', 220);
  const discussionCount = Number(result.commentCount || data.comments.length || 0);
  const target = container.querySelector('.discussion-container');
  if (!target) return;

  target.innerHTML = `
    <section class="card discussion-summary">
      <div class="discussion-kicker">CASE DISCUSSION</div>
      <h1 class="discussion-title">${escapeHtml(title)}</h1>
      <div class="discussion-copy">${escapeHtml(caseSummary || '사건 요약이 없습니다.')}</div>
      <div class="discussion-verdict"><strong style="color:var(--gold);">AI 판결 요지</strong><br>${escapeHtml(verdictSummary || '판결 내용을 확인해주세요.')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:15px;">
        <a href="#/result/${encodeURIComponent(caseId)}" class="btn btn-secondary" style="flex:1;min-width:150px;">판결문 전체 보기</a>
        <a href="#/board" class="btn btn-ghost" style="flex:1;min-width:150px;">다른 판결기록</a>
      </div>
    </section>

    <section class="card" style="padding:20px;margin-bottom:16px;">
      <div style="font-family:var(--font-serif);font-size:19px;font-weight:900;color:var(--gold);margin-bottom:5px;">어느 쪽 판단에 더 공감하나요?</div>
      <div style="font-size:12px;color:var(--cream-dim);line-height:1.65;margin-bottom:14px;">원고측·피고측·쌍방 중 하나를 선택하세요. 선택은 다시 변경할 수 있습니다.</div>
      <div class="discussion-choice-grid">${renderChoices(data.reactions, selected)}</div>
    </section>

    <section class="card" style="padding:20px;margin-bottom:16px;">
      <div style="font-weight:900;color:var(--gold);margin-bottom:5px;">선택한 입장으로 의견 남기기</div>
      <div id="discussion-selected-note" style="font-size:12px;color:var(--cream-dim);margin-bottom:11px;">${selected ? `${STANCE_MAP.get(selected).label} 입장으로 참여 중입니다.` : '먼저 위의 세 입장 중 하나를 선택해주세요.'}</div>
      <textarea id="discussion-comment-input" class="form-textarea" maxlength="600" style="min-height:130px;line-height:1.75;" placeholder="판결기록의 어떤 내용에 동의하거나 반대하는지 구체적으로 적어주세요."></textarea>
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:8px;">
        <span style="font-size:10px;color:var(--cream-dim);">개인정보·욕설·실명 언급은 제한됩니다.</span>
        <span id="discussion-char-count" style="font-size:10px;color:var(--cream-dim);">0/600</span>
      </div>
      <button type="button" id="discussion-comment-submit" class="btn btn-primary" style="margin-top:12px;">토론 의견 등록</button>
      ${participantReady() ? '' : '<a href="#/auth" class="btn btn-ghost" style="margin-top:9px;">로그인하고 참여하기</a>'}
    </section>

    <section class="card" style="padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="font-family:var(--font-serif);font-size:18px;font-weight:900;color:var(--gold);">토론 기록</div>
        <div style="font-size:12px;color:var(--cream-dim);">총 ${discussionCount}개</div>
      </div>
      <div id="discussion-comments">${renderComments(data.comments)}</div>
    </section>

    <div class="disclaimer" style="margin-top:16px;">토론 내용은 이용자의 개인 의견이며 실제 법률 판단이 아닙니다.</div>`;

  target.querySelectorAll('[data-discussion-stance]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!participantReady()) {
        showToast('로그인한 회원만 토론 입장을 선택할 수 있습니다.', 'error');
        location.hash = '#/auth';
        return;
      }
      const stance = button.dataset.discussionStance || '';
      if (!STANCE_MAP.has(stance)) return;
      const oldText = button.querySelector('.discussion-choice-count')?.textContent || '';
      button.disabled = true;
      try {
        await httpsCallable(functions, 'voteResult')({ caseId, reaction: stance });
        showToast(`${STANCE_MAP.get(stance).label} 입장으로 기록했습니다.`, 'success');
        await renderDiscussion(container, caseId);
      } catch (error) {
        button.disabled = false;
        const count = button.querySelector('.discussion-choice-count');
        if (count) count.textContent = oldText;
        showToast(errorMessage(error, '입장 선택에 실패했습니다.'), 'error');
      }
    });
  });

  const input = target.querySelector('#discussion-comment-input');
  const counter = target.querySelector('#discussion-char-count');
  input?.addEventListener('input', () => {
    if (counter) counter.textContent = `${input.value.length}/600`;
  });

  target.querySelector('#discussion-comment-submit')?.addEventListener('click', async event => {
    if (!participantReady()) {
      showToast('로그인한 회원만 토론 의견을 남길 수 있습니다.', 'error');
      location.hash = '#/auth';
      return;
    }
    if (!selected) {
      showToast('원고측, 피고측, 쌍방 중 하나를 먼저 선택해주세요.', 'error');
      return;
    }
    const text = input?.value.trim() || '';
    if (text.length < 2) {
      showToast('토론 의견을 2자 이상 입력해주세요.', 'error');
      input?.focus();
      return;
    }

    const button = event.currentTarget;
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = '등록 중...';
    try {
      await httpsCallable(functions, 'addDiscussionComment')({ caseId, stance: selected, text });
      showToast('토론 의견을 등록했습니다.', 'success');
      await renderDiscussion(container, caseId);
    } catch (error) {
      button.disabled = false;
      button.textContent = oldText;
      showToast(errorMessage(error, '토론 의견 등록에 실패했습니다.'), 'error');
    }
  });
}
