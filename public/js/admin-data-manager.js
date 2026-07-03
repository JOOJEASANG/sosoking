import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const listAdminCollections = httpsCallable(functions, 'listAdminCollections');
const listAdminCollectionDocs = httpsCallable(functions, 'listAdminCollectionDocs');
const deleteAdminDocument = httpsCallable(functions, 'deleteAdminDocument');

let currentCollection = 'feeds';

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function confirmTypedDelete(path) {
  return prompt(`${path} 문서를 삭제합니다.\n\n삭제는 되돌릴 수 없습니다. 계속하려면 '삭제'를 입력하세요.`) === '삭제';
}

function installDataTab() {
  const nav = document.querySelector('.admin-nav');
  if (!nav || nav.querySelector('[data-admin-data-tab]')) return;
  const btn = document.createElement('button');
  btn.className = 'admin-menu-item';
  btn.dataset.adminDataTab = '1';
  btn.innerHTML = '<span class="admin-menu-item__icon">🗄️</span><span class="admin-menu-item__label">데이터</span>';
  btn.addEventListener('click', renderDataManager);

  const writeShortcut = nav.querySelector('[data-admin-write-shortcut]');
  if (writeShortcut) nav.insertBefore(btn, writeShortcut);
  else nav.appendChild(btn);
}

function setDataActive() {
  document.querySelectorAll('[data-admin-tab]').forEach(btn => btn.classList.remove('active'));
  document.querySelector('[data-admin-data-tab]')?.classList.add('active');
}

async function renderDataManager() {
  const content = document.getElementById('admin-content');
  if (!content) return;
  setDataActive();
  content.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
  try {
    const result = await listAdminCollections({});
    const collections = result.data?.collections || [];
    if (!collections.includes(currentCollection)) currentCollection = collections[0] || 'feeds';
    content.innerHTML = `
      <div class="admin-data-page">
        <div class="admin-data-head">
          <div>
            <h2 class="admin-section-title">🗄️ 데이터 관리</h2>
            <div class="form-hint">Firestore 주요 컬렉션을 확인하고 불필요한 문서를 삭제할 수 있습니다. 삭제는 되돌릴 수 없습니다.</div>
          </div>
          <button class="btn btn--ghost btn--sm" id="admin-data-refresh">새로고침</button>
        </div>
        <div class="admin-operation-note"><b>주의</b><span>데이터 탭의 삭제는 최종 정리용입니다. 게시물은 먼저 게시물 관리에서 숨김 처리하는 것을 권장합니다.</span></div>
        <div class="admin-data-controls">
          <label class="form-group" style="margin:0"><span class="form-label">컬렉션</span><select id="admin-data-collection" class="form-select">${collections.map(name => `<option value="${esc(name)}" ${name === currentCollection ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
        </div>
        <div id="admin-data-docs"><div class="loading-center"><div class="spinner"></div></div></div>
      </div>`;
    document.getElementById('admin-data-refresh')?.addEventListener('click', renderDataManager);
    document.getElementById('admin-data-collection')?.addEventListener('change', event => {
      currentCollection = event.target.value;
      loadDocs();
    });
    await loadDocs();
  } catch (error) {
    console.error(error);
    content.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">데이터 관리 기능을 불러오지 못했어요</div><div class="empty-state__desc">functions 배포 후 다시 시도해주세요.</div></div>';
  }
}

function renderPreview(doc) {
  const rows = doc.preview || [];
  return rows.map(item => `<span class="admin-data-chip"><b>${esc(item.key)}</b>: ${esc(item.value)}</span>`).join('');
}

async function loadDocs() {
  const box = document.getElementById('admin-data-docs');
  if (!box) return;
  box.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  try {
    const result = await listAdminCollectionDocs({ collection: currentCollection, limit: 50 });
    const docs = result.data?.docs || [];
    box.innerHTML = `
      <div class="card admin-data-card">
        <div class="card__body">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
            <b>${esc(currentCollection)}</b>
            <span class="form-hint">최대 50개 표시</span>
          </div>
          <div class="admin-data-list">
            ${docs.map(doc => `
              <div class="admin-data-row" data-doc-id="${esc(doc.id)}">
                <div class="admin-data-main">
                  <div class="admin-data-title">${esc(doc.title || doc.id)}</div>
                  <div class="admin-data-id">${esc(doc.id)}</div>
                  <div class="admin-data-preview">${renderPreview(doc)}</div>
                </div>
                <details class="admin-data-json"><summary>JSON</summary><pre>${esc(JSON.stringify(doc.data || {}, null, 2))}</pre></details>
                <button class="btn btn--danger btn--sm" data-admin-delete-doc="${esc(doc.id)}">삭제</button>
              </div>`).join('') || '<div class="empty-state__desc">문서가 없습니다.</div>'}
          </div>
        </div>
      </div>`;
    box.querySelectorAll('[data-admin-delete-doc]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.adminDeleteDoc;
        const path = `${currentCollection}/${id}`;
        if (!confirmTypedDelete(path)) return;
        try {
          btn.disabled = true;
          await deleteAdminDocument({ collection: currentCollection, id });
          toast.success('삭제했습니다');
          await loadDocs();
        } catch (error) {
          console.error(error);
          toast.error(error.message || '삭제에 실패했습니다');
          btn.disabled = false;
        }
      });
    });
  } catch (error) {
    console.error(error);
    box.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">문서를 불러오지 못했어요</div></div>';
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(installDataTab, 120);
}

new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedule);
setTimeout(schedule, 800);