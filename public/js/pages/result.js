import { db, auth, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const REACTIONS = [
  ['plaintiff', '⚖️ 원고 편'],
  ['defendant', '🛡️ 피고 편'],
  ['both', '🤝 쌍방과실'],
  ['tooMuch', '😳 재판부가 과합니다'],
  ['funny', '😂 웃겼다']
];

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
    comments: commentSnap?.docs?.map(d => ({ id: d.id, ...d.data() })) || []
  };
}

export async function renderResult(container, caseId) {
  container.innerHTML = `
    <div class="page-header"><span class="logo">⚖️ 판결문</span></div>
    <div class="container" style="padding:28px 20px 80px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  let caseSnap;
  let resultSnap;
  let social;

  try {
    [caseSnap, resultSnap, social] = await Promise.all([
      getDoc(doc(db, 'cases', caseId)),
      getDoc(doc(db, 'results', caseId)),
      loadSocial(caseId)
    ]);
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">
        결과를 불러올 권한이 없거나 삭제된 판결문입니다.<br>
        <a href="#/" style="color:var(--gold);">처음으로</a>
      </div>`;
    return;
  }

  if (!resultSnap.exists()) {
    container.innerHTML = `
      <div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">
        결과를 찾을 수 없습니다.<br>
        <a href="#/" style="color:var(--gold);">처음으로</a>
      </div>`;
    return;
  }

  const c = caseSnap.exists() ? caseSnap.data() : {};
  const r = resultSnap.data();
  const isOwner = caseSnap.exists() && c.userId === auth.currentUser?.uid;
  const isPublic = !!(c.isPublic || r.isPublic);
  const title = c.caseTitle || r.caseTitle || '생활분쟁 사건';
  const docket = r.docketNumber || c.docketNumber || '사건번호 미상';
  const date = fmtDate(r.createdAt || c.createdAt);

  const sections = [
    ['01', '사건접수', '사건접수보고서', r.reception],
    ['02', '수사보고', '정황 및 증거 검토', r.investigation],
    ['03', '원고측 변론', '청구취지 및 주장요지', r.plaintiffArg],
    ['04', '피고측 변론', '답변취지 및 항변요지', r.defendantArg],
    ['05', '재판부 판결', '주문 및 판단이유', r.verdict]
  ];

  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">⚖️ 판결문</span></div>
      <div class="container" style="padding-top:26px;padding-bottom:90px;">
        <header class="card court-document" style="padding:24px 20px;text-align:center;margin-bottom:16px;border-color:rgba(201,168,76,.58);">
          <div style="font-size:11px;color:var(--gold);font-weight:900;letter-spacing:.16em;">소소킹 판결소 제3생활부</div>
          <div style="width:44px;height:2px;background:var(--gold);margin:12px auto;"></div>
          <h1 style="margin:0;font-family:var(--font-serif);font-size:24px;line-height:1.5;">판 결 문</h1>
          <h2 style="margin:14px 0 7px;font-size:20px;line-height:1.5;">${escapeHtml(title)}</h2>
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.75;">
            사건번호 ${escapeHtml(docket)}${date ? ` · ${escapeHtml(date)}` : ''}<br>
            원고 ${escapeHtml(c.nickname || r.nickname || '익명')}
          </div>
        </header>

        ${sections.map(([number, sectionTitle, subtitle, content], index) =>
          documentSection(number, sectionTitle, subtitle, content, index === 4)
        ).join('')}

        <div style="text-align:center;margin:18px 0;padding:11px;background:rgba(255,255,255,.04);border-radius:8px;font-size:11px;color:var(--cream-dim);line-height:1.7;">
          본 문서는 AI가 실제 문서 형식을 흉내 내어 만든 오락 콘텐츠이며 법적 효력이 없습니다.
        </div>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border);">
          <div style="font-family:var(--font-serif);font-size:18px;font-weight:900;color:var(--gold);margin-bottom:12px;">방청석</div>
          ${renderReactions(social, isPublic)}
          ${renderComments(social.comments, isPublic)}
        </div>

        <div class="result-actions">
          ${isOwner ? `<button class="btn ${isPublic ? 'btn-ghost' : 'btn-primary'}" id="btn-share">${isPublic ? '🔒 판결기록 비공개로 전환' : '🔗 판결기록에 공개하기'}</button>` : ''}
          <a href="#/submit" class="btn btn-secondary">새 사건 접수하기</a>
          <a href="#/board" class="btn btn-ghost">판결기록 보기</a>
        </div>
      </div>
    </div>`;

  bindResultActions(container, caseId, c, r, isOwner, isPublic);
}

function documentSection(number, title, subtitle, content, verdict = false) {
  return `<section class="card court-document step-card visible ${verdict ? 'verdict-card' : ''}" style="margin-bottom:14px;padding:22px;position:relative;overflow:hidden;">
    ${verdict ? '<div class="verdict-stamp">판결</div>' : ''}
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:15px;padding-bottom:11px;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:10px;color:var(--gold);font-weight:900;letter-spacing:.14em;">DOCUMENT ${number}</div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:900;margin-top:4px;">${escapeHtml(title)}</div>
      </div>
      <span class="badge badge-gold">${escapeHtml(subtitle)}</span>
    </div>
    <div class="step-content" style="white-space:pre-line;line-height:1.95;">${escapeHtml(content || '')}</div>
  </section>`;
}

function renderReactions(social, isPublic) {
  const counts = social.reactions?.counts || {};
  const total = Number(social.reactions?.total || Object.values(counts).reduce((a, b) => a + Number(b || 0), 0));

  return `<div class="card" style="padding:18px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:12px;">
      <div style="font-weight:900;color:var(--gold);">🧑‍⚖️ 배심원 투표</div>
      <div style="font-size:12px;color:var(--cream-dim);">총 ${total}표</div>
    </div>
    ${!isPublic ? `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px;">판결기록에 공개하면 다른 사람들이 투표할 수 있습니다.</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr;gap:8px;">
      ${REACTIONS.map(([key, label]) => {
        const n = Number(counts[key] || 0);
        const pct = total ? Math.round(n / total * 100) : 0;
        const active = social.myReaction === key;
        return `<button class="reaction-btn" data-reaction="${key}" ${!isPublic ? 'disabled' : ''} style="text-align:left;border:1px solid ${active ? 'rgba(201,168,76,.8)' : 'var(--border)'};background:${active ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.03)'};color:var(--cream);border-radius:12px;padding:11px 12px;cursor:${isPublic ? 'pointer' : 'not-allowed'};">
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;"><span>${label}</span><span>${n}표 · ${pct}%</span></div>
          <div style="height:5px;border-radius:999px;background:rgba(255,255,255,.06);margin-top:8px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:#c9a84c;"></div></div>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function renderComments(comments, isPublic) {
  return `<div class="card" style="padding:18px;margin-bottom:14px;">
    <div style="font-weight:900;color:var(--gold);margin-bottom:12px;">💬 방청석 한마디</div>
    ${isPublic ? `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input id="court-comment-input" class="form-input" maxlength="120" placeholder="예: 빈 접시가 모든 것을 말해주네요" style="flex:1;">
        <button id="court-comment-btn" class="btn btn-secondary" style="width:86px;padding-left:0;padding-right:0;">등록</button>
      </div>` : `
      <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">공개 판결기록에서 방청석 한마디를 남길 수 있습니다.</div>`}
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${comments.length
        ? comments.map(cm => `<div style="padding:11px 0;border-top:1px solid var(--border);"><div style="font-size:12px;color:var(--gold);font-weight:800;">${escapeHtml(cm.nickname || '익명 방청객')}</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.65;margin-top:3px;">${escapeHtml(cm.text || '')}</div></div>`).join('')
        : `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;">아직 방청석이 조용합니다. 첫 한마디를 남겨보세요.</div>`}
    </div>
  </div>`;
}

function bindResultActions(container, caseId, c, r, isOwner, isPublic) {
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await httpsCallable(functions, 'voteResult')({ caseId, reaction: btn.dataset.reaction });
        showToast('배심원 의견이 기록되었습니다.', 'success');
        renderResult(container, caseId);
      } catch (err) {
        console.error(err);
        showToast((err.message || '투표에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
      }
    });
  });

  document.getElementById('court-comment-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('court-comment-input');
    const text = input?.value?.trim() || '';
    if (text.length < 2) return showToast('방청석 한마디를 2자 이상 입력해주세요.', 'error');

    try {
      await httpsCallable(functions, 'addCourtComment')({ caseId, text });
      showToast('방청석에 기록되었습니다.', 'success');
      renderResult(container, caseId);
    } catch (err) {
      console.error(err);
      showToast((err.message || '등록에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
    }
  });

  if (isOwner) {
    document.getElementById('btn-share')?.addEventListener('click', async () => {
      const newPublic = !isPublic;

      try {
        await updateDoc(doc(db, 'results', caseId), {
          isPublic: newPublic,
          caseTitle: c.caseTitle || r.caseTitle || '생활분쟁 사건',
          createdAt: r.createdAt || c.createdAt || new Date(),
          updatedAt: new Date()
        });
        await updateDoc(doc(db, 'cases', caseId), {
          isPublic: newPublic,
          updatedAt: new Date()
        });

        if (newPublic) {
          const url = `${location.origin}/#/result/${encodeURIComponent(caseId)}`;
          await navigator.clipboard.writeText(url).catch(() => {});
          showToast('판결기록 공개 완료. 링크가 복사되었습니다.', 'success');
        } else {
          showToast('비공개로 전환되었습니다.', 'success');
        }

        renderResult(container, caseId);
      } catch (err) {
        console.error(err);
        showToast('처리 중 오류가 발생했습니다.', 'error');
      }
    });
  }
}
