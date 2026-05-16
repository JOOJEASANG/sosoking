import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const generateAiMissionNow = httpsCallable(functions, 'generateAiMissionNow');

function isAdminMissionTab() {
  const content = document.getElementById('admin-content');
  return !!content && content.textContent.includes('미션 관리');
}

function injectAiMissionPanel() {
  const content = document.getElementById('admin-content');
  if (!content || !isAdminMissionTab() || content.querySelector('#ai-mission-panel')) return;

  const firstTitle = [...content.querySelectorAll('div')]
    .find(el => el.textContent.trim() === '🎯 미션 관리');
  const parent = firstTitle?.parentElement;
  if (!parent) return;

  const panel = document.createElement('div');
  panel.id = 'ai-mission-panel';
  panel.className = 'card';
  panel.style.border = '2px solid var(--color-usgyo)';
  panel.innerHTML = `
    <div class="card__body">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:14px;font-weight:900;margin-bottom:4px">🤖 AI 미션 자동관리</div>
          <div style="font-size:12px;color:var(--color-text-secondary);line-height:1.5">
            매일 오전 8시 5분 AI가 오늘의 미션을 자동 생성하고, 지난 AI 미션은 비활성화합니다.
          </div>
        </div>
        <button class="btn btn--primary btn--sm" id="btn-ai-mission-now">AI 미션 즉시 생성</button>
      </div>
      <div style="font-size:11px;color:var(--color-text-muted);margin-top:8px">
        AI 키가 없거나 생성 실패 시 안전한 기본 미션으로 자동 대체됩니다.
      </div>
    </div>`;

  parent.insertBefore(panel, parent.children[1] || null);

  panel.querySelector('#btn-ai-mission-now')?.addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = '생성 중...';
    try {
      const res = await generateAiMissionNow({ force: true });
      const title = res.data?.mission?.title || 'AI 미션';
      toast.success(`AI 미션을 만들었어요: ${title}`);
      const activeTab = document.querySelector('[data-tab="missions"]');
      activeTab?.click();
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'AI 미션 생성에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = 'AI 미션 즉시 생성';
    }
  });
}

let timer = null;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(injectAiMissionPanel, 80);
});

observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(injectAiMissionPanel, 120));
setTimeout(injectAiMissionPanel, 200);
