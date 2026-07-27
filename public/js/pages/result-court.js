import { renderResult as renderBaseResult } from './result.js?v=20260728-doc-judge-1';

function ensureResultDocumentStyle() {
  if (document.getElementById('result-document-style')) return;
  const style = document.createElement('style');
  style.id = 'result-document-style';
  style.textContent = `
    .result-document-container{padding-top:22px;padding-bottom:90px;max-width:760px;}
    .result-cover{padding:28px 24px;text-align:center;margin-bottom:18px;border-color:rgba(201,168,76,.58);background:#fffdf7;color:#27231f;box-shadow:0 14px 34px rgba(0,0,0,.2);}
    .result-court-name{font-size:11px;color:#9a7531;font-weight:900;letter-spacing:.16em;}
    .result-title-rule{width:46px;height:2px;background:#b48a3e;margin:13px auto;}
    .result-cover h1{margin:0;font-family:var(--font-serif);font-size:27px;line-height:1.45;letter-spacing:.16em;color:#171411;}
    .result-cover h2{margin:14px 0 8px;font-family:var(--font-serif);font-size:21px;line-height:1.55;color:#25211d;word-break:keep-all;}
    .result-case-meta{font-size:12px;color:#756d63;line-height:1.8;}
    .judge-summary{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:14px;align-items:center;margin-top:22px;padding:16px;border:1px solid #ded4c2;border-radius:16px;background:#f8f2e7;text-align:left;}
    .judge-character{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #d4c3a6;font-size:30px;box-shadow:0 4px 14px rgba(89,66,32,.12);}
    .judge-label,.grievance-label{font-size:10px;color:#9a7531;font-weight:900;letter-spacing:.12em;}
    .judge-name{font-family:var(--font-serif);font-size:17px;font-weight:900;color:#26211b;margin-top:3px;}
    .judge-desc{font-size:12px;line-height:1.65;color:#6d645a;margin-top:4px;word-break:keep-all;}
    .grievance-box{min-width:104px;text-align:right;}
    .grievance-score{margin-top:2px;color:#8c2f27;line-height:1;}
    .grievance-score strong{font-size:27px;font-family:var(--font-serif);}
    .grievance-score span{font-size:12px;margin-left:2px;color:#806f61;}
    .grievance-meter{display:flex;gap:3px;justify-content:flex-end;margin-top:8px;}
    .grievance-meter i{display:block;width:6px;height:16px;border-radius:999px;background:#ded4c2;}
    .grievance-meter i.active{background:linear-gradient(180deg,#c75547,#8f2e27);}
    .result-document-stack{display:flex;flex-direction:column;gap:16px;}
    .result-paper{position:relative;overflow:hidden;padding:26px 28px 30px;background:#fffdf8;color:#27231f;border:1px solid #d8cfbf;box-shadow:0 12px 28px rgba(0,0,0,.18);}
    .result-paper::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#b8944f,#e0c88d);}
    .result-paper-header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:22px;padding-bottom:15px;border-bottom:1px solid #d8d0c3;}
    .result-paper-number{font-size:10px;color:#9a7531;font-weight:900;letter-spacing:.16em;}
    .result-paper-title{font-family:var(--font-serif);font-size:23px;font-weight:900;margin-top:6px;color:#171411;}
    .result-paper-badge{display:inline-flex;align-items:center;justify-content:center;max-width:48%;padding:7px 12px;border:1px solid #d5c5a9;border-radius:999px;background:#f7f0e3;color:#735d37;font-size:11px;font-weight:800;line-height:1.25;text-align:center;}
    .result-paper-body{font-family:'Noto Serif KR',serif;font-size:15.5px;line-height:2;color:#302b25;letter-spacing:-.015em;}
    .doc-subheading{position:relative;margin:25px 0 10px;padding-left:12px;font-family:'Noto Sans KR',sans-serif;font-size:14px;font-weight:900;color:#34291d;letter-spacing:.02em;}
    .doc-subheading::before{content:'';position:absolute;left:0;top:.38em;width:4px;height:1.05em;border-radius:2px;background:#b58c46;}
    .doc-subheading:first-child{margin-top:0;}
    .doc-subheading-meta{display:inline-flex;margin:8px 10px 5px 0;padding:4px 9px;border:1px solid #ded4c3;border-radius:5px;background:#faf6ee;color:#715e43;font-size:11px;}
    .doc-subheading-meta::before{display:none;}
    .doc-paragraph{margin:0 0 14px;text-align:justify;word-break:keep-all;overflow-wrap:anywhere;}
    .doc-order-item{display:grid;grid-template-columns:26px minmax(0,1fr);gap:6px;margin:0 0 12px;padding:11px 13px;border-left:3px solid #b58c46;background:#f8f3e9;line-height:1.8;}
    .doc-order-item span{font-weight:900;color:#8e6a2e;}
    .doc-order-item p{margin:0;}
    .result-paper.verdict-card{border-color:#c9ad74;}
    .result-paper.verdict-card .result-paper-header{padding-right:68px;}
    .result-paper .verdict-stamp{right:18px;top:18px;opacity:.16;}
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
      .result-paper-title{font-size:22px;}
      .result-paper-body{font-size:15px;line-height:1.95;}
      .doc-paragraph{text-align:left;}
    }
  `;
  document.head.appendChild(style);
}

export async function renderResult(container, caseId) {
  ensureResultDocumentStyle();
  await renderBaseResult(container, caseId);
}
