import { db, functions } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js?v=20260630-3';
import { addOwnerStorageImage } from '../components/result-storage-image.js?v=20260709-1';
import { renderResult as renderBaseResult } from './result.js?v=20260709-overhaul1';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

function ensureResultFileStyle() {
  if (document.getElementById('result-file-style')) return;
  const style = document.createElement('style');
  style.id = 'result-file-style';
  style.textContent = `
    .result-file{max-width:760px;}
    .case-cover{position:relative;overflow:hidden;padding:28px 22px;margin-bottom:14px;border:1px solid rgba(201,168,76,.52);border-radius:24px;background:radial-gradient(circle at 50% 0%,rgba(201,168,76,.16),transparent 36%),linear-gradient(180deg,rgba(28,36,64,.96),rgba(13,18,33,.98));box-shadow:0 18px 44px rgba(0,0,0,.28);text-align:center;}
    .case-cover:before{content:'';position:absolute;left:18px;right:18px;top:56px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.35),transparent);}
    .cover-kicker{letter-spacing:.22em;color:#e6c874;font-size:11px;font-weight:900;margin-bottom:22px;}
    .cover-icon{font-size:46px;line-height:1;margin-bottom:12px;filter:drop-shadow(0 10px 22px rgba(0,0,0,.28));}
    .case-cover h1{font-family:var(--font-serif);font-size:25px;line-height:1.45;margin:8px 0 14px;color:var(--cream);word-break:keep-all;}
    .cover-line{width:70px;height:3px;border-radius:99px;background:#c9a84c;margin:0 auto 14px;opacity:.85;}
    .cover-meta{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;color:var(--cream-dim);font-size:12px;line-height:1.5;margin-bottom:10px;}
    .cover-meta span{border:1px solid rgba(201,168,76,.22);border-radius:999px;padding:5px 9px;background:rgba(255,255,255,.035);}
    .cover-tags{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin:10px 0;}
    .cover-tags span{font-size:11px;font-weight:900;color:#151515;background:linear-gradient(180deg,#f4db8b,#c9a84c);border-radius:999px;padding:6px 10px;}
    .cover-case-name{font-size:12px;color:var(--cream-dim);line-height:1.6;margin-top:8px;}
    .case-info-card,.case-section,.point-card,.closing-card{border:1px solid rgba(201,168,76,.34);border-radius:20px;background:rgba(28,36,64,.86);box-shadow:0 10px 28px rgba(0,0,0,.16);}
    .case-info-card{padding:12px 16px;margin-bottom:14px;}
    .case-info-row{display:grid;grid-template-columns:78px 1fr;gap:10px;padding:9px 0;border-bottom:1px solid rgba(201,168,76,.15);line-height:1.55;}
    .case-info-row:last-child{border-bottom:0;}
    .case-info-row span{font-size:12px;color:#d9bd69;font-weight:900;white-space:nowrap;}
    .case-info-row strong{font-size:13px;color:var(--cream);font-weight:800;word-break:keep-all;}
    .point-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:14px;}
    .point-card{padding:16px;}
    .point-title{font-size:16px;font-weight:900;color:#e6c874;margin-bottom:10px;}
    .point-list{display:flex;flex-direction:column;gap:8px;}
    .point-item{display:grid;grid-template-columns:34px 1fr;gap:9px;align-items:flex-start;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.035);padding:10px 11px;}
    .point-item em{font-style:normal;font-family:var(--font-serif);color:#c9a84c;font-weight:900;}
    .point-item span{font-size:13px;line-height:1.55;color:var(--cream);}
    .case-section{padding:18px;margin-bottom:13px;}
    .section-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px;}
    .section-head span{font-size:17px;font-weight:900;color:#e6c874;line-height:1.35;}
    .section-head em{font-style:normal;border:1px solid rgba(201,168,76,.28);border-radius:999px;padding:5px 10px;font-size:11px;color:#e6c874;background:rgba(201,168,76,.08);white-space:nowrap;}
    .section-subtitle{font-size:12px;color:var(--cream-dim);line-height:1.6;margin-bottom:13px;}
    .section-body{font-size:16px;line-height:1.86;color:var(--cream);word-break:keep-all;}
    .section-body b,.section-body strong{color:#e6c874;}
    .judgment-script-section{padding:24px 20px;margin-bottom:16px;}
    .judgment-script-kicker{font-size:11px;font-weight:900;letter-spacing:.18em;color:#d9bd69;margin-bottom:6px;}
    .judgment-script-title{font-family:var(--font-serif);font-size:22px;line-height:1.45;color:#e6c874;font-weight:900;margin-bottom:16px;}
    .judgment-script-body{font-family:var(--font-serif);font-size:16px;line-height:2.05;color:var(--cream);word-break:keep-all;}
    .judgment-script-body b{color:#f4db8b;}
    .closing-card{padding:20px;margin-bottom:15px;text-align:center;font-family:var(--font-serif);font-size:19px;font-weight:900;line-height:1.75;color:#e6c874;}
    .image-section img{width:100%;max-height:360px;object-fit:contain;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.16);}
    .image-section p{font-size:11px;color:var(--cream-dim);margin:8px 0 0;}
    .reaction-list{display:flex;flex-direction:column;gap:8px;}
    .reaction-btn{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:var(--cream);border-radius:14px;padding:11px 12px;text-align:left;cursor:pointer;}
    .reaction-btn:disabled{opacity:.55;cursor:not-allowed;}
    .reaction-btn.is-active{border-color:rgba(201,168,76,.8);background:rgba(201,168,76,.13);}
    .reaction-btn div{display:flex;justify-content:space-between;gap:10px;font-size:13px;font-weight:800;}
    .reaction-btn i{display:block;height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px;}
    .reaction-btn b{display:block;height:100%;background:#c9a84c;}
    .comment-write{display:flex;gap:8px;margin-bottom:12px;}
    .comment-write .btn{width:82px;padding-left:0;padding-right:0;}
    .comment-list{display:flex;flex-direction:column;gap:8px;}
    .comment-item{border-top:1px solid rgba(255,255,255,.08);padding-top:10px;}
    .comment-item strong{font-size:12px;color:#e6c874;}
    .comment-item p{font-size:13px;color:var(--cream-dim);line-height:1.65;margin:3px 0 0;}
    .legal-note{text-align:center;margin:16px 0;padding:10px;background:rgba(255,255,255,.04);border-radius:10px;font-size:11px;color:var(--cream-dim);line-height:1.7;}
    .owner-delete-case{border-color:rgba(231,76,60,.45)!important;color:#e74c3c!important;}
    .copy-case-link{border:1px dashed rgba(201,168,76,.45);border-radius:18px;background:rgba(201,168,76,.06);padding:15px;margin-bottom:14px;}
    .copy-case-link strong{display:block;color:#e6c874;margin-bottom:6px;}
    .copy-case-link p{font-size:12px;color:var(--cream-dim);line-height:1.65;margin:0 0 11px;}
    @media(min-width:720px){.point-grid{grid-template-columns:1fr 1fr;}.case-cover h1{font-size:30px;}.judgment-script-body{font-size:17px;}}
    [data-theme="light"] .case-cover,:root:not([data-theme="dark"]) .case-cover{background:radial-gradient(circle at 50% 0%,#fff3cf,transparent 40%),linear-gradient(180deg,#fffaf0,#fff7e7)!important;border-color:#ddc98f!important;box-shadow:0 12px 28px rgba(117,85,24,.10)!important;}
    [data-theme="light"] .case-cover h1,:root:not([data-theme="dark"]) .case-cover h1{color:#2b2115!important;}
    [data-theme="light"] .cover-kicker,:root:not([data-theme="dark"]) .cover-kicker,[data-theme="light"] .cover-case-name,:root:not([data-theme="dark"]) .cover-case-name{color:#6b5431!important;}
    [data-theme="light"] .cover-meta span,:root:not([data-theme="dark"]) .cover-meta span{color:#5f4b35!important;background:rgba(255,255,255,.58)!important;border-color:#dfc98e!important;}
    [data-theme="light"] .case-info-card,:root:not([data-theme="dark"]) .case-info-card,[data-theme="light"] .case-section,:root:not([data-theme="dark"]) .case-section,[data-theme="light"] .point-card,:root:not([data-theme="dark"]) .point-card,[data-theme="light"] .closing-card,:root:not([data-theme="dark"]) .closing-card{background:#fffaf0!important;border-color:#e2d3af!important;box-shadow:0 8px 20px rgba(117,85,24,.07)!important;}
    [data-theme="light"] .case-info-row strong,:root:not([data-theme="dark"]) .case-info-row strong,[data-theme="light"] .section-body,:root:not([data-theme="dark"]) .section-body,[data-theme="light"] .point-item span,:root:not([data-theme="dark"]) .point-item span,[data-theme="light"] .judgment-script-body,:root:not([data-theme="dark"]) .judgment-script-body{color:#342514!important;}
    [data-theme="light"] .section-subtitle,:root:not([data-theme="dark"]) .section-subtitle,[data-theme="light"] .legal-note,:root:not([data-theme="dark"]) .legal-note{color:#66543c!important;}
  `;
  document.head.appendChild(style);
}
function addCopyLink(container) {
  if (document.getElementById('copy-case-link')) return;
  const actions = container.querySelector('.result-actions');
  if (!actions) return;
  actions.insertAdjacentHTML('beforebegin', `
    <div id="copy-case-link" class="copy-case-link">
      <strong>사건 링크 공유</strong>
      <p>판결문 링크를 복사해서 친구에게 보낼 수 있습니다.</p>
      <button class="btn btn-secondary" id="copy-defense-link">사건 링크 복사</button>
    </div>`);
  document.getElementById('copy-defense-link')?.addEventListener('click', async () => {
    const url = location.href;
    try { await navigator.clipboard?.writeText(url); showToast('사건 링크를 복사했습니다.', 'success'); }
    catch { prompt('아래 링크를 복사하세요.', url); }
  });
}
function addOwnerDelete(container, caseId) {
  if (document.getElementById('owner-delete-case')) return;
  const actions = container.querySelector('.result-actions');
  if (!actions) return;
  const ownerShareButton = document.getElementById('btn-share');
  if (!ownerShareButton) return;
  actions.insertAdjacentHTML('afterbegin', `<button class="btn btn-ghost owner-delete-case" id="owner-delete-case">🗑️ 이 사건 삭제</button>`);
  document.getElementById('owner-delete-case')?.addEventListener('click', async () => {
    const ok = confirm('이 사건을 삭제할까요?\n\n접수내용, 판결문, 투표, 댓글, 신고 데이터가 함께 삭제됩니다. 삭제 후 복구할 수 없습니다.');
    if (!ok) return;
    const btn = document.getElementById('owner-delete-case');
    btn.disabled = true;
    btn.textContent = '삭제 중...';
    try {
      await httpsCallable(functions, 'deleteMyCase')({ caseId });
      showToast('사건을 삭제했습니다.', 'success');
      location.hash = '#/my-cases';
    } catch (err) {
      console.error(err);
      const raw = String(err.message || '삭제하지 못했습니다.');
      const msg = raw.includes('not-found') ? '삭제 함수가 아직 배포되지 않았습니다. Functions 배포가 필요합니다.' : raw.replace('FirebaseError: ', '');
      showToast(msg, 'error');
      btn.disabled = false;
      btn.textContent = '🗑️ 이 사건 삭제';
    }
  });
}
function stripLead(text) {
  return String(text || '').replace(/^(사건개요|수사 진행 과정|수사보고서|원고 측 주장|피고 측 변론|재판부 판단|판결)\s*\n+/g, '').trim();
}
function scriptHtml(text) {
  return escapeHtml(String(text || '')).replace(/\n/g, '<br>').replace(/(##[^<]+<br>)/g, '<b>$1</b>');
}
function buildJudgmentScript(r, c) {
  const title = r.refinedCaseTitle || r.caseTitle || c.caseTitle || '황당사건';
  const docket = r.docketNumber || c.docketNumber || '2026고단0000';
  const grandTitle = r.absurdityTitle || `${title} 중대생활질서문란 사건`;
  const clerk = r.recordClerk || c.recordClerk || '정기록 서기관';
  const analyst = r.analystName || c.analystName || '생활증거추적팀 수사관';
  const prosecutor = r.prosecutorName || c.prosecutorName || '황당검사';
  const defender = r.defenderName || c.defenderName || '피고측 변호인';
  const judge = r.judgeType || c.judgeType || '황당';
  const casePart = stripLead(r.expandedCase || r.reception || '');
  const timeline = stripLead(r.caseTimeline || '');
  const forensic = stripLead(r.forensicReport || r.investigation || '');
  const plaintiff = stripLead(r.plaintiffArg || '');
  const defendant = stripLead(r.defendantArg || '');
  const opinion = stripLead(r.courtOpinion || r.verdict || '');
  const sentence = stripLead(r.sentence || '');
  const closing = stripLead(r.closingComment || '');
  if (![casePart, timeline, forensic, plaintiff, defendant, opinion, sentence].some(Boolean)) return '';

  return `## ⚖️ 사건번호 및 사건명\n${docket} ${grandTitle}\n\n${clerk}는 본 사건을 단순한 일상 해프닝으로 축소하지 아니하고, 대한민국 소소분쟁 사법사에 기록될 생활형 중대사건으로 편철하였다.\n\n## 1. 사건의 경위 — 비극의 서막\n${casePart}\n\n원고의 평온은 이 순간 이후 이전과 같을 수 없었고, 사소함이라는 이름 아래 은폐되던 억울함은 마침내 법정의 언어를 요구하기에 이르렀다.\n\n## 2. 치열한 수사 과정 — 국가적 역량 총동원\n${analyst}는 사건 당시의 발언, 침묵, 표정, 머뭇거림, 사후 찝찝함을 전부 수사기록에 편입하였다.\n\n${timeline}\n\n${forensic}\n\n수사기관은 이 사건을 위하여 현장 분위기 480시간 상당을 심리적으로 재생 분석하고, 원고의 억울함이 상승한 지점을 0.1초 단위로 특정하였으며, 관련 정황을 종합하여 본 사안을 재판부 송치가 불가피한 사건으로 판단하였다.\n\n## 3. 검사의 공소사실 — 정의의 단죄\n${prosecutor}: ${plaintiff}\n\n검사는 이 사건이 단순한 불편이나 우연이 아니라, 원고의 하루를 조용히 침범한 생활질서 교란행위라고 주장하였다.\n\n## 4. 변호인의 최후변론 — 궤변의 극치\n${defender}: ${defendant}\n\n변호인은 피고 측의 행위가 고의가 아니라 당시 분위기, 판단 착오, 생활 피로, 우주의 미세한 엇박자가 결합된 결과라고 주장하였으나, 그 주장 자체가 오히려 법정의 정적을 더욱 무겁게 만들었다.\n\n## 👨‍⚖️ 판사의 최종 판결 — 주문\n${judge} 재판부는 기록과 변론 전체를 살펴 다음과 같이 판단하였다.\n\n${opinion}\n\n[주문]\n${sentence}\n\n3. 소송 비용은 피고 측이 부담하되, 그 범위는 커피 기프티콘, 메로나, 또는 원고가 즉시 납득 가능한 동급의 생활형 위로물로 갈음할 수 있다.\n\n${closing}`;
}
async function applyJudgmentScript(container, caseId) {
  try {
    const [resultSnap, caseSnap] = await Promise.all([
      getDoc(doc(db, 'results', caseId)),
      getDoc(doc(db, 'cases', caseId)).catch(() => null)
    ]);
    if (!resultSnap.exists()) return;
    const r = resultSnap.data();
    const c = caseSnap?.exists() ? caseSnap.data() : {};
    const script = r.judgmentScript || buildJudgmentScript(r, c);
    if (!String(script || '').trim()) return;

    container.querySelector('.point-grid')?.remove();
    const removeTitles = new Set(['사건 배경 및 발단', '분초 단위 사건일지', '소소국과수 감정서', '황당검사 공소장', '피고 측 답변서', '재판부 판단', '주문 및 집행권고']);
    container.querySelectorAll('.case-section').forEach(section => {
      const title = section.querySelector('.section-head span')?.textContent?.trim() || '';
      if (removeTitles.has(title)) section.remove();
    });
    document.getElementById('judgment-script-section')?.remove();
    const html = `<section id="judgment-script-section" class="case-section judgment-script-section">
      <div class="judgment-script-kicker">FULL JUDGMENT RECORD</div>
      <div class="judgment-script-title">판결 기록 전문</div>
      <div class="judgment-script-body">${scriptHtml(script)}</div>
    </section>`;
    const image = container.querySelector('.image-section');
    const info = container.querySelector('.case-info-card');
    const cover = container.querySelector('.case-cover');
    const anchor = image || info || cover;
    anchor?.insertAdjacentHTML('afterend', html);
  } catch (err) {
    console.warn('judgment script skipped:', err.message || err);
  }
}
async function decorateResult(container, caseId) {
  ensureResultFileStyle();
  await applyJudgmentScript(container, caseId);
  addCopyLink(container);
  addOwnerDelete(container, caseId);
  addOwnerStorageImage(container, caseId);
}

export async function renderResult(container, caseId) {
  await renderBaseResult(container, caseId);
  await decorateResult(container, caseId);
}
