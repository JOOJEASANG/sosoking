import { db, auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';
import { attachReportButton } from '../components/report-dialog.js?v=20260729-report-moderation-1';

const REACTIONS = [
  ['plaintiff', '⚖️ 원고 편'],
  ['defendant', '🛡️ 피고 편'],
  ['both', '🤝 쌍방과실'],
  ['tooMuch', '😳 재판부가 과합니다'],
  ['funny', '😂 웃겼다']
];

const JUDGE_ICON = {
  '엄벌주의형': '👨‍⚖️',
  '감성형': '🥹',
  '현실주의형': '🤦',
  '과몰입형': '🔥',
  '피곤형': '😴',
  '논리집착형': '🧮',
  '드립형': '🎭',
  '소소킹 AI 재판부': '⚖️'
};

const aliasResolutionCache = new Map();

function looksLikeLegacyUidCaseId(caseId) {
  const value = String(caseId || '');
  return value.length > 30 && value.includes('_') && !value.startsWith('daily_');
}

async function redirectLegacyCaseId(caseId) {
  if (!looksLikeLegacyUidCaseId(caseId)) return false;
  let request = aliasResolutionCache.get(caseId);
  if (!request) {
    request = httpsCallable(functions, 'resolveCaseAlias')({ caseId })
      .then(response => String(response.data?.targetCaseId || ''))
      .catch(error => {
        console.warn('legacy participation alias lookup failed:', error?.code || error);
        return '';
      });
    aliasResolutionCache.set(caseId, request);
  }

  const targetCaseId = await request;
  if (!targetCaseId || targetCaseId === caseId) return false;
  location.replace(`${location.origin}/#/result/${encodeURIComponent(targetCaseId)}`);
  return true;
}

function ensureParticipationStyle() {
  if (document.getElementById('result-participation-style')) return;
  const style = document.createElement('style');
  style.id = 'result-participation-style';
  style.textContent = `
    .participation-page{min-height:100%;}
    .participation-container{max-width:700px;padding-top:22px;padding-bottom:92px;}
    .participation-hero{position:relative;overflow:hidden;padding:22px;margin-bottom:16px;border-radius:20px;}
    .participation-hero::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent,rgba(201,168,76,.08),transparent);}
    .participation-kicker{position:relative;font-size:10px;font-weight:900;letter-spacing:.16em;color:var(--gold);margin-bottom:7px;}
    .participation-title{position:relative;font-size:22px;font-weight:900;line-height:1.45;color:var(--cream);word-break:keep-all;}
    .participation-summary{position:relative;margin-top:9px;font-size:13px;line-height:1.75;color:var(--cream-dim);word-break:keep-all;}
    .participation-meta{position:relative;display:flex;gap:7px;flex-wrap:wrap;margin-top:14px;}
    .participation-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;border:1px solid var(--border);background:var(--gold-dim);font-size:11px;font-weight:800;color:var(--cream-dim);}
    .participation-guide{margin:14px 0 17px;padding:12px 14px;border:1px solid var(--border);border-radius:13px;background:var(--surface-soft);font-size:12px;line-height:1.7;color:var(--cream-dim);}
    .participation-section-title{font-size:19px;font-weight:900;color:var(--gold);margin:22px 0 12px;}
    .audience-card{padding:18px;margin-bottom:14px;border-radius:17px;}
    .audience-card-header{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;}
    .audience-card-title{font-size:15px;font-weight:900;color:var(--gold);}
    .audience-card-count{font-size:12px;color:var(--cream-dim);}
    .reaction-list{display:grid;grid-template-columns:1fr;gap:8px;}
    .participation-page .reaction-btn{width:100%;text-align:left;border:1px solid var(--border-soft);background:var(--surface-soft);color:var(--cream);border-radius:12px;padding:11px 12px;cursor:pointer;transition:border-color .15s ease,background .15s ease,transform .15s ease;}
    .participation-page .reaction-btn:hover{border-color:var(--gold);background:var(--surface-hover);}
    .participation-page .reaction-btn:active{transform:scale(.99);}
    .participation-page .reaction-btn[data-picked='true']{border-color:var(--gold)!important;background:var(--gold-dim)!important;color:var(--cream)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--gold) 23%,transparent);}
    .reaction-row{display:flex;justify-content:space-between;gap:10px;font-size:13px;font-weight:800;}
    .reaction-meter{height:5px;border-radius:999px;background:var(--border-soft);margin-top:8px;overflow:hidden;}
    .reaction-meter span{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-light));}
    .comment-form{display:flex;gap:8px;margin-bottom:12px;}
    .comment-form .form-input{flex:1;min-width:0;}
    .comment-form .btn{width:86px;padding-left:0;padding-right:0;}
    .court-comment{padding:11px 0;border-top:1px solid var(--border-soft);}
    .court-comment-author{font-size:12px;color:var(--gold);font-weight:800;}
    .court-comment-text{font-size:13px;color:var(--cream-dim);line-height:1.65;margin-top:3px;word-break:break-word;}
    .participation-page .result-actions{margin-top:18px;}
    [data-theme='dark'] .participation-page .participation-hero,
    [data-theme='dark'] .participation-page .audience-card{
      color-scheme:dark;
      background:linear-gradient(145deg,#1b2231,#10151f)!important;
      color:#fff9ef!important;
      border-color:rgba(209,173,80,.32)!important;
      box-shadow:0 12px 30px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.045)!important;
    }
    [data-theme='dark'] .participation-page .participation-title,
    [data-theme='dark'] .participation-page .reaction-btn{color:#fff9ef!important;}
    [data-theme='dark'] .participation-page .participation-summary,
    [data-theme='dark'] .participation-page .participation-guide,
    [data-theme='dark'] .participation-page .audience-card-count,
    [data-theme='dark'] .participation-page .court-comment-text{color:rgba(255,249,239,.76)!important;}
    [data-theme='dark'] .participation-page .participation-guide,
    [data-theme='dark'] .participation-page .reaction-btn{background:rgba(255,255,255,.045)!important;border-color:rgba(255,255,255,.09)!important;}
    [data-theme='light'] .participation-page .participation-hero,
    [data-theme='light'] .participation-page .audience-card{
      color-scheme:light;
      background:linear-gradient(145deg,#fffdf9,#f8eddb)!important;
      color:#20170d!important;
      border-color:rgba(121,83,11,.27)!important;
      box-shadow:0 10px 24px rgba(77,52,12,.1),inset 0 1px 0 rgba(255,255,255,.95)!important;
    }
    [data-theme='light'] .participation-page .participation-title,
    [data-theme='light'] .participation-page .reaction-btn{color:#20170d!important;}
    [data-theme='light'] .participation-page .participation-summary,
    [data-theme='light'] .participation-page .participation-guide,
    [data-theme='light'] .participation-page .audience-card-count,
    [data-theme='light'] .participation-page .court-comment-text{color:rgba(32,23,13,.72)!important;}
    @media(max-width:520px){
      .participation-container{padding-left:14px;padding-right:14px;}
      .participation-hero{padding:19px 17px;}
      .participation-title{font-size:20px;}
      .comment-form{display:grid;grid-template-columns:minmax(0,1fr) 76px;}
      .comment-form .btn{width:76px;}
    }
  `;
  document.head.appendChild(style);
}

async function loadSocial(caseId) {
  const [reactionSnap, myVoteSnap, commentSnap] = await Promise.all([
    getDoc(doc(db, 'result_reactions', caseId)).catch(() => null),
    auth.currentUser
      ? getDoc(doc(db, `result_reactions/${caseId}/votes/${auth.currentUser.uid}`)).catch(() => null)
      : null,
    getDocs(query(
      collection(db, `court_comments/${caseId}/items`),
      orderBy('createdAt', 'desc'),
      limit(20)
    )).catch(() => null)
  ]);

  return {
    reactions: reactionSnap?.exists() ? reactionSnap.data() : { counts: {}, total: 0 },
    myReaction: myVoteSnap?.exists() ? myVoteSnap.data().reaction : '',
    comments: commentSnap?.docs?.map(document => ({ id: document.id, ...document.data() })) || []
  };
}

function renderReactions(social) {
  const counts = social.reactions?.counts || {};
  const total = Number(social.reactions?.total || Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0));

  return `<section class="card audience-card">
    <div class="audience-card-header">
      <div class="audience-card-title">🧑‍⚖️ 배심원 투표</div>
      <div class="audience-card-count">총 ${total}표</div>
    </div>
    <div class="reaction-list">
      ${REACTIONS.map(([key, label]) => {
        const count = Number(counts[key] || 0);
        const percent = total ? Math.round(count / total * 100) : 0;
        const active = social.myReaction === key;
        return `<button type="button" class="reaction-btn" data-reaction="${key}" data-picked="${active ? 'true' : 'false'}">
          <div class="reaction-row"><span>${label}</span><span>${count}표 · ${percent}%</span></div>
          <div class="reaction-meter"><span style="width:${percent}%"></span></div>
        </button>`;
      }).join('')}
    </div>
  </section>`;
}

function renderComments(comments) {
  return `<section class="card audience-card">
    <div class="audience-card-title" style="margin-bottom:12px;">💬 방청석 한마디</div>
    <div class="comment-form">
      <input id="court-comment-input" class="form-input" maxlength="120" placeholder="예: 빈 접시가 모든 것을 말해주네요">
      <button type="button" id="court-comment-btn" class="btn btn-secondary">등록</button>
    </div>
    <div>
      ${comments.length
        ? comments.map(comment => `<div class="court-comment"><div class="court-comment-author">${escapeHtml(comment.nickname || '익명 방청객')}</div><div class="court-comment-text">${escapeHtml(comment.text || '')}</div></div>`).join('')
        : '<div class="court-comment-text">아직 방청석이 조용합니다. 첫 한마디를 남겨보세요.</div>'}
    </div>
  </section>`;
}

function bindParticipationActions(container, caseId) {
  container.querySelectorAll('.reaction-btn').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await httpsCallable(functions, 'voteResult')({ caseId, reaction: button.dataset.reaction });
        showToast('배심원 의견이 기록되었습니다.', 'success');
        await renderParticipation(container, caseId);
      } catch (error) {
        console.error(error);
        showToast(String(error?.message || '투표에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
      }
    });
  });

  container.querySelector('#court-comment-btn')?.addEventListener('click', async () => {
    const input = container.querySelector('#court-comment-input');
    const text = input?.value?.trim() || '';
    if (text.length < 2) {
      showToast('방청석 한마디를 2자 이상 입력해주세요.', 'error');
      return;
    }

    try {
      await httpsCallable(functions, 'addCourtComment')({ caseId, text });
      showToast('방청석에 기록되었습니다.', 'success');
      await renderParticipation(container, caseId);
    } catch (error) {
      console.error(error);
      showToast(String(error?.message || '등록에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
    }
  });
}

export async function renderParticipation(container, caseId) {
  if (await redirectLegacyCaseId(caseId)) return;
  ensureParticipationStyle();
  container.innerHTML = `
    <div class="participation-page">
      <div class="page-header"><a href="#/board" class="back-btn">‹</a><span class="logo">판결기록 참여</span></div>
      <div class="container participation-container"><div class="loading-dots"><span></span><span></span><span></span></div></div>
    </div>`;

  const inner = container.querySelector('.participation-container');
  try {
    const [resultSnap, social] = await Promise.all([
      getDoc(doc(db, 'results', caseId)),
      loadSocial(caseId)
    ]);

    if (!resultSnap.exists() || resultSnap.data()?.isPublic !== true) {
      inner.innerHTML = `<div class="card" style="padding:28px;text-align:center;">
        <div style="font-size:38px;margin-bottom:10px;">🔒</div>
        <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">참여할 수 없는 판결기록입니다</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:16px;">비공개로 전환되었거나 삭제된 사건일 수 있습니다.</div>
        <a href="#/board" class="btn btn-secondary">판결기록으로 돌아가기</a>
      </div>`;
      return;
    }

    const result = resultSnap.data();
    const title = result.caseTitle || '생활분쟁 사건';
    const summary = compactText(result.caseDescription || result.sentence || result.verdict || result.reception || '', 220);
    const judgeType = result.judgeType || '소소킹 AI 재판부';
    const judgeIcon = result.judgeIcon || JUDGE_ICON[judgeType] || '⚖️';
    const grievance = Math.max(1, Math.min(10, Number(result.grievanceIndex) || 5));

    inner.innerHTML = `
      <section class="card participation-hero">
        <div class="participation-kicker">PUBLIC COURT PARTICIPATION</div>
        <h1 class="participation-title">${escapeHtml(title)}</h1>
        <div class="participation-summary">${escapeHtml(summary || '공개된 생활판결 기록에 대한 배심원 의견을 남겨보세요.')}</div>
        <div class="participation-meta">
          <span class="participation-chip">${escapeHtml(judgeIcon)} ${escapeHtml(judgeType)} 판사</span>
          <span class="participation-chip">억울지수 ${grievance}/10</span>
        </div>
      </section>

      <div class="participation-guide">판결문 서식을 다시 반복하지 않고 바로 참여 화면을 열었습니다. 아래에서 배심원 투표와 방청석 한마디를 남길 수 있습니다.</div>
      <div class="participation-section-title">방청석 참여</div>
      ${renderReactions(social)}
      ${renderComments(social.comments)}

      <div class="result-actions">
        <a href="/result/${encodeURIComponent(caseId)}" class="btn btn-secondary">전체 판결문 보기</a>
        <a href="#/board" class="btn btn-ghost">판결기록 목록으로</a>
        <a href="#/submit" class="btn btn-ghost">새 사건 접수하기</a>
      </div>`;

    bindParticipationActions(container, caseId);
    attachReportButton(container, caseId);
  } catch (error) {
    console.error('participation page failed:', error);
    inner.innerHTML = `<div class="card" style="padding:28px;text-align:center;">
      <div style="font-size:38px;margin-bottom:10px;">⚠️</div>
      <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">참여 화면을 불러오지 못했습니다</div>
      <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:16px;">잠시 후 다시 시도해주세요.</div>
      <a href="#/board" class="btn btn-secondary">판결기록으로 돌아가기</a>
    </div>`;
  }
}
