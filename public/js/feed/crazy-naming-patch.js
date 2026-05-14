import { auth, db } from '../firebase.js';
import { collection, doc, getDocs, increment, query, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const REACTIONS = [
  { key: 'laugh', icon: '😂', label: '미쳤다' },
  { key: 'wow', icon: '🤯', label: '천재' },
  { key: 'king', icon: '👑', label: '1등' },
  { key: 'fire', icon: '🔥', label: '웃김' }
];

const commentCache = new Map();

function replaceTextNodes(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);
  targets.forEach(node => {
    if (!node.nodeValue || !node.nodeValue.includes('사진 제목학원')) return;
    node.nodeValue = node.nodeValue.replaceAll('사진 제목학원', '미친작명소');
  });
}

function currentPostId() {
  const hash = location.hash || '';
  if (!hash.startsWith('#/feed/') || hash === '#/feed/new' || hash === '#/feed/top') return '';
  return decodeURIComponent(hash.replace('#/feed/', ''));
}

function parseLikeCount(item) {
  const small = item.querySelector('small');
  const text = small?.textContent || '';
  const match = text.match(/(공감|추천)\s*([0-9,]+)/);
  return match ? Number(match[2].replace(/,/g, '')) : 0;
}

function sortCommentItems(list) {
  const items = [...list.querySelectorAll('.comment-item')];
  items.sort((a, b) => parseLikeCount(b) - parseLikeCount(a));
  items.forEach(item => list.appendChild(item));
  [...list.querySelectorAll('.crazy-rank-badge')].forEach((badge, index) => {
    badge.textContent = index < 3 ? `작명 ${index + 1}위` : '작명 후보';
  });
}

async function loadCommentDocs(postId) {
  if (!postId) return [];
  if (commentCache.has(postId)) return commentCache.get(postId);
  try {
    const snap = await getDocs(query(collection(db, 'soso_feed_posts', postId, 'comments')));
    const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    commentCache.set(postId, docs);
    return docs;
  } catch (error) {
    console.warn('댓글 추천 데이터 확인 실패:', error);
    return [];
  }
}

function findCommentId(item, docs) {
  if (item.dataset.commentId || item.getAttribute('data-id')) return item.dataset.commentId || item.getAttribute('data-id');
  const author = (item.querySelector('b')?.textContent || '').trim();
  const text = (item.querySelector('p')?.textContent || '').trim();
  const matched = docs.find(d => String(d.text || '').trim() === text && String(d.authorName || '').trim() === author);
  return matched?.id || '';
}

async function enhanceComments() {
  const postId = currentPostId();
  if (!postId) return;
  const docs = await loadCommentDocs(postId);
  document.querySelectorAll('.comment-list').forEach(list => {
    sortCommentItems(list);
    list.querySelectorAll('.comment-item').forEach((item, index) => {
      if (item.dataset.reactionReady === '1') return;
      const commentId = findCommentId(item, docs);
      if (commentId) item.dataset.commentId = commentId;
      item.dataset.reactionReady = '1';
      item.classList.add('crazy-naming-comment');
      const rank = document.createElement('div');
      rank.className = 'crazy-rank-badge';
      rank.textContent = index < 3 ? `작명 ${index + 1}위` : '작명 후보';
      item.prepend(rank);
      const small = item.querySelector('small');
      if (small && small.textContent.includes('공감')) small.textContent = small.textContent.replace('공감', '추천');
      const bar = document.createElement('div');
      bar.className = 'comment-reaction-bar';
      bar.innerHTML = REACTIONS.map(r => `<button type="button" data-reaction="${r.key}" title="${r.label}"><span>${r.icon}</span><small>${r.label}</small></button>`).join('');
      item.appendChild(bar);
      bar.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async () => {
        if (!auth.currentUser) { alert('로그인 후 추천할 수 있습니다.'); return; }
        const targetId = item.dataset.commentId;
        if (!targetId) { alert('이 댓글은 새로고침 후 추천할 수 있습니다.'); return; }
        btn.disabled = true;
        try {
          await updateDoc(doc(db, 'soso_feed_posts', postId, 'comments', targetId), {
            likes: increment(1),
            [`reactions.${btn.dataset.reaction}`]: increment(1)
          });
          const next = parseLikeCount(item) + 1;
          if (small) small.textContent = `추천 ${next.toLocaleString()}`;
          btn.classList.add('picked');
          commentCache.delete(postId);
          sortCommentItems(list);
        } catch (error) {
          console.warn('댓글 추천 실패:', error);
          alert(error.message || '추천에 실패했습니다.');
          btn.disabled = false;
        }
      }));
    });
  });
}

function injectStyle() {
  if (document.getElementById('crazy-naming-patch-style')) return;
  const style = document.createElement('style');
  style.id = 'crazy-naming-patch-style';
  style.textContent = `
    .crazy-naming-comment{position:relative;padding-top:34px!important}.crazy-rank-badge{position:absolute;left:14px;top:10px;display:inline-flex;padding:5px 9px;border-radius:999px;background:linear-gradient(135deg,rgba(255,232,92,.65),rgba(255,92,138,.18));color:#1b2250;font-size:11px;font-weight:1000;border:1px solid rgba(255,184,0,.24)}.comment-reaction-bar{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.comment-reaction-bar button{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(79,124,255,.13);border-radius:999px;padding:7px 9px;background:#fff;color:#3b4254;font-weight:1000;cursor:pointer;box-shadow:0 8px 18px rgba(55,90,170,.06)}.comment-reaction-bar button:hover{transform:translateY(-2px)}.comment-reaction-bar button.picked{background:linear-gradient(135deg,#ff7a59,#ff5c8a,#7c5cff);color:#fff}.comment-reaction-bar button span{font-size:16px}.comment-reaction-bar button small{font-size:11px;color:inherit}[data-theme="dark"] .comment-reaction-bar button{background:rgba(255,255,255,.08);color:#f5f7fb;border-color:rgba(255,255,255,.12)}
  `;
  document.head.appendChild(style);
}

function runPatch() {
  injectStyle();
  replaceTextNodes();
  enhanceComments();
}

window.addEventListener('hashchange', () => setTimeout(runPatch, 350));
window.addEventListener('load', () => setTimeout(runPatch, 800));
const observer = new MutationObserver(() => {
  clearTimeout(window.__crazyNamingPatchTimer);
  window.__crazyNamingPatchTimer = setTimeout(runPatch, 180);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
runPatch();
