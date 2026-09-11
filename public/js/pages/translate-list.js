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
    .tll-original{font-size:12px;color:var(--cream-dim);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .tll-translated{font-size:13.5px;color:var(--cream);line-height:1.65;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);}
    .tll-footer{display:flex;align-items:center;justify-content:space-between;margin-top:4px;}
    .tll-time{font-size:10px;color:var(--cream-dim);}
    .tll-like{display:flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:999px;padding:5px 11px;background:transparent;color:var(--cream-dim);font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s,color .15s;}
    .tll-like:hover,.tll-like.liked{border-color:#e07b00;color:#e07b00;}
    .tll-like:disabled{opacity:.5;cursor:default;}
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
  return `<div class="tll-card" data-doc-id="${escapeHtml(id)}">
    <div><span class="tll-mode">${modeEmoji} ${escapeHtml(d.modeLabel || '번역')}</span></div>
    <div class="tll-original">원문: ${escapeHtml(d.originalText || '')}</div>
    <div class="tll-translated">${escapeHtml(d.translated || '')}</div>
    <div class="tll-footer">
      <span class="tll-time">${timeLabel(d.createdAt)}</span>
      <button type="button" class="tll-like${liked ? ' liked' : ''}" data-like-id="${escapeHtml(id)}" aria-label="좋아요 ${d.likeCount || 0}개">
        ❤️ <span class="tll-like-count">${d.likeCount || 0}</span>
      </button>
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

export async function renderTranslateList(container) {
  ensureStyle();
  container.innerHTML = `
    <div class="tll-page">
      <div class="page-header"><a href="#/translate" class="back-btn" aria-label="번역소로 돌아가기">‹</a><span class="logo">번역 명작 모음</span></div>
      <div class="container" style="padding-top:18px;">
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:900;color:var(--gold);margin-bottom:4px;">💥 번역 명작 모음</div>
        <p style="font-size:12.5px;color:var(--cream-dim);margin:0 0 16px;line-height:1.65;">좋아요 많이 받은 번역을 먼저 보여드립니다.</p>
        <div id="tll-grid" class="tll-grid"><div class="loading-dots"><span></span><span></span><span></span></div></div>
        <div id="tll-more-wrap"></div>
      </div>
    </div>`;

  const grid = container.querySelector('#tll-grid');
  const moreWrap = container.querySelector('#tll-more-wrap');
  let lastDoc = null;
  let loading = false;

  const toggleLike = httpsCallable(functions, 'toggleLike');

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
        grid.innerHTML = '<div class="tll-empty">아직 공개 번역이 없습니다.<br><a href="#/translate" style="color:var(--gold);">번역소에서 첫 번역 시도 →</a></div>';
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

  await load();
}
