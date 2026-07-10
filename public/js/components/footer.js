import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

export async function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  let biz = {};
  try {
    const snap = await getDoc(doc(db, 'public_settings', 'config'));
    if (snap.exists()) biz = snap.data().businessInfo || {};
  } catch {}

  const companyName = escapeHtml(biz.companyName || '소소킹 황당재판소');
  const ceoName = escapeHtml(biz.ceoName || '');
  const businessNumber = escapeHtml(biz.businessNumber || '');
  const contact = escapeHtml(biz.contact || '');
  const email = escapeHtml(biz.email || '');
  const address = escapeHtml(biz.address || '');

  footer.innerHTML = `
    <div class="footer-links">
      <a href="#/absurd-cases">황당사례 모음</a>
      <a href="#/board">황당판결 기록</a>
      <a href="#/policy/terms">이용약관</a>
      <a href="#/policy/privacy">개인정보처리방침</a>
      <a href="#/policy/ai_disclaimer">AI 서비스 안내</a>
    </div>
    <div class="footer-biz">
      ${companyName}${ceoName ? ` | 대표 ${ceoName}` : ''}<br>
      ${businessNumber ? `사업자등록번호 ${businessNumber}` : ''}${contact ? ` | 연락처 ${contact}` : ''}<br>
      ${email ? `이메일 ${email}` : ''}${address ? ` | ${address}` : ''}
      <br><span style="display:block;margin-top:6px;">© 2026 소소킹 황당재판소 · AI 오락용 황당재판 · 법적 효력 없음</span>
    </div>
    <div style="margin-top:16px;">
      <a href="/admin" style="font-size:11px;color:rgba(245,240,232,0.2);text-decoration:none;">관리자</a>
    </div>
  `;
}
