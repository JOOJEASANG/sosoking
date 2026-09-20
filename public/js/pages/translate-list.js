import { db, auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import {
  collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const PAGE_SIZE = 12;

function ensureStyle() {
  if (document.getElementById('tl-list-style')) return;
  const s = document.createElement('style');
  s.id = 'tl-list-style';
  s.textContent = `
    .tll-page{min-height:100vh;}
    .tll-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding-bottom:90px;}
    .tll-card{background:var(--navy-card);border:1px solid var(--border);border-radius:14px;padding:15px 14px 12px;display:flex;flex-direction:column;gap:8px;}
    .tll-mode{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--gold);background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);border-radius:999px;padding:3px 10px;}
    .tll-original{font-size:12px;color:var(--cream-dim);line-height:1.5;}
    .tll-translated{font-size:13.5px;color:var(--cream);line-height:1.65;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);}
    .tll-footer{display:flex;align-items:center;justify-content:space-between;margin-top:4px;}
    .tll-time{font-size:10px;color:var(--cream-dim);}
    .tll-social{display:flex;gap:6px;align-items:center;}
    .tll-like{display:flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:999px;padding:5px 11px;background:transparent;color:var(--cream-dim);font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s,color .15s;}
    .tll-like:hover,.tll-like.liked{border-color:#e07b00;color:#e07b00;}
    .tll-like:disabled{opacity:.5;cursor:default;}
    .tll-comment-btn{display:flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:999px;padding:5px 10px;background:transparent;color:var(--cream-dim);font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s,color .15s;}
    .tll-comment-btn:hover,.tll-comment-btn.open{border-color:#e07b00;color:#e07b00;}
    .tll-comments{border-top:1px dashed var(--border);padding-top:10px;margin-top:4px;}
    .tll-comment-item{padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06);}
    .tll-comment-item:last-of-type{border-bottom:0;}
    .tll-comment-nick{font-size:11px;font-weight:800;color:var(--gold);margin-bottom:2px;}
    .tll-comment-body{font-size:13px;color:var(--cream);line-height:1.55;}
    .tll-comment-ts{font-size:10px;color:var(--cream-dim);margin-top:2px;}
    .tll-comment-empty{font-size:12px;color:var(--cream-dim);text-align:center;padding:10px 0;}
    .tll-comment-form{margin-top:10px;display:flex;flex-direction:column;gap:7px;}
    .tll-comment-textarea{width:100%;resize:none;min-height:52px;border:1px dashed var(--border);border-radius:10px;padding:8px 10px;font-family:var(--font-sans);font-size:13px;line-height:1.55;color:var(--cream);background:rgba(255,255,255,.03);box-sizing:border-box;}
    .tll-comment-textarea:focus-visible{outline:2px solid var(--gold);outline-offset:1px;}
    .tll-comment-submit{align-self:flex-end;cursor:pointer;font-family:inherit;font-weight:800;font-size:12px;color:#241a05;background:var(--gold);border:0;border-radius:999px;padding:7px 18px;transition:opacity .12s;}
    .tll-comment-submit:disabled{opacity:.5;cursor:progress;}
    .tll-more{display:block;width:100%;margin:16px 0 20px;padding:13px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--cream-dim);font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s;}
    .tll-more:hover{border-color:var(--gold);}
    .tll-empty{padding:28px;text-align:center;font-size:13px;color:var(--cream-dim);border:1px dashed var(--border);border-radius:12px;line-height:1.75;}
    [data-theme='light'] .tll-card{background:#fffaf1;}
    [data-theme='light'] .tll-translated{background:rgba(0,0,0,.03);}
  `;
  document.head.appendChild(s);
}

function timeLabel(ts) {
  if (!ts?.toDate) return '';
  const diff = (Date.now() - ts.toDate().getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function cardHtml(id, d, likedSet) {
  const liked = likedSet.has(id);
  const modeEmoji = d.modeEmoji || '💥';
  const commentCount = d.commentCount || 0;
  return `<div class="tll-card" data-doc-id="${escapeHtml(id)}">
    <div><span class="tll-mode">${modeEmoji} ${escapeHtml(d.modeLabel || '번역')}</span></div>
    <div class="tll-original">원문: ${escapeHtml(d.originalText || '')}</div>
    <div class="tll-translated">${escapeHtml(d.translated || '')}</div>
    <div class="tll-footer">
      <span class="tll-time">${timeLabel(d.createdAt)}</span>
      <div class="tll-social">
        <button type="button" class="tll-comment-btn" data-comment-id="${escapeHtml(id)}" aria-label="댓글 ${commentCount}개">
          💬 <span class="tll-comment-count">${commentCount}</span>
        </button>
        <button type="button" class="tll-like${liked ? ' liked' : ''}" data-like-id="${escapeHtml(id)}" aria-label="좋아요 ${d.likeCount || 0}개">
          ❤️ <span class="tll-like-count">${d.likeCount || 0}</span>
        </button>
      </div>
    </div>
    <div class="tll-comments" hidden data-comments-for="${escapeHtml(id)}">
      <div class="tll-comment-list"></div>
      <div class="tll-comment-form">
        <textarea class="tll-comment-textarea" maxlength="300" placeholder="댓글을 남겨보세요 (300자 이내)"></textarea>
        <button type="button" class="tll-comment-submit">등록</button>
      </div>
    </div>
  </div>`;
}

async function fetchLiked(ids, uid) {
  if (!uid || !ids.length) return new Set();
  const snaps = await Promise.all(
    ids.map(id => getDoc(doc(db, 'translation_results_likes', `${id}_${uid}`)))
  );
  return new Set(snaps.map((s, i) => s.exists ? ids[i] : null).filter(Boolean));
}

async function loadComments(resultId) {
  const q = query(
    collection(db, `translation_results_comments/${resultId}/items`),
    orderBy('createdAt', 'asc'),
    limit(30)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function renderTranslateList(container) {
  ensureStyle();
  container.innerHTML = `
    <div class="tll-page">
      <div class="page-header"><span class="logo">💥 미친 번역소</span></div>
      <div class="container" style="padding-top:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
          <div>
            <div style="font-family:var(--font-serif);font-size:20px;font-weight:900;color:var(--gold);margin-bottom:2px;">💥 병맛 번역 게시판</div>
            <p style="font-size:12.5px;color:var(--cream-dim);margin:0;line-height:1.65;">좋아요·댓글로 반응해 보세요.</p>
          </div>
          <a href="#/translate-new" class="btn btn-primary" style="flex-shrink:0;white-space:nowrap;">+ 번역하기</a>
        </div>
        <div id="tll-grid" class="tll-grid"><div class="loading-dots"><span></span><span></span><span></span></div></div>
        <div id="tll-more-wrap"></div>
      </div>
    </div>`;

  const grid = container.querySelector('#tll-grid');
  const moreWrap = container.querySelector('#tll-more-wrap');
  let lastDoc = null;
  let loading = false;

  const toggleLike = httpsCallable(functions, 'toggleLike');
  const addComment = httpsCallable(functions, 'addComment', { timeout: 30000 });

  async function load(append = false) {
    if (loading) return;
    loading = true;
    if (!append) grid.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

    try {
      let q = query(
        collection(db, 'translation_results'),
        where('isPublic', '==', true),
        orderBy('likeCount', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      if (append && lastDoc) q = query(q, startAfter(lastDoc));

      const snap = await getDocs(q);
      const ids = snap.docs.map(d => d.id);
      const uid = auth.currentUser?.uid;
      const likedSet = await fetchLiked(ids, uid);

      if (!append) grid.innerHTML = '';
      if (snap.empty && !append) {
        grid.innerHTML = '<div class="tll-empty">아직 공개 번역이 없습니다.<br><a href="#/translate-new" style="color:var(--gold);">번역소에서 첫 번역 시도 →</a></div>';
      } else {
        snap.docs.forEach(d => {
          const el = document.createElement('div');
          el.innerHTML = cardHtml(d.id, d.data(), likedSet);
          grid.appendChild(el.firstElementChild);
        });
        lastDoc = snap.docs[snap.docs.length - 1] || null;

        moreWrap.innerHTML = snap.docs.length === PAGE_SIZE
          ? '<button type="button" class="tll-more" id="tll-more-btn">더 보기</button>'
          : '';
        moreWrap.querySelector('#tll-more-btn')?.addEventListener('click', () => load(true));
      }

      bindLikes(grid, uid);
      bindComments(grid, uid);
    } catch (err) {
      console.error('translate list load failed:', err);
      if (!append) grid.innerHTML = '<div class="tll-empty">목록을 불러오지 못했습니다.<br><button class="btn btn-secondary" id="tll-retry" style="margin-top:8px;">다시 시도</button></div>';
      grid.querySelector('#tll-retry')?.addEventListener('click', () => load());
    } finally {
      loading = false;
    }
  }

  function bindLikes(root, uid) {
    root.querySelectorAll('.tll-like:not([data-bound])').forEach(btn => {
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        if (!uid) { showToast('좋아요는 로그인 후 가능합니다.', 'info'); return; }
        btn.disabled = true;
        try {
          const { data } = await toggleLike({ collection: 'translation_results', docId: btn.dataset.likeId });
          btn.classList.toggle('liked', data.liked);
          const span = btn.querySelector('.tll-like-count');
          if (span) span.textContent = String(Number(span.textContent) + (data.liked ? 1 : -1));
        } catch (err) {
          showToast('잠시 후 다시 시도해주세요.', 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function bindComments(root, uid) {
    root.querySelectorAll('.tll-comment-btn:not([data-bound])').forEach(btn => {
      btn.dataset.bound = '1';
      const resultId = btn.dataset.commentId;
      const card = btn.closest('.tll-card');
      const section = card?.querySelector('.tll-comments');
      if (!card || !section) return;

      btn.addEventListener('click', async () => {
        const isOpen = !section.hidden;
        section.hidden = isOpen;
        btn.classList.toggle('open', !isOpen);
        if (!isOpen && !section.dataset.loaded) {
          section.dataset.loaded = '1';
          const list = section.querySelector('.tll-comment-list');
          list.innerHTML = '<div style="font-size:11px;color:var(--cream-dim);padding:6px 0;">댓글 불러오는 중…</div>';
          try {
            const comments = await loadComments(resultId);
            renderCommentList(list, comments);
          } catch {
            list.innerHTML = '<div class="tll-comment-empty">댓글을 불러오지 못했습니다.</div>';
          }
        }
      });

      const textarea = section.querySelector('.tll-comment-textarea');
      const submitBtn = section.querySelector('.tll-comment-submit');
      if (!textarea || !submitBtn) return;

      submitBtn.addEventListener('click', async () => {
        const text = (textarea.value || '').trim();
        if (!uid) { showToast('댓글은 로그인 후 작성 가능합니다.', 'info'); return; }
        if (text.length < 1) { showToast('댓글을 입력해주세요.', 'warn'); return; }
        submitBtn.disabled = true;
        try {
          const { data } = await addComment({ collection: 'translation_results', resultId, text });
          textarea.value = '';
          const list = section.querySelector('.tll-comment-list');
          appendComment(list, { nickname: data.nickname, text, createdAt: null });
          const countSpan = btn.querySelector('.tll-comment-count');
          if (countSpan) countSpan.textContent = String(Number(countSpan.textContent) + 1);
          showToast('댓글이 등록됐습니다!', 'success');
        } catch (err) {
          const msg = String(err?.message || '').replace('FirebaseError: ', '');
          showToast(msg || '잠시 후 다시 시도해주세요.', 'error');
        } finally {
          submitBtn.disabled = false;
        }
      });
    });
  }

  function renderCommentList(list, comments) {
    if (!comments.length) {
      list.innerHTML = '<div class="tll-comment-empty">첫 댓글을 남겨보세요 👋</div>';
      return;
    }
    list.innerHTML = comments.map(c => commentItemHtml(c)).join('');
  }

  function appendComment(list, c) {
    const empty = list.querySelector('.tll-comment-empty');
    if (empty) empty.remove();
    const el = document.createElement('div');
    el.innerHTML = commentItemHtml(c);
    list.appendChild(el.firstElementChild);
  }

  function commentItemHtml(c) {
    const ts = c.createdAt?.toDate ? timeLabel(c.createdAt) : '방금';
    return `<div class="tll-comment-item">
      <div class="tll-comment-nick">${escapeHtml(c.nickname || '익명')}</div>
      <div class="tll-comment-body">${escapeHtml(c.text || '')}</div>
      <div class="tll-comment-ts">${ts}</div>
    </div>`;
  }

  await load();
}
