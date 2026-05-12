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
    biz.companyName || '소소킹',
    biz.ceoName ? `대표 ${biz.ceoName}` : null,
    biz.businessNumber ? `사업자등록번호 ${biz.businessNumber}` : null,
    biz.contact ? `연락처 ${biz.contact}` : null,
    biz.email ? `이메일 ${biz.email}` : null,
    biz.address ? `${biz.address}` : null,
  ].filter(Boolean);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  const showInstallBtn = !isStandalone;

  footer.innerHTML = `
    <div class="footer-links">
      <a href="#/policy/terms">이용약관</a>
      <a href="#/policy/privacy">개인정보처리방침</a>
      <a href="#/policy/ai_disclaimer">AI 서비스 안내</a>
      <a href="#/guide">이용 안내</a>
      <a href="#/feedback">💬 의견 접수</a>
    </div>

    ${showInstallBtn ? `
    <div style="margin:20px 0 4px;">
      <button id="footer-pwa-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:12px;border:1.5px solid rgba(79,124,255,0.25);background:rgba(79,124,255,0.07);color:#4f7cff;font-size:14px;font-weight:700;cursor:pointer;">
        <img src="/icon-192.png" style="width:22px;height:22px;border-radius:5px;" alt="">
        ${isIOS ? '홈 화면에 추가' : '앱으로 설치하기'}
      </button>
    </div>` : ''}

    <div class="footer-divider"></div>

    <div class="footer-biz">
      ${rows.map(r => `<div class="footer-biz-row">${r}</div>`).join('')}
      <div class="footer-biz-row footer-legal">© ${new Date().getFullYear()} 소소킹</div>
      <div class="footer-biz-row footer-legal">오락용 예측 게임 · 소소머니는 현금 가치 없음</div>
    </div>

    <div style="margin-top:20px;">
      <a href="/admin" class="footer-admin-link">🔐 관리자</a>
    </div>
  `;

  if (showInstallBtn) {
    document.getElementById('footer-pwa-btn')?.addEventListener('click', () => {
      if (typeof window._pwaInstall === 'function') window._pwaInstall();
    });
  }
}
