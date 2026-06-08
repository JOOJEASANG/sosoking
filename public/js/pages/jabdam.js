import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp, updateDoc, increment, getDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { setMeta } from '../utils/seo.js';
import { escHtml, formatTime } from '../utils/helpers.js';
import { toast } from '../components/toast.js';
import { uploadImage } from '../services/upload-service.js';

let _unsub = null;
let _isAdmin = false;

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

function linkify(text) {
  return escHtml(text).replace(URL_RE, url =>
    `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" class="jabdam-link">${escHtml(url)}</a>`
  );
}

function renderPost(p, isAdmin) {
  const mine = auth.currentUser?.uid === p.uid;
  const canDelete = mine || isAdmin;
  const likesCount = p.likes || 0;
  return `
    <div class="jabdam-post" data-post-id="${escHtml(p.id)}">
      <div class="jabdam-post__head">
        <span class="jabdam-post__author">${escHtml(p.authorName || '익명')}</span>
        <span class="jabdam-post__time">${formatTime(p.createdAt?.toDate?.() || p.createdAt)}</span>
        ${canDelete ? `<button class="jabdam-delete-btn" data-id="${escHtml(p.id)}" title="삭제">✕</button>` : ''}
      </div>
      ${p.text ? `<div class="jabdam-post__text">${linkify(p.text)}</div>` : ''}
      ${p.imageUrl ? `<div class="jabdam-post__img-wrap"><img src="${escHtml(p.imageUrl)}" class="jabdam-post__img" loading="lazy" referrerpolicy="no-referrer"></div>` : ''}
      <div class="jabdam-post__foot">
        <button class="jabdam-like-btn ${p._liked ? 'jabdam-like-btn--on' : ''}" data-id="${escHtml(p.id)}">
          👍 ${likesCount > 0 ? likesCount : ''}
        </button>
      </div>
    </div>`;
}

export async function renderJabdam() {
  setMeta('🗨️ 수다방');
  const el = document.getElementById('page-content');
  if (_unsub) { _unsub(); _unsub = null; }

  _isAdmin = auth.currentUser
    ? await getDoc(doc(db, 'admins', auth.currentUser.uid)).then(s => s.exists()).catch(() => false)
    : false;

  const loggedIn = !!auth.currentUser;

  el.innerHTML = `
    <div class="jabdam-page">
      <div class="jabdam-header">
        <div style="font-size:22px;font-weight:900">🗨️ 수다방</div>
        <div style="font-size:13px;color:var(--color-text-muted);margin-top:2px">아무 얘기나 올려보세요. 텍스트·사진·링크 다 OK</div>
      </div>

      ${loggedIn ? `
      <div class="jabdam-form card">
        <div class="card__body">
          <textarea id="jabdam-text" class="form-input jabdam-textarea" placeholder="지금 무슨 생각하세요?" maxlength="500" rows="3"></textarea>
          <div class="jabdam-form__foot">
            <label class="jabdam-img-label" title="사진 추가">
              📷
              <input type="file" id="jabdam-img-input" accept="image/*" style="display:none">
            </label>
            <div id="jabdam-img-preview" class="jabdam-img-preview"></div>
            <button id="jabdam-submit" class="btn btn--primary btn--sm" style="margin-left:auto">올리기</button>
          </div>
        </div>
      </div>` : `
      <div class="jabdam-login-hint">
        <a href="#/login" class="btn btn--ghost btn--sm">로그인하고 수다 참여하기 →</a>
      </div>`}

      <div id="jabdam-list" class="jabdam-list">
        <div class="loading-center"><div class="spinner"></div></div>
      </div>
    </div>`;

  if (loggedIn) attachFormHandlers(el);

  const listEl = el.querySelector('#jabdam-list');
  const q = query(collection(db, 'jabdam_posts'), orderBy('createdAt', 'desc'), limit(60));
  _unsub = onSnapshot(q, snap => {
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!posts.length) {
      listEl.innerHTML = `<div style="text-align:center;padding:48px;color:var(--color-text-muted)">아직 아무 말도 없어요 🤐<br>첫 번째로 수다 떨어보세요!</div>`;
      return;
    }
    listEl.innerHTML = posts.map(p => renderPost(p, _isAdmin)).join('');
    attachPostHandlers(listEl);
  });
}

let _pendingImageUrl = null;
let _pendingImagePreview = null;

function attachFormHandlers(el) {
  const imgInput = el.querySelector('#jabdam-img-input');
  const imgPreviewEl = el.querySelector('#jabdam-img-preview');
  const submitBtn = el.querySelector('#jabdam-submit');
  const textEl = el.querySelector('#jabdam-text');

  imgInput?.addEventListener('change', async () => {
    const file = imgInput.files?.[0];
    if (!file) return;
    imgPreviewEl.innerHTML = `<span style="font-size:12px;color:var(--color-text-muted)">업로드 중...</span>`;
    try {
      _pendingImageUrl = await uploadImage(file, 'jabdam');
      _pendingImagePreview = URL.createObjectURL(file);
      imgPreviewEl.innerHTML = `<img src="${_pendingImagePreview}" class="jabdam-preview-thumb"><button id="jabdam-remove-img" class="jabdam-remove-img">✕</button>`;
      imgPreviewEl.querySelector('#jabdam-remove-img')?.addEventListener('click', () => {
        _pendingImageUrl = null; _pendingImagePreview = null;
        imgPreviewEl.innerHTML = '';
        imgInput.value = '';
      });
    } catch (e) {
      toast.error('이미지 업로드 실패: ' + (e.message || ''));
      imgPreviewEl.innerHTML = '';
    }
  });

  submitBtn?.addEventListener('click', async () => {
    const text = textEl?.value.trim() || '';
    if (!text && !_pendingImageUrl) return;
    submitBtn.disabled = true; submitBtn.textContent = '올리는 중...';
    try {
      const user = auth.currentUser;
      const name = appState.nickname || user?.displayName || '익명';
      await addDoc(collection(db, 'jabdam_posts'), {
        uid: user.uid,
        authorName: name,
        text,
        imageUrl: _pendingImageUrl || null,
        likes: 0,
        createdAt: serverTimestamp(),
      });
      textEl.value = '';
      _pendingImageUrl = null;
      _pendingImagePreview = null;
      if (imgPreviewEl) imgPreviewEl.innerHTML = '';
      if (imgInput) imgInput.value = '';
    } catch (e) {
      toast.error(e.message || '올리기 실패');
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = '올리기';
    }
  });
}

function attachPostHandlers(listEl) {
  listEl.querySelectorAll('.jabdam-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('삭제할까요?')) return;
      try {
        await deleteDoc(doc(db, 'jabdam_posts', btn.dataset.id));
      } catch (e) { toast.error(e.message || '삭제 실패'); }
    });
  });

  listEl.querySelectorAll('.jabdam-like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { toast.warn('로그인이 필요해요'); return; }
      try {
        await updateDoc(doc(db, 'jabdam_posts', btn.dataset.id), { likes: increment(1) });
      } catch (e) { /* ignore */ }
    });
  });
}
