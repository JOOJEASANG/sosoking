import { db, auth, functions } from '../firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import {
  collection, query, where, orderBy, limit, startAfter, getDocs, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml } from '../utils/sanitize.js?v=20260630-3';
import { showToast } from '../components/toast.js?v=20260630-3';

const PAGE_SIZE = 12;
const COUNSELOR_EMOJI = {
  musok: '🔮', uju: '🛸', halmae: '👵',
  tbal: '🤖', bungeo: '🐟', baeu: '🎭'
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
    .cl-like{display:flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:999px;padding:5px 11px;background:transparent;color:var(--cream-dim);font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .15s,color .15s;}
    .cl-like:hover,.cl-like.liked{border-color:var(--gold);color:var(--gold);}
    .cl-like:disabled{opacity:.5;cursor:default;}
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
  return `<div class="cl-card" data-doc-id="${escapeHtml(id)}">
    <div class="cl-doc">
      <span class="cl-doc-face">${emoji}</span>
      <span class="cl-doc-info"><span class="cl-doc-name">${escapeHtml(d.counselorName || '상담사')}</span></span>
    </div>
    <div class="cl-worry">${escapeHtml(d.worry || '')}</div>
    ${rx ? `<div class="cl-rx">${escapeHtml(rx)}</div>` : ''}
    <div class="cl-footer">
      <span class="cl-time">${timeLabel(d.createdAt)}</span>
      <button type="button" class="cl-like${liked ? ' liked' : ''}" data-like-id="${escapeHtml(id)}" aria-label="좋아요 ${d.likeCount || 0}개">
        ❤️ <span class="cl-like-count">${d.likeCount || 0}</span>
      </button>
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

export async function renderClinicList(container) {
  ensureStyle();
  container.innerHTML = `
    <div class="cl-page">
      <div class="page-header"><a href="#/clinic" class="back-btn" aria-label="상담소로 돌아가기">‹</a><span class="logo">처방전 모음</span></div>
      <div class="container" style="padding-top:18px;">
        <div class="hall-intro-title" style="font-family:var(--font-serif);font-size:20px;font-weight:900;color:var(--gold);margin-bottom:4px;">🔮 미친 처방전 모음</div>
        <p style="font-size:12.5px;color:var(--cream-dim);margin:0 0 16px;line-height:1.65;">좋아요 많이 받은 처방전을 먼저 보여드립니다.</p>
        <div id="cl-grid" class="cl-grid"><div class="loading-dots"><span></span><span></span><span></span></div></div>
        <div id="cl-more-wrap"></div>
      </div>
    </div>`;

  const grid = container.querySelector('#cl-grid');
  const moreWrap = container.querySelector('#cl-more-wrap');
  let lastDoc = null;
  let loading = false;

  const toggleLike = httpsCallable(functions, 'toggleLike');

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
        grid.innerHTML = '<div class="cl-empty">아직 공개 처방전이 없습니다.<br><a href="#/clinic" style="color:var(--gold);">상담소에서 첫 처방 받기 →</a></div>';
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

  await load();
}
