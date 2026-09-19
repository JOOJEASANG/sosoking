import { db, auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import {
  collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const PAGE_SIZE = 12;
const COUNSELOR_EMOJI = {
  // 현재 캐릭터
  gold: '🧸', profiler: '🕵️', latte: '👔', salon: '💇', taxi: '🚕', hani: '🌿', guru: '🔮', bungeo: '🐟',
  // 과거 캐릭터(기존 공개 처방전 호환)
  boss: '🍲', dog: '🐶', mc: '🎤', monk: '🧘',
  musok: '🔮', uju: '🛸', halmae: '👵', tbal: '🤖', baeu: '🎭'
};

function ensureStyle() {
  if (document.getElementById('cl-style')) return;
  const s = document.createElement('style');
  s.id = 'cl-style';
  s.textContent = `
    .cl-page{min-height:100vh;}
    .cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding-bottom:90px;}
    .cl-card{background:var(--navy-card);border:1px solid var(--border);border-radius:14px;padding:15px 14px 12px;display:flex;flex-direction:column;gap:8px;}
    .cl-doc{display:flex;align-items:center;gap:8px;}
    .cl-doc-face{font-size:22px;line-height:1;flex-shrink:0;}
    .cl-doc-info{min-width:0;}
    .cl-doc-name{font-weight:900;font-size:12.5px;color:var(--cream);line-height:1.3;}
    .cl-worry{font-size:13.5px;color:var(--cream-dim);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .cl-rx{font-size:12.5px;color:var(--cream);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);}
    .cl-footer{display:flex;align-items:center;justify-content:space-between;margin-top:4px;}
    .cl-time{font-size:10px;color:var(--cream-dim);}
    .cl-social{display:flex;gap:6px;align-items:center;}
    .cl-like{display:flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:999px;padding:5px 11px;background:transparent;color:var(--cream-dim);font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s,color .15s;}
    .cl-like:hover,.cl-like.liked{border-color:var(--gold);color:var(--gold);}
    .cl-like:disabled{opacity:.5;cursor:default;}
    .cl-comment-btn{display:flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:999px;padding:5px 10px;background:transparent;color:var(--cream-dim);font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s,color .15s;}
    .cl-comment-btn:hover,.cl-comment-btn.open{border-color:var(--rx-clinic, #17948a);color:var(--rx-clinic, #17948a);}
    .cl-comments{border-top:1px dashed var(--border);padding-top:10px;margin-top:4px;}
    .cl-comment-item{padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06);}
    .cl-comment-item:last-of-type{border-bottom:0;}
    .cl-comment-nick{font-size:11px;font-weight:800;color:var(--gold);margin-bottom:2px;}
    .cl-comment-body{font-size:13px;color:var(--cream);line-height:1.55;}
    .cl-comment-ts{font-size:10px;color:var(--cream-dim);margin-top:2px;}
    .cl-comment-empty{font-size:12px;color:var(--cream-dim);text-align:center;padding:10px 0;}
    .cl-comment-form{margin-top:10px;display:flex;flex-direction:column;gap:7px;}
    .cl-comment-textarea{width:100%;resize:none;min-height:52px;border:1px dashed var(--border);border-radius:10px;padding:8px 10px;font-family:var(--font-sans);font-size:13px;line-height:1.55;color:var(--cream);background:rgba(255,255,255,.03);box-sizing:border-box;}
    .cl-comment-textarea:focus-visible{outline:2px solid var(--gold);outline-offset:1px;}
    .cl-comment-submit{align-self:flex-end;cursor:pointer;font-family:inherit;font-weight:800;font-size:12px;color:#241a05;background:var(--gold);border:0;border-radius:999px;padding:7px 18px;transition:opacity .12s;}
    .cl-comment-submit:disabled{opacity:.5;cursor:progress;}
    .cl-more{display:block;width:100%;margin:16px 0 20px;padding:13px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--cream-dim);font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s;}
    .cl-more:hover{border-color:var(--gold);}
    .cl-empty{padding:28px;text-align:center;font-size:13px;color:var(--cream-dim);border:1px dashed var(--border);border-radius:12px;line-height:1.75;}
    [data-theme='light'] .cl-card{background:#fffaf1;}
    [data-theme='light'] .cl-rx{background:rgba(0,0,0,.03);}
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
  const emoji = COUNSELOR_EMOJI[d.counselorId] || '🔮';
  const liked = likedSet.has(id);
  const rx = d.prescription || d.diagnosis || '';
  const commentCount = d.commentCount || 0;
  return `<div class="cl-card" data-doc-id="${escapeHtml(id)}">
    <div class="cl-doc">
      <span class="cl-doc-face">${emoji}</span>
      <span class="cl-doc-info"><span class="cl-doc-name">${escapeHtml(d.counselorName || '상담사')}</span></span>
    </div>
    <div class="cl-worry">${escapeHtml(d.worry || '')}</div>
    ${rx ? `<div class="cl-rx">${escapeHtml(rx)}</div>` : ''}
    <div class="cl-footer">
      <span class="cl-time">${timeLabel(d.createdAt)}</span>
      <div class="cl-social">
        <button type="button" class="cl-comment-btn" data-comment-id="${escapeHtml(id)}" aria-label="댓글 ${commentCount}개">
          💬 <span class="cl-comment-count">${commentCount}</span>
        </button>
        <button type="button" class="cl-like${liked ? ' liked' : ''}" data-like-id="${escapeHtml(id)}" aria-label="좋아요 ${d.likeCount || 0}개">
          ❤️ <span class="cl-like-count">${d.likeCount || 0}</span>
        </button>
      </div>
    </div>
    <div class="cl-comments" hidden data-comments-for="${escapeHtml(id)}">
      <div class="cl-comment-list"></div>
      <div class="cl-comment-form">
        <textarea class="cl-comment-textarea" maxlength="300" placeholder="댓글을 남겨보세요 (300자 이내)"></textarea>
        <button type="button" class="cl-comment-submit">등록</button>
      </div>
    </div>
  </div>`;
}

async function fetchLiked(ids, uid) {
  if (!uid || !ids.length) return new Set();
  const snaps = await Promise.all(
    ids.map(id => getDoc(doc(db, 'advice_results_likes', `${id}_${uid}`)))
  );
  return new Set(snaps.map((s, i) => s.exists ? ids[i] : null).filter(Boolean));
}

async function loadComments(resultId) {
  const q = query(
    collection(db, `advice_results_comments/${resultId}/items`),
    orderBy('createdAt', 'asc'),
    limit(30)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function renderClinicList(container) {
  ensureStyle();
  container.innerHTML = `
    <div class="cl-page">
      <div class="page-header"><a href="#/clinic" class="back-btn" aria-label="상담소로 돌아가기">‹</a><span class="logo">진단서 게시판</span></div>
      <div class="container" style="padding-top:18px;">
        <div class="hall-intro-title" style="font-family:var(--font-serif);font-size:20px;font-weight:900;color:var(--gold);margin-bottom:4px;">🏥 병맛 진단서 게시판</div>
        <p style="font-size:12.5px;color:var(--cream-dim);margin:0 0 16px;line-height:1.65;">모든 진단서는 공개됩니다. 좋아요·댓글로 반응해 보세요.</p>
        <div id="cl-grid" class="cl-grid"><div class="loading-dots"><span></span><span></span><span></span></div></div>
        <div id="cl-more-wrap"></div>
      </div>
    </div>`;

  const grid = container.querySelector('#cl-grid');
  const moreWrap = container.querySelector('#cl-more-wrap');
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
        collection(db, 'advice_results'),
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
        grid.innerHTML = '<div class="cl-empty">아직 공개 진단서가 없습니다.<br><a href="#/clinic" style="color:var(--gold);">병맛 클리닉에서 첫 진단 받기 →</a></div>';
      } else {
        snap.docs.forEach(d => {
          const el = document.createElement('div');
          el.innerHTML = cardHtml(d.id, d.data(), likedSet);
          grid.appendChild(el.firstElementChild);
        });
        lastDoc = snap.docs[snap.docs.length - 1] || null;

        moreWrap.innerHTML = snap.docs.length === PAGE_SIZE
          ? '<button type="button" class="cl-more" id="cl-more-btn">더 보기</button>'
          : '';
        moreWrap.querySelector('#cl-more-btn')?.addEventListener('click', () => load(true));
      }

      bindLikes(grid, uid);
      bindComments(grid, uid);
    } catch (err) {
      console.error('clinic list load failed:', err);
      if (!append) grid.innerHTML = '<div class="cl-empty">목록을 불러오지 못했습니다.<br><button class="btn btn-secondary" id="cl-retry" style="margin-top:8px;">다시 시도</button></div>';
      grid.querySelector('#cl-retry')?.addEventListener('click', () => load());
    } finally {
      loading = false;
    }
  }

  function bindLikes(root, uid) {
    root.querySelectorAll('.cl-like:not([data-bound])').forEach(btn => {
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        if (!uid) { showToast('좋아요는 로그인 후 가능합니다.', 'info'); return; }
        btn.disabled = true;
        try {
          const { data } = await toggleLike({ collection: 'advice_results', docId: btn.dataset.likeId });
          btn.classList.toggle('liked', data.liked);
          const span = btn.querySelector('.cl-like-count');
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
    root.querySelectorAll('.cl-comment-btn:not([data-bound])').forEach(btn => {
      btn.dataset.bound = '1';
      const resultId = btn.dataset.commentId;
      const card = btn.closest('.cl-card');
      const section = card?.querySelector('.cl-comments');
      if (!card || !section) return;

      btn.addEventListener('click', async () => {
        const isOpen = !section.hidden;
        section.hidden = isOpen;
        btn.classList.toggle('open', !isOpen);
        if (!isOpen && !section.dataset.loaded) {
          section.dataset.loaded = '1';
          const list = section.querySelector('.cl-comment-list');
          list.innerHTML = '<div style="font-size:11px;color:var(--cream-dim);padding:6px 0;">댓글 불러오는 중…</div>';
          try {
            const comments = await loadComments(resultId);
            renderCommentList(list, comments);
          } catch {
            list.innerHTML = '<div class="cl-comment-empty">댓글을 불러오지 못했습니다.</div>';
          }
        }
      });

      const textarea = section.querySelector('.cl-comment-textarea');
      const submitBtn = section.querySelector('.cl-comment-submit');
      if (!textarea || !submitBtn) return;

      submitBtn.addEventListener('click', async () => {
        const text = (textarea.value || '').trim();
        if (!uid) { showToast('댓글은 로그인 후 작성 가능합니다.', 'info'); return; }
        if (text.length < 1) { showToast('댓글을 입력해주세요.', 'warn'); return; }
        submitBtn.disabled = true;
        try {
          const { data } = await addComment({ collection: 'advice_results', resultId, text });
          textarea.value = '';
          const list = section.querySelector('.cl-comment-list');
          appendComment(list, { nickname: data.nickname, text, createdAt: null });
          const countSpan = btn.querySelector('.cl-comment-count');
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
      list.innerHTML = '<div class="cl-comment-empty">첫 댓글을 남겨보세요 👋</div>';
      return;
    }
    list.innerHTML = comments.map(c => commentItemHtml(c)).join('');
  }

  function appendComment(list, c) {
    const empty = list.querySelector('.cl-comment-empty');
    if (empty) empty.remove();
    const el = document.createElement('div');
    el.innerHTML = commentItemHtml(c);
    list.appendChild(el.firstElementChild);
  }

  function commentItemHtml(c) {
    const ts = c.createdAt?.toDate ? timeLabel(c.createdAt) : '방금';
    return `<div class="cl-comment-item">
      <div class="cl-comment-nick">${escapeHtml(c.nickname || '익명')}</div>
      <div class="cl-comment-body">${escapeHtml(c.text || '')}</div>
      <div class="cl-comment-ts">${ts}</div>
    </div>`;
  }

  await load();
}
