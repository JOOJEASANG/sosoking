import { auth, functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { initImageUploader, getUploadedImages, hasPendingImages, cleanupUploadedImages } from './components/image-uploader.js';
import { MULTI_PRESETS, getMultiPresetFromHash } from './multi-write/presets.js';
import { renderMultiWriteHTML } from './multi-write/render.js';
import { getBodyText, getBodyHtml, splitTags } from './multi-write/collect.js';
import { fillAutoTags } from './multi-write/auto-tags.js';
import { initRichEditor, syncRichEditor } from './multi-write/editor.js';

const createCommunityPost = httpsCallable(functions, 'createCommunityPost');
const MAX_IMAGES = 20;
const DRAFT_KEY = 'sosoking:communityDraft';
let draftTimer = null;

function isWriteRoute() {
  return /[?&]type=multi\b/.test(location.hash || '');
}
function presetKey() {
  const selected = document.getElementById('mw-selected-preset')?.value || '';
  return MULTI_PRESETS[selected] ? selected : getMultiPresetFromHash(location.hash || '');
}
function saveDraftSoon() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      syncRichEditor();
      const draft = {
        preset: presetKey(),
        title: document.getElementById('mw-title')?.value || '',
        desc: document.getElementById('mw-desc')?.value || '',
        tags: document.getElementById('mw-tags')?.value || '',
        savedAt: Date.now(),
      };
      if (!draft.title && !draft.desc && !draft.tags) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, 1200);
}
function restoreDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return; }
  if (!draft || Date.now() - Number(draft.savedAt || 0) > 86400000) return;
  const banner = document.createElement('div');
  banner.id = 'draft-restore-banner';
  banner.innerHTML = '<span>이전에 작성하던 내용이 있어요.</span><button type="button" class="btn btn--primary btn--sm" data-draft-restore>복원</button><button type="button" class="btn btn--ghost btn--sm" data-draft-clear>삭제</button>';
  document.querySelector('.write-step-header')?.insertAdjacentElement('afterend', banner);
  banner.querySelector('[data-draft-restore]')?.addEventListener('click', () => {
    choosePreset(draft.preset);
    const title = document.getElementById('mw-title');
    const desc = document.getElementById('mw-desc');
    const tags = document.getElementById('mw-tags');
    if (title) title.value = draft.title || '';
    if (desc) desc.value = draft.desc || '';
    if (tags) tags.value = draft.tags || '';
    banner.remove();
  });
  banner.querySelector('[data-draft-clear]')?.addEventListener('click', () => {
    localStorage.removeItem(DRAFT_KEY);
    banner.remove();
  });
}
function sectionVisibility(preset) {
  document.querySelectorAll('[data-write-section]').forEach(section => {
    const key = section.dataset.writeSection;
    const expected = `${preset}-panel`;
    section.style.display = key === expected ? '' : 'none';
  });
  document.querySelectorAll('[data-option-panel]').forEach(panel => {
    panel.style.display = panel.dataset.optionPanel === preset ? '' : 'none';
  });
}
function setFixedVoteOptions(preset) {
  const inputs = [...document.querySelectorAll(`[data-option-panel="${preset}"] .mw-vote-option`)];
  const values = preset === 'judgment'
    ? ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음']
    : ['찬성', '반대'];
  inputs.forEach((input, index) => {
    if (!values[index]) return;
    input.value = values[index];
    input.readOnly = true;
  });
}
function choosePreset(value) {
  const preset = MULTI_PRESETS[value] ? value : 'judgment';
  const hidden = document.getElementById('mw-selected-preset');
  if (hidden) hidden.value = preset;
  document.querySelector('.multi-write-page')?.setAttribute('data-preset-key', preset);
  document.querySelectorAll('[data-multi-preset]').forEach(button => {
    const active = button.dataset.multiPreset === preset;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  sectionVisibility(preset);
  if (preset === 'judgment' || preset === 'vote') setFixedVoteOptions(preset);
  window.dispatchEvent(new Event('sosoking:write-option-changed'));
}

export async function renderMultiWrite() {
  const root = document.getElementById('page-content');
  if (!root || !isWriteRoute()) return;
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    root.innerHTML = '<div class="empty-state"><div class="empty-state__icon">✏️</div><div class="empty-state__title">회원 로그인 후 글을 작성할 수 있어요</div><button class="btn btn--primary" data-write-login>로그인</button></div>';
    root.querySelector('[data-write-login]')?.addEventListener('click', () => navigate('/login?return=/write?type=multi'));
    return;
  }
  const initialPreset = presetKey();
  root.innerHTML = renderMultiWriteHTML({ renderKey: '#/write?type=multi', presetKey: initialPreset });
  initImageUploader(document.getElementById('mw-img-uploader'), MAX_IMAGES);
  initRichEditor(document.getElementById('mw-desc'));
  choosePreset(initialPreset);
  bindEvents();
  setTimeout(restoreDraft, 100);
}

function bindEvents() {
  document.querySelectorAll('[data-multi-preset]').forEach(button => button.addEventListener('click', () => choosePreset(button.dataset.multiPreset)));
  document.getElementById('multi-back-type')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('multi-cancel')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('mw-auto-tags')?.addEventListener('click', () => {
    syncRichEditor();
    const tags = fillAutoTags({ force: true });
    tags.length ? toast.success('태그를 자동 생성했어요.') : toast.warn('제목이나 내용을 조금 더 입력해주세요.');
  });
  ['mw-title', 'mw-desc', 'mw-tags', 'mw-consult-topic', 'mw-consult-style'].forEach(id => document.getElementById(id)?.addEventListener('input', saveDraftSoon));
  document.getElementById('multi-submit')?.addEventListener('click', submit);
}

async function submit() {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    navigate('/login');
    return;
  }
  syncRichEditor();
  const preset = presetKey();
  const title = document.getElementById('mw-title')?.value.trim() || '';
  const body = getBodyHtml() || getBodyText();
  const desc = body || title;
  if (!title) {
    toast.error('제목을 입력해주세요.');
    return;
  }
  if (preset === 'consult' && !body) {
    toast.error('상담 내용을 입력해주세요.');
    return;
  }
  const button = document.getElementById('multi-submit');
  try {
    button.disabled = true;
    button.textContent = hasPendingImages() ? '사진 올리는 중...' : '등록 중...';
    const images = await getUploadedImages();
    const manualTags = splitTags(document.getElementById('mw-tags')?.value || '');
    const tags = manualTags.length ? manualTags : fillAutoTags({ force: true });
    const result = await createCommunityPost({
      preset,
      title,
      desc,
      tags,
      images,
      topic: document.getElementById('mw-consult-topic')?.value || 'daily',
      style: document.getElementById('mw-consult-style')?.value || 'realistic',
    });
    const postId = result.data?.postId;
    if (!postId) throw new Error('게시글 저장 응답이 올바르지 않습니다.');
    localStorage.removeItem(DRAFT_KEY);
    toast.success(`게시글을 등록했어요. +${Number(result.data?.points || 0)}P`);
    navigate(`/detail/${postId}`);
  } catch (error) {
    console.error('[community write]', error);
    await cleanupUploadedImages();
    toast.error(error.message || '게시글 등록에 실패했습니다.');
  } finally {
    button.disabled = false;
    button.textContent = '등록하기';
  }
}
