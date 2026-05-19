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
          ${renderNicknameIcon(current, 'nickname-icon--preview') || '<span class="nickname-icon nickname-icon--empty">기본</span>'}
        </div>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--color-text-primary)">${esc(appState.nickname || auth.currentUser?.displayName || '내 닉네임')}</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:3px">기존 닉네임 앞글자 원형 자리에 표시돼요</div>
        </div>
      </div>
      <div class="nickname-icon-emoji-grid">
        ${DEFAULT_ICONS.map(icon => `<button type="button" class="nickname-icon-choice" data-emoji-icon="${icon}" aria-label="${icon}">${icon}</button>`).join('')}
      </div>
      <div class="nickname-icon-custom-row">
        <input id="nickname-icon-custom" class="form-input" maxlength="4" placeholder="직접 입력 예: 🐰">
        <button class="btn btn--ghost btn--sm" id="btn-save-custom-icon">아이콘 적용</button>
      </div>
      <div class="nickname-icon-upload-row">
        <input id="nickname-icon-file" type="file" accept="image/*" style="display:none">
        <button class="btn btn--ghost btn--sm" id="btn-pick-icon-file">그림 파일 선택</button>
        <button class="btn btn--ghost btn--sm" id="btn-clear-icon" style="color:var(--color-danger)">기본 앞글자로 되돌리기</button>
      </div>
      <div class="form-hint" style="margin-top:8px">선택한 이모지나 그림 파일은 닉네임 텍스트 앞에 따로 붙지 않고, 기존 앞글자 원형 표시 자리에만 보여요.</div>
    </div>`;

  target.insertAdjacentElement('afterend', section);
  target.dataset.nicknameIconReady = '1';
  setupPickerEvents(section);
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
  updatePreview();
  applyKnownIcons();
  toast.success(normalized ? '프로필 아이콘을 저장했어요' : '기본 앞글자 표시로 되돌렸어요');
}

function updatePreview() {
  const preview = document.getElementById('nickname-icon-preview');
  if (!preview) return;
  preview.innerHTML = renderNicknameIcon(appState.nicknameIcon, 'nickname-icon--preview') || '<span class="nickname-icon nickname-icon--empty">기본</span>';
}

function setupPickerEvents(section) {
  section.querySelectorAll('[data-emoji-icon]').forEach(btn => {
    btn.addEventListener('click', () => saveIcon({ type: 'emoji', value: btn.dataset.emojiIcon }));
  });

  section.querySelector('#btn-save-custom-icon')?.addEventListener('click', () => {
    const value = section.querySelector('#nickname-icon-custom')?.value.trim();
    if (!value) { toast.warn('아이콘으로 쓸 이모지를 입력해주세요'); return; }
    saveIcon({ type: 'emoji', value });
  });

  section.querySelector('#btn-clear-icon')?.addEventListener('click', () => saveIcon(null));

  const fileInput = section.querySelector('#nickname-icon-file');
  section.querySelector('#btn-pick-icon-file')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 선택할 수 있어요'); return; }
    try {
      const dataUrl = await dataUrlFromFile(file);
      const fn = httpsCallable(functions, 'uploadFeedImage');
      const result = await fn({ dataUrl });
      const url = result.data?.url;
      if (!url) throw new Error('업로드 실패');
      await saveIcon({ type: 'image', url });
    } catch (error) {
      console.error(error);
      toast.error('아이콘 파일 저장에 실패했어요');
    } finally {
      fileInput.value = '';
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
