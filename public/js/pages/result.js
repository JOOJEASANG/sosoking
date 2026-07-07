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
  if (text.includes('기각')) return '황당 일부기각';
  if (text.includes('쌍방')) return '쌍방 황당';
  if (text.includes('조정')) return '황당조정권고';
  if (text.includes('인정')) return '억울함 인정';
  return '원고 마음속 일부승소';
}

function titleBadge(c, r) {
  const g = Number(c.grievanceIndex || r.grievanceIndex || 5);
  if ((r.judgeType || '').includes('드립')) return '법정 드립 감정관';
  if ((r.judgeType || '').includes('과몰입')) return '제404호 과몰입 당사자';
  if (g >= 9) return '극대노 원고';
  if (g >= 7) return '황당재판 정식회원';
  if (g <= 3) return '소심한 방청객';
  return '억울함 감별사';
}

function scoreMetrics(c, r) {
  const g = Number(c.grievanceIndex || r.grievanceIndex || 5);
  const strict = (r.judgeType === '엄벌주의형' ? 88 : r.judgeType === '현실주의형' ? 62 : 70) + Math.min(g, 10);
  const joke = r.judgeType === '드립형' ? 96 : r.judgeType === '과몰입형' ? 88 : 70;
  const sympathy = r.judgeType === '감성형' ? 95 : 56 + g * 4;
  const chaos = r.judgeType === '피곤형' ? 72 : r.judgeType === '논리집착형' ? 66 : 54 + g * 4;
  return [
    ['재판부 과몰입', Math.min(strict, 99)],
    ['황당성', Math.min(joke, 99)],
    ['억울함 인정률', Math.min(sympathy, 99)],
    ['처분 웃김 강도', Math.min(chaos, 99)]
  ];
}

function paragraphs(text) {
  return escapeHtml(String(text || '')).replace(/\n/g, '<br>');
}
function arr(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}
function sectionCard(icon, title, sub, content, badge = '') {
  if (!content) return '';
  return `<div class="card step-card visible" style="margin-bottom:12px;padding:18px;position:relative;overflow:hidden;">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:9px;">
      <div>
        <div class="step-role">${escapeHtml(icon)} ${escapeHtml(title)}</div>
        ${sub ? `<div style="font-size:11px;color:var(--cream-dim);margin-top:3px;">${escapeHtml(sub)}</div>` : ''}
      </div>
      ${badge ? `<span class="badge badge-gold">${escapeHtml(badge)}</span>` : ''}
    </div>
    <div class="step-content" style="white-space:pre-line;line-height:1.85;">${paragraphs(content)}</div>
  </div>`;
}
function listCard(icon, title, sub, items, emptyText = '') {
  const rows = arr(items);
  if (!rows.length && !emptyText) return '';
  return `<div class="card step-card visible" style="margin-bottom:12px;padding:18px;">
    <div class="step-role" style="margin-bottom:5px;">${escapeHtml(icon)} ${escapeHtml(title)}</div>
    ${sub ? `<div style="font-size:11px;color:var(--cream-dim);line-height:1.6;margin-bottom:11px;">${escapeHtml(sub)}</div>` : ''}
    ${rows.length ? `<div style="display:flex;flex-direction:column;gap:9px;">${rows.map((x, i) => `<div style="display:flex;gap:10px;padding:11px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.025);"><div style="color:var(--gold);font-weight:900;min-width:22px;">${i + 1}</div><div style="font-size:13px;color:var(--cream);line-height:1.7;">${escapeHtml(x)}</div></div>`).join('')}</div>` : `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;">${escapeHtml(emptyText)}</div>`}
  </div>`;
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
  container.innerHTML = `<div class="page-header"><span class="logo">⚖️ 황당판결문</span></div><div class="container" style="padding:28px 20px 80px;"><div class="loading-dots"><span></span><span></span><span></span></div></div>`;

  let caseSnap, resultSnap, social;
  try {
    [caseSnap, resultSnap, social] = await Promise.all([
      getDoc(doc(db, 'cases', caseId)),
      getDoc(doc(db, 'results', caseId)),
      loadSocial(caseId)
    ]);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 불러올 권한이 없거나 삭제된 황당판결문입니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
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
  const resultTitle = r.absurdityTitle || c.caseTitle || r.caseTitle || '황당판결문';
  const docket = r.docketNumber || c.docketNumber || '황당사건번호 미상';

  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">⚖️ 황당판결문</span></div>
      <div class="container" style="padding-top:26px;padding-bottom:90px;">
        <div class="card" style="padding:20px;text-align:center;margin-bottom:14px;border-color:rgba(201,168,76,.55);">
          <div style="font-size:56px;margin-bottom:8px;">${icon}</div>
          <div class="badge badge-gold" style="font-size:13px;padding:5px 14px;">${escapeHtml(r.judgeType || 'AI')} 재판부</div>
          <h2 style="margin:14px 0 6px;font-size:21px;line-height:1.45;">${escapeHtml(resultTitle)}</h2>
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.75;">${escapeHtml(docket)}<br>${escapeHtml(r.courtName || c.courtName || '소소킹 황당재판소')} · ${escapeHtml(r.division || c.division || '제3황당재판부')}<br>${escapeHtml(r.courtroom || c.courtroom || '제404호 황당법정')} · 억울지수 ${escapeHtml(c.grievanceIndex || r.grievanceIndex || '?')}/10${c.createdAt ? ` · ${escapeHtml(fmtDate(c.createdAt))}` : ''}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
          <div class="card" style="padding:14px;text-align:center;"><div style="font-size:11px;color:var(--cream-dim);">판결 유형</div><div style="font-size:17px;font-weight:900;color:var(--gold);margin-top:4px;">${escapeHtml(type)}</div></div>
          <div class="card" style="padding:14px;text-align:center;"><div style="font-size:11px;color:var(--cream-dim);">사용자 칭호</div><div style="font-size:17px;font-weight:900;color:var(--gold);margin-top:4px;">${escapeHtml(badge)}</div></div>
        </div>

        <div class="card" style="padding:16px;margin-bottom:14px;">
          <div style="font-weight:900;color:var(--gold);margin-bottom:12px;">📊 이번 황당재판 성향</div>
          ${metrics.map(([label, value]) => `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--cream-dim);margin-bottom:5px;"><span>${escapeHtml(label)}</span><span>${value}%</span></div><div style="height:7px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;"><div style="width:${value}%;height:100%;background:linear-gradient(90deg,#8a6f28,#c9a84c);"></div></div></div>`).join('')}
        </div>

        <div class="card" style="padding:16px;margin-bottom:14px;border-color:rgba(201,168,76,.45);background:rgba(201,168,76,.07);">
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.8;">본 판결은 법적 효력은 없으나, 마음속 억울함에는 상당한 진정 효과가 있을 수 있습니다. 재판부는 사소한 일을 굳이 크게 만들기 위해 최선을 다했습니다.</div>
        </div>

        ${sectionCard('📋', '황당사건 접수기록', `${escapeHtml(r.recordClerk || c.recordClerk || '기록관')} 작성`, r.reception, '접수')}
        ${sectionCard('😳', '재판부의 1차 고민', '이걸 정말 재판까지 해야 하는지에 대한 엄숙한 검토', r.absurdityReview, '황당성 검토')}
        ${listCard('🧷', '핵심 쟁점', '별일 아닌데 굳이 법정 쟁점처럼 정리한 항목입니다.', r.keyIssues, '쟁점 없음')}
        ${listCard('🔍', '증거 아닌 증거 목록', '증거능력은 없지만 웃기기에는 충분한 자료입니다.', r.evidenceList, '증거 아닌 증거가 아직 제출되지 않았습니다.')}
        ${sectionCard('🧪', '억울함 분석 결과', `${escapeHtml(r.analystName || c.analystName || '억울함 분석관')} 의견`, r.investigation, '분석')}
        ${sectionCard('💼', '원고 측 주장', '내가 이걸로 재판까지 해야 하나 싶은 바로 그 심정', r.plaintiffArg, '원고')}
        ${sectionCard('🛡️', '피고 측 변명 추정', '피고가 할 법한 말을 재판부가 미리 엄숙하게 정리', r.defendantArg, '피고')}
        ${sectionCard('⚖️', '재판부 판단', '가장 쓸데없이 진지한 부분', r.courtOpinion || r.verdict, '판단')}

        <div class="card verdict-card step-card visible" style="margin-bottom:12px;padding:22px;">
          <div style="margin-bottom:10px;"><span class="badge badge-gold">황당판결 선고</span></div>
          <div class="verdict-stamp">판결</div>
          <div class="step-content" style="margin-top:12px;white-space:pre-line;line-height:1.9;">${paragraphs(r.verdict || '')}</div>
        </div>
        <div class="card sentence-card step-card visible" style="margin-bottom:12px;">
          <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">📜 주문 · 생활형 처분</div>
          <div class="sentence-text" style="white-space:pre-line;line-height:1.9;">${paragraphs(r.sentence || '')}</div>
        </div>
        ${sectionCard('🔨', '집행명령', '선고 즉시 마음속으로 집행됩니다.', r.executionOrder, '집행')}
        ${sectionCard('🏛️', '항소 안내', '불복은 가능하나 더 황당해질 수 있습니다.', r.appealNotice, '항소')}
        ${r.closingComment ? `<div class="card" style="padding:18px;margin-bottom:16px;text-align:center;border-color:rgba(201,168,76,.5);"><div style="font-family:var(--font-serif);font-size:18px;color:var(--gold);font-weight:900;line-height:1.7;">${escapeHtml(r.closingComment)}</div></div>` : ''}

        ${r.appeal?.verdict ? `<div class="card" style="padding:20px;margin-bottom:16px;border-color:rgba(201,168,76,.55);"><div style="font-weight:900;color:var(--gold);margin-bottom:8px;">🏛️ 항소심 판결</div><div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px;">항소이유: ${escapeHtml(r.appeal.reason || '')}</div><div class="step-content" style="white-space:pre-line;">${paragraphs(r.appeal.verdict || '')}</div></div>` : ''}

        ${renderReactions(social, isPublic)}
        ${renderComments(social.comments, isPublic)}
        ${renderAppeal(isOwner, !!r.appeal?.verdict)}

        <div style="text-align:center;margin:16px 0;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;font-size:11px;color:var(--cream-dim);line-height:1.7;">🤖 본 황당판결문은 AI가 생성한 오락 콘텐츠입니다.<br>실제 법적 효력이 없으며 법률 자문으로 활용할 수 없습니다.</div>

        <div class="result-actions">
          ${isOwner ? `<button class="btn ${isPublic ? 'btn-ghost' : 'btn-primary'}" id="btn-share">${isPublic ? '🔒 황당판결 비공개로 전환' : '🔗 황당판결 기록에 공개하기'}</button>` : ''}
          <a href="#/submit" class="btn btn-secondary">새 황당사건 접수하기</a>
          <a href="#/board" class="btn btn-ghost">황당판결 기록 보기</a>
        </div>
      </div>
    </div>`;

  bindResultActions(container, caseId, c, r, isOwner, isPublic);
}

function renderReactions(social, isPublic) {
  const counts = social.reactions?.counts || {};
  const total = Number(social.reactions?.total || Object.values(counts).reduce((a, b) => a + Number(b || 0), 0));
  return `<div class="card" style="padding:18px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:12px;"><div style="font-weight:900;color:var(--gold);">🧑‍⚖️ 방청객 배심원 투표</div><div style="font-size:12px;color:var(--cream-dim);">총 ${total}표</div></div>
    ${!isPublic ? `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px;">황당판결 기록에 공개하면 다른 사람들이 원고 편/피고 편 투표를 할 수 있습니다.</div>` : ''}
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
    ${isPublic ? `<div style="display:flex;gap:8px;margin-bottom:12px;"><input id="court-comment-input" class="form-input" maxlength="120" placeholder="예: 이걸로 재판까지 간 게 제일 웃김" style="flex:1;"><button id="court-comment-btn" class="btn btn-secondary" style="width:86px;padding-left:0;padding-right:0;">등록</button></div>` : `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">공개 황당판결 기록에서 방청석 한마디를 남길 수 있습니다.</div>`}
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${comments.length ? comments.map(cm => `<div style="padding:11px 0;border-top:1px solid var(--border);"><div style="font-size:12px;color:var(--gold);font-weight:800;">${escapeHtml(cm.nickname || '익명 방청객')}</div><div style="font-size:13px;color:var(--cream-dim);line-height:1.65;margin-top:3px;">${escapeHtml(cm.text || '')}</div></div>`).join('') : `<div style="font-size:12px;color:var(--cream-dim);line-height:1.7;">아직 방청석이 조용합니다. 첫 한마디를 남겨보세요.</div>`}
    </div>
  </div>`;
}

function renderAppeal(isOwner, hasAppeal) {
  if (!isOwner || hasAppeal) return '';
  return `<div class="card" style="padding:18px;margin-bottom:14px;border-color:rgba(201,168,76,.5);">
    <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">🏛️ 항소하기</div>
    <div style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">1심 황당판결이 너무 과하거나 약하다고 느껴지면 항소심을 열 수 있습니다. 항소심도 오락 목적이며 실제 법적 효력은 없습니다.</div>
    <textarea id="appeal-reason" class="form-textarea" maxlength="160" placeholder="항소이유 예: 피고의 반성 태도가 전혀 보이지 않습니다." style="min-height:76px;margin-bottom:10px;"></textarea>
    <button id="appeal-btn" class="btn btn-primary">항소장 제출</button>
  </div>`;
}

function bindResultActions(container, caseId, c, r, isOwner, isPublic) {
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await httpsCallable(functions, 'voteResult')({ caseId, reaction: btn.dataset.reaction });
        showToast('방청객 의견이 기록되었습니다.', 'success');
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
    btn.textContent = '항소심 황당재판부 배당 중...';
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
        await updateDoc(doc(db, 'results', caseId), { isPublic: newPublic });
        await updateDoc(doc(db, 'cases', caseId), { isPublic: newPublic });
        if (newPublic) {
          const url = `${location.origin}/#/result/${encodeURIComponent(caseId)}`;
          await navigator.clipboard.writeText(url).catch(() => {});
          showToast('황당판결 기록 공개 완료. 링크가 복사되었습니다.', 'success');
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
