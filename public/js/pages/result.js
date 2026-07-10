import { db, auth, functions } from '../firebase.js?v=20260708-1';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { addOwnerStorageImage } from '../components/result-storage-image.js?v=20260709-1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const REACTIONS = [
  ['plaintiff', '⚖️ 원고 편'],
  ['defendant', '🛡️ 피고 편'],
  ['both', '🤝 쌍방과실'],
  ['tooMuch', '😳 판사님 과합니다'],
  ['funny', '😂 웃겼다']
];

function ensureResultStyle() {
  if (document.getElementById('judgment-v2-result-style')) return;
  const style = document.createElement('style');
  style.id = 'judgment-v2-result-style';
  style.textContent = `
    .result-v2{max-width:780px;margin:0 auto;padding:24px 18px 90px}
    .result-cover,.result-card,.judgment-document,.judgment-section{border:1px solid rgba(201,168,76,.34);border-radius:20px;background:rgba(28,36,64,.88);box-shadow:0 10px 28px rgba(0,0,0,.16)}
    .result-cover{padding:26px 20px;text-align:center;margin-bottom:14px;background:radial-gradient(circle at 50% 0%,rgba(201,168,76,.16),transparent 38%),rgba(20,27,49,.96)}
    .result-kicker{font-size:10px;font-weight:900;letter-spacing:.18em;color:var(--gold);margin-bottom:12px}
    .result-cover h1{font-family:var(--font-serif);font-size:25px;line-height:1.45;color:var(--cream);margin:0 0 12px;word-break:keep-all}
    .result-cover p{font-size:12px;line-height:1.6;color:var(--cream-dim);margin:0}
    .result-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;margin-top:14px}
    .result-meta span{border:1px solid rgba(201,168,76,.22);border-radius:999px;padding:5px 9px;font-size:11px;color:var(--cream-dim);background:rgba(255,255,255,.035)}
    .result-card,.judgment-section{padding:17px;margin-bottom:13px}
    .result-card-title,.judgment-section h2{font-size:16px;font-weight:900;color:var(--gold);margin:0 0 9px}
    .result-card p,.judgment-section p{font-size:14px;line-height:1.8;color:var(--cream);margin:0;white-space:pre-wrap;word-break:keep-all}
    .result-summary{font-family:var(--font-serif);font-size:18px!important;font-weight:900;color:var(--cream)!important;text-align:center}
    .judgment-document{padding:22px 18px;margin-bottom:14px}
    .judgment-document pre{margin:0;white-space:pre-wrap;word-break:keep-all;font-family:var(--font-serif);font-size:15px;line-height:1.95;color:var(--cream)}
    .judgment-orders{display:flex;flex-direction:column;gap:8px}
    .judgment-order{display:grid;grid-template-columns:30px 1fr;gap:9px;padding:10px 11px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.035)}
    .judgment-order strong{color:var(--gold);font-family:var(--font-serif)}
    .judgment-order span{color:var(--cream);font-size:14px;line-height:1.65}
    .closing-card{text-align:center;font-family:var(--font-serif);font-size:17px;font-weight:900;line-height:1.75;color:var(--gold)}
    .reaction-list{display:flex;flex-direction:column;gap:8px}
    .reaction-btn{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:var(--cream);border-radius:14px;padding:11px 12px;text-align:left;cursor:pointer}
    .reaction-btn:disabled{opacity:.55;cursor:not-allowed}
    .reaction-btn.is-active{border-color:rgba(201,168,76,.8);background:rgba(201,168,76,.13)}
    .reaction-btn div{display:flex;justify-content:space-between;gap:10px;font-size:13px;font-weight:800}
    .reaction-btn i{display:block;height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px}
    .reaction-btn b{display:block;height:100%;background:var(--gold)}
    .comment-write{display:flex;gap:8px;margin-bottom:12px}
    .comment-write .btn{width:82px;padding-left:0;padding-right:0}
    .comment-list{display:flex;flex-direction:column;gap:8px}
    .comment-item{border-top:1px solid rgba(255,255,255,.08);padding-top:10px}
    .comment-item strong{font-size:12px;color:var(--gold)}
    .comment-item p{font-size:13px;color:var(--cream-dim);line-height:1.65;margin:3px 0 0}
    .section-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:9px}
    .section-head span{font-size:16px;font-weight:900;color:var(--gold)}
    .section-head em{font-style:normal;font-size:11px;color:var(--cream-dim)}
    .section-subtitle{font-size:12px;color:var(--cream-dim);line-height:1.6;margin-bottom:10px}
    .result-actions{display:flex;flex-direction:column;gap:8px;margin-top:14px}
    .result-legal{text-align:center;font-size:11px;line-height:1.7;color:var(--cream-dim);margin:15px 0}
    .owner-delete-case{border-color:rgba(231,76,60,.45)!important;color:#e74c3c!important}
    @media(min-width:720px){.result-cover h1{font-size:30px}.judgment-document pre{font-size:16px}.result-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}
    [data-theme="light"] .result-cover,:root:not([data-theme="dark"]) .result-cover,[data-theme="light"] .result-card,:root:not([data-theme="dark"]) .result-card,[data-theme="light"] .judgment-document,:root:not([data-theme="dark"]) .judgment-document,[data-theme="light"] .judgment-section,:root:not([data-theme="dark"]) .judgment-section{background:#fffaf0!important;border-color:#e2d3af!important;box-shadow:0 8px 20px rgba(117,85,24,.07)!important}
    [data-theme="light"] .result-cover h1,:root:not([data-theme="dark"]) .result-cover h1,[data-theme="light"] .result-card p,:root:not([data-theme="dark"]) .result-card p,[data-theme="light"] .judgment-section p,:root:not([data-theme="dark"]) .judgment-section p,[data-theme="light"] .judgment-document pre,:root:not([data-theme="dark"]) .judgment-document pre,[data-theme="light"] .judgment-order span,:root:not([data-theme="dark"]) .judgment-order span{color:#342514!important}
  `;
  document.head.appendChild(style);
}

function fmtDate(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function clean(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeOrders(value, fallback = '') {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => typeof item === 'string'
        ? { number: index + 1, text: clean(item, 500) }
        : { number: Number(item?.number || index + 1), text: clean(item?.text, 500) })
      .filter(item => item.text)
      .slice(0, 5);
  }

  return clean(fallback, 2400)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(\d+)\.\s*(.+)$/);
      return { number: Number(match?.[1] || index + 1), text: clean(match?.[2] || line, 500) };
    })
    .slice(0, 5);
}

function normalizeResult(r = {}, c = {}) {
  const v2 = r.judgment && typeof r.judgment === 'object' && !Array.isArray(r.judgment)
    ? r.judgment
    : null;
  const title = clean(r.title || r.refinedCaseTitle || r.caseTitle || c.caseTitle || '소소한 황당사건', 120);
  const grandTitle = clean(r.headline || r.absurdityTitle || v2?.headline || title, 180);
  const metadata = {
    title,
    grandTitle,
    docket: clean(r.docketNumber || c.docketNumber || '사건번호 미상', 60),
    judge: clean(r.judgeType || c.judgeType || 'AI 재판부', 60),
    createdAt: fmtDate(r.createdAt || c.createdAt),
    schemaVersion: Number(r.schemaVersion || r.resultSchemaVersion || (v2 ? 2 : 1))
  };

  if (v2) {
    return {
      mode: 'structured',
      metadata,
      summary: clean(v2.summary || r.summary, 500),
      facts: clean(v2.facts, 5000),
      investigation: clean(v2.investigation, 5000),
      prosecution: clean(v2.prosecution, 5000),
      defense: clean(v2.defense, 5000),
      opinion: clean(v2.opinion, 5000),
      orders: normalizeOrders(v2.orders),
      closingComment: clean(v2.closingComment, 500),
      legalNotice: clean(v2.legalNotice || r.executionOrder, 500)
    };
  }

  const script = clean(r.judgmentScript, 18000);
  if (script) {
    return {
      mode: 'script',
      metadata,
      summary: clean(r.quickVerdict || r.summary, 500),
      script,
      closingComment: clean(r.closingComment, 500),
      legalNotice: clean(r.executionOrder, 500)
    };
  }

  return {
    mode: 'legacy',
    metadata,
    summary: clean(r.quickVerdict || r.courtOpinion || r.verdict, 500),
    facts: clean(r.expandedCase || r.reception || r.caseDescription || c.caseDescription, 5000),
    investigation: clean(r.investigation || r.caseTimeline || r.forensicReport, 5000),
    prosecution: clean(r.plaintiffArg, 5000),
    defense: clean(r.defendantArg, 5000),
    opinion: clean(r.courtOpinion || r.verdict, 5000),
    orders: normalizeOrders([], r.sentence),
    closingComment: clean(r.closingComment, 500),
    legalNotice: clean(r.executionOrder, 500)
  };
}

function renderSection(title, text) {
  if (!text) return '';
  return `<section class="judgment-section"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></section>`;
}

function renderJudgment(view) {
  const summary = view.summary
    ? `<section class="result-card"><div class="result-card-title">판결 요약</div><p class="result-summary">${escapeHtml(view.summary)}</p></section>`
    : '';

  if (view.mode === 'script') {
    return `${summary}<section class="judgment-document"><pre>${escapeHtml(view.script)}</pre></section>${view.closingComment ? `<section class="result-card closing-card">${escapeHtml(view.closingComment)}</section>` : ''}`;
  }

  const orders = view.orders?.length
    ? `<section class="judgment-section"><h2>주문</h2><div class="judgment-orders">${view.orders.map(order => `<div class="judgment-order"><strong>${escapeHtml(order.number)}</strong><span>${escapeHtml(order.text)}</span></div>`).join('')}</div></section>`
    : '';

  return [
    summary,
    renderSection('사건의 경위', view.facts),
    renderSection('수사 과정', view.investigation),
    renderSection('검사의 주장', view.prosecution),
    renderSection('변호인의 주장', view.defense),
    renderSection('재판부 판단', view.opinion),
    orders,
    view.closingComment ? `<section class="result-card closing-card">${escapeHtml(view.closingComment)}</section>` : ''
  ].join('');
}

function emptySocial() {
  return { reactions: { counts: {}, total: 0 }, myReaction: '', comments: [] };
}

async function loadSocial(caseId) {
  const [reactionSnap, myVoteSnap, commentSnap] = await Promise.all([
    getDoc(doc(db, 'result_reactions', caseId)).catch(() => null),
    auth.currentUser ? getDoc(doc(db, `result_reactions/${caseId}/votes/${auth.currentUser.uid}`)).catch(() => null) : null,
    getDocs(query(collection(db, `court_comments/${caseId}/items`), orderBy('createdAt', 'desc'), limit(20))).catch(() => null)
  ]);
  return {
    reactions: reactionSnap?.exists() ? reactionSnap.data() : { counts: {}, total: 0 },
    myReaction: myVoteSnap?.exists() ? myVoteSnap.data().reaction : '',
    comments: commentSnap?.docs?.map(item => ({ id: item.id, ...item.data() })) || []
  };
}

function renderReactions(social, isPublic) {
  const counts = social.reactions?.counts || {};
  const total = Number(social.reactions?.total || Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0));
  return `<section class="result-card">
    <div class="section-head"><span>방청객 배심원 투표</span><em>총 ${total}표</em></div>
    ${!isPublic ? '<div class="section-subtitle">판결을 공개하면 다른 사용자가 투표할 수 있습니다.</div>' : ''}
    <div class="reaction-list">${REACTIONS.map(([key, label]) => {
      const count = Number(counts[key] || 0);
      const percent = total ? Math.round(count / total * 100) : 0;
      return `<button class="reaction-btn ${social.myReaction === key ? 'is-active' : ''}" data-reaction="${key}" ${!isPublic ? 'disabled' : ''}><div><span>${label}</span><strong>${count}표 · ${percent}%</strong></div><i><b style="width:${percent}%"></b></i></button>`;
    }).join('')}</div>
  </section>`;
}

function renderComments(comments, isPublic) {
  return `<section class="result-card">
    <div class="section-head"><span>방청석 한마디</span></div>
    ${isPublic ? '<div class="comment-write"><input id="court-comment-input" class="form-input" maxlength="120" placeholder="판결에 대한 한마디"><button id="court-comment-btn" class="btn btn-secondary">등록</button></div>' : '<div class="section-subtitle">공개 판결에서만 댓글을 남길 수 있습니다.</div>'}
    <div class="comment-list">${comments.length ? comments.map(comment => `<div class="comment-item"><strong>${escapeHtml(comment.nickname || '익명 방청객')}</strong><p>${escapeHtml(comment.text || '')}</p></div>`).join('') : '<div class="section-subtitle">아직 방청석이 조용합니다.</div>'}</div>
  </section>`;
}

function bindActions(container, caseId, isOwner, isPublic) {
  container.querySelectorAll('.reaction-btn').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await httpsCallable(functions, 'voteResult')({ caseId, reaction: button.dataset.reaction });
        showToast('방청객 의견이 기록되었습니다.', 'success');
        await renderResult(container, caseId);
      } catch (error) {
        console.error(error);
        showToast((error.message || '투표에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
      }
    });
  });

  container.querySelector('#court-comment-btn')?.addEventListener('click', async () => {
    const input = container.querySelector('#court-comment-input');
    const text = input?.value?.trim() || '';
    if (text.length < 2) return showToast('방청석 한마디를 2자 이상 입력해주세요.', 'error');
    try {
      await httpsCallable(functions, 'addCourtComment')({ caseId, text });
      showToast('방청석에 기록되었습니다.', 'success');
      await renderResult(container, caseId);
    } catch (error) {
      console.error(error);
      showToast((error.message || '등록에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
    }
  });

  container.querySelector('#copy-case-link')?.addEventListener('click', async () => {
    const url = `${location.origin}/#/result/${encodeURIComponent(caseId)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('판결 링크를 복사했습니다.', 'success');
    } catch {
      prompt('아래 링크를 복사하세요.', url);
    }
  });

  if (!isOwner) return;

  container.querySelector('#btn-share')?.addEventListener('click', async () => {
    const nextPublic = !isPublic;
    try {
      await updateDoc(doc(db, 'results', caseId), { isPublic: nextPublic });
      await updateDoc(doc(db, 'cases', caseId), { isPublic: nextPublic }).catch(() => null);
      showToast(nextPublic ? '판결을 공개했습니다.' : '판결을 비공개로 전환했습니다.', 'success');
      await renderResult(container, caseId);
    } catch (error) {
      console.error(error);
      showToast('공개 상태를 변경하지 못했습니다.', 'error');
    }
  });

  container.querySelector('#owner-delete-case')?.addEventListener('click', async () => {
    if (!confirm('이 사건과 판결을 삭제할까요? 삭제 후 복구할 수 없습니다.')) return;
    const button = container.querySelector('#owner-delete-case');
    button.disabled = true;
    try {
      await httpsCallable(functions, 'deleteMyCase')({ caseId });
      showToast('사건을 삭제했습니다.', 'success');
      location.hash = '#/my-cases';
    } catch (error) {
      console.error(error);
      button.disabled = false;
      showToast((error.message || '삭제하지 못했습니다.').replace('FirebaseError: ', ''), 'error');
    }
  });
}

export async function renderResult(container, caseId) {
  ensureResultStyle();
  container.innerHTML = '<div class="container" style="padding:60px 20px;text-align:center"><div class="loading-dots"><span></span><span></span><span></span></div></div>';

  let resultSnap;
  try {
    resultSnap = await getDoc(doc(db, 'results', caseId));
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim)">판결을 불러올 권한이 없거나 삭제된 사건입니다.<br><a href="#/">처음으로</a></div>';
    return;
  }

  if (!resultSnap.exists()) {
    container.innerHTML = '<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim)">판결을 찾을 수 없습니다.<br><a href="#/">처음으로</a></div>';
    return;
  }

  const result = resultSnap.data() || {};
  const caseSnap = await getDoc(doc(db, 'cases', caseId)).catch(() => null);
  const caseData = caseSnap?.exists() ? caseSnap.data() : {};
  const isOwner = !!auth.currentUser && (result.userId === auth.currentUser.uid || result.ownerId === auth.currentUser.uid || caseData.userId === auth.currentUser.uid);
  const isPublic = result.isPublic === true;
  const view = normalizeResult(result, caseData);
  const social = await loadSocial(caseId).catch(() => emptySocial());
  const legalNotice = view.legalNotice || '본 판결은 실제 법적 효력이 없는 오락 콘텐츠입니다.';

  container.innerHTML = `<div class="page-header"><span class="logo">⚖️ 소소킹 판결문</span></div>
    <main class="result-v2">
      <section class="result-cover">
        <div class="result-kicker">SOSOKING JUDGMENT · V${view.metadata.schemaVersion}</div>
        <h1>${escapeHtml(view.metadata.grandTitle)}</h1>
        <p>${escapeHtml(view.metadata.title)}</p>
        <div class="result-meta">
          <span>${escapeHtml(view.metadata.docket)}</span>
          <span>${escapeHtml(view.metadata.judge)}</span>
          ${view.metadata.createdAt ? `<span>${escapeHtml(view.metadata.createdAt)}</span>` : ''}
        </div>
      </section>

      ${renderJudgment(view)}
      ${renderReactions(social, isPublic)}
      ${renderComments(social.comments, isPublic)}
      <div class="result-legal">${escapeHtml(legalNotice)}</div>

      <div class="result-actions">
        <button class="btn btn-secondary" id="copy-case-link">판결 링크 복사</button>
        ${isOwner ? `<button class="btn ${isPublic ? 'btn-ghost' : 'btn-primary'}" id="btn-share">${isPublic ? '비공개로 전환' : '공개 판결로 전환'}</button>` : ''}
        ${isOwner ? '<button class="btn btn-ghost owner-delete-case" id="owner-delete-case">이 사건 삭제</button>' : ''}
        <a href="#/submit" class="btn btn-secondary">새 사건 접수</a>
        <a href="#/board" class="btn btn-ghost">공개 판결 보기</a>
      </div>
    </main>`;

  bindActions(container, caseId, isOwner, isPublic);
  await addOwnerStorageImage(container, caseId);
}
