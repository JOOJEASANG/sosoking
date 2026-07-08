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
function imageSrc(image) {
  if (!image || typeof image !== 'object') return '';
  const mime = String(image.mimeType || '');
  const data = String(image.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return '';
  if (!data || data.length > 750000 || !/^[A-Za-z0-9+/=]+$/.test(data)) return '';
  return `data:${mime};base64,${data}`;
}
function imageCard(image) {
  const src = imageSrc(image);
  if (!src) return '';
  const meta = [
    image.width && image.height ? `${Number(image.width)}×${Number(image.height)}` : '',
    image.resizedSize ? `분석용 ${formatBytes(image.resizedSize)}` : '',
    image.originalSize ? `원본 ${formatBytes(image.originalSize)}` : ''
  ].filter(Boolean).join(' · ');
  return `<div class="card step-card visible" style="margin-bottom:12px;padding:18px;">
    <div class="step-role" style="margin-bottom:8px;">🖼️ 첨부 이미지 증거 아닌 증거 <span style="font-size:11px;color:var(--cream-dim);font-weight:400;">· 작성자에게만 표시</span></div>
    <img src="${src}" alt="첨부 이미지" style="width:100%;max-height:360px;object-fit:contain;border-radius:14px;border:1px solid var(--border);background:rgba(0,0,0,.18);">
    <div style="font-size:11px;color:var(--cream-dim);line-height:1.6;margin-top:8px;">${escapeHtml(meta || 'AI 분석용으로 자동 리사이즈된 이미지')}</div>
  </div>`;
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
  const metrics = scoreMetrics(c, r);
  const resultTitle = r.absurdityTitle || r.caseTitle || c.caseTitle || '황당판결문';
  const docket = r.docketNumber || c.docketNumber || '황당사건번호 미상';
  const createdAt = r.createdAt || c.createdAt;

  container.innerHTML = `
    <div>
      <div class="page-header"><span class="logo">⚖️ 황당판결문</span></div>
      <div class="container" style="padding-top:26px;padding-bottom:90px;">
        <div class="card" style="padding:20px;text-align:center;margin-bottom:14px;border-color:rgba(201,168,76,.55);">
          <div style="font-size:56px;margin-bottom:8px;">${icon}</div>
          <div class="badge badge-gold" style="font-size:13px;padding:5px 14px;">${escapeHtml(r.judgeType || 'AI')} 재판부</div>
          <h2 style="margin:14px 0 6px;font-size:21px;line-height:1.45;">${escapeHtml(resultTitle)}</h2>
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.75;">${escapeHtml(docket)}<br>${escapeHtml(r.courtName || c.courtName || '소소킹 황당재판소')} · ${escapeHtml(r.division || c.division || '제3황당재판부')}<br>${escapeHtml(r.courtroom || c.courtroom || '제404호 황당법정')} · 억울지수 ${escapeHtml(r.grievanceIndex || c.grievanceIndex || '?')}/10${createdAt ? ` · ${escapeHtml(fmtDate(createdAt))}` : ''}</div>
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
          <div style="font-size:12px;color:var(--cream-dim);line-height:1.8;">본 판결은 법적 효력은 없으나, 마음속 억울함에는 상당한 진정 효과가 있을 수 있습니다. 본 사건은 단심으로 종결되며, 재판부는 사소한 일을 굳이 크게 만들기 위해 최선을 다했습니다.</div>
        </div>

        ${isOwner ? imageCard(c.imageAttachment) : ''}
        ${sectionCard('🖼️', 'AI 이미지 감정', '첨부 이미지를 황당법정 참고자료로 분석했습니다.', r.imageAnalysis, '이미지 분석')}
        ${sectionCard('📋', '황당사건 접수기록', `${r.recordClerk || c.recordClerk || '기록관'} 작성`, r.reception, '접수')}
        ${sectionCard('😳', '재판부의 1차 검토', '사소한 일이 정식 사건처럼 커진 경위를 검토합니다.', r.absurdityReview, '검토')}
        ${listCard('🧷', '핵심 쟁점', '작은 사실관계를 법정 쟁점처럼 정리한 항목입니다.', r.keyIssues, '쟁점 없음')}
        ${listCard('🔍', '증거 아닌 증거 목록', '소소경찰이 수사기록에 편철한 정황자료입니다.', r.evidenceList, '증거 아닌 증거가 아직 제출되지 않았습니다.')}
        ${sectionCard('🧪', '소소경찰 수사기록', `${r.analystName || c.analystName || '수사관'} 의견`, r.investigation, '수사')}
        ${sectionCard('💼', '황당검사 측 공소제기', '작은 사실관계를 엄숙하게 확대 구성한 주장입니다.', r.plaintiffArg, '검사')}
        ${sectionCard('🛡️', '피고측 변호인 반박', '상식적이지만 얄미운 반박 의견입니다.', r.defendantArg, '변호인')}
        ${sectionCard('⚖️', '재판부 판단', '수사기록과 양측 공방을 종합한 판단입니다.', r.courtOpinion || r.verdict, '판단')}

        <div class="card verdict-card step-card visible" style="margin-bottom:12px;padding:22px;">
          <div style="margin-bottom:10px;"><span class="badge badge-gold">황당판결 선고</span></div>
          <div class="verdict-stamp">판결</div>
          <div class="step-content" style="margin-top:12px;white-space:pre-line;line-height:1.9;">${paragraphs(r.verdict || '')}</div>
        </div>
        <div class="card sentence-card step-card visible" style="margin-bottom:12px;">
          <div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px;letter-spacing:.1em;">📜 주문 · 황당 처분</div>
          <div class="sentence-text" style="white-space:pre-line;line-height:1.9;">${paragraphs(r.sentence || '')}</div>
        </div>
        ${sectionCard('🔨', '집행명령', '선고 즉시 마음속으로 집행됩니다.', r.executionOrder, '집행')}
        ${r.closingComment ? `<div class="card" style="padding:18px;margin-bottom:16px;text-align:center;border-color:rgba(201,168,76,.5);"><div style="font-family:var(--font-serif);font-size:18px;color:var(--gold);font-weight:900;line-height:1.7;">${escapeHtml(r.closingComment)}</div></div>` : ''}

        ${renderReactions(social, isPublic)}
        ${renderComments(social.comments, isPublic)}

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
