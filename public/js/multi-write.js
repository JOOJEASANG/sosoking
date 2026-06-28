import { auth, db } from './firebase.js';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';
import { initImageUploader, getUploadedImages, hasPendingImages } from './components/image-uploader.js';
import { awardPoints } from './utils/points.js';
import { MULTI_PRESETS, getMultiPresetFromHash } from './multi-write/presets.js';
import { renderMultiWriteHTML } from './multi-write/render.js';
import { collectMultiModules, getBodyText, getBodyHtml, splitTags } from './multi-write/collect.js';
import { fillAutoTags } from './multi-write/auto-tags.js';
import { initRichEditor, syncRichEditor } from './multi-write/editor.js';

const MAX_FEED_IMAGES = 20;
const DRAFT_KEY = 'sosoking:multiWriteDraft';
let draftTimer = null;

function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      syncRichEditor();
      const preset = getPresetKey();
      const title = document.getElementById('mw-title')?.value || '';
      const desc = document.getElementById('mw-desc')?.value || '';
      const tags = document.getElementById('mw-tags')?.value || '';
      if (!title && !desc && !tags) { clearDraft(); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ preset, title, desc, tags, savedAt: Date.now() }));
    } catch {}
  }, 1500);
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function offerDraftRestore() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return; }
  if (!draft || Date.now() - draft.savedAt > 86_400_000) { clearDraft(); return; }

  const banner = document.createElement('div');
  banner.id = 'draft-restore-banner';
  banner.innerHTML = `
    <span style="flex:1;color:var(--color-text-primary)">💾 이전에 작성하던 내용이 있어요.</span>
    <button class="btn btn--primary btn--sm" id="draft-yes">복원하기</button>
    <button class="btn btn--ghost btn--sm" id="draft-no">무시</button>`;

  const header = document.querySelector('.write-step-header');
  if (header) header.insertAdjacentElement('afterend', banner);

  document.getElementById('draft-yes')?.addEventListener('click', () => {
    if (draft.preset) updateOptionSelection(draft.preset);
    setTimeout(() => {
      ['title', 'desc', 'tags'].forEach(key => {
        if (draft[key]) {
          const el = document.getElementById(`mw-${key}`);
          if (el) el.value = draft[key];
        }
      });
      updateWriteStateOnly();
    }, 80);
    banner.remove();
    clearDraft();
  });

  document.getElementById('draft-no')?.addEventListener('click', () => {
    clearDraft();
    banner.remove();
  });
}

function isMultiQuery() {
  return /[?&]type=multi\b/.test(window.location.hash || '');
}

function getPresetKey() {
  const selected = document.getElementById('mw-selected-preset')?.value || '';
  if (selected && MULTI_PRESETS[selected]) return selected;
  return getMultiPresetFromHash(window.location.hash || '');
}

function feedTypeFromPreset(presetKey) {
  if (presetKey === 'vote') return 'vote';
  return 'collect';
}

function updateWriteStateOnly() {
  const page = document.querySelector('.multi-write-page');
  const preset = getPresetKey();
  if (page) page.dataset.presetKey = preset;
}

function clonePublicModules(modules) {
  return JSON.parse(JSON.stringify(modules || {}));
}

function bindTextStateEvents() {
  function onInput() { updateWriteStateOnly(); scheduleDraftSave(); }
  ['mw-title', 'mw-desc', 'mw-tags', 'mw-consult-topic', 'mw-consult-style']
    .forEach(id => document.getElementById(id)?.addEventListener('input', onInput));
  document.querySelectorAll('.mw-vote-option').forEach(input => input.addEventListener('input', onInput));
  document.getElementById('mw-desc')?.addEventListener('keyup', updateWriteStateOnly);
}

export async function renderMultiWrite() {
  const el = document.getElementById('page-content');
  if (!el || !isMultiQuery()) return;

  if (!auth.currentUser) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">✏️</div>
        <div class="empty-state__title">로그인 후 올릴 수 있어요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login?return=/write?type=multi')">로그인하기</button>
      </div>`;
    return;
  }

  const renderKey = '#/write?type=multi';
  const presetKey = getPresetKey();
  el.innerHTML = renderMultiWriteHTML({ renderKey, presetKey });
  initImageUploader(document.getElementById('mw-img-uploader'), MAX_FEED_IMAGES);
  initRichEditor(document.getElementById('mw-desc'));
  bindMultiWriteEvents();
  bindTextStateEvents();
  setVoteMode();
  updateOptionSelection(presetKey);
  updateWriteStateOnly();
  setTimeout(offerDraftRestore, 150);
}

function setWriteSectionVisibility(normalized) {
  document.querySelectorAll('[data-write-section]').forEach(section => {
    const key = section.dataset.writeSection;
    if (key === 'vote-panel') section.style.display = normalized === 'vote' ? '' : 'none';
    if (key === 'consult-panel') section.style.display = normalized === 'consult' ? '' : 'none';
  });
}

function updateOptionSelection(preset) {
  const normalized = MULTI_PRESETS[preset] ? preset : 'collect';
  const hidden = document.getElementById('mw-selected-preset');
  if (hidden) hidden.value = normalized;
  const page = document.querySelector('.multi-write-page');
  if (page) page.dataset.presetKey = normalized;

  document.querySelectorAll('[data-multi-preset]').forEach(btn => {
    const active = btn.dataset.multiPreset === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  document.querySelectorAll('[data-option-panel]').forEach(panel => {
    panel.style.display = panel.dataset.optionPanel === normalized ? '' : 'none';
  });

  setWriteSectionVisibility(normalized);

  document.querySelectorAll('[data-module-input]').forEach(input => {
    const key = input.dataset.moduleInput;
    if (key === normalized) input.setAttribute('data-module-toggle', key);
    else input.removeAttribute('data-module-toggle');
  });

  if (normalized === 'vote') setVoteMode();
  window.dispatchEvent(new Event('sosoking:write-option-changed'));
}

function setVoteMode() {
  const hidden = document.getElementById('mw-vote-mode');
  if (hidden) hidden.value = 'pros_cons';
  const options = [...document.querySelectorAll('.mw-vote-option')];
  if (options[0]) { options[0].value = '찬성'; options[0].readOnly = true; }
  if (options[1]) { options[1].value = '반대'; options[1].readOnly = true; }
}

function bindMultiWriteEvents() {
  document.getElementById('multi-back-type')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('multi-cancel')?.addEventListener('click', () => navigate('/feed'));
  document.getElementById('mw-auto-tags')?.addEventListener('click', () => {
    syncRichEditor();
    const tags = fillAutoTags({ force: true });
    updateWriteStateOnly();
    if (tags.length) toast.success('태그를 자동 생성했어요');
    else toast.warn('제목이나 내용을 조금 더 입력하면 태그를 만들 수 있어요');
  });

  document.querySelectorAll('[data-multi-preset]').forEach(btn => btn.addEventListener('click', () => updateOptionSelection(btn.dataset.multiPreset)));
  document.getElementById('multi-submit')?.addEventListener('click', submitMultiPost);
}

async function submitMultiPost() {
  if (!auth.currentUser) {
    navigate('/login');
    return;
  }

  const presetKey = getPresetKey();
  syncRichEditor();
  const btn = document.getElementById('multi-submit');
  let title = document.getElementById('mw-title')?.value.trim() || '';
  const preset = MULTI_PRESETS[presetKey] || MULTI_PRESETS.collect;
  const bodyValue = getBodyHtml() || getBodyText();
  const desc = presetKey === 'vote' ? (bodyValue || title) : bodyValue;

  if (!title) {
    toast.error(presetKey === 'vote' ? '찬반 토론 주제를 입력해주세요.' : presetKey === 'consult' ? '고민 제목을 입력해주세요.' : '제목을 입력해주세요.');
    return;
  }

  let docRef = null;
  try {
    const collectedModules = collectMultiModules();
    const publicModules = clonePublicModules(collectedModules);
    btn.disabled = true;
    btn.textContent = hasPendingImages() ? '사진 올리는 중...' : '올리는 중...';

    const images = await getUploadedImages();
    if (images.length > MAX_FEED_IMAGES) throw new Error(`사진은 최대 ${MAX_FEED_IMAGES}장까지 올릴 수 있어요.`);
    btn.textContent = '게시글 저장 중...';

    const manualTags = splitTags(document.getElementById('mw-tags')?.value || '');
    const tags = manualTags.length ? manualTags : fillAutoTags({ force: true });
    docRef = doc(collection(db, 'feeds'));

    const postData = {
      type: 'multi',
      cat: 'multi',
      subtype: presetKey,
      feedType: feedTypeFromPreset(presetKey),
      typeLabel: preset.label,
      title,
      desc,
      tags,
      images,
      modules: publicModules,
      anonymous: false,
      anonymousMode: '',
      authorId: auth.currentUser.uid,
      authorName: appState.nickname || auth.currentUser.displayName || '익명',
      authorPhoto: auth.currentUser.photoURL || '',
      authorEmail: auth.currentUser.email || '',
      reactions: { total: 0 },
      commentCount: 0,
      viewCount: 0,
      pointsScore: 0,
      createdAt: serverTimestamp(),
    };

    await setDoc(docRef, postData);

    await awardPoints('post_create', { postId: docRef.id, type: presetKey }).catch(() => {});
    clearDraft();
    toast.success(`${preset.label}로 올렸어요! +10P 🎉`);
    navigate(`/detail/${docRef.id}`);
  } catch (error) {
    console.error(error);
    if (docRef) await deleteDoc(docRef).catch(() => {});
    toast.error(error.message || '올리기에 실패했어요.');
    btn.disabled = false;
    btn.textContent = '올리기';
  }
}

function run() {
  if (isMultiQuery()) {
    const page = document.querySelector('.multi-write-page');
    const key = '#/write?type=multi';
    if (!page || page.dataset.renderKey !== key) renderMultiWrite();
    else updateWriteStateOnly();
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:render-multi-write', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
