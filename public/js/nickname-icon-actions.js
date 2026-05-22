import { auth, db, functions } from './firebase.js';
import { doc, updateDoc, serverTimestamp, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { appState } from './state.js';
import { toast } from './components/toast.js';
import { renderHeader } from './components/header.js';
import { renderSidebar } from './components/sidebar.js';
import { renderNicknameIcon, normalizeNicknameIcon } from './utils/nickname-icon.js';

const DEFAULT_ICONS = ['🐰','🐶','🐱','🦊','🐻','🐼','🐸','🐵','🦁','🐯','🔥','⭐','💎','👑','🎮','🧠','😎','🤣','⚡','🍀','🌙','🚀'];
const PROFILE_CACHE = new Map();

function esc(value) {
  return String(value || '').replace(/[&<>"]+/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

async function dataUrlFromFile(file, maxSide = 128) {
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name || '');
  if (isGif) return readAsDataUrl(file);

  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imgUrl;
    });
    let { width, height } = img;
    const ratio = Math.min(1, maxSide / Math.max(width, height));
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png', 0.9);
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function currentIconValue() {
  return normalizeNicknameIcon(appState.nicknameIcon) || null;
}

function iconKey(icon) {
  const normalized = normalizeNicknameIcon(icon);
  return normalized ? JSON.stringify(normalized) : 'default';
}

function previewHtml(icon, dataUrl = '') {
  const normalized = normalizeNicknameIcon(icon);
  if (dataUrl) {
    return `<span class="nickname-icon nickname-icon--image nickname-icon--preview"><img src="${esc(dataUrl)}" alt=""></span>`;
  }
  return renderNicknameIcon(normalized, 'nickname-icon--preview') || '<span class="nickname-icon nickname-icon--empty">기본</span>';
}

function renderIconPicker(target) {
  if (!target || target.dataset.nicknameIconReady === '1') return;
  const current = currentIconValue();
  const section = document.createElement('div');
  section.className = 'card nickname-icon-settings-card';
  section.style.marginBottom = '12px';
  section.innerHTML = `
    <div class="card__body--lg">
      <div class="section-title" style="font-size:15px;margin-bottom:12px">🎭 프로필 아이콘</div>
      <div class="nickname-icon-preview-row">
        <div class="nickname-icon-preview" id="nickname-icon-preview">
          ${previewHtml(current)}
        </div>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--color-text-primary)">${esc(appState.nickname || auth.currentUser?.displayName || '내 닉네임')}</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:3px">아이콘을 고른 뒤 <b>아이콘 적용</b>을 눌러야 저장돼요.</div>
        </div>
      </div>
      <div class="nickname-icon-emoji-grid">
        ${DEFAULT_ICONS.map(icon => `<button type="button" class="nickname-icon-choice ${current?.type === 'emoji' && current.value === icon ? 'active' : ''}" data-emoji-icon="${icon}" aria-label="${icon}" aria-pressed="${current?.type === 'emoji' && current.value === icon ? 'true' : 'false'}">${icon}</button>`).join('')}
      </div>
      <div class="nickname-icon-custom-row">
        <input id="nickname-icon-custom" class="form-input" maxlength="4" placeholder="목록에 없는 이모지 입력 예: 🐰">
      </div>
      <div class="nickname-icon-upload-row">
        <input id="nickname-icon-file" type="file" accept="image/*" style="display:none">
        <button class="btn btn--ghost btn--sm" id="btn-pick-icon-file">그림 파일 선택</button>
        <button class="btn btn--ghost btn--sm" id="btn-clear-icon" style="color:var(--color-danger)">기본으로 선택</button>
        <button class="btn btn--primary btn--sm" id="btn-apply-nickname-icon">아이콘 적용</button>
      </div>
      <div class="form-hint" style="margin-top:8px">직접 입력은 목록에 없는 이모지를 쓰고 싶을 때만 입력하는 선택 기능입니다. 필요 없으면 위 아이콘만 고르면 됩니다.</div>
    </div>`;

  target.insertAdjacentElement('afterend', section);
  target.dataset.nicknameIconReady = '1';
  setupPickerEvents(section, current);
}

async function saveIcon(icon) {
  const user = auth.currentUser;
  if (!user) return;
  const normalized = normalizeNicknameIcon(icon);
  appState.nicknameIcon = normalized;
  await updateDoc(doc(db, 'users', user.uid), {
    nicknameIcon: normalized || null,
    updatedAt: serverTimestamp(),
  });
  renderHeader();
  renderSidebar();
  updatePreview(normalized);
  applyKnownIcons();
  toast.success(normalized ? '프로필 아이콘을 저장했어요' : '기본 앞글자 표시로 되돌렸어요');
}

function updatePreview(icon = appState.nicknameIcon, dataUrl = '') {
  const preview = document.getElementById('nickname-icon-preview');
  if (!preview) return;
  preview.innerHTML = previewHtml(icon, dataUrl);
}

function setupPickerEvents(section, initialIcon) {
  let selectedIcon = normalizeNicknameIcon(initialIcon);
  let pendingImageDataUrl = '';

  function setSelected(icon, dataUrl = '') {
    selectedIcon = normalizeNicknameIcon(icon);
    pendingImageDataUrl = dataUrl || '';
    section.querySelectorAll('[data-emoji-icon]').forEach(btn => {
      const active = selectedIcon?.type === 'emoji' && selectedIcon.value === btn.dataset.emojiIcon;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (selectedIcon?.type !== 'emoji') section.querySelector('#nickname-icon-custom').value = '';
    updatePreview(selectedIcon, pendingImageDataUrl);
  }

  section.querySelectorAll('[data-emoji-icon]').forEach(btn => {
    btn.addEventListener('click', () => setSelected({ type: 'emoji', value: btn.dataset.emojiIcon }));
  });

  section.querySelector('#nickname-icon-custom')?.addEventListener('input', event => {
    const value = event.target.value.trim();
    if (value) setSelected({ type: 'emoji', value });
  });

  section.querySelector('#btn-clear-icon')?.addEventListener('click', () => setSelected(null));

  const fileInput = section.querySelector('#nickname-icon-file');
  section.querySelector('#btn-pick-icon-file')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 선택할 수 있어요'); return; }
    try {
      const dataUrl = await dataUrlFromFile(file);
      setSelected({ type: 'pendingImage', dataUrl }, dataUrl);
      toast.success('그림 파일을 선택했어요. 아이콘 적용을 누르면 저장돼요');
    } catch (error) {
      console.error(error);
      toast.error('아이콘 파일을 읽지 못했어요');
    } finally {
      fileInput.value = '';
    }
  });

  section.querySelector('#btn-apply-nickname-icon')?.addEventListener('click', async event => {
    const btn = event.currentTarget;
    try {
      btn.disabled = true;
      btn.textContent = '저장 중...';

      if (selectedIcon?.type === 'pendingImage' && pendingImageDataUrl) {
        const fn = httpsCallable(functions, 'uploadFeedImage');
        const result = await fn({ dataUrl: pendingImageDataUrl });
        const url = result.data?.url;
        if (!url) throw new Error('업로드 실패');
        await saveIcon({ type: 'image', url });
      } else {
        await saveIcon(selectedIcon);
      }
    } catch (error) {
      console.error(error);
      toast.error('프로필 아이콘 저장에 실패했어요');
    } finally {
      btn.disabled = false;
      btn.textContent = '아이콘 적용';
    }
  });
}

function ensureSettingsUI() {
  if (!auth.currentUser) return;
  const content = document.getElementById('account-tab-content');
  if (!content || !content.textContent.includes('닉네임 변경')) return;
  const nickCard = content.querySelector('#new-nickname')?.closest('.card');
  renderIconPicker(nickCard);
}

async function getProfileIcon(uid) {
  if (!uid) return null;
  if (auth.currentUser?.uid === uid) return appState.nicknameIcon || null;
  if (PROFILE_CACHE.has(uid)) return PROFILE_CACHE.get(uid);
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const icon = snap.exists() ? normalizeNicknameIcon(snap.data().nicknameIcon) : null;
    PROFILE_CACHE.set(uid, icon);
    return icon;
  } catch {
    PROFILE_CACHE.set(uid, null);
    return null;
  }
}

function defaultAvatarHtml() {
  const user = auth.currentUser;
  const nickname = appState.nickname || user?.displayName || user?.email?.split('@')[0] || '나';
  if (user?.photoURL) {
    return `<img src="${esc(user.photoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  }
  return esc((nickname || '나')[0]);
}

function avatarContent(icon) {
  const normalized = normalizeNicknameIcon(icon);
  if (!normalized) return defaultAvatarHtml();
  if (normalized.type === 'image') {
    return `<img class="nickname-avatar-img" src="${esc(normalized.url)}" alt="" aria-hidden="true">`;
  }
  return `<span class="nickname-avatar-emoji" aria-hidden="true">${esc(normalized.value)}</span>`;
}

function setAvatar(el, icon) {
  if (!el) return;
  const normalized = normalizeNicknameIcon(icon);
  const key = normalized ? JSON.stringify(normalized) : 'default';
  if (el.dataset.nicknameAvatarKey === key) return;
  el.innerHTML = avatarContent(normalized);
  el.dataset.nicknameAvatarKey = key;
  el.classList.toggle('avatar--nickname-icon', !!normalized);
}

function removePrependedTextIcons() {
  document.querySelectorAll('.account-nickname, .sidebar__user-name').forEach(el => {
    el.querySelectorAll(':scope > .nickname-icon').forEach(icon => icon.remove());
    delete el.dataset.nicknameIconApplied;
  });
}

async function applyAuthorIcons(root = document) {
  const myIcon = appState.nicknameIcon;

  // 기존 닉네임 앞글자 원형 표시 자리에 아이콘을 넣습니다.
  setAvatar(document.querySelector('.account-header > .avatar'), myIcon);
  setAvatar(document.getElementById('sb-avatar'), myIcon);

  // 이전 버전에서 닉네임 글자 앞에 붙었던 아이콘은 제거합니다.
  removePrependedTextIcons();

  // 피드/댓글 텍스트 앞에는 중복 표시를 막기 위해 더 이상 새 아이콘을 붙이지 않습니다.
}

function applyKnownIcons() {
  ensureSettingsUI();
  applyAuthorIcons();
}

let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(applyKnownIcons, 120);
}).observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('hashchange', () => setTimeout(applyKnownIcons, 150));
window.addEventListener('nicknameiconchange', () => setTimeout(applyKnownIcons, 0));
setTimeout(applyKnownIcons, 500);