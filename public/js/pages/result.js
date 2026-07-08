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
function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}
function emptySocial() {
  return { reactions: { counts: {}, total: 0 }, myReaction: '', comments: [] };
}
function verdictType(r) {
  const text = `${r.courtOpinion || ''} ${r.sentence || ''}`;
  if (text.includes('기각')) return '황당 일부기각';
  if (text.includes('쌍방')) return '쌍방 황당';
  if (text.includes('인용') || text.includes('인정')) return '원고 마음속 일부승소';
  return '소소평온 회복명령';
}
function titleBadge(c, r) {
  const g = Number(c.grievanceIndex || r.grievanceIndex || 5);
  if ((r.judgeType || '').includes('과몰입')) return '과몰입 기록보존 대상';
  if ((r.judgeType || '').includes('엄벌')) return '엄숙처분 청구인';
  if (g >= 8) return '극대노 원고';
  if (g >= 6) return '정식 황당사건 원고';
  return '생활평온권 주장인';
}
function paragraphs(text) {
  return escapeHtml(String(text || '')).replace(/\n/g, '<br>');
}
function imageSrc(image) {
  if (!image || typeof image !== 'object') return '';
  const mime = String(image.mimeType || '');
  const data = String(image.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return '';
  if (!data || data.length > 750000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return '';
  return `data:${mime};base64,${data}`;
}
function caseInfoRow(label, value) {
  return `<div class="case-info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '-')}</strong></div>`;
}
function caseInfoCard(rows) {
  return `<section class="case-info-card">
    ${rows.map(([label, value]) => caseInfoRow(label, value)).join('')}
  </section>`;
}
function pointList(title, items, emptyText) {
  const rows = Array.isArray(items) ? items.filter(Boolean).slice(0, 8) : [];
  if (!rows.length) return '';
  return `<section class="point-card">
    <div class="point-title">${escapeHtml(title)}</div>
    <div class="point-list">
      ${rows.map((x, i) => `<div class="point-item"><em>${String(i + 1).padStart(2, '0')}</em><span>${escapeHtml(x)}</span></div>`).join('')}
    </div>
  </section>`;
}
function imageCard(image) {
  const src = imageSrc(image);
  if (!src) return '';
  const meta = [
    image.width && image.height ? `${Number(image.width)}×${Number(image.height)}` : '',
    image.originalSize ? `원본 ${formatBytes(image.originalSize)}` : ''
  ].filter(Boolean).join(' · ');
  return `<section class="case-section image-section">
    <div class="section-head"><span>첨부 이미지 참고자료</span></div>
    <img src="${src}" alt="첨부 이미지">
    <p>${escapeHtml(meta || '첨부 이미지')}</p>
  </section>`;
}
function storySection(title, subtitle, content, mark = '') {
  if (!String(content || '').trim()) return '';
  return `<section class="case-section">
    <div class="section-head">
      <span>${escapeHtml(title)}</span>
      ${mark ? `<em>${escapeHtml(mark)}</em>` : ''}
    </div>
    ${subtitle ? `<div class="section-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    <div class="section-body">${paragraphs(content)}</div>
  </section>`;
}
function coverCard({ icon, resultTitle, docket, createdAt, finalTitle, type, badge }) {
  return `<section class="case-cover">
    <div class="cover-kicker">소소킹 황당재판소 사건기록철</div>
    <div class="cover-icon">${icon}</div>
    <h1>${escapeHtml(resultTitle)}</h1>
    <div class="cover-line"></div>
    <div class="cover-meta">
      <span>${escapeHtml(docket)}</span>
      <span>${escapeHtml(createdAt || '기록시각 미상')}</span>
    </div>
    <div class="cover-tags">
      <span>${escapeHtml(type)}</span>
      <span>${escapeHtml(badge)}</span>
    </div>
    <div class="cover-case-name">${escapeHtml(finalTitle)}</div>
  </section>`;
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

  let resultSnap;
  try {
    resultSnap = await getDoc(doc(db, 'results', caseId));
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 불러올 권한이 없거나 삭제된 황당판결문입니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
    return;
  }
  if (!resultSnap.exists()) {
    container.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">결과를 찾을 수 없습니다.<br><a href="#/" style="color:var(--gold);">처음으로</a></div>`;
    return;
  }

  const r = resultSnap.data();
  let caseSnap = null;
  try { caseSnap = await getDoc(doc(db, 'cases', caseId)); } catch (err) { console.warn('case read skipped:', err.message || err); }
  const c = caseSnap?.exists() ? caseSnap.data() : {};
  const social = await loadSocial(caseId).catch(() => emptySocial());
  const icon = JUDGE_ICON[r.judgeType] || '⚖️';
  const isOwner = !!(caseSnap?.exists() && c.userId === auth.currentUser?.uid);
  const isPublic = r.isPublic === true || (isOwner && c.isPublic === true);
  const type = verdictType(r);
  const badge = titleBadge(c, r);
  const finalTitle = r.refinedCaseTitle || r.caseTitle || c.caseTitle || '황당사건';
  const resultTitle = r.absurdityTitle || `${finalTitle} 기록철`;
  const docket = r.docketNumber || c.docketNumber || '황당사건번호 미상';
  const createdAtText = fmtDate(r.createdAt || c.createdAt);
  const expandedCase = r.expandedCase || r.reception || '';
  const timeline = r.caseTimeline || r.investigation || '';
  const judgment = r.courtOpinion || r.verdict || '';
  const finalNotice = r.executionOrder || '본 기록은 실제 법률문서가 아니며, 당사자 사이의 웃음 회복을 위한 임의적 기록입니다.';
  const details = Array.isArray(r.absurdDetails) ? r.absurdDetails : [];
  const evidence = Array.isArray(r.evidenceBits) ? r.evidenceBits : [];
  const documentRows = [
    ['사건번호', docket],
    ['사건일시', createdAtText || '기록시각 미상'],
    ['사건명', finalTitle],
    ['관할', r.courtName || c.courtName || '소소킹 황당재판소'],
    ['재판부', r.division || c.division || '제3황당재판부'],
    ['법정', r.courtroom || c.courtroom || '제404호 황당법정'],
    ['기록관', r.recordClerk || c.recordClerk || '기록관 미상'],
    ['담당판사', `${r.judgeType || '황당'} 재판부`]
  ];

  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">⚖️ 황당판결문</span></div>
      <div class="container result-file" style="padding-top:24px;padding-bottom:90px;">
        ${coverCard({ icon, resultTitle, docket, createdAt: createdAtText, finalTitle, type, badge })}
        ${caseInfoCard(documentRows)}
        ${details.length || evidence.length ? `<div class="point-grid">${pointList('황당 포인트', details)}${pointList('현장 증거', evidence)}</div>` : ''}
        ${isOwner ? imageCard(c.imageAttachment) : ''}

        ${storySection('사건 배경 및 발단', '사건이 시작된 장면과 원고가 잃어버린 작은 평온을 기록합니다.', expandedCase, '기록')}
        ${storySection('분초 단위 사건일지', '평온이 무너진 순간을 시간순으로 재구성합니다.', timeline, '일지')}
        ${storySection('소소국과수 감정서', '현장에 남은 사소한 흔적을 지나치게 엄숙하게 감정합니다.', r.forensicReport, '감정')}
        ${storySection('황당검사 공소장', `${r.prosecutorName || '황당검사'} 작성`, r.plaintiffArg, '공소')}
        ${storySection('피고 측 답변서', `${r.defenderName || '피고측 변호인'} 제출`, r.defendantArg, '항변')}
        ${storySection('재판부 판단', '양측 주장과 생활증거 감정결과를 종합한 판단입니다.', judgment, '판단')}
        ${storySection('주문 및 집행권고', '선고 즉시 마음속 기록철에 편철됩니다.', r.sentence, '주문')}
        ${r.closingComment ? `<section class="closing-card">${escapeHtml(r.closingComment)}</section>` : ''}

        ${renderReactions(social, isPublic)}
        ${renderComments(social.comments, isPublic)}

        <div class="legal-note">${escapeHtml(finalNotice)}</div>

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
  return `<section class="case-section jury-section">
    <div class="section-head"><span>방청객 배심원 투표</span><em>총 ${total}표</em></div>
    ${!isPublic ? `<div class="section-subtitle">황당판결 기록에 공개하면 다른 사람들이 원고 편/피고 편 투표를 할 수 있습니다.</div>` : ''}
    <div class="reaction-list">
      ${REACTIONS.map(([key,label]) => {
        const n = Number(counts[key] || 0);
        const pct = total ? Math.round(n / total * 100) : 0;
        const active = social.myReaction === key;
        return `<button class="reaction-btn ${active ? 'is-active' : ''}" data-reaction="${key}" ${!isPublic ? 'disabled' : ''}><div><span>${label}</span><strong>${n}표 · ${pct}%</strong></div><i><b style="width:${pct}%;"></b></i></button>`;
      }).join('')}
    </div>
  </section>`;
}
function renderComments(comments, isPublic) {
  return `<section class="case-section comments-section">
    <div class="section-head"><span>방청석 한마디</span></div>
    ${isPublic ? `<div class="comment-write"><input id="court-comment-input" class="form-input" maxlength="120" placeholder="예: 이건 리트리버 쪽도 입장을 들어봐야 함"><button id="court-comment-btn" class="btn btn-secondary">등록</button></div>` : `<div class="section-subtitle">공개 황당판결 기록에서 방청석 한마디를 남길 수 있습니다.</div>`}
    <div class="comment-list">
      ${comments.length ? comments.map(cm => `<div class="comment-item"><strong>${escapeHtml(cm.nickname || '익명 방청객')}</strong><p>${escapeHtml(cm.text || '')}</p></div>`).join('') : `<div class="section-subtitle">아직 방청석이 조용합니다. 첫 한마디를 남겨보세요.</div>`}
    </div>
  </section>`;
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
  if (isOwner) {
    document.getElementById('btn-share')?.addEventListener('click', async () => {
      const newPublic = !isPublic;
      try {
        await updateDoc(doc(db, 'results', caseId), { isPublic: newPublic });
        await updateDoc(doc(db, 'cases', caseId), { isPublic: newPublic }).catch(() => null);
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
