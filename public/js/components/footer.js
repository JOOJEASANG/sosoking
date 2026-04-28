import { db } from '../firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

export async function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  let biz = {};
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'config'));
    if (snap.exists()) biz = snap.data().businessInfo || {};
  } catch {}

  const rows = [
    biz.companyName || '소소킹 생활법정',
    biz.ceoName     ? `대표 ${biz.ceoName}` : null,
    biz.businessNumber ? `사업자등록번호 ${biz.businessNumber}` : null,
    biz.contact     ? `연락처 ${biz.contact}` : null,
    biz.email       ? `이메일 ${biz.email}` : null,
    biz.address     ? `${biz.address}` : null,
  ].filter(Boolean);

  footer.innerHTML = `
    <div class="footer-links">
      <a href="#/policy/terms">이용약관</a>
      <a href="#/policy/privacy">개인정보처리방침</a>
      <a href="#/policy/ai_disclaimer">AI 서비스 안내</a>
      <a href="#/guide">이용 안내</a>
      <a href="#/feedback">💬 의견 접수</a>
    </div>

    <div class="footer-divider"></div>

    <div class="footer-biz">
      ${rows.map(r => `<div class="footer-biz-row">${r}</div>`).join('')}
      <div class="footer-biz-row footer-legal">© 2025 소소킹 생활법정</div>
      <div class="footer-biz-row footer-legal">오락 목적 서비스 · AI 판결에 법적 효력 없음</div>
    </div>

    <div style="margin-top:20px;">
      <a href="/admin" class="footer-admin-link">🔐 관리자</a>
    </div>
  `;
}
