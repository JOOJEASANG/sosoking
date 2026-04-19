import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  let biz = {};
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    if (snap.exists()) biz = snap.data().businessInfo || {};
  } catch {}

  footer.innerHTML = `
    <div class="footer-links">
      <a href="#/policy/terms">이용약관</a>
      <a href="#/policy/privacy">개인정보처리방침</a>
      <a href="#/policy/ai_disclaimer">AI 서비스 안내</a>
    </div>
    <div class="footer-biz">
      ${biz.companyName || '소소킹 판결소'}${biz.ceoName ? ` | 대표 ${biz.ceoName}` : ''}<br>
      ${biz.businessNumber ? `사업자등록번호 ${biz.businessNumber}` : ''}${biz.contact ? ` | 연락처 ${biz.contact}` : ''}<br>
      ${biz.email ? `이메일 ${biz.email}` : ''}${biz.address ? ` | ${biz.address}` : ''}
      <br><span style="display:block;margin-top:6px;">© 2024 소소킹 판결소 · 이 서비스는 오락 목적이며 법적 효력이 없습니다.</span>
    </div>
  `;
}
