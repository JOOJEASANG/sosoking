import { db, auth, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { markJurySeen } from '../utils/jury-seen.js?v=20260829-jury-content-1';

const REACTIONS = [
  ['plaintiff', '⚖️ 원고 편'],
  ['defendant', '🛡️ 피고 편'],
  ['both', '🤝 쌍방과실'],
  ['tooMuch', '😳 재판부가 과합니다'],
  ['funny', '😂 웃겼다']
];

const JUDGE_INFO = {
  '엄벌주의형': { icon: '👨‍⚖️', desc: '사소한 생활규칙 위반도 질서 파괴로 보는 단호한 재판부' },
  '감성형': { icon: '🥹', desc: '서운함과 마음의 상처까지 세심하게 살피는 공감형 재판부' },
  '현실주의형': { icon: '🤦', desc: '말보다 당장 실행할 생활형 해결책을 중시하는 재판부' },
  '과몰입형': { icon: '🔥', desc: '평범한 분쟁도 대서사시처럼 심리하는 극적 재판부' },
  '피곤형': { icon: '😴', desc: '한숨은 쉬어도 핵심 쟁점은 정확히 짚는 재판부' },
  '논리집착형': { icon: '🧮', desc: '시간순서와 말의 모순을 끝까지 추적하는 분석형 재판부' },
  '드립형': { icon: '🎭', desc: '문서 격식 속에 사건 맞춤형 비유와 드립을 숨기는 재판부' },
  '소소킹 AI 재판부': { icon: '⚖️', desc: '생활분쟁을 과하게 진지하게 심리하는 AI 재판부' }
};

const SECTION_LABELS = {
  reception: ['접수번호', '접수일자', '접수처', '접수취지', '사건개요', '접수의견'],
  investigation: ['사건번호', '수사관', '조사일자', '확인 정황', '정황 검토', '주요 증거', '진술 검토', '진술의 모순', '조사관 의견'],
  plaintiffArg: ['청구취지', '주장요지', '피해 및 요구사항', '원고측 최종의견'],
  defendantArg: ['답변취지', '항변요지', '피고측 최종의견'],
  verdict: ['주문', '판단이유', '판결 이유', '재판부 의견', '결론']
};

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

function hashString(value) {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function legacyJudge(caseId) {
  const types = Object.keys(JUDGE_INFO).filter(type => type !== '소소킹 AI 재판부');
  return types[hashString(caseId) % types.length];
}

function legacyGrievance(caseId) {
  return (hashString(`${caseId}:grievance`) % 10) + 1;
}

function safeGrievance(value, caseId) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : legacyGrievance(caseId);
}

function regexEscape(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeReadableText(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/([.!?])(?=[가-힣A-Za-z0-9])/g, '$1 ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitReadableParagraphs(value) {
  const text = normalizeReadableText(value);
  if (!text) return [];

  const explicit = text.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  const paragraphs = [];

  explicit.forEach(part => {
    if (part.length <= 230) {
      paragraphs.push(part);
      return;
    }

    const sentences = part.split(/(?<=[.!?])\s+/).map(sentence => sentence.trim()).filter(Boolean);
    let group = '';
    sentences.forEach(sentence => {
      if (group && `${group} ${sentence}`.length > 230) {
        paragraphs.push(group);
        group = sentence;
      } else {
        group = group ? `${group} ${sentence}` : sentence;
      }
    });
    if (group) paragraphs.push(group);
  });

  return paragraphs;
}

function renderParagraph(value) {
  const text = value.trim();
  const order = text.match(/^(\d+)\.\s*(.+)$/s);
  if (order) {
    return `<div class="doc-order-item"><span>${escapeHtml(order[1])}.</span><p>${escapeHtml(order[2])}</p></div>`;
  }
  return `<p class="doc-paragraph">${escapeHtml(text)}</p>`;
}

function renderStructuredText(content, sectionKey) {
  let text = normalizeReadableText(content)
    .replace(/^(사건접수보고서|수사보고서|수사보고|원고측 변론|피고측 변론|재판부 판결|판결문)\s*/i, '');

  const headings = SECTION_LABELS[sectionKey] || [];
  [...headings].sort((a, b) => b.length - a.length).forEach(heading => {
    const pattern = new RegExp(`${regexEscape(heading)}\\s*[:：]?\\s*`, 'g');
    text = text.replace(pattern, `\n@@${heading}@@\n`);
  });

  const chunks = text.split(/\n+/).map(chunk => chunk.trim()).filter(Boolean);
  const html = [];

  chunks.forEach(chunk => {
    const marker = chunk.match(/^@@(.+)@@$/);
    if (marker) {
      const heading = marker[1];
      const meta = /번호|일자|수사관|접수처/.test(heading);
      html.push(`<h3 class="doc-subheading${meta ? ' doc-subheading-meta' : ''}">${escapeHtml(heading)}</h3>`);
      return;
    }

    splitReadableParagraphs(chunk).forEach(paragraph => html.push(renderParagraph(paragraph)));
  });

  if (!html.length) return '<p class="doc-paragraph">기록된 내용이 없습니다.</p>';
  return html.join('');
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

async function loadResultRecord(caseId) {
  const caseSnap = await getDoc(doc(db, 'cases', caseId)).catch(() => null);
  const caseData = caseSnap?.exists() ? caseSnap.data() : {};
  const isOwner = Boolean(caseSnap?.exists() && caseData.userId === auth.currentUser?.uid);

  if (isOwner) {
    const resultSnap = await getDoc(doc(db, 'results', caseId));
    return {
      caseSnap,
      result: resultSnap.exists() ? resultSnap.data() : null,
      isOwner
    };
  }

  const response = await httpsCallable(functions, 'getPublicResult')({ caseId });
  const result = response?.data?.result;
  return {
    caseSnap,
    result: result && typeof result === 'object' ? result : null,
    isOwner: false
  };
}

export async function renderResult(container, caseId) {
  container.innerHTML = `
    <div class="page-header"><span class="logo">⚖️ 판결문</span></div>
    <div class="container" style="padding:28px 20px 80px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;

  let caseSnap;
  let r;
  let social;
  let isOwner = false;

  try {
    const loaded = await loadResultRecord(caseId);
    caseSnap = loaded.caseSnap;
    r = loaded.result;
    isOwner = loaded.isOwner;
    social = await loadSocial(caseId);
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">
        결과를 불러올 권한이 없거나 삭제된 판결문입니다.<br>
        <a href="#/" style="color:var(--gold);">처음으로</a>
      </div>`;
    return;
  }

  if (!r) {
    container.innerHTML = `
      <div class="container" style="padding:60px 20px;text-align:center;color:var(--cream-dim);">
        결과를 찾을 수 없습니다.<br>
        <a href="#/" style="color:var(--gold);">처음으로</a>
      </div>`;
    return;
  }

  const c = caseSnap?.exists() ? caseSnap.data() : {};
  const isPublic = r.isPublic === true;
  const title = c.caseTitle || r.caseTitle || '생활분쟁 사건';
  const docket = r.docketNumber || c.docketNumber || '사건번호 미상';
  const date = fmtDate(r.createdAt || c.createdAt);
  const judgeType = r.judgeType || c.judgeType || legacyJudge(caseId);
  const judge = JUDGE_INFO[judgeType] || { icon: r.judgeIcon || '⚖️', desc: r.judgeStyle || JUDGE_INFO['소소킹 AI 재판부'].desc };
  const grievanceIndex = safeGrievance(r.grievanceIndex ?? c.grievanceIndex, caseId);
  const tags = (Array.isArray(r.tags) ? r.tags : [])
    .map(tag => String(tag || '').trim())
    .filter(tag => /^[가-힣a-zA-Z0-9]{2,10}$/.test(tag))
    .slice(0, 5);
  const displayNickname = isOwner
    ? (c.nickname || r.nickname || r.publicNickname || '익명')
    : (r.publicNickname || '익명');

  const sections = [
    ['01', '사건접수', '사건접수보고서', 'reception', r.reception],
    ['02', '수사보고', '정황 및 증거 검토', 'investigation', r.investigation],
    ['03', '원고측 변론', '청구취지 및 주장요지', 'plaintiffArg', r.plaintiffArg],
    ['04', '피고측 변론', '답변취지 및 항변요지', 'defendantArg', r.defendantArg],
    ['05', '재판부 판결', '주문 및 판단이유', 'verdict', r.verdict]
  ];

  container.innerHTML = `
    <div class="result-document-page">
      <div class="page-header"><span class="logo">⚖️ 판결문</span></div>
      <div class="container result-document-container">
        <header class="card court-document result-cover">
          <div class="result-court-name">소소킹 판결소 제3생활부</div>
          <div class="result-title-rule"></div>
          <h1>판 결 문</h1>
          <h2>${escapeHtml(title)}</h2>
          <div class="result-case-meta">
            사건번호 ${escapeHtml(docket)}${date ? ` · ${escapeHtml(date)}` : ''}<br>
            원고 ${escapeHtml(displayNickname)}
          </div>
          <div class="judge-summary">
            <div class="judge-character" aria-hidden="true">${escapeHtml(r.judgeIcon || judge.icon)}</div>
            <div class="judge-copy">
              <div class="judge-label">담당 재판부</div>
              <div class="judge-name">${escapeHtml(judgeType)} 판사</div>
              <div class="judge-desc">${escapeHtml(r.judgeStyle || judge.desc)}</div>
            </div>
            <div class="grievance-box">
              <div class="grievance-label">억울지수</div>
              <div class="grievance-score"><strong>${grievanceIndex}</strong><span>/10</span></div>
              <div class="grievance-meter" aria-label="억울지수 ${grievanceIndex}점">
                ${Array.from({ length: 10 }, (_, index) => `<i class="${index < grievanceIndex ? 'active' : ''}"></i>`).join('')}
              </div>
            </div>
          </div>
        </header>

        <main class="result-document-stack">
          ${sections.map(([number, sectionTitle, subtitle, key, content], index) =>
            documentSection(number, sectionTitle, subtitle, key, content, index === 4)
          ).join('')}
        </main>

        ${tags.length ? `<nav class="result-tag-row" aria-label="관련 태그">${tags.map(tag => `<a class="result-tag-chip" href="/tag/${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join('')}</nav>` : ''}

        <div class="result-disclaimer">
          본 문서는 AI가 실제 문서 형식을 흉내 내어 만든 오락 콘텐츠이며 법적 효력이 없습니다.
        </div>

        <div class="result-audience">
          <div class="result-audience-title">방청석</div>
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

  if (isPublic) markJurySeen(caseId);
  bindResultActions(container, caseId, c, r, isOwner, isPublic);
}

function documentSection(number, title, subtitle, key, content, verdict = false) {
  return `<section class="card court-document result-paper ${verdict ? 'verdict-card' : ''}">
    ${verdict ? '<div class="verdict-stamp">판결</div>' : ''}
    <div class="result-paper-header">
      <div>
        <div class="result-paper-number">DOCUMENT ${number}</div>
        <div class="result-paper-title">${escapeHtml(title)}</div>
      </div>
      <span class="result-paper-badge">${escapeHtml(subtitle)}</span>
    </div>
    <div class="result-paper-body">${renderStructuredText(content, key)}</div>
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
        await httpsCallable(functions, 'setResultVisibility')({ caseId, isPublic: newPublic });

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
