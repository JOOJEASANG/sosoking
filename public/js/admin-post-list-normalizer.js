import { db } from './firebase.js';
import {
  collection, query, orderBy, limit, getDocs, doc, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { toast } from './components/toast.js';

const TYPE_LABELS = {
  ai_judge: '미친판사',
  ai_translate: '미친번역사',
  ai_match: 'AI궁합',
  ai_naming: 'AI작명소',
  vote: '토론방',
  quiz: '퀴즈방',
  drip: '드립방',
  collect: '일반방',
  general: '일반',
};

const TYPE_ICONS = {
  ai_judge: '⚖️',
  ai_translate: '🌍',
  ai_match: '💘',
  ai_naming: '🎭',
  vote: '🗳️',
  quiz: '🧠',
  drip: '🤣',
  collect: '📌',
  general: '📝',
};

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function cleanText(value) { return String(value || '').trim(); }
function typeKey(post) { return post.type || post.feedType || post.subtype || 'general'; }
function typeLabel(post) {
  const key = typeKey(post);
  return `${TYPE_ICONS[key] || '📝'} ${TYPE_LABELS[key] || key || '기타'}`;
}
function dateText(value) {
  try { const d = value?.toDate?.() || value; return d ? new Date(d).toLocaleString('ko-KR') : '-'; }
  catch { return '-'; }
}

async function renderAdminPosts() {
  const content = document.getElementById('admin-content');
  if (!content) return;
  content.innerHTML = '<div class="loading-center"><div class="spinner spinner--lg"></div></div>';
  const snap = await getDocs(query(collection(db, 'feeds'), orderBy('createdAt', 'desc'), limit(100))).catch(() => null);
  const posts = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];

  content.innerHTML = `
    <div class="admin-posts-panel">
      <h2 class="admin-section-title">📝 게시글관리</h2>
      <div class="card"><div class="card__body">
        <div style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px">최신 게시글 100개 기준입니다. 상세보기와 숨김/해제 작업을 할 수 있습니다.</div>
        <div class="admin-table-wrap" style="overflow:auto">
          <table class="admin-table" style="width:100%;min-width:680px">
            <thead><tr><th style="text-align:left">유형</th><th style="text-align:left">제목</th><th style="text-align:left">작성자</th><th style="text-align:left">작성일</th><th style="text-align:center">상태</th><th style="text-align:center">작업</th></tr></thead>
            <tbody>
              ${posts.length ? posts.map(post => `
                <tr data-admin-post-row="${esc(post.id)}">
                  <td>${esc(typeLabel(post))}</td>
                  <td><a href="#/detail/${esc(post.id)}">${esc(post.title || post.desc || '(제목 없음)')}</a></td>
                  <td>${esc(post.authorName || post.authorEmail || post.authorId || '익명')}</td>
                  <td>${esc(dateText(post.createdAt))}</td>
                  <td style="text-align:center">${post.hidden ? '<span class="badge badge--danger">숨김</span>' : '<span class="badge badge--success">공개</span>'}</td>
                  <td style="text-align:center;white-space:nowrap">
                    <button class="btn btn--ghost btn--sm" data-admin-view-post="${esc(post.id)}">보기</button>
                    <button class="btn btn--ghost btn--sm" data-admin-toggle-post="${esc(post.id)}" data-hidden="${post.hidden ? '1' : '0'}">${post.hidden ? '해제' : '숨김'}</button>
                  </td>
                </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--color-text-muted)">게시글이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div></div>
    </div>`;

  content.querySelectorAll('[data-admin-view-post]').forEach(btn => {
    btn.addEventListener('click', () => { window.location.hash = `#/detail/${btn.dataset.adminViewPost}`; });
  });
  content.querySelectorAll('[data-admin-toggle-post]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.adminTogglePost;
      const currentlyHidden = btn.dataset.hidden === '1';
      await updateDoc(doc(db, 'feeds', id), {
        hidden: !currentlyHidden,
        hideReason: !currentlyHidden ? '관리자 숨김' : '',
        updatedAt: serverTimestamp(),
      });
      toast.success(currentlyHidden ? '게시글 숨김을 해제했어요' : '게시글을 숨김 처리했어요');
      renderAdminPosts();
    });
  });
}

function injectPostMenu() {
  const nav = document.querySelector('.admin-nav');
  if (!nav || nav.querySelector('[data-tab="posts"]')) return;
  const divider = nav.querySelector('.admin-nav-divider');
  const btn = document.createElement('button');
  btn.className = 'admin-menu-item';
  btn.dataset.tab = 'posts';
  btn.innerHTML = '<span class="admin-menu-item__icon">📝</span><span class="admin-menu-item__label admin-label-full">게시글관리</span><span class="admin-menu-item__label admin-label-short">게시글</span>';
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-menu-item[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
    renderAdminPosts();
  });
  if (divider) nav.insertBefore(btn, divider);
  else nav.appendChild(btn);
}

function isPostsAdminTable(table) {
  const headers = [...table.querySelectorAll('thead th')].map(th => cleanText(th.textContent));
  return headers.includes('제목') && headers.includes('유형') && headers.includes('카테고리') && headers.includes('작업');
}
function normalizeTypeCell(cell) {
  if (!cell || cell.dataset.typeNormalized === '1') return;
  const raw = cleanText(cell.textContent);
  const key = Object.keys(TYPE_LABELS).find(type => raw === type || raw.includes(type));
  cell.innerHTML = `<span class="badge badge--gray" style="font-size:11px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap"><span>${TYPE_ICONS[key] || '📝'}</span><span>${TYPE_LABELS[key] || raw || '기타'}</span></span>`;
  cell.dataset.typeNormalized = '1';
}
function removeCategoryColumn(table) {
  if (!isPostsAdminTable(table)) return;
  const headers = [...table.querySelectorAll('thead th')];
  const categoryIndex = headers.findIndex(th => cleanText(th.textContent) === '카테고리');
  const typeIndex = headers.findIndex(th => cleanText(th.textContent) === '유형');
  if (categoryIndex === -1 || typeIndex === -1) return;
  headers[typeIndex].style.width = '120px';
  headers[typeIndex].textContent = '유형';
  headers[categoryIndex].remove();
  table.querySelectorAll('tbody tr').forEach(row => {
    const cells = [...row.children];
    const emptyCell = row.querySelector('.admin-table__empty');
    if (emptyCell) { emptyCell.colSpan = 5; return; }
    normalizeTypeCell(cells[typeIndex]);
    cells[categoryIndex]?.remove();
  });
  table.dataset.postTypeUnified = '1';
}
function normalizeAdminPostList(root = document) {
  injectPostMenu();
  const content = root.querySelector?.('#admin-content') || document.getElementById('admin-content');
  if (!content || !content.textContent.includes('게시물 관리')) return;
  content.querySelectorAll('table.admin-table').forEach(table => {
    if (table.dataset.postTypeUnified === '1') { table.querySelectorAll('tbody tr').forEach(row => normalizeTypeCell(row.children[1])); return; }
    removeCategoryColumn(table);
  });
}
let timer = null;
const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => normalizeAdminPostList(), 60); });
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(() => normalizeAdminPostList(), 120));
setTimeout(() => normalizeAdminPostList(), 300);
