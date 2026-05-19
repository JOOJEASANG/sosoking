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
      <div class="section-title" style="font-size:15px;margin-bottom:12px">🎭 닉네임 앞 아이콘</div>
      <div class="nickname-icon-preview-row">
        <div class="nickname-icon-preview" id="nickname-icon-preview">
          ${renderNicknameIcon(current, 'nickname-icon--preview') || '<span class="nickname-icon nickname-icon--empty">없음</span>'}
        </div>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--color-text-primary)">${esc(appState.nickname || auth.currentUser?.displayName || '내 닉네임')}</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:3px">게시글·댓글·내 정보에서 닉네임 앞에 표시돼요</div>
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
        <button class="btn btn--ghost btn--sm" id="btn-clear-icon" style="color:var(--color-danger)">아이콘 제거</button>
      </div>
      <div class="form-hint" style="margin-top:8px">그림 파일은 작은 정사각형 아이콘으로 보이도록 자동 축소돼요. 움직이는 GIF는 원본 유지됩니다.</div>
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
  toast.success(normalized ? '닉네임 아이콘을 저장했어요' : '닉네임 아이콘을 제거했어요');
}

function updatePreview() {
  const preview = document.getElementById('nickname-icon-preview');
  if (!preview) return;
  preview.innerHTML = renderNicknameIcon(appState.nicknameIcon, 'nickname-icon--preview') || '<span class="nickname-icon nickname-icon--empty">없음</span>';
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

function prependIconToElement(el, icon) {
  if (!el || el.dataset.nicknameIconApplied === '1') return;
  const html = renderNicknameIcon(icon);
  if (!html) return;
  el.insertAdjacentHTML('afterbegin', html);
  el.dataset.nicknameIconApplied = '1';
}

async function applyAuthorIcons(root = document) {
  // 현재 로그인 사용자 표시 영역
  const myIcon = appState.nicknameIcon;
  document.querySelectorAll('.account-nickname, .sidebar__user-name').forEach(el => prependIconToElement(el, myIcon));

  // 상세 게시글 작성자명
  document.querySelectorAll('.detail-meta span:first-child').forEach(async el => {
    const uid = document.querySelector('[data-post-author-id]')?.dataset.postAuthorId;
    if (!uid) return;
    const icon = await getProfileIcon(uid);
    prependIconToElement(el, icon);
  });

  // 피드 카드 작성자명은 authorId가 DOM에 없으므로 현재 사용자의 내 글/작성 직후 화면 위주로 보정
  const myName = appState.nickname || auth.currentUser?.displayName;
  if (myName) {
    document.querySelectorAll('.feed-card__meta span:first-child, .comment-item__author, .acrostic-card__name, .notif-item__text strong:first-child').forEach(el => {
      if ((el.textContent || '').trim() === myName) prependIconToElement(el, myIcon);
    });
  }
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
