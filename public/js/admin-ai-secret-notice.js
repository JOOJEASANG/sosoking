import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

function onAdminAiPage() {
  return (window.location.hash.slice(1).split('?')[0] || '/') === '/admin'
    && !!document.getElementById('btn-save-api-key');
}

function patchAiKeyCard() {
  if (!onAdminAiPage()) return;
  const input = document.getElementById('ai-api-key-input');
  const button = document.getElementById('btn-save-api-key');
  const card = input?.closest('.card');
  if (!input || !button || !card || card.dataset.secretNoticeReady === '1') return;

  card.dataset.secretNoticeReady = '1';
  input.value = '';
  input.placeholder = 'Firebase Secret Manager: GEMINI_API_KEY 사용 중';
  input.disabled = true;
  button.textContent = 'Secret 설정 확인';

  const hint = card.querySelector('.form-hint') || card.querySelector('[style*="font-size:11px"]');
  if (hint) {
    hint.textContent = 'API 키는 Firestore에 저장하지 않습니다. Firebase CLI에서 firebase functions:secrets:set GEMINI_API_KEY 명령으로 설정하세요.';
  }

  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    try {
      const saveFn = httpsCallable(functions, 'saveAiConfig');
      await saveFn({ enabled: true, features: {} });
      toast.success('AI 설정 저장 구조를 Secret Manager 전용으로 확인했어요');
    } catch (error) {
      console.error(error);
      toast.error(error.message || '확인에 실패했어요');
    } finally {
      button.disabled = false;
    }
  }, true);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(patchAiKeyCard, 120);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 600);
