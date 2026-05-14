import { auth, db, initAuth } from '/js/firebase.js';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (value) => escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const cleanList = (value, max = 6) => String(value || '').split(',').map(v => v.trim()).filter(Boolean).slice(0, max);

let root;
let posts = [];

export function initSeedManager() {
  injectSeedManagerStyle();
  root = document.createElement('section');
  root.className = 'admin-seed-manager';
  root.innerHTML = `
    <div class="seed-manager-head">
      <div>
        <h2>자동 생성 데이터 관리</h2>
        <p>운영팀 샘플 피드를 수정하거나 삭제합니다. 삭제하면 Firestore에서도 삭제되어 사용자 피드에서 사라집니다.</p>
      </div>
      <button id="seed-refresh-btn" type="button">목록 새로고침</button>
    </div>
    <div id="seed-manager-status" class="seed-manager-status">자동 생성 글을 불러오고 있습니다.</div>
    <div id="seed-manager-list" class="seed-manager-list"></div>
  `;
  const target = document.querySelector('.admin-control-card');
  if (target) target.insertAdjacentElement('afterend', root);
  else document.querySelector('.admin-wrap')?.appendChild(root);
  root.querySelector('#seed-refresh-btn')?.addEventListener('click', loadSeedPosts);
  loadSeedPosts();
}

async function requireAdmin() {
  await initAuth();
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('관리자 로그인이 필요합니다.');
  const adminSnap = await getDoc(doc(db, 'admins', user.uid));
  if (!adminSnap.exists()) throw new Error('관리자 권한이 없습니다.');
  return user;
}

async function loadSeedPosts() {
  const status = root.querySelector('#seed-manager-status');
  const list = root.querySelector('#seed-manager-list');
  try {
    await requireAdmin();
    status.textContent = '불러오는 중...';
    list.innerHTML = '';
    const snap = await getDocs(query(collection(db, 'soso_feed_posts'), where('source', '==', 'system_seed')));
    posts = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })).sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
    status.textContent = posts.length ? `자동 생성 글 ${posts.length.toLocaleString()}개` : '자동 생성 글이 없습니다.';
    renderList();
  } catch (error) {
    status.textContent = error.message || '자동 생성 글을 불러오지 못했습니다.';
    list.innerHTML = '';
  }
}

function renderList() {
  const list = root.querySelector('#seed-manager-list');
  if (!posts.length) {
    list.innerHTML = `<div class="seed-empty">생성된 운영팀 샘플 피드가 없습니다.</div>`;
    return;
  }
  list.innerHTML = posts.map(postCard).join('');
  list.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => openEditor(btn.dataset.id)));
  list.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => deleteSeedPost(btn.dataset.id)));
}

function postCard(post) {
  const content = String(post.content || post.summary || '').slice(0, 150);
  return `
    <article class="seed-post-card" data-id="${escapeAttr(post.id)}">
      <div class="seed-post-top">
        <span>${escapeHtml(post.badge || '✨')} ${escapeHtml(post.type || '샘플')}</span>
        <small>${escapeHtml(post.seedKey || post.id)}</small>
      </div>
      <h3>${escapeHtml(post.title || '제목 없음')}</h3>
      <p>${escapeHtml(content || '내용 없음')}</p>
      <div class="seed-post-meta">
        <span>댓글 ${Number(post.comments || 0).toLocaleString()}</span>
        <span>조회 ${Number(post.views || 0).toLocaleString()}</span>
        <span>${(post.tags || []).map(tag => `#${escapeHtml(tag)}`).join(' ')}</span>
      </div>
      <div class="seed-post-actions">
        <button type="button" data-action="edit" data-id="${escapeAttr(post.id)}">수정</button>
        <button type="button" class="danger" data-action="delete" data-id="${escapeAttr(post.id)}">삭제</button>
      </div>
    </article>
  `;
}

function openEditor(id) {
  const post = posts.find(item => item.id === id);
  if (!post) return;
  document.getElementById('seed-edit-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'seed-edit-modal';
  modal.className = 'seed-edit-modal';
  modal.innerHTML = `
    <div class="seed-modal-backdrop"></div>
    <form class="seed-modal-box">
      <div class="seed-modal-head">
        <div><b>자동 생성 글 수정</b><p>저장하면 Firestore와 사용자 피드에 바로 반영됩니다.</p></div>
        <button type="button" id="seed-edit-close">×</button>
      </div>
      <label>유형</label>
      <input id="seed-edit-type" value="${escapeAttr(post.type || '')}" maxlength="30">
      <label>제목</label>
      <input id="seed-edit-title" value="${escapeAttr(post.title || '')}" maxlength="90">
      <label>본문</label>
      <textarea id="seed-edit-content" maxlength="1200">${escapeHtml(post.content || '')}</textarea>
      <label>질문</label>
      <input id="seed-edit-question" value="${escapeAttr(post.question || '')}" maxlength="90">
      <label>선택지 <small>쉼표로 구분, 최대 4개</small></label>
      <input id="seed-edit-options" value="${escapeAttr((post.options || []).join(', '))}">
      <label>태그 <small>쉼표로 구분, 최대 6개</small></label>
      <input id="seed-edit-tags" value="${escapeAttr((post.tags || []).join(', '))}">
      <div class="seed-modal-actions">
        <button type="button" id="seed-edit-cancel">취소</button>
        <button type="submit" class="primary">저장하기</button>
      </div>
      <small id="seed-edit-status"></small>
    </form>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.seed-modal-backdrop').addEventListener('click', () => modal.remove());
  modal.querySelector('#seed-edit-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#seed-edit-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('form').addEventListener('submit', event => saveSeedPost(event, id));
}

async function saveSeedPost(event, id) {
  event.preventDefault();
  const modal = document.getElementById('seed-edit-modal');
  const status = modal.querySelector('#seed-edit-status');
  const submit = modal.querySelector('button[type="submit"]');
  const title = modal.querySelector('#seed-edit-title').value.trim();
  const content = modal.querySelector('#seed-edit-content').value.trim();
  const question = modal.querySelector('#seed-edit-question').value.trim();
  const type = modal.querySelector('#seed-edit-type').value.trim() || '운영팀 샘플';
  const options = cleanList(modal.querySelector('#seed-edit-options').value, 4);
  const tags = cleanList(modal.querySelector('#seed-edit-tags').value, 6);
  if (title.length < 4) { status.textContent = '제목은 4자 이상이어야 합니다.'; return; }
  if (content.length < 5) { status.textContent = '본문은 5자 이상이어야 합니다.'; return; }
  if (options.length < 2) { status.textContent = '선택지는 2개 이상 필요합니다.'; return; }
  submit.disabled = true;
  submit.textContent = '저장 중...';
  try {
    await requireAdmin();
    await updateDoc(doc(db, 'soso_feed_posts', id), {
      type,
      title,
      content,
      summary: content.slice(0, 180),
      question: question || '당신의 선택은?',
      options,
      tags: tags.length ? tags : ['운영팀'],
      updatedAt: serverTimestamp()
    });
    status.textContent = '저장 완료. Firestore에 반영되었습니다.';
    await loadSeedPosts();
    setTimeout(() => modal.remove(), 500);
  } catch (error) {
    status.textContent = error.message || '저장 실패';
    submit.disabled = false;
    submit.textContent = '저장하기';
  }
}

async function deleteSeedPost(id) {
  const post = posts.find(item => item.id === id);
  if (!post) return;
  const ok = confirm(`삭제할까요?\n\n${post.title || id}\n\n삭제하면 Firestore에서 삭제되어 사용자 피드에서도 사라집니다.`);
  if (!ok) return;
  const card = root.querySelector(`[data-id="${CSS.escape(id)}"]`);
  try {
    await requireAdmin();
    if (card) card.classList.add('deleting');
    await deleteDoc(doc(db, 'soso_feed_posts', id));
    posts = posts.filter(item => item.id !== id);
    root.querySelector('#seed-manager-status').textContent = `삭제 완료 · 남은 자동 생성 글 ${posts.length.toLocaleString()}개`;
    renderList();
  } catch (error) {
    alert(error.message || '삭제 실패');
    if (card) card.classList.remove('deleting');
  }
}

function injectSeedManagerStyle() {
  if (document.getElementById('admin-seed-manager-style')) return;
  const style = document.createElement('style');
  style.id = 'admin-seed-manager-style';
  style.textContent = `
    .admin-seed-manager{border:1px solid var(--soso-line);background:var(--soso-card);box-shadow:var(--soso-shadow);border-radius:28px;padding:20px;margin-bottom:14px}.seed-manager-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}.seed-manager-head h2{margin:0 0 6px;font-size:22px;letter-spacing:-.06em}.seed-manager-head p{margin:0;color:var(--soso-muted);font-size:13px;line-height:1.7}.seed-manager-head button,.seed-post-actions button,.seed-modal-actions button{border:1px solid rgba(79,124,255,.16);border-radius:15px;background:#fff;color:var(--soso-blue);font-weight:1000;padding:10px 12px;cursor:pointer}.seed-manager-status{margin-bottom:12px;color:var(--soso-muted);font-size:13px;font-weight:900}.seed-manager-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.seed-post-card{border:1px solid rgba(79,124,255,.13);border-radius:22px;padding:15px;background:rgba(255,255,255,.78);box-shadow:0 10px 28px rgba(55,90,170,.06)}.seed-post-card.deleting{opacity:.45;pointer-events:none}.seed-post-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.seed-post-top span{display:inline-flex;padding:6px 9px;border-radius:999px;background:rgba(255,232,92,.55);color:#1b2250;font-size:11px;font-weight:1000}.seed-post-top small{color:var(--soso-muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.seed-post-card h3{margin:12px 0 6px;font-size:17px;line-height:1.35;letter-spacing:-.05em}.seed-post-card p{margin:0;color:var(--soso-muted);font-size:13px;line-height:1.6;min-height:42px}.seed-post-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px;color:var(--soso-muted);font-size:11px;font-weight:900}.seed-post-actions{display:flex;gap:7px;margin-top:12px}.seed-post-actions button{flex:1}.seed-post-actions button.danger{color:#ff5c8a;border-color:rgba(255,92,138,.22);background:rgba(255,92,138,.08)}.seed-empty{padding:22px;border-radius:20px;background:rgba(79,124,255,.06);color:var(--soso-muted);text-align:center;font-weight:900}.seed-edit-modal{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:16px}.seed-modal-backdrop{position:absolute;inset:0;background:rgba(3,8,20,.62);backdrop-filter:blur(8px)}.seed-modal-box{position:relative;width:min(620px,100%);max-height:92vh;overflow:auto;display:grid;gap:9px;border:1px solid rgba(79,124,255,.14);border-radius:26px;background:#fff;padding:20px;box-shadow:0 28px 90px rgba(0,0,0,.26)}.seed-modal-head{display:flex;justify-content:space-between;gap:12px}.seed-modal-head b{display:block;font-size:21px;letter-spacing:-.06em}.seed-modal-head p{margin:4px 0 0;color:var(--soso-muted);font-size:12px}.seed-modal-head button{border:0;background:transparent;font-size:28px;line-height:1;cursor:pointer}.seed-modal-box label{font-size:12px;color:var(--soso-muted);font-weight:1000}.seed-modal-box input,.seed-modal-box textarea{width:100%;border:1px solid rgba(79,124,255,.14);border-radius:15px;padding:11px 12px;font-family:inherit;font-weight:800}.seed-modal-box textarea{min-height:150px;resize:vertical;line-height:1.6}.seed-modal-actions{display:flex;gap:8px;justify-content:flex-end}.seed-modal-actions .primary{border:0;background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff);color:#fff}@media(max-width:920px){.seed-manager-list{grid-template-columns:1fr 1fr}.seed-manager-head{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.seed-manager-list{grid-template-columns:1fr}}[data-theme="dark"] .seed-post-card,[data-theme="dark"] .seed-modal-box{background:rgba(16,23,34,.94);box-shadow:none}[data-theme="dark"] .seed-modal-box input,[data-theme="dark"] .seed-modal-box textarea{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.12)}
  `;
  document.head.appendChild(style);
}
