import { db } from '../firebase.js?v=20260630-3';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';

function businessRows(data = {}) {
  const business = data.businessInfo || data.business || data;
  return [
    ['상호', business.companyName],
    ['대표', business.representative],
    ['사업자등록번호', business.businessNumber],
    ['통신판매업 신고번호', business.ecommerceNumber],
    ['연락처', business.contact],
    ['이메일', business.email],
    ['주소', business.address],
  ].filter(([, value]) => String(value || '').trim());
}

function footerMarkup(settings = {}) {
  const rows = businessRows(settings);
  return `<div class="container" style="padding:28px 20px 96px;max-width:820px;">
    <div style="font-family:var(--font-serif);font-size:17px;font-weight:900;color:var(--gold);">소소킹 황당재판소</div>
    <div style="font-size:12px;line-height:1.7;color:var(--cream-dim);margin-top:6px;">사건 접수 → 초동수사 → 원고·피고 주장 → 법정공방 → 황당판결까지<br>일상의 사소한 억울함을 한 편의 AI 재판으로 만드는 오락 서비스</div>
    <div class="footer-links" style="display:flex;flex-wrap:wrap;gap:10px 14px;margin-top:16px;">
      <a href="#/guide">이용안내</a>
      <a href="#/board">공개 재판기록</a>
      <a href="#/absurd-cases">황당사건 예시</a>
      <a href="#/policy/terms">이용약관</a>
      <a href="#/policy/privacy">개인정보처리방침</a>
      <a href="#/policy/ai_disclaimer">AI 서비스 안내</a>
    </div>
    ${rows.length ? `<div class="footer-biz" style="display:grid;gap:4px;margin-top:17px;font-size:11px;line-height:1.6;">${rows.map(([label,value]) => `<div><strong>${escapeHtml(label)}</strong> · ${escapeHtml(value)}</div>`).join('')}</div>` : ''}
    <div style="font-size:10px;line-height:1.65;color:var(--cream-dim);margin-top:15px;">본 서비스의 수사기록, 양측 주장과 판결은 실제 법적 효력이 없는 AI 오락 콘텐츠입니다. 실제 범죄·폭력·법률·의료·안전 문제는 관련 전문가나 기관에 문의하세요.</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:15px;padding-top:12px;border-top:1px solid var(--border);">
      <span style="font-size:10px;color:var(--cream-dim);">© 2026 SOSOKING</span>
      <a class="footer-admin-link" href="/admin/">관리자</a>
    </div>
  </div>`;
}

export async function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.innerHTML = footerMarkup();
  try {
    const snap = await getDoc(doc(db, 'public_settings', 'config'));
    if (snap.exists()) footer.innerHTML = footerMarkup(snap.data() || {});
  } catch (error) {
    console.warn('footer public settings skipped:', error.message || error);
  }
}
