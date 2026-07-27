import { renderResult as renderBaseResult } from './result.js?v=20260728-audit-1';
import { db } from '../firebase.js?v=20260728-audit-1';
import { doc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { showToast } from '../components/toast.js?v=20260630-3';

function ensureResultDocumentStyle() {
  if (document.getElementById('result-document-style')) return;

  const style = document.createElement('style');
  style.id = 'result-document-style';
  style.textContent = `
    .result-document-container{padding-top:22px;padding-bottom:90px;max-width:760px;}
    .result-document-page .result-cover.card,
    .result-document-page .result-paper.card,
    .result-document-page .result-paper.verdict-card{
      background:#fffdf7!important;color:#2b251f!important;border-color:#d8cfbf!important;color-scheme:light;
    }
    .result-cover{padding:28px 24px;text-align:center;margin-bottom:18px;box-shadow:0 14px 34px rgba(0,0,0,.2)!important;}
    .result-court-name{font-size:11px;color:#856225!important;font-weight:900;letter-spacing:.16em;}
    .result-title-rule{width:46px;height:2px;background:#a97927;margin:13px auto;}
    .result-document-page .result-cover h1{margin:0;font-family:var(--font-serif);font-size:27px;line-height:1.45;letter-spacing:.16em;color:#1c1814!important;text-shadow:none!important;}
    .result-document-page .result-cover h2{margin:14px 0 8px;font-family:var(--font-serif);font-size:21px;line-height:1.55;color:#3d2a12!important;word-break:keep-all;text-shadow:none!important;}
    .result-case-meta{font-size:12px;color:#665d54!important;line-height:1.8;}
    .judge-summary{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:14px;align-items:center;margin-top:22px;padding:16px;border:1px solid #ded4c2;border-radius:16px;background:#f8f2e7!important;text-align:left;color:#2b251f!important;}
    .judge-character{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff!important;border:1px solid #d4c3a6;font-size:30px;box-shadow:0 4px 14px rgba(89,66,32,.12);}
    .judge-label,.grievance-label{font-size:10px;color:#856225!important;font-weight:900;letter-spacing:.12em;}
    .result-document-page .judge-name{font-family:var(--font-serif);font-size:17px;font-weight:900;color:#292118!important;margin-top:3px;}
    .result-document-page .judge-desc{font-size:12px;line-height:1.65;color:#62584d!important;margin-top:4px;word-break:keep-all;}
    .grievance-box{min-width:104px;text-align:right;}
    .grievance-score{margin-top:2px;color:#8c2f27!important;line-height:1;}
    .grievance-score strong{font-size:27px;font-family:var(--font-serif);color:#8c2f27!important;}
    .grievance-score span{font-size:12px;margin-left:2px;color:#6d5f53!important;}
    .grievance-meter{display:flex;gap:3px;justify-content:flex-end;margin-top:8px;}
    .grievance-meter i{display:block;width:6px;height:16px;border-radius:999px;background:#ded4c2;}
    .grievance-meter i.active{background:linear-gradient(180deg,#c75547,#8f2e27);}
    .result-document-stack{display:flex;flex-direction:column;gap:16px;}
    .result-paper{position:relative;overflow:hidden;padding:26px 28px 30px;box-shadow:0 12px 28px rgba(0,0,0,.18)!important;}
    .result-paper::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#a97927,#e0c88d);}
    .result-paper-header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:22px;padding-bottom:15px;border-bottom:1px solid #d8d0c3;}
    .result-paper-number{font-size:10px;color:#856225!important;font-weight:900;letter-spacing:.16em;}
    .result-document-page .result-paper-title{font-family:var(--font-serif);font-size:23px;font-weight:900;margin-top:6px;color:#251a0d!important;text-shadow:none!important;}
    .result-paper-badge{display:inline-flex;align-items:center;justify-content:center;max-width:48%;padding:7px 12px;border:1px solid #d5c5a9;border-radius:999px;background:#f7f0e3!important;color:#654b24!important;font-size:11px;font-weight:800;line-height:1.25;text-align:center;}
    .result-document-page .result-paper-body{font-family:'Noto Serif KR',serif;font-size:15.5px;line-height:2;color:#302b25!important;letter-spacing:-.015em;}
    .result-document-page .doc-subheading{position:relative;margin:25px 0 10px;padding-left:12px;font-family:'Noto Sans KR',sans-serif;font-size:14px;font-weight:900;color:#34291d!important;letter-spacing:.02em;text-shadow:none!important;}
    .doc-subheading::before{content:'';position:absolute;left:0;top:.38em;width:4px;height:1.05em;border-radius:2px;background:#a97927;}
    .doc-subheading:first-child{margin-top:0;}
    .result-document-page .doc-subheading-meta{display:inline-flex;margin:8px 10px 5px 0;padding:4px 9px;border:1px solid #ded4c3;border-radius:5px;background:#faf6ee!important;color:#654f32!important;font-size:11px;}
    .doc-subheading-meta::before{display:none;}
    .result-document-page .doc-paragraph{margin:0 0 14px;text-align:justify;word-break:keep-all;overflow-wrap:anywhere;color:#302b25!important;}
    .doc-order-item{display:grid;grid-template-columns:26px minmax(0,1fr);gap:6px;margin:0 0 12px;padding:11px 13px;border-left:3px solid #a97927;background:#f8f3e9!important;line-height:1.8;color:#302b25!important;}
    .doc-order-item span{font-weight:900;color:#7d581d!important;}
    .result-document-page .doc-order-item p{margin:0;color:#302b25!important;}
    .result-paper.verdict-card{border-color:#c9ad74!important;}
    .result-paper.verdict-card .result-paper-header{padding-right:68px;}
    .result-paper .verdict-stamp{right:18px;top:18px;opacity:.2;color:#9f241b!important;border-color:#9f241b!important;}
    .result-disclaimer{text-align:center;margin:20px 0;padding:12px 14px;background:rgba(255,255,255,.04);border-radius:9px;font-size:11px;color:var(--cream-dim);line-height:1.7;}
    .result-audience{margin-top:26px;padding-top:20px;border-top:1px solid var(--border);}
    .result-audience-title{font-family:var(--font-serif);font-size:18px;font-weight:900;color:var(--gold);margin-bottom:12px;}
    @media (max-width:640px){
      .result-document-container{padding-left:14px;padding-right:14px;}
      .result-cover{padding:24px 18px;}
      .judge-summary{grid-template-columns:52px minmax(0,1fr);gap:11px;padding:13px;}
      .judge-character{width:48px;height:48px;font-size:25px;}
      .grievance-box{grid-column:1/-1;display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:9px;min-width:0;text-align:left;padding-top:10px;border-top:1px solid #ded4c2;}
      .grievance-score{margin:0;}
      .grievance-score strong{font-size:22px;}
      .grievance-meter{justify-content:flex-start;margin:0;}
      .result-paper{padding:23px 20px 27px;}
      .result-paper-header{display:block;}
      .result-paper-badge{max-width:100%;margin-top:11px;}
      .result-document-page .result-paper-title{font-size:22px;}
      .result-document-page .result-paper-body{font-size:15px;line-height:1.95;}
      .result-document-page .doc-paragraph{text-align:left;}
    }
  `;
  document.head.appendChild(style);
}

function patchShareButton(container, caseId) {
  const original = container.querySelector('#btn-share');
  if (!original || original.dataset.secureShare === 'true') return;

  const button = original.cloneNode(true);
  button.dataset.secureShare = 'true';
  original.replaceWith(button);

  button.addEventListener('click', async () => {
    const newPublic = button.textContent.includes('공개하기');
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = '공개 상태 변경 중...';

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'results', caseId), { isPublic: newPublic, updatedAt: serverTimestamp() });
      batch.update(doc(db, 'cases', caseId), { isPublic: newPublic, updatedAt: serverTimestamp() });
      await batch.commit();

      if (newPublic) {
        const url = `${location.origin}/#/result/${encodeURIComponent(caseId)}`;
        await navigator.clipboard?.writeText(url).catch(() => {});
        showToast('판결기록을 공개했습니다. 링크도 복사했습니다.', 'success');
      } else {
        showToast('판결기록을 비공개로 전환했습니다.', 'success');
      }

      await renderResult(container, caseId);
    } catch (err) {
      console.error('result visibility update failed:', err);
      button.disabled = false;
      button.textContent = oldText;
      showToast('공개 상태를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.', 'error');
    }
  });
}

export async function renderResult(container, caseId) {
  ensureResultDocumentStyle();
  await renderBaseResult(container, caseId);
  patchShareButton(container, caseId);
}
