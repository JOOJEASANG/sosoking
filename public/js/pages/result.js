import { db, auth, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦','과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

const REACTIONS = [
  ['plaintiff','⚖️ 원고 편'],
  ['defendant','🛡️ 피고 편'],
  ['both','🤝 쌍방과실'],
  ['tooMuch','😳 판사님 과합니다'],
  ['funny','😂 웃겼다']
];

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function verdictType(r) {
  const text = `${r.verdict || ''} ${r.sentence || ''}`;
  if (text.includes('기각')) return '기각';
  if (text.includes('조정')) return '조정권고';
  if (text.includes('쌍방')) return '쌍방과실';
  if (text.includes('일부')) return '일부 인용';
  return '원고 일부 승소';
}

function titleBadge(c, r) {
  const g = Number(c.grievanceIndex || r.grievanceIndex || 5);
  if ((r.judgeType || '').includes('드립')) return '법정 드립 감정관';
  if (g >= 9) return '극대노 원고';
  if (g >= 7) return '생활분쟁 고급반';
  if (g <= 3) return '소심한 방청객';
  return '억울함 감별사';
}

function scoreMetrics(c, r) {
  const g = Number(c.grievanceIndex || r.grievanceIndex || 5);
  const strict = (r.judgeType === '엄벌주의형' ? 85 : r.judgeType === '현실주의형' ? 58 : 68) + Math.min(g, 10);
  const joke = r.judgeType === '드립형' ? 92 : r.judgeType === '과몰입형' ? 82 : 64;
  const sympathy = r.judgeType === '감성형' ? 93 : 55 + g * 4;
  const chaos = r.judgeType === '피곤형' ? 70 : r.judgeType === '논리집착형' ? 61 : 50 + g * 3;
  return [
    ['엄숙함', Math.min(strict, 99)],
    ['드립력', Math.min(joke, 99)],
    ['억울함 인정률', Math.min(sympathy, 99)],
    ['생활형 처분 강도', Math.min(chaos, 99)]
  ];
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
    comments: commentSnap?.docs?.map(d => ({ id: d.id, ...d.data() })) || []
  };
}

export async function renderResult(container, caseId) {
  container.innerHTML = `<div class="page-header"><span class="logo">⚖️ 판결 결과</span></div><div class="container" style="padding:28px 20px 80px;"><div class="loading-dots"><span></span><span></span><span></span></div></div>`;

  let caseSnap, resultSnap, social;
  try {
    [caseSnap, resultSnap, social] = await Promise.all([
      getDoc(doc(db, 'cases', caseId)),
      getDoc(doc(db, 'results', caseId)),
      loadSocial(caseId)
    ]);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 불러올 권한이 없거나 삭제된 판결문입니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
    return;
  }

  if (!resultSnap.exists()) {
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 찾을 수 없습니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
    return;
  }

  const c = caseSnap.exists() ? caseSnap.data() : {};
  const r = resultSnap.data();
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const isOwner = caseSnap.exists() && c.userId === auth.currentUser?.uid;
  const isPublic = !!(c.isPublic || r.isPublic);
  const type = verdictType(r);
  const badge = titleBadge(c, r);
  const metrics = scoreMetrics(c, r);

  const steps = [
    ['📋 접수계','소장 접수 및 사건번호 부여', r.reception],
    ['🔍 조사관','증거조사조서', r.investigation],
    ['💼 원고 측','준비서면 및 최종변론', r.plaintiffArg],
    ['🛡️ 피고 측','답변서 및 항변', r.defendantArg],
  ];

  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">⚖️ 판결 결과</span></div>
      <div class="container" style="padding-top:26px;padding-bottom:90px;">
        <div class="card" style="padding:20px;text-align:center;margin-bottom:14px;border-color:rgba(201,168,76,.55);">
          <div style="font-size:56px;margin-bottom:8px;">${icon}</div>
          <div class="badge badge-gold" style="font-size:13px;padding:5px 14px;">${escapeHtml(r.judgeType || 'AI')} 판사</div>
          <h2 style="margin:14px 0 6px;font-size:21px;line-height:1.45;">${escapeHtml(c.caseTitle || r.caseTitle || '판결 결과')}</h2>
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(r.docketNumber || c.docketNumber || '소소킹 사건번호 미상')}<br>억울지수 ${escapeHtml(c.grievanceIndex || r.grievanceIndex || '?')}/10${c.createdAt ? ` · ${escapeHtml(fmtDate(c.createdAt))}` : ''}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
          <div class="card" style="padding:14px;text-align:center;"><div style="font-size:11px;color:var(--cream-dim);">판결 유형</div><div style="font-size:17px;font-weight:900;color:var(--gold);margin-top:4px;">${escapeHtml(type)}</div></div>
          <div class="card" style="padding:14px;text-align:center;"><div style="font-size:11px;color:var(--cream-dim);">사용자 칭호</div><div style="font-size:17px;font-weight:900;color:var(--gold);margin-top:4px;">${escapeHtml(badge)}</div></div>
        </div>

        <div class="card" style="padding:16px;margin-bottom:14px;">
          <div style="font-weight:900;color:var(--gold);margin-bottom:12px;">📊 이번 판결 성향</div>
          ${metrics.map(([label, value]) => `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--cream-dim);margin-bottom:5px;"><span>${escapeHtml(label)}</span><span>${value}%</span></div><div style="height:7px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;"><div style="width:${value}%;height:100%;background:linear-gradient(90deg,#8a6f28,#c9a84c);"></div></div></div>`).join('')}
        </div>

        ${steps.map(([role,label,content]) => `<div class="card step-card visible" style="margin-bottom:12px;"><div class="step-role">${escapeHtml(role)} · ${escapeHtml(label)}</div><div class="step-content">${escapeHtml(content || '')}</div></div>`).join('')}

        <div class="card verdict-card step-card visible" style="margin-bottom:12px;padding:22px;">
          <div style="margin-bottom:10px;"><span class="badge badge-gold">최종 판결문</span></div>
          <div class="verdict-stamp">판결</div>
          <div class="step-content" style="margin-top:12px;">${escapeHtml(r.verdict || '')}</div>
        </div>
        <div class="card sentence-card step-card visible" style="margin-bottom:16px;">
          <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">📜 주문 · 생활형 처분</div>
          <div class="sentence-text">${escapeHtml(r.sentence || '')}</div>
        </div>

        ${r.appeal?.verdict ? `<div class="card" style="padding:20px;margin-bottom:16px;border-color:rgba(201,168,76,.55);"><div style="font-weight:900;color:var(--gold);margin-bottom:8px;">🏛️ 항소심 판결</div><div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px;">항소이유: ${escapeHtml(r.appeal.reason || '')}</div><div class="step-content">${escapeHtml(r.appeal.verdict || '')}</div></div>` : ''}

        ${renderReactions(social, isPublic)}
        ${renderComments(social.comments, isPublic)}
        ${renderAppeal(isOwner, !!r.appeal?.verdict)}

        <div style="text-align:center;margin:16px 0;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;font-size:11px;color:var(--cream-dim);line-height:1.7;">🤖 본 판결문은 AI가 생성한 오락 콘텐츠입니다.<br>실제 법적 효력이 없으며 법률 자문으로 활용할 수 없습니다.</div>

        <div class="result-actions">
          ${isOwner ? `<button class="btn ${isPublic ? 'btn-ghost' : 'btn-primary'}" id="btn-share">${isPublic ? '🔒 판결기록 비공개로 전환' : '🔗 판결기록에 공개하기'}</button>` : ''}
          <a href="#/submit" class="btn btn-secondary">새 사건 접수하기</a>
          <a href="#/board" class="btn btn-ghost">판결기록 보기</a>
        </div>
      </div>
    </div>`;

  bindResultActions(container, caseId, c, r, isOwner, isPublic);
}

function renderReactions(social, isPublic) {
  const counts = social.reactions?.counts || {};
  const total = Number(social.reactions?.total || Object.values(counts).reduce((a, b) => a + Number(b || 0), 0));
  return `<div class="card" style="padding:18px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:12px;"><div style="font-weight:900;color:var(--gold);">🧑‍⚖️ 배심원 투표</div><div style="font-size:12px;color:var(--cream-dim);">총 ${total}표</div></div>
    ${!isPublic ? `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px;">판결기록에 공개하면 다른 사람들이 원고 편/피고 편 투표를 할 수 있습니다.</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr;gap:8px;">
      ${REACTIONS.map(([key,label]) => {
        const n = Number(counts[key] || 0);
        const pct = total ? Math.round(n / total * 100) : 0;
        const active = social.myReaction === key;
        return `<button class="reaction-btn" data-reaction="${key}" ${!isPublic ? 'disabled' : ''} style="text-align:left;border:1px solid ${active ? 'rgba(201,168,76,.8)' : 'var(--border)'};background:${active ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.03)'};color:var(--cream);border-radius:12px;padding:11px 12px;cursor:${isPublic ? 'pointer' : 'not-allowed'};"><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;"><span>${label}</span><span>${n}표 · ${pct}%</span></div><div style="height:5px;border-radius:999px;background:rgba(255,255,255,.06);margin-top:8px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:#c9a84c;"></div></div></button>`;
      }).join('')}
    </div>
  </div>`;
}

function renderComments(comments, isPublic) {
  return `<div class="card" style="padding:18px;margin-bottom:14px;">
    <div style="font-weight:900;color:var(--gold);margin-bottom:12px;">💬 방청석 한마디</div>
    ${isPublic ? `<div style="display:flex;gap:8px;margin-bottom:12px;"><input id="court-comment-input" class="form-input" maxlength="120" placeholder="예: 판사님 오늘 컨디션 좋으신 듯" style="flex:1;"><button id="court-comment-btn" class="btn btn-secondary" style="width:86px;padding-left:0;padding-right:0;">등록</button></div>` : `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">공개 판결기록에서 방청석 한마디를 남길 수 있습니다.</div>`}
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${comments.length ? comments.map(cm => `<div style="padding:11px 0;border-top:1px solid var(--border);"><div style="font-size:12px;color:var(--gold);font-weight:800;">${escapeHtml(cm.nickname || '익명 방청객')}</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.65;margin-top:3px;">${escapeHtml(cm.text || '')}</div></div>`).join('') : `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;">아직 방청석이 조용합니다. 첫 한마디를 남겨보세요.</div>`}
    </div>
  </div>`;
}

function renderAppeal(isOwner, hasAppeal) {
  if (!isOwner || hasAppeal) return '';
  return `<div class="card" style="padding:18px;margin-bottom:14px;border-color:rgba(201,168,76,.5);">
    <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">🏛️ 항소하기</div>
    <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">1심 판결이 너무 과하거나 약하다고 느껴지면 항소심을 열 수 있습니다. 항소심도 오락 목적이며 실제 법적 효력은 없습니다.</div>
    <textarea id="appeal-reason" class="form-textarea" maxlength="160" placeholder="항소이유 예: 피고의 반성 태도가 전혀 보이지 않습니다." style="min-height:76px;margin-bottom:10px;"></textarea>
    <button id="appeal-btn" class="btn btn-primary">항소장 제출</button>
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

  document.getElementById('appeal-btn')?.addEventListener('click', async () => {
    const reason = document.getElementById('appeal-reason')?.value?.trim() || '';
    const btn = document.getElementById('appeal-btn');
    btn.disabled = true;
    btn.textContent = '항소심 재판부 배당 중...';
    try {
      await httpsCallable(functions, 'requestAppeal')({ caseId, reason });
      showToast('항소심 판결이 선고되었습니다.', 'success');
      renderResult(container, caseId);
    } catch (err) {
      console.error(err);
      showToast((err.message || '항소 처리에 실패했습니다.').replace('FirebaseError: ', ''), 'error');
      btn.disabled = false;
      btn.textContent = '항소장 제출';
    }
  });

  if (isOwner) {
    document.getElementById('btn-share')?.addEventListener('click', async () => {
      const newPublic = !isPublic;
      try {
        await updateDoc(doc(db, 'results', caseId), {
          isPublic: newPublic,
          caseTitle: c.caseTitle || r.caseTitle || '판결 결과',
          grievanceIndex: c.grievanceIndex || r.grievanceIndex || null,
          judgeType: r.judgeType || '',
          sentence: r.sentence || '',
          createdAt: r.createdAt || c.createdAt || new Date()
        });
        await updateDoc(doc(db, 'cases', caseId), { isPublic: newPublic });
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
