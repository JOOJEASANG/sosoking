import { renderPolicy } from '../js/pages/policy-configurable-limit.js?v=20260730-configurable-limit-1';

const DEFAULT_CACHE = new Map();
let loadSequence = 0;

function activePolicyType(root) {
  return root.querySelector('[data-policy-type].active')?.dataset.policyType || 'terms';
}

async function currentSitePolicy(type) {
  if (!DEFAULT_CACHE.has(type)) {
    DEFAULT_CACHE.set(type, (async () => {
      const detached = document.createElement('div');
      await renderPolicy(detached, type);
      const policyText = detached.querySelector('.container > div:first-child')?.textContent || '';
      return policyText.trim();
    })().catch(error => {
      DEFAULT_CACHE.delete(type);
      throw error;
    }));
  }
  return DEFAULT_CACHE.get(type);
}

function updatePolicyNotice(root) {
  const form = root.querySelector('#policy-form');
  if (!form) return;
  const card = form.previousElementSibling?.previousElementSibling;
  if (!(card instanceof HTMLElement) || card.dataset.policyEditorNotice === 'true') return;
  card.dataset.policyEditorNotice = 'true';
  card.textContent = '현재 사이트에 표시되는 정책 원문이 편집창에 자동으로 채워집니다. 수정 후 저장하면 공개 정책 페이지에 바로 적용됩니다.';
}

async function hydratePolicyEditor(root) {
  const textarea = root.querySelector('#policy-content');
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  if (textarea.dataset.policyDefaultLoaded === 'true' || textarea.value.trim()) return;

  const type = activePolicyType(root);
  const sequence = ++loadSequence;
  textarea.dataset.policyDefaultLoaded = 'loading';
  textarea.placeholder = '현재 사이트 정책을 불러오는 중입니다...';

  try {
    const content = await currentSitePolicy(type);
    if (sequence !== loadSequence || !textarea.isConnected || activePolicyType(root) !== type) return;
    if (!textarea.value.trim()) {
      textarea.value = content;
      textarea.dataset.policyDefaultLoaded = 'true';
      textarea.placeholder = '정책 내용을 입력하세요.';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch (error) {
    console.warn('administrator policy defaults could not be loaded:', error?.code || error);
    if (textarea.isConnected) {
      textarea.dataset.policyDefaultLoaded = 'error';
      textarea.placeholder = '정책 원문을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.';
    }
  }
}

function inspectAdminPolicyEditor() {
  const root = document.getElementById('admin-content');
  if (!root || !root.querySelector('#policy-form')) return;
  updatePolicyNotice(root);
  void hydratePolicyEditor(root);
}

const observer = new MutationObserver(() => inspectAdminPolicyEditor());
const start = () => {
  const root = document.getElementById('admin-content');
  if (!root) return;
  observer.observe(root, { childList: true, subtree: true });
  inspectAdminPolicyEditor();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();