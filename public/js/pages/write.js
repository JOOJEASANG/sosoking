import { navigate } from '../router.js';
import { setMeta } from '../utils/seo.js';

export function renderWrite() {
  setMeta('AI킹 선택');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">🤖</div>
      <div class="empty-state__title">소소킹은 AI킹 중심으로 운영됩니다</div>
      <div class="empty-state__desc">미친판사, 미친번역사, AI궁합, AI작명소 중 하나를 선택해 주세요.</div>
      <button class="btn btn--primary" style="margin-top:16px" id="go-ai-king">AI킹 하러가기</button>
    </div>`;
  document.getElementById('go-ai-king')?.addEventListener('click', () => navigate('/ai-king'));
}
