import { getApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const app = getApp();
const functions = getFunctions(app, 'asia-northeast3');
const createOfficial = httpsCallable(functions, 'createOfficialDripsoBattleNow');

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function setBusy(button, busy) {
  const before = button.textContent;
  button.disabled = true;
  button.textContent = busy;
  return () => {
    button.disabled = false;
    button.textContent = before;
  };
}

function applyDripsoManualAdmin() {
  const root = document.getElementById('admin-content');
  const aiForm = root?.querySelector('#ai-form');
  if (!root || !aiForm || root.querySelector('#dripso-manual-official-card')) return;

  const card = document.createElement('div');
  card.id = 'dripso-manual-official-card';
  card.className = 'card';
  card.style.marginTop = '16px';
  card.innerHTML = `
    <div style="font-weight:900;color:var(--gold);margin-bottom:8px;">🎤 드립소 주제 수동 등록</div>
    <div style="font-size:12px;color:var(--cream-dim);line-height:1.8;">
      드립소 주제는 자동으로 생성하지 않습니다. 일반 회원과 관리자 모두 드립소 화면에서 직접 주제·배틀을 등록할 수 있습니다.<br>
      아래 공식 주제 버튼은 관리자만 사용할 수 있으며, 준비된 공식 주제 풀에서 1개를 골라 즉시 공개합니다.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button type="button" class="btn btn-primary" id="create-dripso-official-now" style="flex:1;min-width:190px;">공식 주제 1개 생성</button>
      <a class="btn btn-secondary" href="/dripso/" target="_blank" rel="noopener" style="flex:1;min-width:190px;text-decoration:none;text-align:center;">드립소 직접 등록 화면</a>
    </div>`;
  aiForm.insertAdjacentElement('afterend', card);

  card.querySelector('#create-dripso-official-now')?.addEventListener('click', async event => {
    if (!confirm('드립소 공식 주제를 지금 1개 생성해 공개할까요?')) return;
    const restore = setBusy(event.currentTarget, '생성 중...');
    try {
      const response = await createOfficial({});
      const title = String(response.data?.title || '공식 주제');
      toast(`드립소 공식 주제 생성 완료 · ${title}`, 'success');
    } catch (error) {
      console.error('manual official Dripso creation failed:', error);
      toast(String(error?.message || '드립소 공식 주제를 생성하지 못했습니다.').replace(/^FirebaseError:\s*/, ''), 'error');
    } finally {
      restore();
    }
  });
}

function start() {
  const host = document.getElementById('admin-app');
  if (!host) return;
  applyDripsoManualAdmin();
  const observer = new MutationObserver(() => queueMicrotask(applyDripsoManualAdmin));
  observer.observe(host, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
