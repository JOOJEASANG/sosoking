import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { policyDefault } from '../data/default-policy-docs.js?v=20260708-1';

export async function renderGuide(container) {
  const fallback = policyDefault('guide');
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">📖 ${escapeHtml(fallback.title || '이용안내')}</span>
      </div>
      <div class="container" style="padding-top:28px;padding-bottom:90px;">
        <div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>
      </div>
    </div>`;

  try {
    const snap = await getDoc(doc(db, 'policy_docs', 'guide'));
    const data = snap.exists() ? snap.data() : {};
    const title = data.title || fallback.title || '이용안내';
    const content = data.content || fallback.content || '아직 등록된 이용안내가 없습니다.';
    container.querySelector('.page-header .logo').textContent = `📖 ${title}`;
    container.querySelector('.container').innerHTML = `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:12px;">⚖️</div>
        <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;margin-bottom:6px;color:var(--gold);">${escapeHtml(title)}</div>
        <div style="font-size:13px;color:var(--cream-dim);line-height:1.7;">관리자 페이지 정책 탭에서 수정할 수 있습니다.</div>
      </div>
      <div class="card" style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;padding:20px;">${escapeHtml(content)}</div>
      <a href="#/submit" class="btn btn-primary" style="margin-top:20px;">⚖️ 소소사건 판결받으러 가기</a>`;
  } catch {
    container.querySelector('.container').innerHTML = `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:12px;">⚖️</div>
        <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;margin-bottom:6px;color:var(--gold);">${escapeHtml(fallback.title || '이용안내')}</div>
      </div>
      <div class="card" style="font-size:14px;line-height:1.9;color:var(--cream-dim);white-space:pre-wrap;padding:20px;">${escapeHtml(fallback.content || '불러오지 못했습니다.')}</div>
      <a href="#/submit" class="btn btn-primary" style="margin-top:20px;">⚖️ 소소사건 판결받으러 가기</a>`;
  }
}
