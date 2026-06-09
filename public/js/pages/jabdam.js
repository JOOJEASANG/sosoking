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
let _gameTeardown = null;
let _isAdmin = false;
let _currentTab = 'chat';

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

function linkify(text) {
  return escHtml(text).replace(URL_RE, url =>
    `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" class="jabdam-link">${escHtml(url)}</a>`
  );
}

function getYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v') || (u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : null);
    }
  } catch {}
  return null;
}

function renderLinkCard(linkUrl) {
  if (!linkUrl) return '';
  const ytId = getYoutubeId(linkUrl);
  if (ytId) {
    return `
      <a href="${escHtml(linkUrl)}" target="_blank" rel="noopener noreferrer" class="jabdam-link-card jabdam-link-card--yt">
        <div class="jabdam-link-card__thumb-wrap">
          <img src="https://img.youtube.com/vi/${escHtml(ytId)}/hqdefault.jpg" class="jabdam-link-card__thumb" loading="lazy" referrerpolicy="no-referrer">
          <span class="jabdam-link-card__play">▶</span>
        </div>
        <div class="jabdam-link-card__meta">
          <span class="jabdam-link-card__domain">▶ YouTube</span>
          <span class="jabdam-link-card__url">${escHtml(linkUrl.length > 60 ? linkUrl.slice(0, 60) + '…' : linkUrl)}</span>
        </div>
      </a>`;
  }
  let domain = '';
  try { domain = new URL(linkUrl).hostname.replace(/^www\./, ''); } catch {}
  return `
    <a href="${escHtml(linkUrl)}" target="_blank" rel="noopener noreferrer" class="jabdam-link-card">
      <span class="jabdam-link-card__domain">🔗 ${escHtml(domain)}</span>
      <span class="jabdam-link-card__url">${escHtml(linkUrl.length > 80 ? linkUrl.slice(0, 80) + '…' : linkUrl)}</span>
    </a>`;
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
      ${renderLinkCard(p.linkUrl)}
      <div class="jabdam-post__foot">
        <button class="jabdam-like-btn ${p._liked ? 'jabdam-like-btn--on' : ''}" data-id="${escHtml(p.id)}">
          👍 ${likesCount > 0 ? likesCount : ''}
        </button>
      </div>
    </div>`;
}

function renderTabBar(activeTab) {
  const tabs = [
    { key: 'chat',      label: '🗨️ 수다' },
    { key: 'wordchain', label: '🔤 끝말잇기' },
    { key: 'chosung',   label: '🎯 초성게임' },
  ];
  return `
    <div class="jabdam-tabs">
      ${tabs.map(t => `
        <button class="jabdam-tab${activeTab === t.key ? ' jabdam-tab--active' : ''}" data-tab="${t.key}">
          ${t.label}
        </button>`).join('')}
    </div>`;
}

export async function renderJabdam() {
  setMeta('🗨️ 수다방');
  const el = document.getElementById('page-content');
  if (_unsub) { _unsub(); _unsub = null; }
  if (_gameTeardown) { _gameTeardown(); _gameTeardown = null; }

  _isAdmin = auth.currentUser
    ? await getDoc(doc(db, 'admins', auth.currentUser.uid)).then(s => s.exists()).catch(() => false)
    : false;

  const loggedIn = !!auth.currentUser;

  el.innerHTML = `
    <div class="jabdam-page">
      <div class="jabdam-header">
        <div style="font-size:22px;font-weight:900">🗨️ 수다방</div>
        <div style="font-size:13px;color:var(--color-text-muted);margin-top:2px">수다·끝말잇기·초성게임을 즐겨봐요!</div>
      </div>
      ${renderTabBar(_currentTab)}
      <div id="jabdam-tab-content"></div>
    </div>`;

  el.querySelectorAll('.jabdam-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _currentTab = btn.dataset.tab;
      el.querySelectorAll('.jabdam-tab').forEach(t => t.classList.toggle('jabdam-tab--active', t.dataset.tab === _currentTab));
      switchTab(_currentTab, loggedIn);
    });
  });

  switchTab(_currentTab, loggedIn);
}

function switchTab(tab, loggedIn) {
  if (_unsub) { _unsub(); _unsub = null; }
  if (_gameTeardown) { _gameTeardown(); _gameTeardown = null; }

  const content = document.getElementById('jabdam-tab-content');
  if (!content) return;

  if (tab === 'chat') {
    renderChatTab(content, loggedIn);
  } else if (tab === 'wordchain') {
    import('../games/wordchain.js').then(m => {
      _gameTeardown = m.mount(content, loggedIn);
    });
  } else if (tab === 'chosung') {
    import('../games/chosung.js').then(m => {
      _gameTeardown = m.mount(content, loggedIn);
    });
  }
}

let _pendingImageUrl = null;
let _pendingImagePreview = null;
let _pendingLinkUrl = null;

function renderChatTab(container, loggedIn) {
  container.innerHTML = `
    ${loggedIn ? `
    <div class="jabdam-form card">
      <div class="card__body">
        <textarea id="jabdam-text" class="form-input jabdam-textarea" placeholder="지금 무슨 생각하세요?" maxlength="500" rows="3"></textarea>
        <div class="jabdam-link-input-wrap">
          <span class="jabdam-link-input-icon">🔗</span>
          <input type="url" id="jabdam-link-input" class="form-input jabdam-link-input" placeholder="링크 붙여넣기 (유튜브·커뮤니티·이미지 URL 등)">
          <button id="jabdam-link-clear" class="jabdam-link-clear" style="display:none" title="링크 지우기">✕</button>
        </div>
        <div id="jabdam-link-preview" class="jabdam-link-preview"></div>
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
    </div>`;

  if (loggedIn) attachFormHandlers(container);

  const listEl = container.querySelector('#jabdam-list');
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

function attachFormHandlers(container) {
  const imgInput = container.querySelector('#jabdam-img-input');
  const imgPreviewEl = container.querySelector('#jabdam-img-preview');
  const submitBtn = container.querySelector('#jabdam-submit');
  const textEl = container.querySelector('#jabdam-text');
  const linkInput = container.querySelector('#jabdam-link-input');
  const linkPreviewEl = container.querySelector('#jabdam-link-preview');
  const linkClearBtn = container.querySelector('#jabdam-link-clear');

  _pendingImageUrl = null; _pendingImagePreview = null; _pendingLinkUrl = null;

  function updateLinkPreview(url) {
    _pendingLinkUrl = url || null;
    if (linkClearBtn) linkClearBtn.style.display = url ? '' : 'none';
    if (linkPreviewEl) linkPreviewEl.innerHTML = url ? renderLinkCard(url) : '';
  }

  linkInput?.addEventListener('input', () => {
    const val = linkInput.value.trim();
    updateLinkPreview(val.startsWith('http') ? val : '');
  });

  linkInput?.addEventListener('paste', () => {
    setTimeout(() => {
      const val = linkInput.value.trim();
      updateLinkPreview(val.startsWith('http') ? val : '');
    }, 0);
  });

  linkClearBtn?.addEventListener('click', () => { linkInput.value = ''; updateLinkPreview(''); });

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
        imgPreviewEl.innerHTML = ''; imgInput.value = '';
      });
    } catch (e) {
      toast.error('이미지 업로드 실패: ' + (e.message || ''));
      imgPreviewEl.innerHTML = '';
    }
  });

  submitBtn?.addEventListener('click', async () => {
    const text = textEl?.value.trim() || '';
    if (!text && !_pendingImageUrl && !_pendingLinkUrl) return;
    submitBtn.disabled = true; submitBtn.textContent = '올리는 중...';
    try {
      const user = auth.currentUser;
      const name = appState.nickname || user?.displayName || '익명';
      await addDoc(collection(db, 'jabdam_posts'), {
        uid: user.uid, authorName: name, text,
        imageUrl: _pendingImageUrl || null,
        linkUrl: _pendingLinkUrl || null,
        likes: 0, createdAt: serverTimestamp(),
      });
      textEl.value = '';
      if (linkInput) linkInput.value = '';
      if (linkPreviewEl) linkPreviewEl.innerHTML = '';
      if (linkClearBtn) linkClearBtn.style.display = 'none';
      _pendingImageUrl = null; _pendingImagePreview = null; _pendingLinkUrl = null;
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
